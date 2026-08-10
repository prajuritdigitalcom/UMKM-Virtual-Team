import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Helper to get GoogleGenAI client lazily
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set in Secrets');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ----------------------------------------------------
// 1. BOSS PLANNER ENDPOINT
// ----------------------------------------------------
app.post('/api/boss/plan', async (req, res) => {
  try {
    const { teamName, businessContext, boss, activeMembers, instruction } = req.body;

    if (!instruction || !activeMembers || activeMembers.length === 0) {
      return res.status(400).json({ error: 'Instruction and active members are required' });
    }

    const ai = getGenAI();

    const activeAgentsList = activeMembers
      .map((m: any) => `- ID: ${m.id} | Nama: ${m.name} | Role: ${m.role} (${m.roleTitle})`)
      .join('\n');

    const promptText = `
Kamu adalah ${boss.name}, ${boss.roleTitle} untuk tim "${teamName}".
${businessContext ? `Konteks Bisnis: ${businessContext}` : ''}

Daftar Agent Spesialis Aktif di timmu saat ini:
${activeAgentsList}

Instruksi Pengguna:
"${instruction}"

Tugasmu:
1. Pahami instruksi pengguna secara mendalam untuk skala bisnis UMKM.
2. Tentukan agent mana saja yang relevan untuk mengerjakan tugas ini dari daftar agent aktif di atas. (JANGAN memanggil agent yang tidak ada di daftar di atas!).
3. Pecah instruksi menjadi sub-tugas spesifik untuk masing-masing agent yang relevan.
4. Tentukan urutan pengerjaan / ketergantungan (dependency) yang logis. Misal jika Agent A butuh data dari Agent B, maka Agent A memiliki dependsOn: [ID Agent B].
5. Pastikan TIDAK ADA siklus ketergantungan melingkar (misal A butuh B, B butuh A).

Format Output Wajib (JSON Array):
Setiap elemen array mewakili sub-tugas untuk 1 agent:
- agentId: ID agent dari daftar di atas
- agentName: nama agent
- role: role agent
- instruction: instruksi detail dan kontekstual untuk agent tersebut (sertakan konteks usaha & skala UMKM)
- dependsOn: array ID agent lain yang harus selesai lebih dulu (kosong jika bisa jalan awal)
- reasoning: alasan singkat pendelegasian ini
`;

    const response = await ai.models.generateContent({
      model: boss.model || 'gemini-3.6-flash',
      contents: promptText,
      config: {
        systemInstruction: boss.systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              agentId: { type: Type.STRING },
              agentName: { type: Type.STRING },
              role: { type: Type.STRING },
              instruction: { type: Type.STRING },
              dependsOn: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              reasoning: { type: Type.STRING },
            },
            required: ['agentId', 'agentName', 'role', 'instruction', 'dependsOn'],
          },
        },
      },
    });

    const rawText = response.text || '[]';
    let plans = JSON.parse(rawText);

    // Filter & validate agent IDs
    const validMemberIds = new Set(activeMembers.map((m: any) => m.id));
    plans = plans.filter((plan: any) => validMemberIds.has(plan.agentId));

    // Validate DAG (Remove circular dependencies)
    plans = sanitizeDependencies(plans);

    const usage = response.usageMetadata || { promptTokenCount: 150, candidatesTokenCount: 300 };

    res.json({
      success: true,
      plans,
      tokens: {
        inputTokens: usage.promptTokenCount || 0,
        outputTokens: usage.candidatesTokenCount || 0,
      },
    });
  } catch (err: any) {
    console.error('Error in /api/boss/plan:', err);
    res.status(500).json({ error: err.message || 'Failed to generate plan' });
  }
});

// Helper to prevent circular dependencies in task graph (DFS-based multi-node cycle detector)
function sanitizeDependencies(plans: any[]) {
  const planMap = new Map(plans.map((p) => [p.agentId, { ...p, dependsOn: [...(p.dependsOn || [])] }]));

  const hasPath = (fromId: string, toId: string, visited = new Set<string>()): boolean => {
    if (fromId === toId) return true;
    if (visited.has(fromId)) return false;
    visited.add(fromId);
    const node = planMap.get(fromId);
    if (!node) return false;
    return (node.dependsOn || []).some((nextId: string) => hasPath(nextId, toId, visited));
  };

  for (const plan of planMap.values()) {
    plan.dependsOn = (plan.dependsOn || []).filter((depId: string) => {
      if (!planMap.has(depId)) return false;
      if (depId === plan.agentId) return false;
      // If depId has a path back to plan.agentId, adding this edge creates a cycle
      if (hasPath(depId, plan.agentId)) {
        console.warn(`Circular dependency detected: ${plan.agentId} -> ${depId}. Breaking edge.`);
        return false;
      }
      return true;
    });
  }

  return Array.from(planMap.values());
}

