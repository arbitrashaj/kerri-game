# Running and packaging Kerri

Use Node 24.15 or later in the Node 24 line (the server uses built-in SQLite). Install with `npm ci --ignore-scripts`. Run `npm test`, `npm run lint`, `npm run build`, then `npm start`. Open `http://localhost:3000`. Environment values in `.env.example` must be set in your shell or hosting provider; copying that file alone does not load them.

`npm run lint` checks JavaScript syntax without changing files. It is not a full semantic/style linter. `npm run build` validates scripts, copies the locally installed Socket.IO client plus MIT license, and generates public `www/config.js`. No secrets belong in `SERVER_URL` or client assets. The web build defaults to the same origin.

## Render

On Render, choose **New > Blueprint**, connect `arbitrashaj/kerri-game`, and select branch `main`. Render reads `render.yaml` for the build/start commands, health endpoint and persistent disk. Review the paid compute/disk configuration before creating the service. For `ALLOWED_ORIGINS`, enter `https://localhost,capacitor://localhost` initially; same-origin web access is accepted automatically. Add the actual HTTPS origin if using another web frontend.

For an existing manually configured web service, pushing GitHub files alone does not attach a disk. Set build command `npm ci --ignore-scripts && npm run build`, start command `npm start`, Node version `24.15.0`, health check `/healthz`, and attach a persistent disk at `/var/data` with `KERRI_DB=/var/data/kerri.sqlite`. Keep one instance. After deployment, check `/healthz` and play a complete round with two browsers.

The blueprint `render.yaml` describes one paid web instance with a persistent disk at `/var/data`; it has not been deployed automatically. Its fields follow the [official Render blueprint reference](https://render.com/docs/blueprint-spec). Set `ALLOWED_ORIGINS` to the actual HTTPS web origin and the native origins `https://localhost,capacitor://localhost`. Set `KERRI_DB=/var/data/kerri.sqlite`. SQLite survives application restarts only if the disk is persistent. In-memory rooms do not survive restarts: deploy between play sessions and make this limitation visible to beta testers. Multiple server instances require shared room state and a Socket.IO adapter before scaling; do not increase the instance count with this implementation.

Back up the database with SQLite's online backup mechanism or stop the app before copying the database and its WAL files. Test restoration before inviting a wider audience. The blueprint specifies a paid plan/disk; review provider pricing before creating it. No hosting purchase or external deployment has been made.

## Android

Set `SERVER_URL=https://YOUR-SERVER` then run `npm run build:android` and `npx cap sync android`. The native build refuses a missing server origin. For localhost development only, explicitly set `ALLOW_INSECURE_LOCALHOST=true`; Android device localhost does not point to your computer, so use an HTTPS development endpoint for a physical phone.

Build from Android Studio with JDK 21 and the Android SDK, or run `android/gradlew.bat assembleDebug` on Windows. A release requires your private signing key and Play Console account. Never commit the key, passwords, or local SDK paths. Verify safe areas, Android Back, foreground/reconnect and audio after backgrounding on a physical mid-range phone. A successful web or Gradle build does not demonstrate device behavior.

## iOS later

The shared web app is the starting point. Add the matching Capacitor iOS package/platform on macOS, sync with a configured HTTPS server, then build in Xcode. App signing, Apple certificates/profiles and physical-device testing are still required. iOS support is not claimed as tested by an Android/web build.

## Data, metrics, and fairness

Profiles are guest accounts tied to a private browser token. Only a SHA-256 token hash is stored, with a sliding 90-day login expiry. Clearing local storage loses access; there is no email recovery yet. SQLite stores profiles, accepted/pending friendships, match results and cosmetic choices. Guest tokens expiring does not erase historical match records. Before public launch, add a verified account deletion/export flow and document backup retention.

Leaderboard order rewards completed human online games, not skill in a game substantially influenced by luck. Each eligible completed round gives 10 XP, limited to the first ten per UTC day. Practice, bot and forfeit rounds do not award XP. The daily challenge is three completed online rounds; it gives recognition and the ordinary capped round XP, not a hidden bonus. Cosmetics unlock at visible participation thresholds. No payments, advertisements or pay-to-win are implemented. Optional future monetization can sell cosmetic designs; rewarded ads must be opt-in outside turns.

Analytics are disabled unless `ANALYTICS_ENABLED=true`. Enabled metrics remain in the local database, with no third-party delivery; raw events are removed after 30 days. Authentication records one activity event per UTC day. Reports show actual event counts and D1/D7 retention (activity in the 24-hour window one/seven days after account creation, among sufficiently old accounts). Empty cohorts return a null rate, never invented results. A mixed cohort spanning analytics enable/disable periods is not a reliable retention estimate. Treat first-match conversion and invitation counts as diagnostics; no market-success claim follows from them.

## Beta checks still required

Keep the project progress document up to date with actual executed checks. Release gates include full multiplayer rounds, duplicate actions, reconnect/refresh, hidden-card isolation, exactly-once results, narrow screens and native lifecycle. Hosting, real-device performance, signing and iOS cannot be inferred from local automated tests. Measure tutorial completion, time to first match, completed rounds, rematches, reconnect failures, D1/D7 returns and shared invitations on an explicitly configured beta cohort.
