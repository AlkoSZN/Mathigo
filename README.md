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

L'app tourne sur http://localhost:5173. Les e-mails de connexion (liens
magiques) sont capturés par Mailpit : http://127.0.0.1:54324.

## État d'avancement

- [x] Phase 1 — Fondations (scaffold, schéma + RLS, KaTeX, design tokens, auth)
- [x] Phase 2 — Arbre Analyse 1 (skill-tree.json, seed, rendu avec états)
- [x] Phase 3 — Pipeline de contenu (génération Groq + validation SymPy, 38 exercices pilotes)
- [ ] Phase 4 — Boucle de session
- [ ] Phase 5 — FSRS
- [ ] Phase 6 — Polish + social
