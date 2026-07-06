import { NavLink, Outlet } from 'react-router-dom'

/** Coquille de l'application : en-tête avec navigation, contenu routé. */
export default function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to="/" className="app-logo">
          Math<em>i</em>go
        </NavLink>
        <nav className="app-nav" aria-label="Navigation principale">
          <NavLink to="/" end>
            Arbre
          </NavLink>
          <NavLink to="/revisions">Révisions</NavLink>
          <NavLink to="/classement">Classement</NavLink>
          <NavLink to="/profil">Profil</NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
