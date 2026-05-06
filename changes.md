# Change Log

## CR-001 — Fix CSS :root missing closing brace
- **System:** styles.css (theming)
- **Summary:** Added `}` to close `:root` before `.notesList`, wrapped orphaned CSS variable declarations in a new `:root` block. Fixes entire theming system.
- **Files:** src/styles.css
- **Reason:** Missing brace caused all theme selectors to be parsed inside `:root`, breaking cascade.
- **Risk:** Low — CSS-only change, restores intended selector structure.
- **Test:** Verify page renders with correct colors for both light/dark themes.

## CR-002 — Fix pressTimer implicit global in makeRow
- **System:** projectDetail.js
- **Summary:** Added `let pressTimer = null` declaration inside `makeRow` closure before `cancelPressTimer`. Previously `pressTimer` was an implicit global shared across all checklist rows.
- **Files:** src/modules/screens/projectDetail.js
- **Reason:** Multiple checklist rows sharing the same global timer caused incorrect long-press behavior.
- **Risk:** Low — adds local declaration, fixes scoping.
- **Test:** Long-press a checklist item to verify action menu appears, long-press another item simultaneously to verify no interference.

## CR-003 — Fix confirm.js resolve value
- **System:** confirm.js
- **Summary:** Changed Cancel button from `resolve(false)` to `resolve(null)` for consistency with pickProject.js pattern.
- **Files:** src/modules/ui/confirm.js
- **Reason:** `pickProject.js` resolves `undefined` on Cancel and `null` for Inbox. `confirm.js` resolving `false` was inconsistent.
- **Risk:** Low — callers check `if (!ok)` which treats both `false` and `null` as falsy.
- **Test:** Click Cancel on any confirm dialog — should close modal without action.

## CR-004 — Fix t() fallback key format
- **System:** i18n.js
- **Summary:** Changed `t()` fallback from raw `key` to `[missing: ${key}]` so users can report missing translations.
- **Files:** src/modules/utils/i18n.js
- **Reason:** Raw keys shown verbatim are hard to distinguish from actual text.
- **Risk:** Low — only affects missing key fallback path.
- **Test:** Set language to an incomplete locale and verify missing keys show `[missing: keyname]`.

## HP-001 — Close AudioContext in cleanup
- **System:** voiceMemo.js
- **Summary:** Added `let audioContext` to outer scope, assigned in the try block, and `audioContext.close()` in `cleanup`.
- **Files:** src/modules/ui/voiceMemo.js
- **Reason:** Each recording created a new AudioContext without closing, accumulating system audio threads.
- **Risk:** Low
- **Test:** Record multiple voice memos and verify AudioContext count doesn't increase.

## HP-002 — Gate DB migration behind upgradeFrom check
- **System:** db.js
- **Summary:** Wrapped null→INBOX_PROJECT_ID cursor migration in `if (upgradeFrom < 2)` so it only runs on v1→v2 upgrade.
- **Files:** src/modules/data/db.js
- **Reason:** Migration ran on EVERY upgrade, potentially re-processing already-migrated data.
- **Risk:** Low
- **Test:** Open the app and verify IndexedDB upgrade runs correctly.

## HP-003 — Replace deprecated execCommand('copy')
- **System:** todoInfo.js
- **Summary:** Replaced `document.execCommand('copy')` with only `navigator.clipboard.writeText`.
- **Files:** src/modules/ui/todoInfo.js
- **Reason:** execCommand is deprecated and can cause CSP issues.
- **Risk:** Low — fallback is the clipboard API which is widely supported.
- **Test:** Long-press a task title to copy text, verify clipboard content.

## HP-004 — Pass fresh copy of fullImageUrls to openImageViewer
- **System:** todoInfo.js
- **Summary:** Changed `openImageViewer(fullImageUrls, index)` to `openImageViewer([...fullImageUrls], index)`.
- **Files:** src/modules/ui/todoInfo.js
- **Reason:** Prevents stale array reference issues if the viewer is opened multiple times.
- **Risk:** Low
- **Test:** Open image viewer from todo info modal, verify images display correctly.

## HP-005 — Prevent overlay stacking in image viewer
- **System:** todoInfo.js
- **Summary:** Added check for existing `.imageViewer` overlay before appending new one.
- **Files:** src/modules/ui/todoInfo.js
- **Reason:** Rapid double-tap could create multiple overlays if closeViewer() wasn't called.
- **Risk:** Low
- **Test:** Rapidly tap images in todo info — only one overlay should appear.

## HP-006 — Validate parent project exists for back button
- **System:** app.js
- **Summary:** Added `db.projects.get(parentId)` check before navigating to parent project. Falls back to `#projects` if parent doesn't exist.
- **Files:** src/modules/app.js
- **Reason:** Back button could navigate to a deleted parent project, showing a broken page.
- **Risk:** Low
- **Test:** Navigate to a sub-project, delete its parent, click back — should go to projects list.

## HP-007 — Add comment explaining priority override on completion
- **System:** inbox.js
- **Summary:** Added comment explaining why `completeTodo` overrides priority to P3.
- **Files:** src/modules/screens/inbox.js
- **Reason:** The priority override on completion was undocumented and surprising.
- **Risk:** None — comment only
- **Test:** N/A

## HP-008 — Replace submit.passRaw with local boolean
- **System:** bulkAdd.js
- **Summary:** Changed `submit.passRaw = !!passRaw` function property to local `const passRawValue = !!passRaw`.
- **Files:** src/modules/ui/bulkAdd.js
- **Reason:** Function property pattern is unusual and confusing for maintainers.
- **Risk:** Low
- **Test:** Use bulk add in raw mode, verify text is submitted correctly.

