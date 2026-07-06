# PROJET : Mathigo — Duolingo pour les mathématiques (L1-L2 / prépa)

## Vision

Application web d'entraînement aux mathématiques niveau L1-L2/prépa, inspirée de la boucle
d'engagement de Duolingo (arbre de compétences, sessions courtes, streak, répétition espacée)
mais avec une identité visuelle propre. Usage : personnel + quelques amis invités.

**V1 = branche "Analyse 1" uniquement** : suites, limites, continuité, dérivation,
études de fonctions. Les autres branches (Analyse 2, Algèbre linéaire, Probas...) viendront après.

**Langue : tout le contenu et l'UI sont en français.**

## Stack technique (NON NÉGOCIABLE)

- React 19 + Vite
- Supabase (Postgres, Auth, RLS) — projet dédié, PAS celui d'Okeana
- Déploiement Netlify
- KaTeX pour le rendu LaTeX (jamais MathJax)
- `ts-fsrs` pour la répétition espacée (algorithme FSRS)
- Motion (motion.dev, ex-Framer Motion) pour les animations
- Zustand pour le state global
- Pas de TypeScript strict obligatoire, mais JSDoc sur les fonctions publiques

## Format d'exercice : QCM UNIQUEMENT

Aucune saisie manuelle de réponse. Tout exercice est un QCM à 4 choix, 1 seule bonne réponse.

### Schéma JSON d'un exercice

```json
{
  "skill_id": "ana1-deriv-03",
  "difficulty": 2,
  "statement_latex": "Soit $f(x) = x^2 e^x$. Que vaut $f'(x)$ ?",
  "choices": [
    { "latex": "(x^2 + 2x)e^x", "correct": true },
    { "latex": "2x e^x", "correct": false, "error_type": "produit_oublie" },
    { "latex": "(x^2 - 2x)e^x", "correct": false, "error_type": "erreur_signe" },
    { "latex": "x^2 e^x + 2x", "correct": false, "error_type": "exp_mal_derivee" }
  ],
  "hints": [
    "C'est un produit de deux fonctions : quelle formule s'applique ?",
    "$(uv)' = u'v + uv'$ avec $u = x^2$ et $v = e^x$."
  ],
  "solution_latex": "Par la formule du produit : $f'(x) = 2x \\cdot e^x + x^2 \\cdot e^x = (x^2+2x)e^x$."
}
```

### Règles de conception des distracteurs (CRITIQUE)

- Chaque distracteur DOIT correspondre à une erreur classique identifiable
  (erreur de signe, formule du produit oubliée, confusion dérivée/primitive,
  terme de DL manquant, croisement de limites, etc.). JAMAIS de distracteur aléatoire.
- Le champ `error_type` documente l'erreur ciblée. Il servira plus tard à un
  feedback pédagogique ("Attention : tu as probablement oublié le terme croisé").
- L'ordre des choix est mélangé côté client au moment de l'affichage
  (stocker `correct: true` dans les données, jamais une position fixe).
- Les distracteurs doivent être plausibles visuellement (même forme générale que la
  bonne réponse). Un distracteur évident à éliminer est un distracteur raté.

## Pipeline de génération d'exercices

Deux modes, tous deux hors de l'app React :

### 1. Banque pré-générée (le socle, dossier `scripts/generation/`)

Script Node (`generate.js`) qui :
1. Lit l'arbre de compétences (`content/skill-tree.json`)
2. Pour chaque compétence, appelle l'API Groq (lots courts, réponse en JSON
   strict conforme au schéma ci-dessus ; clé dans `scripts/generation/.env`)
3. Passe chaque exercice au validateur (`scripts/generation/validate.py`, Python + SymPy) :
   - Re-résout l'énoncé indépendamment et vérifie que la réponse marquée `correct` est correcte
   - Vérifie que les 3 distracteurs sont mathématiquement DIFFÉRENTS de la bonne réponse
     (comparaison symbolique, pas comparaison de chaînes)
   - Rejette tout exercice non vérifiable → log dans `rejected.jsonl` pour revue manuelle
4. Insère les exercices validés dans Supabase (table `exercises`)

