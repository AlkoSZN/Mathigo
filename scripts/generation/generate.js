// Génération d'exercices via l'API Groq (compatible OpenAI), trois formats :
//   qcm            — QCM calculatoire vérifiable par SymPy
//   qcm_theorique  — QCM de cours (théorème correspondant à une définition, hypothèses, vrai/faux)
//   remise_en_ordre — fragments d'un énoncé (définition, théorème) à remettre en ordre
// Usage : node --env-file=scripts/generation/.env scripts/generation/generate.js [skill_id ...] [--count N] [--formats qcm,remise_en_ordre]
// Sortie : scripts/generation/out/<skill_id>.json (exercices bruts, à passer à validate.py)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const racine = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arbre = JSON.parse(readFileSync(join(racine, 'content', 'skill-tree.json'), 'utf8'))

const CLE = process.env.GROQ_API_KEY
const MODELE = process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b'
if (!CLE) throw new Error('GROQ_API_KEY manquante (lancer avec --env-file=scripts/generation/.env)')

/** Compétences pilotes par défaut (phase 3), choisies pour être vérifiables par SymPy. */
const PILOTES = ['ana1-suites-01', 'ana1-limites-02', 'ana1-deriv-03']
const TAILLE_LOT = 3 // exercices par appel : lots courts, sinon le JSON est tronqué (budget completion)

/**
 * Répartition des formats pour `--count N` exercices, surchargée par le champ
 * optionnel "repartition" du chapitre dans skill-tree.json.
 */
const REPARTITION_DEFAUT = { qcm: 0.7, qcm_theorique: 0.15, remise_en_ordre: 0.15 }

const args = process.argv.slice(2)
function optionValeur(nom) {
  const i = args.indexOf(nom)
  return i >= 0 ? args[i + 1] : null
}
const parLot = optionValeur('--count') ? parseInt(optionValeur('--count'), 10) : 15
const formatsForces = optionValeur('--formats')?.split(',') ?? null
const indicesOptions = new Set(
  ['--count', '--formats'].flatMap((n) => {
    const i = args.indexOf(n)
    return i >= 0 ? [i, i + 1] : []
  }),
)
const ids = args.filter((a, i) => !a.startsWith('--') && !indicesOptions.has(i))
const cibles = ids.length > 0 ? ids : PILOTES

const toutes = new Map(
  arbre.chapters.flatMap((c) => c.skills.map((s) => [s.id, { ...s, chapitre: c }])),
)

const SOCLE = `Tu es professeur agrégé de mathématiques en classe préparatoire. Tu rédiges des exercices en FRANÇAIS pour des étudiants de L1-L2/prépa (programme Analyse 1).

Tu réponds UNIQUEMENT en JSON strict : {"exercises": [...]}.

Règles communes à tous les exercices :
- "difficulty" : 1 à 5 (surtout 1 à 3, un ou deux 4).
- "hints" : exactement 2 indices gradués — le premier oriente, le second donne la méthode.
- "solution_latex" : solution rédigée en français, formules entre $...$.
- Le LaTeX utilise \\\\dfrac, \\\\lim\\\\limits si utile ; l'énoncé ne révèle jamais la réponse.
- Varie les notions, fonctions et valeurs d'un exercice à l'autre. Aucun doublon ni paraphrase.`

