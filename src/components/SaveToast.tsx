import { Check, AlertCircle, X } from 'lucide-react';

interface SaveToastProps {
  saved: boolean;
  error: string;
  onDismissError: () => void;
  savedMessage?: string;
}

export default function SaveToast({ saved, error, onDismissError, savedMessage = 'Profile saved successfully!' }: SaveToastProps) {
  if (!saved && !error) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 w-full max-w-md px-4 pointer-events-none"
      aria-live="polite"
    >
      {saved && (
        <div className="pointer-events-auto w-full bg-green-600 text-white text-sm font-medium p-4 rounded-xl shadow-lift flex items-center justify-center gap-3 animate-slide-down">
          <Check size={18} className="flex-shrink-0" />
          {savedMessage}
        </div>
      )}
      {error && (
        <div
          className="pointer-events-auto w-full bg-red-600 text-white text-sm p-4 rounded-xl shadow-lift flex items-center gap-3 animate-slide-down"
          role="alert"
        >
          <AlertCircle size={18} className="flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={onDismissError}
            className="hover:opacity-70 transition-opacity flex-shrink-0"
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
