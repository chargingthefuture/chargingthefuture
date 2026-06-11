'use client';

import { useEffect, useRef, useState } from 'react';
import { HelpCircle, AlertCircle } from 'lucide-react';
import { BugReportModal } from './bug-report-modal';
import styles from './bug-report-modal.module.css';
import railStyles from '../community-shell/community-shell.module.css';

// Global "?" Help control for the authenticated shell's icon rail. Clicking it opens
// a small popover; the popover's one live item, "Report a problem", opens the modal.
//
// The design's popover also showed a "Help center" link, but no help-center URL
// exists anywhere in the app or config yet, so that item is omitted rather than
// shipped as a dead link. Add it back when a real URL exists.
export function HelpControl() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close the popover on an outside click or Escape.
  useEffect(() => {
    if (!popoverOpen) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setPopoverOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPopoverOpen(false);
      }
    }
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [popoverOpen]);

  return (
    <div className={styles.helpWrap} ref={wrapRef}>
      <button
        type="button"
        className={
          popoverOpen
            ? `${railStyles.iconRailBtn} ${railStyles.iconRailBtnActive}`
            : railStyles.iconRailBtn
        }
        onClick={() => setPopoverOpen((open) => !open)}
        aria-label="Help"
        aria-haspopup="menu"
        aria-expanded={popoverOpen}
      >
        <HelpCircle size={18} />
      </button>

      {popoverOpen && (
        <div className={styles.helpPopover} role="menu" aria-label="Help">
          <button
            type="button"
            className={styles.helpItem}
            role="menuitem"
            onClick={() => {
              setPopoverOpen(false);
              setModalOpen(true);
            }}
          >
            <AlertCircle size={14} className={styles.helpItemIcon} aria-hidden="true" />
            <span className={styles.helpItemLabel}>Report a problem</span>
          </button>
        </div>
      )}

      <BugReportModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
