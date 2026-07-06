// Insertion des exercices validés dans Supabase (clé service, hors app React).
// Usage : node --env-file=scripts/generation/.env scripts/generation/insert.js [--replace]
//   --replace : supprime d'abord les exercices existants des compétences concernées
//               (re-génération d'une banque ; refuse si des tentatives y sont liées).

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dossier = join(dirname(fileURLToPath(import.meta.url)), 'validated')
const URL_BASE = process.env.SUPABASE_URL
const CLE = process.env.SUPABASE_SERVICE_KEY
if (!URL_BASE || !CLE) {
  throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY manquantes (--env-file=scripts/generation/.env)')
}

const entetes = {
  apikey: CLE,
  Authorization: `Bearer ${CLE}`,
  'Content-Type': 'application/json',
}

const remplacer = process.argv.includes('--replace')

const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.json'))
if (fichiers.length === 0) throw new Error('aucun fichier dans scripts/generation/validated/')

const lignes = fichiers.flatMap((f) =>
  JSON.parse(readFileSync(join(dossier, f), 'utf8')),
)
const skillIds = [...new Set(lignes.map((l) => l.skill_id))]

if (remplacer) {
  const filtre = `skill_id=in.(${skillIds.map((s) => `"${s}"`).join(',')})`
  const suppression = await fetch(`${URL_BASE}/rest/v1/exercises?${filtre}`, {
    method: 'DELETE',
    headers: entetes,
  })
  if (!suppression.ok) {
    throw new Error(`suppression échouée ${suppression.status} : ${await suppression.text()}`)
  }
  console.log(`exercices existants supprimés pour : ${skillIds.join(', ')}`)
}

const insertion = await fetch(`${URL_BASE}/rest/v1/exercises`, {
  method: 'POST',
  headers: { ...entetes, Prefer: 'return=minimal' },
  body: JSON.stringify(lignes),
})
if (!insertion.ok) {
  throw new Error(`insertion échouée ${insertion.status} : ${await insertion.text()}`)
}
console.log(`${lignes.length} exercices insérés (${skillIds.join(', ')})`)
