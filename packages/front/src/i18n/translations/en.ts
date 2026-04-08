export default {
  // Login
  "login.title": "ik-photos",
  "login.subtitle": "Browse your kDrive photos",
  "login.tab.login": "Login",
  "login.tab.register": "Register",
  "login.email": "Email",
  "login.password": "Password",
  "login.infomaniakToken": "Infomaniak API token",
  "login.submit.login": "Log in",
  "login.submit.register": "Create account",
  "login.tokenHelp.before": "Create a token on",
  "login.tokenHelp.after": "with the scope",
  "login.tokenEncrypted": "Your token is stored encrypted (AES-256) on the server.",
  "login.switchToRegister": "No account? Register",
  "login.localSubtitle": "Local mode — enter your Infomaniak API token",
  "login.tokenRequired": "Infomaniak token is required",
  "login.tokenInvalid": "Invalid Infomaniak token",
  "login.switchToLogin": "Already have an account? Log in",

  // Errors
  "error.status": "Error {status}",
  "error.sessionExpired": "Session expired",
  "error.emailAlreadyRegistered": "Email already registered",
  "error.invalidCredentials": "Invalid email or password",
  "error.tooManyRequests": "Too many requests, please try again later",

  // Header / Menu
  "theme.title": "Theme",
  "theme.system": "System",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "lang.title": "Language",
  "menu.token": "API Token",
  "menu.logout": "Log out",

  // Token modal
  "token.title": "Infomaniak API Token",
  "token.description": "Replace your kDrive access token.",
  "token.createLink": "Create a token",
  "token.placeholder": "New token",
  "token.success": "Token updated!",
  "token.cancel": "Cancel",
  "token.save": "Save",

  // Drives
  "drives.breadcrumb": "My drives",
  "drives.select": "Select a drive",
  "drives.error": "Error loading drives.",
  "drives.tokenExpired": "Your Infomaniak API token is invalid or expired.",
  "drives.reconnect": "Reconnect",
  "drives.indexing": "Indexing...",
  "drives.reindex": "Re-index",
  "drives.reindexTitle": "Restart indexing",
  "drives.errorRetry": "Error — Retry",
  "drives.index": "Index",
  "drives.photos_one": "{count} photo",
  "drives.photos_other": "{count} photos",

  // Gallery
  "gallery.photos": "Photos",
  "gallery.reindex": "Re-index",
  "gallery.reindexTitle": "Re-index photos from kDrive",
  "gallery.error": "Error loading photos.",
  "gallery.breadcrumb.drives": "Drives",
  "gallery.breadcrumb.photos": "Photos",
  "gallery.lastIndexed": "Indexed: {date}",
  "gallery.indexing": "Indexing...",
  "gallery.indexComplete": "Indexation complete: {count} photos",
  "gallery.indexError": "Indexation error",
  "gallery.reindexModal.title": "Re-indexation",
  "gallery.reindexModal.partial": "Partial",
  "gallery.reindexModal.partialDesc": "Search only for new photos",
  "gallery.reindexModal.full": "Full",
  "gallery.reindexModal.fullDesc": "Delete the index and start over",
  "gallery.reindexModal.cancel": "Cancel",
  "gallery.reindexModal.fullConfirm": "All indexation data will be deleted. Indexation will restart from scratch.",
  "gallery.reindexModal.fullConfirmButton": "Re-index everything",

  // Selection toolbar
  "selection.cancel": "Cancel",
  "selection.count_one": "{count} photo selected",
  "selection.count_other": "{count} photos selected",
  "selection.download": "Download ({count})",
  "selection.delete": "Delete ({count})",
  "selection.favorite": "Favorites",

  // Delete
  "delete.confirm": "Delete {count} photo(s)? This cannot be undone.",
  "delete.button": "Delete",
  "delete.cancel": "Cancel",
  "delete.success": "{count} photo(s) deleted",

  // Lightbox
  "lightbox.close": "Close",
  "lightbox.download": "Download",
  "lightbox.rotate": "Rotate",
  "lightbox.favorite": "Favorite",

  // Favorites
  "favorites.title": "Favorites",
  "favorites.empty": "No favorites yet",
  "favorites.added": "Added to favorites",
  "favorites.removed": "Removed from favorites",
  "favorites.bulkAdded": "{count} photo(s) added to favorites",

  // Format
  "format.sizeUnits": "B,KB,MB,GB,TB",
} as const;
