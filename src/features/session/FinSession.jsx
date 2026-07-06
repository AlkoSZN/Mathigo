import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'

/**
 * Écran de fin de session : une seule célébration orchestrée — compteur d'XP,
 * sans-faute éventuel, streak — puis retour à l'arbre.
 * @param {{
 *   xp: number,
 *   nbBonnes: number,
 *   nbQuestions: number,
 *   sansFaute: boolean,
 *   streak: number | null,   // streak après mise à jour, null tant que non persisté
 *   maitrise: number | null, // maîtrise FSRS 0..1 après révision
 * }} props
 */
export default function FinSession({ xp, nbBonnes, nbQuestions, sansFaute, streak, maitrise }) {
  const mouvementReduit = useReducedMotion()
  const [xpAffiche, setXpAffiche] = useState(mouvementReduit ? xp : 0)

  // Compteur d'XP qui monte (450 ms), désactivé si mouvement réduit
  useEffect(() => {
    if (mouvementReduit) return
    const debut = performance.now()
    let animation
    const tick = (t) => {
      const avancement = Math.min((t - debut) / 450, 1)
      setXpAffiche(Math.round(xp * avancement))
      if (avancement < 1) animation = requestAnimationFrame(tick)
    }
    animation = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animation)
  }, [xp, mouvementReduit])

  const apparition = (delai) =>
    mouvementReduit
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: delai, type: 'spring', stiffness: 260, damping: 22 },
        }

  return (
    <div className="fin-session">
      <motion.h1 {...apparition(0)}>Session terminée</motion.h1>

      <motion.p className="fin-xp" {...apparition(0.15)}>
        <span className="fin-xp-valeur">+{xpAffiche}</span> XP
      </motion.p>

      <motion.p className="fin-detail" {...apparition(0.3)}>
        {nbBonnes} bonne{nbBonnes > 1 ? 's' : ''} réponse{nbBonnes > 1 ? 's' : ''} sur{' '}
        {nbQuestions}
        {sansFaute && ' — sans faute, bravo.'}
      </motion.p>

      {maitrise !== null && (
        <motion.p className="fin-detail" {...apparition(0.4)}>
          Maîtrise de la compétence : {Math.round(maitrise * 100)} %
        </motion.p>
      )}

      {streak !== null && (
        <motion.p className="fin-streak" {...apparition(0.45)}>
          Série : {streak} jour{streak > 1 ? 's' : ''} d'affilée
        </motion.p>
      )}

      <motion.div {...apparition(0.6)}>
        <Link className="btn" to="/">
          Retour à l'arbre
        </Link>
      </motion.div>
    </div>
  )
}
