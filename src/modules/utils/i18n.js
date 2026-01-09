// Internationalization module
// Supported languages: en (English), hr (Croatian), it (Italian), de (German)

const translations = {
  en: {
    // Navigation
    inbox: 'Inbox',
    projects: 'Projects',
    archive: 'Archive',
    settings: 'Settings',
    help: 'Help',
    
    // Common actions
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    done: 'Done',
    close: 'Close',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    
    // Tasks
    task: 'Task',
    tasks: 'Tasks',
    newTask: 'New Task',
    addTask: 'Add Task',
    editTask: 'Edit Task',
    taskTitle: 'Task title',
    taskNotes: 'Notes',
    noTasks: 'No tasks yet',
    noTasksHint: 'Tap the + button to add your first task',
    completed: 'Completed',
    active: 'active',
    markCompleted: 'Mark completed',
    markIncomplete: 'Mark incomplete',
    
    // Projects
    project: 'Project',
    newProject: 'New Project',
    createProject: 'Create Project',
    editProject: 'Edit Project',
    projectName: 'Project name',
    projectType: 'Project type',
    default: 'Default',
    checklist: 'Check List',
    noProjects: 'No projects yet',
    noProjectsHint: 'Tap the + button above to create your first project',
    subProject: 'Sub-project',
    newSubProject: 'New Sub-Project',
    
    // Priority
    priority: 'Priority',
    urgent: 'Urgent!',
    highest: 'Highest',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    
    // Due dates
    dueDate: 'Due date',
    noDueDate: 'No due date',
    overdue: 'Overdue',
    today: 'Today',
    tomorrow: 'Tomorrow',
    daysLeft: '{n} days left',
    
    // Menu options
    menu: 'Menu',
    moveToProject: 'Move to Project',
    linkToInbox: 'Link to Inbox',
    unlinkFromInbox: 'Unlink from Inbox',
    protect: 'Protect',
    unprotect: 'Unprotect',
    archiveItem: 'Archive',
    restoreItem: 'Restore',
    deleteItem: 'Delete',
    deletePermanently: 'Delete Permanently',
    
    // Settings
    theme: 'Theme',
    themeDark: 'Dark',
    themeLight: 'Light',
    themeSystem: 'System',
    language: 'Language',
    notifications: 'Notifications',
    enableNotifications: 'Enable Notifications',
    notificationsEnabled: 'Notifications enabled',
    notificationsBlocked: 'Notifications blocked by browser',
    bin: 'Bin',
    emptyBin: 'Empty Bin',
    binEmpty: 'Bin is empty',
    itemsInBin: '{n} items in bin',
    clearAllData: 'Clear All Data',
    clearDataWarning: 'This will delete all your tasks, projects, and settings. This cannot be undone.',
    exportData: 'Export Data',
    importData: 'Import Data',
    
    // Confirmations
    confirmDelete: 'Are you sure you want to delete this?',
    confirmArchive: 'Archive this item?',
    confirmEmptyBin: 'Empty the bin? This cannot be undone.',
    confirmClearData: 'Delete all data? This cannot be undone.',
    protectedWarning: 'This item is protected. Unprotect it first.',
    
    // Help page
    howToUse: 'How to use',
    masterProductivity: 'Master your productivity',
    
    // Empty states
    nothingHere: 'Nothing here',
    allCaughtUp: 'All caught up!',
    
    // Time
    justNow: 'Just now',
    minutesAgo: '{n} minutes ago',
    hoursAgo: '{n} hours ago',
    yesterday: 'Yesterday',
    daysAgo: '{n} days ago',
    
    // Misc
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    info: 'Info',
    version: 'Version',
    
    // Focus mode
    focusMode: 'Focus Mode',
    exitFocusMode: 'Exit Focus Mode',
  },
  
  hr: {
    // Navigation
    inbox: 'Inbox',
    projects: 'Projekti',
    archive: 'Arhiva',
    settings: 'Postavke',
    help: 'Pomoć',
    
    // Common actions
    save: 'Spremi',
    cancel: 'Odustani',
    delete: 'Obriši',
    edit: 'Uredi',
    create: 'Stvori',
    done: 'Gotovo',
    close: 'Zatvori',
    confirm: 'Potvrdi',
    yes: 'Da',
    no: 'Ne',
    ok: 'OK',
    
    // Tasks
    task: 'Zadatak',
    tasks: 'Zadaci',
    newTask: 'Novi zadatak',
    addTask: 'Dodaj zadatak',
    editTask: 'Uredi zadatak',
    taskTitle: 'Naziv zadatka',
    taskNotes: 'Bilješke',
    noTasks: 'Nema zadataka',
    noTasksHint: 'Dodirnite + za dodavanje prvog zadatka',
    completed: 'Završeno',
    active: 'aktivno',
    markCompleted: 'Označi završenim',
    markIncomplete: 'Označi nezavršenim',
    
    // Projects
    project: 'Projekt',
    newProject: 'Novi projekt',
    createProject: 'Stvori projekt',
    editProject: 'Uredi projekt',
    projectName: 'Naziv projekta',
    projectType: 'Vrsta projekta',
    default: 'Standardni',
    checklist: 'Popis',
    noProjects: 'Nema projekata',
    noProjectsHint: 'Dodirnite + za stvaranje prvog projekta',
    subProject: 'Podprojekt',
    newSubProject: 'Novi podprojekt',
    
    // Priority
    priority: 'Prioritet',
    urgent: 'Hitno!',
    highest: 'Najviši',
    high: 'Visoki',
    medium: 'Srednji',
    low: 'Niski',
    
    // Due dates
    dueDate: 'Rok',
    noDueDate: 'Bez roka',
    overdue: 'Kasni',
    today: 'Danas',
    tomorrow: 'Sutra',
    daysLeft: 'još {n} dana',
    
    // Menu options
    menu: 'Izbornik',
    moveToProject: 'Premjesti u projekt',
    linkToInbox: 'Poveži s Inboxom',
    unlinkFromInbox: 'Odspoji od Inboxa',
    protect: 'Zaštiti',
    unprotect: 'Ukloni zaštitu',
    archiveItem: 'Arhiviraj',
    restoreItem: 'Vrati',
    deleteItem: 'Obriši',
    deletePermanently: 'Trajno obriši',
    
    // Settings
    theme: 'Tema',
    themeDark: 'Tamna',
    themeLight: 'Svijetla',
    themeSystem: 'Sustav',
    language: 'Jezik',
    notifications: 'Obavijesti',
    enableNotifications: 'Uključi obavijesti',
    notificationsEnabled: 'Obavijesti uključene',
    notificationsBlocked: 'Obavijesti blokirane u pregledniku',
    bin: 'Koš',
    emptyBin: 'Isprazni koš',
    binEmpty: 'Koš je prazan',
    itemsInBin: '{n} stavki u košu',
    clearAllData: 'Obriši sve podatke',
    clearDataWarning: 'Ovo će obrisati sve zadatke, projekte i postavke. Ova radnja se ne može poništiti.',
    exportData: 'Izvezi podatke',
    importData: 'Uvezi podatke',
    
    // Confirmations
    confirmDelete: 'Jeste li sigurni da želite obrisati?',
    confirmArchive: 'Arhivirati ovu stavku?',
    confirmEmptyBin: 'Isprazniti koš? Ova radnja se ne može poništiti.',
    confirmClearData: 'Obrisati sve podatke? Ova radnja se ne može poništiti.',
    protectedWarning: 'Ova stavka je zaštićena. Prvo uklonite zaštitu.',
    
    // Help page
    howToUse: 'Kako koristiti',
    masterProductivity: 'Ovladajte produktivnošću',
    
    // Empty states
    nothingHere: 'Ovdje nema ničega',
    allCaughtUp: 'Sve je odrađeno!',
    
    // Time
    justNow: 'Upravo sada',
    minutesAgo: 'prije {n} minuta',
    hoursAgo: 'prije {n} sati',
    yesterday: 'Jučer',
    daysAgo: 'prije {n} dana',
    
    // Misc
    loading: 'Učitavanje...',
    error: 'Greška',
    success: 'Uspjeh',
    warning: 'Upozorenje',
    info: 'Info',
    version: 'Verzija',
    
    // Focus mode
    focusMode: 'Fokus mod',
    exitFocusMode: 'Izađi iz fokus moda',
  },
  
  it: {
    // Navigation
    inbox: 'Posta in arrivo',
    projects: 'Progetti',
    archive: 'Archivio',
    settings: 'Impostazioni',
    help: 'Aiuto',
    
    // Common actions
    save: 'Salva',
    cancel: 'Annulla',
    delete: 'Elimina',
    edit: 'Modifica',
    create: 'Crea',
    done: 'Fatto',
    close: 'Chiudi',
    confirm: 'Conferma',
    yes: 'Sì',
    no: 'No',
    ok: 'OK',
    
    // Tasks
    task: 'Attività',
    tasks: 'Attività',
    newTask: 'Nuova attività',
    addTask: 'Aggiungi attività',
    editTask: 'Modifica attività',
    taskTitle: 'Titolo attività',
    taskNotes: 'Note',
    noTasks: 'Nessuna attività',
    noTasksHint: 'Tocca + per aggiungere la tua prima attività',
    completed: 'Completato',
    active: 'attive',
    markCompleted: 'Segna completato',
    markIncomplete: 'Segna incompleto',
    
    // Projects
    project: 'Progetto',
    newProject: 'Nuovo progetto',
    createProject: 'Crea progetto',
    editProject: 'Modifica progetto',
    projectName: 'Nome progetto',
    projectType: 'Tipo progetto',
    default: 'Predefinito',
    checklist: 'Lista di controllo',
    noProjects: 'Nessun progetto',
    noProjectsHint: 'Tocca + per creare il tuo primo progetto',
    subProject: 'Sottoprogetto',
    newSubProject: 'Nuovo sottoprogetto',
    
    // Priority
    priority: 'Priorità',
    urgent: 'Urgente!',
    highest: 'Massima',
    high: 'Alta',
    medium: 'Media',
    low: 'Bassa',
    
    // Due dates
    dueDate: 'Scadenza',
    noDueDate: 'Nessuna scadenza',
    overdue: 'In ritardo',
    today: 'Oggi',
    tomorrow: 'Domani',
    daysLeft: '{n} giorni rimasti',
    
    // Menu options
    menu: 'Menu',
    moveToProject: 'Sposta nel progetto',
    linkToInbox: 'Collega alla posta',
    unlinkFromInbox: 'Scollega dalla posta',
    protect: 'Proteggi',
    unprotect: 'Rimuovi protezione',
    archiveItem: 'Archivia',
    restoreItem: 'Ripristina',
    deleteItem: 'Elimina',
    deletePermanently: 'Elimina definitivamente',
    
    // Settings
    theme: 'Tema',
    themeDark: 'Scuro',
    themeLight: 'Chiaro',
    themeSystem: 'Sistema',
    language: 'Lingua',
    notifications: 'Notifiche',
    enableNotifications: 'Abilita notifiche',
    notificationsEnabled: 'Notifiche abilitate',
    notificationsBlocked: 'Notifiche bloccate dal browser',
    bin: 'Cestino',
    emptyBin: 'Svuota cestino',
    binEmpty: 'Il cestino è vuoto',
    itemsInBin: '{n} elementi nel cestino',
    clearAllData: 'Cancella tutti i dati',
    clearDataWarning: 'Questo eliminerà tutte le attività, i progetti e le impostazioni. Non può essere annullato.',
    exportData: 'Esporta dati',
    importData: 'Importa dati',
    
    // Confirmations
    confirmDelete: 'Sei sicuro di voler eliminare?',
    confirmArchive: 'Archiviare questo elemento?',
    confirmEmptyBin: 'Svuotare il cestino? Non può essere annullato.',
    confirmClearData: 'Eliminare tutti i dati? Non può essere annullato.',
    protectedWarning: 'Questo elemento è protetto. Rimuovi prima la protezione.',
    
    // Help page
    howToUse: 'Come usare',
    masterProductivity: 'Padroneggia la tua produttività',
    
    // Empty states
    nothingHere: 'Niente qui',
    allCaughtUp: 'Tutto in ordine!',
    
    // Time
    justNow: 'Proprio ora',
    minutesAgo: '{n} minuti fa',
    hoursAgo: '{n} ore fa',
    yesterday: 'Ieri',
    daysAgo: '{n} giorni fa',
    
    // Misc
    loading: 'Caricamento...',
    error: 'Errore',
    success: 'Successo',
    warning: 'Avviso',
    info: 'Info',
    version: 'Versione',
    
    // Focus mode
    focusMode: 'Modalità focus',
    exitFocusMode: 'Esci dalla modalità focus',
  },
  
  de: {
    // Navigation
    inbox: 'Posteingang',
    projects: 'Projekte',
    archive: 'Archiv',
    settings: 'Einstellungen',
    help: 'Hilfe',
    
    // Common actions
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    create: 'Erstellen',
    done: 'Fertig',
    close: 'Schließen',
    confirm: 'Bestätigen',
    yes: 'Ja',
    no: 'Nein',
    ok: 'OK',
    
    // Tasks
    task: 'Aufgabe',
    tasks: 'Aufgaben',
    newTask: 'Neue Aufgabe',
    addTask: 'Aufgabe hinzufügen',
    editTask: 'Aufgabe bearbeiten',
    taskTitle: 'Aufgabentitel',
    taskNotes: 'Notizen',
    noTasks: 'Keine Aufgaben',
    noTasksHint: 'Tippen Sie auf + um Ihre erste Aufgabe hinzuzufügen',
    completed: 'Erledigt',
    active: 'aktiv',
    markCompleted: 'Als erledigt markieren',
    markIncomplete: 'Als unerledigt markieren',
    
    // Projects
    project: 'Projekt',
    newProject: 'Neues Projekt',
    createProject: 'Projekt erstellen',
    editProject: 'Projekt bearbeiten',
    projectName: 'Projektname',
    projectType: 'Projekttyp',
    default: 'Standard',
    checklist: 'Checkliste',
    noProjects: 'Keine Projekte',
    noProjectsHint: 'Tippen Sie auf + um Ihr erstes Projekt zu erstellen',
    subProject: 'Unterprojekt',
    newSubProject: 'Neues Unterprojekt',
    
    // Priority
    priority: 'Priorität',
    urgent: 'Dringend!',
    highest: 'Höchste',
    high: 'Hoch',
    medium: 'Mittel',
    low: 'Niedrig',
    
    // Due dates
    dueDate: 'Fälligkeitsdatum',
    noDueDate: 'Kein Fälligkeitsdatum',
    overdue: 'Überfällig',
    today: 'Heute',
    tomorrow: 'Morgen',
    daysLeft: 'noch {n} Tage',
    
    // Menu options
    menu: 'Menü',
    moveToProject: 'Zu Projekt verschieben',
    linkToInbox: 'Mit Posteingang verknüpfen',
    unlinkFromInbox: 'Vom Posteingang trennen',
    protect: 'Schützen',
    unprotect: 'Schutz aufheben',
    archiveItem: 'Archivieren',
    restoreItem: 'Wiederherstellen',
    deleteItem: 'Löschen',
    deletePermanently: 'Endgültig löschen',
    
    // Settings
    theme: 'Design',
    themeDark: 'Dunkel',
    themeLight: 'Hell',
    themeSystem: 'System',
    language: 'Sprache',
    notifications: 'Benachrichtigungen',
    enableNotifications: 'Benachrichtigungen aktivieren',
    notificationsEnabled: 'Benachrichtigungen aktiviert',
    notificationsBlocked: 'Benachrichtigungen vom Browser blockiert',
    bin: 'Papierkorb',
    emptyBin: 'Papierkorb leeren',
    binEmpty: 'Papierkorb ist leer',
    itemsInBin: '{n} Elemente im Papierkorb',
    clearAllData: 'Alle Daten löschen',
    clearDataWarning: 'Dies löscht alle Aufgaben, Projekte und Einstellungen. Dies kann nicht rückgängig gemacht werden.',
    exportData: 'Daten exportieren',
    importData: 'Daten importieren',
    
    // Confirmations
    confirmDelete: 'Möchten Sie das wirklich löschen?',
    confirmArchive: 'Dieses Element archivieren?',
    confirmEmptyBin: 'Papierkorb leeren? Dies kann nicht rückgängig gemacht werden.',
    confirmClearData: 'Alle Daten löschen? Dies kann nicht rückgängig gemacht werden.',
    protectedWarning: 'Dieses Element ist geschützt. Heben Sie zuerst den Schutz auf.',
    
    // Help page
    howToUse: 'Anleitung',
    masterProductivity: 'Meistern Sie Ihre Produktivität',
    
    // Empty states
    nothingHere: 'Hier ist nichts',
    allCaughtUp: 'Alles erledigt!',
    
    // Time
    justNow: 'Gerade eben',
    minutesAgo: 'vor {n} Minuten',
    hoursAgo: 'vor {n} Stunden',
    yesterday: 'Gestern',
    daysAgo: 'vor {n} Tagen',
    
    // Misc
    loading: 'Laden...',
    error: 'Fehler',
    success: 'Erfolg',
    warning: 'Warnung',
    info: 'Info',
    version: 'Version',
    
    // Focus mode
    focusMode: 'Fokusmodus',
    exitFocusMode: 'Fokusmodus beenden',
  }
};

// Language names for display in settings
export const languageNames = {
  en: 'English',
  hr: 'Hrvatski',
  it: 'Italiano',
  de: 'Deutsch'
};

// Current language (default to English, can be overridden from localStorage)
let currentLang = localStorage.getItem('app-language') || 'en';

/**
 * Get the current language code
 */
export function getLang() {
  return currentLang;
}

/**
 * Set the current language
 */
export function setLang(lang) {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem('app-language', lang);
    // Dispatch event so the app can re-render
    window.dispatchEvent(new CustomEvent('language-changed', { detail: { lang } }));
  }
}

/**
 * Get a translated string by key
 * @param {string} key - The translation key
 * @param {object} params - Optional parameters for interpolation (e.g., {n: 5})
 * @returns {string} The translated string
 */
export function t(key, params = {}) {
  const langStrings = translations[currentLang] || translations.en;
  let str = langStrings[key] || translations.en[key] || key;
  
  // Handle parameter interpolation like {n}
  for (const [param, value] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${param}\\}`, 'g'), value);
  }
  
  return str;
}

/**
 * Get all available language codes
 */
export function getAvailableLanguages() {
  return Object.keys(translations);
}
