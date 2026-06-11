// AI integration client — provider configs, prompt builder, API call, response parser
// Supports any OpenAI-compatible endpoint (DeepSeek, Groq, OpenAI, OpenRouter, etc.)

export const AI_PROVIDERS = {
  deepseek: {
    label: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    signupUrl: 'https://platform.deepseek.com/sign_up',
    desc: 'Cheapest, great quality'
  },
  groq: {
    label: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    signupUrl: 'https://console.groq.com/login',
    desc: 'Free tier available, very fast'
  },
  openai: {
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    signupUrl: 'https://platform.openai.com/api-keys',
    desc: 'Industry standard'
  },
  openrouter: {
    label: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    signupUrl: 'https://openrouter.ai/keys',
    desc: 'One key, many models'
  }
};

const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant for a task management app called "ThingsToDo".
The app supports: tasks (with title, notes, priority, dueDate, recurrence, protected, linkToInbox), projects (default type with tasks/sub-projects or checklist type with pages/items), checklist pages with items, sub-projects, and project notes.

Given a user's natural language request, extract ALL actionable items and structure them as JSON.
Return ONLY valid JSON — no markdown, no explanation.

Rules:
- priority must be one of: URGENT, P0, P1, P2, P3 (default P2)
- dueDate must be ISO date string (YYYY-MM-DD) or null. Use the current date provided in context to calculate relative dates like "tomorrow", "next week", "Monday", "June 15th" etc.
- If user mentions urgency or deadlines, set appropriate priority
- If user mentions a "project", "list", or "category" with sub-items, create a project
- If items have sub-items or checkboxes, use checklist type project with pages
- A list of existing projects is provided in context. If the user references an existing project by name (e.g. "add to project Imanje"), use "addToProject" or "addToChecklistPage" instead of creating a new project.
- If the user says "add [items] to [project]" and the project exists, use addToProject (for adding tasks) or addToChecklistPage (for adding checklist items to a specific page).
- If the user says "move [task] to [project]" or "premjesti [task] u [project]", use moveTasks. The task title and target project name are shown in context. Do NOT create a new task — use moveTasks instead.
- The "Current context:" line tells you exactly where the user is. If they say "here", "this project", "this tab", "ovdje", "u ovom projektu", "u ovaj projekt" — use the current context. Do NOT create a new project or page for "here" commands. Just create tasks or items in the current location.
- When in a default project: a simple "add X" or "napravi X" creates a task IN the current project, not in Inbox.
- When in a checklist page: a simple "add X" or "dodaj X" adds items to the CURRENT page, not a new page.
- A single user sentence is ONE task. Do NOT split it. Extract the core actionable item, removing filler phrases like "remind me to", "I need to", "Prisjeti me da", "trebam", "moram", "želim", etc. Keep the title concise and actionable.
- Only populate the "notes" field if the user explicitly says "note:", "notes:", "put in notes", or similar. Do not infer notes from the title or put half the title in notes.
- Extract EVERY actionable item — a long sentence is one task, not several.
- If user says "every day/week/month/year" or "daily/weekly/monthly/yearly" or "every Monday" etc, set recurrenceType ("daily"/"weekly"/"monthly"/"yearly") and for weekly, set recurrenceDays as array of day numbers (0=Sun, 1=Mon...6=Sat)
- If user says "protect this" or "don't delete" or "important keep", set protected: true
- If user says "show in my inbox" or "link to inbox", set showInInbox: true
- The user's language is provided in context. Respond in EXACTLY that language — titles, notes, project names, and page names must all be in the user's language, not English.
- Capitalize ONLY the first letter of the FIRST word in each title. All other words stay lowercase (unless they are proper nouns). Example: \"Kupi mlijeko i kruh\", not \"Kupi Mlijeko I Kruh\".
- Use proper Unicode characters for special letters in the user's language (e.g. Croatian: š, đ, č, ć, ž — never use ASCII substitutes like s, d, c, z).

