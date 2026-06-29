import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()
  const btnRef   = useRef(null)
  const [phase, setPhase] = useState(null) // null | 'flash' | 'wipe'

  function handleStart(e) {
    const btn  = btnRef.current
    const rect = btn.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const rip  = document.createElement('span')
    rip.className = 'ripple'
    rip.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px;`
    btn.appendChild(rip)
    setTimeout(() => rip.remove(), 700)

    setPhase('flash')
    setTimeout(() => setPhase('wipe'), 180)
    setTimeout(() => navigate('/dashboard'), 860)
  }

  return (
    <div className="landing">
      {/* background video */}
      <video
        className="landing__video"
        src="/303971_trimmed.mp4"
        autoPlay muted loop playsInline
      />
      <div className="landing__video-blur" />
      <div className="landing__vignette" />

      {/* ambient background */}
      <div className="landing__grid" />
      <div className="landing__glow landing__glow--1" />
      <div className="landing__glow landing__glow--2" />
      <div className="landing__glow landing__glow--3" />

      {/* content */}
      <div className="landing__content">
        <div className="landing__eyebrow">
          <span className="landing__eyebrow-line" />
          <p className="landing__tag">Tournament Management System</p>
          <span className="landing__eyebrow-line" />
        </div>

        <h1 className="landing__title">NOVA</h1>

        <p className="landing__sub">Command. Control. Conquer.</p>

        <button ref={btnRef} className="landing__btn" onClick={handleStart}>
          <span className="landing__btn-glow" />
          Initialize System
        </button>
      </div>

      {/* screen transitions */}
      {phase === 'flash' && <div className="t-flash" />}
      {phase === 'wipe'  && <div className="t-wipe" />}
    </div>
  )
}
