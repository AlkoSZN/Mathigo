import { motion, useReducedMotion } from 'motion/react'
import { Math as Formule, MathText } from '../../lib/katex'

/** Libellés français des erreurs classiques (fallback : label humanisé). */
const LIBELLES_ERREURS = {
  erreur_signe: 'une erreur de signe',
  produit_oublie: "l'oubli de la formule du produit",
  confusion_derivee_primitive: 'une confusion entre dérivée et primitive',
  terme_croise_oublie: "l'oubli du terme croisé",
  croisement_limites: 'un croisement des limites',
  quotient_inverse: 'un quotient pris à l’envers',
  exposant_faux: 'une erreur sur l’exposant',
  forme_indeterminee_non_trouvee: 'une forme indéterminée non levée',
}

function libelleErreur(errorType) {
  return LIBELLES_ERREURS[errorType] ?? `une erreur type « ${errorType.replaceAll('_', ' ')} »`
}

/**
 * Vue d'une question : énoncé, 4 choix mélangés, indices, puis panneau de
 * feedback (surlignage de la bonne réponse, solution après erreur).
 * @param {{
 *   question: { payload: object, choixMelanges: Array<object> },
 *   phase: 'question' | 'feedback',
 *   choisi: number | null,
 *   indicesOuverts: number,
 *   onRepondre: (index: number) => void,
 *   onIndice: () => void,
 *   onContinuer: () => void,
 * }} props
 */
export default function Question({
  question,
  phase,
  choisi,
  indicesOuverts,
  onRepondre,
  onIndice,
  onContinuer,
}) {
  const mouvementReduit = useReducedMotion()
  const { payload } = question
  const enFeedback = phase === 'feedback'
  const choixChoisi = enFeedback ? question.choixMelanges[choisi] : null
  const correct = choixChoisi?.correct === true

  return (
    <div className="question">
      <MathText className="question-enonce">{payload.statement_latex}</MathText>

      <ol className="question-choix">
        {question.choixMelanges.map((choix, i) => {
          const estChoisi = enFeedback && i === choisi
          const estBonne = enFeedback && choix.correct
          return (
            <li key={i}>
              <button
                type="button"
                className={
                  'choix' +
                  (estBonne ? ' choix--bonne' : '') +
                  (estChoisi && !choix.correct ? ' choix--fausse' : '')
                }
                disabled={enFeedback}
                onClick={() => onRepondre(i)}
              >
                {/* Trait de surligneur animé sur la bonne réponse */}
                {estBonne && (
                  <motion.span
                    className="choix-surligneur"
                    aria-hidden="true"
                    initial={mouvementReduit ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.45, ease: [0.3, 1, 0.4, 1] }}
                  />
                )}
                <span className="choix-contenu">
                  <Formule latex={choix.latex.replaceAll('$', '')} />
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {!enFeedback && (
        <div className="question-indices">
          {payload.hints.slice(0, indicesOuverts).map((indice, i) => (
            <MathText key={i} className="indice">
              {indice}
            </MathText>
          ))}
          {indicesOuverts < 2 && (
            <button type="button" className="btn-indice" onClick={onIndice}>
              {indicesOuverts === 0 ? 'Un indice ? (XP ÷ 2)' : 'Second indice ? (XP ÷ 2)'}
            </button>
          )}
        </div>
      )}

      {enFeedback && (
        <motion.div
          className={correct ? 'feedback feedback--bonne' : 'feedback feedback--fausse'}
          initial={mouvementReduit ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {correct ? (
            <p className="feedback-titre">Bonne réponse.</p>
          ) : (
            <>
              <p className="feedback-titre">
                Pas cette fois — ton choix ressemble à {libelleErreur(choixChoisi.error_type ?? 'inconnue')}.
              </p>
              <MathText className="feedback-solution">{payload.solution_latex}</MathText>
              <p className="feedback-note">Une variante reviendra en fin de session.</p>
            </>
          )}
          <button type="button" className="btn btn--menthe" onClick={onContinuer} autoFocus>
            Continuer
          </button>
        </motion.div>
      )}
    </div>
  )
}
