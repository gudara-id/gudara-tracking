// Kompres foto di sisi browser sebelum dikirim ke server, supaya baris DB
// yang menyimpannya sebagai data URL base64 (mis. purchase_order_attachments,
// setoran_jahit.foto_url) tidak membengkak. Dipakai oleh alur upload foto di
// beberapa tempat (input setoran, bukti kirim kurir), jadi diletakkan di sini
// supaya tidak diduplikasi.
export async function compressPhotoToDataUrl(file: File, maxDimension = 1024, quality = 0.7): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak didukung di browser ini");
  ctx.drawImage(bitmap, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}
