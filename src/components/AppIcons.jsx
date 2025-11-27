// Archivo centralizado para iconos usando react-icons en lugar de MUI Icons
// Esta solución es mucho más ligera y evitará el problema de "too many open files"

// Importamos los iconos que necesitamos desde react-icons
// Usamos principalmente iconos de Font Awesome (fa) y Material Design (md)
import { 
  FaCamera, 
  FaSave, 
  FaSync, 
  FaHome,
  FaSearch, 
  FaCloud, 
  FaCloudDownloadAlt,
  FaCloudUploadAlt,
  FaMapMarkerAlt,
  FaEye, 
  FaEyeSlash,
  FaUserPlus,
  FaQrcode,
  FaHistory,
  FaCog,
  FaGoogle,
  FaSignInAlt,
  FaDatabase,
  FaTrashAlt,
  FaSignOutAlt,
  FaEdit,
  FaPlus,
  FaTachometerAlt,
  FaImage
} from 'react-icons/fa';

import { MdCameraswitch } from 'react-icons/md';

// Exportamos los iconos con los mismos nombres que se usaban en MUI
export {
  FaCamera as CameraAlt,
  FaSave as Save,
  MdCameraswitch as FlipCameraIos,
  FaSync as Refresh,
  FaHome as Home,
  FaSearch as Search,
  FaCloudDownloadAlt as CloudDone,
  FaCloud as CloudOff,
  FaMapMarkerAlt as LocationOn,
  FaEye as Visibility,
  FaEyeSlash as VisibilityOff,
  FaUserPlus as PersonAdd,
  FaQrcode as QrCodeScanner,
  FaHistory as History,
  FaCog as Settings,
  FaGoogle as Google,
  FaSignInAlt as Login,
  FaCloudUploadAlt as CloudSync,
  FaDatabase as Storage,
  FaSync as Sync,
  FaTrashAlt as DeleteForever,
  FaSignOutAlt as Logout,
  FaEdit as Edit,
  FaPlus as Add,
  FaTrashAlt as Delete,
  FaTachometerAlt as Dashboard,
  FaImage as Image
};
