import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function ConfirmDialog({
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm,
  onCancel,
}) {
  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onCancel()
  }

  // Rendered into <body> via a portal so position:fixed centres on the
  // viewport — not inside a transformed ancestor (e.g. an animated card).
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={handleBackdrop} onClick={e => e.stopPropagation()}>
      <div className="confirm-dialog" role="alertdialog" aria-modal="true">
        <div className={`confirm-icon ${danger ? 'danger' : ''}`}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>

        <p className="confirm-title">{title}</p>
        {message && <p className="confirm-message">{message}</p>}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`confirm-ok ${danger ? 'danger' : ''}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
