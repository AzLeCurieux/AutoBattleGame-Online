# AutoBattleGame Online

AutoBattleGame Online is a real-time multiplayer auto-battler built on Node.js. Players collect cards, assemble decks, and send their fighters into automated combat rounds resolved entirely on the server. The game features persistent progression, a live leaderboard, a loot box economy, and an administrative monitoring interface.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Getting Started](#getting-started)
4. [Project Structure](#project-structure)
5. [Game Mechanics](#game-mechanics)
6. [License](#license)

---

## Features

- **Auto-Battle Combat** - Turn-based combat loops are computed server-side, eliminating any possibility of client manipulation.
- **Card System** - Cards are divided into seven rarity tiers, each with distinct base statistics and special effects applied during combat resolution.
- **Deck Management** - Players curate a personal deck from their card collection and configure which cards enter each fight.
- **Loot Box Economy** - Weighted probability tables govern card acquisition through purchasable loot cases, with odds publicly disclosed on the probability page.
- **Card Shop** - A direct-purchase shop offers cards at fixed gold prices, validated server-side before any inventory update.
- **Card Modifiers** - Equipped modifiers stack multiplicatively or additively on card statistics, allowing meaningful customization within defined balance constraints.
- **Real-Time Leaderboard** - Rankings are broadcast via Socket.io whenever a match concludes, providing instant global standing updates.
- **Boss Upgrade System** - After reaching score thresholds, players unlock boss-tier upgrades that augment base fighter attributes.
- **Gambling Page** - A secondary gold-sink activity with transparent probability visualization.
- **Admin Panel** - A password-protected dashboard exposes user management and live server metrics.
- **Server Monitoring** - An integrated monitoring page reports CPU, memory, active connections, and request throughput using system-level probes.
- **Cheat Detection** - Heuristic checks on the server flag implausible click rates and impossible state transitions.
- **Responsive Interface** - CSS layouts adapt to desktop, tablet, and mobile viewports.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| HTTP server | Express 4 |
| Real-time transport | Socket.io 4 |
| Database | SQLite 3 (via `sqlite3` binding) |
| Authentication | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` |
| Security headers | Helmet |
| Rate limiting | `express-rate-limit` |
| Response compression | `compression` |
| Input validation | `express-validator` |
| Frontend | HTML5, CSS3, Vanilla JavaScript (no framework) |

---

## Getting Started

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x

### Installation

```bash
git clone https://github.com/AzLeCurieux/AutoBattleGame-Online.git
cd AutoBattleGame-Online
npm install
```

### Configuration

Copy the example environment file and adjust values as needed:

```bash
cp .env.example .env
```

Key variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | TCP port the server listens on |
| `JWT_SECRET` | — | Secret key for JWT signing (required) |
| `DB_PATH` | `./database/game.db` | Path to the SQLite database file |
| `ADMIN_PASSWORD` | — | Password for the admin panel |

### Running

```bash
# Development (auto-restart on file change)
npm run dev

# Production
npm start
```

The application is available at `http://localhost:3000` once the server reports that the database has been initialized.

---

## Project Structure

```
.
├── server.js                  # Entry point: Express app, Socket.io, middleware wiring
├── package.json
├── .env.example
│
├── game/                      # Server-side game engine
│   ├── GameManager.js         # Match lifecycle, room management
│   ├── ServerGameManager.js   # Authoritative combat resolution
│   └── GameStateManager.js    # Per-player state snapshots
│
├── routes/                    # Express route handlers
│   ├── auth.js                # Registration, login, JWT issuance
│   ├── game.js                # Game state endpoints
│   ├── leaderboard.js         # Rankings read/write
│   ├── loot.js                # Loot case opening
│   └── shop.js                # Card shop transactions
│
├── middleware/
│   └── auth.js                # JWT verification middleware
│
├── database/
│   └── db.js                  # SQLite connection and schema initialization
│
├── security/
│   ├── CheatDetection.js      # Heuristic anti-cheat checks
│   └── SimpleSessionManager.js
│
├── utils/
│   └── logger.js
│
├── scripts/
│   ├── reset-database.js
│   └── generate-loot-config.js
│
├── js/                        # Client-side JavaScript (no bundler)
│   ├── main.js                # Application bootstrap
│   ├── Game.js                # Client game loop and rendering
│   ├── cards/
│   │   ├── CardSystem.js      # Card data, rarity definitions
│   │   ├── CardEffectHandler.js
│   │   └── CardModifiers.js
│   ├── battle/
│   │   └── Upgrades.js
│   ├── gambling/
│   │   └── GamblingPage.js
│   ├── loot/
│   │   └── lootData.js
│   ├── shop/
│   ├── online/
│   │   └── OnlineManager.js
│   └── ui/
│       ├── Navbar.js
│       ├── DeckUI.js
│       └── AnimationUtils.js
│
├── css/                       # Stylesheets per feature area
│   ├── main.css
│   ├── card-modifiers.css
│   └── card-shop.css
│
└── img/                       # Static assets
    ├── cartes/                # Card artwork (one file per card)
    └── case/                  # Loot case artwork
        ├── Caisse_icons/
        └── Caisse_trimmed/
```

---

## Game Mechanics

### Combat Resolution

When a player initiates a fight, the server constructs a combat context containing the player's active deck and a generated enemy set scaled to the current level. Each combat tick evaluates attack order by speed, applies damage modified by critical-hit rolls, triggers any card effects registered for that phase, and checks win/loss conditions. The result is serialized and emitted back to the client over a Socket.io event; the client only renders the outcome.

### Card Rarity and Statistics

Cards are assigned a rarity tier from 1 (common) to 7 (legendary). Base statistics (attack, defense, health, speed) scale with the tier according to a polynomial curve defined in `js/cards/CardSystem.js`. Higher tiers also unlock effect slots that allow passive or active abilities to trigger during combat.

### Loot System

Each loot case type carries a probability distribution over rarity tiers. When a case is opened, the server samples the distribution, selects a card uniformly from the eligible tier, and records the result in the player's inventory. All probability tables are accessible at the `/probability-charts` route for transparency.

### Progression

Experience and gold are awarded after each combat based on enemy level and outcome. Gold funds loot case purchases and shop transactions. Experience accumulates toward fighter level thresholds that unlock upgrade slots in the boss upgrade system.

---

## License

This project is distributed under the MIT License. See `LICENSE` for full terms.
