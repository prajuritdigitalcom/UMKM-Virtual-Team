import { Attachment } from '../types';

// ----------------------------------------------------
// BATASAN UPLOAD
// Dipilih agar aman di bawah batas request Gemini API (~20MB termasuk overhead base64)
// sekaligus menjaga biaya token tetap wajar untuk skala UMKM.
// ----------------------------------------------------
export const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB per file
export const MAX_ATTACHMENTS = 4; // maksimal 4 file per instruksi
export const MAX_TOTAL_SIZE_BYTES = 15 * 1024 * 1024; // 15MB gabungan seluruh lampiran

export const ACCEPTED_FILE_EXTENSIONS =
  '.jpg,.jpeg,.png,.webp,.gif,.pdf,.docx,.xlsx,.xls,.csv,.txt';

export const ACCEPTED_FILE_LABEL =
  'Gambar (JPG/PNG/WEBP/GIF), PDF, Word (.docx), Excel (.xlsx/.xls), CSV, atau TXT';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const LEGACY_DOC_MIME = 'application/msword';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLS_MIME = 'application/vnd.ms-excel';

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx === -1 ? '' : fileName.slice(idx).toLowerCase();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = (reader.result as string) || '';
      // Hasil readAsDataURL berbentuk "data:<mime>;base64,XXXX" — kita ambil bagian base64-nya saja
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Gagal membaca file "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

function readAsPlainText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = () => reject(new Error(`Gagal membaca file "${file.name}".`));
    reader.readAsText(file);
  });
}

async function extractDocxText(file: File): Promise<string> {
  // Lazy-load supaya bundle awal tidak membengkak untuk pengguna yang tidak pernah upload Word
  const mammoth = (await import('mammoth/mammoth.browser')).default;
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return (value || '').trim();
}

async function extractSpreadsheetText(file: File): Promise<string> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sections: string[] = [];
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet).trim();
    if (csv) sections.push(`[Sheet: ${sheetName}]\n${csv}`);
  });
  return sections.join('\n\n');
}

function makeId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Memproses satu File dari <input type="file"> menjadi Attachment siap-kirim.
 * - Gambar & PDF -> base64 (kind: 'inline'), dikirim apa adanya ke Gemini (dibaca native).
 * - Word/Excel/CSV/TXT -> diekstrak jadi teks polos (kind: 'text') di browser.
 * Melempar Error dengan pesan Bahasa Indonesia yang siap ditampilkan ke pengguna bila gagal/tidak didukung.
 */
export async function processFile(file: File): Promise<Attachment> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `"${file.name}" berukuran ${(file.size / 1024 / 1024).toFixed(1)}MB, melebihi batas maksimal ${
        MAX_FILE_SIZE_BYTES / 1024 / 1024
      }MB per file.`
    );
  }

  const ext = getExtension(file.name);
  const mimeType = file.type;
  const id = makeId();

  // --- Gambar: dikirim langsung ke Gemini sebagai inline data ---
  if (IMAGE_MIME_TYPES.has(mimeType) || IMAGE_EXTENSIONS.includes(ext)) {
    const data = await fileToBase64(file);
    const resolvedMime = mimeType || 'image/jpeg';
    return {
      id,
      name: file.name,
      mimeType: resolvedMime,
      size: file.size,
      kind: 'inline',
      data,
      previewUrl: `data:${resolvedMime};base64,${data}`,
    };
  }

  // --- PDF: dikirim langsung ke Gemini, termasuk isi visual/layoutnya ---
  if (mimeType === 'application/pdf' || ext === '.pdf') {
    const data = await fileToBase64(file);
    return {
      id,
      name: file.name,
      mimeType: 'application/pdf',
      size: file.size,
      kind: 'inline',
      data,
    };
  }

  // --- Word lama (.doc biner) belum didukung oleh parser yang tersedia ---
  if (ext === '.doc' || mimeType === LEGACY_DOC_MIME) {
    throw new Error(
      `Format ".doc" lama pada "${file.name}" belum didukung. Simpan ulang sebagai .docx atau PDF lalu unggah lagi.`
    );
  }

  // --- Word (.docx): ekstrak teks di browser ---
  if (ext === '.docx' || mimeType === DOCX_MIME) {
    const textContent = await extractDocxText(file);
    return {
      id,
      name: file.name,
      mimeType: DOCX_MIME,
      size: file.size,
      kind: 'text',
      textContent: textContent || '(Dokumen Word ini tidak berisi teks yang dapat dibaca)',
    };
  }

  // --- Excel (.xlsx/.xls): konversi tiap sheet ke CSV di browser ---
  if (['.xlsx', '.xls'].includes(ext) || mimeType === XLSX_MIME || mimeType === XLS_MIME) {
    const textContent = await extractSpreadsheetText(file);
    return {
      id,
      name: file.name,
      mimeType: mimeType || XLSX_MIME,
      size: file.size,
      kind: 'text',
      textContent: textContent || '(File Excel ini kosong atau tidak berisi data)',
    };
  }

  // --- CSV & TXT: baca sebagai teks polos ---
  if (ext === '.csv' || mimeType === 'text/csv') {
    const textContent = await readAsPlainText(file);
    return { id, name: file.name, mimeType: 'text/csv', size: file.size, kind: 'text', textContent };
  }

  if (ext === '.txt' || mimeType === 'text/plain') {
    const textContent = await readAsPlainText(file);
    return { id, name: file.name, mimeType: 'text/plain', size: file.size, kind: 'text', textContent };
  }

  throw new Error(`Format file "${file.name}" tidak didukung. Gunakan ${ACCEPTED_FILE_LABEL}.`);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Ubah Attachment[] (state UI, termasuk previewUrl) jadi payload ringkas yang aman dikirim ke backend. */
export function toAttachmentPayload(attachments: Attachment[]) {
  return attachments.map((a) => ({
    name: a.name,
    mimeType: a.mimeType,
    kind: a.kind,
    data: a.data,
    textContent: a.textContent,
  }));
}
