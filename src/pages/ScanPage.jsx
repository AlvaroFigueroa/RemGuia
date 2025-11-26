import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Container, Typography, Box, Button, Paper, 
  TextField, CircularProgress, Alert, Stack,
  IconButton, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions
} from '@mui/material';
import { CameraAlt, Save, FlipCameraIos, Refresh } from '../components/AppIcons';
import Webcam from 'react-webcam';
// Importamos directamente Tesseract en lugar de solo createWorker
import Tesseract from 'tesseract.js';
import { useFirebase } from '../context/FirebaseContext';

const ScanPage = () => {
  const { saveGuideRecord, currentUser } = useFirebase();
  const [image, setImage] = useState(null);
  const [extractedGuide, setExtractedGuide] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
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
  const basePath = import.meta.env.BASE_URL ?? '/';
  const normalizedBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  const tesseractPaths = useMemo(() => ({
    workerPath: `${normalizedBasePath}/ocr/worker.min.js`,
    corePath: `${normalizedBasePath}/ocr/tesseract-core-simd.wasm.js`,
    langPath: `${normalizedBasePath}/ocr/lang-data`
  }), [normalizedBasePath]);
  
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
        setError('Error al inicializar el reconocimiento de texto');
      }
    };
    
    preloadTesseract();
    
    return () => {
      // No hay worker que terminar
    };
  }, [tesseractPaths]);

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

  const processImage = useCallback(async (imageSrc) => {
    if (!imageSrc) {
      setError('No se pudo capturar la imagen');
      return null;
    }

    setIsProcessing(true);
    setError('');
    setOcrProgress(0);

    try {
      const result = await Tesseract.recognize(
        imageSrc,
        'eng',
        {
          workerPath: tesseractPaths.workerPath,
          corePath: tesseractPaths.corePath,
          langPath: tesseractPaths.langPath,
          logger: progress => {
            if (progress.status === 'recognizing text') {
              setOcrProgress(parseInt(progress.progress * 100));
            }
          }
        }
      );

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

      return { guideNumber, confident, rawText: text };
    } catch (error) {
      console.error('Error al procesar la imagen:', error);
      setError('Error al procesar la imagen');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const captureImage = useCallback(async ({ fromAuto = false } = {}) => {
    if (isProcessing) return;

    if (webcamRef.current) {
      if (fromAuto) {
        console.log('[AutoScan] Captura automática disparada');
      }
      const imageSrc = webcamRef.current.getScreenshot();

      if (!imageSrc) {
        setError('No se pudo capturar la imagen');
        return;
      }

      const detection = await processImage(imageSrc);
      if (fromAuto) {
        console.log('[AutoScan] Texto OCR:', detection?.rawText || '(sin texto)');
      }

      if (!fromAuto) {
        setImage(imageSrc);
        setError('');
        if (detection?.guideNumber) {
          setExtractedGuide(detection.guideNumber);
        }
      } else if (detection?.confident) {
        setImage(imageSrc);
        setExtractedGuide(detection.guideNumber);
        setAutoCaptureEnabled(false);
        setSuccess('Número de guía detectado automáticamente');
      }
    } else {
      setError('No se pudo acceder a la cámara');
    }
  }, [isProcessing, processImage]);

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
      if (!isProcessing && !extractedGuide) {
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
    setError('');
    setSuccess('');
    setOcrProgress(0);
    setAutoCaptureEnabled(true);
  };

  // Función para obtener la ubicación actual
  // Función para obtener la ubicación como una promesa
  const getLocation = () => {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const locationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setLocation(locationData);
            resolve(locationData);
          },
          (error) => {
            console.warn('Error de geolocalización:', error.message);
            reject('No se pudo obtener la ubicación');
          },
          { timeout: 10000, enableHighAccuracy: true } // Opciones para mejorar la precisión
        );
      } else {
        reject('Geolocalización no soportada en este navegador');
      }
    });
  };
  
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
      setError('No se ha extraído ningún número de guía');
      return;
    }

    setIsLoading(true);
    setError('');

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
      const record = {
        localId,
        guideNumber: extractedGuide,
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
      setError('Error al guardar: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Configuración de la cámara web
  const videoConstraints = {
    facingMode: facingMode,
    width: { ideal: 1280 },
    height: { ideal: 720 }
  };

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
            <Box sx={{ width: '100%', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' }}>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                style={{ width: '100%', height: 'auto' }}
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
            <Box sx={{ width: '100%', overflow: 'hidden', border: '1px solid #ccc', borderRadius: '4px', mb: 2 }}>
              <img 
                src={image} 
                alt="Imagen capturada" 
                style={{ width: '100%', height: 'auto' }} 
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
        )}

        <Button
          variant="contained"
          color="primary"
          startIcon={<Save />}
          fullWidth
          disabled={!extractedGuide || isLoading || isProcessing}
          onClick={saveRecord}
        >
          {isLoading ? <CircularProgress size={24} /> : 'Guardar Registro'}
        </Button>
      </Paper>

      {error && (
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
