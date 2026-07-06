import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { MathText } from '../../lib/katex'

/**
 * Question « remise en ordre » : reconstituer un énoncé (définition, théorème,
 * lemme) en piochant des fragments mélangés, façon banc de mots Duolingo.
 * Les distracteurs éventuels doivent rester dans le banc.
 * @param {{
 *   question: { payload: object, fragmentsMelanges: string[] },
 *   phase: 'question' | 'feedback',
 *   choisi: string[] | null,   // fragments choisis, en phase feedback
 *   indicesOuverts: number,
 *   onRepondre: (action: {correct: boolean, chosenErrorType: ?string, detail: string[]}) => void,
 *   onIndice: () => void,
 *   onContinuer: () => void,
 * }} props
 */
export default function QuestionOrdre({
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
  const [selection, setSelection] = useState([]) // indices dans fragmentsMelanges
  const enFeedback = phase === 'feedback'

  const correct =
    enFeedback &&
    choisi.length === payload.fragments.length &&
    choisi.every((f, i) => f === payload.fragments[i])

  function valider() {
    const fragments = selection.map((i) => question.fragmentsMelanges[i])
    const juste =
      fragments.length === payload.fragments.length &&
      fragments.every((f, i) => f === payload.fragments[i])
    onRepondre({
      correct: juste,
      chosenErrorType: juste ? null : 'ordre_incorrect',
      detail: fragments,
    })
  }

  return (
    <div className="question">
      <MathText className="question-enonce">{payload.statement_latex}</MathText>

      {/* Zone de réponse : les fragments choisis, dans l'ordre */}
      <div
        className={
          'ordre-reponse' +
          (enFeedback ? (correct ? ' ordre-reponse--bonne' : ' ordre-reponse--fausse') : '')
        }
        aria-label="Ta réponse, dans l'ordre"
      >
        {(enFeedback ? choisi : selection.map((i) => question.fragmentsMelanges[i])).map(
          (fragment, i) => (
            <button
              key={i}
              type="button"
              className="fragment fragment--choisi"
              disabled={enFeedback}
              onClick={() => setSelection(selection.filter((_, j) => j !== i))}
            >
              <MathText as="span">{fragment}</MathText>
            </button>
          ),
        )}
        {!enFeedback && selection.length === 0 && (
          <span className="ordre-consigne">Touche les fragments ci-dessous dans l'ordre.</span>
        )}
      </div>

      {/* Banc de fragments restants */}
      {!enFeedback && (
        <div className="ordre-banc">
          {question.fragmentsMelanges.map((fragment, i) =>
            selection.includes(i) ? null : (
              <button
                key={i}
                type="button"
                className="fragment"
                onClick={() => setSelection([...selection, i])}
              >
                <MathText as="span">{fragment}</MathText>
              </button>
            ),
          )}
        </div>
      )}

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
          <button
            type="button"
            className="btn btn--menthe"
            disabled={selection.length === 0}
            onClick={valider}
          >
            Valider
          </button>
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
              <p className="feedback-titre">Pas cette fois. L'ordre correct :</p>
              <MathText className="feedback-solution">{payload.fragments.join(' ')}</MathText>
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