Les exercices dont la validation SymPy n'est pas automatisable (questions de cours,
vrai/faux conceptuels) sont marqués `"validation": "manual"` et vont dans une file
de relecture humaine avant publication.

### 2. Variantes à la volée (runtime, plus tard — pas en phase 1)

Templates paramétrés : l'énoncé validé est un gabarit avec valeurs numériques
variables ; une Edge Function Supabase régénère les valeurs et recalcule les
4 choix de façon déterministe. Aucun appel LLM au runtime.

## Schéma de base de données

```sql
-- Compétences : arbre avec prérequis
skills (id text pk, branch text, title text, description text,
        position int, prereq_ids text[], icon text)

-- Exercices validés
exercises (id uuid pk, skill_id text fk, difficulty int,
           payload jsonb,          -- le JSON complet de l'exercice
           validation text,        -- 'auto' | 'manual'
           created_at timestamptz)

-- Tentatives
attempts (id uuid pk, user_id uuid fk, exercise_id uuid fk,
          correct bool, chosen_error_type text, duration_ms int,
          created_at timestamptz)

-- État FSRS par (user, skill)
reviews (user_id uuid, skill_id text, fsrs_state jsonb,
         due_at timestamptz, mastery real,   -- 0..1
         primary key (user_id, skill_id))

-- Profils et gamification
profiles (user_id uuid pk, display_name text, avatar text,
          xp int default 0, streak_days int default 0,
          last_activity_date date)

-- Amis (leaderboard)
friendships (user_id uuid, friend_id uuid, status text,
             primary key (user_id, friend_id))
```

### Règles Supabase (leçons de projets précédents — À RESPECTER)

- RLS activées sur TOUTES les tables dès la création, avec politiques séparées
  par opération (une pour SELECT, une pour INSERT, etc.) et par rôle.
- Les opérations d'administration passent par des suppressions/écritures directes
  en table (avec RLS adaptées), JAMAIS par `auth.admin.*` côté client.
- Toute vue exposée : `security_invoker = true`.
- Migrations versionnées dans `supabase/migrations/`, jamais de modif directe en prod.

## Boucle de jeu et gamification

- **Session** : 8 questions tirées selon FSRS (mélange de dû + nouveau), ~5 min.
- **Vies** : NON. Pas de système de vies (anti-pattern pour un outil perso).
- **Streak** : jours consécutifs avec ≥ 1 session complétée. Affiché en permanence.
- **XP** : 10 par bonne réponse, bonus de fin de session, bonus sans-faute.
- **Maîtrise par compétence** : jauge 0-100 % pilotée par FSRS (stabilité mémoire),
  qui DÉCROÎT visuellement avec le temps sans révision (comme Duolingo : les
  compétences "se fissurent").
- **Arbre** : une compétence se déverrouille quand tous ses prérequis sont ≥ 60 %.
- **Leaderboard** : hebdomadaire, entre amis uniquement, basé sur l'XP de la semaine.
- **Indices** : 2 indices gradués par exercice, consommer un indice divise l'XP par 2.
- **Après une erreur** : afficher la solution détaillée + le feedback lié à
  `error_type`, puis re-proposer une variante de la même compétence en fin de session.

## Direction artistique — LIRE ATTENTIVEMENT

Utiliser le skill `frontend-design` (et le skill design local s'il est présent
dans `.claude/skills/`) pour TOUT travail d'UI. En plus de leurs règles :

### Interdits absolus (marqueurs de design IA générique)

- Fond crème + serif à fort contraste + accent terracotta
- Dégradés violets/bleus sur fond sombre, glassmorphism par défaut
- Inter/Roboto partout, cards uniformes à coins arrondis identiques,
  emoji en guise d'icônes, ombres portées floues systématiques
- Confettis génériques et micro-interactions décoratives sans fonction

### Direction retenue : « cahier de brouillon augmenté »

L'identité visuelle s'inspire de l'objet réel du travail mathématique : le papier
quadrillé, l'encre, la craie, l'annotation manuscrite — mais exécuté de façon
moderne et vive, pas skeuomorphique.

