import { el, emptyState } from './dom.js';
import { openModal } from './modal.js';
import { restoreFromBin } from '../logic/todoOps.js';

export async function openBinModal(ctx, { onRestore } = {}) {
  const { db, modalHost } = ctx;
  const items = await db.bin.list();
  
  // Sort by deletedAt descending
  items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  const list = el('div', { class: 'list' });
  
  if (items.length === 0) {
    list.append(emptyState('Bin is empty', 'Deleted items stay here for 24 hours.'));
  }

  for (const item of items) {
    const row = el('div', { class: 'todo', style: 'opacity: 0.7' },
      el('div', { class: 'todo__row1' },
        el('div', { class: 'todo__titleArea' },
          el('div', { class: 'todo__title' }, item.title),
          el('div', { class: 'todo__row2' }, 'Deleted ' + new Date(item.deletedAt).toLocaleTimeString())
        ),
        el('button', { 
          class: 'btn btn--sm', 
          onClick: async () => {
            await restoreFromBin(db, [item]);
            modal.close();
            await onRestore?.();
            openBinModal(ctx, { onRestore }); // Re-open to show updated list
          }
        }, 'Restore')
      )
    );
    list.appendChild(row);
  }

  const modal = openModal(modalHost, {
    title: 'Recently Deleted',
    content: list,
    actions: [
      { label: 'Close', class: 'btn btn--ghost', onClick: () => true }
    ]
  });
}
