import { useEffect, useReducer, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { supabase } from '../../lib/supabase'
import arbre from '../../../content/skill-tree.json'
import {
  creerSession,
  questionCourante,
  reducteur,
  xpSession,
  TAILLE_SESSION,
} from './machine'
import Question from './Question'
import FinSession from './FinSession'

const skills = new Map(arbre.chapters.flatMap((c) => c.skills.map((s) => [s.id, s])))

/** Date locale au format YYYY-MM-DD (streak = jours civils locaux). */
function dateLocale(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Met à jour XP, streak et date d'activité du profil à la fin d'une session.
 * @returns {Promise<number>} le streak après mise à jour
 */
async function terminerSession(xpGagne) {
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user.id
  const { data: profil, error } = await supabase
    .from('profiles')
    .select('xp, streak_days, last_activity_date')
    .eq('user_id', userId)
    .single()
  if (error) throw error

  const aujourdhui = dateLocale()
  const hier = dateLocale(new Date(Date.now() - 86_400_000))
  let streak = profil.streak_days
  if (profil.last_activity_date !== aujourdhui) {
    streak = profil.last_activity_date === hier ? streak + 1 : 1
  }

  const { error: erreurMaj } = await supabase
    .from('profiles')
    .update({ xp: profil.xp + xpGagne, streak_days: streak, last_activity_date: aujourdhui })
    .eq('user_id', userId)
  if (erreurMaj) throw erreurMaj
  return streak
}

/** Page de session : charge la banque d'exercices, déroule la machine à états. */
export default function PageSession() {
  const { skillId } = useParams()
  const skill = skills.get(skillId)
  const [banque, setBanque] = useState(null)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    let annule = false
    supabase
      .from('exercises')
      .select('id, difficulty, payload')
      .eq('skill_id', skillId)
      .then(({ data, error }) => {
        if (annule) return
        if (error) setErreur(error.message)
        else setBanque(data)
      })
    return () => {
      annule = true
    }
  }, [skillId])

  if (!skill) return <p className="note-erreur">Compétence inconnue : {skillId}</p>
  if (erreur) return <p className="note-erreur">Chargement impossible ({erreur}).</p>
  if (banque === null) return null
  if (banque.length === 0) {
    return (
      <section>
        <h1>{skill.title}</h1>
        <p>
          Aucun exercice disponible pour cette compétence pour l'instant.{' '}
          <Link to="/">Retour à l'arbre</Link>
        </p>
      </section>
    )
  }
  return <Session skill={skill} banque={banque} />
}

function Session({ skill, banque }) {
  const mouvementReduit = useReducedMotion()
  const [etat, envoyer] = useReducer(reducteur, banque, creerSession)
  const [streak, setStreak] = useState(null)
  const finPersistee = useRef(false)

  const question = questionCourante(etat)
  const xp = xpSession(etat)

  // Journal des tentatives : insertion au fil de l'eau, à chaque réponse
  const nbEnregistrees = useRef(0)
  useEffect(() => {
    const nouvelles = etat.reponses.slice(nbEnregistrees.current)
    if (nouvelles.length === 0) return
    nbEnregistrees.current = etat.reponses.length
    supabase.auth.getUser().then(({ data }) =>
      supabase
        .from('attempts')
        .insert(
          nouvelles.map(({ indices, ...r }) => ({ ...r, user_id: data.user.id })),
        )
        .then(({ error }) => {
          if (error) console.error('attempts non enregistrées :', error.message)
        }),
    )
  }, [etat.reponses])

  // Fin de session : XP + streak persistés une seule fois
  useEffect(() => {
    if (etat.phase !== 'fin' || finPersistee.current) return
    finPersistee.current = true
    terminerSession(xp)
      .then(setStreak)
      .catch((e) => console.error('profil non mis à jour :', e.message))
  }, [etat.phase, xp])

  if (etat.phase === 'fin') {
    const nbBonnes = etat.reponses.filter((r) => r.correct).length
    return (
      <FinSession
        xp={xp}
        nbBonnes={nbBonnes}
        nbQuestions={etat.reponses.length}
        sansFaute={nbBonnes === etat.reponses.length}
        streak={streak}
      />
    )
  }

  const numero = etat.index + 1
  const total = etat.file.length
  const enRattrapage = etat.index >= TAILLE_SESSION

  return (
    <section className="session">
      <header className="session-entete">
        <div>
          <h1 className="session-titre">{skill.title}</h1>
          <p className="session-avancement">
            {enRattrapage ? 'Rattrapage — ' : ''}Question {numero}/{total} · +{xp} XP
          </p>
        </div>
        <Link to="/" className="session-quitter" aria-label="Quitter la session">
          Quitter
        </Link>
      </header>

      <div className="session-barre" role="progressbar" aria-valuenow={numero} aria-valuemax={total}>
        <div className="session-barre-remplie" style={{ width: `${(etat.index / total) * 100}%` }} />
      </div>

      {/* Transition entre questions : slide horizontal */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={etat.index}
          initial={mouvementReduit ? false : { x: 48, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={mouvementReduit ? undefined : { x: -48, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <Question
            question={question}
            phase={etat.phase}
            choisi={etat.choisi}
            indicesOuverts={etat.indicesOuverts}
            onRepondre={(index) => envoyer({ type: 'REPONDRE', index })}
            onIndice={() => envoyer({ type: 'INDICE' })}
            onContinuer={() => envoyer({ type: 'CONTINUER' })}
          />
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
