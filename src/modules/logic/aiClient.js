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
- Keep titles concise but descriptive
- Include notes for important context
- Extract EVERY actionable item — do not skip anything
- If user says "every day/week/month/year" or "daily/weekly/monthly/yearly" or "every Monday" etc, set recurrenceType ("daily"/"weekly"/"monthly"/"yearly") and for weekly, set recurrenceDays as array of day numbers (0=Sun, 1=Mon...6=Sat)
- If user says "protect this" or "don't delete" or "important keep", set protected: true
- If user says "show in my inbox" or "link to inbox", set showInInbox: true

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
  "checklistPages": [{ "name": "...", "items": [{ "title": "..." }] }],
  "notes": [{ "text": "..." }]
}`;

function buildSystemPrompt(context) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const ctxLines = [
    `Today is ${dateStr}. Use this as the reference for relative dates like "tomorrow", "next week", "Monday", etc.`
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

export function buildPrompt(context, userText) {
  const systemPrompt = DEFAULT_SYSTEM_PROMPT;
  const contextPrompt = buildSystemPrompt(context);
  const userPrompt = `Context:\n${contextPrompt}\n\nUser request:\n${userText}`;
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
  const result = { tasks: [], projects: [], checklistPages: [], notes: [] };

  if (parsed.tasks && Array.isArray(parsed.tasks)) {
    for (const t of parsed.tasks) {
      if (t?.title) {
        result.tasks.push({
          title: String(t.title).trim(),
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
          name: cp.name || 'Untitled',
          items: (cp.items || []).filter(i => i?.title).map(i => ({
            title: String(i.title).trim(),
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

  return result;
}

function validateProject(p) {
  const project = {
    name: String(p.name).trim(),
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
          title: String(t.title).trim(),
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
          name: page.name || 'Untitled',
          items: (page.items || []).filter(i => i?.title).map(i => ({
            title: String(i.title).trim(),
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
