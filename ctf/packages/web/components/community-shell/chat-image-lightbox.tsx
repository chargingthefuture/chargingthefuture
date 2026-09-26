'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import styles from './community-shell.module.css';
import { cycleFocusTrap } from './dialog-focus';
import type { ChatMessageImage as ChatMessageImageData } from './shell-types';

type ChatImageLightboxProps = {
  image: ChatMessageImageData;
  onDismiss: () => void;
};

// Full-size view of a Commons picture. Installed as a standalone PWA (manifest `display:
// 'standalone'`), so there is no browser chrome to navigate back with — a plain
// `<a target="_blank">` to the image left a member stranded on a bare native image viewer with no
// way back into the app short of a force-close. This is an in-app modal instead, dismissed by the
// backdrop, the X, or Escape, mirroring `comic-consent-modal.tsx`.
export function ChatImageLightbox({ image, onDismiss }: ChatImageLightboxProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onDismiss();
        return;
      }
      if (event.key !== 'Tab') return;
      const root = modalRef.current;
      if (root) cycleFocusTrap(root, event);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      opener?.focus?.();
    };
  }, [onDismiss]);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close is a mouse convenience; keyboard users close via Escape (handler above) or the visible close button.
    <div
      className={styles.chatImageLightboxOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={image.alt}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div className={styles.chatImageLightboxModal} ref={modalRef}>
        <button
          ref={closeRef}
          type="button"
          className={styles.chatImageLightboxClose}
          onClick={onDismiss}
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <img src={image.url} alt={image.alt} className={styles.chatImageLightboxImage} />
      </div>
    </div>
  );
}
