import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'

/** Profil : identité de session et déconnexion. XP et streak en phase 4. */
export default function PageProfil() {
  const session = useAuth((s) => s.session)

  return (
    <section>
      <h1>Profil</h1>
      <div className="carte">
        <p>Connecté en tant que {session?.user?.email}</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>
          Se déconnecter
        </button>
      </div>
    </section>
  )
}
