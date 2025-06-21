import { useState, useRef, useEffect } from 'react';
import { 
  Container, Typography, Box, Button, Paper, 
  TextField, CircularProgress, Alert, Stack, Snackbar,
  IconButton
} from '@mui/material';
import { CameraAlt, Save, FlipCameraIos, Refresh } from '@mui/icons-material';
import Webcam from 'react-webcam';
import { createWorker } from 'tesseract.js';
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
  
  // Inicializar Tesseract worker
  const [worker, setWorker] = useState(null);
  
  useEffect(() => {
    const initWorker = async () => {
      const newWorker = await createWorker({
        logger: progress => {
          if (progress.status === 'recognizing text') {
            setOcrProgress(parseInt(progress.progress * 100));
          }
        }
      });
      await newWorker.loadLanguage('eng');
      await newWorker.initialize('eng');
      setWorker(newWorker);
    };
    
    initWorker();
    
    return () => {
      if (worker) {
        worker.terminate();
      }
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
    if (!worker || !imageSrc) {
      setError('No se pudo inicializar el reconocimiento de texto');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      // Realizar OCR en la imagen
      const { data } = await worker.recognize(imageSrc);
      
      // Buscar patrones de números que podrían ser guías
      // Este es un patrón simple para números de 8 dígitos, ajustar según necesidad
      const guidePattern = /\b\d{8}\b/g;
      const matches = data.text.match(guidePattern);
      
      if (matches && matches.length > 0) {
        setExtractedGuide(matches[0]);
      } else {
        // Si no encuentra un patrón específico, mostrar todo el texto extraído
        // y permitir al usuario seleccionar o editar
        const cleanText = data.text.replace(/\s+/g, ' ').trim();
        setExtractedGuide(cleanText);
      }
    } catch (error) {
      console.error('Error al procesar la imagen:', error);
      setError('Error al procesar la imagen: ' + error.message);
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
  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          setError('No se pudo obtener la ubicación');
        }
      );
    } else {
      setError('Geolocalización no soportada en este navegador');
    }
  };

  // Función para guardar el registro
  const saveRecord = async () => {
    if (!extractedGuide) {
      setError('No se ha extraído ningún número de guía');
      return;
    }

    setIsLoading(true);
    setError('');

    // Obtener ubicación si no se ha obtenido aún
    if (!location) {
      getLocation();
    }

    try {
      // Crear objeto de registro
      const record = {
        guideNumber: extractedGuide,
        date: new Date().toISOString(),
        location: location || { latitude: 'No disponible', longitude: 'No disponible' },
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
