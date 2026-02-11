import { Container, Typography, Box } from '@mui/material';

const ProgramaPage = () => {
  return (
    <Container maxWidth="md" sx={{ pt: 6, pb: 10 }}>
      <Box textAlign="center">
        <Typography variant="h3" component="h1" gutterBottom fontWeight={600}>
          Programa de transporte
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Aquí podrás diseñar y publicar el programa diario de transporte.
        </Typography>
      </Box>
    </Container>
  );
};

export default ProgramaPage;
