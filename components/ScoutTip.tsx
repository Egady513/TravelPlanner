'use client';

interface ScoutTipProps {
  id: string;
  message: string;
  type: 'warning' | 'info' | 'suggestion';
  onDismiss: (id: string) => void;
}

const typeStyles = {
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  suggestion: 'bg-green-50 border-green-200 text-green-800',
};

const typeIcons = {
  warning: '⚠️',
  info: 'ℹ️',
  suggestion: '💡',
};

export default function ScoutTip({ id, message, type, onDismiss }: ScoutTipProps) {
  return (
    <div className={`border rounded-lg p-2 text-xs flex items-start gap-2 ${typeStyles[type]}`}>
      <span className="flex-shrink-0">{typeIcons[type]}</span>
      <p className="flex-1">{message}</p>
      <button
        onClick={() => onDismiss(id)}
        className="flex-shrink-0 opacity-60 hover:opacity-100 text-xs leading-none"
        aria-label="Dismiss tip"
      >
        ×
      </button>
    </div>
  );
}
