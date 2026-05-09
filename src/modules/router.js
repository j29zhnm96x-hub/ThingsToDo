// Minimal hash router.
// Routes:
// - #inbox
// - #projects
// - #project/<id>
// - #archive
// - #settings

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
  if (name === 'help') return { name: 'help', group: 'settings', params: {} };

  return { name: 'inbox', group: 'inbox', params: {} };
}

export const router = {
  _handler: null,
  _queue: Promise.resolve(),
  init({ onRoute }) {
    this._handler = onRoute;
    window.addEventListener('hashchange', () => this.refresh());
    this.refresh();
  },
  refresh() {
    this._queue = this._queue
      .then(async () => {
        const route = parseHash(location.hash);
        if (this._handler) await this._handler(route);
      })
      .catch((err) => console.error('Router refresh failed:', err));
    return this._queue;
  }
};
