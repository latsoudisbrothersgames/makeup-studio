import { useEffect, useRef } from 'react';
import './Toast.css';

interface Props {
  message: string | null;
  onDone(): void;
  ms?: number;
}

export function Toast({ message, onDone, ms = 2200 }: Props) {
  // Το onDone είναι νέα συνάρτηση σε κάθε render· αν ήταν εξάρτηση του effect, το χρονόμετρο θα
  // ξεκινούσε από την αρχή σε κάθε render — στο παιχνίδι (render κάθε δευτερόλεπτο από το χρονόμετρο
  // του γύρου) το μήνυμα δεν έφευγε ποτέ. Κρατάμε το onDone σε ref και εξαρτόμαστε μόνο από το μήνυμα.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => onDoneRef.current(), ms);
    return () => window.clearTimeout(t);
  }, [message, ms]);
  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite" onPointerDown={() => onDoneRef.current()}>{message}</div>
  );
}
