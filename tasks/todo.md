# Execution ledger

- [x] Audit current source/config/tests; create isolated branch.
- [x] A: private card transport, action validation/replay protection, session expiry/rate bounds, regression coverage.
- [x] B: responsive table, ready lobby, tutorial/settings/invite flows, explicit card selection/confirmation.
- [x] C: SQLite profiles/history/results/social features wired to the client.
- [x] D: participation progression/cosmetics/public queue/practice bots.
- [x] E (local): build/syntax scripts, Render blueprint, native server configuration guard, visibility/audio lifecycle, deployment documentation.
- [ ] E (external): HTTPS hosting with persistent disk, native asset sync against that URL, signing, physical Android lifecycle/performance checks, macOS/iOS build and device checks.

## Resumed 2026-10-19

Recovered the unfinished beta branch. Fixed the test transport's empty payload encoding, wired the old client to versioned actions and readiness, extracted CSS/JS, and connected profiles, social actions, practice, quick play and cosmetics. Fixed enabled analytics crashing on bots without profile IDs. Corrected Render health check and added the missing npm build/lint commands. No remote deployment, push or hosting purchase.

Verification:
- `npm test`: 28 passing tests, including real network rounds, exactly-once persistence, private draws, stale actions, public readiness and bot turns.
- `npm.cmd run lint` / `npm.cmd run build`: pass (syntax check, not a semantic linter).
- `node scripts/browser-check.js`: isolated real Chrome, 1280×800 and 390×844; friends/request acceptance/invitations, readiness, exact two-step drawing, full round, refresh/reconnect, rematch, profile XP and practice pass with no browser/server errors. Screenshots in ignored `artifacts/`. Reveal overlays no longer intercept interaction.
- Review mutation: inverted the source-version equality check; the client regression test failed as intended, then source was restored.
- Android `testDebugUnitTest --offline`: passed with JDK 21 and fresh temporary build outputs using a temporary Gradle init script. Standard output directories failed Gradle cleanup; no source deletion or build-setting relaxation was used. Existing flatDir/unchecked warnings remain.

Known limits: no public HTTPS endpoint supplied; no installed-device test or iOS toolchain run. Browser phone emulation does not prove native behavior or real-device performance. Profiles are guest-token based with no recovery/deletion/export flow; public launch requires these and verified backups, as documented in DEPLOY.md. Active rounds are interrupted by server restarts. The separate untracked `TeamAi-test/` directory was not changed.
