-- Généré par scripts/seed-skills.js — NE PAS ÉDITER À LA MAIN.
-- Source : content/skill-tree.json
insert into public.skills (id, branch, title, description, position, prereq_ids, icon)
values
  ('ana1-suites-01', 'analyse-1', 'Premiers termes et modes de définition', 'Suites explicites et récurrentes : calculer des termes, reconnaître le mode de définition, indices et notation $(u_n)$.', 1, '{}', '(u_n)'),
  ('ana1-suites-02', 'analyse-1', 'Monotonie et bornes', 'Étudier le sens de variation (différence, quotient), majorants, minorants, suites bornées.', 2, array['ana1-suites-01'], 'u_{n+1} \geq u_n'),
  ('ana1-suites-03', 'analyse-1', 'Limite d''une suite', 'Définition de la convergence, limites usuelles ($q^n$, $1/n^\alpha$), divergence vers $\pm\infty$.', 3, array['ana1-suites-02'], '\lim u_n'),
  ('ana1-suites-04', 'analyse-1', 'Opérations et comparaison', 'Opérations sur les limites, formes indéterminées, théorème des gendarmes et comparaisons.', 4, array['ana1-suites-03'], '\leq'),
  ('ana1-suites-05', 'analyse-1', 'Convergence monotone et suites adjacentes', 'Théorème de la limite monotone, suites adjacentes, application aux encadrements.', 5, array['ana1-suites-04'], '\nearrow'),
  ('ana1-suites-06', 'analyse-1', 'Suites récurrentes', 'Suites $u_{n+1} = f(u_n)$ : point fixe, intervalle stable, convergence par monotonie.', 6, array['ana1-suites-04'], 'f(u_n)'),
  ('ana1-limites-01', 'analyse-1', 'Limite en un point et à l''infini', 'Limites finies et infinies, limites à gauche et à droite, lecture graphique.', 7, array['ana1-suites-03'], '\lim_{x \to a}'),
  ('ana1-limites-02', 'analyse-1', 'Opérations et formes indéterminées', 'Somme, produit, quotient de limites ; lever les formes indéterminées par factorisation ou quantité conjuguée.', 8, array['ana1-limites-01'], '\tfrac{0}{0}'),
  ('ana1-limites-03', 'analyse-1', 'Composition et encadrement', 'Limite d''une composée, théorème d''encadrement et comparaisons pour les fonctions.', 9, array['ana1-limites-02'], 'f \circ g'),
  ('ana1-limites-04', 'analyse-1', 'Croissances comparées', 'Hiérarchie $\ln x \ll x^\alpha \ll e^x$ en $+\infty$, limites usuelles associées.', 10, array['ana1-limites-02'], '\tfrac{e^x}{x^n}'),
  ('ana1-limites-05', 'analyse-1', 'Asymptotes', 'Asymptotes horizontales, verticales et obliques ; position relative de la courbe.', 11, array['ana1-limites-04'], 'y = ax + b'),
  ('ana1-cont-01', 'analyse-1', 'Continuité en un point et sur un intervalle', 'Définition, continuité des fonctions usuelles, opérations et composition.', 12, array['ana1-limites-01'], '\mathcal{C}^0'),
  ('ana1-cont-02', 'analyse-1', 'Prolongement par continuité', 'Reconnaître et construire un prolongement par continuité en un point.', 13, array['ana1-cont-01', 'ana1-limites-02'], '\tilde{f}'),
  ('ana1-cont-03', 'analyse-1', 'Théorème des valeurs intermédiaires', 'TVI et son corollaire pour les fonctions strictement monotones ; existence et unicité de solutions de $f(x) = k$.', 14, array['ana1-cont-01'], 'f(c) = k'),
  ('ana1-cont-04', 'analyse-1', 'Image d''un segment', 'Théorème des bornes atteintes, image d''un segment par une fonction continue.', 15, array['ana1-cont-03'], 'f([a,b])'),
  ('ana1-deriv-01', 'analyse-1', 'Nombre dérivé et tangente', 'Taux d''accroissement, dérivabilité en un point, équation de la tangente, lien avec la continuité.', 16, array['ana1-limites-02', 'ana1-cont-01'], 'f''(a)'),
  ('ana1-deriv-02', 'analyse-1', 'Dérivées usuelles', 'Dérivées de $x^n$, $\sqrt{x}$, $e^x$, $\ln x$, fonctions trigonométriques.', 17, array['ana1-deriv-01'], '(x^n)'''),
  ('ana1-deriv-03', 'analyse-1', 'Opérations sur les dérivées', 'Dérivée d''un produit, d''un quotient, d''une composée ; dérivées successives.', 18, array['ana1-deriv-02'], '(uv)'''),
  ('ana1-deriv-04', 'analyse-1', 'Dérivée et sens de variation', 'Signe de $f''$ et monotonie, tableau de variations, résolution d''inéquations $f''(x) \geq 0$.', 19, array['ana1-deriv-03'], 'f'' \geq 0'),
  ('ana1-deriv-05', 'analyse-1', 'Extrema locaux', 'Condition nécessaire $f''(x_0) = 0$, changement de signe de $f''$, extrema sur un segment.', 20, array['ana1-deriv-04'], 'f'' = 0'),
  ('ana1-deriv-06', 'analyse-1', 'Rolle et accroissements finis', 'Théorème de Rolle, égalité et inégalité des accroissements finis, applications.', 21, array['ana1-deriv-04'], '\tfrac{f(b)-f(a)}{b-a}'),
  ('ana1-etude-01', 'analyse-1', 'Domaine, parité, périodicité', 'Ensemble de définition, parité, imparité, périodicité et réduction du domaine d''étude.', 22, array['ana1-cont-01'], '\mathcal{D}_f'),
  ('ana1-etude-02', 'analyse-1', 'Tableau de variations complet', 'Construire un tableau de variations complet : dérivée, signe, limites aux bornes, valeurs remarquables.', 23, array['ana1-deriv-04', 'ana1-etude-01'], '\nearrow\!\searrow'),
  ('ana1-etude-03', 'analyse-1', 'Convexité et points d''inflexion', 'Signe de $f''''$, convexité, concavité, points d''inflexion, position par rapport aux tangentes.', 24, array['ana1-deriv-04'], 'f'''' > 0'),
  ('ana1-etude-04', 'analyse-1', 'Étude complète avec asymptotes', 'Plan d''étude complet d''une fonction : domaine, variations, asymptotes, tracé de la courbe.', 25, array['ana1-etude-02', 'ana1-limites-05'], '\mathcal{C}_f'),
  ('ana1-etude-05', 'analyse-1', 'Fonctions réciproques', 'Bijection continue strictement monotone, fonction réciproque, courbes symétriques par rapport à $y = x$.', 26, array['ana1-etude-02', 'ana1-cont-03'], 'f^{-1}')
on conflict (id) do update set
  branch      = excluded.branch,
  title       = excluded.title,
  description = excluded.description,
  position    = excluded.position,
  prereq_ids  = excluded.prereq_ids,
  icon        = excluded.icon;
