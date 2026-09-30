import { useEffect, useRef } from 'react';

// Focuses the returned ref whenever `active` is true and `seq` changes (composer opened / re-opened).
export function useFocusOn(active, seq) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return;
    const id = requestAnimationFrame(() => ref.current && ref.current.focus());
    return () => cancelAnimationFrame(id);
  }, [active, seq]);
  return ref;
}
