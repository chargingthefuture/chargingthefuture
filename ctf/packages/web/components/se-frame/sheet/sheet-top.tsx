import type { ReactNode, RefObject } from 'react';
import shared from './sheet-top.module.css';

// The top row of every 3.1 sheet: whatever the sheet shows first (a title, a label, a link, other
// buttons), then Close, always last and always in the top right corner (owner decision,
// 2026-11-17). Each sheet keeps its own row and button styles; the order and the corner are shared.

export function SheetCloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

type Props = {
  className: string;
  closeClassName: string;
  closeLabel: string;
  onClose: () => void;
  closeRef?: RefObject<HTMLButtonElement | null>;
  children?: ReactNode;
};

export function SheetTop({ className, closeClassName, closeLabel, onClose, closeRef, children }: Props) {
  return (
    <div className={`${className} ${shared.top}`}>
      {children}
      <button ref={closeRef} type="button" className={`${closeClassName} ${shared.close}`} aria-label={closeLabel} onClick={onClose}>
        <SheetCloseIcon />
      </button>
    </div>
  );
}
