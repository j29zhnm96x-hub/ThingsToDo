# ThingsToDo — Codebase Mind Map

> **Type:** Mobile-first, offline-first vanilla SPA PWA  
> **Language:** JavaScript (ES Modules), CSS3, HTML5  
> **Framework:** None (zero dependencies)  
> **Storage:** IndexedDB (local-only, no backend)  
> **Deployment:** Cloudflare Workers (static assets)

---

## 1. Project Tree

```
ThingsToDo/
│
├── index.html                  ← SPA shell: topbar, <main>, bottom tab bar, #modalHost
├── manifest.webmanifest        ← PWA manifest (standalone, icons)
├── sw.js                       ← Service worker (cache-first + network-first)
├── wrangler.jsonc              ← Cloudflare Workers config
├── README.md                   ← Project docs
├── .gitattributes
│
├── assets/                     ← Icons (PNG, SVG) and asset notes
│
├── .vscode/
│   ├── settings.json
│   └── tasks.json
│
├── scripts/
│   └── send-push.js            ← Push notification template script (Node.js)
│
└── src/
    ├── main.js                 ← Entry point: register SW → init app
    ├── styles.css              ← All styles (~2458 lines, CSS custom properties)
    │
    └── modules/
        ├── app.js              ← App orchestrator, route↔screen mapping, ctx DI
        ├── router.js           ← Minimal hash-based router
        ├── notifications.js    ← Push subscription + scheduling
        │
        ├── data/
        │   ├── db.js           ← IndexedDB layer (8 stores, v10)
        │   ├── idb.js          ← Lightweight IndexedDB helpers
        │   └── models.js       ← Data factories (todo, project, etc.)
        │
        ├── logic/
        │   ├── todoOps.js      ← CRUD: move, archive, complete, bin, restore
        │   ├── attachments.js  ← Image compression on archive
        │   ├── sorting.js      ← Priority + manual order sorting
        │   └── recurrence.js   ← Daily/weekly/monthly/yearly engine
        │
        ├── screens/
        │   ├── inbox.js        ← Inbox view: tasks, linked projects, voice memos
        │   ├── projects.js     ← Project list + creation modal
        │   ├── projectDetail.js← Project detail (~2362 lines, default + checklist)
        │   ├── archive.js      ← Archived todos by date with collapse
        │   ├── settings.js     ← Settings: theme, lang, export/import, bin
        │   └── help.js         ← Feature documentation
        │
        ├── ui/
        │   ├── dom.js          ← el() hyperscript, clear(), date formatting
        │   ├── modal.js        ← Modal system (bottom sheet, focus trap)
        │   ├── confirm.js      ← Confirmation dialog
        │   ├── toast.js        ← Toast notifications
        │   ├── todoList.js     ← Todo list with drag reorder + priority buckets
        │   ├── todoEditor.js   ← Create/edit todo modal (full editor)
        │   ├── todoInfo.js     ← Todo detail viewer + image gallery
        │   ├── todoMenu.js     ← Todo action menu ("...")
        │   ├── projectCard.js  ← Project card with progress bar
        │   ├── projectMenu.js  ← Project actions (edit, share, link, move, delete)
        │   ├── pickProject.js  ← Project picker modal
        │   ├── bulkAdd.js      ← Bulk add modal + text parsers
        │   ├── pillReorder.js  ← Checklist page pill drag reorder
        │   ├── binModal.js     ← Recently deleted modal
        │   ├── voiceMemo.js    ← Recording, playback, waveform (~957 lines)
        │   ├── haptic.js       ← Vibration API wrappers
        │   └── theme.js        ← Theme/palette via data attributes
        │
        └── utils/
            ├── i18n.js         ← 5 languages, ~350 keys each (~1918 lines)
            ├── share.js        ← Export/import todo/project as JSON
            └── image.js        ← Canvas-based image compression + thumbnails
```

---

## 2. Architecture & Data Flow

```
User Action
    │
    ▼
Event Handler  ───→  logic/function  ───→  db.* API (IndexedDB)
    │                                            │
    └────────────────  router.refresh()  ←───────┘
                              │
                              ▼
                    Screen re-render (reads fresh from DB)
```

- **No framework** — vanilla ES modules served directly (no build step).
- **No global state** — everything lives in IndexedDB; UI reads fresh on each render.
- **`ctx` object** — passed as lightweight dependency injection (`{ main, db, modalHost, topbarTitle, topbarActions }`).
- **DOM rendering** — custom `el(tag, props, ...children)` hyperscript, full re-render per navigation.

---

## 3. Routes (Hash-based)

| Hash              | Screen            | Group      |
|-------------------|-------------------|------------|
| `#inbox`          | Inbox             | inbox      |
| `#projects`       | Projects list     | projects   |
| `#project/<id>`   | Project detail    | projects   |
| `#archive`        | Archive           | archive    |
| `#settings`       | Settings          | settings   |
| `#help`           | Help              | settings   |

