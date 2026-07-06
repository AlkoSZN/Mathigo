import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'

/** Profil : pseudo éditable, XP total, streak, précision globale, déconnexion. */
export default function PageProfil() {
  const session = useAuth((s) => s.session)
  const [profil, setProfil] = useState(null)
  const [stats, setStats] = useState(null)
  const [pseudo, setPseudo] = useState('')
  const [enregistre, setEnregistre] = useState(false)

  useEffect(() => {
    if (!session) return
    supabase
      .from('profiles')
      .select('display_name, xp, streak_days')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        setProfil(data)
        setPseudo(data?.display_name ?? '')
      })
    supabase
      .from('attempts')
      .select('correct')
      .eq('user_id', session.user.id)
      .then(({ data }) => {
        const total = data?.length ?? 0
        const bonnes = data?.filter((a) => a.correct).length ?? 0
        setStats({ total, precision: total ? Math.round((100 * bonnes) / total) : null })
      })
  }, [session])

  async function enregistrerPseudo(e) {
    e.preventDefault()
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: pseudo.trim() })
      .eq('user_id', session.user.id)
    if (!error) {
      setEnregistre(true)
      setTimeout(() => setEnregistre(false), 2000)
    }
  }

  if (!profil || !stats) return null

  return (
    <section className="profil">
      <h1>Profil</h1>

      <div className="profil-stats">
        <div className="carte profil-stat">
          <span className="profil-stat-valeur">{profil.xp}</span>
          <span className="profil-stat-libelle">XP au total</span>
        </div>
        <div className="carte profil-stat">
          <span className="profil-stat-valeur">{profil.streak_days}</span>
          <span className="profil-stat-libelle">
            jour{profil.streak_days > 1 ? 's' : ''} d'affilée
          </span>
        </div>
        <div className="carte profil-stat">
          <span className="profil-stat-valeur">
            {stats.precision === null ? '—' : `${stats.precision} %`}
          </span>
          <span className="profil-stat-libelle">
            de précision ({stats.total} réponse{stats.total > 1 ? 's' : ''})
          </span>
        </div>
      </div>

      <form className="carte profil-carte" onSubmit={enregistrerPseudo}>
        <label htmlFor="pseudo">Pseudo (visible par tes amis)</label>
        <input
          id="pseudo"
          className="champ"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          required
          maxLength={40}
        />
        <button className="btn" type="submit">
          Enregistrer
        </button>
        {enregistre && <p className="note-succes">Pseudo enregistré.</p>}
      </form>

      <div className="carte profil-carte">
        <p>Connecté en tant que {session?.user?.email}</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>
          Se déconnecter
        </button>
      </div>
    </section>
  )
}
