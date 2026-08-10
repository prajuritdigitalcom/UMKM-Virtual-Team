import jsPDF from 'jspdf';

/**
 * 1. Strip Emoji & Unicode symbols that cause corrupt characters (Ø=ÜË) in PDF/Word export engines
 */
export function stripEmojis(str: string): string {
  if (!str) return '';
  return str
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F251}\u{1F300}-\u{1F773}\u{1F780}-\u{1F7D8}\u{1F800}-\u{1F80B}\u{1F900}-\u{1F97B}\u{1F97D}-\u{1F99A}\u{1F9A0}-\u{1F9AE}\u{1F9C0}-\u{1F9CB}\u{1F9CD}-\u{1F9CF}\u{1FA70}-\u{1FA73}\u{1FA78}-\u{1FA7A}\u{1FA80}-\u{1FA82}\u{1FA90}-\u{1FA95}\u{1F000}-\u{1FAFF}]/gu,
      ''
    )
    .replace(/[\uFE00-\uFE0F\u200D]/g, '')
    .trim();
}

/**
 * Strip raw markdown syntax markers (*, **, #, >, `, ---) for clean plain text or CSV export
 */
export function stripMarkdownSyntax(str: string): string {
  if (!str) return '';
  return str
    .replace(/^#+\s+/gm, '') // headings
    .replace(/\*\*(.*?)\*\*/g, '$1') // bold
    .replace(/\*(.*?)\*/g, '$1') // italic
    .replace(/__(.*?)__/g, '$1') // bold alt
    .replace(/_(.*?)_/g, '$1') // italic alt
    .replace(/^>\s+/gm, '') // blockquotes
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // inline code
    .replace(/^---\s*$/gm, '----------------------------------------'); // horizontal rule
}

/**
 * Convert Markdown string to clean native HTML for Word (.doc) export
 */
export function markdownToCleanHtml(markdown: string): string {
  if (!markdown) return '';
  
  // First strip emojis for export sanitization
  const sanitized = stripEmojis(markdown);
  const lines = sanitized.split('\n');
  let html = '';
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;

  const closeListIfNeeded = () => {
    if (inList && listType) {
      html += listType === 'ul' ? '</ul>\n' : '</ol>\n';
      inList = false;
      listType = null;
    }
  };

  const parseInline = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:#f3f4f6;padding:2px 4px;font-family:monospace;font-size:90%;">$1</code>');
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      closeListIfNeeded();
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      closeListIfNeeded();
      html += `<h1 style="color:#1e3a8a;font-size:22px;margin-top:20px;margin-bottom:10px;border-bottom:2px solid #3b82f6;padding-bottom:4px;">${parseInline(line.substring(2))}</h1>\n`;
      continue;
    }
    if (line.startsWith('## ')) {
      closeListIfNeeded();
      html += `<h2 style="color:#1d4ed8;font-size:18px;margin-top:18px;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:3px;">${parseInline(line.substring(3))}</h2>\n`;
      continue;
    }
    if (line.startsWith('### ')) {
      closeListIfNeeded();
      html += `<h3 style="color:#374151;font-size:15px;margin-top:14px;margin-bottom:6px;">${parseInline(line.substring(4))}</h3>\n`;
      continue;
    }

    // Horizontal Rule
    if (line === '---' || line === '***') {
      closeListIfNeeded();
      html += `<hr style="border:0;border-top:1px solid #cbd5e1;margin:16px 0;" />\n`;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      closeListIfNeeded();
      html += `<blockquote style="border-left:4px solid #3b82f6;padding-left:12px;margin:10px 0;color:#4b5563;font-style:italic;background:#f8fafc;padding-top:6px;padding-bottom:6px;">${parseInline(line.substring(2))}</blockquote>\n`;
      continue;
    }

    // Unordered List (- or *)
    if (/^[\-\*]\s+/.test(line)) {
      const itemContent = line.replace(/^[\-\*]\s+/, '');
      if (!inList || listType !== 'ul') {
        closeListIfNeeded();
        html += '<ul style="margin-left:20px;margin-bottom:10px;list-style-type:disc;">\n';
        inList = true;
        listType = 'ul';
      }
      html += `  <li style="margin-bottom:4px;">${parseInline(itemContent)}</li>\n`;
      continue;
    }

    // Numbered List (1. 2. etc)
    if (/^\d+\.\s+/.test(line)) {
      const itemContent = line.replace(/^\d+\.\s+/, '');
      if (!inList || listType !== 'ol') {
        closeListIfNeeded();
        html += '<ol style="margin-left:20px;margin-bottom:10px;list-style-type:decimal;">\n';
        inList = true;
        listType = 'ol';
      }
      html += `  <li style="margin-bottom:4px;">${parseInline(itemContent)}</li>\n`;
      continue;
    }

    // Standard Paragraph
    closeListIfNeeded();
    html += `<p style="margin-bottom:10px;line-height:1.6;color:#1e293b;">${parseInline(line)}</p>\n`;
  }

  closeListIfNeeded();
  return html;
}

