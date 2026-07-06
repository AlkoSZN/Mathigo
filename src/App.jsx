import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import PageConnexion from './features/profile/PageConnexion'
import PageProfil from './features/profile/PageProfil'
import PageArbre from './features/tree/PageArbre'
import PageSession from './features/session/PageSession'
import PageRevisions from './features/session/PageRevisions'
import PageClassement from './features/leaderboard/PageClassement'
import { useAuth } from './store/auth'

/** Garde d'authentification : layout si connecté, sinon page de connexion. */
function RoutesProtegees() {
  const session = useAuth((s) => s.session)
  if (session === undefined) return null // session initiale en cours de chargement
  return session ? <AppLayout /> : <Navigate to="/connexion" replace />
}

export default function App() {
  useEffect(() => useAuth.getState().init(), [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/connexion" element={<PageConnexion />} />
        <Route element={<RoutesProtegees />}>
          <Route index element={<PageArbre />} />
          <Route path="/session/:skillId" element={<PageSession />} />
          <Route path="/revisions" element={<PageRevisions />} />
          <Route path="/classement" element={<PageClassement />} />
          <Route path="/profil" element={<PageProfil />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
