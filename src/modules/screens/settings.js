import { el, clear } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { confirm } from '../ui/confirm.js';
import { applyTheme } from '../ui/theme.js';
import { openBinModal } from '../ui/binModal.js';

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return await res.blob();
}

export async function renderSettings(ctx) {
  const { main, db, modalHost } = ctx;
  clear(main);

  const settings = await db.settings.get();
  const isLight = settings.theme === 'light';

  const themeToggle = el('input', {
    type: 'checkbox',
    checked: isLight ? 'checked' : null,
    'aria-label': 'Light mode'
  });

  themeToggle.addEventListener('change', async () => {
    const nextTheme = themeToggle.checked ? 'light' : 'dark';
    await db.settings.put({ ...settings, theme: nextTheme });
    applyTheme(nextTheme);
  });

  const exportBtn = el('button', { class: 'btn btn--primary', type: 'button', onClick: exportData }, 'Export data (JSON)');
  const importBtn = el('button', { class: 'btn', type: 'button', onClick: importData }, 'Import JSON');
  const binBtn = el('button', { class: 'btn', type: 'button', onClick: () => openBinModal(ctx) }, 'Open Bin (Recently Deleted)');
  const helpBtn = el('button', { class: 'btn', type: 'button', onClick: () => location.hash = '#help' }, 'Help & Guide');
  const resetBtn = el('button', { class: 'btn btn--danger', type: 'button', onClick: resetData }, 'Reset / Wipe all data');

  main.append(el('div', { class: 'stack' },
    el('div', { class: 'card stack' },
      el('div', { style: { fontWeight: '700' } }, 'Appearance'),
      el('div', { class: 'row' },
        el('div', { class: 'small' }, 'Light mode'),
        themeToggle
      )
    ),
    el('div', { class: 'card stack' },
      el('div', { style: { fontWeight: '700' } }, 'App Info'),
      helpBtn
    ),
    el('div', { class: 'card stack' },
      el('div', { style: { fontWeight: '700' } }, 'Data management'),
      el('div', { class: 'small' }, 'Everything is stored locally on this device (IndexedDB).'),
      exportBtn,
      importBtn,
      binBtn,
      resetBtn
    )
  ));

  async function exportData() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      projects: await db.projects.list(),
      todos: [...(await db.todos.listActive()), ...(await db.todos.listArchived())],
      settings: await db.settings.get(),
      attachments: []
    };

    const atts = await db.attachments.list();
    // Convert blobs to data URLs for portability.
    for (const a of atts) {
      payload.attachments.push({
        id: a.id,
        todoId: a.todoId,
        name: a.name,
        type: a.type,
        createdAt: a.createdAt,
        dataUrl: await blobToDataUrl(a.blob)
      });
    }

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `thingstodo-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importData() {
    const fileInput = el('input', { type: 'file', accept: 'application/json', class: 'input', 'aria-label': 'Import JSON file' });
    const content = el('div', { class: 'stack' },
      el('div', { class: 'small' }, 'Import will replace all current local data.'),
      fileInput
    );

    openModal(modalHost, {
      title: 'Import JSON',
      content,
      actions: [
        { label: 'Cancel', class: 'btn btn--ghost', onClick: () => true },
        {
          label: 'Import',
          class: 'btn btn--primary',
          onClick: async () => {
            const f = (fileInput.files || [])[0];
            if (!f) return false;

            const ok = await confirm(modalHost, {
              title: 'Confirm import',
              message: 'This will wipe your current data and replace it with the imported file.',
              confirmLabel: 'Import',
              danger: true
            });
            if (!ok) return false;

            const text = await f.text();
            let parsed;
            try {
              parsed = JSON.parse(text);
            } catch {
              openModal(modalHost, {
                title: 'Invalid JSON',
                content: el('div', { class: 'small' }, 'Could not parse the file. Please choose a valid export JSON.'),
                actions: [{ label: 'OK', class: 'btn btn--primary', onClick: () => true }]
              });
              return false;
            }

            await db.wipeAll();

            for (const p of (parsed.projects || [])) await db.projects.put(p);
            for (const t of (parsed.todos || [])) await db.todos.put(t);
            if (parsed.settings) await db.settings.put(parsed.settings);

            for (const a of (parsed.attachments || [])) {
              if (!a.dataUrl || !a.todoId) continue;
              const blob = await dataUrlToBlob(a.dataUrl);
              await db.attachments.put({
                id: a.id,
                todoId: a.todoId,
                name: a.name,
                type: a.type,
                createdAt: a.createdAt,
                blob
              });
            }

            // Refresh current screen
            location.hash = '#settings';
            return true;
          }
        }
      ]
    });
  }

  async function resetData() {
    const ok = await confirm(modalHost, {
      title: 'Reset all data?',
      message: 'This will permanently remove all projects, todos, images, and settings from this device.',
      confirmLabel: 'Wipe',
      danger: true
    });
    if (!ok) return;

    await db.wipeAll();

    openModal(modalHost, {
      title: 'Done',
      content: el('div', { class: 'small' }, 'All local data has been wiped.'),
      actions: [{ label: 'OK', class: 'btn btn--primary', onClick: () => true }]
    });
  }
}