const PROMPTS = {
  qcm: `${SOCLE}

Format demandé : QCM CALCULATOIRE. Schéma exact de chaque exercice :
{
  "format": "qcm",
  "difficulty": ..., "statement_latex": "...", "hints": [...], "solution_latex": "...",
  "choices": [4 objets exactement : {"latex": "...", "sympy": "...", "correct": true|false, "error_type": "..."}],
  "check": {"kind": "value", "expected_sympy": "..."} ou {"kind": "manual"}
}
- Exactement 4 choix, exactement 1 avec "correct": true, "error_type" uniquement sur les 3 incorrects.
- Chaque distracteur correspond à une erreur classique identifiable ; error_type la documente en snake_case et décrit l'erreur RÉELLEMENT commise (invente un label précis si besoin). JAMAIS de valeur aléatoire.
- Les distracteurs ont la même forme générale que la bonne réponse, et les 4 choix sont tous DIFFÉRENTS deux à deux (valeur ET affichage).
- "sympy" : la valeur du choix en expression SymPy Python valide (** pour puissance, exp(x), log(x) pour ln, sqrt, sin, cos, tan, pi, oo, -oo, Rational(1,2), E). Variables : x, n. Juste l'expression.
- "check.expected_sympy" : expression SymPy qui RECALCULE la bonne réponse indépendamment (ex. "diff(x**2*exp(x), x)", "limit((x**2-1)/(x-1), x, 1)"). Si non recalculable : {"kind": "manual"}.`,

  qcm_theorique: `${SOCLE}

Format demandé : QCM THÉORIQUE (question de cours). Schéma exact :
{
  "format": "qcm_theorique",
  "difficulty": ..., "statement_latex": "...", "hints": [...], "solution_latex": "...",
  "choices": [4 objets exactement : {"latex": "...", "correct": true|false, "error_type": "..."}],
  "check": {"kind": "manual"}
}
- Types de questions : « à quel théorème correspond cet énoncé ? », hypothèses exactes d'un théorème, vrai/faux conceptuel justifié, contre-exemple, condition nécessaire vs suffisante.
- "latex" d'un choix : du TEXTE français, avec les formules entre $...$ (ex. "Théorème des valeurs intermédiaires", "Si $f$ est dérivable alors $f$ est continue").
- Exactement 4 choix, exactement 1 correct, "error_type" en snake_case sur les 3 incorrects (ex. confusion_tvi_bornes, hypothese_manquante, reciproque_fausse).
- Les 4 choix sont plausibles et tous différents ; les distracteurs correspondent à des confusions classiques de cours.
- Pas de champ "sympy" pour ce format.`,

  remise_en_ordre: `${SOCLE}

Format demandé : REMISE EN ORDRE d'un énoncé de cours (définition, théorème, lemme). Schéma exact :
{
  "format": "remise_en_ordre",
  "difficulty": ..., "statement_latex": "consigne, ex. Reconstitue l'énoncé du théorème des gendarmes.", "hints": [...], "solution_latex": "l'énoncé complet correct, rédigé",
  "fragments": [4 à 6 chaînes : les morceaux de l'énoncé DANS L'ORDRE CORRECT],
  "distracteurs": [0 à 2 chaînes : morceaux pièges plausibles qui ne font PAS partie de l'énoncé],
  "check": {"kind": "manual"}
}
- Chaque fragment est un morceau autonome de phrase, texte français avec formules entre $...$ ; l'énoncé se lit naturellement quand on concatène les fragments dans l'ordre.
- Les fragments doivent être tous DIFFÉRENTS entre eux et des distracteurs. Aucun fragment ne doit pouvoir se placer à deux endroits sans changer le sens (sinon l'exercice est ambigu).
- Les distracteurs sont des variantes fausses classiques (hypothèse affaiblie, inégalité inversée, quantificateur faux).`,
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * fetch avec retries sur 429 (rate limit tokens/min du tier gratuit Groq) :
 * respecte le délai suggéré par l'API, abandonne après 6 tentatives.
 */
async function fetchAvecRetries(url, options) {
  for (let tentative = 1; ; tentative++) {
    const reponse = await fetch(url, options)
    if (reponse.status !== 429 || tentative >= 6) return reponse
    const corps = await reponse.text()
    const suggere = corps.match(/try again in ([\d.]+)s/)?.[1]
    const delai = suggere ? Math.ceil(parseFloat(suggere) + 2) : 30
    console.log(`  rate limit — nouvelle tentative dans ${delai}s`)
    await attendre(delai * 1000)
  }
}

/** Appelle l'API Groq et renvoie le tableau d'exercices d'un lot du format demandé. */
async function genererLot(skill, format, nb, dejaGeneres) {
  // Liste anti-doublons bornée : la requête entière (prompt + budget de
  // complétion) doit rester sous la limite TPM du tier gratuit (8000).
  const enonces = dejaGeneres
    .slice(-20)
    .map((e) => `- ${String(e.statement_latex).slice(0, 160)}`)
    .join('\n')
  const reponse = await fetchAvecRetries('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${CLE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELE,
      response_format: { type: 'json_object' },
      reasoning_effort: 'low', // le raisonnement compte dans le budget completion
      max_completion_tokens: 4000,
      messages: [
        { role: 'system', content: PROMPTS[format] },
        {
          role: 'user',
          content:
            `Compétence : « ${skill.title} » — ${skill.description}\n` +
            `Génère ${nb} exercice(s) au format « ${format} » pour cette compétence précise.` +
            (enonces ? `\n\nÉnoncés déjà générés, à NE PAS répéter ni paraphraser :\n${enonces}` : ''),
        },
      ],
    }),
  })
  if (!reponse.ok) throw new Error(`Groq ${reponse.status} : ${await reponse.text()}`)
  const corps = await reponse.json()
  const contenu = JSON.parse(corps.choices[0].message.content)
  if (!Array.isArray(contenu.exercises)) throw new Error('Réponse sans tableau "exercises"')
  // Le format fait foi côté script, même si le modèle l'a omis ou altéré
  return contenu.exercises.map((e) => ({ ...e, format }))
}