// ----------------------------------------------------
// 2. AGENT EXECUTION ENDPOINT
// ----------------------------------------------------
app.post('/api/agent/execute', async (req, res) => {
  try {
    const { agent, instruction, businessContext, globalInstruction, previousResults } = req.body;

    if (!agent || !instruction) {
      return res.status(400).json({ error: 'Agent and instruction are required' });
    }

    const ai = getGenAI();

    let contextSection = '';
    if (previousResults && previousResults.length > 0) {
      contextSection = `
\n--- HASIL DARI AGENT SEBELUMNYA (Gunakan sebagai referensi/data pendukung) ---
${previousResults
  .map(
    (prev: any) =>
      `[${prev.agentName} - ${prev.roleTitle || prev.role}]:\n${prev.result}`
  )
  .join('\n\n')}
--- AKHIR HASIL AGENT SEBELUMNYA ---\n
`;
    }

    const promptText = `
Kamu adalah ${agent.name}, ${agent.roleTitle}.
${businessContext ? `Konteks Bisnis Pengguna: ${businessContext}` : ''}
${globalInstruction ? `Instruksi Utama Pengguna: "${globalInstruction}"` : ''}

Tugas Spesifik untukmu dari Boss/Coordinator:
"${instruction}"
${contextSection}

Ingat Standar Kualitas "Super Strong":
- Berikan output yang langsung dapat dieksekusi tanpa perlu diterjemahkan ulang oleh pemilik UMKM solo.
- Berikan hasil konkret, praktis, dan disesuaikan dengan anggaran/skala UMKM.
- Ikuti format output wajib sesuai jobdesk role-mu.
`;

    let accumulatedResult = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let currentPrompt = promptText;
    let isFinished = false;
    let attempts = 0;
    const maxContinuations = 3;

    while (!isFinished && attempts <= maxContinuations) {
      attempts++;

      const response = await ai.models.generateContent({
        model: agent.model || 'gemini-3.6-flash',
        contents: currentPrompt,
        config: {
          systemInstruction: agent.systemPrompt,
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      });

      const chunk = response.text || '';
      accumulatedResult += (accumulatedResult ? '\n' : '') + chunk;

      const usage = response.usageMetadata || { promptTokenCount: 300, candidatesTokenCount: 600 };
      totalInputTokens += usage.promptTokenCount || 0;
      totalOutputTokens += usage.candidatesTokenCount || 0;

      const candidate = response.candidates?.[0];
      const finishReason = candidate?.finishReason;

      // Check if response was truncated
      if (finishReason === 'MAX_TOKENS') {
        console.warn(`[Agent ${agent.name}] Response truncated (MAX_TOKENS). Requesting continuation attempt ${attempts}...`);
        currentPrompt = `
Berikut adalah teks yang baru saja kamu hasilkan sebelumnya:
"${chunk.slice(-500)}"

Teks sebelumnya terpotong karena batas panjang output. TOLONG LANJUTKAN tulisan tersebut secara persis dari kata terakhir, tanpa mengulang bagian yang sudah ditulis, sampai selesai sempurna.
`;
      } else {
        isFinished = true;
      }
    }

    const result = accumulatedResult || 'Tidak ada output dari agent.';

    res.json({
      success: true,
      result,
      tokens: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      },
    });
  } catch (err: any) {
    console.error('Error in /api/agent/execute:', err);
    res.status(500).json({ error: err.message || 'Agent execution failed' });
  }
});

