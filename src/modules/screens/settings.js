import { el, clear } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { confirm } from '../ui/confirm.js';
import { applyTheme } from '../ui/theme.js';
import { openBinModal } from '../ui/binModal.js';
import { t, getLang, setLang, languageNames, getAvailableLanguages } from '../utils/i18n.js';

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
  const compressImages = settings.compressImages !== false; // Default to true
  const compressArchivedImages = settings.compressArchivedImages !== false; // Default to true

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

  const compressToggle = el('input', {
    type: 'checkbox',
    checked: compressImages ? 'checked' : null,
    'aria-label': 'Compress images'
  });

  compressToggle.addEventListener('change', async () => {
    await db.settings.put({ ...await db.settings.get(), compressImages: compressToggle.checked });
  });

  const compressArchiveToggle = el('input', {
    type: 'checkbox',
    checked: compressArchivedImages ? 'checked' : null,
    'aria-label': 'Extra compress archived images'
  });

  compressArchiveToggle.addEventListener('change', async () => {
    await db.settings.put({ ...await db.settings.get(), compressArchivedImages: compressArchiveToggle.checked });
  });

  // Language selector
  const currentLang = getLang();
  const langSelect = el('select', {
    class: 'select',
    'aria-label': t('language'),
    onChange: (e) => {
      setLang(e.target.value);
      // Re-render the entire app by triggering a hash change
      const hash = location.hash;
      location.hash = '';
      setTimeout(() => { location.hash = hash || '#settings'; }, 10);
    }
  }, ...getAvailableLanguages().map(code =>
    el('option', { value: code, selected: code === currentLang ? 'selected' : null }, languageNames[code])
  ));

  const exportBtn = el('button', { class: 'btn btn--primary', type: 'button', onClick: exportData }, t('exportData'));
  const importBtn = el('button', { class: 'btn', type: 'button', onClick: importData }, t('importData'));
  const binBtn = el('button', { class: 'btn', type: 'button', onClick: () => openBinModal(ctx) }, t('bin'));
  const helpBtn = el('button', { class: 'btn', type: 'button', onClick: () => location.hash = '#help' }, t('help'));
  const resetBtn = el('button', { class: 'btn btn--danger', type: 'button', onClick: resetData }, t('clearAllData'));

  main.append(el('div', { class: 'stack' },
    el('div', { class: 'card stack' },
      el('div', { style: { fontWeight: '700' } }, t('language')),
      langSelect
    ),
    el('div', { class: 'card stack' },
      el('div', { style: { fontWeight: '700' } }, t('theme')),
      el('div', { class: 'row' },
        el('div', { class: 'small' }, t('themeLight')),
        themeToggle
      ),
      el('div', { class: 'row' },
        el('div', { class: 'small' }, t('compressImages')),
        compressToggle
      ),
      el('div', { class: 'row' },
        el('div', { class: 'small' }, t('extraCompressArchive')),
        compressArchiveToggle
      )
    ),
    el('div', { class: 'card stack' },
      el('div', { style: { fontWeight: '700' } }, t('help')),
      helpBtn
    ),
    el('div', { class: 'card stack' },
      el('div', { style: { fontWeight: '700' } }, t('dataManagement')),
      el('div', { class: 'small' }, t('dataStoredLocally')),
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
        dataUrl: await blobToDataUrl(a.blob),
        thumbDataUrl: a.thumb ? await blobToDataUrl(a.thumb) : null
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
              const thumbBlob = a.thumbDataUrl ? await dataUrlToBlob(a.thumbDataUrl) : null;
              await db.attachments.put({
                id: a.id,
                todoId: a.todoId,
                name: a.name,
                type: a.type,
                createdAt: a.createdAt,
                blob,
                thumb: thumbBlob
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
