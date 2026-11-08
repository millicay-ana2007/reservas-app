import { useEffect } from "react";

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    const alApretar = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", alApretar);
    return () => window.removeEventListener("keydown", alApretar);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="btn btn-quiet" onClick={onClose} aria-label="Cerrar">
            Cerrar
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
