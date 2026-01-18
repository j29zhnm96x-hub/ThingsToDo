# ThingsToDo

Mobile-first, offline-first vanilla SPA PWA for GTD-style todos.

## Project structure

- [index.html](index.html) — SPA shell + bottom tab bar + modal host
- [manifest.webmanifest](manifest.webmanifest) — PWA manifest
- [sw.js](sw.js) — service worker (cache-first app shell)
- [src/styles.css](src/styles.css) — mobile-first styling + iOS safe-area handling
- [src/main.js](src/main.js) — bootstraps app + registers service worker
- [src/modules/app.js](src/modules/app.js) — app composition + route-to-screen mapping
- [src/modules/router.js](src/modules/router.js) — minimal hash router
- [src/modules/data/db.js](src/modules/data/db.js) — IndexedDB persistence (todos/projects/attachments/settings)
- [src/modules/ui/*](src/modules/ui) — small UI primitives (modal, confirm, pickProject, etc.)
- [src/modules/screens/*](src/modules/screens) — Inbox/Projects/Project detail/Archive/Settings

## Data model

Todos are stored in IndexedDB with:
- `id`, `title`, `notes`, `priority` (P0..P3)
- `dueDate` (ISO or null)
- `completed` (boolean)
- `projectId` (string or null)
- `archived` + `archivedAt`
- `createdAt`, `updatedAt`
- `order` (manual ordering within the same priority bucket)

Attachments are stored in IndexedDB as Blobs in the `attachments` store (persist across refresh/offline).

## Sorting + ordering

Default sorting is:
1) priority (P0 → P3)
2) manual order (`order`) within same priority
3) created date fallback

Reordering uses touch-friendly **Move Up / Move Down** buttons (no HTML5 drag/drop dependency).

- Checklist projects now allow their colored page pills to be reordered via drag-and-drop (long-press or swipe the pill tab). The order is persisted and respected across reloads.

## Run locally (recommended)

Service workers require `http(s)`.

### Option A: Python

- `python -m http.server 5173`
- open `http://localhost:5173/`

### Option B: Node

- `npx serve .`

## Offline behavior

After the first successful load, `sw.js` caches the app shell so the app continues to work offline.
All app data lives locally in IndexedDB.

## Notes for iOS install

- iOS “Add to Home Screen” uses `apple-touch-icon` (PNG preferred). Put your iPhone icon at:
	- assets/apple-touch-icon.png (recommended: 180×180 PNG)
- The app also uses the same PNG as the browser favicon.
- For best cross-platform PWA icons, also add:
	- assets/icon-192.png (192×192)
	- assets/icon-512.png (512×512)
	- assets/icon-512-maskable.png (512×512, with safe padding)
