import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  const [profileLoading, setProfileLoading] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const isSyncingRef = useRef(false);
  const transporteApiBaseUrl = useMemo(() => {
    const envBase = (import.meta.env.VITE_TRANSPORTE_API || '').trim();
    const base = envBase.length > 0 ? envBase : 'https://guia.codecland.com/api';
    return base.endsWith('/') ? base.slice(0, -1) : base;
  }, []);

  // Escuchar cambios en el estado de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setCurrentUserProfile(null);
      setProfileLoading(false);
      return;
    }

    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          setCurrentUserProfile({ id: snapshot.id, ...snapshot.data() });
        } else {
          setCurrentUserProfile({ id: currentUser.uid, email: currentUser.email, role: 'usuario' });
        }
      } catch (error) {
        console.error('Error al cargar el perfil del usuario:', error);
        setCurrentUserProfile({ id: currentUser.uid, email: currentUser.email, role: 'usuario' });
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [currentUser]);

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

  const updateGuideRecord = async (guideId, payload = {}) => {
    if (!guideId) {
      throw new Error('ID de guía inválido');
    }

    const docRef = doc(db, 'guideRecords', guideId);
    const sanitizedPayload = {
      updatedAt: serverTimestamp()
    };

    if (typeof payload.date !== 'undefined') {
      sanitizedPayload.date = payload.date;
    }
    if (typeof payload.destination !== 'undefined') {
      sanitizedPayload.destination = payload.destination;
    }
    if (typeof payload.subDestination !== 'undefined') {
      sanitizedPayload.subDestination = payload.subDestination;
    }

    await updateDoc(docRef, sanitizedPayload);
  };

  const getGuideRecords = async () => {
    try {
      const userId = currentUser?.uid;
      if (!userId) {
        throw new Error('Usuario no autenticado');
      }

      let queryRef;
      if (currentUserProfile?.role === 'admin') {
        queryRef = collection(db, 'guideRecords');
      } else {
        queryRef = query(
          collection(db, 'guideRecords'),
          where('userId', '==', userId)
        );
      }

      const querySnapshot = await getDocs(queryRef);
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

  const guideExists = useCallback(async (guideNumber) => {
    const normalized = guideNumber?.trim();
    if (!normalized) return false;
    try {
      const guidesRef = collection(db, 'guideRecords');
      const guidesQuery = query(guidesRef, where('guideNumber', '==', normalized));
      const snapshot = await getDocs(guidesQuery);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error al verificar número de guía duplicado:', error);
      throw error;
    }
  }, []);

  // Catálogo de destinos y ubicaciones
  const mapTimestamp = (value) => (value?.toDate ? value.toDate() : value || null);
  const ROUTE_HIGHLIGHTS_COLLECTION = 'routeHighlights';

  const sanitizeRouteSegment = (value) => {
    const normalized = value?.toString().trim();
    if (!normalized) return 'todos';
    return normalized
      .normalize('NFD')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  };

  const buildRouteHighlightKey = (destino = 'Todos', subDestino = 'Todos', origen = 'Todos') => {
    const safeDestino = sanitizeRouteSegment(destino || 'Todos');
    const safeSub = sanitizeRouteSegment(subDestino || 'Todos');
    const safeOrigin = sanitizeRouteSegment(origen || 'Todos');
    return `${safeDestino}__${safeSub}__${safeOrigin}`;
  };

  const buildLegacyRouteHighlightKey = (destino = 'Todos', subDestino = 'Todos') => {
    const safeDestino = sanitizeRouteSegment(destino || 'Todos');
    const safeSub = sanitizeRouteSegment(subDestino || 'Todos');
    return `${safeDestino}__${safeSub}`;
  };

  const getRouteHighlight = useCallback(async ({ destino = 'Todos', subDestino = 'Todos', origen = 'Todos' } = {}) => {
    const key = buildRouteHighlightKey(destino, subDestino, origen);
    const docRef = doc(db, ROUTE_HIGHLIGHTS_COLLECTION, key);
    let snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      // Compatibilidad con documentos antiguos sin origen
      const legacyKey = buildLegacyRouteHighlightKey(destino, subDestino);
      snapshot = await getDoc(doc(db, ROUTE_HIGHLIGHTS_COLLECTION, legacyKey));
      if (!snapshot.exists()) return null;
    }
    return { id: snapshot.id, ...snapshot.data() };
  }, []);

  const saveRouteHighlight = useCallback(
    async ({ destino, subDestino = 'Todos', origen = 'Todos', averageDistance = '', routeConditions = '' }) => {
      const trimmedDestino = destino?.toString().trim();
      if (!trimmedDestino || trimmedDestino === 'Todos') {
        throw new Error('Debes seleccionar un destino específico para guardar notas.');
      }
      const normalizedOrigin = origen?.toString().trim();
      if (!normalizedOrigin || normalizedOrigin === 'Todos') {
        throw new Error('Debes seleccionar un origen específico para guardar notas.');
      }
      const normalizedSub = subDestino?.toString().trim() || 'Todos';
      const key = buildRouteHighlightKey(trimmedDestino, normalizedSub, normalizedOrigin);
      const payload = {
        destino: trimmedDestino,
        subDestino: normalizedSub,
        origen: normalizedOrigin,
        averageDistance: averageDistance?.toString().trim() || '',
        routeConditions: routeConditions?.toString().trim() || '',
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || null
      };
      await setDoc(doc(db, ROUTE_HIGHLIGHTS_COLLECTION, key), payload, { merge: true });
      return { id: key, ...payload };
    },
    [currentUser?.uid]
  );

  const deleteRouteHighlight = useCallback(async ({ destino, subDestino = 'Todos', origen = 'Todos' }) => {
    const trimmedDestino = destino?.toString().trim();
    if (!trimmedDestino || trimmedDestino === 'Todos') {
      throw new Error('Debes indicar un destino específico para eliminar notas.');
    }
    const normalizedOrigin = origen?.toString().trim();
    if (!normalizedOrigin || normalizedOrigin === 'Todos') {
      throw new Error('Debes indicar un origen específico para eliminar notas.');
    }
    const key = buildRouteHighlightKey(trimmedDestino, subDestino?.toString().trim() || 'Todos', normalizedOrigin);
    await deleteDoc(doc(db, ROUTE_HIGHLIGHTS_COLLECTION, key));
    return key;
  }, []);

  const isBrowser = typeof window !== 'undefined';
  const CACHE_VERSION = 2;
  const CACHE_KEYS = {
    destinations: `remfisc:cache:v${CACHE_VERSION}:destinations`,
    locations: `remfisc:cache:v${CACHE_VERSION}:locations`
  };

  const readCache = useCallback((key) => {
    if (!isBrowser) return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.version !== CACHE_VERSION) {
        return null;
      }
      if (!Array.isArray(parsed?.data)) return null;
      return parsed.data;
    } catch (error) {
      console.warn('No se pudo leer el caché local', error);
      return null;
    }
  }, [isBrowser]);

  const writeCache = useCallback((key, data) => {
    if (!isBrowser || !Array.isArray(data)) return;
    try {
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now(), version: CACHE_VERSION }));
    } catch (error) {
      console.warn('No se pudo guardar el caché local', error);
    }
  }, [isBrowser]);

  const isOnline = () => (typeof navigator !== 'undefined' ? navigator.onLine : true);

  const fetchSqlDestinationsCatalog = useCallback(async () => {
    const response = await fetch(`${transporteApiBaseUrl}/destinos_with_subdestinos.php`);
    if (!response.ok) {
      throw new Error('No se pudieron obtener los destinos desde el servidor SQL');
    }
    const payload = await response.json();
    if (!payload?.success) {
      throw new Error(payload?.message || 'Respuesta inválida del servidor de destinos');
    }
    return Array.isArray(payload.data) ? payload.data : [];
  }, [transporteApiBaseUrl]);

  const fetchSqlLocationsCatalog = useCallback(async () => {
    const response = await fetch(`${transporteApiBaseUrl}/ubicaciones.php`);
    if (!response.ok) {
      throw new Error('No se pudieron obtener las ubicaciones desde el servidor SQL');
    }
    const payload = await response.json();
    if (!payload?.success) {
      throw new Error(payload?.message || 'Respuesta inválida del servidor de ubicaciones');
    }
    const rawData = Array.isArray(payload.data) ? payload.data : [];
    return rawData
      .map((item, index) => ({
        id: item.id ?? `sql-${index + 1}`,
        name: typeof item.name === 'string' ? item.name.trim() : ''
      }))
      .filter((item) => item.name);
  }, [transporteApiBaseUrl]);

  const getDestinationsCatalog = async () => {
    const cached = readCache(CACHE_KEYS.destinations);
    if (!isOnline() && cached) {
      return cached;
    }

    try {
      const sqlData = await fetchSqlDestinationsCatalog();
      writeCache(CACHE_KEYS.destinations, sqlData);
      return sqlData;
    } catch (sqlError) {
      console.warn('Fallo al cargar destinos desde SQL, usando Firestore como respaldo:', sqlError);
    }

    try {
      const snapshot = await getDocs(collection(db, 'destinationsCatalog'));
      const fallback = snapshot.docs
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
      if (fallback.length > 0) {
        writeCache(CACHE_KEYS.destinations, fallback);
      }
      if (fallback.length === 0 && cached) {
        return cached;
      }
      return fallback;
    } catch (firestoreError) {
      console.error('Error al cargar destinos desde Firestore:', firestoreError);
      if (cached) {
        return cached;
      }
      throw firestoreError;
    }
  };

  const getLocationsCatalog = async () => {
    const cached = readCache(CACHE_KEYS.locations);
    if (!isOnline() && cached) {
      return cached;
    }

    try {
      const sqlLocations = await fetchSqlLocationsCatalog();
      if (sqlLocations.length > 0) {
        const sorted = sqlLocations.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
        writeCache(CACHE_KEYS.locations, sorted);
        return sorted;
      }
    } catch (sqlError) {
      console.warn('Fallo al cargar ubicaciones desde SQL, usando Firestore como respaldo:', sqlError);
    }

    try {
      const snapshot = await getDocs(collection(db, 'locationsCatalog'));
      const fallback = snapshot.docs
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
      if (fallback.length > 0) {
        writeCache(CACHE_KEYS.locations, fallback);
      }
      if (fallback.length === 0 && cached) {
        return cached;
      }
      return fallback;
    } catch (firestoreError) {
      console.error('Error al cargar ubicaciones desde Firestore:', firestoreError);
      if (cached) {
        return cached;
      }
      throw firestoreError;
    }
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
    currentUserProfile,
    isAdmin: currentUserProfile?.role === 'admin',
    login,
    loginWithGoogle,
    signup,
    logout,
    saveGuideRecord,
    getGuideRecords,
    updateGuideRecord,
    uploadPDF,
    syncLocalRecords,
    syncPendingRecords,
    getAllUsers,
    createUserRecord,
    updateUserAccess,
    deleteUserRecord,
    getDestinationsCatalog,
    getLocationsCatalog,
    createLocationCatalog,
    updateLocationCatalog,
    deleteLocationCatalog,
    guideExists,
    createManagedUser,
    fetchSqlDestinationsCatalog,
    getRouteHighlight,
    saveRouteHighlight,
    deleteRouteHighlight,
    loading,
    profileLoading
  };

  return (
    <FirebaseContext.Provider value={value}>
      {!loading && children}
    </FirebaseContext.Provider>
  );
};

export default FirebaseContext;