/** Nombre d'exercices à générer par format pour une compétence. */
function planParFormat(skill) {
  if (formatsForces) {
    return Object.fromEntries(
      formatsForces.map((f) => [f, Math.ceil(parLot / formatsForces.length)]),
    )
  }
  const repartition = skill.chapitre.repartition ?? REPARTITION_DEFAUT
  const plan = {}
  let attribues = 0
  for (const [format, poids] of Object.entries(repartition)) {
    plan[format] = Math.round(parLot * poids)
    attribues += plan[format]
  }
  plan.qcm = (plan.qcm ?? 0) + (parLot - attribues) // l'arrondi retombe sur le calculatoire
  return plan
}

const dossierSortie = join(racine, 'scripts', 'generation', 'out')
mkdirSync(dossierSortie, { recursive: true })

for (const id of cibles) {
  const skill = toutes.get(id)
  if (!skill) {
    console.error(`Compétence inconnue : ${id} — ignorée`)
    continue
  }
  const fichier = join(dossierSortie, `${id}.json`)
  // Reprise : on complète un fichier existant plutôt que de régénérer
  const exercices = existsSync(fichier)
    ? JSON.parse(readFileSync(fichier, 'utf8')).exercises
    : []
  const plan = planParFormat(skill)
  console.log(`\n${id} — ${skill.title} (${JSON.stringify(plan)})`)

  for (const [format, voulu] of Object.entries(plan)) {
    if (!PROMPTS[format]) {
      console.error(`  format inconnu : ${format} — ignoré`)
      continue
    }
    const duFormat = () => exercices.filter((e) => (e.format ?? 'qcm') === format)
    let echecs = 0
    while (duFormat().length < voulu) {
      const nb = Math.min(TAILLE_LOT, voulu - duFormat().length)
      try {
        const lot = await genererLot(skill, format, nb, exercices)
        echecs = 0
        for (const e of lot) exercices.push({ skill_id: id, ...e })
      } catch (err) {
        // JSON tronqué ou invalide : on redemande simplement le même lot
        if (++echecs >= 5) throw err
        console.log(`  lot invalide (${echecs}/5) — nouvel essai`)
      }
      console.log(`  ${format} : ${duFormat().length}/${voulu}`)
      writeFileSync(fichier, JSON.stringify({ skill_id: id, exercises: exercices }, null, 2))
    }
  }
  console.log(`  écrit : scripts/generation/out/${id}.json (${exercices.length} exercices)`)
}