Response format:
{
  "tasks": [{ "title": "...", "notes": "", "priority": "P2", "dueDate": null, "recurrenceType": null, "recurrenceDays": null, "protected": false, "showInInbox": false }],
  "projects": [{
    "name": "...",
    "type": "default"|"checklist",
    "tasks": [],
    "subProjects": [{
      "name": "...",
      "tasks": []
    }],
    "pages": [{ "name": "...", "items": [{ "title": "...", "qty": null, "unit": null }] }]
  }],
  "checklistPages": [{ "name": "...", "items": [{ "title": "...", "qty": null, "unit": null }] }],
  "notes": [{ "text": "..." }],
  "addToProject": [{ "projectName": "...", "tasks": [{ "title": "...", "priority": "P2" }] }],
  "addToChecklistPage": [{ "projectName": "...", "pageName": "...", "items": [{ "title": "...", "qty": null, "unit": null }] }],
  "moveTasks": [{ "taskTitle": "...", "targetProject": "...", "targetPage": null }]
}`;

export function getSpeechLocale(lang) {
  const map = { en: 'en-US', hr: 'hr-HR', it: 'it-IT', de: 'de-DE', es: 'es-ES' };
  return map[lang] || navigator.language || 'en-US';
}

function buildSystemPrompt(context) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const userLang = context.lang || 'en';
  const ctxLines = [
    `Today is ${dateStr}. Use this as the reference for relative dates like "tomorrow", "next week", "Monday", etc.`,
    `The user's language is: ${userLang}. ALL titles, notes, project names, page names must be in ${userLang}, not English.`
  ];
  if (context.mode === 'inbox') {
    ctxLines.push('Current context: Inbox — create tasks here, or create new projects (top-level).');
  } else if (context.mode === 'project') {
    ctxLines.push(`Current context: Project "${context.projectName}" (${context.projectType}) — create tasks in this project, or create sub-projects under it.`);
  } else if (context.mode === 'checklist') {
    ctxLines.push(`Current context: Checklist project "${context.projectName}", current page: "${context.pageName}" — create items in this page, or create new pages.`);
  }
  return ctxLines.join('\n');
}

export async function buildExistingProjectsContext(db) {
  try {
    const projects = await db.projects.list();
    if (!projects || projects.length === 0) return '';

    const lines = ['Existing projects in your account:'];
    for (const proj of projects.slice(0, 30)) {
      const pages = await db.checklistPages?.listByProject?.(proj.id) || [];
      const tasks = await db.todos?.listByProject?.(proj.id) || [];
      const type = proj.type === 'checklist' ? 'checklist' : 'default';
      const details = [`- "${proj.name}" (${type})`];
      if (pages.length) {
        const pageNames = pages.map(p => '"' + (p.name || 'Untitled') + '"').join(', ');
        details.push(`  pages: ${pageNames}`);
      }
      if (tasks.length) {
        const taskTitles = tasks.slice(0, 15).map(t => '"' + t.title + '"').join(', ');
        details.push(`  tasks: ${taskTitles}`);
      }
      lines.push(details.join('\n'));
    }
    return lines.join('\n');
  } catch {
    return '';
  }
}

export async function buildPrompt(context, userText) {
  const systemPrompt = DEFAULT_SYSTEM_PROMPT;
  const contextPrompt = buildSystemPrompt(context);
  const existingProjectsStr = context.existingProjects || '';
  const userPrompt = existingProjectsStr
    ? `Context:\n${contextPrompt}\n\n${existingProjectsStr}\n\nUser request:\n${userText}`
    : `Context:\n${contextPrompt}\n\nUser request:\n${userText}`;
  return { systemPrompt, userPrompt };
}

export async function callAI(settings, systemPrompt, userPrompt) {
  const { aiEndpoint, aiApiKey, aiModel } = settings;
  if (!aiEndpoint || !aiApiKey || !aiModel) {
    throw new Error('AI not configured. Go to Settings → AI Assistant.');
  }

  const url = `${aiEndpoint.replace(/\/+$/, '')}/chat/completions`;

  const body = {
    model: aiModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 2000
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiApiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    let msg = `API error (${res.status})`;
    try {
      const err = await res.json();
      if (err?.error?.message) msg += `: ${err.error.message}`;
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  return content;
}

export function parseResponse(raw) {
  // Try to extract JSON from markdown code blocks
  let jsonStr = raw.trim();

  // Remove markdown code fences if present
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    // Fallback: try to find any JSON-like object in the text
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {}
    }
    throw new Error('AI response was not valid JSON. Please try again or rephrase your request.');
  }
}

