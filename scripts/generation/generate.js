// Génération d'exercices QCM via l'API Groq (compatible OpenAI).
// Usage : node --env-file=scripts/generation/.env scripts/generation/generate.js [skill_id ...] [--count N]
// Sortie : scripts/generation/out/<skill_id>.json (exercices bruts, à passer à validate.py)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
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

const args = process.argv.slice(2)
const idxCount = args.indexOf('--count')
const parLot = idxCount >= 0 ? parseInt(args[idxCount + 1], 10) : 15
const ids = args.filter((a, i) => !a.startsWith('--') && (idxCount < 0 || i !== idxCount + 1))
const cibles = ids.length > 0 ? ids : PILOTES

const toutes = new Map(arbre.chapters.flatMap((c) => c.skills.map((s) => [s.id, s])))

const PROMPT_SYSTEME = `Tu es professeur agrégé de mathématiques en classe préparatoire. Tu rédiges des exercices QCM en FRANÇAIS pour des étudiants de L1-L2/prépa (programme Analyse 1).

Tu réponds UNIQUEMENT en JSON strict : {"exercises": [...]}. Chaque exercice suit EXACTEMENT ce schéma :
{
  "difficulty": 1 à 5,
  "statement_latex": "énoncé en français, formules entre $...$",
  "choices": [4 objets exactement : {"latex": "...", "sympy": "...", "correct": true|false, "error_type": "..."}],
  "hints": [2 indices gradués : le premier oriente, le second donne la méthode],
  "solution_latex": "solution rédigée en français, formules entre $...$",
  "check": {"kind": "value", "expected_sympy": "..."} ou {"kind": "manual"}
}

RÈGLES ABSOLUES :
- Exactement 4 choix, exactement 1 avec "correct": true, l'attribut "error_type" uniquement sur les 3 incorrects.
- Chaque distracteur correspond à une erreur classique identifiable (erreur_signe, produit_oublie, confusion_derivee_primitive, terme_croise_oublie, croisement_limites, quotient_inverse, exposant_faux...). JAMAIS de valeur aléatoire. Le champ error_type la documente en snake_case.
- Les distracteurs ont la même forme générale que la bonne réponse (plausibles visuellement), et les 4 choix sont tous DIFFÉRENTS deux à deux (valeur ET affichage).
- error_type décrit l'erreur RÉELLEMENT commise pour aboutir à ce distracteur ; invente un label snake_case précis si les exemples ne conviennent pas. Un label hors sujet est une faute.
- Champ "sympy" de chaque choix : la valeur du choix comme expression SymPy Python valide. Syntaxe : ** pour les puissances, exp(x), log(x) pour ln, sqrt(x), sin(x), cos(x), tan(x), pi, oo pour l'infini, -oo, Rational(1,2) pour les fractions exactes, E pour e. Variables autorisées : x, n. Aucun symbole d'égalité, juste l'expression.
- "check.expected_sympy" : expression SymPy qui RECALCULE la bonne réponse indépendamment, par ex. "diff(x**2*exp(x), x)" pour une dérivée, "limit((x**2-1)/(x-1), x, 1)" pour une limite, "Rational(3,2)**4" pour un calcul de terme. Si la question n'est pas recalculable (question de cours, vrai/faux conceptuel), utiliser {"kind": "manual"}.
- Le LaTeX utilise \\\\dfrac, \\\\lim\\\\limits si utile ; l'énoncé ne révèle jamais la réponse.
- Varie les difficultés (1 à 3 surtout, un ou deux 4), les fonctions et les valeurs numériques d'un exercice à l'autre. Aucun doublon.`

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

/** Appelle l'API Groq et renvoie le tableau d'exercices d'un lot. */
async function genererLot(skill, nb, dejaGeneres) {
  const enonces = dejaGeneres.map((e) => `- ${e.statement_latex}`).join('\n')
  const reponse = await fetchAvecRetries('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${CLE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELE,
      response_format: { type: 'json_object' },
      reasoning_effort: 'low', // le raisonnement compte dans le budget completion
      max_completion_tokens: 8000,
      messages: [
        { role: 'system', content: PROMPT_SYSTEME },
        {
          role: 'user',
          content:
            `Compétence : « ${skill.title} » — ${skill.description}\n` +
            `Génère ${nb} exercices QCM pour cette compétence précise.` +
            (enonces ? `\n\nÉnoncés déjà générés, à NE PAS répéter ni paraphraser :\n${enonces}` : ''),
        },
      ],
    }),
  })
  if (!reponse.ok) throw new Error(`Groq ${reponse.status} : ${await reponse.text()}`)
  const corps = await reponse.json()
  const contenu = JSON.parse(corps.choices[0].message.content)
  if (!Array.isArray(contenu.exercises)) throw new Error('Réponse sans tableau "exercises"')
  return contenu.exercises
}

const dossierSortie = join(racine, 'scripts', 'generation', 'out')
mkdirSync(dossierSortie, { recursive: true })

for (const id of cibles) {
  const skill = toutes.get(id)
  if (!skill) {
    console.error(`Compétence inconnue : ${id} — ignorée`)
    continue
  }
  console.log(`\n${id} — ${skill.title}`)
  const exercices = []
  let echecs = 0
  while (exercices.length < parLot) {
    const nb = Math.min(TAILLE_LOT, parLot - exercices.length)
    try {
      const lot = await genererLot(skill, nb, exercices)
      echecs = 0
      for (const e of lot) exercices.push({ skill_id: id, ...e })
    } catch (err) {
      // JSON tronqué ou invalide : on redemande simplement le même lot
      if (++echecs >= 5) throw err
      console.log(`  lot invalide (${echecs}/5) — nouvel essai`)
    }
    console.log(`  ${exercices.length}/${parLot}`)
  }
  const fichier = join(dossierSortie, `${id}.json`)
  writeFileSync(fichier, JSON.stringify({ skill_id: id, exercises: exercices }, null, 2))
  console.log(`  écrit : scripts/generation/out/${id}.json`)
}
