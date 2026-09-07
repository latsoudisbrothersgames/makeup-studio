import { useEffect } from 'react';
import './Toast.css';

interface Props {
  message: string | null;
  onDone(): void;
  ms?: number;
}

export function Toast({ message, onDone, ms = 2200 }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDone, ms);
    return () => window.clearTimeout(t);
  }, [message, ms, onDone]);
  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">{message}</div>
  );
}
