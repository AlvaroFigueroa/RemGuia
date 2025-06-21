# Aplicación de Registro de Guías | Remfisc

Aplicación web progresiva (PWA) para el registro y seguimiento de guías mediante escaneo de archivos PDF.

## Características

- **Escaneo de PDF**: Subida y visualización de archivos PDF para extraer números de guía.
- **Registro de Datos**: Captura de fecha, hora y ubicación GPS al registrar una guía.
- **Historial**: Visualización y filtrado de registros guardados.
- **Funcionamiento Offline**: Almacenamiento local para trabajar sin conexión.
- **Sincronización**: Capacidad para sincronizar datos cuando hay conexión disponible.
- **Configuración**: Opciones para personalizar el comportamiento de la aplicación.

## Estructura de Páginas

1. **Página de Escaneo / Registro**
   - Subida o escaneo de PDF
   - Extracción del número de guía
   - Captura de fecha, hora y ubicación
   - Botón para guardar (online/offline)

2. **Página de Historial / Registros**
   - Lista de registros guardados
   - Número de guía, fecha, hora, ubicación
   - Filtro por fecha o guía
   - Estado de sincronización

3. **Página de Configuración**
   - Preferencias de la app
   - Activar/desactivar GPS o almacenamiento local
   - Cerrar sesión

4. **Página de Login/Registro**
   - Inicio de sesión con email
   - Opción para continuar con Google

5. **Página 404 o de Error**
   - Para rutas inexistentes

## Tecnologías Utilizadas

- React + Vite
- React Router para navegación
- Material UI para la interfaz de usuario
- React PDF para visualización de archivos PDF
- LocalStorage para almacenamiento offline
- PWA para funcionamiento como aplicación nativa

## Instalación

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Compilar para producción
npm run build
```

## Desarrollo

Este proyecto está configurado como una PWA (Progressive Web App) que permite su instalación en dispositivos móviles y funcionamiento offline.
