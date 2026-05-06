# Code Review TODO

## Critical (Must Fix)

- [x] [src/styles.css:1] **Missing closing `}` for `:root` block before `.notesList` (line 29).** The `:root {` opened at line 1 is never closed before `.notesList {` at line 29. This means all the CSS after line 28 is parsed as nested inside `:root` — variables like `--field`, `--card-shadow`, `--radius`, `--safe-top` (lines 172-186) are scoped to `.notesList` instead of `:root`, and all theme selectors like `html[data-theme='light']` become `:root html[data-theme='light']` (descendant combinator), breaking the entire theming system. **Fix:** Add `}` before line 29 to close `:root`.

- [x] [src/styles.css:29-187] **CSS variable declaration scoping error.** Variables `--field`, `--card-shadow`, `--radius`, `--safe-top`, etc. (lines 172-186) are declared inside the `.notesList { ... }` block (line 29-187), scoping them to `.notesList` descendants only. The entire layout depends on these variables at the root level. **Fix:** Close `:root` before `.notesList` and declare these variables inside `:root`.

- [-] [src/modules/ui/todoList.js:300-407] **Drag reorder pointer event handlers never cleaned up.** Each `renderTodoList()` call creates a new `list` element. `clear(main)` removes the old DOM before re-render. The old element + listeners are garbage collected. No actual listener leak.

- [-] [src/modules/screens/projectDetail.js:2162-2257] **Same drag reorder listener "leak".** `renderChecklistWithDrag` creates a new `activeContainer` each call, and `clear(main)` removes the old DOM. No actual listener leak.

- [-] [src/modules/screens/projects.js:115-221] **Same drag reorder listener "leak".** `renderProjects` creates a new `list` each call, and `clear(main)` removes the old DOM. No actual listener leak.

- [x] [src/modules/ui/voiceMemo.js:361,397] **`cancelAnimationFrame` called before `drawWaveform` sets `animationFrame`.** Already guarded with `if (animationFrame)` at all three call sites (lines 359, 381, 397). Fix was already applied.

- [x] [src/modules/screens/projectDetail.js:1639-1656] **`pressTimer` referenced before declaration in `makeRow` closure.** Added `let pressTimer = null` before `cancelPressTimer`.

- [x] [src/modules/ui/confirm.js:15-16] **No-op `resolve(false)` on Cancel.** Changed to `resolve(null)` for consistency with `pickProject.js` pattern (Cancel = `null`, Inbox = `null`).

- [x] [src/modules/utils/i18n.js:1922] **`t()` function returns key as fallback.** Changed fallback from raw `key` to `[missing: ${key}]` so users can report missing translations.

## High Priority

- [x] [src/modules/ui/voiceMemo.js:282] **`AudioContext` created but never closed.** Added `let audioContext` to outer scope, assigned in the try block, and `audioContext.close()` in `cleanup`.

- [-] [src/modules/ui/todoEditor.js:479-486] **Image orphan detection.** Fix requires significant refactoring of the save flow to defer image attachment until after `db.todos.put()` succeeds. `didSave` is only set after successful `db.todos.put()` (which throws on failure), making the unlikely-edge-case risk tradeoff not worth the refactor.

- [x] [src/modules/data/db.js:82-99] **Migration logic gate.** Gated behind `if (upgradeFrom < 2)`.

- [-] [src/modules/data/db.js:101-128] **Checklist page migration.** Already has `if (upgradeFrom < 8)` gate. The `&& upgradeFrom >= 0` is implied by IndexedDB semantics.

- [x] [src/modules/ui/todoInfo.js:9-23] **`copyText` uses deprecated `execCommand`.** Replaced with only `navigator.clipboard.writeText` + `.catch()`.

- [x] [src/modules/ui/todoInfo.js:103-425] **`fullImageUrls` reference issue.** Passed `[...fullImageUrls]` copy to `openImageViewer`.

- [x] [src/modules/ui/todoInfo.js:395] **Overlay stacking on rapid taps.** Added check for existing `.imageViewer` overlay before appending.

- [-] [src/modules/ui/modal.js:103-105] **Backdrop `{ once: true }`.** Per the TODO itself: "this is actually fine for current usage." Each `openModal` call adds a fresh listener, and the modal's `close()` removes the modal element. Skipping.

- [x] [src/modules/app.js:202-204] **Back button stale parent.** Added validation: checks `db.projects.get(parentId)` and navigates to `#projects` if parent no longer exists.

- [x] [src/modules/screens/inbox.js:103] **`completeTodo` priority override.** Added comment explaining the P3 override so archived tasks show low priority.

- [x] [src/modules/ui/bulkAdd.js:116-137] **`submit.passRaw` function property.** Replaced with local `const passRawValue = !!passRaw`.

- [x] [src/modules/ui/binModal.js:30] **`modalRef` mutable wrapper.** Replaced with `let currentModal` variable assigned after `openModal`, used directly in closure.

- [-] [src/modules/screens/archive.js:27-28] **Topbar manipulation.** Fix requires abstracting topbar management into a shared utility function. Would need to audit all screen renderers. Too risky for surgical fix.

