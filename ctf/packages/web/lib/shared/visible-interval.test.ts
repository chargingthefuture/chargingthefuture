import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startVisibleInterval } from './visible-interval';

// A minimal stand-in for `document`: a visibility flag plus the visibilitychange listeners.
function installFakeDocument() {
  const listeners = new Set<() => void>();
  const fake = {
    visibilityState: 'visible' as 'visible' | 'hidden',
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal('document', fake);
  return {
    setVisibility(state: 'visible' | 'hidden') {
      fake.visibilityState = state;
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
}

describe('startVisibleInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('ticks on the interval while the tab is visible', () => {
    installFakeDocument();
    const tick = vi.fn();
    const stop = startVisibleInterval(tick, 10_000);
    vi.advanceTimersByTime(30_000);
    expect(tick).toHaveBeenCalledTimes(3);
    stop();
  });

  it('makes no calls while the tab is hidden, and catches up once when it comes back', () => {
    const doc = installFakeDocument();
    const tick = vi.fn();
    const stop = startVisibleInterval(tick, 10_000);
    doc.setVisibility('hidden');
    vi.advanceTimersByTime(60_000);
    expect(tick).not.toHaveBeenCalled();
    doc.setVisibility('visible');
    expect(tick).toHaveBeenCalledTimes(1);
    stop();
  });

  it('stops ticking and removes its listener when stopped', () => {
    const doc = installFakeDocument();
    const tick = vi.fn();
    const stop = startVisibleInterval(tick, 10_000);
    stop();
    vi.advanceTimersByTime(30_000);
    expect(tick).not.toHaveBeenCalled();
    expect(doc.listenerCount()).toBe(0);
  });
});
