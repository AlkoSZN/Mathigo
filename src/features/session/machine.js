/**
 * Machine à états de la session de quiz : question → feedback → suivant → fin.
 * Reducer pur, sans effet de bord — la persistance (attempts, profil) est
 * faite par les composants à partir de l'état.
 */

/** Nombre de questions d'une session standard. */
export const TAILLE_SESSION = 8

/** XP d'une bonne réponse selon le nombre d'indices consommés : 10 → 5 → 2. */
export const XP_QUESTION = [10, 5, 2]
export const BONUS_FIN = 10
export const BONUS_SANS_FAUTE = 20

/** Mélange de Fisher-Yates (copie). */
export function melanger(tableau) {
  const t = [...tableau]
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[t[i], t[j]] = [t[j], t[i]]
  }
  return t
}

/** Format d'un exercice ('qcm' par défaut pour la banque historique). */
export function formatDe(exercice) {
  return exercice.payload.format ?? 'qcm'
}

/** Quotas de formats par session : un peu de chaque quand la banque le permet. */
const QUOTAS = [
  ['remise_en_ordre', 2],
  ['qcm_theorique', 2],
]

/** Prépare un exercice à l'affichage : mélange des choix ou des fragments. */
function preparer(exercice) {
  if (formatDe(exercice) === 'remise_en_ordre') {
    const { fragments, distracteurs = [] } = exercice.payload
    return { ...exercice, fragmentsMelanges: melanger([...fragments, ...distracteurs]) }
  }
  return { ...exercice, choixMelanges: melanger(exercice.payload.choices) }
}

/**
 * Crée l'état initial d'une session.
 * @param {Array<{id: string, payload: object}>} banque exercices de la compétence,
 *   déjà ordonnés par priorité (ratés, puis jamais vus, puis le reste). La session
 *   respecte les QUOTAS par format puis complète en QCM de calcul ; la réserve
 *   sert au rattrapage.
 * @returns l'état initial de la machine
 */
export function creerSession(banque) {
  const tires = []
  const prendre = (source, n) => {
    for (const ex of source) {
      if (n <= 0) break
      if (!tires.includes(ex)) {
        tires.push(ex)
        n--
      }
    }
  }
  for (const [format, quota] of QUOTAS) prendre(banque.filter((e) => formatDe(e) === format), quota)
  prendre(banque.filter((e) => formatDe(e) === 'qcm'), TAILLE_SESSION - tires.length)
  prendre(banque, TAILLE_SESSION - tires.length) // complément toutes catégories

  return {
    phase: 'question', // 'question' | 'feedback' | 'fin'
    file: melanger(tires).map(preparer),
    reserve: banque.filter((ex) => !tires.includes(ex)), // variantes pour le rattrapage
    index: 0,
    indicesOuverts: 0, // indices consommés sur la question courante
    choisi: null, // choix cliqué pendant la phase feedback
    reponses: [], // { exercise_id, correct, chosen_error_type, duration_ms, indices }
    debutQuestion: Date.now(),
  }
}

/** Question courante, ou undefined en phase 'fin'. */
export function questionCourante(etat) {
  return etat.file[etat.index]
}

/** XP total de la session (réponses + bonus de fin + sans-faute). */
export function xpSession(etat) {
  const base = etat.reponses.reduce(
    (somme, r) => somme + (r.correct ? XP_QUESTION[Math.min(r.indices, 2)] : 0),
    0,
  )
  if (etat.phase !== 'fin') return base
  const sansFaute = etat.reponses.every((r) => r.correct)
  return base + BONUS_FIN + (sansFaute ? BONUS_SANS_FAUTE : 0)
}

export function reducteur(etat, action) {
  switch (action.type) {
    case 'INDICE': {
      if (etat.phase !== 'question' || etat.indicesOuverts >= 2) return etat
      return { ...etat, indicesOuverts: etat.indicesOuverts + 1 }
    }

    case 'REPONDRE': {
      // action : { correct, chosenErrorType, detail } — detail est propre au
      // format (index du choix pour un QCM, fragments choisis pour une remise
      // en ordre) et sert à l'affichage du feedback.
      if (etat.phase !== 'question') return etat
      const question = questionCourante(etat)
      const reponse = {
        exercise_id: question.id,
        correct: action.correct === true,
        chosen_error_type: action.correct ? null : (action.chosenErrorType ?? null),
        duration_ms: Date.now() - etat.debutQuestion,
        indices: etat.indicesOuverts,
      }
      return {
        ...etat,
        phase: 'feedback',
        choisi: action.detail,
        reponses: [...etat.reponses, reponse],
      }
    }

    case 'CONTINUER': {
      if (etat.phase !== 'feedback') return etat
      const derniere = etat.reponses[etat.reponses.length - 1]
      let file = etat.file
      let reserve = etat.reserve

      // Après une erreur : re-proposer une variante de la même compétence en
      // fin de file (exercice non utilisé de la réserve, sinon le même).
      if (!derniere.correct) {
        const question = questionCourante(etat)
        const dejaEnRattrapage = etat.index >= TAILLE_SESSION
        if (!dejaEnRattrapage) {
          const variante = reserve[0] ?? question
          reserve = reserve.slice(1)
          file = [...file, preparer(variante)]
        }
      }

      const suivant = etat.index + 1
      if (suivant >= file.length) {
        return { ...etat, file, reserve, phase: 'fin', choisi: null }
      }
      return {
        ...etat,
        file,
        reserve,
        index: suivant,
        phase: 'question',
        indicesOuverts: 0,
        choisi: null,
        debutQuestion: Date.now(),
      }
    }

    default:
      return etat
  }
}
