// Minimal hash router.
// Routes:
// - #inbox
// - #projects
// - #project/<id>
// - #archive
// - #settings
// - #stats
// - #search

function parseHash(hash) {
  const raw = (hash || '').replace(/^#/, '').trim();
  if (!raw) return { name: 'inbox', group: 'inbox', params: {} };
  const parts = raw.split('/').filter(Boolean);

  if (parts[0] === 'project' && parts[1]) {
    return { name: 'project', group: 'projects', params: { projectId: parts[1] } };
  }

  const name = parts[0];
  if (name === 'inbox') return { name: 'inbox', group: 'inbox', params: {} };
  if (name === 'projects') return { name: 'projects', group: 'projects', params: {} };
  if (name === 'archive') return { name: 'archive', group: 'archive', params: {} };
  if (name === 'settings') return { name: 'settings', group: 'settings', params: {} };
  if (name === 'stats') return { name: 'stats', group: 'stats', params: {} };
  if (name === 'search') {
    const scope = parts[1] || 'all';
    return { name: 'search', group: 'search', params: { scope } };
  }
  if (name === 'help') return { name: 'help', group: 'settings', params: {} };

  return { name: 'inbox', group: 'inbox', params: {} };
}

export const router = {
  _handler: null,
  _pending: null,
  init({ onRoute }) {
    this._handler = onRoute;
    window.addEventListener('hashchange', () => this.refresh());
    this.refresh();
  },
  refresh() {
    // Cancel any pending navigation and start fresh
    if (this._pending) {
      // Allow the old promise to settle but don't chain on it
      this._pending.catch(() => {});
    }
    this._pending = (async () => {
      const route = parseHash(location.hash);
      if (this._handler) await this._handler(route);
    })();
    this._pending.catch((err) => console.error('Router refresh failed:', err));
    return this._pending;
  }
};
