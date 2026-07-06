// Génère supabase/seed.sql à partir de content/skill-tree.json.
// Usage : node scripts/seed-skills.js
// Le seed est idempotent (upsert) : appliqué par `supabase db reset` ou
// directement via psql sur la base locale.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')
const arbre = JSON.parse(readFileSync(join(racine, 'content', 'skill-tree.json'), 'utf8'))

/** Échappe une chaîne pour un littéral SQL entre quotes simples. */
const q = (s) => `'${String(s).replace(/'/g, "''")}'`

/** Formate un text[] Postgres à partir d'un tableau de chaînes. */
const tableauTexte = (arr) =>
  arr.length === 0 ? "'{}'" : `array[${arr.map(q).join(', ')}]`

const lignes = arbre.chapters.flatMap((chapitre) =>
  chapitre.skills.map(
    (s) =>
      `  (${q(s.id)}, ${q(arbre.branch)}, ${q(s.title)}, ${q(s.description)}, ` +
      `${s.position}, ${tableauTexte(s.prereq_ids)}, ${q(s.icon)})`,
  ),
)

const sql = `-- Généré par scripts/seed-skills.js — NE PAS ÉDITER À LA MAIN.
-- Source : content/skill-tree.json
insert into public.skills (id, branch, title, description, position, prereq_ids, icon)
values
${lignes.join(',\n')}
on conflict (id) do update set
  branch      = excluded.branch,
  title       = excluded.title,
  description = excluded.description,
  position    = excluded.position,
  prereq_ids  = excluded.prereq_ids,
  icon        = excluded.icon;
`

writeFileSync(join(racine, 'supabase', 'seed.sql'), sql)
console.log(`seed.sql généré : ${lignes.length} compétences.`)
