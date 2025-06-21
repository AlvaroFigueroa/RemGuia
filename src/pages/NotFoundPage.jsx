import { Container, Typography, Box, Button, Paper } from '@mui/material';
import { Home } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm" sx={{ pt: 4, pb: 8 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, mt: 2, width: '100%', textAlign: 'center' }}>
          <Typography variant="h1" component="h1" gutterBottom sx={{ fontSize: '8rem' }}>
            404
          </Typography>
          
          <Typography variant="h5" component="h2" gutterBottom>
            Página no encontrada
          </Typography>
          
          <Typography variant="body1" color="text.secondary" paragraph>
            Lo sentimos, la página que estás buscando no existe o ha sido movida.
          </Typography>
          
          <Button
            variant="contained"
            startIcon={<Home />}
            onClick={() => navigate('/')}
            sx={{ mt: 2 }}
          >
            Volver al inicio
          </Button>
        </Paper>
      </Box>
    </Container>
  );
};

export default NotFoundPage;