// ----------------------------------------------------
// 3. BOSS SYNTHESIZE ENDPOINT
// ----------------------------------------------------
app.post('/api/boss/synthesize', async (req, res) => {
  try {
    const { boss, teamName, businessContext, userInstruction, taskResults } = req.body;

    if (!boss || !userInstruction || !taskResults) {
      return res.status(400).json({ error: 'Boss, userInstruction, and taskResults are required' });
    }

    const ai = getGenAI();

    const formattedAgentResults = taskResults
      .map(
        (tr: any) => `
========================================
AGENT: ${tr.agentName} (${tr.agentRole})
STATUS: ${tr.status}
========================================
${tr.status === 'DONE' ? tr.result : `[GAGAL/ERROR: ${tr.errorMessage || 'Tidak ada hasil'}]`}
`
      )
      .join('\n');

    const promptText = `
Kamu adalah ${boss.name}, ${boss.roleTitle} dari "${teamName}".
${businessContext ? `Konteks Bisnis UMKM: ${businessContext}` : ''}

Instruksi Awal Pengguna:
"${userInstruction}"

Berikut adalah hasil pekerjaan dari seluruh agent spesialis di timmu:
${formattedAgentResults}

Tugas Sintesis Akhirmu:
1. Review dan satukan seluruh temuan agent di atas menjadi SATU LAPORAN AKHIR SUPER STRONG yang koheren, praktis, dan terstruktur dengan sangat rapi.
2. JANGAN hanya sekadar menempelkan tulisan tiap agent berurutan. Kelola dan sintesiskan informasi agar mengalir sebagai satu panduan eksekutif.
3. Soroti poin prioritas tinggi yang bisa langsung dijalankan hari ini oleh pemilik UMKM solo.
4. Buat dalam format Markdown yang bersih (gunakan heading, bullet points, dan penekanan cetak tebal).

Format Laporan Akhir Disarankan:
- **Ringkasan Eksekutif & Arah Strategi**
- **Langkah Kerja Utama & Prioritas Hari Ini**
- **Rincian Hasil Per Bidang (Marketing, Sales, Riset, Konten, Finance, CS, dll.)**
- **Catatan & Mitigasi Risiko**
- **Penutup & Dorongan Semangat**
`;

    let accumulatedSynthesis = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let currentPrompt = promptText;
    let isFinished = false;
    let attempts = 0;
    const maxContinuations = 3;

    while (!isFinished && attempts <= maxContinuations) {
      attempts++;

      const response = await ai.models.generateContent({
        model: boss.model || 'gemini-3.6-flash',
        contents: currentPrompt,
        config: {
          systemInstruction: boss.systemPrompt,
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      });

      const chunk = response.text || '';
      accumulatedSynthesis += (accumulatedSynthesis ? '\n' : '') + chunk;

      const usage = response.usageMetadata || { promptTokenCount: 500, candidatesTokenCount: 1000 };
      totalInputTokens += usage.promptTokenCount || 0;
      totalOutputTokens += usage.candidatesTokenCount || 0;

      const candidate = response.candidates?.[0];
      const finishReason = candidate?.finishReason;

      if (finishReason === 'MAX_TOKENS') {
        console.warn(`[Boss Synthesis] Response truncated (MAX_TOKENS). Requesting continuation attempt ${attempts}...`);
        currentPrompt = `
Berikut adalah bagian akhir laporan yang baru saja kamu tulis:
"${chunk.slice(-500)}"

Laporan sebelumnya terpotong karena batas panjang output. TOLONG LANJUTKAN laporan tersebut secara persis dari kata terakhir, tanpa mengulang bagian yang sudah ditulis, sampai selesai sempurna hingga bagian penutup.
`;
      } else {
        isFinished = true;
      }
    }

    const finalSynthesis = accumulatedSynthesis || 'Gagal menyusun laporan sintesis.';

    res.json({
      success: true,
      finalSynthesis,
      tokens: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      },
    });
  } catch (err: any) {
    console.error('Error in /api/boss/synthesize:', err);
    res.status(500).json({ error: err.message || 'Synthesis failed' });
  }
});

// ----------------------------------------------------
// 4. FILE EXPORT ENDPOINT
// ----------------------------------------------------
app.post('/api/export', (req, res) => {
  try {
    const { format, title, content } = req.body;
    const cleanTitle = (title || 'Laporan_UMKM_Virtual_Team').replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'csv') {
      // Basic CSV export helper
      const lines = content.split('\n');
      const csvContent = lines.map((line: string) => `"${line.replace(/"/g, '""')}"`).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.csv"`);
      return res.send(csvContent);
    }

    if (format === 'docx' || format === 'doc') {
      // HTML format formatted for Word opening
      const docHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><title>${title}</title>
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; margin: 20px; line-height: 1.6; }
          h1 { color: #1e3a8a; }
          h2 { color: #1d4ed8; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
          h3 { color: #374151; }
          code, pre { background: #f3f4f6; padding: 4px 8px; font-family: monospace; }
        </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p><i>Generated by UMKM Virtual Team - ${new Date().toLocaleDateString('id-ID')}</i></p>
          <hr/>
          <div>${content.replace(/\n/g, '<br/>')}</div>
        </body>
        </html>
      `;
      res.setHeader('Content-Type', 'application/msword');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.doc"`);
      return res.send(docHtml);
    }

    // Default TXT
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.txt"`);
    return res.send(content);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Export failed' });
  }
});

// ----------------------------------------------------
// 5. VITE / STATIC MIDDLEWARE SETUP
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
