import express from 'express';
import path from 'path';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// ----------------------------------------------------
// RATE LIMITER MIDDLEWARE (PROTECT API QUOTA)
// ----------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
function apiRateLimiter(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    )
      .split(',')[0]
      .trim();
    const now = Date.now();
    const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    record.count++;
    rateLimitMap.set(ip, record);

    if (record.count > maxRequests) {
      return res.status(429).json({
        error: 'Terlalu banyak permintaan (rate limit). Silakan tunggu 1 menit sebelum mencoba lagi.',
      });
    }

    next();
  };
}

// Apply rate limiter on all /api routes (60 requests per minute per IP)
app.use('/api', apiRateLimiter(60, 60 * 1000));

// ----------------------------------------------------
// MULTI-KEY ROLLING & FAILOVER LOGIC
// ----------------------------------------------------
const keyCooldowns = new Map<string, number>();

function getAvailableKeys(req: express.Request): string[] {
  const customKeyHeader = req.headers['x-gemini-api-key'];
  if (customKeyHeader) {
    const raw = Array.isArray(customKeyHeader) ? customKeyHeader[0] : customKeyHeader;
    const keys = raw.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean);
    if (keys.length > 0) return keys;
  }
  if (process.env.GEMINI_API_KEY) return [process.env.GEMINI_API_KEY];
  return [];
}

function isKeyRelatedError(message: string): boolean {
  return /api key not valid|permission denied|unauthenticated|quota|429|rate limit|resource_exhausted|invalid_argument.*key/i.test(
    message || ''
  );
}

interface FailoverResult {
  response: any;
  keyUsedSuffix: string;
  attemptsLog: string[];
}

async function generateWithKeyFailover(
  req: express.Request,
  params: Parameters<InstanceType<typeof GoogleGenAI>['models']['generateContent']>[0]
): Promise<FailoverResult> {
  const keys = getAvailableKeys(req);
  if (keys.length === 0) {
    throw new Error('Tidak ada API Key yang tersedia (custom maupun default sistem).');
  }

  const attemptsLog: string[] = [];
  let lastError: any = null;

  // Pick a starting index per request to isolate rotation across sessions
  const startOffset = Math.floor(Math.random() * keys.length);

  for (let i = 0; i < keys.length; i++) {
    const idx = (startOffset + i) % keys.length;
    const apiKey = keys[idx];
    const keySuffix = apiKey.length >= 4 ? apiKey.slice(-4) : apiKey;

    const cooldownUntil = keyCooldowns.get(apiKey) || 0;
    if (Date.now() < cooldownUntil && keys.length > 1) {
      attemptsLog.push(`[Key ...${keySuffix}] Sedang cooldown, melompati key ini.`);
      continue;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent(params);
      attemptsLog.push(`[Key ...${keySuffix}] Berhasil dieksekusi.`);
      return { response, keyUsedSuffix: keySuffix, attemptsLog };
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      attemptsLog.push(`[Key ...${keySuffix}] Error: ${errMsg}`);

      if (isKeyRelatedError(errMsg)) {
        // Cooldown key for 5 minutes
        keyCooldowns.set(apiKey, Date.now() + 5 * 60 * 1000);
        console.warn(`[API Key Failover] Key ...${keySuffix} bermasalah. Mencoba key berikutnya...`);
      } else {
        // Non-key error (syntax, content policy, etc) - throw immediately
        throw err;
      }
    }
  }

  throw new Error(
    `Seluruh API Key (${keys.length} key) gagal dieksekusi. Error terakhir: ${
      lastError?.message || 'Unknown error'
    }`
  );
}

// ----------------------------------------------------
// ENDPOINT: TEST / VALIDATE API KEYS
// ----------------------------------------------------
app.post('/api/test-keys', async (req, res) => {
  try {
    const { keys } = req.body as { keys: string[] };
    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ error: 'Tidak ada API Key untuk diuji' });
    }

    const results = await Promise.all(
      keys.map(async (apiKey) => {
        const trimmed = apiKey.trim();
        const keySuffix = trimmed.length >= 4 ? trimmed.slice(-4) : trimmed;
        if (!trimmed) {
          return { keySuffix: '????', valid: false, error: 'Key kosong' };
        }
        try {
          const ai = new GoogleGenAI({
            apiKey: trimmed,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });
          await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: 'Tes koneksi.',
            config: { maxOutputTokens: 5 },
          });
          return { keySuffix, valid: true };
        } catch (err: any) {
          return { keySuffix, valid: false, error: err.message || 'Gagal terhubung ke Gemini API' };
        }
      })
    );

    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Pengujian API Keys gagal' });
  }
});

