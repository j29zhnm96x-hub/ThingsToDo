import { el, clear } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { confirm } from '../ui/confirm.js';
import { applyTheme, applyPalette } from '../ui/theme.js';
import { openBinModal } from '../ui/binModal.js';
import { showToast } from '../ui/toast.js';
import { t, getLang, setLang, languageNames, getAvailableLanguages } from '../utils/i18n.js';
import { router } from '../router.js';
import { checkForUpdates, getUpdateInfo, showUpdateOverlayAndReload } from '../updater.js';
import { AI_PROVIDERS, verifyConnection } from '../logic/aiClient.js';

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
  const currentTheme = settings.theme || 'dark';
  const themePalette = settings.themePalette || 'default';
  const themeLat = settings.themeLat;
  const themeLng = settings.themeLng;
  const compressImages = settings.compressImages !== false; // Default to true
  const compressArchivedImages = settings.compressArchivedImages !== false; // Default to true
  const voiceQuality = settings.voiceQuality || 'low'; // Default to low
  const groupActiveTasks = settings.groupActiveTasks === true;
  const enableConfetti = settings.enableConfetti !== false; // Default true
  const enableConfettiSound = settings.enableConfettiSound !== false; // Default true
  const enableSwipe = settings.enableSwipe === true; // Default false
  const scrollLongTitles = settings.scrollLongTitles === true; // Default false
  const scrollSpeed = settings.scrollSpeed ?? 0; // -2 to +2, 0 = default 60px/s

  // AI settings
  const aiEnabled = settings.aiEnabled === true;
  const aiProvider = settings.aiProvider || 'deepseek';
  const aiEndpoint = settings.aiEndpoint || AI_PROVIDERS.deepseek.endpoint;
  const aiApiKey = settings.aiApiKey || '';
  const aiModel = settings.aiModel || AI_PROVIDERS.deepseek.model;
  const aiSystemPrompt = settings.aiSystemPrompt || '';
  const quickVoiceAdd = settings.quickVoiceAdd === true;

  const themeModes = [
    { id: 'light', label: t('themeLight') },
    { id: 'dark', label: t('themeDark') || 'Dark' },
    { id: 'dynamic', label: t('themeDynamic') || 'Dynamic' }
  ];

  const themePicker = el('div', { class: 'row', role: 'group', 'aria-label': t('theme'), style: { justifyContent: 'center', gap: '6px' } },
    ...themeModes.map((m) => {
      const isSelected = currentTheme === m.id;
      return el('button', {
        type: 'button',
        class: `btn btn--small${isSelected ? ' btn--primary' : ''}`,
        'aria-pressed': isSelected ? 'true' : 'false',
        onClick: async () => {
          if (m.id === currentTheme) return;
          let lat = themeLat, lng = themeLng;

          // Request location if switching to dynamic and no saved location
          if (m.id === 'dynamic' && (lat == null || lng == null)) {
            if ('geolocation' in navigator) {
              try {
                const pos = await new Promise((resolve, reject) =>
                  navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 5000 })
                );
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
              } catch {
                showToast('Enable location for Dynamic theme, or use Light/Dark.');
              }
            }
          }

          await db.settings.put({
            ...await db.settings.get(),
            theme: m.id,
            themeLat: lat ?? null,
            themeLng: lng ?? null
          });
          applyTheme(m.id, lat, lng);
          applyPalette((await db.settings.get()).themePalette || 'default');
          await renderSettings(ctx);
        }
      }, m.label);
    })
  );

  const paletteOptions = [
    { id: 'default', label: t('paletteDefault') },
    { id: 'purple', label: t('palettePurple') },
    { id: 'orange', label: t('paletteOrange') },
    { id: 'red', label: t('paletteRed') },
    { id: 'blue', label: t('paletteBlue') }
  ];

  const paletteSwatches = el('div', { class: 'theme-swatches', role: 'group', 'aria-label': t('theme') },
    ...paletteOptions.map((p) => {
      const isSelected = p.id === themePalette;
      return el('button', {
        type: 'button',
        class: `theme-swatch${isSelected ? ' is-selected' : ''}`,
        dataset: { palette: p.id },
        'aria-label': p.label,
        title: p.label,
        'aria-pressed': isSelected ? 'true' : 'false',
        onClick: async () => {
          if (p.id === themePalette) return;
          const nextSettings = { ...await db.settings.get(), themePalette: p.id };
          await db.settings.put(nextSettings);
          applyPalette(p.id);
          await renderSettings(ctx);
        }
      }, isSelected ? '✓' : '');
    })
  );

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

  // Voice quality selector
  const voiceQualitySelect = el('select', {
    class: 'select',
    'aria-label': t('voiceRecordingQuality') || 'Voice recording quality',
    onChange: async (e) => {
      await db.settings.put({ ...await db.settings.get(), voiceQuality: e.target.value });
    }
  },
    el('option', { value: 'low', selected: voiceQuality === 'low' ? 'selected' : null }, t('lowQuality') || 'Low quality (smaller files)'),
    el('option', { value: 'high', selected: voiceQuality === 'high' ? 'selected' : null }, t('highQuality') || 'High quality')
  );

  // Language selector
  const currentLang = getLang();
  const groupingToggle = el('input', {
    type: 'checkbox',
    checked: groupActiveTasks ? 'checked' : null,
    'aria-label': t('groupActiveTasks')
  });

  groupingToggle.addEventListener('change', async () => {
    await db.settings.put({ ...await db.settings.get(), groupActiveTasks: groupingToggle.checked });
  });

  const langSelect = el('select', {
    class: 'select',
    'aria-label': t('language'),
    onChange: async (e) => {
      setLang(e.target.value);
      const s = await db.settings.get();
      s.lang = e.target.value;
      await db.settings.put(s);
      router.refresh();
    }
  }, ...getAvailableLanguages().map(code =>
    el('option', { value: code, selected: code === currentLang ? 'selected' : null }, languageNames[code])
  ));

  const exportBtn = el('button', { class: 'btn btn--primary', type: 'button', onClick: exportData }, t('exportData'));
  const importBtn = el('button', { class: 'btn', type: 'button', onClick: importData }, t('importData'));
  const pasteSharedBtn = el('button', { class: 'btn', type: 'button', onClick: openPasteSharedModal }, 'Paste a task/project');
  const binBtn = el('button', { class: 'btn', type: 'button', onClick: () => openBinModal(ctx) }, t('bin'));
  const helpBtn = el('button', { class: 'btn', type: 'button', onClick: () => location.hash = '#help' }, t('help'));

  // Behaviors toggles
  const confettiToggle = el('input', { type: 'checkbox', checked: enableConfetti ? 'checked' : null, 'aria-label': t('enableConfetti') });
  confettiToggle.addEventListener('change', async () => {
    const next = { ...await db.settings.get(), enableConfetti: confettiToggle.checked };
    await db.settings.put(next);
  });
  const confettiSoundToggle = el('input', { type: 'checkbox', checked: enableConfettiSound ? 'checked' : null, 'aria-label': t('enableConfettiSound') });
  confettiSoundToggle.addEventListener('change', async () => {
    const next = { ...await db.settings.get(), enableConfettiSound: confettiSoundToggle.checked };
    await db.settings.put(next);
  });
  const swipeToggle = el('input', { type: 'checkbox', checked: enableSwipe ? 'checked' : null, 'aria-label': t('enableSwipe') });
  swipeToggle.addEventListener('change', async () => {
    const next = { ...await db.settings.get(), enableSwipe: swipeToggle.checked };
    await db.settings.put(next);
  });
  const resetBtn = el('button', { class: 'btn btn--danger', type: 'button', onClick: resetData }, t('clearAllData'));
  const resetStatsBtn = el('button', { class: 'btn', type: 'button', onClick: resetStats }, t('resetStats') || 'Reset statistics');
  const manageSuggestionsBtn = el('button', { class: 'btn', type: 'button', onClick: openSuggestionHistoryModal }, t('clearSuggestionHistory') || 'Clear suggestion history');

  // Update check
  const updateInfo = getUpdateInfo();
  const updateInfoText = updateInfo.supported ? `v${updateInfo.version || '1.0.0'}` : t('notificationsBlocked') || 'Not supported';
  const statusEl = el('div', { id: 'updateStatus', class: 'small', style: { marginTop: '4px' } }, updateInfoText);
  const checkUpdateBtn = el('button', {
    class: 'btn',
    type: 'button',
    onClick: async () => {
      checkUpdateBtn.disabled = true;
      checkUpdateBtn.textContent = t('updateChecking');
      const result = await checkForUpdates();
      if (result.updated) {
        showUpdateOverlayAndReload();
      } else if (result.error === 'unsupported') {
        statusEl.textContent = t('notificationsBlocked') || 'Not supported';
        checkUpdateBtn.textContent = t('updateCheck');
        checkUpdateBtn.disabled = false;
      } else {
        statusEl.textContent = t('updateUpToDate') || 'App is up to date';
        checkUpdateBtn.textContent = t('updateCheck');
        checkUpdateBtn.disabled = false;
      }
    }
  }, t('updateCheck') || 'Check for Updates');

  main.append(el('div', { class: 'stack', style: { gap: '6px' } },
    buildCollapsibleSection(t('language'), [langSelect]),
    buildCollapsibleSection(t('inbox'), [
      el('div', { class: 'row' },
        el('div', { class: 'small' }, t('groupActiveTasks')),
        groupingToggle
      )
    ]),
    buildCollapsibleSection(t('voiceMemos'), [
      el('label', { class: 'label' },
        el('span', {}, t('voiceRecordingQuality') || 'Recording quality'),
        voiceQualitySelect
      )
    ]),
    buildCollapsibleSection(t('checklistOptions') || 'Checklists options', [
      el('div', { class: 'small' }, t('manageSuggestionHistory') || 'Manage saved checklist suggestions'),
      manageSuggestionsBtn
    ]),
    buildCollapsibleSection(t('behaviors'), [
      el('div', { class: 'row' },
        el('div', { class: 'small' }, t('enableConfetti')),
        confettiToggle
      ),
      el('div', { class: 'row' },
        el('div', { class: 'small' }, t('enableConfettiSound')),
        confettiSoundToggle
      ),
      el('div', { class: 'row' },
        el('div', { class: 'small' }, t('enableSwipe')),
        swipeToggle
      ),
      el('div', { class: 'row' },
        el('div', { class: 'small' }, t('scrollLongTitles')),
        buildToggle(scrollLongTitles, async (val) => {
          await db.settings.put({ ...await db.settings.get(), scrollLongTitles: val });
          const el = document.getElementById('scrollSpeedSlider');
          if (el) el.style.display = val ? '' : 'none';
        })
      ),
      el('div', { id: 'scrollSpeedSlider', style: 'padding-left:12px;margin-top:4px;display:' + (scrollLongTitles ? '' : 'none') },
        el('div', { class: 'small', style: 'margin-bottom:4px' }, t('scrollTextSpeed')),
        el('div', { style: 'display:flex;align-items:center;gap:8px' },
          el('span', { class: 'small', style: 'color:var(--muted);width:60px;text-align:center' }, 'Slow'),
          el('input', {
            type: 'range', min: -2, max: 2, step: 1, value: scrollSpeed,
            style: 'flex:1',
            onInput: async (e) => {
              const val = parseInt(e.target.value, 10);
              await db.settings.put({ ...await db.settings.get(), scrollSpeed: val });
            }
          }),
          el('span', { class: 'small', style: 'color:var(--muted);width:60px;text-align:center' }, 'Fast')
        ),
        el('div', { style: 'display:flex;justify-content:space-between;padding:0 60px;font-size:11px;color:var(--muted)' },
          el('span', {}, '30'),
          el('span', {}, '45'),
          el('span', {}, '60'),
          el('span', {}, '75'),
          el('span', {}, '90')
        )
      )
    ]),

    // AI Assistant section
    buildCollapsibleSection(t('aiSettings'), [
      el('div', { class: 'row' },
        el('div', { class: 'small' }, t('aiEnable')),
        buildToggle(aiEnabled, async (val) => {
          await db.settings.put({ ...await db.settings.get(), aiEnabled: val });
          renderSettings(ctx);
        })
      ),
      aiEnabled ? el('div', { class: 'stack', style: { gap: '10px', marginTop: '8px' } },
        // Provider selector
        el('label', { class: 'label' },
          el('span', {}, t('aiProvider')),
          buildProviderSelect(aiProvider, (newProvider) => {
            const info = AI_PROVIDERS[newProvider];
            const endpointEl = document.getElementById('aiEndpoint');
            const modelEl = document.getElementById('aiModel');
            if (endpointEl && info) endpointEl.value = info.endpoint;
            if (modelEl && info) modelEl.value = info.model;
            // Save provider change
            db.settings.get().then(s => {
              s.aiProvider = newProvider;
              if (info) {
                s.aiEndpoint = info.endpoint;
                s.aiModel = info.model;
              }
              db.settings.put(s);
            });
          })
        ),
        // Endpoint
        el('label', { class: 'label' },
          el('span', {}, t('aiEndpoint')),
          el('input', {
            id: 'aiEndpoint',
            class: 'input',
            type: 'text',
            value: aiEndpoint,
            placeholder: 'https://api.deepseek.com/v1',
            onBlur: async (e) => {
              await db.settings.put({ ...await db.settings.get(), aiEndpoint: e.target.value });
            }
          })
        ),
        // API Key
        el('label', { class: 'label' },
          el('span', {}, t('aiApiKey')),
          el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            el('input', {
              id: 'aiApiKey',
              class: 'input',
              type: 'password',
              style: { flex: '1' },
              value: aiApiKey,
              placeholder: 'sk-...',
              onBlur: async (e) => {
                await db.settings.put({ ...await db.settings.get(), aiApiKey: e.target.value });
              }
            }),
            el('button', {
              id: 'aiVerifyBtn',
              type: 'button',
              class: 'btn',
              style: { flexShrink: '0' },
              onClick: async (e) => {
                const btn = e.target;
                const origText = btn.textContent;
                btn.textContent = t('aiVerifying');
                btn.disabled = true;
                const s = await db.settings.get();
                const result = await verifyConnection(s);
                btn.textContent = origText;
                btn.disabled = false;
                showToast(result.ok ? t('aiVerified') : (t('aiVerifyFailed') + ': ' + result.message));
              }
            }, t('aiVerify'))
          )
        ),
        // Model
        el('label', { class: 'label' },
          el('span', {}, t('aiModel')),
          el('input', {
            id: 'aiModel',
            class: 'input',
            type: 'text',
            value: aiModel,
            placeholder: 'deepseek-chat',
            onBlur: async (e) => {
              await db.settings.put({ ...await db.settings.get(), aiModel: e.target.value });
            }
          })
        ),
        // Sign-up help box
        buildSignupHelp(aiProvider),
        // Advanced: Custom prompt
        el('div', { class: 'row', style: { marginTop: '8px' } },
          el('div', { class: 'small' }, t('aiQuickVoice')),
          buildToggle(quickVoiceAdd, async (val) => {
            await db.settings.put({ ...await db.settings.get(), quickVoiceAdd: val });
          })
        ),
        el('div', { class: 'small', style: { color: 'var(--muted)' } }, t('aiQuickVoiceDesc')),
        el('details', { style: { marginTop: '8px' } },
          el('summary', { class: 'small', style: { cursor: 'pointer', color: 'var(--muted)' } }, t('aiSystemPrompt')),
          el('textarea', {
            class: 'input',
            style: { width: '100%', minHeight: '60px', marginTop: '8px', padding: '8px', borderRadius: '8px', boxSizing: 'border-box' },
            placeholder: 'Optional: customize how the AI parses your requests',
            onBlur: async (e) => {
              await db.settings.put({ ...await db.settings.get(), aiSystemPrompt: e.target.value });
            }
          }, aiSystemPrompt)
        )
      ) : null
    ]),
    buildCollapsibleSection(t('theme'), [
      el('div', { style: 'display:flex;flex-direction:column;gap:10px' },
        themePicker,
        paletteSwatches
      )
    ]),
    el('div', { class: 'card stack', style: { padding: '8px 12px' } },
      el('div', { style: { fontWeight: '600', fontSize: '14px' } }, t('help')),
      helpBtn
    ),
    buildCollapsibleSection(t('dataManagement'), [
      el('div', { class: 'small' }, t('dataStoredLocally')),
      el('div', { class: 'row' },
        el('div', { class: 'small' }, t('compressImages')),
        compressToggle
      ),
      el('div', { class: 'row' },
        el('div', { class: 'small' }, t('extraCompressArchive')),
        compressArchiveToggle
      ),
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
        exportBtn,
        importBtn,
        pasteSharedBtn,
        binBtn,
        resetStatsBtn,
        resetBtn
      )
    ]),
    el('div', { class: 'card stack', style: { padding: '8px 12px' } },
      el('div', { style: { fontWeight: '600', fontSize: '14px' } }, t('updateCheck') || 'App Updates'),
      checkUpdateBtn,
      statusEl
    )
  ));

  async function openPasteSharedModal() {
    const ta = el('textarea', { rows: 10, class: 'input', placeholder: 'Paste shared JSON here' });
    openModal(modalHost, {
      title: 'Paste shared task or project',
      content: el('div', { class: 'stack' }, el('div', { class: 'small' }, 'Paste the JSON blob shared from another user.'), ta),
      actions: [
        { label: 'Cancel', class: 'btn btn--ghost', onClick: () => true },
        { label: 'Import', class: 'btn btn--primary', onClick: async () => {
          const text = (ta.value || '').trim();
          if (!text) return false;
          let parsed;
          try { parsed = JSON.parse(text); } catch (e) {
            openModal(modalHost, { title: 'Invalid JSON', content: el('div', { class: 'small' }, 'The pasted text is not valid JSON.'), actions: [{ label: 'OK', class: 'btn btn--primary', onClick: () => true }] });
            return false;
          }
          try {
            const { importShared } = await import('../utils/share.js');
            const res = await importShared(parsed, db);
            showToast('Imported ' + res.type);
            // Navigate to appropriate page
            if (res.type === 'todo') location.hash = '#inbox';
            if (res.type === 'project') location.hash = '#projects';
            return true;
          } catch (err) {
            console.error('Import failed', err);
            openModal(modalHost, { title: 'Import failed', content: el('div', { class: 'small' }, String(err)), actions: [{ label: 'OK', class: 'btn btn--primary', onClick: () => true }] });
            return false;
          }
        } }
      ]
    });
  }

  async function openSuggestionHistoryModal() {
    let suggestions = [];
    try {
      suggestions = await db.checklistSuggestions.list();
      // Sort alphabetically, case-insensitive
      suggestions.sort((a, b) => a.text.localeCompare(b.text, undefined, { sensitivity: 'base' }));
    } catch (err) {
      console.error(err);
    }

    const listEl = el('div', { class: 'suggestion-history-list' });
    const emptyState = el('div', { class: 'suggestion-history-empty small' }, t('noSuggestionsYet') || 'No suggestions stored yet');

    const renderList = () => {
      clear(listEl);
      if (!suggestions.length) {
        listEl.append(emptyState);
        return;
      }
      for (const item of suggestions) {
        const row = el('div', { class: 'suggestion-history-item' },
          el('div', { class: 'suggestion-history-text' }, item.text),
          el('button', {
            class: 'btn btn--ghost suggestion-history-delete',
            type: 'button',
            onClick: async () => {
              try {
                await db.checklistSuggestions.delete(item.id);
                suggestions = suggestions.filter((s) => s.id !== item.id);
                renderList();
              } catch (err) {
                showToast(t('error') || 'Error');
                console.error(err);
              }
            }
          }, '✕')
        );
        listEl.append(row);
      }
    };

    const modalContent = el('div', { class: 'stack suggestion-history' },
      el('div', { class: 'small' }, t('manageSuggestionHistory') || 'Review and clear saved checklist suggestions'),
      listEl
    );

    renderList();

    openModal(modalHost, {
      title: t('clearSuggestionHistory') || 'Clear suggestion history',
      content: modalContent,
      actions: [
        { label: t('cancel'), class: 'btn btn--ghost', onClick: () => true },
        {
          label: t('clearAll') || 'Clear All',
          class: 'btn btn--danger',
          onClick: async () => {
            const ok = await confirm(modalHost, {
              title: t('clearSuggestionHistory') || 'Clear suggestion history',
              message: t('confirmClearSuggestions') || 'Clear all saved suggestions?',
              confirmLabel: t('clearAll') || 'Clear All',
              danger: true
            });
            if (!ok) return false;
            try {
              await db.checklistSuggestions.clear();
              showToast(t('suggestionHistoryCleared') || 'Suggestion history cleared');
              return true;
            } catch (err) {
              showToast(t('error') || 'Error');
              console.error(err);
              return false;
            }
          }
        }
      ]
    });
  }

  async function exportData() {
    const projects = await db.projects.list();
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      projects,
      todos: [...(await db.todos.listActive()), ...(await db.todos.listArchived())],
      checklistPages: await db.checklistPages.list(),
      checklistSuggestions: await db.checklistSuggestions.list(),
      settings: await db.settings.get(),
      attachments: [],
      projectNotes: [],
      voiceMemos: []
    };

    // Gather all project notes so they are included in the export (covers edge cases)
    try {
      const allNotes = await db.projectNotes.list();
      if (allNotes && allNotes.length) payload.projectNotes.push(...allNotes);
    } catch (e) {
      // If projectNotes store is missing on older DB versions, skip gracefully
    }

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

    // Include voice memos in export (convert audio blobs to data URLs)
    payload.voiceMemos = [];
    try {
      const allMemos = await db.voiceMemos.list();
      for (const m of allMemos) {
        const memoData = {
          id: m.id,
          title: m.title,
          projectId: m.projectId,
          duration: m.duration,
          showInInbox: m.showInInbox,
          order: m.order,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
          dataUrl: m.blob ? await blobToDataUrl(m.blob) : null
        };
        payload.voiceMemos.push(memoData);
      }
    } catch (e) {
      // Voice memos store might not exist on older DB versions; skip gracefully
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
    const fileInput = el('input', { type: 'file', accept: 'application/json', 'aria-label': t('importJSON'), style: { display: 'none' } });
    const fileButton = el('button', { type: 'button', class: 'btn btn--primary', style: { padding: '0.75rem 1.5rem' } }, t('chooseFile'));
    const fileStatusLabel = el('span', { style: { marginLeft: '1rem' } }, t('noFilesSelected'));
    const fileInputWrapper = el('div', { style: { display: 'flex', alignItems: 'center', width: '100%' } }, fileButton, fileStatusLabel);
    
    fileButton.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      const fileCount = fileInput.files?.length || 0;
      if (fileCount === 0) {
        fileStatusLabel.textContent = t('noFilesSelected');
      } else if (fileCount === 1) {
        fileStatusLabel.textContent = t('fileSelected', { n: 1 });
      } else {
        fileStatusLabel.textContent = t('filesSelected', { n: fileCount });
      }
    });

    const content = el('div', { class: 'stack' },
      el('div', { class: 'small' }, t('importWarning')),
      fileInputWrapper
    );

    openModal(modalHost, {
      title: t('importJSON'),
      content,
      actions: [
        { label: t('cancel'), class: 'btn btn--ghost', onClick: () => true },
        {
          label: t('importData'),
          class: 'btn btn--primary',
          onClick: async () => {
            const f = (fileInput.files || [])[0];
            if (!f) return false;

            const ok = await confirm(modalHost, {
              title: t('confirmImport'),
              message: t('confirmImportMsg'),
              confirmLabel: t('importData'),
              danger: true
            });
            if (!ok) return false;

            const text = await f.text();
            let parsed;
            try {
              parsed = JSON.parse(text);
            } catch {
              openModal(modalHost, {
                title: t('invalidJSON'),
                content: el('div', { class: 'small' }, t('invalidJSONMsg')),
                actions: [{ label: t('ok'), class: 'btn btn--primary', onClick: () => true }]
              });
              return false;
            }

            await db.wipeAll();

            for (const p of (parsed.projects || [])) await db.projects.put(p);
            for (const t of (parsed.todos || [])) await db.todos.put(t);
            for (const page of (parsed.checklistPages || [])) await db.checklistPages.put(page);
            if (parsed.settings) await db.settings.put(parsed.settings);

            // Restore project notes if present in the export (backward compatible)
            for (const note of (parsed.projectNotes || [])) {
              try {
                await db.projectNotes.put(note);
              } catch (e) {
                // If projectNotes store doesn't exist on this runtime, skip restoring notes
              }
            }

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

            // Restore voice memos if present in the export
            for (const m of (parsed.voiceMemos || [])) {
              if (!m.dataUrl) continue;
              try {
                const blob = await dataUrlToBlob(m.dataUrl);
                await db.voiceMemos.put({
                  id: m.id,
                  title: m.title,
                  projectId: m.projectId,
                  duration: m.duration,
                  showInInbox: m.showInInbox,
                  order: m.order,
                  createdAt: m.createdAt,
                  updatedAt: m.updatedAt,
                  blob
                });
              } catch (e) {
                // Skip memo if blob conversion fails
              }
            }

            // Restore checklist suggestions if present in the export
            for (const s of (parsed.checklistSuggestions || [])) {
              try { await db.checklistSuggestions.put(s); } catch (e) { /* skip */ }
            }

            // Refresh current screen
            location.hash = '#settings';
            return true;
          }
        }
      ]
    });
  }

  let openSection = null; // accordion: tracks the currently open contentEl
  function buildCollapsibleSection(title, children, startOpen, contentStyle) {
    const contentEl = el('div', { style: { display: startOpen ? '' : 'none', marginTop: '6px', ...(contentStyle || {}) } }, ...children);
    const chevron = el('span', { style: { fontSize: '9px', transition: 'transform 200ms', flexShrink: 0 } }, startOpen ? '▼' : '▶');
    const titleRow = el('div', { style: { fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none' } },
      chevron, title
    );
    titleRow.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = contentEl.style.display !== 'none';
      if (isOpen) {
        // Close this section
        contentEl.style.display = 'none';
        chevron.textContent = '▶';
        if (openSection === contentEl) openSection = null;
      } else {
        // Close previously open section if any
        if (openSection && openSection !== contentEl) {
          openSection.style.display = 'none';
          // Find its chevron and reset
          const parentCard = openSection.parentElement;
          if (parentCard) {
            const prevChevron = parentCard.querySelector('span');
            if (prevChevron) prevChevron.textContent = '▶';
          }
        }
        // Open this section
        contentEl.style.display = '';
        chevron.textContent = '▼';
        openSection = contentEl;
      }
    });
    return el('div', { class: 'card stack', style: { padding: '8px 12px' } }, titleRow, contentEl);
  }

  function buildToggle(checked, onChange) {
    const input = el('input', {
      type: 'checkbox',
      checked: checked ? 'checked' : null,
      'aria-label': 'Toggle'
    });
    input.addEventListener('change', () => onChange(input.checked));
    return input;
  }

  function buildProviderSelect(current, onChange) {
    const select = el('select', {
      class: 'select',
      'aria-label': t('aiProvider'),
      onChange: (e) => onChange(e.target.value)
    });
    for (const [key, info] of Object.entries(AI_PROVIDERS)) {
      select.append(el('option', {
        value: key,
        selected: key === current ? 'selected' : null
      }, info.label + ' — ' + info.desc));
    }
    // Add custom option
    select.append(el('option', {
      value: 'custom',
      selected: !AI_PROVIDERS[current] ? 'selected' : null
    }, 'Custom'));
    return select;
  }

  function buildSignupHelp(provider) {
    const info = AI_PROVIDERS[provider];
    if (!info) {
      // Custom provider — no signup help available
      return el('div', { class: 'small', style: { color: 'var(--muted)', marginTop: '8px', padding: '10px', background: 'var(--card)', borderRadius: '8px' } },
        t('aiNeedKey')
      );
    }
    return el('div', { class: 'stack', style: { gap: '6px', marginTop: '8px', padding: '12px', background: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)' } },
      el('div', { style: { fontWeight: '500', fontSize: '13px' } }, t('aiNeedKey')),
      el('div', { class: 'small' }, t('aiSignupStep1', { url: info.signupUrl })),
      el('div', { class: 'small' }, t('aiSignupStep2')),
      el('div', { class: 'small' }, t('aiSignupStep3')),
      el('div', { class: 'small' }, t('aiSignupStep4')),
      el('button', {
        type: 'button',
        class: 'btn',
        style: { marginTop: '4px', alignSelf: 'flex-start' },
        onClick: () => window.open(info.signupUrl, '_blank', 'noopener')
      }, t('aiOpenSite'))
    );
  }

  async function resetStats() {
    const ok = await confirm(modalHost, {
      title: t('resetStats') || 'Reset statistics',
      message: 'This will clear all statistics data. Your tasks and projects will not be affected.',
      confirmLabel: t('resetStats') || 'Reset',
      danger: true
    });
    if (!ok) return;
    await db.settings.put({ ...await db.settings.get(), statsResetDate: new Date().toISOString() });
    showToast(t('statsReset') || 'Statistics reset');
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
