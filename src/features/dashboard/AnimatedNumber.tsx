import { useEffect, useRef } from 'react';
import { animate } from 'motion/react';

export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      el.textContent = Math.round(value).toLocaleString();
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration: 1.1,
      ease: 'easeOut',
      onUpdate: (v) => (el.textContent = Math.round(v).toLocaleString()),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);

  return <span ref={ref} className={className}>{Math.round(value).toLocaleString()}</span>;
}
