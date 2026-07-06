import { useMemo } from 'react'
import katex from 'katex'

// Filet de sécurité : une chaîne de prose (plusieurs mots) sans aucune
// commande LaTeX ne devrait jamais être rendue en mode maths pur — KaTeX y
// écrase les espaces entre mots et rend mal les caractères accentués. Ça
// arrive quand un exercice conceptuel est mal étiqueté "calculatoire" par le
// pipeline de génération ; on l'enveloppe alors dans \text{...} pour
// retrouver un rendu textuel normal.
const RE_COMMANDE_MATH = /\\[a-zA-Z]+|[\^_{}]/
const RE_DEUX_MOTS = /[a-zà-öø-ÿ]{2,}\s+[a-zà-öø-ÿ]{2,}/i

function proteger(latex) {
  return RE_DEUX_MOTS.test(latex) && !RE_COMMANDE_MATH.test(latex) ? `\\text{${latex}}` : latex
}

/**
 * Rend une expression LaTeX pure avec KaTeX.
 * @param {{ latex: string, block?: boolean }} props
 *   `block` : affichage centré en mode display (équations seules).
 */
export function Math({ latex, block = false }) {
  const html = useMemo(
    () =>
      katex.renderToString(proteger(latex), {
        displayMode: block,
        throwOnError: false,
        strict: false,
      }),
    [latex, block],
  )

  const Tag = block ? 'div' : 'span'
  return <Tag className="math" dangerouslySetInnerHTML={{ __html: html }} />
}

/**
 * Rend un texte mixte français + segments LaTeX délimités par `$...$`,
 * format des énoncés et solutions d'exercices.
 * @param {{ children: string, as?: string, className?: string }} props
 */
export function MathText({ children, as: Tag = 'p', className }) {
  // Normalise le display math $$...$$ (parfois produit par la génération)
  // vers l'inline $...$ avant découpage.
  const parts = useMemo(
    () => String(children).replaceAll('$$', '$').split(/\$([^$]+)\$/g),
    [children],
  )

  return (
    <Tag className={className}>
      {parts.map((part, i) =>
        // Les index impairs sont les captures du split : du LaTeX
        i % 2 === 1 ? <Math key={i} latex={part} /> : part,
      )}
    </Tag>
  )
}
