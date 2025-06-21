import { useState, useRef, useEffect } from 'react';
import { 
  Container, Typography, Box, Button, Paper, 
  TextField, CircularProgress, Alert, Stack, Snackbar,
  IconButton
} from '@mui/material';
import { CameraAlt, Save, FlipCameraIos, Refresh } from '@mui/icons-material';
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
  const [location, setLocation] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'user' para cámara frontal, 'environment' para trasera
  const webcamRef = useRef(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  
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
  }, []);

  // Función para capturar imagen desde la cámara
  const captureImage = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setImage(imageSrc);
      setError('');
      processImage(imageSrc);
    } else {
      setError('No se pudo acceder a la cámara');
    }
  };
  
  // Función para cambiar entre cámara frontal y trasera
  const flipCamera = () => {
    setFacingMode(prevMode => prevMode === 'user' ? 'environment' : 'user');
  };
  
  // Función para procesar la imagen y extraer texto
  const processImage = async (imageSrc) => {
    if (!imageSrc) {
      setError('No se pudo capturar la imagen');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    setOcrProgress(0);
    
    try {
      // Usar Tesseract.recognize directamente sin worker
      const result = await Tesseract.recognize(
        imageSrc,
        'eng', // idioma
        {
          logger: progress => {
            if (progress.status === 'recognizing text') {
              setOcrProgress(parseInt(progress.progress * 100));
            }
          }
        }
      );
      
      const text = result.data.text;
      console.log('Texto extraído:', text);
      
      // Buscar patrones de números que podrían ser guías
      // Primero buscamos el número de guía (N°XXXXX)
      const guideNumberPattern = /N[°º]\s*(\d{5,6})/i;
      const guideNumberMatch = text.match(guideNumberPattern);
      
      if (guideNumberMatch && guideNumberMatch[1]) {
        setExtractedGuide(guideNumberMatch[1]);
      } else {
        // Luego buscamos el RUT (XX.XXX.XXX-X)
        const rutPattern = /(\d{1,2}[\.,]\d{3}[\.,]\d{3}[-\.]\d{1})/;
        const rutMatch = text.match(rutPattern);
        
        if (rutMatch && rutMatch[1]) {
          setExtractedGuide(rutMatch[1].replace(/[\.,]/g, ''));
        } else {
          // Intentar con cualquier secuencia de 6-10 dígitos
          const extendedPattern = /\b\d{6,10}\b/g;
          const extendedMatches = text.match(extendedPattern);
          
          if (extendedMatches && extendedMatches.length > 0) {
            setExtractedGuide(extendedMatches[0]);
          } else {
            // Si no encuentra un patrón específico, mostrar todo el texto extraído
            const cleanText = text.replace(/\s+/g, ' ').trim();
            setExtractedGuide(cleanText.substring(0, 30)); // Limitar a 30 caracteres
          }
        }
      }
    } catch (error) {
      console.error('Error al procesar la imagen:', error);
      setError('Error al procesar la imagen');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Función para reiniciar el proceso de escaneo
  const resetScan = () => {
    setImage(null);
    setExtractedGuide('');
    setError('');
    setSuccess('');
    setOcrProgress(0);
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
      // Crear objeto de registro
      const record = {
        guideNumber: extractedGuide,
        date: new Date().toISOString(),
        location: currentLocation || { latitude: 'No disponible', longitude: 'No disponible' },
        // No guardamos la imagen completa, solo una referencia
        imageCapture: image ? true : false
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

      setSuccess('Registro guardado correctamente' + (record.synced ? ' y sincronizado' : ' (pendiente de sincronizar)'));
      
      // Limpiar después de guardar
      setTimeout(() => {
        setSuccess('');
        resetScan();
      }, 2000);
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
                onClick={captureImage}
                disabled={isProcessing}
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

        {extractedGuide && (
          <Box sx={{ mb: 2 }}>
            <TextField
              label="Número de Guía"
              variant="outlined"
              fullWidth
              value={extractedGuide}
              onChange={(e) => setExtractedGuide(e.target.value)}
              helperText="Puedes editar el número si la extracción no fue correcta"
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

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

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
