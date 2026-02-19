export default {
  // Login
  "login.title": "ik-photos",
  "login.subtitle": "Explora tus fotos de kDrive",
  "login.tab.login": "Iniciar sesión",
  "login.tab.register": "Registrarse",
  "login.email": "Correo electrónico",
  "login.password": "Contraseña",
  "login.infomaniakToken": "Token API Infomaniak",
  "login.submit.login": "Iniciar sesión",
  "login.submit.register": "Crear cuenta",
  "login.tokenHelp.before": "Crea un token en",
  "login.tokenHelp.after": "con el scope",
  "login.tokenEncrypted": "Tu token se almacena cifrado (AES-256) en el servidor.",
  "login.switchToRegister": "¿Sin cuenta? Registrarse",
  "login.localSubtitle": "Modo local — introduce tu token API de Infomaniak",
  "login.tokenRequired": "El token de Infomaniak es obligatorio",
  "login.tokenInvalid": "Token de Infomaniak inválido",
  "login.switchToLogin": "¿Ya tienes cuenta? Iniciar sesión",

  // Errors
  "error.status": "Error {status}",
  "error.sessionExpired": "Sesión expirada",

  // Header / Menu
  "theme.title": "Tema",
  "theme.system": "Sistema",
  "theme.light": "Claro",
  "theme.dark": "Oscuro",
  "lang.title": "Idioma",
  "menu.token": "Token API",
  "menu.logout": "Cerrar sesión",

  // Token modal
  "token.title": "Token API Infomaniak",
  "token.description": "Reemplaza tu token de acceso kDrive.",
  "token.createLink": "Crear un token",
  "token.placeholder": "Nuevo token",
  "token.success": "¡Token actualizado!",
  "token.cancel": "Cancelar",
  "token.save": "Guardar",

  // Drives
  "drives.breadcrumb": "Mis drives",
  "drives.select": "Seleccionar un drive",
  "drives.error": "Error al cargar los drives.",
  "drives.reconnect": "Reconectar",
  "drives.indexing": "Indexando...",
  "drives.reindex": "Reindexar",
  "drives.reindexTitle": "Reiniciar la indexación",
  "drives.errorRetry": "Error — Reintentar",
  "drives.index": "Indexar",
  "drives.photos_one": "{count} foto",
  "drives.photos_other": "{count} fotos",

  // Gallery
  "gallery.photos": "Fotos",
  "gallery.reindex": "Reindexar",
  "gallery.reindexTitle": "Reindexar fotos desde kDrive",
  "gallery.error": "Error al cargar las fotos.",
  "gallery.breadcrumb.drives": "Drives",
  "gallery.breadcrumb.photos": "Fotos",
  "gallery.lastIndexed": "Indexado: {date}",
  "gallery.indexing": "Indexando...",
  "gallery.indexComplete": "Indexaci\u00f3n completa: {count} fotos",
  "gallery.indexError": "Error de indexaci\u00f3n",

  // Selection toolbar
  "selection.cancel": "Cancelar",
  "selection.count_one": "{count} foto seleccionada",
  "selection.count_other": "{count} fotos seleccionadas",
  "selection.download": "Descargar ({count})",
  "selection.delete": "Eliminar ({count})",

  // Delete
  "delete.confirm": "¿Eliminar {count} foto(s)? Esta acción es irreversible.",
  "delete.button": "Eliminar",
  "delete.cancel": "Cancelar",
  "delete.success": "{count} foto(s) eliminada(s)",

  // Lightbox
  "lightbox.close": "Cerrar",
  "lightbox.download": "Descargar",

  // Format
  "format.sizeUnits": "B,KB,MB,GB,TB",
} as const;
