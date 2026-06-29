import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing           from './pages/Landing'
import Dashboard         from './pages/Dashboard'
import TournamentDetail  from './pages/TournamentDetail'
import Overlay           from './pages/Overlay'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                  element={<Landing />} />
        <Route path="/dashboard"         element={<Dashboard />} />
        <Route path="/tournament/:id"    element={<TournamentDetail />} />
        <Route path="/overlay/:id"       element={<Overlay />} />
        <Route path="*"                  element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
