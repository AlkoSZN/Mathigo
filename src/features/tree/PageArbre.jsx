import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { maitriseCourante } from '../../lib/fsrs'
import arbre from '../../../content/skill-tree.json'
import NoeudCompetence from './NoeudCompetence'

/** Seuil de maîtrise des prérequis pour déverrouiller une compétence. */
const SEUIL_DEVERROUILLAGE = 0.6

/** Arbre de compétences Analyse 1 : chapitres, nœuds, états de déverrouillage. */
export default function PageArbre() {
  const [maitrises, setMaitrises] = useState(null)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    let annule = false
    supabase
      .from('reviews')
      .select('skill_id, fsrs_state')
      .then(({ data, error }) => {
        if (annule) return
        if (error) setErreur(error.message)
        // Maîtrise = taux de bonnes réponses de la dernière session,
        // constante jusqu'à la prochaine (pas de décroissance dans le temps).
        setMaitrises(
          new Map((data ?? []).map((r) => [r.skill_id, maitriseCourante(r.fsrs_state)])),
        )
      })
    return () => {
      annule = true
    }
  }, [])

  if (maitrises === null) return null // chargement de la maîtrise en cours

  const maitriseDe = (id) => maitrises.get(id) ?? 0
  const estDeverrouillee = (skill) =>
    skill.prereq_ids.every((id) => maitriseDe(id) >= SEUIL_DEVERROUILLAGE)

  const toutes = arbre.chapters.flatMap((c) => c.skills)
  const nbDeverrouillees = toutes.filter(estDeverrouillee).length

  return (
    <section className="arbre">
      <header className="arbre-entete">
        <h1>{arbre.title}</h1>
        <p className="arbre-resume">
          {nbDeverrouillees} compétence{nbDeverrouillees > 1 ? 's' : ''} sur {toutes.length}{' '}
          débloquée{nbDeverrouillees > 1 ? 's' : ''} — les suivantes s'ouvrent à 60 % de
          maîtrise des prérequis.
        </p>
        {erreur && (
          <p className="note-erreur">
            Impossible de charger ta progression ({erreur}). L'arbre est affiché sans maîtrise.
          </p>
        )}
      </header>

      {arbre.chapters.map((chapitre, i) => (
        <section key={chapitre.id} className="chapitre">
          <header className="chapitre-entete">
            <span className="chapitre-numero">Chapitre {i + 1}</span>
            <h2>{chapitre.title}</h2>
          </header>
          <ol className="chapitre-noeuds">
            {chapitre.skills.map((skill, j) => (
              <NoeudCompetence
                key={skill.id}
                skill={skill}
                maitrise={maitriseDe(skill.id)}
                deverrouillee={estDeverrouillee(skill)}
                index={j}
              />
            ))}
          </ol>
        </section>
      ))}
    </section>
  )
}
