import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { MathText } from '../../lib/katex'

/** Page de connexion par lien magique (aucun mot de passe). */
export default function PageConnexion() {
  const session = useAuth((s) => s.session)
  const [email, setEmail] = useState('')
  const [etat, setEtat] = useState({ statut: 'repos' })

  if (session) return <Navigate to="/" replace />

  async function envoyerLien(e) {
    e.preventDefault()
    setEtat({ statut: 'envoi' })
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setEtat({ statut: 'erreur', message: error.message })
    } else {
      setEtat({ statut: 'envoye' })
    }
  }

  return (
    <div className="connexion">
      <h1 className="connexion-titre">
        Math<em>i</em>go
      </h1>
      <MathText className="connexion-accroche">
        L'entraînement quotidien d'analyse, de $(u_n)$ jusqu'à $f'(x)$.
      </MathText>

      <form className="carte connexion-carte" onSubmit={envoyerLien}>
        <label htmlFor="email">Adresse e-mail</label>
        <input
          id="email"
          className="champ"
          type="email"
          required
          placeholder="prenom@exemple.fr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={etat.statut === 'envoi' || etat.statut === 'envoye'}
        />
        {etat.statut === 'envoye' ? (
          <p className="note-succes">
            Lien envoyé à {email}. Ouvre-le pour te connecter.
          </p>
        ) : (
          <button className="btn" type="submit" disabled={etat.statut === 'envoi'}>
            {etat.statut === 'envoi' ? 'Envoi en cours…' : 'Recevoir le lien de connexion'}
          </button>
        )}
        {etat.statut === 'erreur' && (
          <p className="note-erreur">
            L'envoi a échoué ({etat.message}). Vérifie l'adresse et réessaie.
          </p>
        )}
      </form>
    </div>
  )
}
