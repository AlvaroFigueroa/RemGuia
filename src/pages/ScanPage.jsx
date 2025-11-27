import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Container, Typography, Box, Button, Paper, 
  TextField, CircularProgress, Alert, Stack,
  IconButton, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, MenuItem
} from '@mui/material';
import { CameraAlt, Save, FlipCameraIos, Refresh } from '../components/AppIcons';
import Webcam from 'react-webcam';
// Importamos directamente Tesseract en lugar de solo createWorker
import Tesseract from 'tesseract.js';
import { useFirebase } from '../context/FirebaseContext';

const DESTINATIONS = [
  {
    value: 'Santiago',
    label: 'Santiago',
    subDestinations: ['Centro', 'Independencia', 'Maipú', 'Puente Alto']
  },
  {
    value: 'Concepción',
    label: 'Concepción',
    subDestinations: ['Los Ángeles', 'Coronel', 'Talcahuano']
  },
  {
    value: 'Temuco',
    label: 'Temuco',
    subDestinations: ['Padre Las Casas', 'Victoria']
  },
  {
    value: 'Valdivia',
    label: 'Valdivia',
    subDestinations: ['Paillaco', 'La Unión']
  },
  {
    value: 'Puerto Montt',
    label: 'Puerto Montt',
    subDestinations: ['Osorno', 'Puerto Varas']
  }
];