## HP-009 — Restructure binModal modalRef pattern
- **System:** binModal.js
- **Summary:** Replaced `modalRef = {}; modalRef.current = modal` with `let currentModal` assigned after `openModal`, used directly in closure.
- **Files:** src/modules/ui/binModal.js
- **Reason:** Mutable object wrapper adds unnecessary complexity.
- **Risk:** Low
- **Test:** Open bin modal, restore an item — modal should close and re-open with updated list.

## HP-010 — Strip dots from sanitized names
- **System:** share.js
- **Summary:** Removed `\.` from the regex character class in `sanitizeName`.
- **Files:** src/modules/utils/share.js
- **Reason:** Dots could be used for extension spoofing in export filenames.
- **Risk:** Low
- **Test:** Export a task with dots in the name, verify filename has no dots.

## HP-011 — Escape regex special chars in t() interpolation
- **System:** i18n.js
- **Summary:** Added `param.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` before using param in `new RegExp`.
- **Files:** src/modules/utils/i18n.js
- **Reason:** Special regex characters in key names could break replacement.
- **Risk:** Low
- **Test:** Use `t()` with numeric params — interpolation should work correctly.

## MP-001 — Add TimestampTrigger existence check
- **System:** notifications.js
- **Summary:** Added `typeof TimestampTrigger !== 'undefined'` guard alongside `showTrigger` check.
- **Files:** src/modules/notifications.js
- **Reason:** `TimestampTrigger` global may not exist even if `showTrigger` is present.
- **Risk:** Low
- **Test:** N/A (feature detection only)

## MP-002 — Enable text selection on content elements
- **System:** styles.css
- **Summary:** Added `.todo__title`, `.todo__notes`, `.projectCard__name`, `.projectCard__stats` with `user-select: text`.
- **Files:** src/styles.css
- **Reason:** Body `user-select: none` blocked text selection on all content.
- **Risk:** Low
- **Test:** Try selecting text in todo titles and project card names — should be selectable.

## MP-003 — Add system theme support
- **System:** theme.js
- **Summary:** Added `'system'` theme detection via `prefers-color-scheme` media query with change listener.
- **Files:** src/modules/ui/theme.js
- **Reason:** Settings had `themeSystem: 'System'` key but no code handled it.
- **Risk:** Low
- **Test:** Set theme to System, change OS theme — app should follow.

## MP-004 — Add visibilitychange cleanup for playback modal
- **System:** voiceMemo.js
- **Summary:** Added `visibilitychange` handler that calls `cleanup` when page becomes hidden. Listener removed on cleanup.
- **Files:** src/modules/ui/voiceMemo.js
- **Reason:** Blob URL and audio element leaked if user navigated away without closing playback modal.
- **Risk:** Low
- **Test:** Open playback modal, switch tabs — audio should stop and URL be revoked.

## MP-005 — Change sortPagesByOrder to function declaration
- **System:** projectDetail.js
- **Summary:** Changed arrow function to `function` declaration for hoisting safety.
- **Files:** src/modules/screens/projectDetail.js
- **Reason:** Arrow functions are not hoisted; function declaration is safer for module-level utilities.
- **Risk:** Low
- **Test:** Verify project detail pages render and sort correctly.

## MP-006 — Fix triple-tap triggering add
- **System:** projectDetail.js
- **Summary:** Added `lastTap = 0; return;` after double-tap fires to prevent triple-tap triggering add.
- **Files:** src/modules/screens/projectDetail.js
- **Reason:** Third tap within 350ms of double-tap also triggered add action.
- **Risk:** Low
- **Test:** Triple-tap empty space in project — only double-tap should trigger add.

## MP-007 — Remove extra blank lines
- **System:** styles.css
- **Summary:** Removed extra blank line at line 417.
- **Files:** src/styles.css
- **Reason:** Minor formatting cleanup.
- **Risk:** None
- **Test:** N/A

## LP-001 — SW registration on DOMContentLoaded
- **System:** main.js
- **Summary:** Changed `window.load` to `DOMContentLoaded` for earlier SW registration.
- **Files:** src/main.js
- **Reason:** SW should register earlier in page lifecycle.
- **Risk:** Low
- **Test:** Verify SW registers on page load.

## LP-002 — formatDuration NaN guard
- **System:** voiceMemo.js
- **Summary:** Added `!Number.isFinite(seconds) || seconds < 0` guard returning `'0:00'`.
- **Files:** src/modules/ui/voiceMemo.js
- **Reason:** Undefined/NaN seconds produced incorrect output.
- **Risk:** Low
- **Test:** Verify duration display works for valid and invalid inputs.

## LP-003 — Fix daysAgo i18n interpolation
- **System:** voiceMemo.js
- **Summary:** Changed from manual string concat + replace to `t('daysAgo', { n: diffDays })`.
- **Files:** src/modules/ui/voiceMemo.js
- **Reason:** Old code produced `"3 3 days ago"` instead of `"3 days ago"`.
- **Risk:** Low
- **Test:** Check archive/inbox voice memo timestamps for correct "X days ago" text.

## LP-004 — Replace hash flash with router.refresh()
- **System:** settings.js
- **Summary:** Replaced `location.hash = ''; setTimeout(...)` with `router.refresh()`.
- **Files:** src/modules/screens/settings.js
- **Reason:** Hash-change workaround caused brief visual flash and potential double render.
- **Risk:** Low
- **Test:** Change language in settings — app should re-render without flash.