Router: `src/modules/router.js` — listens to `hashchange`, parses hash, calls screen renderer.

---

## 4. Database Schema (IndexedDB: `thingstodo-db` v10)

### Store: `todos`
| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| title | string | |
| notes | string | |
| priority | 'URGENT'\|'P0'\|'P1'\|'P2'\|'P3' | |
| dueDate | ISO string\|null | |
| completed | boolean | |
| completedAt | ISO string\|null | |
| projectId | string\|null | Inbox = `__inbox__` sentinel |
| pageId | UUID\|null | Checklist page |
| archived | boolean | |
| order | number | Manual sort within priority |
| recurrenceType | 'daily'\|'weekly'\|'monthly'\|'yearly'\|null | |
| seriesId | UUID\|null | Links recurring instances |
| protected | boolean | |
| createdAt / updatedAt | ISO string | |
| *Indexes* | `by_archived`, `by_project` | |

### Store: `projects`
| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | string | |
| type | 'default'\|'checklist' | |
| parentId | UUID\|null | Sub-projects |
| showInInbox | boolean | |
| useSuggestions | boolean | Checklist autocomplete |
| enableQtyUnits | boolean | Quantity/units support |
| protected | boolean | |
| sortOrder | number\|string | Manual order |

### Store: `attachments`
| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| todoId | UUID | FK → todos |
| blob | Blob | Binary image |
| thumb | Blob\|null | Thumbnail |
| *Index* | `by_todo` | |

### Store: `settings` (singleton, id=`"settings"`)
| Field | Type |
|---|---|
| theme | 'dark'\|'light' |
| themePalette | 'default'\|'purple'\|'orange'\|'red'\|'blue' |
| compressImages / compressArchivedImages | boolean |
| voiceQuality | 'low'\|'high' |

### Store: `bin` — same schema as `todos` + `deletedAt`

### Store: `voiceMemos`
| Field | Type |
|---|---|
| id | UUID |
| title, blob, duration | string, Blob, number |
| projectId | UUID\|null |
| showInInbox | boolean |
| *Index* | `by_project` |

### Store: `checklistPages`
| Field | Type |
|---|---|
| id | UUID |
| projectId | UUID |
| name, order | string, number |
| *Index* | `by_project` |

### Store: `checklistSuggestions` (auto-increment PK)
| Field | Type |
|---|---|
| text, textLower, createdAt | string, string, ISO |
| *Index* | `by_textLower` (unique) |

### Store: `projectNotes`
| Field | Type |
|---|---|
| id | UUID |
| projectId | UUID |
| text, xPct, yPct | string, number, number |
| *Index* | `by_project` |

---

## 5. Key Modules

### Data Layer (`src/modules/data/`)
- **`db.js`** — Main DB interface. Opens `thingstodo-db` v10, creates all stores + indexes, exposes `db.todos.*`, `db.projects.*`, etc.
- **`idb.js`** — Low-level helpers: `openDb()`, `storeApi()`, `txDone()`, `reqDone()`.
- **`models.js`** — Factory functions: `newTodo()`, `newProject()`, `newAttachment()`, `newVoiceMemo()`, `newChecklistPage()`, `newProjectNote()`. Also `Priority` enum, `generateId()`, `uuid()`.

### Logic Layer (`src/modules/logic/`)
- **`todoOps.js`** — `moveTodo()`, `restoreTodo()`, `completeTodo()`, `uncompleteTodo()`, `recycleTodos()` (→bin), `restoreFromBin()`, `autoArchiveCompleted()` (24h rule), `autoEmptyBin()` (24h rule), `getAllTodosForProject()` (recursive).
- **`recurrence.js`** — Full recurrence engine: `calculateNextDueDate()`, `createNextRecurringInstance()`, `endRecurringSeries()`, `hasRecurrenceEnded()`, `isDueToday()`, `getRecurrenceDescription()`.
- **`sorting.js`** — `compareTodos()` (priority rank → order → createdAt), `maxOrderFor()`.
- **`attachments.js`** — `compressAttachmentsForArchive()` — aggressive compression on archive.

