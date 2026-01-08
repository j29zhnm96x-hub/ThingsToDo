export async function compressImageBlob(blob, { maxSize = 1280, quality = 0.75 } = {}) {
  if (!blob || typeof blob.type !== 'string' || !blob.type.startsWith('image/')) return blob;
  const arrayBuffer = await blob.arrayBuffer();
  const img = new Image();
  const url = URL.createObjectURL(new Blob([arrayBuffer], { type: blob.type }));
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
  } catch {
    URL.revokeObjectURL(url);
    return blob;
  }
  const { width, height } = img;
  if (!width || !height) {
    URL.revokeObjectURL(url);
    return blob;
  }
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return await new Promise((resolve) => {
    canvas.toBlob((b) => {
      URL.revokeObjectURL(url);
      resolve(b || blob);
    }, 'image/jpeg', quality);
  });
}

export async function createThumbnailBlob(blob, { maxSize = 320, quality = 0.6 } = {}) {
  return compressImageBlob(blob, { maxSize, quality });
}
