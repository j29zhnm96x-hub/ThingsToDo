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
    
    // Todo editor
    editTodo: 'Edit Todo',
    newTodo: 'New Todo',
    title: 'Title',
    titleRequired: 'Title *',
    notes: 'Notes',
    priority: 'Priority',
    dueDate: 'Due date',
    completed: 'Completed',
    protectTask: 'Protect task',
    protectedTasksInfo: 'Protected tasks cannot be deleted easily and stay in the completed list.',
    addImages: 'Add images',
    imagesStoredInfo: 'Images are stored locally in IndexedDB and will persist offline.',
    removeImage: 'Remove image',
    removeImageHint: 'Remove',
    noFilesSelected: 'no file selected',
    chooseFile: 'Choose File',
    fileSelected: '{n} file selected',
    filesSelected: '{n} files selected',
    importJSON: 'Import JSON',
    importWarning: 'Import will replace all current local data.',
    confirmImport: 'Confirm import',
    confirmImportMsg: 'This will wipe your current data and replace it with the imported file.',
    invalidJSON: 'Invalid JSON',
    invalidJSONMsg: 'Could not parse the file. Please choose a valid export JSON.',
    taskProtected: 'Task Protected',
    taskProtectedMsg: 'This task is protected. Please uncheck "Protect task" in the editor to delete it.',
    deleteConfirmTitle: 'Delete todo?',
    deleteConfirmMsg: 'This will permanently delete the todo and its images.',
    
    // Menu options
    menu: 'Menu',
    moveToProject: 'Move to Project',
    linkToInbox: 'Link to Inbox',
    unlinkFromInbox: 'Unlink from Inbox',
    taskLinkedToInbox: 'Success, task linked to Inbox',
    taskUnlinkedFromInbox: 'Task unlinked from Inbox',
    projectLinkedToInbox: 'Success, project linked to Inbox',
    projectUnlinkedFromInbox: 'Project unlinked from Inbox',
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
    compressImages: 'Compress images (save space)',
    extraCompressArchive: 'Extra compress archived images',
    dataManagement: 'Data management',
    dataStoredLocally: 'Everything is stored locally on this device (IndexedDB).',
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
    
    // Bin modal
    binIsEmpty: 'Bin is empty',
    deletedItemsInfo: 'Deleted items stay here for 24 hours.',
    deletedLabel: 'Deleted',
    restore: 'Restore',
    recentlyDeleted: 'Recently Deleted',
    
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
    
    // Help sections
    helpInbox: 'Inbox & Quick Capture',
    helpInboxContent: 'The Inbox is your landing zone for quick thoughts. Tap <b>+</b> to add tasks immediately.<br><br><b>Link to Inbox:</b> Working deep in a Project? Use the task menu ("...") to <b>Link to Inbox</b>. The task stays in the project but appears in your Inbox for focus. Tap the link icon (🔗) to jump to its project.',
    helpProjects: 'Projects & Progress',
    helpProjectsContent: 'Projects organize your work. The main list shows <b>Progress Bars</b> (Yellow for tasks, Purple for checklists) so you can see your status at a glance.<br><br><b>Sub-Projects:</b> Break large projects down! Inside a project, tap <b>+</b> then <b>New Sub-Project</b>. They appear at the top of the list and can be reordered by dragging.<br><br><b>Project Types:</b> Choose Default for general work or Checklist for step-by-step lists with notifications.',
    helpFocusMode: 'Focus Mode (Zen)',
    helpFocusModeContent: 'When using a <b>Checklist</b> project (great for shopping or packing), tap the <b>⛶</b> icon in the header.<br><br>This hides all navigation and lets you focus purely on the list. Great for when you are on the go!',
    helpProtected: 'Protected Items',
    helpProtectedContent: 'Mark a task or project as <b>"Protected"</b> to prevent accidental deletion or archiving.<br><br>Protected items have a lock icon (🔒) and must be unprotected before you can remove them. Perfect for grocery masters or recurring lists.',
    helpPriorities: 'Priorities',
    helpPrioritiesContent: 'Prioritize effectively with visual cues:<br>• <b>Urgent!</b>: Flashes red. Do this NOW.<br>• <b>Highest</b>: Solid red border.<br>• <b>High/Medium/Low</b>: Colored indicators help you sort less critical work.',
    helpCompletion: 'Completion & Automation',
    helpCompletionContent: 'Completed tasks move to the bottom stack. After <b>24 hours</b>, they are auto-archived by date.<br><br><b>Bin:</b> Deleted items stay in the Bin for 24 hours before vanishing forever.',
    helpGestures: 'Gestures & Shortcuts',
    helpGesturesContent: '• <b>Double-tap</b> in a Checklist to quick-add items.<br>• <b>Drag & Drop</b> tasks to reorder them (hold briefly, then drag).<br>• <b>Drag & Drop</b> projects and sub-projects to arrange your dashboard.<br>• <b>Long press</b> prevents accidental drags while scrolling.',
    helpVoiceMemos: 'Voice Memos',
    helpVoiceMemosContent: 'Record voice memos to capture quick notes or ideas.<br><br><b>Sharing:</b> To share a voice memo with other apps, use the share button and select <b>"Save to Files"</b>. From the Files app, you can then share the recording to any app.',
    
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
    
    // Voice Memos
    voiceMemo: 'Voice Memo',
    voiceMemos: 'Voice Memos',
    recordVoiceMemo: 'Record Voice Memo',
    saveVoiceMemo: 'Save Voice Memo',
    voiceRecordingQuality: 'Recording quality',
    lowQuality: 'Low quality (smaller files)',
    highQuality: 'High quality',
    voiceMemoSaved: 'Voice memo saved',
    voiceMemoDeleted: 'Voice memo deleted',
    voiceMemoMoved: 'Voice memo moved',
    memoLinkedToInbox: 'Memo linked to Inbox',
    memoUnlinkedFromInbox: 'Memo unlinked from Inbox',
    deleteVoiceMemo: 'Delete Voice Memo',
    deleteVoiceMemoConfirm: 'Are you sure you want to delete this voice memo?',
    voiceMemoActions: 'Choose an action',
    memoTitle: 'Memo title',
    tapToRecord: 'Tap to record',
    recording: 'Recording...',
    paused: 'Paused',
    record: 'Record',
    pause: 'Pause',
    stop: 'Stop',
    play: 'Play',
    reRecord: 'Re-record',
    reRecordConfirm: 'This will delete the current recording and start a new one. Continue?',
    duration: 'Duration',
    discard: 'Discard',
    discardRecording: 'Discard Recording',
    discardRecordingConfirm: 'Are you sure you want to discard this recording? This cannot be undone.',
    microphoneAccessDenied: 'Microphone access denied. Please allow access in your browser settings.',
    microphoneNotSupported: 'Microphone not supported on this device',
    microphoneNotFound: 'No microphone found',
    microphoneInUse: 'Microphone is in use by another app',
    microphoneError: 'Microphone error',
    requestingMicAccess: 'Requesting microphone access...',
    rename: 'Rename',
    move: 'Move',
    linkedToInbox: 'Linked to Inbox',
    addToInbox: 'Add to Inbox',
    addToProject: 'Add to Project',
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
    
    // Todo editor
    editTodo: 'Uredi zadatak',
    newTodo: 'Novi zadatak',
    title: 'Naziv',
    titleRequired: 'Naziv *',
    notes: 'Bilješke',
    priority: 'Prioritet',
    dueDate: 'Rok',
    completed: 'Završeno',
    protectTask: 'Zaštiti zadatak',
    protectedTasksInfo: 'Zaštićeni zadaci se ne mogu jednostavno obrisati i ostaju na listi završenih.',
    addImages: 'Dodaj slike',
    imagesStoredInfo: 'Slike se čuvaju lokalno u IndexedDB-u i bit će dostupne i izvan mreže.',
    removeImage: 'Ukloni sliku',
    removeImageHint: 'Ukloni',
    noFilesSelected: 'datoteka nije odabrana',
    chooseFile: 'Odaberi datoteku',
    fileSelected: '{n} datoteka odabrana',
    filesSelected: '{n} datoteka odabrano',
    importJSON: 'Uvezi JSON',
    importWarning: 'Uvoz će zamijeniti sve vaše trenutne lokalne podatke.',
    confirmImport: 'Potvrdi uvoz',
    confirmImportMsg: 'Ovo će obrisati vaše trenutne podatke i zamijeniti ih uvoznom datotekom.',
    invalidJSON: 'Nevaljani JSON',
    invalidJSONMsg: 'Datoteka se nije mogla parsirati. Molimo odaberite valjanu izvezenu JSON datoteku.',
    taskProtected: 'Zadatak je zaštićen',
    taskProtectedMsg: 'Ovaj zadatak je zaštićen. Prvo otključajte "Zaštiti zadatak" u uređivaču da biste ga obrisali.',
    deleteConfirmTitle: 'Obrisati zadatak?',
    deleteConfirmMsg: 'Ovo će trajno obrisati zadatak i njegove slike.',
    
    // Menu options
    menu: 'Izbornik',
    moveToProject: 'Premjesti u projekt',
    linkToInbox: 'Poveži s Inboxom',
    unlinkFromInbox: 'Odspoji od Inboxa',
    taskLinkedToInbox: 'Uspjeh, zadatak povezan s Inboxom',
    taskUnlinkedFromInbox: 'Zadatak odspojen od Inboxa',
    projectLinkedToInbox: 'Uspjeh, projekt povezan s Inboxom',
    projectUnlinkedFromInbox: 'Projekt odspojen od Inboxa',
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
    compressImages: 'Kompresiraj slike (spremi prostor)',
    extraCompressArchive: 'Ekstra kompresiraj arhivirane slike',
    dataManagement: 'Upravljanje podacima',
    dataStoredLocally: 'Svi podaci se čuvaju lokalno na ovom uređaju (IndexedDB).',
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
    
    // Bin modal
    binIsEmpty: 'Koš je prazan',
    deletedItemsInfo: 'Obrisane stavke ostaju ovdje 24 sata.',
    deletedLabel: 'Obrisano',
    restore: 'Vrati',
    recentlyDeleted: 'Nedavno obrisano',
    
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
    
    // Help sections
    helpInbox: 'Inbox & brzo bilježenje',
    helpInboxContent: 'Inbox je vaša zona za brzo zabilježene misli. Dodirnite <b>+</b> da odmah dodate zadatke.<br><br><b>Poveži s Inboxom:</b> Radite duboko u projektu? Koristite izbornik zadatka ("...") za <b>Poveži s Inboxom</b>. Zadatak ostaje u projektu, ali se pojavljuje u vašem Inboxu. Dodirnite ikonu lanca (🔗) da skočite na njegov projekt.',
    helpProjects: 'Projekti & napredak',
    helpProjectsContent: 'Projekti organiziraju vašu tehniku. Glavna lista prikazuje <b>Trake napretka</b> (Žuta za zadatke, Ljubičasta za popise) tako da vidite svoj status na prvi pogled.<br><br><b>Podprojekti:</b> Razložite velike projekte! U projektu dodirnite <b>+</b> zatim <b>Novi podprojekt</b>. Pojavljuju se na početku popisa i mogu se prenositi povlačenjem.<br><br><b>Vrste projekata:</b> Odaberite Standardni za opće radove ili Popis za korak-po-korak popise s obavijestima.',
    helpFocusMode: 'Fokus mod (Zen)',
    helpFocusModeContent: 'Kada koristite projekt <b>Popis</b> (odličan za kupovinu ili pakiranje), dodirnite ikonu <b>⛶</b> u zaglavlju.<br><br>Ovo skriva svu navigaciju i omogućava vam da se fokusirate čisto na popis. Odličan je kada ste na putu!',
    helpProtected: 'Zaštićene stavke',
    helpProtectedContent: 'Označite zadatak ili projekt kao <b>"Zaštićen"</b> da izbjegnete slučajno brisanje ili arhiviranje.<br><br>Zaštićene stavke imaju ikonu zaključavanja (🔒) i moraju biti odblokane prije nego što ih možete ukloniti. Savršeno za upravitelje namirnica ili ponavljućih popisa.',
    helpPriorities: 'Prioriteti',
    helpPrioritiesContent: 'Efektivno prioritizirajte vizualnim znakovima:<br>• <b>Hitno!</b>: Trepće crveno. Učini sada.<br>• <b>Najviši</b>: Čvrstin crvena granica.<br>• <b>Visoki/Srednji/Niski</b>: Obojeni indikatori vam pomažu da sortirate manje kritične radove.',
    helpCompletion: 'Završetak & automatizacija',
    helpCompletionContent: 'Završeni zadaci se prebacuju na donji stog. Nakon <b>24 sata</b>, automatski se arhiviraju po datumu.<br><br><b>Koš:</b> Obrisane stavke ostaju u košu 24 sata prije nego što zauvijek nestanu.',
    helpGestures: 'Geste & prečaci',
    helpGesturesContent: '• <b>Dvostruki dodir</b> u Popisu za brzo dodavanje stavki.<br>• <b>Povlačenje & ispuštanje</b> zadataka da ih preuredite (kratko držite, zatim povucite).<br>• <b>Povlačenje & ispuštanje</b> projekata i podprojekta da uredite nadzornu ploču.<br>• <b>Dugi pritisak</b> sprječava slučajno povlačenje tijekom klizanja.',
    helpVoiceMemos: 'Glasovne poruke',
    helpVoiceMemosContent: 'Snimajte glasovne poruke za brze bilješke ili ideje.<br><br><b>Dijeljenje:</b> Za dijeljenje glasovne poruke s drugim aplikacijama, koristite gumb za dijeljenje i odaberite <b>"Spremi u Datoteke"</b>. Iz aplikacije Datoteke možete zatim dijeliti snimku s bilo kojom aplikacijom.',
    
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
    
    // Voice Memos
    voiceMemo: 'Glasovna poruka',
    voiceMemos: 'Glasovne poruke',
    recordVoiceMemo: 'Snimi glasovnu poruku',
    saveVoiceMemo: 'Spremi glasovnu poruku',
    voiceRecordingQuality: 'Kvaliteta snimanja',
    lowQuality: 'Niska kvaliteta (manje datoteke)',
    highQuality: 'Visoka kvaliteta',
    voiceMemoSaved: 'Glasovna poruka spremljena',
    voiceMemoDeleted: 'Glasovna poruka obrisana',
    voiceMemoMoved: 'Glasovna poruka premještena',
    memoLinkedToInbox: 'Poruka povezana s Inboxom',
    memoUnlinkedFromInbox: 'Poruka odpojena od Inboxa',
    deleteVoiceMemo: 'Obriši glasovnu poruku',
    deleteVoiceMemoConfirm: 'Jeste li sigurni da želite obrisati ovu glasovnu poruku?',
    voiceMemoActions: 'Odaberite radnju',
    memoTitle: 'Naslov poruke',
    tapToRecord: 'Dodirnite za snimanje',
    recording: 'Snimanje...',
    paused: 'Pauzirano',
    record: 'Snimi',
    pause: 'Pauziraj',
    stop: 'Zaustavi',
    play: 'Reproduciraj',
    reRecord: 'Ponovno snimi',
    reRecordConfirm: 'Ovo će obrisati trenutnu snimku i započeti novu. Nastaviti?',
    duration: 'Trajanje',
    discard: 'Odbaci',
    discardRecording: 'Odbaci snimku',
    discardRecordingConfirm: 'Jeste li sigurni da želite odbaciti ovu snimku? Ovo se ne može poništiti.',
    microphoneAccessDenied: 'Pristup mikrofonu odbijen. Molimo dozvolite pristup u postavkama preglednika.',
    microphoneNotSupported: 'Mikrofon nije podržan na ovom uređaju',
    microphoneNotFound: 'Mikrofon nije pronađen',
    microphoneInUse: 'Mikrofon koristi druga aplikacija',
    microphoneError: 'Greška mikrofona',
    requestingMicAccess: 'Traženje pristupa mikrofonu...',
    rename: 'Preimenuj',
    move: 'Premjesti',
    linkedToInbox: 'Povezano s Inboxom',
    addToInbox: 'Dodaj u Inbox',
    addToProject: 'Dodaj u projekt',
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
    
    // Todo editor
    editTodo: 'Modifica attività',
    newTodo: 'Nuova attività',
    title: 'Titolo',
    titleRequired: 'Titolo *',
    notes: 'Note',
    priority: 'Priorità',
    dueDate: 'Scadenza',
    completed: 'Completato',
    protectTask: 'Proteggi attività',
    protectedTasksInfo: 'Le attività protette non possono essere eliminate facilmente e rimangono nell\'elenco dei completati.',
    addImages: 'Aggiungi immagini',
    imagesStoredInfo: 'Le immagini vengono archiviate localmente in IndexedDB e verranno salvate offline.',
    removeImage: 'Rimuovi immagine',
    removeImageHint: 'Rimuovi',
    noFilesSelected: 'nessun file selezionato',
    chooseFile: 'Scegli file',
    fileSelected: '{n} file selezionato',
    filesSelected: '{n} file selezionati',
    importJSON: 'Importa JSON',
    importWarning: 'L\'importazione sostituirà tutti i dati locali attuali.',
    confirmImport: 'Conferma importazione',
    confirmImportMsg: 'Questo cancellerà i dati attuali e li sostituirà con il file importato.',
    invalidJSON: 'JSON non valido',
    invalidJSONMsg: 'Impossibile analizzare il file. Scegliere un JSON esportato valido.',
    taskProtected: 'Attività protetta',
    taskProtectedMsg: 'Questa attività è protetta. Deselezionare "Proteggi attività" nell\'editor per eliminarla.',
    deleteConfirmTitle: 'Eliminare l\'attività?',
    deleteConfirmMsg: 'Questo eliminerà permanentemente l\'attività e le sue immagini.',
    
    // Menu options
    menu: 'Menu',
    moveToProject: 'Sposta nel progetto',
    linkToInbox: 'Collega alla posta',
    unlinkFromInbox: 'Scollega dalla posta',
    taskLinkedToInbox: 'Successo, attività collegata alla posta',
    taskUnlinkedFromInbox: 'Attività scollegata dalla posta',
    projectLinkedToInbox: 'Successo, progetto collegato alla posta',
    projectUnlinkedFromInbox: 'Progetto scollegato dalla posta',
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
    compressImages: 'Comprimi immagini (risparmia spazio)',
    extraCompressArchive: 'Comprimi extra immagini archiviate',
    dataManagement: 'Gestione dei dati',
    dataStoredLocally: 'Tutto è archiviato localmente su questo dispositivo (IndexedDB).',
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
    
    // Bin modal
    binIsEmpty: 'Il cestino è vuoto',
    deletedItemsInfo: 'Gli elementi eliminati rimangono qui per 24 ore.',
    deletedLabel: 'Eliminato',
    restore: 'Ripristina',
    recentlyDeleted: 'Eliminati di recente',
    
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
    
    // Help sections
    helpInbox: 'Posta in arrivo & acquisizione rapida',
    helpInboxContent: 'La Posta in arrivo è la tua zona di atterraggio per i pensieri rapidi. Tocca <b>+</b> per aggiungere attività immediatamente.<br><br><b>Collega alla posta:</b> Lavorare a fondo in un progetto? Usa il menu attività ("...") per <b>Collega alla posta in arrivo</b>. L\'attività rimane nel progetto ma appare nella tua Posta in arrivo per il focus. Tocca l\'icona del collegamento (🔗) per saltare al suo progetto.',
    helpProjects: 'Progetti & avanzamento',
    helpProjectsContent: 'I progetti organizzano il tuo lavoro. L\'elenco principale mostra <b>Barre di avanzamento</b> (Giallo per attività, Viola per elenchi di controllo) così puoi vedere il tuo stato a colpo d\'occhio.<br><br><b>Sottoprogetti:</b> Suddividi grandi progetti! All\'interno di un progetto, tocca <b>+</b> poi <b>Nuovo sottoprogetto</b>. Appaiono in cima all\'elenco e possono essere riordinati trascinando.<br><br><b>Tipi di progetto:</b> Scegli Predefinito per il lavoro generale o Elenco di controllo per elenchi passo dopo passo con notifiche.',
    helpFocusMode: 'Modalità focus (Zen)',
    helpFocusModeContent: 'Quando usi un progetto <b>Elenco di controllo</b> (ottimo per lo shopping o l\'imballaggio), tocca l\'icona <b>⛶</b> nell\'intestazione.<br><br>Questo nasconde tutta la navigazione e ti consente di concentrarti puramente sull\'elenco. Ottimo quando sei in movimento!',
    helpProtected: 'Elementi protetti',
    helpProtectedContent: 'Marca un\'attività o un progetto come <b>"Protetto"</b> per prevenire l\'eliminazione o l\'archiviazione accidentale.<br><br>Gli elementi protetti hanno un\'icona di blocco (🔒) e devono essere sbloccati prima di poterli rimuovere. Perfetto per i maestri della spesa o gli elenchi ricorrenti.',
    helpPriorities: 'Priorità',
    helpPrioritiesContent: 'Dai priorità in modo efficace con segnali visivi:<br>• <b>Urgente!</b>: Lampeggia rosso. Fallo ORA.<br>• <b>Massima</b>: Bordo rosso solido.<br>• <b>Alta/Media/Bassa</b>: Gli indicatori colorati ti aiutano a ordinare i lavori meno critici.',
    helpCompletion: 'Completamento & automazione',
    helpCompletionContent: 'Le attività completate si spostano nella pila inferiore. Dopo <b>24 ore</b>, vengono archiviate automaticamente per data.<br><br><b>Cestino:</b> Gli elementi eliminati rimangono nel Cestino per 24 ore prima di scomparire per sempre.',
    helpGestures: 'Gesti & scorciatoie',
    helpGesturesContent: '• <b>Doppio tocco</b> in un Elenco di controllo per aggiungere rapidamente elementi.<br>• <b>Trascina & rilascia</b> attività per riordinarle (tieni premuto brevemente, quindi trascina).<br>• <b>Trascina & rilascia</b> progetti e sottoprogetti per organizzare il tuo dashboard.<br>• <b>Pressione lunga</b> impedisce trascinamenti accidentali durante lo scorrimento.',
    helpVoiceMemos: 'Memo vocali',
    helpVoiceMemosContent: 'Registra memo vocali per catturare note o idee veloci.<br><br><b>Condivisione:</b> Per condividere un memo vocale con altre app, usa il pulsante di condivisione e seleziona <b>"Salva su File"</b>. Dall\'app File puoi poi condividere la registrazione con qualsiasi app.',
    
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
    
    // Voice Memos
    voiceMemo: 'Memo vocale',
    voiceMemos: 'Memo vocali',
    recordVoiceMemo: 'Registra memo vocale',
    saveVoiceMemo: 'Salva memo vocale',
    voiceRecordingQuality: 'Qualità di registrazione',
    lowQuality: 'Bassa qualità (file più piccoli)',
    highQuality: 'Alta qualità',
    voiceMemoSaved: 'Memo vocale salvato',
    voiceMemoDeleted: 'Memo vocale eliminato',
    voiceMemoMoved: 'Memo vocale spostato',
    memoLinkedToInbox: 'Memo collegato alla Posta in arrivo',
    memoUnlinkedFromInbox: 'Memo scollegato dalla Posta in arrivo',
    deleteVoiceMemo: 'Elimina memo vocale',
    deleteVoiceMemoConfirm: 'Sei sicuro di voler eliminare questo memo vocale?',
    voiceMemoActions: 'Scegli un\'azione',
    memoTitle: 'Titolo memo',
    tapToRecord: 'Tocca per registrare',
    recording: 'Registrazione...',
    paused: 'In pausa',
    record: 'Registra',
    pause: 'Pausa',
    stop: 'Stop',
    play: 'Riproduci',
    reRecord: 'Registra di nuovo',
    reRecordConfirm: 'Questo eliminerà la registrazione attuale e ne inizierà una nuova. Continuare?',
    duration: 'Durata',
    discard: 'Scarta',
    discardRecording: 'Scarta registrazione',
    discardRecordingConfirm: 'Sei sicuro di voler scartare questa registrazione? Questa azione non può essere annullata.',
    microphoneAccessDenied: 'Accesso al microfono negato. Consenti l\'accesso nelle impostazioni del browser.',
    microphoneNotSupported: 'Microfono non supportato su questo dispositivo',
    microphoneNotFound: 'Nessun microfono trovato',
    microphoneInUse: 'Microfono in uso da un\'altra app',
    microphoneError: 'Errore microfono',
    requestingMicAccess: 'Richiesta accesso al microfono...',
    rename: 'Rinomina',
    move: 'Sposta',
    linkedToInbox: 'Collegato alla Posta in arrivo',
    addToInbox: 'Aggiungi alla Posta in arrivo',
    addToProject: 'Aggiungi al progetto',
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
    
    // Todo editor
    editTodo: 'Aufgabe bearbeiten',
    newTodo: 'Neue Aufgabe',
    title: 'Titel',
    titleRequired: 'Titel *',
    notes: 'Notizen',
    priority: 'Priorität',
    dueDate: 'Fälligkeitsdatum',
    completed: 'Erledigt',
    protectTask: 'Aufgabe schützen',
    protectedTasksInfo: 'Geschützte Aufgaben können nicht einfach gelöscht werden und bleiben in der Liste der abgeschlossenen Aufgaben.',
    addImages: 'Bilder hinzufügen',
    imagesStoredInfo: 'Bilder werden lokal in IndexedDB gespeichert und sind offline verfügbar.',
    removeImage: 'Bild entfernen',
    removeImageHint: 'Entfernen',
    noFilesSelected: 'keine Datei ausgewählt',
    chooseFile: 'Datei wählen',
    fileSelected: '{n} Datei ausgewählt',
    filesSelected: '{n} Dateien ausgewählt',
    importJSON: 'JSON importieren',
    importWarning: 'Der Import ersetzt alle aktuellen lokalen Daten.',
    confirmImport: 'Importieren bestätigen',
    confirmImportMsg: 'Dies löscht Ihre aktuellen Daten und ersetzt sie durch die importierte Datei.',
    invalidJSON: 'Ungültiges JSON',
    invalidJSONMsg: 'Die Datei konnte nicht analysiert werden. Bitte wählen Sie eine gültige exportierte JSON-Datei.',
    taskProtected: 'Aufgabe geschützt',
    taskProtectedMsg: 'Diese Aufgabe ist geschützt. Bitte deaktivieren Sie "Aufgabe schützen" im Editor, um sie zu löschen.',
    deleteConfirmTitle: 'Aufgabe löschen?',
    deleteConfirmMsg: 'Dies löscht die Aufgabe und ihre Bilder dauerhaft.',
    
    // Menu options
    menu: 'Menü',
    moveToProject: 'Zu Projekt verschieben',
    linkToInbox: 'Mit Posteingang verknüpfen',
    unlinkFromInbox: 'Vom Posteingang trennen',
    taskLinkedToInbox: 'Erfolg, Aufgabe mit Posteingang verknüpft',
    taskUnlinkedFromInbox: 'Aufgabe vom Posteingang getrennt',
    projectLinkedToInbox: 'Erfolg, Projekt mit Posteingang verknüpft',
    projectUnlinkedFromInbox: 'Projekt vom Posteingang getrennt',
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
    compressImages: 'Bilder komprimieren (Speicher sparen)',
    extraCompressArchive: 'Archivierte Bilder extra komprimieren',
    dataManagement: 'Datenverwaltung',
    dataStoredLocally: 'Alles wird lokal auf diesem Gerät gespeichert (IndexedDB).',
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
    
    // Bin modal
    binIsEmpty: 'Papierkorb ist leer',
    deletedItemsInfo: 'Gelöschte Elemente bleiben 24 Stunden hier.',
    deletedLabel: 'Gelöscht',
    restore: 'Wiederherstellen',
    recentlyDeleted: 'Kürzlich gelöscht',
    
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
    
    // Help sections
    helpInbox: 'Posteingang & schnelle Erfassung',
    helpInboxContent: 'Der Posteingang ist Ihre Landungszone für schnelle Gedanken. Tippen Sie auf <b>+</b>, um sofort Aufgaben hinzuzufügen.<br><br><b>Mit Posteingang verknüpfen:</b> Arbeiten Sie tief in einem Projekt? Nutzen Sie das Aufgabenmenü ("...") zum <b>Mit Posteingang verknüpfen</b>. Die Aufgabe bleibt im Projekt, erscheint aber in Ihrem Posteingang. Tippen Sie auf das Kettensymbol (🔗), um zu seinem Projekt zu springen.',
    helpProjects: 'Projekte & Fortschritt',
    helpProjectsContent: 'Projekte organisieren Ihre Arbeit. Die Hauptliste zeigt <b>Fortschrittsbalken</b> (Gelb für Aufgaben, Violett für Checklisten), damit Sie Ihren Status auf einen Blick sehen.<br><br><b>Unterprojekte:</b> Teilen Sie große Projekte auf! Tippen Sie in einem Projekt auf <b>+</b> und dann <b>Neues Unterprojekt</b>. Sie erscheinen oben in der Liste und können durch Ziehen neu angeordnet werden.<br><br><b>Projekttypen:</b> Wählen Sie Standard für allgemeine Arbeiten oder Checkliste für Schritt-für-Schritt-Listen mit Benachrichtigungen.',
    helpFocusMode: 'Fokusmodus (Zen)',
    helpFocusModeContent: 'Wenn Sie ein <b>Checklisten</b>projekt verwenden (ideal zum Einkaufen oder Packen), tippen Sie auf das Symbol <b>⛶</b> in der Kopfzeile.<br><br>Dies blendet alle Navigation aus und lässt Sie sich rein auf die Liste konzentrieren. Großartig, wenn Sie unterwegs sind!',
    helpProtected: 'Geschützte Elemente',
    helpProtectedContent: 'Markieren Sie eine Aufgabe oder ein Projekt als <b>"Geschützt"</b>, um versehentliches Löschen oder Archivieren zu verhindern.<br><br>Geschützte Elemente haben ein Schlosssymbol (🔒) und müssen entsperrt werden, bevor Sie sie entfernen können. Perfekt für Einkaufsmeister oder wiederkehrende Listen.',
    helpPriorities: 'Prioritäten',
    helpPrioritiesContent: 'Priorisieren Sie effektiv mit visuellen Hinweisen:<br>• <b>Dringend!</b>: Blinkt rot. Tu das JETZT.<br>• <b>Höchste</b>: Durchgehend rote Grenze.<br>• <b>Hoch/Mittel/Niedrig</b>: Farbige Indikatoren helfen Ihnen, weniger kritische Arbeiten zu sortieren.',
    helpCompletion: 'Abschluss & Automatisierung',
    helpCompletionContent: 'Abgeschlossene Aufgaben werden in den unteren Stapel verschoben. Nach <b>24 Stunden</b> werden sie automatisch nach Datum archiviert.<br><br><b>Papierkorb:</b> Gelöschte Elemente bleiben 24 Stunden im Papierkorb, bevor sie für immer verschwinden.',
    helpGestures: 'Gesten & Verknüpfungen',
    helpGesturesContent: '• <b>Doppeltippen</b> in einer Checkliste zum schnellen Hinzufügen von Elementen.<br>• <b>Ziehen & Ablegen</b> von Aufgaben, um sie neu zu ordnen (kurz halten, dann ziehen).<br>• <b>Ziehen & Ablegen</b> von Projekten und Unterprojekten, um Ihr Dashboard zu organisieren.<br>• <b>Langer Druck</b> verhindert versehentliche Züge beim Scrollen.',
    helpVoiceMemos: 'Sprachnotizen',
    helpVoiceMemosContent: 'Nehmen Sie Sprachnotizen auf, um schnelle Notizen oder Ideen festzuhalten.<br><br><b>Teilen:</b> Um eine Sprachnotiz mit anderen Apps zu teilen, verwenden Sie die Teilen-Schaltfläche und wählen Sie <b>"In Dateien sichern"</b>. Von der Dateien-App aus können Sie die Aufnahme dann mit jeder App teilen.',
    
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
    
    // Voice Memos
    voiceMemo: 'Sprachnotiz',
    voiceMemos: 'Sprachnotizen',
    recordVoiceMemo: 'Sprachnotiz aufnehmen',
    saveVoiceMemo: 'Sprachnotiz speichern',
    voiceRecordingQuality: 'Aufnahmequalität',
    lowQuality: 'Niedrige Qualität (kleinere Dateien)',
    highQuality: 'Hohe Qualität',
    voiceMemoSaved: 'Sprachnotiz gespeichert',
    voiceMemoDeleted: 'Sprachnotiz gelöscht',
    voiceMemoMoved: 'Sprachnotiz verschoben',
    memoLinkedToInbox: 'Notiz mit Posteingang verknüpft',
    memoUnlinkedFromInbox: 'Notiz vom Posteingang getrennt',
    deleteVoiceMemo: 'Sprachnotiz löschen',
    deleteVoiceMemoConfirm: 'Möchten Sie diese Sprachnotiz wirklich löschen?',
    voiceMemoActions: 'Aktion wählen',
    memoTitle: 'Notiztitel',
    tapToRecord: 'Tippen zum Aufnehmen',
    recording: 'Aufnahme...',
    paused: 'Pausiert',
    record: 'Aufnehmen',
    pause: 'Pause',
    stop: 'Stop',
    play: 'Abspielen',
    reRecord: 'Neu aufnehmen',
    reRecordConfirm: 'Dies löscht die aktuelle Aufnahme und startet eine neue. Fortfahren?',
    duration: 'Dauer',
    discard: 'Verwerfen',
    discardRecording: 'Aufnahme verwerfen',
    discardRecordingConfirm: 'Möchten Sie diese Aufnahme wirklich verwerfen? Dies kann nicht rückgängig gemacht werden.',
    microphoneAccessDenied: 'Mikrofonzugriff verweigert. Bitte erlauben Sie den Zugriff in den Browsereinstellungen.',
    microphoneNotSupported: 'Mikrofon wird auf diesem Gerät nicht unterstützt',
    microphoneNotFound: 'Kein Mikrofon gefunden',
    microphoneInUse: 'Mikrofon wird von einer anderen App verwendet',
    microphoneError: 'Mikrofonfehler',
    requestingMicAccess: 'Mikrofonzugriff anfordern...',
    rename: 'Umbenennen',
    move: 'Verschieben',
    linkedToInbox: 'Mit Posteingang verknüpft',
    addToInbox: 'Zum Posteingang hinzufügen',
    addToProject: 'Zum Projekt hinzufügen',
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
