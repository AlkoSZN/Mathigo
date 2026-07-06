import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'

/**
 * Classement hebdomadaire entre amis (XP de la semaine, lundi → dimanche),
 * demandes d'amitié par e-mail et acceptation des demandes reçues.
 */
export default function PageClassement() {
  const session = useAuth((s) => s.session)
  const [classement, setClassement] = useState(null)
  const [demandes, setDemandes] = useState([])
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(null) // { type: 'succes'|'erreur', texte }

  const charger = useCallback(() => {
    supabase.rpc('classement_hebdo').then(({ data, error }) => {
      if (error) setMessage({ type: 'erreur', texte: error.message })
      else setClassement(data)
    })
    supabase.rpc('demandes_recues').then(({ data }) => setDemandes(data ?? []))
  }, [])

  useEffect(charger, [charger])

  async function envoyerDemande(e) {
    e.preventDefault()
    setMessage(null)
    const { error } = await supabase.rpc('demander_ami', { cible_email: email.trim() })
    if (error) {
      setMessage({ type: 'erreur', texte: error.message })
    } else {
      setMessage({ type: 'succes', texte: `Demande envoyée à ${email.trim()}.` })
      setEmail('')
      charger()
    }
  }

  async function accepter(demandeurId) {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('user_id', demandeurId)
      .eq('friend_id', session.user.id)
    if (error) setMessage({ type: 'erreur', texte: error.message })
    else charger()
  }

  if (classement === null) return null

  return (
    <section className="classement">
      <h1>Classement de la semaine</h1>
      <p className="classement-note">
        XP gagnés depuis lundi, entre amis. Ajoute des amis pour comparer vos scores.
      </p>

      <ol className="classement-liste">
        {classement.map((ligne, i) => (
          <li
            key={ligne.user_id}
            className={
              'classement-ligne carte' +
              (ligne.user_id === session.user.id ? ' classement-ligne--moi' : '')
            }
          >
            <span className="classement-rang">{i + 1}</span>
            <span className="classement-nom">
              {ligne.display_name ?? 'Anonyme'}
              {ligne.user_id === session.user.id && ' (toi)'}
            </span>
            <span className="classement-xp">{ligne.xp_semaine} XP</span>
          </li>
        ))}
      </ol>

      {demandes.length > 0 && (
        <>
          <h2>Demandes reçues</h2>
          <ul className="classement-demandes">
            {demandes.map((d) => (
              <li key={d.user_id} className="carte classement-demande">
                <span>{d.display_name ?? 'Anonyme'}</span>
                <button className="btn btn--menthe" onClick={() => accepter(d.user_id)}>
                  Accepter
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Ajouter un ami</h2>
      <form className="classement-ajout" onSubmit={envoyerDemande}>
        <input
          className="champ"
          type="email"
          required
          placeholder="e-mail de ton ami"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="E-mail de l'ami à ajouter"
        />
        <button className="btn" type="submit">
          Envoyer la demande
        </button>
      </form>
      {message && (
        <p className={message.type === 'succes' ? 'note-succes' : 'note-erreur'}>
          {message.texte}
        </p>
      )}
    </section>
  )
}
