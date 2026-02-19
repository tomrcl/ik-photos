export default {
  // Login
  "login.title": "ik-photos",
  "login.subtitle": "Consultez vos photos kDrive",
  "login.tab.login": "Connexion",
  "login.tab.register": "Inscription",
  "login.email": "Email",
  "login.password": "Mot de passe",
  "login.infomaniakToken": "Token API Infomaniak",
  "login.submit.login": "Se connecter",
  "login.submit.register": "Créer un compte",
  "login.tokenHelp.before": "Créez un token sur",
  "login.tokenHelp.after": "avec le scope",
  "login.tokenEncrypted": "Votre token est stocké chiffré (AES-256) sur le serveur.",
  "login.switchToRegister": "Pas de compte ? S'inscrire",
  "login.localSubtitle": "Mode local — entrez votre token API Infomaniak",
  "login.tokenRequired": "Le token Infomaniak est requis",
  "login.tokenInvalid": "Token Infomaniak invalide",
  "login.switchToLogin": "Déjà un compte ? Se connecter",

  // Errors
  "error.status": "Erreur {status}",
  "error.sessionExpired": "Session expirée",
  "error.emailAlreadyRegistered": "Cet email est déjà utilisé",
  "error.invalidCredentials": "Email ou mot de passe incorrect",
  "error.tooManyRequests": "Trop de tentatives, veuillez réessayer plus tard",

  // Header / Menu
  "theme.title": "Thème",
  "theme.system": "Système",
  "theme.light": "Clair",
  "theme.dark": "Sombre",
  "lang.title": "Langue",
  "menu.token": "Token API",
  "menu.logout": "Déconnexion",

  // Token modal
  "token.title": "Token API Infomaniak",
  "token.description": "Remplacez votre token d'accès kDrive.",
  "token.createLink": "Créer un token",
  "token.placeholder": "Nouveau token",
  "token.success": "Token mis à jour !",
  "token.cancel": "Annuler",
  "token.save": "Enregistrer",

  // Drives
  "drives.breadcrumb": "Mes drives",
  "drives.select": "Sélectionner un drive",
  "drives.error": "Erreur lors du chargement des drives.",
  "drives.tokenExpired": "Votre token API Infomaniak est invalide ou expiré.",
  "drives.reconnect": "Se reconnecter",
  "drives.indexing": "Indexation...",
  "drives.reindex": "Re-indexer",
  "drives.reindexTitle": "Relancer l'indexation",
  "drives.errorRetry": "Erreur — Réessayer",
  "drives.index": "Indexer",
  "drives.photos_one": "{count} photo",
  "drives.photos_other": "{count} photos",

  // Gallery
  "gallery.photos": "Photos",
  "gallery.reindex": "Re-indexer",
  "gallery.reindexTitle": "Re-indexer les photos depuis kDrive",
  "gallery.error": "Erreur lors du chargement des photos.",
  "gallery.breadcrumb.drives": "Drives",
  "gallery.breadcrumb.photos": "Photos",
  "gallery.lastIndexed": "Indexation : {date}",
  "gallery.indexing": "Indexation en cours...",
  "gallery.indexComplete": "Indexation terminée : {count} photos",
  "gallery.indexError": "Erreur d'indexation",

  // Selection toolbar
  "selection.cancel": "Annuler",
  "selection.count_one": "{count} photo sélectionnée",
  "selection.count_other": "{count} photos sélectionnées",
  "selection.download": "Télécharger ({count})",
  "selection.delete": "Supprimer ({count})",

  // Delete
  "delete.confirm": "Supprimer {count} photo(s) ? Cette action est irréversible.",
  "delete.button": "Supprimer",
  "delete.cancel": "Annuler",
  "delete.success": "{count} photo(s) supprimée(s)",

  // Lightbox
  "lightbox.close": "Fermer",
  "lightbox.download": "Télécharger",

  // Format
  "format.sizeUnits": "o,Ko,Mo,Go,To",
} as const;
