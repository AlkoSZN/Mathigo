import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs'

/**
 * Wrapper ts-fsrs : une carte FSRS par (utilisateur, compétence).
 * La carte est stockée telle quelle dans reviews.fsrs_state (jsonb) ;
 * les dates y sont des chaînes ISO, ré-hydratées ici.
 */

const planificateur = fsrs(generatorParameters())

export { Rating }

/** Ré-hydrate une carte venant du jsonb (dates ISO → Date). */
function hydrater(fsrsState) {
  return {
    ...fsrsState,
    due: new Date(fsrsState.due),
    last_review: fsrsState.last_review ? new Date(fsrsState.last_review) : undefined,
  }
}

/**
 * Note FSRS d'une session à partir des réponses aux questions initiales
 * (le rattrapage ne compte pas) : taux de bonnes réponses.
 * @param {Array<{correct: boolean}>} reponsesInitiales
 * @returns {number} Rating.Again | Hard | Good | Easy
 */
export function noteDepuisSession(reponsesInitiales) {
  const taux =
    reponsesInitiales.filter((r) => r.correct).length / Math.max(reponsesInitiales.length, 1)
  if (taux < 0.5) return Rating.Again
  if (taux < 0.75) return Rating.Hard
  if (taux < 1) return Rating.Good
  return Rating.Easy
}

/**
 * Révise la carte d'une compétence (ou en crée une au premier passage).
 * @param {object|null} fsrsState carte jsonb existante, ou null
 * @param {number} note Rating de la session
 * @param {Date} [quand]
 * @returns {{ carte: object, dueAt: string, maitrise: number }}
 *   `carte` à stocker dans fsrs_state, `dueAt` ISO pour due_at,
 *   `maitrise` (rétrievabilité juste après révision, 0..1) pour mastery.
 */
export function reviser(fsrsState, note, quand = new Date()) {
  const carte = fsrsState ? hydrater(fsrsState) : createEmptyCard(quand)
  const { card } = planificateur.next(carte, quand, note)
  return {
    carte: card,
    dueAt: card.due.toISOString(),
    maitrise: maitriseCourante(card, quand),
  }
}

/**
 * Point de bascule de la maturité : stabilité (en jours) donnant 50 % de
 * maturité. Une session parfaite (Easy, stabilité ≈ 8 j) donne ≈ 62 % —
 * juste au-dessus du seuil de déverrouillage de l'arbre.
 */
const STABILITE_REF = 5

/**
 * Maîtrise vivante d'une compétence : rétrievabilité FSRS à l'instant t
 * (qui DÉCROÎT naturellement avec le temps sans révision) pondérée par la
 * maturité de la stabilité mémoire — juste après une première session la
 * rétrievabilité vaut 1, seule la stabilité distingue un souvenir installé.
 * @param {object|null} fsrsState carte jsonb, ou null si jamais révisée
 * @returns {number} 0..1
 */
export function maitriseCourante(fsrsState, quand = new Date()) {
  if (!fsrsState || !fsrsState.last_review) return 0
  const carte = fsrsState.due instanceof Date ? fsrsState : hydrater(fsrsState)
  const retrievabilite = planificateur.get_retrievability(carte, quand, false)
  const maturite = carte.stability / (carte.stability + STABILITE_REF)
  return retrievabilite * maturite
}