const ScanPage = () => {
  const { saveGuideRecord, currentUser } = useFirebase();
  const [image, setImage] = useState(null);
  const [extractedGuide, setExtractedGuide] = useState('');
  const [destination, setDestination] = useState('');
  const [subDestination, setSubDestination] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [errorVisible, setErrorVisible] = useState(false);
  const [success, setSuccess] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [location, setLocation] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'user' para cámara frontal, 'environment' para trasera
  const webcamRef = useRef(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const autoCaptureIntervalRef = useRef(null);
  const getInitialOnlineStatus = () => (typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isOnline, setIsOnline] = useState(getInitialOnlineStatus);
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const ocrProgressLogRef = useRef(0);
  const processingFrameRef = useRef(false);
  const pendingFrameRef = useRef(null);
  const pendingFrameFromAutoRef = useRef(false);
  const LAST_LOCATION_KEY = 'lastKnownLocation';

  const appendDebugLog = useCallback((message) => {
    setDebugLogs(prev => {
      const entry = {
        timestamp: new Date().toLocaleTimeString(),
        message
      };
      return [entry, ...prev].slice(0, 40);
    });
  }, []);

  const updateError = useCallback((message = '', { visible = false } = {}) => {
    setError(message);
    setErrorVisible(visible && Boolean(message));
  }, []);

  const enforceLandscape = useCallback(async (imageSrc) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const targetWidth = 1280;
        const targetHeight = 720;
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const offsetX = (targetWidth - scaledWidth) / 2;
        const offsetY = (targetHeight - scaledHeight) / 2;

        ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => resolve(imageSrc);
      img.src = imageSrc;
    });
  }, []);

  const isMobileDevice = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  const getStoredLocation = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(LAST_LOCATION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (storageError) {
      console.warn('No se pudo leer la ubicación guardada:', storageError);
      return null;
    }
  }, []);

  const persistLocation = useCallback((locationData) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        LAST_LOCATION_KEY,
        JSON.stringify({ ...locationData, timestamp: Date.now() })
      );
    } catch (storageError) {
      console.warn('No se pudo guardar la ubicación localmente:', storageError);
    }
  }, []);

  const basePath = import.meta.env.BASE_URL ?? '/';
  const normalizedBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  
  // En móviles con conexión usamos CDN (más confiable), offline usamos archivos locales
  const tesseractConfig = useMemo(() => {
    const useLocalFiles = !isOnline || !isMobileDevice;
    
    if (useLocalFiles) {
      return {
        workerPath: `${normalizedBasePath}/ocr/worker.min.js`,
        corePath: `${normalizedBasePath}/ocr/tesseract-core.wasm.js`,
        langPath: `${normalizedBasePath}/ocr/lang-data`,
        mode: 'local'
      };
    }
    
    // CDN para móviles con conexión (más estable)
    return {
      mode: 'cdn'
    };
  }, [normalizedBasePath, isOnline, isMobileDevice]);
  
  // No necesitamos mantener una referencia al worker
  // Usaremos Tesseract.recognize directamente
  
  useEffect(() => {
    // Precargamos los datos de Tesseract para que esté listo cuando se necesite
    // pero no creamos un worker aún
    const preloadTesseract = async () => {
      try {
        // Solo verificamos que Tesseract esté disponible
        console.log('Tesseract.js versión:', Tesseract.version);
      } catch (err) {
        console.error('Error al precargar Tesseract:', err);
        updateError('Error al inicializar el reconocimiento de texto', { visible: true });
      }
    };
    
    preloadTesseract();
    
    return () => {
      // No hay worker que terminar
    };
  }, [tesseractConfig, updateError]);

  useEffect(() => {
    appendDebugLog(tesseractConfig.mode === 'cdn'
      ? 'OCR usando CDN (móvil con conexión)'
      : 'OCR usando archivos locales'
    );
  }, [appendDebugLog, tesseractConfig]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const processImage = useCallback(async (imageSrc, { showErrors = false } = {}) => {
    if (!imageSrc) {
      updateError('No se pudo capturar la imagen', { visible: showErrors });
      appendDebugLog('OCR cancelado: imagen vacía');
      return null;
    }

    setIsProcessing(true);
    updateError('', { visible: false });
    setOcrProgress(0);
    ocrProgressLogRef.current = 0;
    appendDebugLog('OCR iniciado');

    const startTime = performance.now();

    try {
      const ocrOptions = tesseractConfig.mode === 'cdn'
        ? {
            logger: progress => {
              if (progress.status === 'recognizing text') {
                setOcrProgress(parseInt(progress.progress * 100));
                const percent = Math.round(progress.progress * 100);
                if (percent - ocrProgressLogRef.current >= 25 || percent === 100) {
                  appendDebugLog(`OCR en progreso: ${percent}%`);
                  ocrProgressLogRef.current = percent;
                }
              }
            }
          }
        : {
            workerPath: tesseractConfig.workerPath,
            corePath: tesseractConfig.corePath,
            langPath: tesseractConfig.langPath,
            logger: progress => {
              if (progress.status === 'recognizing text') {
                setOcrProgress(parseInt(progress.progress * 100));
                const percent = Math.round(progress.progress * 100);
                if (percent - ocrProgressLogRef.current >= 25 || percent === 100) {
                  appendDebugLog(`OCR en progreso: ${percent}%`);
                  ocrProgressLogRef.current = percent;
                }
              }
            }
          };

      const result = await Tesseract.recognize(imageSrc, 'eng', ocrOptions);

      const text = result.data.text;

      const patterns = [
        { regex: /N[°º]\s*(\d{4,8})/i, description: 'N° seguido de 4-8 dígitos', requiresPrefix: true },
        { regex: /N[°º:]\s*(\d{4,8})/i, description: 'Variación N°/N: seguido de dígitos', requiresPrefix: true },
        { regex: /GU[IÍ]A[^\n\d]+(\d{4,6})/i, description: 'GUÍA seguido de 4-6 dígitos', requiresPrefix: false },
        { regex: /GU[IÍ]A[\s\w]*N[°º]?\s*(\d{4,8})/i, description: 'Texto GUÍA con N° cercano', requiresPrefix: false }
      ];

      let guideNumber = null;
      let confident = false;

      for (const pattern of patterns) {
        const match = text.match(pattern.regex);
        if (match && match[1]) {
          guideNumber = match[1];
          confident = Boolean(pattern.requiresPrefix);
          break;
        }
      }

      if (!guideNumber) {
        const rutPattern = /(\d{1,2}[\.,]\d{3}[\.,]\d{3}[-\.]\d{1})/g;
        const textWithoutRuts = text.replace(rutPattern, '');
        const guidePattern = /\b(\d{4,6})\b/g;
        const matches = Array.from(textWithoutRuts.matchAll(guidePattern), m => m[1]);

        if (matches && matches.length > 0) {
          guideNumber = matches[0];
        } else {
          const cleanText = text.replace(/\s+/g, ' ').trim();
          guideNumber = cleanText.substring(0, 20);
        }
      }

      if (guideNumber) {
        appendDebugLog(`OCR detectó candidato: ${guideNumber}${confident ? ' (con prefijo N°)' : ''}`);
      } else {
        appendDebugLog('OCR sin coincidencias claras');
      }

      return { guideNumber, confident, rawText: text };
    } catch (error) {
      console.error('Error al procesar la imagen:', error);
      updateError('Error al procesar la imagen', { visible: showErrors });
      appendDebugLog(`OCR error: ${error.message || error}`);
      return null;
    } finally {
      const elapsed = Math.round(performance.now() - startTime);
      appendDebugLog(`OCR finalizado en ${elapsed} ms`);
      setIsProcessing(false);
    }
  }, [appendDebugLog, tesseractConfig, updateError]);

  const processCapturedFrame = useCallback(async (imageSrc, fromAuto) => {
    processingFrameRef.current = true;
    try {
      const detection = await processImage(imageSrc, { showErrors: !fromAuto });

      if (fromAuto) {
        appendDebugLog(`Texto OCR: ${detection?.rawText?.slice(0, 160) || '(sin texto)'}`);
      }

      if (!fromAuto) {
        setImage(imageSrc);
        updateError('', { visible: false });
        if (detection?.guideNumber) {
          setExtractedGuide(detection.guideNumber);
          appendDebugLog(`Número asignado manualmente: ${detection.guideNumber}`);
        }
      } else if (detection?.confident) {
        setImage(imageSrc);
        setExtractedGuide(detection.guideNumber);
        setAutoCaptureEnabled(false);
        setSuccess('Número de guía detectado automáticamente');
        appendDebugLog(`Autoescaneo exitoso: ${detection.guideNumber}`);
      }
    } catch (ocrError) {
      appendDebugLog(`OCR falló: ${ocrError.message || ocrError}`);
    } finally {
      processingFrameRef.current = false;

      if (pendingFrameRef.current) {
        const nextImage = pendingFrameRef.current;
        const nextFromAuto = pendingFrameFromAutoRef.current;
        pendingFrameRef.current = null;
        pendingFrameFromAutoRef.current = false;
        setTimeout(() => processCapturedFrame(nextImage, nextFromAuto), 0);
      }
    }
  }, [appendDebugLog, processImage, updateError]);

  const captureImage = useCallback(async ({ fromAuto = false } = {}) => {
    if (webcamRef.current) {
      if (fromAuto) {
        appendDebugLog('Captura automática disparada');
      }
      const rawImageSrc = webcamRef.current.getScreenshot();

      if (!rawImageSrc) {
        updateError('No se pudo capturar la imagen', { visible: !fromAuto });
        appendDebugLog('Error: getScreenshot() devolvió null');
        return;
      }

      const imageSrc = await enforceLandscape(rawImageSrc);

      appendDebugLog(`Imagen capturada (${Math.round(imageSrc.length / 1024)} KB aprox.)`);

      if (processingFrameRef.current) {
        pendingFrameRef.current = imageSrc;
        pendingFrameFromAutoRef.current = fromAuto;
        appendDebugLog('OCR ocupado: se reemplazó el fotograma pendiente');
        return;
      }

      processCapturedFrame(imageSrc, fromAuto);
    } else {
      updateError('No se pudo acceder a la cámara', { visible: true });
      appendDebugLog('Error: webcamRef no disponible');
    }
  }, [appendDebugLog, enforceLandscape, processCapturedFrame, updateError]);

  const flipCamera = useCallback(() => {
    setFacingMode(prevMode => prevMode === 'user' ? 'environment' : 'user');
  }, []);

  // Función para procesar la imagen y extraer texto
  useEffect(() => {
    if (!autoCaptureEnabled) {
      if (autoCaptureIntervalRef.current) {
        clearInterval(autoCaptureIntervalRef.current);
        autoCaptureIntervalRef.current = null;
      }
      return;
    }

    autoCaptureIntervalRef.current = setInterval(() => {
      if (!extractedGuide) {
        captureImage({ fromAuto: true });
      }
    }, 1000);

    return () => {
      if (autoCaptureIntervalRef.current) {
        clearInterval(autoCaptureIntervalRef.current);
        autoCaptureIntervalRef.current = null;
      }
    };
  }, [autoCaptureEnabled, isProcessing, extractedGuide, captureImage]);
  
  // Función para reiniciar el proceso de escaneo
  const resetScan = () => {
    setImage(null);
    setExtractedGuide('');
    updateError('', { visible: false });
    setSuccess('');
    setOcrProgress(0);
    setAutoCaptureEnabled(true);
  };

  // Función para obtener la ubicación actual
  // Función para obtener la ubicación como una promesa
  const getLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const locationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setLocation(locationData);
            persistLocation(locationData);
            resolve(locationData);
          },
          (error) => {
            console.warn('Error de geolocalización:', error.message);
            const stored = getStoredLocation();
            if (stored) {
              setLocation(stored);
              resolve(stored);
            } else {
              reject('No se pudo obtener la ubicación');
            }
          },
          { timeout: 10000, enableHighAccuracy: true } // Opciones para mejorar la precisión
        );
      } else {
        const stored = getStoredLocation();
        if (stored) {
          setLocation(stored);
          resolve(stored);
        } else {
          reject('Geolocalización no soportada en este navegador');
        }
      }
    });
  }, [getStoredLocation, persistLocation]);
  
  // Actualizar ubicación al cargar la página
  useEffect(() => {
    // Intentar obtener ubicación al inicio
    getLocation().catch(error => {
      console.warn('Error inicial de ubicación:', error);
      // No mostramos error al usuario en este punto para no interrumpir la experiencia
    });
  }, []);

  // Función para guardar el registro
  const saveRecord = async () => {
    if (!extractedGuide) {
      updateError('No se ha extraído ningún número de guía', { visible: true });
      return;
    }
    if (!destination) {
      updateError('Selecciona un destino para continuar', { visible: true });
      return;
    }
    if (!subDestination) {
      updateError('Selecciona un subdestino para continuar', { visible: true });
      return;
    }

    setIsLoading(true);
    updateError('', { visible: false });

    let currentLocation = location;
    
    // Obtener ubicación si no se ha obtenido aún
    if (!currentLocation) {
      try {
        currentLocation = await getLocation();
      } catch (locationError) {
        console.warn('No se pudo obtener la ubicación:', locationError);
        // Continuamos con el guardado aunque no tengamos ubicación
      }
    }

    try {
      const localId = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      // Crear objeto de registro
      const recordToSave = {
        localId,
        guideNumber: extractedGuide,
        destination,
        subDestination,
        date: new Date().toISOString(),
        location: currentLocation || { latitude: 'No disponible', longitude: 'No disponible' },
        // No guardamos la imagen completa, solo una referencia
        imageCapture: Boolean(image),
        imageData: image || null
      };
      
      // Verificar si hay conexión a internet
      const isOnline = navigator.onLine;
      
      if (isOnline && currentUser) {
        // Guardar en Firestore
        try {
          await saveGuideRecord(record);
          record.synced = true;
        } catch (saveError) {
          console.error('Error al guardar en Firestore:', saveError);
          record.synced = false;
        }
      } else {
        // Sin conexión o sin usuario autenticado, marcar como no sincronizado
        record.synced = false;
      }
      
      // Guardar en localStorage (siempre, para tener copia local)
      const records = JSON.parse(localStorage.getItem('guideRecords') || '[]');
      records.push(record);
      localStorage.setItem('guideRecords', JSON.stringify(records));
      window.dispatchEvent(new CustomEvent('guideRecordsUpdated'));

      setSuccess('Registro guardado correctamente' + (record.synced ? ' y sincronizado' : ' (pendiente de sincronizar)'));
      setSuccessModalOpen(true);

    } catch (error) {
      console.error('Error al guardar registro:', error);
      updateError('Error al guardar: ' + error.message, { visible: true });
    } finally {
      setIsLoading(false);
    }
  };

  // Configuración de la cámara web
  useEffect(() => {
    appendDebugLog(`Cámara activa: ${facingMode === 'user' ? 'frontal' : 'trasera'}`);
  }, [appendDebugLog, facingMode]);

  const videoConstraints = useMemo(() => ({
    facingMode,
    width: { ideal: 1280 },
    height: { ideal: 720 }
  }), [facingMode]);

  const screenshotQuality = 0.98;

  return (
    <Container maxWidth="sm" sx={{ pt: 2, pb: 8 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Escaneo de Guías
      </Typography>
      
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="span">
            Escaneo automático
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Capturaremos la foto al detectar la guía
          </Typography>
        </Box>

        {!image ? (
          // Mostrar cámara si no hay imagen capturada
          <Box sx={{ mb: 2, position: 'relative' }}>
            <Box
              sx={{
                width: '100%',
                border: '1px solid #ccc',
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative',
                paddingTop: '56.25%',
                backgroundColor: '#000'
              }}
            >
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                screenshotQuality={screenshotQuality}
                videoConstraints={videoConstraints}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<CameraAlt />}
                onClick={() => captureImage()}
                disabled={isProcessing || autoCaptureEnabled}
              >
                Capturar
              </Button>
              
              <IconButton 
                onClick={flipCamera} 
                color="primary"
                disabled={isProcessing}
              >
                <FlipCameraIos />
              </IconButton>
            </Box>
          </Box>
        ) : (
          // Mostrar imagen capturada
          <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box
              sx={{
                width: '100%',
                border: '1px solid #ccc',
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative',
                paddingTop: '56.25%',
                backgroundColor: '#000',
                mb: 2
              }}
            >
              <Box
                component="img"
                src={image}
                alt="Imagen capturada"
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </Box>
            
            {isProcessing ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 2 }}>
                <CircularProgress variant="determinate" value={ocrProgress} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Procesando imagen... {ocrProgress}%
                </Typography>
              </Box>
            ) : (
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={resetScan}
                sx={{ mb: 2 }}
              >
                Nueva captura
              </Button>
            )}
          </Box>
        )}

        {(image || extractedGuide) && (
          <>
            <Box sx={{ mb: 2 }}>
              <TextField
                label="Número de Guía"
                variant="outlined"
                fullWidth
                value={extractedGuide}
                onChange={(e) => setExtractedGuide(e.target.value)}
                helperText="Puedes ingresar o editar el número manualmente"
              />
            </Box>
            <Box sx={{ mb: 2 }}>
              <TextField
                label="Destino"
                select
                fullWidth
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setSubDestination('');
                }}
                helperText="Selecciona el destino de la guía"
              >
                <MenuItem value="">Selecciona un destino</MenuItem>
                {DESTINATIONS.map((dest) => (
                  <MenuItem key={dest.value} value={dest.value}>
                    {dest.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box sx={{ mb: 2 }}>
              <TextField
                label="SubDestino"
                select
                fullWidth
                value={subDestination}
                onChange={(e) => setSubDestination(e.target.value)}
                helperText={destination ? 'Selecciona el subdestino' : 'Selecciona primero un destino'}
                disabled={!destination}
              >
                <MenuItem value="">Selecciona un subdestino</MenuItem>
                {destination && DESTINATIONS.find((d) => d.value === destination)?.subDestinations.map((sub) => (
                  <MenuItem key={sub} value={sub}>
                    {sub}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </>
        )}

        <Button
          variant="contained"
          color="primary"
          startIcon={<Save />}
          fullWidth
          disabled={!extractedGuide || !destination || !subDestination || isLoading || isProcessing}
          onClick={saveRecord}
        >
          {isLoading ? <CircularProgress size={24} /> : 'Guardar Registro'}
        </Button>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setShowDebugLogs(prev => !prev)}
          disabled={debugLogs.length === 0}
        >
          {showDebugLogs ? 'Ocultar registro' : 'Mostrar registro'}
        </Button>
      </Box>

      {showDebugLogs && debugLogs.length > 0 && (
        <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1">
              Registro reciente
            </Typography>
            <Button size="small" onClick={() => setDebugLogs([])}>
              Limpiar
            </Button>
          </Box>
          <Box
            sx={{
              maxHeight: 200,
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              backgroundColor: '#f5f5f5',
              borderRadius: 1,
              p: 1
            }}
          >
            {debugLogs.map((log, index) => (
              <Typography key={`${log.timestamp}-${index}`} component="p" sx={{ mb: 0.5 }}>
                [{log.timestamp}] {log.message}
              </Typography>
            ))}
          </Box>
        </Paper>
      )}

      {errorVisible && error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Dialog
        open={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
      >
        <DialogTitle>Registro guardado</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {success || 'Registro guardado correctamente.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setSuccessModalOpen(false);
            setSuccess('');
            resetScan();
          }} autoFocus>
            Aceptar
          </Button>
        </DialogActions>
      </Dialog>

      <Stack spacing={2} direction="row" justifyContent="center">
        <Button 
          variant="outlined" 
          onClick={getLocation}
          disabled={isLoading}
        >
          Actualizar Ubicación
        </Button>
      </Stack>
    </Container>
  );
};

export default ScanPage;
