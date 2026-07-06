import { motion, useReducedMotion } from 'motion/react'
import { Math as Formule } from '../../lib/katex'

/**
 * Nœud de l'arbre de compétences : cercle tracé au compas (stroke animé),
 * arc de maîtrise en menthe, icône mathématique KaTeX au centre.
 * @param {{
 *   skill: { id: string, title: string, description: string, icon: string },
 *   maitrise: number,        // 0..1 (état FSRS)
 *   deverrouillee: boolean,  // tous les prérequis ≥ 60 %
 *   index: number,           // position dans le chapitre, pour le stagger
 * }} props
 */
export default function NoeudCompetence({ skill, maitrise, deverrouillee, index }) {
  const mouvementReduit = useReducedMotion()
  const etat = !deverrouillee ? 'verrouillee' : maitrise > 0 ? 'en-cours' : 'disponible'
  const pourcentage = globalThis.Math.round(maitrise * 100)

  const libelle =
    etat === 'verrouillee' ? 'Verrouillé' : etat === 'disponible' ? 'Disponible' : `${pourcentage} %`

  return (
    <li className={`noeud noeud--${etat}`} title={skill.description}>
      <div className="noeud-cercle" aria-hidden="true">
        <svg viewBox="0 0 76 76">
          {deverrouillee ? (
            <motion.circle
              className="noeud-trace"
              cx="38"
              cy="38"
              r="34"
              pathLength="1"
              transform="rotate(-90 38 38)"
              initial={mouvementReduit ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: index * 0.06, ease: 'easeOut' }}
            />
          ) : (
            <circle className="noeud-trace" cx="38" cy="38" r="34" />
          )}
          {maitrise > 0 && (
            <motion.circle
              className="noeud-arc"
              cx="38"
              cy="38"
              r="34"
              pathLength="1"
              transform="rotate(-90 38 38)"
              initial={mouvementReduit ? false : { pathLength: 0 }}
              animate={{ pathLength: maitrise }}
              transition={{ duration: 0.7, delay: 0.3 + index * 0.06, ease: 'easeOut' }}
            />
          )}
        </svg>
        <span className="noeud-icone">
          <Formule latex={skill.icon} />
        </span>
      </div>
      <p className="noeud-titre">{skill.title}</p>
      <p className="noeud-libelle">{libelle}</p>
    </li>
  )
}
