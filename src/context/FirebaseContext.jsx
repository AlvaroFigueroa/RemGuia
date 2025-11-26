import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth, db, storage } from '../firebase/config';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  updateDoc,
  doc,
  getDoc
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

  const signup = (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
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
    loading
  };

  return (
    <FirebaseContext.Provider value={value}>
      {!loading && children}
    </FirebaseContext.Provider>
  );
};

export default FirebaseContext;
