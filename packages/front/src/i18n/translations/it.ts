export default {
  // Login
  "login.title": "ik-photos",
  "login.subtitle": "Sfoglia le tue foto kDrive",
  "login.tab.login": "Accedi",
  "login.tab.register": "Registrati",
  "login.email": "Email",
  "login.password": "Password",
  "login.infomaniakToken": "Token API Infomaniak",
  "login.submit.login": "Accedi",
  "login.submit.register": "Crea account",
  "login.tokenHelp.before": "Crea un token su",
  "login.tokenHelp.after": "con lo scope",
  "login.tokenEncrypted": "Il tuo token viene conservato cifrato (AES-256) sul server.",
  "login.switchToRegister": "Nessun account? Registrati",
  "login.localSubtitle": "Modalità locale — inserisci il tuo token API Infomaniak",
  "login.tokenRequired": "Il token Infomaniak è obbligatorio",
  "login.tokenInvalid": "Token Infomaniak non valido",
  "login.switchToLogin": "Hai già un account? Accedi",

  // Errors
  "error.status": "Errore {status}",
  "error.sessionExpired": "Sessione scaduta",
  "error.emailAlreadyRegistered": "Email già registrata",
  "error.invalidCredentials": "Email o password non validi",
  "error.tooManyRequests": "Troppe richieste, riprova più tardi",

  // Header / Menu
  "theme.title": "Tema",
  "theme.system": "Sistema",
  "theme.light": "Chiaro",
  "theme.dark": "Scuro",
  "lang.title": "Lingua",
  "menu.token": "Token API",
  "menu.logout": "Disconnetti",

  // Token modal
  "token.title": "Token API Infomaniak",
  "token.description": "Sostituisci il tuo token di accesso kDrive.",
  "token.createLink": "Crea un token",
  "token.placeholder": "Nuovo token",
  "token.success": "Token aggiornato!",
  "token.cancel": "Annulla",
  "token.save": "Salva",

  // Drives
  "drives.breadcrumb": "I miei drive",
  "drives.select": "Seleziona un drive",
  "drives.error": "Errore durante il caricamento dei drive.",
  "drives.tokenExpired": "Il tuo token API Infomaniak non è valido o è scaduto.",
  "drives.reconnect": "Riconnetti",
  "drives.indexing": "Indicizzazione...",
  "drives.reindex": "Reindicizza",
  "drives.reindexTitle": "Riavvia l'indicizzazione",
  "drives.errorRetry": "Errore — Riprova",
  "drives.index": "Indicizza",
  "drives.photos_one": "{count} foto",
  "drives.photos_other": "{count} foto",

  // Gallery
  "gallery.photos": "Foto",
  "gallery.reindex": "Reindicizza",
  "gallery.reindexTitle": "Reindicizza le foto da kDrive",
  "gallery.error": "Errore durante il caricamento delle foto.",
  "gallery.breadcrumb.drives": "Drive",
  "gallery.breadcrumb.photos": "Foto",
  "gallery.lastIndexed": "Indicizzato: {date}",
  "gallery.indexing": "Indicizzazione...",
  "gallery.indexComplete": "Indicizzazione completata: {count} foto",
  "gallery.indexError": "Errore di indicizzazione",
  "gallery.reindexModal.title": "Reindicizzazione",
  "gallery.reindexModal.partial": "Parziale",
  "gallery.reindexModal.partialDesc": "Cerca solo le nuove foto",
  "gallery.reindexModal.full": "Completa",
  "gallery.reindexModal.fullDesc": "Elimina l'indice e ricomincia da capo",
  "gallery.reindexModal.cancel": "Annulla",
  "gallery.reindexModal.fullConfirm": "Tutti i dati di indicizzazione saranno eliminati. L'indicizzazione ripartirà da zero.",
  "gallery.reindexModal.fullConfirmButton": "Reindicizza tutto",

  // Selection toolbar
  "selection.cancel": "Annulla",
  "selection.count_one": "{count} foto selezionata",
  "selection.count_other": "{count} foto selezionate",
  "selection.download": "Scarica ({count})",
  "selection.delete": "Elimina ({count})",

  // Delete
  "delete.confirm": "Eliminare {count} foto? Questa azione è irreversibile.",
  "delete.button": "Elimina",
  "delete.cancel": "Annulla",
  "delete.success": "{count} foto eliminate",

  // Lightbox
  "lightbox.close": "Chiudi",
  "lightbox.download": "Scarica",
  "lightbox.rotate": "Ruota",

  // Format
  "format.sizeUnits": "B,KB,MB,GB,TB",
} as const;
