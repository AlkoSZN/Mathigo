# Mathigo

Application d'entraînement aux mathématiques (L1-L2 / prépa), type Duolingo.
La spécification complète du projet est dans [Mathigo.md](Mathigo.md).

## Démarrage en local

Prérequis : Node ≥ 20, Docker Desktop (pour la stack Supabase locale).

```sh
npm install

# Démarrer Supabase local (Postgres, Auth, Mailpit) — applique les migrations
npx supabase start

# Copier .env.example vers .env.local et y coller l'URL API et la clé anon
# affichées par la commande précédente

npm run dev
```

L'app tourne sur http://localhost:5173. Connexion par pseudo + mot de passe
(aucune adresse e-mail réelle : le client fabrique un e-mail technique
`<pseudo>@mathigo.local`, jamais envoyé, pour s'appuyer sur l'auth Supabase).

## Déploiement (Netlify + Supabase cloud)

1. Créer un projet Supabase dédié sur [supabase.com](https://supabase.com), puis y
   pousser le schéma et le contenu :
   ```sh
   npx supabase link --project-ref <ref-du-projet>
   npx supabase db push          # applique supabase/migrations/
   node scripts/seed-skills.js   # régénère supabase/seed.sql
   # seed des skills + exercices : renseigner SUPABASE_URL/SUPABASE_SERVICE_KEY
   # de production dans scripts/generation/.env puis
   node --env-file=scripts/generation/.env scripts/generation/insert.js
   ```
2. Sur [netlify.com](https://netlify.com) : nouveau site depuis ce dépôt
   (`netlify.toml` fournit build et redirections SPA). Variables d'environnement
   à définir : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (valeurs du
   projet Supabase cloud, section API).
3. Dans Supabase : Authentication → Sign In / Providers → Email → désactiver
   **Confirm email**. Obligatoire : l'inscription utilise un e-mail technique
   (`<pseudo>@mathigo.local`) qui ne peut recevoir aucune confirmation.

## État d'avancement

- [x] Phase 1 — Fondations (scaffold, schéma + RLS, KaTeX, design tokens, auth)
- [x] Phase 2 — Arbre Analyse 1 (skill-tree.json, seed, rendu avec états)
- [x] Phase 3 — Pipeline de contenu (génération Groq + validation SymPy, 38 exercices pilotes)
- [x] Phase 4 — Boucle de session (QCM, indices, feedback, rattrapage, XP, streak)
- [x] Phase 5 — FSRS (reviews, maîtrise vivante avec décroissance, révisions du jour)
- [x] Phase 6 — Polish + social (formats théorique/remise en ordre, classement
  amis, profil, banque complète 279 exercices ; déploiement : suivre le guide
  ci-dessus)
