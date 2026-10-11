import { useEffect, useRef } from 'react';

// A native modal dialog over the page: the list underneath keeps its scroll position and filters, Esc or a click on
// the backdrop closes it, and focus goes back to the button that opened it.
export default function Modal({ label, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => { if (opener && opener.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  return (
    <dialog ref={ref} className="modal" aria-label={label}
      onCancel={e => { e.preventDefault(); onClose(); }}
      onClick={e => { if (e.target === ref.current) onClose(); }}>
      {children}
    </dialog>
  );
}
