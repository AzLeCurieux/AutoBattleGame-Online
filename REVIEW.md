# Review — AutoBattleGame-Online (version d'origine)

Audit du dépôt `AzLeCurieux/AutoBattleGame-Online` avant la réécriture. Les
références `fichier:ligne` pointent vers le code d'origine.

**Verdict :** le jeu n'est pas sécurisable en l'état. Le client décide de tout
(loot, niveau, score, or), le serveur sert son propre code source, et deux
simulations de combat incompatibles coexistent. La réécriture repart d'un moteur
unique côté serveur ; les règles de jeu, elles, sont conservées.

~33 700 lignes JS/HTML/CSS → ~4 400 lignes TypeScript, 26 tests.

---

## 1. Sécurité

### Critique — exploitable par n'importe quel joueur

| # | Problème | Où | Impact |
|---|----------|----|--------|
| S1 | `express.static(__dirname)` sert **toute la racine du projet** ; la liste blanche de `requireAuthForPages` ouvre explicitement `/database/`, `/routes/`, `/game/`… | `server.js:191`, `server.js:141-160` | Code serveur téléchargeable, base SQLite potentiellement exposée selon `SQLITE_DB_PATH`. |
| S2 | Le client **crée son propre loot** : `save_loot_boxes` / `save_loot_item` enregistrent ce que le navigateur envoie (id, rareté, données). Le tirage des caisses se fait en `Math.random()` côté client. | `server.js:768`, `server.js:825`, `js/gambling/GamblingPage.js:1107`, `js/loot/LootBoxSystem.js:444` | N'importe qui s'octroie toutes les cartes Gold en une ligne de console. |
| S3 | Niveau et score envoyés par le client (`update_level`, `submit_score`, `player_death`). Chaque contrôle échoué logge « continuing anyway » et accepte quand même. | `server.js:1023-1086`, `server.js:1359-1437` | Classement entièrement falsifiable. |
| S4 | La boutique fait confiance à `playerGold` et `cardPrice` venant du client ; la vente ne fait rien côté serveur. | `routes/shop.js:13-24`, `js/shop/CardShop.js:270-396` | Or et achats illimités. |
| S5 | Mot de passe admin par défaut `admin123`, comparé en clair, sans limitation de débit ; JWT admin valable 24 h. | `server.js:201` | Prise de contrôle admin triviale si la variable n'est pas définie. |
| S6 | Secret JWT par défaut `'your-secret-key-change-in-production'` (5 copies dans `server.js`), alors que `middleware/auth.js` exige la variable. | `server.js:176, 209, 234, 411, 438` | Jetons forgeables si l'env est mal configuré ; comportement incohérent selon la route. |
| S7 | `/api/auth/users` liste **tous les comptes** avec un drapeau `hasPin` ; PIN à 4 chiffres autorisé ; limite de 300 req/15 min, et le limiteur dédié à l'auth (`createAuthRateLimit`) n'est jamais branché. | `routes/auth.js:66-78`, `routes/auth.js:25`, `routes/auth.js:126`, `server.js:87` | 10 000 combinaisons → comptes bruteforçables en quelques heures. |
| S8 | `POST /api/leaderboard/update` sans authentification. | `routes/leaderboard.js:183` | N'importe qui peut déclencher des reconstructions coûteuses. |

### Élevé

- **S9** — Le jeton est stocké en `localStorage` et accepté dans l'URL (`?token=`), où il fuit dans les logs et l'historique (`server.js:167, 226, 406, 429`, `middleware/auth.js:142`). Combiné à S11, n'importe quelle XSS vole la session.
- **S10** — CORS `*` sur Express **et** Socket.IO (`server.js:33`, `server.js:82`, avec un `TODO` laissé là).
- **S11** — XSS stockée : noms et `item_image` venant de la base sont injectés via `innerHTML`. Les avatars acceptent n'importe quelle URL http(s), ce qui permet du tracking par pixel.
- **S12** — CSP affaiblie : `'unsafe-inline'` pour les scripts **et** pour les attributs `onclick` (`server.js:66-68`). Elle ne protège donc pas contre S11.
- **S13** — `/api/auth/profile`, `/avatar` et `/logout` vérifient la signature JWT mais pas que la session existe encore. Une déconnexion ne révoque donc rien.
- **S14** — `/api/monitoring/stats` est accessible à tout utilisateur connecté et expose ports, PID, versions et disque (`server.js:295`).
- **S15** — `error.message` est renvoyé au client dans de nombreuses réponses (`server.js:787-972`, `routes/game.js:74`).
- **S16** — Les DevTools (god mode F2, testeur de cartes) sont livrés en production avec `DEV_MODE = true` codé en dur (`js/dev/DevTools.js:7`).
- **S17** — Une IP réseau privée est codée en dur dans les logs (`server.js:1638`).

