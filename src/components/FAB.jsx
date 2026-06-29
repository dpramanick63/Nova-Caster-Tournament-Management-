import { useState } from 'react'

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

export default function FAB({ onOpenDialog }) {
  const [expanded, setExpanded] = useState(false)

  function handleClick() {
    if (!expanded) {
      setExpanded(true)
    } else {
      onOpenDialog()
    }
  }

  // collapse on outside click
  function handleBlur(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setExpanded(false)
    }
  }

  return (
    <div className="fab-wrap" onBlur={handleBlur}>
      <button
        className={`fab ${expanded ? 'expanded' : ''}`}
        onClick={handleClick}
        aria-label="Create tournament"
        tabIndex={0}
      >
        <span className="fab__icon"><PlusIcon /></span>
        <span className="fab__label">Create Tournament</span>
      </button>
    </div>
  )
}
