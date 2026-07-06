import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { maitriseCourante } from '../../lib/fsrs'
import arbre from '../../../content/skill-tree.json'

const SEUIL_DEVERROUILLAGE = 0.6
const toutes = arbre.chapters.flatMap((c) => c.skills)

/**
 * Révisions du jour : compétences dont la carte FSRS est due (due_at ≤ maintenant),
 * triées par maîtrise croissante, plus les compétences débloquées jamais travaillées.
 */
export default function PageRevisions() {
  const [revues, setRevues] = useState(null)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    let annule = false
    supabase
      .from('reviews')
      .select('skill_id, due_at, fsrs_state')
      .then(({ data, error }) => {
        if (annule) return
        if (error) setErreur(error.message)
        setRevues(data ?? [])
      })
    return () => {
      annule = true
    }
  }, [])

  if (erreur) return <p className="note-erreur">Chargement impossible ({erreur}).</p>
  if (revues === null) return null

  const parSkill = new Map(revues.map((r) => [r.skill_id, r]))
  const maitriseDe = (id) => maitriseCourante(parSkill.get(id)?.fsrs_state ?? null)
  const deverrouillee = (skill) =>
    skill.prereq_ids.every((p) => maitriseDe(p) >= SEUIL_DEVERROUILLAGE)

  const maintenant = new Date()
  const dues = toutes
    .filter((s) => {
      const revue = parSkill.get(s.id)
      return revue && new Date(revue.due_at) <= maintenant
    })
    .sort((a, b) => maitriseDe(a.id) - maitriseDe(b.id))
  const nouvelles = toutes.filter((s) => !parSkill.has(s.id) && deverrouillee(s))

  return (
    <section className="revisions">
      <h1>Révisions du jour</h1>

      {dues.length === 0 ? (
        <p className="revisions-vide">
          Rien à réviser aujourd'hui — reviens demain, ou avance sur une nouvelle
          compétence ci-dessous.
        </p>
      ) : (
        <ol className="revisions-liste">
          {dues.map((s) => (
            <li key={s.id}>
              <Link className="revision carte" to={`/session/${s.id}`}>
                <span className="revision-titre">{s.title}</span>
                <span className="revision-maitrise">{Math.round(maitriseDe(s.id) * 100)} %</span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {nouvelles.length > 0 && (
        <>
          <h2>Nouvelles compétences débloquées</h2>
          <ol className="revisions-liste">
            {nouvelles.map((s) => (
              <li key={s.id}>
                <Link className="revision carte" to={`/session/${s.id}`}>
                  <span className="revision-titre">{s.title}</span>
                  <span className="revision-maitrise revision-maitrise--nouvelle">nouveau</span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
