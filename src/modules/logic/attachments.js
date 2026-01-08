import { compressImageBlob, createThumbnailBlob } from '../utils/image.js';

// Compress archived images more aggressively and ensure thumbnails exist.
export async function compressAttachmentsForArchive(db, todoId) {
  const settings = await db.settings.get();
  const extraCompress = settings.compressArchivedImages !== false; // default true
  const attachments = await db.attachments.listForTodo(todoId);

  for (const att of attachments) {
    if (!att?.blob || typeof att.blob.type !== 'string' || !att.blob.type.startsWith('image/')) continue;

    let blob = att.blob;
    if (extraCompress) {
      try {
        blob = await compressImageBlob(blob, { maxSize: 960, quality: 0.7 });
      } catch (e) {
        console.warn('Archive compress failed', e);
      }
    }

    let thumb = att.thumb;
    if (!thumb) {
      try {
        thumb = await createThumbnailBlob(blob, { maxSize: 320, quality: 0.6 });
      } catch (e) {
        console.warn('Thumbnail generation failed', e);
      }
    }

    if (blob !== att.blob || (thumb && thumb !== att.thumb)) {
      await db.attachments.put({ ...att, blob, type: blob.type || att.type, thumb });
    }
  }
}
