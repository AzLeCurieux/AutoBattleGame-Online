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