export function exportToTxt(title: string, content: string) {
  const cleanTitle = stripEmojis(title);
  const sanitizedContent = stripEmojis(content);
  const cleanText = stripMarkdownSyntax(sanitizedContent);

  const element = document.createElement('a');
  const file = new Blob([cleanText], { type: 'text/plain;charset=utf-8' });
  element.href = URL.createObjectURL(file);
  element.download = `${cleanTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

export function exportToCsv(title: string, content: string) {
  const cleanTitle = stripEmojis(title);
  const sanitizedContent = stripEmojis(content);
  const cleanText = stripMarkdownSyntax(sanitizedContent);

  const lines = cleanText.split('\n');
  const csvContent = lines.map((line) => `"${line.replace(/"/g, '""')}"`).join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${cleanTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToDoc(title: string, content: string) {
  const cleanTitle = stripEmojis(title);
  const bodyHtml = markdownToCleanHtml(content);

  const formattedHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${cleanTitle}</title>
      <style>
        body { font-family: 'Segoe UI', 'Calibri', 'Arial', sans-serif; padding: 30px; line-height: 1.6; color: #0f172a; max-width: 800px; margin: 0 auto; }
        h1.title { color: #1e3a8a; font-size: 24px; margin-bottom: 6px; font-weight: bold; }
        .subtitle { font-size: 11px; color: #64748b; font-style: italic; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
        .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <h1 class="title">${cleanTitle}</h1>
      <div class="subtitle">Laporan Hasil Kerja AI Virtual Team UMKM • Tanggal: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</div>
      <div class="content">${bodyHtml}</div>
      <div class="footer">Diproduksi secara otomatis oleh Sistem Multi-Agent AI UMKM Virtual Team</div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + formattedHtml], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function exportToPdf(title: string, content: string) {
  try {
    const doc = new jsPDF();
    const margin = 15;
    const pageHeight = doc.internal.pageSize.height;
    const maxWidth = 180;
    let y = 20;

    const cleanTitle = stripEmojis(title);
    const sanitizedContent = stripEmojis(content);

    // Title Block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138); // Blue 900
    doc.text(cleanTitle, margin, y);
    y += 7;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(`Laporan Resmi UMKM Virtual Team — ${new Date().toLocaleDateString('id-ID')}`, margin, y);
    y += 8;

    // Divider
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + maxWidth, y);
    y += 10;

    // Process lines & render with styles
    const rawLines = sanitizedContent.split('\n');

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();

      if (!line) {
        y += 4;
        continue;
      }

      // Check page boundary
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }

      // Heading 1 (# )
      if (line.startsWith('# ')) {
        const text = stripMarkdownSyntax(line);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(30, 58, 138); // Blue 900
        y += 4;
        const wrapped = doc.splitTextToSize(text, maxWidth);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 7 + 3;
        continue;
      }

      // Heading 2 (## )
      if (line.startsWith('## ')) {
        const text = stripMarkdownSyntax(line);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(29, 78, 216); // Blue 700
        y += 3;
        const wrapped = doc.splitTextToSize(text, maxWidth);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 6 + 2;
        continue;
      }

      // Heading 3 (### )
      if (line.startsWith('### ')) {
        const text = stripMarkdownSyntax(line);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(51, 65, 85); // Slate 700
        y += 2;
        const wrapped = doc.splitTextToSize(text, maxWidth);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 5.5 + 2;
        continue;
      }

      // Bullet List (- or *)
      if (/^[\-\*]\s+/.test(line)) {
        const text = stripMarkdownSyntax(line);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59); // Slate 800

        doc.text('•', margin + 2, y);
        const wrapped = doc.splitTextToSize(text, maxWidth - 8);
        doc.text(wrapped, margin + 7, y);
        y += wrapped.length * 5 + 1;
        continue;
      }

      // Numbered List
      if (/^\d+\.\s+/.test(line)) {
        const text = stripMarkdownSyntax(line);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);

        const wrapped = doc.splitTextToSize(text, maxWidth - 6);
        doc.text(wrapped, margin + 4, y);
        y += wrapped.length * 5 + 1;
        continue;
      }

      // Standard Paragraph
      const text = stripMarkdownSyntax(line);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);

      const wrapped = doc.splitTextToSize(text, maxWidth);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5 + 2;
    }

    doc.save(`${cleanTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
  } catch (err) {
    console.error('PDF export failed, falling back to TXT:', err);
    exportToTxt(title, content);
  }
}

