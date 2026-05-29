// Local fallback parser for simple voice/text commands
// Tries to handle trivial patterns locally before calling the AI API.
// Returns null if the input is too complex — caller should fall back to AI.
// Returns a result object matching the same format as aiClient.validateStructure.

const AI_ROUTE_KEYWORDS = [
  // === Date/time (all languages) ===
  'tomorrow', 'today', 'next', 'tonight', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday', 'sunday', 'week', 'month', 'year',
  'morning', 'afternoon', 'evening', 'o\'clock', 'pm', 'am',
  'domani', 'oggi', 'prossimo', 'stasera', 'luned\u00ec', 'marted\u00ec',
  'mercoled\u00ec', 'gioved\u00ec', 'venerd\u00ec', 'sabato', 'domenica',
  'mattina', 'pomeriggio', 'sera',
  'morgen', 'heute', 'n\u00e4chste', 'montag', 'dienstag', 'mittwoch',
  'donnerstag', 'freitag', 'samstag', 'sonntag',
  'morgens', 'nachmittag', 'abends',
  'ma\u00f1ana', 'hoy', 'pr\u00f3ximo', 'lunes', 'martes', 'mi\u00e9rcoles',
  'jueves', 'viernes', 's\u00e1bado', 'domingo', 'tarde', 'noche',
  'sutra', 'danas', 'prekosutra', 've\u010deras', 'ponedjeljak', 'utorak',
  'srijeda', '\u010detvrtak', 'petak', 'subota', 'nedjelja',
  'ujutro', 'popodne', 'nave\u010der', 'sati', 'sat', 'minuta',
  'sljede\u0107i', 'idu\u0107i', 'ovaj', 'sino\u0107',
  // === Priority ===
  'urgent', 'important', 'critical', 'asap', 'high priority', 'low priority',
  'urgente', 'importante', 'priorit\u00e0', 'critico', 'bassa', 'alta',
  'dringend', 'wichtig', 'priorit\u00e4t', 'kritisch', 'niedrig', 'hoch',
  'urgente', 'importante', 'prioridad', 'cr\u00edtico', 'baja prioridad',
  'hitno', 'va\u017eno', 'bitno', 'prioritet', 'visoki', 'niski', 'kriti\u010dno',
  // === Project/structure ===
  'project', 'checklist', 'page', 'sub-project', 'list', 'create', 'make',
  'progetto', 'checklist', 'pagina', 'crea', 'nuovo',
  'projekt', 'checkliste', 'seite', 'erstellen', 'neu',
  'proyecto', 'lista', 'p\u00e1gina', 'crear', 'nuevo',
  'projekt', 'popis', 'stranica', 'podprojekt', 'kreiraj', 'napravi', 'novi'
];

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toLocaleUpperCase() + str.slice(1);
}

function hasAIRouteKeyword(text) {
  const lower = text.toLowerCase();
  for (const kw of AI_ROUTE_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

/**
 * Try to parse user input locally.
 * @param {string} text - The raw user input
 * @param {object} context - { mode: 'inbox'|'project'|'checklist', ... }
 * @returns {object|null} Parsed result (same format as AI) or null if too complex
 */
export function tryParse(text, context) {
  if (!text || !text.trim()) return null;

  // If any AI-route keyword is found, pass to AI (works in all modes)
  if (hasAIRouteKeyword(text)) return null;

  // If text is more than 80 chars, it's probably a sentence → AI
  if (text.length > 80) return null;

  const original = text.trim();

  // Strip common leading action words (multi-language)
  let clean = original;
  const prefixes = [
    'kupi ', 'kupiti ', 'dodaj ', 'dodati ', 'napravi ', 'napraviti ',
    'trebam ', 'moram ', 'zelim ', '\u017eelim ', 'treba ',
    'buy ', 'add ', 'get ', 'need ', 'must ', 'want ',
    'compra ', 'acquista ', 'aggiungi ', 'metti ', 'prendi ', 'serve ',
    'kaufe ', 'kaufen ', 'f\u00fcge hinzu ', 'brauche ', 'm\u00f6chte ',
    'compra ', 'a\u00f1ade ', 'necesito ', 'quiero ', 'pon '
  ];

  for (const p of prefixes) {
    if (clean.toLowerCase().startsWith(p)) {
      clean = clean.substring(p.length).trim();
      break;
    }
  }

  if (!clean) return null;

  // Split on commas, semicolons, or conjunction words (i, and, e, und, y, &)
  const parts = clean
    .split(/\s*[,;]\s*|\s+(?:i|te|pa)\s+|\s+and\s+|\s+e\s+|\s+und\s+|\s+y\s+|\s*&\s*/gi)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (parts.length === 0) return null;

  const tasks = [];
  for (const part of parts) {
    // Each item should be a short phrase (max 6 words) — longer = sentence = route to AI
    const wordCount = part.split(/\s+/).length;
    if (wordCount > 6) return null;
    // Skip if it's just filler
    if (wordCount === 1 && part.length < 2) continue;
    tasks.push({ title: capitalizeFirst(part) });
  }

  if (tasks.length === 0) return null;

  return {
    tasks,
    projects: [],
    checklistPages: [],
    notes: [],
    addToProject: [],
    addToChecklistPage: []
  };
}
