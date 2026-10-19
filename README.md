# Kujt i ngec Kerri

Multiplayer card game served by Node.js, Express and Socket.IO, with a shared web/Capacitor client. Guest profiles, finished rounds, friends and participation XP persist in SQLite. Active rooms stay in memory and are interrupted by server restarts.

```sh
npm ci --ignore-scripts
npm run build
npm start
npm test
npm run lint
```

Use Node.js 24.15 or later in the Node 24 line. Open `http://localhost:3000`. Set `PORT` to change the port. Tests include real HTTP/WebSocket gameplay and database persistence. `node scripts/browser-check.js` runs an isolated headless Chrome check with two guests and desktop/phone viewports; set `CHROME_PATH` if Chrome is installed elsewhere. Screenshots are saved in ignored `artifacts/`.

Create a room or join with a code/link. Guests press **Jam gati** before the host starts. On your turn, open the highlighted opponent's hand, select a hidden card and confirm. Public quick play, practice bots, profile history, friend invitations and participation cosmetics are available from the home screen. Practice does not award XP.

During a round, disconnecting a player with cards pauses play for up to 60 seconds. Reconnecting restores their hand. Expiration forfeits the round; the remaining players can start another round. Reconnecting requires the private session token saved by the browser. Sessions created before this update must join a new room.

The queen and ace variants remove the matching same-color card (Q♣ or A♦), leaving Q♠ or A♥ as the unique Kerri. The joker variant uses the full deck plus one joker.

## Android

Use Java 21 for the Android build. The shared client is in `www/`. Set `SERVER_URL` to your HTTPS server origin, run `npm run build:android`, then `npx cap sync android`. Native builds require a configured server URL. Hosting, signing and physical-device verification remain required. See [deployment instructions](docs/DEPLOY.md) and [the execution ledger](tasks/todo.md).

## Dependency audit

Reviewed 2026-10-17: runtime dependencies have no npm audit findings after compatible updates. Three moderate development-tool findings remain through `@capacitor/cli -> xcode -> uuid`. The affected UUID buffer APIs are not called by xcode, which only uses `uuid.v4()` without a buffer. No forced major upgrade or dependency override was applied. Review when Capacitor updates this dependency, or by 2026-11-17.
