# Kujt i ngec Kerri

Multiplayer card game served by Node.js, Express and Socket.IO. One server process holds rooms and scores in memory; restarting it clears them.

```sh
npm ci --ignore-scripts
npm start
npm test
```

Open `http://localhost:3000`. Set `PORT` to change the port. Tests require Node.js 22 or newer and include real HTTP/WebSocket gameplay without extra test dependencies.

During a round, disconnecting a player with cards pauses play for up to 60 seconds. Reconnecting restores their hand. Expiration forfeits the round; the remaining players can start another round. Reconnecting requires the private session token saved by the browser. Sessions created before this update must join a new room.

The queen and ace variants remove the matching same-color card (Q♣ or A♦), leaving Q♠ or A♥ as the unique Kerri. The joker variant uses the full deck plus one joker.

## Android

Use Java 21 for the Android build. The Capacitor project is present, but `www/index.html` is empty and no hosted game URL has been configured. Android gameplay is incomplete until a server address is supplied and the web entry point is connected to it. The web server works independently.

## Dependency audit

Reviewed 2026-10-17: runtime dependencies have no npm audit findings after compatible updates. Three moderate development-tool findings remain through `@capacitor/cli -> xcode -> uuid`. The affected UUID buffer APIs are not called by xcode, which only uses `uuid.v4()` without a buffer. No forced major upgrade or dependency override was applied. Review when Capacitor updates this dependency, or by 2026-11-17.