// ----------------------------------------------------
// 1. BOSS PLANNER ENDPOINT
// ----------------------------------------------------
app.post('/api/boss/plan', async (req, res) => {
  try {
    const { teamName, businessContext, boss, activeMembers, instruction } = req.body;

    if (!instruction || !activeMembers || activeMembers.length === 0) {
      return res.status(400).json({ error: 'Instruction and active members are required' });
    }

    const activeAgentsList = activeMembers
      .map((m: any) => `- ID: ${m.id} | Nama: ${m.name} | Role: ${m.role} (${m.roleTitle})`)
      .join('\n');

    const promptText = `
Kamu adalah ${boss.name}, ${boss.roleTitle} untuk tim "${teamName}".
${businessContext ? `Konteks Bisnis: ${businessContext}` : ''}

Daftar Agent Spesialis Aktif di timmu saat ini (Total: ${activeMembers.length} agent):
${activeAgentsList}

Instruksi Pengguna:
"${instruction}"

Tugasmu:
1. Pahami instruksi pengguna secara mendalam untuk skala bisnis UMKM.
2. Pertimbangkan SELURUH ${activeMembers.length} agent aktif di atas satu per satu, lalu tentukan mana yang relevan untuk instruksi ini. (JANGAN memanggil agent yang tidak ada di daftar di atas!). Libatkan SEMUA agent yang relevan meskipun itu berarti lebih dari 3 agent sekaligus — jumlah agent yang dilibatkan HARUS murni mengikuti relevansi terhadap instruksi, BUKAN dibatasi ke angka kecil karena kebiasaan tim lama. Sebaliknya, jangan juga memaksakan agent yang benar-benar tidak relevan hanya supaya semua agent "kebagian" tugas.
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

    const { response, keyUsedSuffix, attemptsLog } = await generateWithKeyFailover(req, {
      model: boss.model || 'gemini-3.6-flash',
      contents: promptText,
      config: {
        systemInstruction: boss.systemPrompt,
        responseMimeType: 'application/json',
        maxOutputTokens: 65536,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MEDIUM,
        },
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
            required: ['agentId', 'agentName', 'role', 'instruction'],
          },
        },
      },
    });

    let plans: any[] = [];
    try {
      plans = JSON.parse(response.text || '[]');
    } catch (e) {
      console.error('Failed to parse plan JSON:', response.text);
      return res.status(500).json({ error: 'Boss AI memberikan format respons yang tidak valid.' });
    }

    // Sanitize and validate agentIds in plans against activeMembers
    const validMemberIds = new Set(activeMembers.map((m) => m.id));
    const fallbackWarnings: any[] = [];

    plans = plans.map((p) => {
      let matchedMember = activeMembers.find((m) => m.id === p.agentId);
      if (!matchedMember) {
        // Fallback match by role or agentName
        matchedMember =
          activeMembers.find((m) => m.role === p.role) ||
          activeMembers.find((m) => m.name.toLowerCase() === (p.agentName || '').toLowerCase());

        if (matchedMember) {
          fallbackWarnings.push({
            agentId: p.agentId,
            agentName: matchedMember.name,
            message: `Boss AI mengirim ID agent tidak dikenal ("${p.agentId}"), sistem otomatis mencocokkan ke ${matchedMember.name} (${matchedMember.roleTitle}) berdasarkan role/nama terdekat.`,
          });
        } else {
          matchedMember = activeMembers[0];
          fallbackWarnings.push({
            agentId: p.agentId,
            agentName: matchedMember ? matchedMember.name : 'System',
            message: `Boss AI mengirim ID agent tidak dikenal ("${p.agentId}"), dan tidak ditemukan kecocokan. Sub-tugas terpaksa dialokasikan ke ${matchedMember ? matchedMember.name : 'Agent Pertama'}.`,
          });
        }
      }
      return {
        ...p,
        agentId: matchedMember ? matchedMember.id : p.agentId,
        agentName: matchedMember ? matchedMember.name : p.agentName,
        role: matchedMember ? matchedMember.role : p.role,
        dependsOn: Array.isArray(p.dependsOn)
          ? p.dependsOn.filter((depId: string) => validMemberIds.has(depId))
          : [],
      };
    });

    const coverageWarnings = auditAgentCoverage(plans, activeMembers);
    const dependencyWarnings = auditPlanDependencies(plans, activeMembers);
    const warnings = [...fallbackWarnings, ...coverageWarnings, ...dependencyWarnings];

    res.json({
      plans,
      warnings,
      keyUsedSuffix,
      attemptsLog,
    });
  } catch (err: any) {
    console.error('Error in /api/boss/plan:', err);
    res.status(500).json({ error: err.message || 'Gagal memproses rencana kerja Boss AI' });
  }
});

// Coverage audit: tandai agent aktif yang sama sekali tidak disertakan dalam plan
function auditAgentCoverage(plans: any[], activeMembers: any[]): any[] {
  const warnings: any[] = [];
  const usedAgentIds = new Set(plans.map((p) => p.agentId));

  activeMembers.forEach((m) => {
    if (!usedAgentIds.has(m.id)) {
      warnings.push({
        agentId: m.id,
        agentName: m.name,
        message: `${m.name} (${m.roleTitle}) aktif di tim tapi TIDAK disertakan Boss AI dalam rencana kerja untuk instruksi ini. Jika ini tidak sesuai ekspektasi, coba pertegas instruksi agar mencakup bidang ${m.roleTitle}.`,
      });
    }
  });

  return warnings;
}

// Dependency audit helper
function auditPlanDependencies(plans: any[], activeMembers: any[]): any[] {
  const warnings: any[] = [];
  const memberRolesMap = new Map<string, string>();
  activeMembers.forEach((m) => memberRolesMap.set(m.id, m.role));

  for (const plan of plans) {
    const role = memberRolesMap.get(plan.agentId) || plan.role;
    const dependsOnList = plan.dependsOn || [];
    const dependsOnRoles = new Set(dependsOnList.map((id: string) => memberRolesMap.get(id)));

    let suggestions: string[] = [];
    if (role === 'content' || role === 'social') {
      suggestions = ['research', 'marketing'];
    } else if (role === 'sales') {
      suggestions = ['content', 'research', 'marketing'];
    } else if (role === 'marketing') {
      suggestions = ['research'];
    } else if (role === 'finance') {
      suggestions = ['sales', 'research'];
    } else if (role === 'cs') {
      suggestions = ['content', 'sales'];
    } else if (role === 'seo') {
      suggestions = ['research', 'content'];
    } else if (role === 'tax') {
      suggestions = ['finance', 'legal'];
    } else if (role === 'ads') {
      suggestions = ['marketing', 'research', 'finance'];
    } else if (role === 'ecommerce') {
      suggestions = ['sales', 'content', 'research'];
    } else if (role === 'hr') {
      suggestions = ['finance'];
    }

    const relevantSuggestions = suggestions.filter((s) =>
      activeMembers.some((m) => m.role === s) &&
      plans.some((p) => memberRolesMap.get(p.agentId) === s)
    );

    const hasRelevantDependency = relevantSuggestions.some((r) => dependsOnRoles.has(r));

    if (relevantSuggestions.length > 0 && !hasRelevantDependency) {
      warnings.push({
        agentId: plan.agentId,
        agentName: plan.agentName,
        message: `${plan.agentName} (${plan.role}) tidak depend ke agent ${relevantSuggestions.join('/')} yang biasanya jadi sumber brief.`,
      });
    }
  }

  return warnings;
}

// Helper to append continuation chunk without duplicating overlapping text at the seam
function appendDeduplicatedChunk(accumulated: string, chunk: string): string {
  if (!accumulated) return chunk;
  if (!chunk) return accumulated;

  const maxOverlap = Math.min(accumulated.length, chunk.length, 200);
  for (let len = maxOverlap; len >= 10; len--) {
    const tail = accumulated.slice(-len);
    if (chunk.startsWith(tail)) {
      return accumulated + chunk.slice(len);
    }
  }
  return accumulated + '\n' + chunk;
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
    let contentsHistory: any[] = [{ role: 'user', parts: [{ text: promptText }] }];
    let isFinished = false;
    let attempts = 0;
    const maxContinuations = 2; // Reduced for specialist agents to optimize token usage
    let lastKeyUsedSuffix = '';
    const allAttemptsLogs: string[] = [];

    while (!isFinished && attempts <= maxContinuations) {
      attempts++;

      const { response, keyUsedSuffix, attemptsLog } = await generateWithKeyFailover(req, {
        model: agent.model || 'gemini-3.6-flash',
        contents: contentsHistory,
        config: {
          systemInstruction: agent.systemPrompt,
          maxOutputTokens: 16384, // Optimized token budget for specialist agents
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MEDIUM,
          },
        },
      });

      lastKeyUsedSuffix = keyUsedSuffix;
      allAttemptsLogs.push(...attemptsLog);

      const chunk = response.text || '';
      accumulatedResult = appendDeduplicatedChunk(accumulatedResult, chunk);

      const usage = response.usageMetadata || { promptTokenCount: 300, candidatesTokenCount: 600 };
      totalInputTokens += usage.promptTokenCount || 0;
      totalOutputTokens += usage.candidatesTokenCount || 0;

      const candidate = response.candidates?.[0];
      const finishReason = candidate?.finishReason;

      if (finishReason === 'MAX_TOKENS') {
        console.warn(`[Agent ${agent.name}] Response truncated (MAX_TOKENS). Continuation attempt ${attempts}...`);
        contentsHistory.push({ role: 'model', parts: [{ text: chunk }] });
        contentsHistory.push({
          role: 'user',
          parts: [
            {
              text: 'Output sebelumnya terpotong karena batas panjang output. TOLONG LANJUTKAN tulisan tersebut secara persis dari kata terakhir, tanpa mengulang bagian yang sudah ditulis, sampai selesai sempurna.',
            },
          ],
        });
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
      keyUsedSuffix: lastKeyUsedSuffix,
      attemptsLog: allAttemptsLogs,
    });
  } catch (err: any) {
    console.error('Error in /api/agent/execute:', err);
    res.status(500).json({ error: err.message || 'Eksekusi agent gagal' });
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
    let contentsHistory: any[] = [{ role: 'user', parts: [{ text: promptText }] }];
    let isFinished = false;
    let attempts = 0;
    const maxContinuations = 3;
    let lastKeyUsedSuffix = '';
    const allAttemptsLogs: string[] = [];

    while (!isFinished && attempts <= maxContinuations) {
      attempts++;

      const { response, keyUsedSuffix, attemptsLog } = await generateWithKeyFailover(req, {
        model: boss.model || 'gemini-3.6-flash',
        contents: contentsHistory,
        config: {
          systemInstruction: boss.systemPrompt,
          maxOutputTokens: 65536,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
        },
      });

      lastKeyUsedSuffix = keyUsedSuffix;
      allAttemptsLogs.push(...attemptsLog);

      const chunk = response.text || '';
      accumulatedSynthesis = appendDeduplicatedChunk(accumulatedSynthesis, chunk);

      const usage = response.usageMetadata || { promptTokenCount: 500, candidatesTokenCount: 1000 };
      totalInputTokens += usage.promptTokenCount || 0;
      totalOutputTokens += usage.candidatesTokenCount || 0;

      const candidate = response.candidates?.[0];
      const finishReason = candidate?.finishReason;

      if (finishReason === 'MAX_TOKENS') {
        console.warn(`[Boss Synthesis] Response truncated (MAX_TOKENS). Continuation attempt ${attempts}...`);
        contentsHistory.push({ role: 'model', parts: [{ text: chunk }] });
        contentsHistory.push({
          role: 'user',
          parts: [
            {
              text: 'Laporan sebelumnya terpotong karena batas panjang output. TOLONG LANJUTKAN laporan tersebut secara persis dari kata terakhir, tanpa mengulang bagian yang sudah ditulis, sampai selesai sempurna hingga bagian penutup.',
            },
          ],
        });
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
      keyUsedSuffix: lastKeyUsedSuffix,
      attemptsLog: allAttemptsLogs,
    });
  } catch (err: any) {
    console.error('Error in /api/boss/synthesize:', err);
    res.status(500).json({ error: err.message || 'Sintesis laporan akhir gagal' });
  }
});

// ----------------------------------------------------
// 4. VITE / STATIC MIDDLEWARE SETUP
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
