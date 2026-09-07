import { useEffect, useRef, type ReactNode } from 'react';
import { S } from '../../data/strings';
import { Button } from '../Button/Button';
import './Dialog.css';

interface DialogProps {
  title: string;
  children?: ReactNode;
  actions: ReactNode;
  onClose(): void;
}

export function Dialog({ title, children, actions, onClose }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus]');
    first?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}>
        <h2 id="dialog-title" className="dialog__title">{title}</h2>
        {children && <div className="dialog__body">{children}</div>}
        <div className="dialog__actions">{actions}</div>
      </div>
    </div>
  );
}

interface ConfirmProps {
  title: string;
  body?: string;
  yesLabel: string;
  noLabel?: string;
  danger?: boolean;
  onYes(): void;
  onNo(): void;
}

export function ConfirmDialog({ title, body, yesLabel, noLabel = S.no, danger = true, onYes, onNo }: ConfirmProps) {
  return (
    <Dialog
      title={title}
      onClose={onNo}
      actions={
        <>
          <Button variant="ghost" size="lg" onClick={onNo} data-autofocus data-action="confirm-no">{noLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} size="lg" onClick={onYes} data-action="confirm-yes">{yesLabel}</Button>
        </>
      }
    >
      {body && <p>{body}</p>}
    </Dialog>
  );
}
