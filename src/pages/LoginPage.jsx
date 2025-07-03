import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, Typography, Box, Paper, TextField, 
  Button, Divider, IconButton, InputAdornment,
  Alert, CircularProgress, Snackbar, Tabs, Tab
} from '@mui/material';
import { 
  Visibility, VisibilityOff, Google, Login, PersonAdd 
} from '../components/AppIcons';
import { useFirebase } from '../context/FirebaseContext';
import RegisterForm from '../components/RegisterForm';

const LoginPage = () => {
  const [activeTab, setActiveTab] = useState(0); // 0 = login, 1 = registro
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError(''); // Limpiar errores al cambiar de tab
  };
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const { login, loginWithGoogle } = useFirebase();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validación básica
    if (!formData.email || !formData.password) {
      setError('Por favor completa todos los campos');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Iniciar sesión con Firebase
      await login(formData.email, formData.password);
      
      // Guardar estado de sesión en localStorage como respaldo
      localStorage.setItem('isLoggedIn', 'true');
      
      // La redirección se maneja automáticamente en el componente AppRoutes
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      
      // Manejar diferentes tipos de errores de Firebase
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setError('Credenciales incorrectas. Por favor verifica tu email y contraseña.');
      } else if (error.code === 'auth/invalid-email') {
        setError('El formato del email no es válido.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Demasiados intentos fallidos. Por favor, intenta más tarde.');
      } else {
        setError('Error al iniciar sesión. Por favor intenta nuevamente.');
      }
      
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Iniciar sesión con Google usando Firebase
      await loginWithGoogle();
      
      // Guardar estado de sesión en localStorage como respaldo
      localStorage.setItem('isLoggedIn', 'true');
      
      // La redirección se maneja automáticamente en el componente AppRoutes
    } catch (error) {
      console.error('Error al iniciar sesión con Google:', error);
      setError('Error al iniciar sesión con Google. Por favor intenta nuevamente.');
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ pt: 4, pb: 8 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Registro de Guías
        </Typography>
        
        <Paper elevation={3} sx={{ p: 4, mt: 2, width: '100%' }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange} 
            variant="fullWidth" 
            sx={{ mb: 3 }}
          >
            <Tab 
              icon={<Login />} 
              label="Iniciar Sesión" 
              id="login-tab"
              aria-controls="login-panel"
            />
            <Tab 
              icon={<PersonAdd />} 
              label="Registrarse" 
              id="register-tab"
              aria-controls="register-panel"
            />
          </Tabs>
          
          {/* Panel de inicio de sesión */}
          <div
            role="tabpanel"
            hidden={activeTab !== 0}
            id="login-panel"
            aria-labelledby="login-tab"
          >
            {activeTab === 0 && (
              <>
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}
                
                <form onSubmit={handleSubmit}>
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    id="email"
                    label="Correo electrónico"
                    name="email"
                    autoComplete="email"
                    autoFocus
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                  
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    name="password"
                    label="Contraseña"
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isLoading}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={handleClickShowPassword}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />
                  
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    startIcon={<Login />}
                    sx={{ mt: 3, mb: 2 }}
                    disabled={isLoading}
                  >
                    {isLoading ? <CircularProgress size={24} /> : 'Iniciar Sesión'}
                  </Button>
                </form>
                
                <Divider sx={{ my: 2 }}>o</Divider>
                
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Google />}
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                >
                  Continuar con Google
                </Button>
              </>
            )}
          </div>
          
          {/* Panel de registro */}
          <div
            role="tabpanel"
            hidden={activeTab !== 1}
            id="register-panel"
            aria-labelledby="register-tab"
          >
            {activeTab === 1 && (
              <RegisterForm onToggleForm={() => setActiveTab(0)} />
            )}
          </div>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;
