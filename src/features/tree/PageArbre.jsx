import { MathText } from '../../lib/katex'

/** Arbre de compétences Analyse 1 — rendu complet en phase 2. */
export default function PageArbre() {
  return (
    <section>
      <h1>Analyse 1</h1>
      <MathText>
        {"L'arbre des compétences arrive en phase 2 : suites $(u_n)$, limites " +
          '$\\lim_{x \\to a} f(x)$, continuité, dérivation et études de fonctions.'}
      </MathText>
    </section>
  )
}