---

## 2. Bugs

- **B1** — `ServerGameState.buyUpgrade` utilise une variable `upgradeValue` jamais définie, d'où une `ReferenceError` sur les upgrades critiques (`game/ServerGameState.js:193-197`).
- **B2** — Deux simulations incompatibles : l'ennemi a 50 PV côté serveur contre 400 côté client. La « validation serveur » ne peut donc jamais correspondre à ce que voit le joueur.
- **B3** — Aucune ligne n'est jamais insérée dans `game_sessions`, donc `updateGameSession` ne met rien à jour. Tout le système anti-triche tourne à vide.
- **B4** — Les cartes `lucas_voiture` (combo) et `glamal_voiture` (vitesse d'attaque) ont une description mais aucun effet.
- **B5** — Les couleurs de rareté diffèrent selon les fichiers (boutique, collection, caisses).
- **B6** — `scripts/give_all_cases.js:1` fait `require('../database/game.db')` : il charge le fichier SQLite comme un module JS et plante.
- **B7** — Courses d'écriture : les mises à jour d'or et d'inventaire en `async` concurrentes, sans transaction, provoquent des doubles dépenses possibles.

---

## 3. Performance

- **P1** — Le classement fait `DELETE FROM leaderboard` puis une reconstruction complète par sous-requêtes corrélées, toutes les 10 s et à chaque événement (`database/db.js:347`, `database/db.js:385`, `server.js:584`).
- **P2** — `getUserBestScore` est appelé à chaque montée de niveau.
- **P3** — Il y a des `console.log` à emojis à chaque action, ce qui coûte en I/O et noie les vrais logs.
- **P4** — Les colonnes sont ajoutées par `ALTER TABLE` au démarrage au lieu de migrations versionnées.
- **P5** — Des dépendances lourdes sont installées en production pour rien : `pm2`, `express-status-monitor`, `@socket.io/admin-ui`, `systeminformation`, `uuid`. Il y a aussi `cors`, qui n'est utilisé qu'en mode permissif.

---

## 4. Inutile ou trompeur

- **U1** — Le README annonce un combat côté serveur, un `.env.example` et une page `/probability-charts` : rien de tout cela n'existe.
- **U2** — Les derniers commits (pity, skin Saint-Valentin, bouton de partage, fil d'Ariane…) ne modifient que `CHANGES.log`. L'historique ne décrit pas le code.
- **U3** — Toutes les images de `img/` sont des PNG 1×1 ou des SVG de remplissage.
- **U4** — Il y a du code mort ou dupliqué : `ServerValidator`, `CheatDetection`, `SessionManager` **et** `SimpleSessionManager`, ainsi que l'ancien `game_action`.
- **U5** — `.dockerignore` parle de JavaFX, alors qu'il n'y a pas de Dockerfile.
- **U6** — L'identifiant de carte `all_nigg` est injurieux ; il est renommé `all_squad` dans la réécriture.

---

## 5. Ce que fait la réécriture

| Problème d'origine | Réponse |
|---|---|
| Client autoritaire (S2-S4, B2, B3) | **Un seul moteur**, pur et déterministe (`packages/shared/src/engine`). Le client n'envoie que des intentions (`fight`, `chooseUpgrade`, `shopBuy`…), validées par zod. Le serveur simule le combat et renvoie un journal d'événements que le client se contente d'animer. La graine PRNG reste côté serveur. |
| Loot client (S2) | Les caisses sont attribuées par le moteur lors d'un kill, et le tirage se fait côté serveur avec `crypto.randomBytes`. La roulette côté client est purement cosmétique : elle s'arrête sur la carte déjà tirée. |
| Fichiers servis (S1) | Seul le build Vite (`apps/web/dist`) est servi, sur les mêmes URLs qu'avant (`/`, `/login`, `/gambling`, `/inventory`, `/monitoring`). Les pages protégées redirigent côté serveur vers `/login`. |
| Auth (S5-S9, S13) | Hash scrypt, un hash factice à temps constant pour les comptes inexistants, et un mot de passe de 8 caractères minimum. La session est opaque, stockée hashée en base, dans un cookie `httpOnly`, `SameSite=Strict`, avec expiration glissante, et la déconnexion la révoque réellement. Le PIN à 4 chiffres et l'écran « Qui joue aujourd'hui ? » sont conservés (choix de design), mais protégés : 5 essais ratés verrouillent le compte 15 min, puis 30, 60… jusqu'à 24 h ; la liste publique n'expose que pseudo, avatar et type de code. Plus de mot de passe admin partagé : le rôle `admin` est attribué par un script CLI. |
| CSRF, CORS (S10) | Une vérification de l'`Origin` porte sur chaque requête qui modifie l'état et sur la poignée de main Socket.IO. Il n'y a plus de CORS. |
| XSS (S11, S12) | Rendu React (aucun `innerHTML` avec des données). Les avatars sont une lettre générée ou une URL **https** validée. La CSP est `'self'` sans `unsafe-inline` (images `https:` autorisées pour les avatars). |
| Débit (S7, S8) | La limite globale est de 300 req/min, avec 10 connexions par 15 min et 5 inscriptions par heure par IP. |
| Fuites (S14-S17) | Le gestionnaire d'erreurs est centralisé et n'expose pas les messages internes. Les stats admin sont réservées au rôle admin et ne contiennent que des métriques de jeu. Il n'y a plus de DevTools ni d'IP codée en dur. |
| Bugs (B1, B4-B7) | Les 50 cartes sont décrites par une union typée de 31 effets, toutes implémentées et testées. La rareté a une source unique. Les écritures passent par des transactions SQLite (`BEGIN IMMEDIATE`). |
| Perf (P1-P5) | Le classement est une simple requête indexée sur `users.best_level`, poussée en socket avec un debounce de 500 ms. Les migrations sont versionnées par `PRAGMA user_version`, et l'on utilise `node:sqlite` (natif, pas d'addon C++). Il reste 7 dépendances de production côté serveur. |
| Outillage | TypeScript strict, ESLint, Vitest (moteur + API), CI GitHub Actions et Dockerfile multi-étapes. |

### Règles conservées

Les règles de jeu sont reprises telles quelles :
- **Stats de départ :** 1000 PV, 200 dégâts, 1 % de critique.
- **Ennemis :** courbes de PV et de dégâts identiques ; boss tous les 5 niveaux avec ×2 PV et ×1,25 dégâts.
- **Améliorations :** 2 choix sur 6, et 2 passifs de boss sur 3.
- **Caisses :** 8 caisses et leurs probabilités.
- **Boutique :** tous les 10 niveaux, revente à 70 %.
- **Modificateurs :** Foil, Holographic, Polychrome, Negative.
- **Deck :** 5 emplacements.

### Interface

La v2 a d'abord repris les CSS d'origine à l'identique, puis l'interface a été refaite :
seuls la barre de navigation et le fond shader sont conservés. Causes du clignotement
de la v1 corrigées au passage : nombres de dégâts sans animation supprimés au bout de
400 ms, deux règles `.modal` contradictoires, et ennemis dont `display`/`visibility`/
`opacity` étaient modifiés par plusieurs minuteurs à la fois. Le nouveau combat
n'anime que `transform`/`opacity` via la Web Animations API.

Correctif de production trouvé pendant les tests : la limite de débit globale
(300 req/min) s'appliquait aussi aux fichiers statiques, si bien que la page
Collection (60 images) pouvait se faire bloquer. Elle ne s'applique plus qu'à
l'API, et les fichiers statiques sont mis en cache (assets versionnés : 1 an).

### Volontairement abandonné

- Les boutons de triche (GOD, +1, +9) et les DevTools (F2).
- La page `/admin-login` à mot de passe partagé (le rôle admin donne accès à `/monitoring`).
- La liste des ports ouverts de la machine (seul le port de l'application est affiché).

### Reste à faire (hors périmètre)

- De vraies illustrations de cartes : les images du dépôt sont des placeholders 1×1. Il suffit de déposer les vraies dans `apps/web/public/img` (mêmes noms de fichiers ; `5_all_nigg.*` a été renommé `5_all_squad.*`).
- Un script de migration des comptes depuis l'ancienne base. Les mots de passe bcrypt peuvent être vérifiés puis re-hashés à la première connexion.
- Sortir zod du bundle web (~50 ko) en séparant les schémas du protocole.
