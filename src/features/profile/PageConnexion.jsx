import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { MathText } from '../../lib/katex'

const REGEX_PSEUDO = /^[a-zA-Z0-9_]{3,20}$/
// Pas un vrai domaine : Supabase Auth exige un e-mail, mais aucun message n'y
// est jamais envoyé (confirmations désactivées). L'unicité de cet e-mail
// technique dans auth.users assure l'unicité du pseudo.
const DOMAINE_INTERNE = 'mathigo.local'

const emailDepuisPseudo = (pseudo) => `${pseudo.toLowerCase()}@${DOMAINE_INTERNE}`

/** Page de connexion par pseudo + mot de passe (aucune adresse e-mail réelle). */
export default function PageConnexion() {
  const session = useAuth((s) => s.session)
  const [mode, setMode] = useState('connexion') // 'connexion' | 'inscription'
  const [pseudo, setPseudo] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [etat, setEtat] = useState({ statut: 'repos' })

  if (session) return <Navigate to="/" replace />

  async function valider(e) {
    e.preventDefault()
    if (!REGEX_PSEUDO.test(pseudo)) {
      setEtat({
        statut: 'erreur',
        message: 'Le pseudo doit faire 3 à 20 caractères : lettres, chiffres ou _ uniquement.',
      })
      return
    }

    setEtat({ statut: 'envoi' })
    const email = emailDepuisPseudo(pseudo)
    const { error } =
      mode === 'inscription'
        ? await supabase.auth.signUp({
            email,
            password: motDePasse,
            options: { data: { username: pseudo } },
          })
        : await supabase.auth.signInWithPassword({ email, password: motDePasse })

    if (!error) {
      setEtat({ statut: 'repos' })
      return
    }

    const msg = error.message.toLowerCase()
    setEtat({
      statut: 'erreur',
      message: msg.includes('already registered')
        ? 'Ce pseudo est déjà pris.'
        : msg.includes('invalid login')
          ? 'Pseudo ou mot de passe incorrect.'
          : error.message,
    })
  }

  return (
    <div className="connexion">
      <h1 className="connexion-titre">
        Math<em>i</em>go
      </h1>
      <MathText className="connexion-accroche">
        L'entraînement quotidien d'analyse, de $(u_n)$ jusqu'à $f'(x)$.
      </MathText>

      <form className="carte connexion-carte" onSubmit={valider}>
        <label htmlFor="pseudo">Pseudo</label>
        <input
          id="pseudo"
          className="champ"
          type="text"
          required
          placeholder="ton_pseudo"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          disabled={etat.statut === 'envoi'}
          autoComplete="username"
        />

        <label htmlFor="mot-de-passe">Mot de passe</label>
        <input
          id="mot-de-passe"
          className="champ"
          type="password"
          required
          minLength={6}
          placeholder="••••••••"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          disabled={etat.statut === 'envoi'}
          autoComplete={mode === 'inscription' ? 'new-password' : 'current-password'}
        />

        <button className="btn" type="submit" disabled={etat.statut === 'envoi'}>
          {etat.statut === 'envoi'
            ? 'Un instant…'
            : mode === 'inscription'
              ? 'Créer mon compte'
              : 'Se connecter'}
        </button>

        {etat.statut === 'erreur' && <p className="note-erreur">{etat.message}</p>}
      </form>

      <button
        type="button"
        className="connexion-bascule"
        onClick={() => {
          setMode(mode === 'connexion' ? 'inscription' : 'connexion')
          setEtat({ statut: 'repos' })
        }}
      >
        {mode === 'connexion' ? "Pas de compte ? Créer un pseudo" : 'Déjà un compte ? Se connecter'}
      </button>
    </div>
  )
}
