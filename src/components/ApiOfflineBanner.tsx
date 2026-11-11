import { useState, useSyncExternalStore } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
  API_OFFLINE_HELP,
  getApiOfflineState,
  probeApi,
  subscribeApiOffline,
} from '@/lib/apiClient';

/**
 * Explains the two failures that otherwise look like random data errors:
 * the API process not running (Vite's proxy answers a bare 500 to every /api
 * call) and the database being briefly unreachable. Pages still render their
 * own error states — this just says what is actually wrong and how to fix it.
 */
export default function ApiOfflineBanner() {
  const state = useSyncExternalStore(subscribeApiOffline, getApiOfflineState);
  const [checking, setChecking] = useState(false);

  if (state === 'online') return null;

  const apiDown = state === 'api-down';
  const title = apiDown ? 'API server is not running' : 'Database temporarily unreachable';
  const detail = apiDown
    ? 'Data requests will fail with 500 errors until it is started.'
    : 'Usually a brief network hiccup — try again in a moment.';

  const handleRetry = async () => {
    setChecking(true);
    try {
      await probeApi();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      role="alert"
      className={`sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm font-medium ${
        apiDown ? 'bg-red-600 text-white' : 'bg-amber-500 text-red-950'
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        <AlertTriangle size={15} aria-hidden="true" />
        <strong>{title}</strong>
      </span>
      <span className="opacity-90">{detail}</span>
      {apiDown && (
        <code className={`rounded px-1.5 py-0.5 text-xs ${apiDown ? 'bg-red-700/60' : 'bg-black/10'}`}>
          npm run dev:all
        </code>
      )}
      <button
        type="button"
        onClick={handleRetry}
        disabled={checking}
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
          apiDown ? 'bg-white/15 hover:bg-white/25' : 'bg-black/10 hover:bg-black/20'
        }`}
      >
        <RefreshCw size={13} aria-hidden="true" className={checking ? 'animate-spin' : undefined} />
        {checking ? 'Checking…' : 'Retry'}
      </button>
      <span className="sr-only">{API_OFFLINE_HELP}</span>
    </div>
  );
}
