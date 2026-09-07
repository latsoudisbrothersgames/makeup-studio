import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { playSound } from '../../audio/soundManager';
import './Button.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'mint' | 'sun' | 'lilac';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'lg' | 'xl';
  children: ReactNode;
  silent?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', children, silent = false, icon, onClick, className = '', ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn--${variant} btn--${size} ${className}`}
      onClick={(e) => {
        if (!silent) playSound('click');
        onClick?.(e);
      }}
      {...rest}
    >
      {icon && <span className="btn__icon" aria-hidden="true">{icon}</span>}
      <span className="btn__label">{children}</span>
    </button>
  );
}
