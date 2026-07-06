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
 * Taux de bonnes réponses aux questions initiales d'une session (le
 * rattrapage ne compte pas) — sert à la fois de note FSRS et de qualité de
 * session pour la maîtrise affichée.
 * @param {Array<{correct: boolean}>} reponsesInitiales
 * @returns {number} 0..1
 */
export function tauxReussite(reponsesInitiales) {
  return reponsesInitiales.filter((r) => r.correct).length / Math.max(reponsesInitiales.length, 1)
}

/**
 * Note FSRS d'une session à partir du taux de bonnes réponses.
 * @param {number} taux 0..1
 * @returns {number} Rating.Again | Hard | Good | Easy
 */
export function noteDepuisTaux(taux) {
  if (taux < 0.5) return Rating.Again
  if (taux < 0.75) return Rating.Hard
  if (taux < 1) return Rating.Good
  return Rating.Easy
}

/**
 * Révise la carte d'une compétence (ou en crée une au premier passage).
 * @param {object|null} fsrsState carte jsonb existante, ou null
 * @param {number} note Rating de la session (calibre l'espacement des futures
 *   révisions et la vitesse de décroissance, via ts-fsrs)
 * @param {number} qualiteSession taux de bonnes réponses 0..1, stocké dans la
 *   carte : c'est lui qui fixe la maîtrise juste après la session
 * @param {Date} [quand]
 * @returns {{ carte: object, dueAt: string, maitrise: number }}
 */
export function reviser(fsrsState, note, qualiteSession, quand = new Date()) {
  const carte = fsrsState ? hydrater(fsrsState) : createEmptyCard(quand)
  const { card } = planificateur.next(carte, quand, note)
  const carteAvecQualite = { ...card, qualite_session: qualiteSession }
  return {
    carte: carteAvecQualite,
    dueAt: card.due.toISOString(),
    maitrise: maitriseCourante(carteAvecQualite),
  }
}

/**
 * Maîtrise d'une compétence : qualité de la dernière session (taux de bonnes
 * réponses, fixé à la fin de chaque session — pas de plafond artificiel :
 * 90 % de bonnes réponses donnent 90 % de maîtrise). Reste constante tant
 * que la compétence n'est pas retravaillée : aucune décroissance dans le
 * temps (décision explicite — pas de dégradation façon Duolingo).
 * @param {object|null} fsrsState carte jsonb, ou null si jamais révisée
 * @returns {number} 0..1
 */
export function maitriseCourante(fsrsState) {
  return fsrsState?.qualite_session ?? 0
}
