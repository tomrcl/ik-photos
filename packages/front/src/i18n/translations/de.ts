export default {
  // Login
  "login.title": "ik-photos",
  "login.subtitle": "Durchsuchen Sie Ihre kDrive-Fotos",
  "login.tab.login": "Anmelden",
  "login.tab.register": "Registrieren",
  "login.email": "E-Mail",
  "login.password": "Passwort",
  "login.infomaniakToken": "Infomaniak-API-Token",
  "login.submit.login": "Anmelden",
  "login.submit.register": "Konto erstellen",
  "login.tokenHelp.before": "Erstellen Sie ein Token auf",
  "login.tokenHelp.after": "mit dem Scope",
  "login.tokenEncrypted": "Ihr Token wird verschlüsselt (AES-256) auf dem Server gespeichert.",
  "login.switchToRegister": "Kein Konto? Registrieren",
  "login.localSubtitle": "Lokaler Modus — geben Sie Ihr Infomaniak-API-Token ein",
  "login.tokenRequired": "Infomaniak-Token ist erforderlich",
  "login.tokenInvalid": "Ungültiges Infomaniak-Token",
  "login.switchToLogin": "Bereits ein Konto? Anmelden",

  // Errors
  "error.status": "Fehler {status}",
  "error.sessionExpired": "Sitzung abgelaufen",
  "error.emailAlreadyRegistered": "E-Mail bereits registriert",
  "error.invalidCredentials": "Ungültige E-Mail oder Passwort",
  "error.tooManyRequests": "Zu viele Anfragen, bitte versuchen Sie es später erneut",

  // Header / Menu
  "theme.title": "Design",
  "theme.system": "System",
  "theme.light": "Hell",
  "theme.dark": "Dunkel",
  "lang.title": "Sprache",
  "menu.token": "API-Token",
  "menu.logout": "Abmelden",

  // Token modal
  "token.title": "Infomaniak-API-Token",
  "token.description": "Ersetzen Sie Ihr kDrive-Zugriffstoken.",
  "token.createLink": "Token erstellen",
  "token.placeholder": "Neues Token",
  "token.success": "Token aktualisiert!",
  "token.cancel": "Abbrechen",
  "token.save": "Speichern",

  // Drives
  "drives.breadcrumb": "Meine Drives",
  "drives.select": "Drive auswählen",
  "drives.error": "Fehler beim Laden der Drives.",
  "drives.tokenExpired": "Ihr Infomaniak-API-Token ist ungültig oder abgelaufen.",
  "drives.reconnect": "Neu verbinden",
  "drives.indexing": "Indexierung...",
  "drives.reindex": "Neu indexieren",
  "drives.reindexTitle": "Indexierung neu starten",
  "drives.errorRetry": "Fehler — Erneut versuchen",
  "drives.index": "Indexieren",
  "drives.photos_one": "{count} Foto",
  "drives.photos_other": "{count} Fotos",

  // Gallery
  "gallery.photos": "Fotos",
  "gallery.reindex": "Neu indexieren",
  "gallery.reindexTitle": "Fotos von kDrive neu indexieren",
  "gallery.error": "Fehler beim Laden der Fotos.",
  "gallery.breadcrumb.drives": "Drives",
  "gallery.breadcrumb.photos": "Fotos",
  "gallery.lastIndexed": "Indexiert: {date}",
  "gallery.indexing": "Indexierung...",
  "gallery.indexComplete": "Indexierung abgeschlossen: {count} Fotos",
  "gallery.indexError": "Indexierungsfehler",
  "gallery.reindexModal.title": "Neu-Indexierung",
  "gallery.reindexModal.partial": "Teilweise",
  "gallery.reindexModal.partialDesc": "Nur nach neuen Fotos suchen",
  "gallery.reindexModal.full": "Vollständig",
  "gallery.reindexModal.fullDesc": "Index löschen und neu beginnen",
  "gallery.reindexModal.cancel": "Abbrechen",
  "gallery.reindexModal.fullConfirm": "Alle Indexierungsdaten werden gelöscht. Die Indexierung beginnt von vorne.",
  "gallery.reindexModal.fullConfirmButton": "Alles neu indexieren",

  // Selection toolbar
  "selection.cancel": "Abbrechen",
  "selection.count_one": "{count} Foto ausgewählt",
  "selection.count_other": "{count} Fotos ausgewählt",
  "selection.download": "Herunterladen ({count})",
  "selection.delete": "Löschen ({count})",
  "selection.favorite": "Favoriten",

  // Delete
  "delete.confirm": "{count} Foto(s) löschen? Dies kann nicht rückgängig gemacht werden.",
  "delete.button": "Löschen",
  "delete.cancel": "Abbrechen",
  "delete.success": "{count} Foto(s) gelöscht",

  // Lightbox
  "lightbox.close": "Schließen",
  "lightbox.download": "Herunterladen",
  "lightbox.rotate": "Drehen",
  "lightbox.favorite": "Favorit",

  // Favorites
  "favorites.title": "Favoriten",
  "favorites.empty": "Noch keine Favoriten",
  "favorites.added": "Zu Favoriten hinzugefügt",
  "favorites.removed": "Aus Favoriten entfernt",
  "favorites.bulkAdded": "{count} Foto(s) zu Favoriten hinzugefügt",

  // Format
  "format.sizeUnits": "B,KB,MB,GB,TB",
} as const;
