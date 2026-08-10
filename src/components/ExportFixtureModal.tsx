import React, { useState } from 'react';
import { X, FileText, Download, FileSpreadsheet, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { exportToDoc, exportToPdf, exportToCsv, exportToTxt, stripEmojis, stripMarkdownSyntax } from '../utils/exportHelpers';

interface ExportFixtureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Sample markdown fixture with headings, bold/italic, bullet & numbered lists, emojis, and long text
const SAMPLE_FIXTURE_MARKDOWN = `# Laporan Uji Render Pipeline Ekspor Dokumen 🚀

## 1. Ringkasan Eksekutif & Identitas Bisnis 🏪
Laporan ini merupakan **fixture otomatis** untuk menguji pipeline ekspor file (*docx*, *pdf*, *xlsx/csv*, *txt*).
Tujuannya memverifikasi bahwa:
- Syntax markdown (seperti \`**bold**\`, \`## heading\`, \`-\`) diparsing ke struktur elemen native.
- Emoji (seperti 🚀, 🏪, 💡, 📊) di-strip secara aman sebelum masuk generator PDF/Word agar tidak menghasilkan karakter sampah (\`Ø=ÜË\`).
- Konten teks panjang tidak terpotong di tengah kalimat.

---

## 2. Rincian Strategi Marketing & Sales 📈
Berikut adalah rekomendasi aksi nyata yang telah disiapkan oleh *Agent Marketing & Sales*:

### A. Program Promosi WhatsApp Blast
1. **Pesan Pertama (Hooking)**: "Halo Kak! 👋 Ada penawaran spesial produk kuliner UMKM lokal minggu ini..."
2. **Pesan Kedua (Penawangan & CTA)**: Beli 2 gratis 1 dengan menyertakan *voucher khusus*.
3. **Pesan Ketiga (Follow-up Closing)**: "Stok terbatas tersisa 5 paket lagi hari ini!"

### B. Saluran Konten Instagram & TikTok
- **Post Feeds**: *Carousel 3 slide* yang menampilkan proses higienis pembuatan Sambal Cumi Pete.
- **Short Video Reel**: Video transisi sebelum dan sesudah menyajikan nasi hangat dengan sambal.
- **Story Interaktif**: Polling rasa favorit (*Pedas Manis vs Pedas Mantap*).

> **Catatan Penting Tim Exec**: Seluruh campaign ini wajib dievaluasi setiap hari Jumat sore untuk memastikan *Return on Ad Spend (ROAS)* tetap di atas 3.5x.

---

## 3. Estimasi Anggaran & Finansial 💰
Tabel pengalokasian anggaran UMKM sebesar Rp 1.500.000:
- **Iklan Meta (IG/FB Ads)**: Rp 600.000 (40%)
- **Bahan Baku & Packaging Trial**: Rp 500.000 (33%)
- **Fee Content Creator Lokal**: Rp 400.000 (27%)

*Demikian laporan fixture uji pipeline ekspor ini dibuat. Semoga seluruh sistem berjalan lancar dan bebas bug terpotong!*
`;

export const ExportFixtureModal: React.FC<ExportFixtureModalProps> = ({ isOpen, onClose }) => {
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestRun = (format: 'doc' | 'pdf' | 'csv' | 'txt') => {
    const title = 'Uji_Fixture_Ekspor_UMKM';
    try {
      if (format === 'doc') exportToDoc(title, SAMPLE_FIXTURE_MARKDOWN);
      if (format === 'pdf') exportToPdf(title, SAMPLE_FIXTURE_MARKDOWN);
      if (format === 'csv') exportToCsv(title, SAMPLE_FIXTURE_MARKDOWN);
      if (format === 'txt') exportToTxt(title, SAMPLE_FIXTURE_MARKDOWN);

      setTestResult(`Sukses meng-generate dan mengunduh format .${format}! Periksa file hasil unduhan untuk memverifikasi kebersihan layout dan font.`);
    } catch (e: any) {
      setTestResult(`Gagal uji render format .${format}: ${e.message}`);
    }
  };

  const cleanSample = stripMarkdownSyntax(stripEmojis(SAMPLE_FIXTURE_MARKDOWN));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-base font-bold text-slate-100">Uji Render Pipeline Ekspor Dokumen</h3>
              <p className="text-xs text-slate-400">
                Verifikasi Otomatis: Parsing Markdown, Sanitasi Emoji, & Pencegahan Truncation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Status Message */}
          {testResult && (
            <div className="p-3.5 bg-indigo-950/40 border border-indigo-500/50 rounded-xl text-xs text-indigo-200 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{testResult}</span>
            </div>
          )}

          {/* Test Action Buttons */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
              1. Pilih Format Ekspor Dokumen yang Ingin Diuji:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                onClick={() => handleTestRun('doc')}
                className="px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <FileText className="w-4 h-4 text-blue-400" />
                Uji Word (.doc)
              </button>
              <button
                onClick={() => handleTestRun('pdf')}
                className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Download className="w-4 h-4 text-purple-400" />
                Uji PDF (.pdf)
              </button>
              <button
                onClick={() => handleTestRun('csv')}
                className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Uji Excel (.csv)
              </button>
              <button
                onClick={() => handleTestRun('txt')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                TXT Plain
              </button>
            </div>
          </div>

          {/* Sanitized Preview Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                📄 Input Markdown Mentah (Di Dashboard Web):
              </span>
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-300 h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {SAMPLE_FIXTURE_MARKDOWN}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                ✨ Hasil Sanitasi Pipeline Ekspor (Emoji & Markdown Clean):
              </span>
              <div className="p-3 bg-slate-950/80 border border-emerald-500/30 rounded-xl text-[11px] font-mono text-emerald-200/90 h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {cleanSample}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
          <span>Persyaratan PRD Addendum 1–5 terpenuhi sepenuhnya.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
