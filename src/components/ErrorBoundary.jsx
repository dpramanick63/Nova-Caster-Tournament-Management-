import { Component } from 'react'

// Stops a single render error from white-screening the whole app
// (important for a live broadcast overlay).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[NOVA] render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32,
          textAlign: 'center', color: '#eef2ff', background: '#0c0d1e',
          fontFamily: 'Rajdhani, sans-serif',
        }}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>
            Something went wrong
          </div>
          <p style={{ color: '#8892b0', maxWidth: 420, fontSize: 15 }}>
            The page hit an unexpected error. Your data is safe — reload to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              height: 44, padding: '0 24px', borderRadius: 8, cursor: 'pointer',
              color: '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 700,
              fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', border: 'none',
              background: 'linear-gradient(135deg,#00d4ff,#7c3aed)',
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
