import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth, db, storage, adminAuth } from '../firebase/config';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Crear el contexto
const FirebaseContext = createContext();

// Hook personalizado para usar el contexto
export const useFirebase = () => useContext(FirebaseContext);

// Proveedor del contexto
export const FirebaseProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const isSyncingRef = useRef(false);

  // Escuchar cambios en el estado de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Funciones de autenticación
  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  const signup = async (email, password) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        email: user.email,
        role: 'usuario',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error al guardar el usuario en Firestore:', error);
    }

    return userCredential;
  };

  const logout = () => {
    return signOut(auth);
  };

  // Funciones de Firestore
  const saveGuideRecord = async (guideData) => {
    try {
      const userId = currentUser?.uid;
      if (!userId) {
        throw new Error('Usuario no autenticado');
      }

      // Añadir datos adicionales
      const recordToSave = {
        ...guideData,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        synced: true
      };

      // Guardar en Firestore
      const docRef = await addDoc(collection(db, 'guideRecords'), recordToSave);
      return { id: docRef.id, ...recordToSave };
    } catch (error) {
      console.error('Error al guardar registro:', error);
      throw error;
    }
  };

  const getGuideRecords = async () => {
    try {
      const userId = currentUser?.uid;
      if (!userId) {
        throw new Error('Usuario no autenticado');
      }

      const q = query(
        collection(db, 'guideRecords'),
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return records.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || a.date || 0).getTime();
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || b.date || 0).getTime();
        return bTime - aTime;
      });
    } catch (error) {
      console.error('Error al obtener registros:', error);
      throw error;
    }
  };

  // Función para subir PDF a Firebase Storage
  const uploadPDF = async (file, guideName) => {
    try {
      const userId = currentUser?.uid;
      if (!userId) {
        throw new Error('Usuario no autenticado');
      }

      const fileRef = ref(storage, `guides/${userId}/${guideName}_${Date.now()}.pdf`);
      await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(fileRef);
      return downloadURL;
    } catch (error) {
      console.error('Error al subir PDF:', error);
      throw error;
    }
  };

  // Función para sincronizar registros locales con Firestore
  const syncLocalRecords = async (localRecords) => {
    try {
      const userId = currentUser?.uid;
      if (!userId || !localRecords || localRecords.length === 0) {
        return { success: false, message: 'No hay registros para sincronizar' };
      }

      const syncPromises = localRecords
        .filter(record => !record.synced)
        .map(async (record) => {
          // Si el registro tiene un archivo PDF, subirlo primero
          let pdfUrl = record.pdfUrl;
          if (record.file) {
            pdfUrl = await uploadPDF(record.file, record.guideNumber);
          }

          // Guardar el registro en Firestore (sin campos undefined)
          const recordToSave = {
            ...record,
            userId,
            location: record.location || { latitude: 'No disponible', longitude: 'No disponible' },
            createdAt: record.date ? new Date(record.date) : new Date(),
            updatedAt: serverTimestamp(),
            synced: true,
            ...(pdfUrl ? { pdfUrl } : {})
          };

          delete recordToSave.file; // Eliminar el archivo binario
          if (recordToSave.pdfUrl === undefined) {
            delete recordToSave.pdfUrl;
          }

          const docRef = await addDoc(collection(db, 'guideRecords'), recordToSave);
          return { id: docRef.id, ...recordToSave };
        });

      const syncedRecords = await Promise.all(syncPromises);
      return { 
        success: true, 
        message: `${syncedRecords.length} registros sincronizados correctamente`,
        records: syncedRecords
      };
    } catch (error) {
      console.error('Error al sincronizar registros:', error);
      throw error;
    }
  };

  const syncPendingRecords = useCallback(async () => {
    try {
      if (isSyncingRef.current) {
        return { success: false, message: 'Sincronización en curso' };
      }

      const userId = currentUser?.uid;
      if (!userId) {
        return { success: false, message: 'Debes iniciar sesión para sincronizar tus registros.' };
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { success: false, message: 'Sin conexión a internet. Inténtalo cuando vuelvas a tener señal.' };
      }

      const records = JSON.parse(localStorage.getItem('guideRecords') || '[]');
      const pendingRecords = records.filter(record => !record.synced);

      if (pendingRecords.length === 0) {
        return { success: false, message: 'No hay registros pendientes para sincronizar', remainingPending: 0 };
      }

      isSyncingRef.current = true;

      const result = await syncLocalRecords(pendingRecords);

      if (result.success) {
        const syncedRecords = result.records || [];
        const syncedIds = new Set(syncedRecords.map(record => record.localId).filter(Boolean));
        const remainingRecords = records.filter(record => !syncedIds.has(record.localId));
        localStorage.setItem('guideRecords', JSON.stringify(remainingRecords));

        const nowISO = new Date().toISOString();
        localStorage.setItem('lastSync', nowISO);

        const remainingPending = remainingRecords.filter(record => !record.synced).length;
        window.dispatchEvent(new CustomEvent('guideRecordsUpdated'));

        return {
          success: true,
          message: result.message || 'Registros sincronizados correctamente',
          syncedCount: syncedIds.size,
          remainingPending,
          lastSync: nowISO
        };
      }

      return {
        success: false,
        message: result.message || 'Error al sincronizar registros'
      };
    } catch (error) {
      console.error('Error al sincronizar registros pendientes:', error);
      return {
        success: false,
        message: error.message || 'Error inesperado al sincronizar'
      };
    } finally {
      isSyncingRef.current = false;
    }
  }, [currentUser, syncLocalRecords]);

  useEffect(() => {
    if (!currentUser) return;

    const handleOnline = () => {
      syncPendingRecords();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [currentUser, syncPendingRecords]);

  useEffect(() => {
    if (!currentUser) return;
    syncPendingRecords();
  }, [currentUser, syncPendingRecords]);

  // Valor del contexto
  const getAllUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          email: data.email || '',
          role: data.role || 'usuario',
          location: data.location || '',
          destinations: Array.isArray(data.destinations) ? data.destinations : [],
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt || null,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt || null
        };
      }).sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }
  };

  const createUserRecord = async ({ uid, email, role, name, location = '', destinations = [] }) => {
    if (!uid || !email) {
      throw new Error('UID y correo son obligatorios');
    }
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, {
      name: name || '',
      email,
      role: role || 'usuario',
      location,
      destinations,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  };

  const updateUserAccess = async (uid, { role, location, destinations }) => {
    if (!uid) throw new Error('UID inválido');
    const userDocRef = doc(db, 'users', uid);
    const payload = {
      updatedAt: serverTimestamp()
    };
    if (typeof role !== 'undefined') payload.role = role;
    if (typeof location !== 'undefined') payload.location = location;
    if (typeof destinations !== 'undefined') payload.destinations = destinations;
    await updateDoc(userDocRef, payload);
  };

  const deleteUserRecord = async (uid) => {
    if (!uid) throw new Error('UID inválido');
    await deleteDoc(doc(db, 'users', uid));
  };

  // Catálogo de destinos y ubicaciones
  const mapTimestamp = (value) => (value?.toDate ? value.toDate() : value || null);

  const getDestinationsCatalog = async () => {
    const snapshot = await getDocs(collection(db, 'destinationsCatalog'));
    return snapshot.docs
      .map((docItem) => {
        const data = docItem.data();
        return {
          id: docItem.id,
          name: data.name || '',
          subDestinations: Array.isArray(data.subDestinations) ? data.subDestinations : [],
          createdAt: mapTimestamp(data.createdAt),
          updatedAt: mapTimestamp(data.updatedAt)
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  };

  const createDestinationCatalog = async ({ name }) => {
    const trimmedName = name?.trim();
    if (!trimmedName) throw new Error('El nombre del destino es obligatorio');
    await addDoc(collection(db, 'destinationsCatalog'), {
      name: trimmedName,
      subDestinations: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  };

  const updateDestinationCatalog = async (id, payload = {}) => {
    if (!id) throw new Error('ID de destino inválido');
    const docRef = doc(db, 'destinationsCatalog', id);
    await updateDoc(docRef, {
      ...payload,
      updatedAt: serverTimestamp()
    });
  };

  const deleteDestinationCatalog = async (id) => {
    if (!id) throw new Error('ID de destino inválido');
    await deleteDoc(doc(db, 'destinationsCatalog', id));
  };

  const getLocationsCatalog = async () => {
    const snapshot = await getDocs(collection(db, 'locationsCatalog'));
    return snapshot.docs
      .map((docItem) => {
        const data = docItem.data();
        return {
          id: docItem.id,
          name: data.name || '',
          createdAt: mapTimestamp(data.createdAt),
          updatedAt: mapTimestamp(data.updatedAt)
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  };

  const createLocationCatalog = async ({ name }) => {
    const trimmedName = name?.trim();
    if (!trimmedName) throw new Error('El nombre de la ubicación es obligatorio');
    await addDoc(collection(db, 'locationsCatalog'), {
      name: trimmedName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  };

  const updateLocationCatalog = async (id, payload = {}) => {
    if (!id) throw new Error('ID de ubicación inválido');
    const docRef = doc(db, 'locationsCatalog', id);
    await updateDoc(docRef, {
      ...payload,
      updatedAt: serverTimestamp()
    });
  };

  const deleteLocationCatalog = async (id) => {
    if (!id) throw new Error('ID de ubicación inválido');
    await deleteDoc(doc(db, 'locationsCatalog', id));
  };

  const createManagedUser = async ({ name, email, password, role, location = '', destinations = [] }) => {
    if (!email || !password) {
      throw new Error('Correo y contraseña son obligatorios');
    }
    if (password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }
    const userCredential = await createUserWithEmailAndPassword(adminAuth, email, password);
    const uid = userCredential.user.uid;
    await createUserRecord({ uid, email, role, name, location, destinations });
    return uid;
  };

  const value = {
    currentUser,
    login,
    loginWithGoogle,
    signup,
    logout,
    saveGuideRecord,
    getGuideRecords,
    uploadPDF,
    syncLocalRecords,
    syncPendingRecords,
    getAllUsers,
    createUserRecord,
    updateUserAccess,
    deleteUserRecord,
    getDestinationsCatalog,
    createDestinationCatalog,
    updateDestinationCatalog,
    deleteDestinationCatalog,
    getLocationsCatalog,
    createLocationCatalog,
    updateLocationCatalog,
    deleteLocationCatalog,
    createManagedUser
  };

  return (
    <FirebaseContext.Provider value={value}>
      {!loading && children}
    </FirebaseContext.Provider>
  );
};

export default FirebaseContext;
