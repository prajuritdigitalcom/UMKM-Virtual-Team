import React, { useState, useEffect } from 'react';
import {
  Key,
  X,
  Check,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Eye,
  EyeOff,
  Play,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: string[];
  onSaveKeys: (keys: string[]) => void;
}

interface KeyTestResult {
  keySuffix: string;
  valid: boolean;
  error?: string;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKeys,
  onSaveKeys,
}) => {
  const [textValue, setTextValue] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showRawKeys, setShowRawKeys] = useState(false);
  const [isTestingKeys, setIsTestingKeys] = useState(false);
  const [testResults, setTestResults] = useState<KeyTestResult[] | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTextValue(apiKeys.join('\n'));
      setSaveSuccess(false);
      setTestResults(null);
    }
  }, [isOpen, apiKeys]);

  if (!isOpen) return null;

  const parsedKeys = textValue
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  // Client-side format sanity check
  const invalidFormatKeys = parsedKeys.filter((k) => !/^AIza[0-9A-Za-z_-]{20,}$/.test(k));

  const handleSave = () => {
    onSaveKeys(parsedKeys);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 800);
  };

  const handleReset = () => {
    setTextValue('');
    onSaveKeys([]);
    setTestResults(null);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 800);
  };

  const handleTestKeys = async () => {
    if (parsedKeys.length === 0) return;

    setIsTestingKeys(true);
    setTestResults(null);

    try {
      const res = await fetch('/api/test-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: parsedKeys }),
      });
      const data = await res.json();
      if (data.results) {
        setTestResults(data.results);
      } else if (data.error) {
        alert(`Error tes API key: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Gagal menghubungi server untuk tes API key: ${err.message}`);
    } finally {
      setIsTestingKeys(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#fe4c6f]/10 border border-[#fe4c6f]/30 flex items-center justify-center text-[#fe4c6f]">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Pengaturan Google Gemini API Key
              </h3>
              <p className="text-xs text-slate-400">
                Masukkan API Keys tersendiri untuk kuota pribadi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-amber-400">
              <Sparkles className="w-4 h-4" />
              <span>Multi-Key Failover & Rolling Rotation</span>
            </div>
            <p className="text-slate-400">
              Masukkan <strong>1 API Key per baris</strong>. Jika satu key terkena limit/error, sistem otomatis berpindah ke key sehat berikutnya dalam pool tanpa menghentikan pekerjaan tim.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-slate-300 flex items-center gap-1.5">
                Daftar Gemini API Keys:
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRawKeys(!showRawKeys)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                  title={showRawKeys ? 'Sembunyikan karakter API key' : 'Tampilkan teks karakter API key'}
                >
                  {showRawKeys ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                      Sembunyikan
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      Tampilkan
                    </>
                  )}
                </button>
                <span className="font-semibold text-[#fe4c6f]">
                  {parsedKeys.length > 0 ? `${parsedKeys.length} Key Terdeteksi` : 'System Default'}
                </span>
              </div>
            </div>

            <textarea
              rows={5}
              value={textValue}
              onChange={(e) => {
                setTextValue(e.target.value);
                setTestResults(null);
              }}
              placeholder={`Contoh:\nAIzaSyA1234567890...\nAIzaSyB0987654321...\nAIzaSyC1122334455...`}
              style={{
                WebkitTextSecurity: showRawKeys ? 'none' : 'disc',
              } as React.CSSProperties}
              className="w-full bg-slate-950 border border-slate-700/80 focus:border-[#fe4c6f] focus:ring-1 focus:ring-[#fe4c6f] rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 outline-none transition-all resize-none"
            />
          </div>

          {/* Warning for format check */}
          {invalidFormatKeys.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                {invalidFormatKeys.length} key tidak berformat standar Google Gemini API Key (biasanya diawali &apos;AIza...&apos;). Periksa kembali bila ada spasi atau karakter tidak terduga.
              </span>
            </div>
          )}

          {/* Test Results Banner */}
          {testResults && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-300 flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span>Hasil Pengujian Koneksi:</span>
                <span className="text-[11px] text-slate-400">
                  {testResults.filter((r) => r.valid).length} / {testResults.length} Valid
                </span>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {testResults.map((res, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-900/60"
                  >
                    <span className="font-mono text-slate-300">Key ...{res.keySuffix}</span>
                    {res.valid ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Valid & Koneksi OK
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-400 font-medium truncate max-w-[200px]" title={res.error}>
                        <X className="w-3.5 h-3.5 shrink-0" /> {res.error || 'Gagal'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {parsedKeys.length > 0 && !testResults && (
            <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-800/40 border border-slate-700/40 px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>
                  {parsedKeys.length} Custom API Key tersimpan di peramban ini saja (lokal browser).
                </span>
              </div>
              <button
                type="button"
                onClick={handleTestKeys}
                disabled={isTestingKeys}
                className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-100 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors shrink-0"
              >
                {isTestingKeys ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                    Menguji...
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                    Test Koneksi
                  </>
                )}
              </button>
            </div>
          )}

          {parsedKeys.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/40 border border-slate-700/40 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                Area input kosong: Sistem akan menggunakan API Key bawaan platform.
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/80 bg-slate-900/50 shrink-0">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="Reset ke Key Default System"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Default
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-bold text-white rounded-xl shadow-lg transition-all ${
                saveSuccess
                  ? 'bg-emerald-600'
                  : 'bg-[#fe4c6f] hover:bg-[#e03f5f] shadow-[#fe4c6f]/20'
              }`}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Tersimpan!
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  Simpan API Keys
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