### UI Layer (`src/modules/ui/`)
- **`dom.js`** — `el(tag, props, ...children)` (hyperscript), `clear()`, `emptyState()`, `humanDue()`, date helpers.
- **`modal.js`** — `openModal()` — bottom-sheet style, keyboard focus trap, backdrop dismiss.
- **`todoList.js`** — Renders full todo list with priority buckets, drag reorder, completed collapsible section, due-date tags, recurring/link/protected icons.
- **`todoEditor.js`** — Full create/edit modal: title, notes, priority, due date, recurrence config, protected toggle, image attachments.
- **`todoInfo.js`** — Detail viewer: priority badge, notes, image gallery with pinch-zoom/swipe.
- **`voiceMemo.js`** (~957 lines) — MediaRecorder-based recording with canvas waveform, pause/resume, playback with speed control (0.5×–2.0×), share/download.
- **`pillReorder.js`** — Long-press drag reorder for checklist page pills.
- **`binModal.js`** — Shows recently deleted items with restore.
- **`bulkAdd.js`** — Textarea-based bulk add with newline/comma parsing + optional page name extraction.

### Screens (`src/modules/screens/`)
- **`inbox.js`** — Shows inbox todos + tasks due within 3 days + linked projects + voice memos.
- **`projects.js`** — Project list with progress bars, drag reorder, creation modal.
- **`projectDetail.js`** (~2362 lines, largest file) — Dual-mode: **default** (sub-projects + todos + notes + voice memos) and **checklist** (multi-page with pill tabs, drag-reorder items, swipe-delete, suggestions autocomplete, qty/units, focus mode).
- **`archive.js`** — Archived todos date-grouped, collapsible dividers, long-press delete group.
- **`settings.js`** — Language (5), theme + palette (5), voice quality, compression toggles, suggestion mgmt, export/import JSON, bin, help, reset.
- **`help.js`** — 14 sections of translatable feature documentation.

### Utilities (`src/modules/utils/`)
- **`i18n.js`** (~1918 lines) — 5 languages: en, hr, it, de, es. `t(key, params)` with `{n}` interpolation. Persisted in localStorage.
- **`share.js`** — `exportTodoToFile()`, `exportProjectToFile()`, `importShared()`, `importSharedObject()` — JSON with data URLs for attachments.
- **`image.js`** — `compressImageBlob()`, `createThumbnailBlob()` — canvas-based.

---

## 6. Config Files

| File | Purpose |
|---|---|
| `wrangler.jsonc` | Cloudflare Workers deployment |
| `manifest.webmanifest` | PWA manifest |
| `.vscode/settings.json` | Editor settings |
| `.vscode/tasks.json` | VS Code CSS task |
| `.gitattributes` | Git line endings |

---

## 7. Dependencies

**Runtime:** None (zero npm packages). Pure vanilla JS using browser APIs:
- IndexedDB, Cache API, Push/Notification API, MediaRecorder, Web Audio, Web Share, Vibration, FileReader

**Dev only:** `@kilocode/plugin` (AI assistant, in `.kilo/`)

---

## 8. Build & Deploy

- **No build step** — source is served directly (ES modules).
- **Dev:** `python -m http.server 5173` or `npx serve .`
- **Deploy:** `wrangler deploy` → Cloudflare Workers (static assets)
- **Service worker** (`sw.js`) pre-caches app shell, uses network-first for JS, cache-first for assets.

---

## 9. Feature Summary

| Feature | Location |
|---|---|
| Task CRUD | `logic/todoOps.js`, `ui/todoEditor.js`, `screens/inbox.js` |
| Recurrence (daily/weekly/monthly/yearly) | `logic/recurrence.js` |
| Projects (default + checklist) | `screens/projects.js`, `screens/projectDetail.js` |
| Checklist pages + pill nav | `screens/projectDetail.js`, `ui/pillReorder.js` |
| Voice memos (record/playback/share) | `ui/voiceMemo.js` |
| Image attachments + compression | `ui/todoEditor.js`, `logic/attachments.js`, `utils/image.js` |
| Archive (24h auto-archive) | `screens/archive.js`, `logic/todoOps.js` |
| Bin (24h soft-delete) | `ui/binModal.js`, `logic/todoOps.js` |
| Drag reorder (todos, projects, pages, pills) | `ui/todoList.js`, `ui/pillReorder.js`, `screens/projects.js`, `screens/projectDetail.js` |
| Bulk add | `ui/bulkAdd.js` |
| Push notifications | `modules/notifications.js`, `sw.js`, `scripts/send-push.js` |
| Themes + palettes (5 colors) | `ui/theme.js`, `screens/settings.js` |
| i18n (5 languages) | `utils/i18n.js` |
| Export/Import (JSON with data URLs) | `utils/share.js` |
| Offline PWA | `sw.js`, `manifest.webmanifest` |
| Haptic feedback | `ui/haptic.js` |

---

## 10. Notes

- **No tests** exist in the codebase.
- **No TypeScript** — all plain JS.
- The app is fully client-side with no backend API. Cloudflare Workers only serves static files.
- Safari IndexedDB compatibility workaround: inbox `projectId` uses sentinel `__inbox__` instead of `null`.
- Auto-archive and auto-empty-bin run on every navigation (24h threshold).