- **Fond** : blanc cassé très léger avec grille quadrillée subtile (motif CSS,
  opacité ~4 %), qui disparaît sur mobile pour la lisibilité.
- **Typographie** : une display géométrique avec du caractère pour les titres et
  chiffres (ex. Clash Display, Cabinet Grotesk ou General Sans — via Fontshare),
  une humanist sobre pour le corps (ex. Public Sans). Les maths restent en KaTeX
  (fonte Computer Modern) : ce contraste display moderne / CM classique EST
  l'identité du produit. Ne pas le gommer.
- **Couleurs** : palette encre — bleu-nuit profond (#1B2A4A) comme couleur
  structurante, un accent vif unique type vert menthe ou orange minium pour les
  succès/CTA, un rouge doux pour les erreurs. Pas plus de 4 couleurs.
- **La bonne réponse** se manifeste par un trait de surlignage animé (comme un
  coup de surligneur) sur le choix, pas par un simple changement de fond.
- **Progression de maîtrise** : chaque nœud de l'arbre est un cercle tracé
  progressivement comme au compas (stroke-dashoffset animé).
- **Mascotte** : optionnelle en v1. Si ajoutée : forme géométrique simple animée
  (un « π » ou un epsilon avec des yeux), en SVG, jamais une illustration 3D.

### Animations

- Motion (motion.dev), spring physics, propriétés GPU uniquement
  (transform, opacity, filter). Respecter `prefers-reduced-motion`.
- Pour toute animation continue/complexe : `requestAnimationFrame` sur canvas,
  JAMAIS `<animate>` SVG (bugs cross-browser connus).
- Les animations ont une FONCTION : feedback de réponse, célébration de fin de
  session (une seule, orchestrée), transition entre questions (slide horizontal),
  jauge de maîtrise. Rien de décoratif qui tourne en boucle.

## Structure du projet

```
src/
  components/       # composants UI purs
  features/
    session/        # boucle de quiz (machine à états : question → feedback → suivant)
    tree/           # arbre de compétences
    leaderboard/
    profile/
  lib/
    supabase.js
    fsrs.js         # wrapper ts-fsrs
    katex.jsx       # composant <Math latex="..."/>
  store/            # Zustand
content/
  skill-tree.json   # définition de l'arbre Analyse 1
scripts/
  generation/       # pipeline génération + validation (Node + Python/SymPy)
supabase/
  migrations/
```

## Méthode de travail

- Travailler par phases (ci-dessous). Ne JAMAIS commencer une phase sans que la
  précédente soit fonctionnelle et testée (utiliser le skill webapp-testing pour
  vérifier visuellement).
- Commits atomiques avec messages en français.
- Après chaque phase : lancer l'app, tester le parcours complet, corriger avant
  de continuer.
- Toujours vérifier la doc Supabase à jour avant d'écrire du code Supabase
  (skill supabase-postgres-best-practices).

## Phases

1. **Fondations** : Vite + React 19, Supabase (schéma + RLS + auth email/magic link),
   routing, composant `<Math/>` KaTeX, design tokens et layout de base.
2. **Arbre Analyse 1** : `skill-tree.json` complet (~25 compétences : suites,
   limites, continuité, dérivation, études de fonctions), rendu de l'arbre avec
   états (verrouillé / disponible / maîtrise x%).
3. **Pipeline de contenu** : scripts de génération + validation SymPy, génération
   de la banque pour 3 compétences pilotes (~40 exercices), revue de qualité.
4. **Boucle de session** : machine à états du quiz, QCM, indices, feedback par
   error_type, solution, écran de fin de session, XP et streak.
5. **FSRS** : intégration ts-fsrs, sélection des questions dues, décroissance de
   maîtrise, écran « révisions du jour ».
6. **Polish + social** : animations finales, leaderboard amis, invitations,
   génération du reste de la banque Analyse 1, déploiement Netlify.

## Ce que le projet N'EST PAS (v1)

- Pas de saisie libre de réponses, pas de clavier mathématique
- Pas de démonstrations à rédiger
- Pas de génération LLM au runtime
- Pas de système de vies ni de monétisation
- Pas d'app mobile native (responsive web suffit)
