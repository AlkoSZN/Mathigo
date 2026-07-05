import { useMemo } from 'react'
import katex from 'katex'

/**
 * Rend une expression LaTeX pure avec KaTeX.
 * @param {{ latex: string, block?: boolean }} props
 *   `block` : affichage centré en mode display (équations seules).
 */
export function Math({ latex, block = false }) {
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
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
  const parts = useMemo(() => String(children).split(/\$([^$]+)\$/g), [children])

  return (
    <Tag className={className}>
      {parts.map((part, i) =>
        // Les index impairs sont les captures du split : du LaTeX
        i % 2 === 1 ? <Math key={i} latex={part} /> : part,
      )}
    </Tag>
  )
}
