import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  TextField,
  MenuItem,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip
} from '@mui/material';
import { useFirebase } from '../context/FirebaseContext';
import { Refresh, Edit, Delete } from '../components/AppIcons';

const roleColors = {
  admin: 'primary',
  usuario: 'default',
  supervisor: 'secondary'
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CL');
};

const DEFAULT_ROLES = ['usuario', 'admin', 'supervisor'];

const UsersManagementPage = () => {
  const { getAllUsers, createManagedUser, updateUserRole, deleteUserRecord } = useFirebase();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dialogState, setDialogState] = useState({ type: null, user: null });
  const [formValues, setFormValues] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'usuario' });
  const [dialogLoading, setDialogLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getAllUsers();
      setUsers(data);
      setFeedback('');
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
      setError('No se pudieron cargar los usuarios. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  }, [getAllUsers]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    let list = [...users];
    if (searchTerm) {
      list = list.filter((user) =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (roleFilter !== 'all') {
      list = list.filter((user) => user.role === roleFilter);
    }
    setFilteredUsers(list);
  }, [users, searchTerm, roleFilter]);

  const roleOptions = useMemo(() => {
    const roles = new Set([...DEFAULT_ROLES, ...users.map((u) => u.role || 'usuario')]);
    return ['all', ...roles];
  }, [users]);

  const summary = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const usuarios = users.filter((u) => u.role === 'usuario').length;
    return { total, admins, usuarios };
  }, [users]);

  const closeDialog = () => {
    setDialogState({ type: null, user: null });
    setFormValues({ name: '', email: '', password: '', confirmPassword: '', role: 'usuario' });
    setDialogLoading(false);
  };

  const openCreateDialog = () => {
    setDialogState({ type: 'create', user: null });
    setFormValues({ name: '', email: '', password: '', confirmPassword: '', role: 'usuario' });
  };

  const openEditDialog = (user) => {
    setDialogState({ type: 'edit', user });
    setFormValues({ name: user.name || '', email: user.email, password: '', confirmPassword: '', role: user.role || 'usuario' });
  };

  const openDeleteDialog = (user) => {
    setDialogState({ type: 'delete', user });
  };

  const handleDialogSubmit = async () => {
    try {
      setDialogLoading(true);
      if (dialogState.type === 'create') {
        if (!formValues.name || !formValues.email || !formValues.password || !formValues.confirmPassword) {
          setFeedback('Completa todos los campos.');
          setDialogLoading(false);
          return;
        }
        if (formValues.password !== formValues.confirmPassword) {
          setFeedback('Las contraseñas no coinciden.');
          setDialogLoading(false);
          return;
        }
        await createManagedUser({
          name: formValues.name.trim(),
          email: formValues.email.trim(),
          password: formValues.password,
          role: formValues.role
        });
        setFeedback('Usuario creado correctamente.');
      } else if (dialogState.type === 'edit' && dialogState.user) {
        await updateUserRole(dialogState.user.id, formValues.role);
        setFeedback('Rol actualizado.');
      } else if (dialogState.type === 'delete' && dialogState.user) {
        await deleteUserRecord(dialogState.user.id);
        setFeedback('Usuario eliminado.');
      }
      await loadUsers();
      closeDialog();
    } catch (err) {
      console.error('Error en acción de usuario:', err);
      setFeedback(err.message || 'Ocurrió un error.');
      setDialogLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ pt: 3, pb: 10 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Gestión de Usuarios
      </Typography>

      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
          <TextField
            label="Buscar por correo"
            fullWidth
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <TextField
            label="Filtrar por rol"
            select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 200 } }}
          >
            {roleOptions.map((role) => (
              <MenuItem key={role} value={role}>
                {role === 'all' ? 'Todos' : role}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={loadUsers}
            disabled={isLoading}
          >
            Actualizar
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={openCreateDialog}
          >
            Crear usuario
          </Button>
        </Stack>

        <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
          <Chip label={`Total: ${summary.total}`} color="primary" />
          <Chip label={`Admins: ${summary.admins}`} color="secondary" />
          <Chip label={`Usuarios: ${summary.usuarios}`} />
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {feedback && (
        <Alert severity="info" sx={{ mb: 3 }} onClose={() => setFeedback('')}>
          {feedback}
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 0 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Correo</TableCell>
                  <TableCell>Rol</TableCell>
                  <TableCell>Creado</TableCell>
                  <TableCell>Actualizado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No se encontraron usuarios con los filtros actuales.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user, index) => (
                    <TableRow
                      key={user.id}
                      sx={{ backgroundColor: index % 2 === 0 ? 'background.paper' : 'grey.50' }}
                    >
                      <TableCell>{user.name || '—'}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.role || 'usuario'}
                          color={roleColors[user.role] || 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
                          <Typography component="span" variant="body2">
                            {formatDate(user.updatedAt)}
                          </Typography>
                          <Box>
                            <Tooltip title="Editar rol">
                              <IconButton size="small" onClick={() => openEditDialog(user)}>
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Eliminar usuario">
                              <IconButton size="small" color="error" onClick={() => openDeleteDialog(user)}>
                                <Delete />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={dialogState.type === 'create'} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Crear usuario</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Nombre"
            value={formValues.name}
            onChange={(e) => setFormValues((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <TextField
            label="Correo"
            type="email"
            value={formValues.email}
            onChange={(e) => setFormValues((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
          <TextField
            label="Contraseña"
            type="password"
            value={formValues.password}
            onChange={(e) => setFormValues((prev) => ({ ...prev, password: e.target.value }))}
            helperText="Mínimo 6 caracteres"
            required
          />
          <TextField
            label="Confirmar contraseña"
            type="password"
            value={formValues.confirmPassword}
            onChange={(e) => setFormValues((prev) => ({ ...prev, confirmPassword: e.target.value }))}
            required
          />
          <TextField
            label="Rol"
            select
            value={formValues.role}
            onChange={(e) => setFormValues((prev) => ({ ...prev, role: e.target.value }))}
          >
            {roleOptions.filter((role) => role !== 'all').map((role) => (
              <MenuItem key={role} value={role}>
                {role}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={dialogLoading}>Cancelar</Button>
          <Button onClick={handleDialogSubmit} variant="contained" disabled={dialogLoading}>
            {dialogLoading ? 'Guardando...' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogState.type === 'edit'} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle>Editar rol</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {dialogState.user?.email}
          </Typography>
          <TextField
            label="Rol"
            select
            fullWidth
            value={formValues.role}
            onChange={(e) => setFormValues((prev) => ({ ...prev, role: e.target.value }))}
          >
            {roleOptions.filter((role) => role !== 'all').map((role) => (
              <MenuItem key={role} value={role}>
                {role}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={dialogLoading}>Cancelar</Button>
          <Button onClick={handleDialogSubmit} variant="contained" disabled={dialogLoading}>
            {dialogLoading ? 'Actualizando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogState.type === 'delete'} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle>Eliminar usuario</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Seguro que deseas eliminar el usuario <strong>{dialogState.user?.email}</strong>? Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={dialogLoading}>Cancelar</Button>
          <Button onClick={handleDialogSubmit} color="error" variant="contained" disabled={dialogLoading}>
            {dialogLoading ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default UsersManagementPage;
