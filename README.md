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

Compte de test avec les 50 cartes débloquées et 10 caisses de chaque type
(identifiants par défaut dans `apps/server/scripts/seed-collector.ts`, refusé si
`NODE_ENV=production`) :

```bash
npm run seed:collector -w @autobattle/server
```

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

## Modes de jeu

| Mode | Règles | Classement |
|---|---|---|
| **Deck** | 8 actes de 10 niveaux. Élite au niveau 5, **boss à effet** au niveau 10, boutique une fois par acte (après le boss). Battre le boss de l'acte 8 gagne la partie (coffre de victoire, couronne au classement), qui continue en **mode infini**. | Record « Deck » |
| **Classique** | Aucune carte, aucune boutique, courbe d'origine avec un boss simple tous les 5 niveaux. | Record « Classique » séparé |

Le mode se choisit avec **Recommencer** ; une nouvelle partie garde le mode précédent par défaut.

### Progression du mode Deck

- **Boss d'acte** : annoncé dès le début de l'acte, il change une règle du combat
  (Le Colosse, Le Pillard, L'Éclair, L'Enragé, Le Blindé, L'Imperturbable, Le Muet,
  Le Vampire, L'Épineux — voir `packages/shared/src/bosses.ts`).
- **Courbe** : la puissance des ennemis est fixée par acte (`ACT_SCALE` dans
  `rules.ts`) et monte un peu à chaque niveau de l'acte. Après l'acte 8, elle
  double (puis plus) à chaque acte.
- **Anti-boule de neige** :
  - les passifs de boss donnent un bonus permanent en pourcentage (Rage +15 % de
    dégâts, Vitalité +15 % de PV, rendement décroissant en racine carrée ;
    Régénération 6 % par victoire, 18 % max), et non plus un gain à chaque victoire ;
  - la chance critique plafonne à 75 %, chaque point au-delà devient 2 % de
    dégâts critiques ; les bonus de chance critique sont réduits ;
  - la boutique n'ouvre qu'une fois par acte ; l'élite rapporte 3 or ;
  - le mode Classique garde les règles d'origine.
- **Victoire (acte 8)** : coffre de 3 caisses (1 Prisma, 2 Red), +15 or pour le
  mode infini, écran récapitulatif, et une couronne (avec le nombre de victoires)
  à côté du nom au classement.
- **Économie** : l'or par victoire et le coût du soin montent avec les actes.
- **Anti-frustration** (le boss doit être un vrai duel, pas un coup de dé) :
  - aucun coup ennemi ne retire plus de **30 % des PV max** : pas de mort en un coup ;
  - **repos avant le boss** : +30 % des PV max juste avant le combat ;
  - **Sursis** : une fois par combat de boss, si tu devais mourir alors que le boss
    est sous 25 % de PV, tu restes à 1 PV ;
  - les effets de boss sont adoucis (Colosse +30 % PV, Blindé −35 % sur les coups
    non critiques, Imperturbable divise les critiques par deux, Le Muet coupe la
    première carte du deck) ;
  - chaque victoire rend 8 % des PV max ;

### Régler l'équilibrage

```bash
npm run balance
```

Simule des centaines de parties avec trois profils (débutant, moyen, expert) et
affiche la survie par acte, la dureté des combats et l'apport de chaque carte.

```bash
npm run balance:calibrate
```

Recalcule `ACT_SCALE` : pour chaque acte, cherche la puissance ennemie qui donne
au joueur de référence (expert, collection complète) le taux de réussite cible
(`TARGET_CLEAR` dans `test/sim/calibrate.ts` : 95 % à l'acte 1, puis une baisse
douce jusqu'à 50 % à l'acte 8, soit ~8 % de victoires pour l'expert au palier 1). L'expert
mesure le gain réel de chaque amélioration (critique compris), monte sa chance
critique, et met son or dans la Forge plutôt que dans les perks d'économie.. À relancer
après tout changement de cartes ou d'économie, puis coller la table affichée.

```bash
npm run balance:history
```

Analyse les vraies parties terminées sur ce serveur (morts par acte, boss fatals).

## Boutique (mode Deck)

- **Cartes** : 2 cartes de ta collection (3 avec *Étal élargi*), prix selon la
  rareté et l'édition. **Relancer** : 2 or, +1 à chaque relance (remis à zéro à
  chaque boutique).
- **Boosters** : Combat (1 carte parmi 3), Méga (2 parmi 5), Entraînement (1 bonus
  de stats parmi 3), Éclat (1 carte parmi 2, édition spéciale garantie).
- **Deck toujours visible** : clique une carte pour la vendre ou la déplacer (ou
  fais-la glisser), y compris pendant l'ouverture d'un booster. Survoler une carte
  affiche ses effets et l'impact chiffré sur tes stats.
- **Amélioration** : une par visite, 10 or, permanente pour la partie (Étal élargi,
  Marchandage, Relance offerte, Coffre-fort, Sacoche, Flair, Infirmerie, Boosters garnis).
- **Services** : la **Forge** (+8 % de dégâts, 8 or puis +4 à chaque passage) et
  **Changer de boss** (une fois par acte, 6 + 2 × acte or) pour éviter un boss qui
  contre ton build.
- **Économie** : 1 or par victoire (+1 tous les 3 actes), bonus d'élite et de boss, **intérêts** de +1 or par tranche
  de 5 or détenus, versés une fois par acte à la boutique de boss (plafond 5, ou 10
  avec Coffre-fort).
  Revente à 50 %. Chaque victoire rend 8 % des PV max.

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
