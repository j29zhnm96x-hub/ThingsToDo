import { el, emptyState } from './dom.js';
import { openModal } from './modal.js';
import { restoreFromBin } from '../logic/todoOps.js';
import { t } from '../utils/i18n.js';

export async function openBinModal(ctx, { onRestore } = {}) {
  try {
    const { db, modalHost } = ctx;
    if (!db.bin) {
      console.error('Database bin store not available. Keys:', Object.keys(db));
      alert('Error: Bin not available. Please reload the page.');
      return;
    }

    const items = await db.bin.list();
    
    // Sort by deletedAt descending
    items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

    const list = el('div', { class: 'list' });
    
    if (items.length === 0) {
      list.append(emptyState(t('binIsEmpty'), t('deletedItemsInfo')));
    }

    // We need a reference to modal for the closure, but it's created after.
    // We'll use a mutable object to hold the reference.
    const modalRef = {};

    for (const item of items) {
      const row = el('div', { class: 'todo', style: 'opacity: 0.7' },
        el('div', { class: 'todo__row1' },
          el('div', { class: 'todo__titleArea' },
            el('div', { class: 'todo__title' }, item.title),
            el('div', { class: 'todo__row2' }, t('deletedLabel') + ' ' + new Date(item.deletedAt).toLocaleTimeString())
          ),
          el('button', { 
            class: 'btn btn--sm', 
            onClick: async () => {
              await restoreFromBin(db, [item]);
              if (modalRef.current) modalRef.current.close();
              await onRestore?.();
              // Re-open to show updated list (small delay to allow modal close animation if needed, though we are replacing it)
              setTimeout(() => openBinModal(ctx, { onRestore }), 50);
            }
          }, t('restore'))
        )
      );
      list.appendChild(row);
    }

    const modal = openModal(modalHost, {
      title: t('recentlyDeleted'),
      content: list,
      actions: [
        { label: t('close'), class: 'btn btn--ghost', onClick: () => true }
      ]
    });
    
    modalRef.current = modal;

  } catch (err) {
    console.error('Failed to open bin:', err);
    alert('Failed to open bin. See console for details.');
  }
}
