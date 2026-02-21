import { useEffect, useRef } from 'react';

export default function useOptimizedAnimation({ onApply, onStopped }) {
  const last = useRef({ t0: 0, m0: 1, t1: 0, m1: 1 });
  const running = useRef(false);
  const crashed = useRef(false);
  const rafId = useRef(null);

  const updateServerFrame = (serverTime, multiplier) => {
    const prev = last.current;
    last.current = {
      t0: prev.t1 || serverTime - 1,
      m0: prev.m1 || multiplier,
      t1: serverTime,
      m1: multiplier
    };
  };

  const setCrashed = (multiplier) => {
    crashed.current = true;
    last.current = { t0: 0, m0: multiplier, t1: 1, m1: multiplier };
  };

  const start = () => {
    if (running.current) return;
    running.current = true;
    crashed.current = false;
    const loop = () => {
      if (!running.current) return;
      const { t0, m0, t1, m1 } = last.current;
      let value = m1;
      if (!crashed.current && t1 > t0) {
        const now = Date.now();
        const p = Math.max(0, Math.min(1, (now - t0) / (t1 - t0)));
        value = m0 + (m1 - m0) * p;
      }
      onApply && onApply(value);
      rafId.current = requestAnimationFrame(loop);
    };
    rafId.current = requestAnimationFrame(loop);
  };

  const stop = () => {
    running.current = false;
    if (rafId.current) cancelAnimationFrame(rafId.current);
    onStopped && onStopped();
  };

  useEffect(() => {
    const vis = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener('visibilitychange', vis);
    start();
    return () => {
      document.removeEventListener('visibilitychange', vis);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { updateServerFrame, setCrashed, start, stop };
}
