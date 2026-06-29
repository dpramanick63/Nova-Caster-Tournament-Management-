import { useState, useCallback, useEffect } from 'react'

let _push = null

export function useToast() {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, type = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exit: true } : t))
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 320)
    }, 3000)
  }, [])

  // expose globally for convenience
  useEffect(() => { _push = push; return () => { _push = null } }, [push])

  return { toasts, push }
}

export function toast(message, type = 'info') {
  if (_push) _push(message, type)
}

export function ToastStack({ toasts }) {
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type} ${t.exit ? 'exit' : ''}`}>
          <div className="toast__dot" />
          {t.message}
        </div>
      ))}
    </div>
  )
}