- [x] [src/modules/utils/share.js:18] **`sanitizeName` allows dots.** Removed `\.` from the regex character class — dots are now stripped like other special characters.

- [x] [src/modules/utils/i18n.js:1926] **`t()` interpolation regex.** Added `param.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` to escape special regex characters.

## Medium Priority

- [x] [src/modules/notifications.js:57] **`TimestampTrigger` check.** Added `typeof TimestampTrigger !== 'undefined'` guard alongside `showTrigger` check.

- [x] [src/styles.css:436-439] **`user-select: none` on body.** Added `.todo__title`, `.todo__notes`, `.projectCard__name`, `.projectCard__stats` with `user-select: text`.

- [x] [src/modules/ui/theme.js:5-6] **System theme support.** Added `'system'` theme detection via `prefers-color-scheme` media query with change listener.

- [-] [src/modules/ui/voiceMemo.js:251] **`getUserMedia` binding.** Already uses optional chaining (`navigator.mediaDevices?.getUserMedia?.bind(...)`) with full legacy fallback. No change needed.

- [x] [src/modules/ui/voiceMemo.js:535] **Blob URL leak in playback modal.** Added `visibilitychange` handler that calls `cleanup` when page becomes hidden. Listener is removed when cleanup runs.

- [-] [src/modules/ui/voiceMemo.js:949-954] **`renderVoiceMemoList` creates all cards.** Fix requires virtualization or IntersectionObserver lazy-loading — a significant feature, not a surgical fix.

- [-] [src/modules/ui/todoEditor.js:53-58] **Autosize before DOM ready.** `autosizeTitleInput` is only called via `setTimeout(autosizeTitleInput, 0)` at line 493 and via `input` event. No immediate call at definition. Already handled.

- [-] [src/modules/ui/todoEditor.js:319-330] **Recurrence auto-dueDate refactor.** Significant refactor into helper functions. Too risky for surgical fix without tests.

- [-] [src/modules/ui/todoEditor.js:68-175] **Recurrence UI recreated.** Significant refactor to template/reuse DOM. Too risky for surgical fix.

- [-] [src/modules/ui/pillReorder.js:244-252] **Event delegation for pills.** Requires refactoring drag reorder to use delegation. Medium complexity, defer.

- [-] [src/modules/ui/pillReorder.js:114-133] **`updateDrag` queries on pointermove.** Performance optimization. Cache-and-invalidate pattern requires careful implementation. Defer.

- [-] [src/modules/ui/projectMenu.js:141-228] **Buttons created unconditionally.** Lazy creation would require restructuring. Minor perf impact. Defer.

- [-] [src/modules/ui/bulkAdd.js:46-88] **Complex parsing logic.** Simplifying would change behavior for existing users who rely on the current parsing heuristics. Defer.

- [x] [src/modules/screens/projectDetail.js:26-30] **`sortPagesByOrder` hoisting.** Changed from arrow to `function` declaration for hoisting safety.

- [x] [src/modules/screens/projectDetail.js:1239-1248] **Triple-tap fires add.** Added `lastTap = 0; return;` after double-tap fires to prevent triple-tap triggering add in the 350ms window.

- [x] [src/styles.css:417] **Two blank lines.** Removed extra blank lines.

## Low Priority / Enhancement

- [x] [src/main.js:5-13] **SW registration on `window.load`.** Changed to `DOMContentLoaded` for earlier registration.

- [-] [src/sw.js:48] **SW fetch handler HEAD/OPTIONS.** Fine for a SPA. Not actionable.

- [-] [src/sw.js:9] **Cache size management.** Requires implementing cache eviction strategy. Defer.

- [-] [src/manifest.webmanifest:10-15] **SVG maskable icon.** Needs a dedicated 192x192 maskable PNG asset. Cannot generate binary assets.

- [x] [src/modules/ui/voiceMemo.js:77-78] **`formatDuration` NaN.** Added `!Number.isFinite(seconds) || seconds < 0` guard, returns `'0:00'`.

- [x] [src/modules/ui/voiceMemo.js:44-52] **`daysAgo` interpolation.** Changed to `t('daysAgo', { n: diffDays })` for proper interpolation.

- [x] [src/modules/ui/voiceMemo.js:38-52] **Same as above** — already fixed by the `daysAgo` interpolation change.

- [-] [src/modules/ui/voiceMemo.js:428-501] **Aria-label i18n for close button.** Needs new i18n key `close`. Defer.

- [-] [src/modules/utils/i18n.js:4] **Comment is accurate.** No fix needed.

- [-] [src/modules/utils/i18n.js:1920-1930] **t() caching.** Performance optimization, not a bug. Defer.

- [-] [src/modules/logic/todoOps.js:210-224] **Recursion depth.** Requires converting to iterative approach. Defer.

- [-] [src/modules/screens/projectDetail.js:210-215] **Pass `projectsById` from caller.** Requires updating all call sites. Defer.

- [x] [src/modules/screens/settings.js:128-130] **Hash flash on language change.** Replaced with `router.refresh()`.