export function validateStructure(parsed) {
  const result = { tasks: [], projects: [], checklistPages: [], notes: [], addToProject: [], addToChecklistPage: [], moveTasks: [] };

  if (parsed.tasks && Array.isArray(parsed.tasks)) {
    for (const t of parsed.tasks) {
      if (t?.title) {
        result.tasks.push({
          title: capitalizeFirst(String(t.title).trim()),
          notes: t.notes || '',
          priority: validatePriority(t.priority),
          dueDate: t.dueDate || null,
          recurrenceType: validateRecurrenceType(t.recurrenceType),
          recurrenceDays: t.recurrenceDays || null,
          protected: t.protected === true,
          showInInbox: t.showInInbox === true
        });
      }
    }
  }

  if (parsed.projects && Array.isArray(parsed.projects)) {
    for (const p of parsed.projects) {
      if (p?.name) {
        result.projects.push(validateProject(p));
      }
    }
  }

  if (parsed.checklistPages && Array.isArray(parsed.checklistPages)) {
    for (const cp of parsed.checklistPages) {
      if (cp?.name || cp?.items?.length) {
        result.checklistPages.push({
          name: capitalizeFirst(cp.name || 'Untitled'),
          items: (cp.items || []).filter(i => i?.title).map(i => ({
            title: capitalizeFirst(String(i.title).trim()),
            notes: i.notes || '',
            qty: i.qty || null,
            unit: i.unit || null
          }))
        });
      }
    }
  }

  if (parsed.notes && Array.isArray(parsed.notes)) {
    for (const n of parsed.notes) {
      if (n?.text) {
        result.notes.push({ text: String(n.text).trim() });
      }
    }
  }

  if (parsed.addToProject && Array.isArray(parsed.addToProject)) {
    for (const ap of parsed.addToProject) {
      if (ap?.projectName && ap?.tasks?.length) {
        result.addToProject.push({
          projectName: String(ap.projectName).trim(),
          tasks: ap.tasks.filter(t => t?.title).map(t => ({
            title: capitalizeFirst(String(t.title).trim()),
            notes: t.notes || '',
            priority: validatePriority(t.priority),
            dueDate: t.dueDate || null,
            protected: t.protected === true,
            showInInbox: t.showInInbox === true
          }))
        });
      }
    }
  }

  if (parsed.addToChecklistPage && Array.isArray(parsed.addToChecklistPage)) {
    for (const acp of parsed.addToChecklistPage) {
      if (acp?.projectName && acp?.pageName && acp?.items?.length) {
        result.addToChecklistPage.push({
          projectName: String(acp.projectName).trim(),
          pageName: String(acp.pageName).trim(),
          items: acp.items.filter(i => i?.title).map(i => ({
            title: capitalizeFirst(String(i.title).trim()),
            notes: i.notes || ''
          }))
        });
      }
    }
  }

  if (parsed.moveTasks && Array.isArray(parsed.moveTasks)) {
    for (const mt of parsed.moveTasks) {
      if (mt?.taskTitle && mt?.targetProject) {
        result.moveTasks.push({
          taskTitle: String(mt.taskTitle).trim(),
          targetProject: String(mt.targetProject).trim(),
          targetPage: mt.targetPage ? String(mt.targetPage).trim() : null
        });
      }
    }
  }

  return result;
}

function validateProject(p) {
  const project = {
    name: capitalizeFirst(String(p.name).trim()),
    type: p.type === 'checklist' ? 'checklist' : 'default',
    tasks: [],
    subProjects: [],
    pages: [],
    useSuggestions: p.type === 'checklist',
    enableQtyUnits: false,
    keepCompletedItems: false
  };

  if (p.tasks && Array.isArray(p.tasks)) {
    for (const t of p.tasks) {
      if (t?.title) {
        project.tasks.push({
          title: capitalizeFirst(String(t.title).trim()),
          notes: t.notes || '',
          priority: validatePriority(t.priority),
          dueDate: t.dueDate || null,
          recurrenceType: validateRecurrenceType(t.recurrenceType),
          recurrenceDays: t.recurrenceDays || null,
          protected: t.protected === true,
          showInInbox: t.showInInbox === true
        });
      }
    }
  }

  if (p.subProjects && Array.isArray(p.subProjects)) {
    for (const sp of p.subProjects) {
      if (sp?.name) {
        project.subProjects.push(validateProject(sp));
      }
    }
  }

  if (p.type === 'checklist' && p.pages && Array.isArray(p.pages)) {
    for (const page of p.pages) {
      if (page?.name || page?.items?.length) {
        project.pages.push({
          name: capitalizeFirst(page.name || 'Untitled'),
          items: (page.items || []).filter(i => i?.title).map(i => ({
            title: capitalizeFirst(String(i.title).trim()),
            notes: i.notes || '',
            qty: i.qty || null,
            unit: i.unit || null
          }))
        });
      }
    }
  }

  return project;
}

function capitalizeFirst(str) {
  if (!str) return str;
  return str.charAt(0).toLocaleUpperCase() + str.slice(1);
}

function validatePriority(p) {
  const valid = ['URGENT', 'P0', 'P1', 'P2', 'P3'];
  if (valid.includes(p)) return p;
  return 'P2';
}

function validateRecurrenceType(r) {
  const valid = ['daily', 'weekly', 'monthly', 'yearly'];
  if (valid.includes(r)) return r;
  return null;
}

export async function verifyConnection(settings) {
  const { aiEndpoint, aiApiKey, aiModel } = settings;
  if (!aiEndpoint || !aiApiKey || !aiModel) {
    return { ok: false, message: 'Complete all fields first.' };
  }

  const url = `${aiEndpoint.replace(/\/+$/, '')}/chat/completions`;
  const body = {
    model: aiModel,
    messages: [{ role: 'user', content: 'Reply with just: OK' }],
    max_tokens: 10
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      let msg = `Error ${res.status}`;
      try {
        const err = await res.json();
        if (err?.error?.message) msg += `: ${err.error.message}`;
      } catch {}
      return { ok: false, message: msg };
    }

    return { ok: true, message: 'Connection successful!' };
  } catch (err) {
    return { ok: false, message: `Network error: ${err.message}` };
  }
}
