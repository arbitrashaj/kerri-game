# Kerri beta: scope and execution

User-approved direction: evolve the existing Express/Socket.IO/vanilla-JS/Capacitor game. No restart from scratch. Branch `feature/kerri-beta`.

| Phase | Scope | Verification |
|---|---|---|
| A | Preserve rules; private cards, crypto shuffle, versioned/idempotent actions, bounded sessions/messages, reconnect | Unit + multiple real Socket.IO clients |
| B | Extract existing web page; red/charcoal/gold table, precise two-step draw, readiness, invitation links, tutorial/settings, mobile accessibility | Browser + viewport checks |
| C | SQLite guest profiles, exactly-once results, history, friends/invites | Reopen database + auth/transaction tests |
| D | Participation XP, unlocked cosmetics, public quick play, clearly marked practice bots | Server tests; no demo results |
| E | Build/lint scripts, reproducible Render single-instance disk deployment, Capacitor web assets, lifecycle hooks, opt-in local metrics, beta checklist | Tests/build/browser/native compile where available |

Architecture: `server.js` retains authoritative game logic; `server/store.js` owns persistent data; `www/` shares the real client between web and Capacitor. SQLite on a persistent disk is suitable for a single-instance beta. Active rooms remain in memory: deploys abort ongoing rounds; only finished rounds persist. Scaling beyond one instance requires shared room ownership/state, not extra replicas.

Acceptance: a new guest learns to draw from the designated opponent, joins by link/code, finishes a round and rematches. No opponent card identities in public payloads. Duplicate/stale actions do not mutate state. No unearned XP from practice/forfeits. No telemetry leaves the server; metrics are opt-in.

Ordinary technical choices are authorized by the user's request; no additional spec approval gate. Existing main-game rules are retained. No payments or advertising integration in beta.

Real external blockers: public HTTPS server URL and persistent hosting disk for Android production; macOS/Xcode/signing/device testing for iOS; physical device performance measurements. Never claim these are done by local tests.