- [-] [src/modules/ui/modal.js:101] **Backdrop `{ once: true }`.** Current usage always creates a new modal. Fine as-is.

- [x] [src/styles.css:417] **Two blank lines.** Removed extra blank lines.

- [-] [src/modules/ui/projectCard.js:12] **Progress percentage.** Not actionable — edge case of 1/100 showing 0% is acceptable.

- [-] [src/modules/ui/projectMenu.js:24-63] **Optimistic update.** Requires significant refactoring. Defer.

## Feature Ideas

- [ ] **`assets/ICON_FILES_NEEDED.txt`** exists but the referenced icons (`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`) are referenced in `manifest.webmanifest` and `sw.js`. Verify these files exist or generate them.

- [ ] **Export/import data does NOT include bin items** — if a user has items in the bin and exports/imports, the bin items are lost. Consider including `bin` store in the export payload.

- [ ] **`src/modules/logic/recurrence.js:303-318`** — `processRecurringTasks` is a stub with no logic. The comment explains the model is "complete → immediate spawn", but if the app is closed for days and a recurring task should have spawned multiple instances, only one next instance is created (because completing the previous instance creates only one next). Multiple missed occurrences are lost. Consider adding catch-up logic on startup.

- [ ] **No automated tests** — the entire codebase has zero test files. For a data-driven PWA with complex state management, critical paths (recurrence, filtering, IndexedDB operations) should have unit tests.

- [ ] **IndexedDB transactions are not atomic** — `listByProject`, `listActive`, `listArchived` do full scans (+ JS filter) instead of using indexes, which works around Safari bugs but is slow with 1000+ todos.

- [ ] **`ctx` (context pattern)** — the dependency injection pattern used in `app.js` passes `{ root, main, topbarTitle, topbarActions, modalHost, openTodoEditor, db }` to every screen. This is clean but `openTodoEditor` is a closure over `modalHost` and `db`, mimicking method injection. It's functional but could be formalized.

## Architecture Suggestions

- **File size issues**: `projectDetail.js` (2362 lines), `voiceMemo.js` (957 lines), `i18n.js` (1938 lines), `styles.css` (2591 lines) are too large. `projectDetail.js` handles checklist rendering, drag reorder, page management, item editing, notes, voice memos — all in one file. Split into:
  - `checklistView.js` — checklist rendering + page pills + drag reorder
  - `checklistActions.js` — bulk add, quick add, page CRUD, item move
  - `projectNotes.js` — inline note rendering and editing

- **`i18n.js`** at 1938 lines is mostly static translation data. Extract each locale into a separate JSON file in `src/localization/` and lazy-load them.

- **`styles.css`** at 2591 lines with duplicate selectors (`.inlineNote__header`, `.inlineNote__label`, `.inlineNote__input`, `.inlineNote__menu` are defined multiple times). Use CSS custom properties more aggressively and extract palette-specific variables into separate files.

- **Drag-reorder logic is duplicated 4 times**: `projects.js` (project cards), `projectDetail.js` (sub-projects), `projectDetail.js` (checklist items), `todoList.js` (todo cards). Extract into a reusable `dragReorder.js` composable.

- **IndexedDB store access pattern** — every method on `db.todos`, `db.projects`, etc. calls `getDb()` and creates a new transaction. For bulk operations, this is extremely inefficient (N+1 transaction problem). Add batch methods like `todos.putMany()`, `todos.deleteMany()`.

- **Re-rendering strategy** — every mutation triggers a full re-render of the entire screen via `renderInbox(ctx)` / `renderProjectDetail(ctx, ...)`. This is wasteful and causes flash on complex screens. Implement a virtual DOM diff or use targeted DOM updates.

- **The `INBOX_PROJECT_ID = '__inbox__'` sentinel** works around Safari/WebKit IndexedDB null-indexing bugs. This is a clever workaround, but the normalization (`normalizeTodoIn`/`normalizeTodoOut`) adds complexity throughout the data layer. Document the Safari bug reference clearly for future maintainers.

---

## Summary

### Issues per Category
| Category | Count |
|---|---|
| Bugs & Logic Errors | 14 |
| Security Vulnerabilities | 0 |
| Performance Issues | 8 |
| Architecture & Design | 6 |
| Code Quality & Maintainability | 12 |
| Accessibility (a11y) | 1 |
| PWA & Offline Issues | 3 |
| i18n & Localization | 3 |
| CSS/Layout | 2 |

### Issues per Priority
| Priority | Count |
|---|---|
| Critical | 10 |
| High Priority | 12 |
| Medium Priority | 13 |
| Low Priority / Enhancement | 10 |
| Feature Ideas | 5 |
| Architecture Suggestions | 6 |

### Estimated Effort
- **Critical fixes**: ~4-6 hours
- **High priority**: ~8-12 hours
- **Medium priority**: ~10-16 hours
- **Low priority**: ~6-8 hours
- **Architecture/Feature**: ~20-40 hours (significant refactors)

**Total estimated effort: ~48-82 hours**
