# AutoBattle Online

Roguelite d'auto-combat multijoueur : enchaîne les niveaux, choisis tes
améliorations, ouvre des caisses, construis ton deck et grimpe au classement en
temps réel.

> Réécriture complète en TypeScript de la v1 (Express + JS vanilla). Le
> pourquoi est détaillé dans [REVIEW.md](REVIEW.md).

## Stack

| Couche | Choix |
|---|---|
| Moteur de jeu | TypeScript pur, déterministe (PRNG à graine), partagé client/serveur |
| Serveur | Node ≥ 22.13, Fastify 5, Socket.IO (push uniquement), `node:sqlite` |
| Client | React 19, Vite 7 (multi-pages), icônes Lucide, fond WebGL (shader de la v1) |
| Qualité | TypeScript strict, ESLint 9, Vitest, GitHub Actions |

```
packages/shared   règles, catalogue (50 cartes, 8 caisses), moteur de combat, schémas zod
apps/server       API REST + Socket.IO, auth par session, SQLite
apps/web          pages React : /login, / (combat), /gambling, /inventory, /monitoring
```

## Démarrer

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run dev
```

- Web : http://localhost:5173 (Vite, proxy `/api` et `/socket.io` vers :3000)
- API : http://localhost:3000

Pour donner le rôle admin à un compte existant :

```bash
npm run admin:promote -w @autobattle/server -- <pseudo>
```

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | serveur (tsx watch) + client (Vite) |
| `npm run build` | build shared → web → server |
| `npm start` | serveur de production (sert aussi le build web si `WEB_DIST` est défini) |
| `npm run check` | typecheck + lint + tests |

## Production

```bash
docker build -t autobattle .
```

```bash
docker run -p 3000:3000 -v autobattle-data:/data autobattle
```

Variables (validées au démarrage, voir `.env.example`) :

| Variable | Défaut | Notes |
|---|---|---|
| `APP_ORIGIN` | `http://localhost:5173` | Origine publique exacte. Sert au contrôle CSRF. En `https://`, les cookies passent en `Secure` et la CSP force HTTPS. |
| `DATABASE_PATH` | `./data/autobattle.db` | Fichier SQLite (WAL). Monter un volume en production. |
| `WEB_DIST` | — | Dossier du build Vite à servir (`/app/apps/web/dist` dans l'image). |
| `TRUST_PROXY` | `false` | À activer derrière un reverse proxy, pour que le rate limit voie la vraie IP. |
| `SESSION_TTL_DAYS` | `30` | Durée glissante des sessions. |

## Modèle de sécurité

- **Le serveur est la seule autorité.** Le client envoie des intentions
  (`{ type: 'fight' }`, `{ type: 'shopBuy', index }`…). Le serveur les valide,
  applique le moteur dans une transaction, puis renvoie l'état public et le
  journal du combat. La graine aléatoire ne quitte jamais le serveur.
- **Caisses :** elles sont tirées côté serveur avec `crypto.randomBytes`.
  L'animation de roulette s'arrête simplement sur le résultat déjà connu.
- **Sessions :** jeton opaque de 256 bits stocké hashé (SHA-256), dans un cookie
  `httpOnly` + `SameSite=Strict`, et révocable.
- **Codes :** PIN à 4 chiffres ou mot de passe (8 caractères minimum), hashés avec
  scrypt. 5 erreurs verrouillent le compte (15 min, puis doublé à chaque fois,
  24 h max), ce qui rend le PIN impossible à deviner par force brute.
- **CSRF :** toute requête qui modifie l'état, et toute connexion WebSocket, doit
  venir de `APP_ORIGIN`.
- **CSP :** `'self'` uniquement, aucun script ni style inline (images `https:`
  autorisées pour les photos de profil). Les entrées sont validées par
  zod et les erreurs internes ne sont jamais renvoyées.

## Interface

- Seuls la barre de navigation (CSS extrait tel quel de la v1) et le fond animé
  (shader WebGL de la v1) sont conservés. Le reste est un design system unique
  (`apps/web/src/ui`) : panneaux, boutons, modals, notifications, icônes Lucide,
  aucun emoji.
- Animations du combat via la Web Animations API, uniquement sur
  `transform`/`opacity`. La v1 clignotait parce que plusieurs minuteurs basculaient
  `display`, `visibility` et `opacity` sur les mêmes éléments.
- Vitesse ×1/×2/×4, pause, « Passer », raccourcis : `Espace` combattre,
  `P` pause, `C` camp, `H` historique, `Ctrl+M` son.

## Architecture du moteur

`applyAction(state, action, ctx)` est une fonction **pure** : elle clone l'état,
le transforme et retourne `{ state, fight?, rewards }`, ou lève une
`GameRuleError` (mauvaise phase, or insuffisant…). Tout est donc testable sans
serveur ni base (`packages/shared/test`).

Phases d'une partie :
- `ready` → `fight`, qui mène à :
  - `upgrade` en cas de victoire ;
  - `dead` en cas de défaite, puis `newRun`.
- `upgrade` → `chooseUpgrade`, qui mène à `ready`, ou à `shop` tous les 10 niveaux.
- `shop` → `shopBuy` / `shopSell` / `shopLeave`, puis retour à `ready`.
