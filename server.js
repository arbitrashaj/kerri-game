// ============================================================
//  Kujt i ngec Kerri — Server v2 (single-file deploy)
// ============================================================
const express  = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const { v4: uuidv4 } = require('uuid');
const http     = require('http');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ 
  server,
  perMessageDeflate: false
});

// Render.com requires explicit upgrade handling
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});
const PORT   = process.env.PORT || 3000;

// ── Serve single HTML file inline ─────────────────────────
const HTML = `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
  <meta name="theme-color" content="#1a1a1a"/>
  <title>Kujt i ngec Kerri ♠</title>
  <style>
/* ============================================================
   Kujt i ngec Kerri — Style v2
   Mobile-first, dark-mode ready, full responsive
   ============================================================ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:         #f0ede8;
  --surface:    #ffffff;
  --border:     rgba(0,0,0,0.10);
  --border-mid: rgba(0,0,0,0.18);
  --text:       #1a1a1a;
  --muted:      #666;
  --hint:       #aaa;
  --r-sm:       6px;
  --r-md:       10px;
  --r-lg:       16px;
  --r-xl:       22px;

  --red:        #c0392b;
  --red-bg:     #fef2f2;
  --blue:       #1a56db;
  --blue-bg:    #eff6ff;
  --green:      #166534;
  --green-bg:   #f0fdf4;
  --amber:      #92400e;
  --amber-bg:   #fffbeb;
  --kerri:      #be123c;
  --kerri-bg:   #fff1f2;
  --kerri-br:   #fb7185;
  --purple:     #6d28d9;
  --purple-bg:  #f5f3ff;
  --gold:       #b45309;
  --gold-bg:    #fef3c7;

  --shadow-sm:  0 1px 3px rgba(0,0,0,.08);
  --shadow-md:  0 4px 12px rgba(0,0,0,.10);
  --shadow-lg:  0 8px 24px rgba(0,0,0,.14);
}

body {
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  overflow-x: hidden;
}

50%      { transform: rotateY(180deg) scale(1.05); }
}
.loading-title { color: white; font-size: 22px; font-weight: 600; margin-bottom: 1.5rem; }
.loading-bar {
  width: 220px; height: 4px;
  background: rgba(255,255,255,.15);
  border-radius: 99px; margin: 0 auto .75rem;
}
.loading-fill {
  height: 100%; width: 0%;
  background: white; border-radius: 99px;
  transition: width .1s linear;
}
.loading-hint { color: rgba(255,255,255,.5); font-size: 13px; }

/* ── Phases ─────────────────────────────────────────────── */
.phase { display: none; }
.phase.active { display: block; animation: fadeIn .2s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

/* ── Wrappers ───────────────────────────────────────────── */
.home-wrap { max-width: 440px; margin: 0 auto; padding: 2rem 1rem 4rem; }
.game-wrap { max-width: 680px; margin: 0 auto; padding: .75rem .75rem 2rem; }

/* ── Home ───────────────────────────────────────────────── */
.home-logo { font-size: 56px; text-align: center; margin-bottom: .5rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,.15)); }
h1 { font-size: 26px; font-weight: 700; text-align: center; letter-spacing: -.5px; }
h2 { font-size: 20px; font-weight: 600; margin-bottom: 1rem; }
.home-sub { font-size: 13px; color: var(--muted); text-align: center; margin: 4px 0 1.5rem; }

/* ── Cards (UI panels) ──────────────────────────────────── */
.card {
  background: var(--surface);
  border: .5px solid var(--border);
  border-radius: var(--r-lg);
  padding: 1.1rem 1.15rem;
  margin-bottom: .85rem;
  box-shadow: var(--shadow-sm);
}
.section-label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 8px; font-weight: 500; text-transform: uppercase; letter-spacing: .4px; }
.label-hint { font-weight: 400; text-transform: none; letter-spacing: 0; }

/* ── Username row ───────────────────────────────────────── */
.username-row { display: flex; gap: 8px; align-items: center; }
.username-avatar {
  width: 40px; height: 40px; flex-shrink: 0;
  background: #1a1a1a; color: #fff;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 600;
}

/* ── Inputs ─────────────────────────────────────────────── */
input[type=text], select {
  width: 100%; padding: 10px 13px;
  border: .5px solid var(--border-mid);
  border-radius: var(--r-md);
  font-size: 15px; background: var(--bg);
  color: var(--text); font-family: inherit;
  outline: none; transition: border-color .15s, box-shadow .15s;
  -webkit-appearance: none;
}
input:focus, select:focus { border-color: #94a3b8; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }
.code-row { display: flex; gap: 8px; }
.code-row input { text-transform: uppercase; letter-spacing: 4px; font-size: 18px; font-weight: 700; text-align: center; }

/* ── Kerri options ──────────────────────────────────────── */
.kerri-options { display: flex; gap: 8px; }
.kerri-opt {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  gap: 4px; padding: 12px 8px;
  border: 1.5px solid var(--border-mid);
  border-radius: var(--r-md); cursor: pointer;
  transition: border-color .15s, background .15s;
}
.kerri-opt:hover { background: var(--bg); }
.kerri-opt.selected { border-color: #1a1a1a; background: #f8f8f8; }
.ko-icon { font-size: 20px; font-weight: 700; }
.ko-label { font-size: 12px; color: var(--muted); }

/* ── Buttons ────────────────────────────────────────────── */
.btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; padding: 12px 16px;
  border-radius: var(--r-md); border: .5px solid var(--border-mid);
  background: var(--surface); font-size: 15px; cursor: pointer;
  color: var(--text); font-family: inherit; text-align: center;
  transition: background .12s, transform .08s; text-decoration: none;
}
.btn:hover { background: var(--bg); }
.btn:active { transform: scale(.98); }
.btn-primary {
  font-weight: 600; font-size: 16px; padding: 14px;
  border-radius: var(--r-lg); background: #1a1a1a; color: #fff;
  border-color: #1a1a1a; margin-bottom: 4px; box-shadow: var(--shadow-sm);
}
.btn-primary:hover { background: #2d2d2d; }
.btn-primary:disabled { background: #999; border-color: #999; cursor: not-allowed; transform: none; }
.btn-secondary { margin-top: 8px; color: var(--muted); }
.btn-back { background: none; border: none; font-size: 14px; color: var(--muted); cursor: pointer; margin-bottom: 1rem; padding: 0; font-family: inherit; display: flex; align-items: center; gap: 4px; }
.btn-back:hover { color: var(--text); }
.btn-icon { font-size: 18px; line-height: 1; }
.btn-join {
  padding: 10px 20px; border-radius: var(--r-md);
  border: .5px solid var(--border-mid); background: var(--surface);
  font-size: 15px; font-weight: 600; cursor: pointer; white-space: nowrap;
  font-family: inherit; transition: background .12s;
}
.btn-join:hover { background: var(--bg); }

/* ── Divider ────────────────────────────────────────────── */
.divider { text-align: center; font-size: 13px; color: var(--hint); margin: 1rem 0; position: relative; }
.divider::before, .divider::after { content: ''; position: absolute; top: 50%; width: 38%; height: .5px; background: var(--border-mid); }
.divider::before { left: 0; } .divider::after { right: 0; }

/* ── Error ──────────────────────────────────────────────── */
.error-msg { background: var(--red-bg); color: var(--red); border-radius: var(--r-md); padding: 10px 14px; font-size: 14px; margin-top: 8px; border: .5px solid #fecaca; }

/* ── Lobby ──────────────────────────────────────────────── */
.lobby-hero { text-align: center; margin-bottom: 1rem; padding: 1.5rem 1rem; background: var(--surface); border-radius: var(--r-lg); border: .5px solid var(--border); box-shadow: var(--shadow-sm); }
.lobby-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
.room-code { font-size: 46px; font-weight: 800; letter-spacing: 8px; color: var(--text); line-height: 1; margin-bottom: 12px; }
.lobby-hint { font-size: 12px; color: var(--hint); margin-top: 4px; }
.lobby-hint.center { text-align: center; }
.btn-copy {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px; border-radius: var(--r-md);
  border: .5px solid var(--border-mid); background: var(--bg);
  font-size: 13px; cursor: pointer; font-family: inherit;
  transition: background .12s;
}
.btn-copy:hover { background: #e5e3de; }

.lobby-player-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 0; border-bottom: .5px solid var(--border); font-size: 14px;
}
.lobby-player-row:last-child { border: none; }
.player-dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }
.player-dot.offline { background: #d1d5db; }
.player-name-col { flex: 1; }
.host-badge { font-size: 11px; background: var(--gold-bg); color: var(--gold); border-radius: 99px; padding: 2px 8px; }
.kick-btn { background: none; border: .5px solid var(--border-mid); border-radius: var(--r-sm); padding: 3px 8px; font-size: 12px; color: var(--muted); cursor: pointer; }
.kick-btn:hover { background: var(--red-bg); color: var(--red); border-color: #fecaca; }

/* ── Leaderboard ────────────────────────────────────────── */
.lb-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 0; border-bottom: .5px solid var(--border); font-size: 13px;
}
.lb-row:last-child { border: none; }
.lb-rank { width: 22px; text-align: center; font-weight: 700; color: var(--muted); }
.lb-rank.gold   { color: #d97706; }
.lb-rank.silver { color: #6b7280; }
.lb-rank.bronze { color: #92400e; }
.lb-name { flex: 1; font-weight: 500; }
.lb-stats { display: flex; gap: 6px; }
.lb-win  { font-size: 12px; background: var(--green-bg); color: var(--green); border-radius: 99px; padding: 2px 8px; font-weight: 500; }
.lb-loss { font-size: 12px; background: var(--red-bg);   color: var(--red);   border-radius: 99px; padding: 2px 8px; font-weight: 500; }

.lb-panel { background: var(--surface); border: .5px solid var(--border); border-radius: var(--r-lg); padding: 1rem; margin-bottom: .85rem; box-shadow: var(--shadow-sm); }
.lb-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }

/* ── Game topbar ────────────────────────────────────────── */
.game-topbar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: .75rem; align-items: center; }
.chip { background: var(--surface); border: .5px solid var(--border); border-radius: 99px; padding: 5px 13px; font-size: 13px; color: var(--muted); box-shadow: var(--shadow-sm); }
.chip span { font-weight: 600; color: var(--text); }
.chip.my-turn { background: #1a1a1a; color: #fff; border-color: #1a1a1a; font-weight: 600; }
.chip-btn { cursor: pointer; border: .5px solid var(--border-mid); padding: 5px 11px; transition: background .12s; }
.chip-btn:hover { background: var(--bg); }

/* ── Msg box ────────────────────────────────────────────── */
.msg-box { border-radius: var(--r-md); padding: 10px 14px; font-size: 14px; margin-bottom: .85rem; background: var(--blue-bg); color: var(--blue); border: .5px solid #bfdbfe; }
.msg-box.warn    { background: var(--amber-bg); color: var(--amber); border-color: #fde68a; }
.msg-box.danger  { background: var(--red-bg);   color: var(--red);   border-color: #fecaca; }
.msg-box.success { background: var(--green-bg); color: var(--green); border-color: #bbf7d0; }

/* ── Opponents ──────────────────────────────────────────── */
#opponents-area { background: var(--surface); border: .5px solid var(--border); border-radius: var(--r-lg); padding: .9rem; margin-bottom: .85rem; box-shadow: var(--shadow-sm); }
.opp-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: .5px solid var(--border); }
.opp-row:last-child { border: none; }
.opp-info { min-width: 90px; }
.opp-name { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.opp-name .disc-tag { font-size: 11px; background: #f3f4f6; color: #9ca3af; border-radius: 99px; padding: 1px 7px; }
.opp-meta { font-size: 12px; color: var(--hint); margin-top: 2px; }
.opp-cards { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }

/* Card back (opponents) */
.card-back {
  display: inline-flex; align-items: center; justify-content: center;
  width: 38px; height: 54px; border-radius: 7px;
  border: .5px solid var(--border-mid);
  background: linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%);
  font-size: 15px; font-weight: 800; color: #6d28d9;
  transition: transform .12s, box-shadow .12s; user-select: none;
}
.card-back.drawable {
  cursor: pointer; border-color: #7c3aed;
  animation: pulse-glow .9s ease-in-out infinite alternate;
  box-shadow: 0 0 0 2px rgba(124,58,237,.2);
}
.card-back.drawable:hover { transform: translateY(-7px) scale(1.05); box-shadow: 0 6px 16px rgba(124,58,237,.3); }
@keyframes pulse-glow {
  from { border-color: #7c3aed; box-shadow: 0 0 0 2px rgba(124,58,237,.15); }
  to   { border-color: #a78bfa; box-shadow: 0 0 0 4px rgba(124,58,237,.05); }
}
.card-back.not-my-turn { opacity: .45; }
.card-back.disc { opacity: .25; pointer-events: none; }

/* ── My hand ────────────────────────────────────────────── */
.hand-area { background: var(--surface); border: .5px solid var(--border); border-radius: var(--r-lg); padding: .9rem; margin-bottom: .85rem; min-height: 108px; box-shadow: var(--shadow-sm); }
.hand-label { font-size: 12px; color: var(--muted); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: .4px; font-weight: 500; }
.hand-count { font-weight: 700; color: var(--text); background: var(--bg); border-radius: 99px; padding: 1px 8px; font-size: 12px; }
.cards-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: flex-end; }

.playing-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 52px; height: 74px; border-radius: 8px;
  border: .5px solid var(--border-mid); background: var(--surface);
  user-select: none; box-shadow: var(--shadow-sm);
  transition: transform .12s, box-shadow .12s;
}
.playing-card .rank { font-size: 17px; font-weight: 700; line-height: 1; }
.playing-card .suit { font-size: 13px; line-height: 1; margin-top: 3px; }
.playing-card.red-card   .rank, .playing-card.red-card   .suit { color: var(--red); }
.playing-card.black-card .rank, .playing-card.black-card .suit { color: #111; }
.playing-card.kerri-card { border-color: var(--kerri-br); background: var(--kerri-bg); box-shadow: 0 0 0 2px rgba(244,63,94,.15); animation: kerri-pulse 1.5s ease-in-out infinite alternate; }
.playing-card.kerri-card .rank, .playing-card.kerri-card .suit { color: var(--kerri); }
@keyframes kerri-pulse { from { box-shadow: 0 0 0 2px rgba(244,63,94,.15); } to { box-shadow: 0 0 0 5px rgba(244,63,94,.05); } }

/* Drawable card in modal */
.drawable-card { cursor: pointer; }
.drawable-card:hover { transform: translateY(-8px); box-shadow: var(--shadow-md); }

/* ── Log ────────────────────────────────────────────────── */
.log-area { background: var(--surface); border: .5px solid var(--border); border-radius: var(--r-lg); padding: .9rem; margin-bottom: .85rem; box-shadow: var(--shadow-sm); }
.log-label { font-size: 12px; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: .4px; font-weight: 500; }
.log-item { font-size: 13px; color: var(--muted); padding: 3px 0; border-bottom: .5px solid var(--border); }
.log-item:first-child { color: var(--text); font-weight: 500; }
.log-item:last-child { border: none; }

/* ── Chat ───────────────────────────────────────────────── */
.chat-area { background: var(--surface); border: .5px solid var(--border); border-radius: var(--r-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
#chat-messages { max-height: 130px; overflow-y: auto; padding: .7rem .9rem; display: flex; flex-direction: column; gap: 3px; }
.chat-msg { font-size: 13px; color: var(--text); line-height: 1.4; }
.chat-msg .chat-sender { font-weight: 600; color: var(--purple); }
.chat-msg.system { color: var(--hint); font-style: italic; }
.chat-input-row { display: flex; border-top: .5px solid var(--border); }
.chat-input-row input { flex: 1; border: none; border-radius: 0; background: var(--surface); padding: 10px 13px; font-size: 14px; }
.btn-send { padding: 10px 15px; background: none; border: none; border-left: .5px solid var(--border); cursor: pointer; font-size: 16px; color: var(--purple); transition: background .12s; }
.btn-send:hover { background: var(--purple-bg); }

/* ── Modal ──────────────────────────────────────────────── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: flex-end; justify-content: center; z-index: 200; padding: .5rem; }
@media (min-width: 480px) { .modal-overlay { align-items: center; } }
.modal-box { background: var(--surface); border-radius: var(--r-xl) var(--r-xl) 0 0; padding: 1.5rem 1.25rem 2rem; width: 100%; max-width: 520px; animation: slideUp .2s ease; }
@media (min-width: 480px) { .modal-box { border-radius: var(--r-xl); padding: 1.5rem; } }
@keyframes slideUp { from { transform: translateY(40px); opacity: .6; } to { transform: none; opacity: 1; } }
.modal-title    { font-size: 17px; font-weight: 600; margin-bottom: 4px; }
.modal-subtitle { font-size: 13px; color: var(--muted); }

/* ── Game over ──────────────────────────────────────────── */
.go-emoji { font-size: 64px; text-align: center; margin-bottom: .5rem; }
.go-loser { font-size: 30px; font-weight: 700; color: var(--red); text-align: center; margin-bottom: 4px; }
.go-sub   { font-size: 15px; color: var(--muted); text-align: center; margin-bottom: 1.5rem; }
.result-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; font-size: 14px; border-bottom: .5px solid var(--border); }
.result-row:last-child { border: none; }
.badge { font-size: 12px; font-weight: 500; padding: 3px 10px; border-radius: 99px; }
.badge-kerri { background: var(--red-bg);   color: var(--red); }
.badge-out   { background: var(--green-bg); color: var(--green); }
.badge-safe  { background: var(--blue-bg);  color: var(--blue); }

/* ── Reconnect banner ───────────────────────────────────── */
#reconnect-banner {
  position: fixed; top: 0; left: 0; right: 0; z-index: 500;
  background: #1a1a1a; color: #fff;
  padding: 10px 16px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; gap: 10px;
  box-shadow: var(--shadow-md);
}
.reconnect-inner { display: flex; align-items: center; gap: 10px; }
.reconnect-spinner {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.3);
  border-top-color: white; border-radius: 50%;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Responsive ─────────────────────────────────────────── */
@media (max-width: 400px) {
  .room-code { font-size: 36px; letter-spacing: 6px; }
  .playing-card { width: 44px; height: 64px; }
  .playing-card .rank { font-size: 15px; }
  .card-back { width: 32px; height: 46px; font-size: 13px; }
  h1 { font-size: 22px; }
  .home-logo { font-size: 44px; }
}
@media (max-width: 340px) {
  .playing-card { width: 38px; height: 56px; }
  .playing-card .rank { font-size: 13px; }
  .card-back { width: 28px; height: 40px; font-size: 12px; }
}

/* ── Touch tap highlight remove (mobile) ─────────────────── */
* { -webkit-tap-highlight-color: transparent; }
button, input { touch-action: manipulation; }

</style>
</head>
<body>

      <div class="lc lc2">♥</div>
      <div class="lc lc3">★</div>
      <div class="lc lc4">♦</div>
    </div>
    <div class="loading-title">Kujt i ngec Kerri</div>
    <div class="loading-bar"><div class="loading-fill" id="loading-fill"></div></div>
    <div class="loading-hint" id="loading-hint">Duke ngarkuar...</div>
  </div>
</div>

<!-- ═══════════════════════════════════ HOME ════════════════ -->
<div id="phase-home" class="phase active">
  <div class="home-wrap">
    <div class="home-logo">♠</div>
    <h1>Kujt i ngec Kerri</h1>
    <p class="home-sub">Loja shqiptare me letra · Multiplayer Online</p>

    <div class="card" id="username-card">
      <label class="section-label">Emri yt <span class="label-hint">(ruhet automatikisht)</span></label>
      <div class="username-row">
        <input type="text" id="home-name" placeholder="p.sh. Ardi" maxlength="20" autocomplete="off"/>
        <div class="username-avatar" id="home-avatar">?</div>
      </div>
    </div>

    <button class="btn btn-primary" onclick="goCreate()">
      <span class="btn-icon">＋</span> Krijo dhomë të re
    </button>

    <div class="divider">ose</div>

    <div class="card">
      <label class="section-label">Bashkohu me kod dhome</label>
      <div class="code-row">
        <input type="text" id="home-code" placeholder="p.sh. A3BX" maxlength="4"
               oninput="this.value=this.value.toUpperCase()" autocomplete="off"/>
        <button class="btn btn-join" onclick="goJoin()">Hyr →</button>
      </div>
    </div>

    <div id="home-error" class="error-msg" style="display:none"></div>
  </div>
</div>

<!-- ═══════════════════════════════════ CREATE ══════════════ -->
<div id="phase-create" class="phase">
  <div class="home-wrap">
    <button class="btn-back" onclick="showPhase('home')">← Kthehu</button>
    <h2>Krijo dhomë të re</h2>
    <div class="card">
      <label class="section-label">Lloji i Kerrit</label>
      <div class="kerri-options" id="kerri-options">
        <label class="kerri-opt selected" data-val="joker">
          <input type="radio" name="kerri" value="joker" checked hidden/>
          <span class="ko-icon">★</span>
          <span class="ko-label">Xholi</span>
        </label>
        <label class="kerri-opt" data-val="queen">
          <input type="radio" name="kerri" value="queen" hidden/>
          <span class="ko-icon">♠Q</span>
          <span class="ko-label">Mbretëresha</span>
        </label>
        <label class="kerri-opt" data-val="ace">
          <input type="radio" name="kerri" value="ace" hidden/>
          <span class="ko-icon">♥A</span>
          <span class="ko-label">Asi</span>
        </label>
      </div>
    </div>
    <button class="btn btn-primary" onclick="createRoom()">Krijo dhe prit lojtarët ▶</button>
    <div id="create-error" class="error-msg" style="display:none"></div>
  </div>
</div>

<!-- ═══════════════════════════════════ LOBBY ═══════════════ -->
<div id="phase-lobby" class="phase">
  <div class="game-wrap">
    <div class="lobby-hero">
      <div class="lobby-label">Kodi i dhomës</div>
      <div class="room-code" id="lobby-code">----</div>
      <button class="btn-copy" onclick="copyCode()" id="copy-btn">
        <span id="copy-icon">⧉</span> Kopjo
      </button>
    </div>

    <div class="card">
      <div class="section-label">Lojtarët (<span id="lobby-count">1</span>/6)</div>
      <div id="lobby-players"></div>
    </div>

    <!-- Leaderboard në lobby (nëse ka lojëra të luajtura) -->
    <div id="lobby-lb-wrap" style="display:none">
      <div class="card">
        <div class="section-label">🏆 Leaderboard</div>
        <div id="lobby-leaderboard"></div>
      </div>
    </div>

    <div id="lobby-host-area" style="display:none">
      <button class="btn btn-primary" id="start-btn" onclick="startGame()" disabled>
        Fillo lojën ▶
      </button>
      <p class="lobby-hint center">Duhen të paktën 2 lojtarë</p>
    </div>
    <div id="lobby-wait-area" style="display:none">
      <div class="msg-box warn">⏳ Duke pritur që hosti të fillojë...</div>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════ GAME ════════════════ -->
<div id="phase-game" class="phase">
  <div class="game-wrap">

    <div class="game-topbar">
      <div class="chip" id="chip-turn">—</div>
      <div class="chip" id="chip-room">—</div>
      <button class="chip chip-btn" onclick="toggleLeaderboard()" id="lb-toggle-btn">🏆</button>
    </div>

    <!-- Leaderboard panel (toggle) -->
    <div id="lb-panel" class="lb-panel" style="display:none">
      <div class="lb-title">🏆 Leaderboard — Raundet</div>
      <div id="lb-content"></div>
    </div>

    <div class="msg-box" id="game-msg">Duke pritur...</div>

    <div id="opponents-area"></div>

    <div class="hand-area">
      <div class="hand-label">Letrat e tua <span class="hand-count" id="my-hand-count"></span></div>
      <div class="cards-row" id="my-hand"></div>
    </div>

    <div class="log-area">
      <div class="log-label">Aktivitet</div>
      <div id="game-log"></div>
    </div>

    <div class="chat-area">
      <div id="chat-messages"></div>
      <div class="chat-input-row">
        <input type="text" id="chat-input" placeholder="Shkruaj mesazh..."
               onkeydown="if(event.key==='Enter')sendChat()" maxlength="200"/>
        <button class="btn-send" onclick="sendChat()">➤</button>
      </div>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════ GAME OVER ═══════════ -->
<div id="phase-gameover" class="phase">
  <div class="home-wrap">
    <div class="go-emoji" id="go-emoji">😱</div>
    <div class="go-loser" id="go-loser"></div>
    <div class="go-sub"   id="go-sub"></div>

    <div class="card" style="margin-bottom:1rem">
      <div class="section-label">Rezultatet e raunditsit</div>
      <div id="go-results"></div>
    </div>

    <div class="card" id="go-lb-card">
      <div class="section-label">🏆 Leaderboard total</div>
      <div id="go-leaderboard"></div>
    </div>

    <div id="go-host-btns" style="display:none">
      <button class="btn btn-primary" onclick="playAgain()">Raundi tjetër ▶</button>
    </div>
    <div id="go-wait-btns" style="display:none">
      <div class="msg-box warn">⏳ Duke pritur hostin të nisë raundin tjetër...</div>
    </div>
    <button class="btn btn-secondary" onclick="leaveGame()">Dil nga loja</button>
  </div>
</div>

<!-- ═══════════════════════════════════ DRAW MODAL ══════════ -->
<div id="draw-modal" class="modal-overlay" style="display:none" onclick="handleModalOutsideClick(event)">
  <div class="modal-box">
    <div class="modal-title" id="modal-title">Zgjedh një letër</div>
    <div class="modal-subtitle">Klikoni një kartë për ta marrë — s'mund ta shihni!</div>
    <div class="cards-row" id="modal-cards" style="justify-content:center;margin:1rem 0;gap:8px"></div>
    <button class="btn btn-secondary" onclick="closeDrawModal()">Anulo</button>
  </div>
</div>

<!-- ═══════════════════════════════════ RECONNECT BANNER ════ -->
<div id="reconnect-banner" style="display:none">
  <div class="reconnect-inner">
    <div class="reconnect-spinner"></div>
    <span>Duke u rilidhur me serverin...</span>
  </div>
</div>

<script>
/* ============================================================
   Kujt i ngec Kerri — Client v2
   + Reconnect, Leaderboard, Sound, Loading, Mobile UX
   ============================================================ */

// ─── Shteti global ────────────────────────────────────────────
let ws           = null;
let myId         = null;
let myName       = '';
let roomCode     = null;
let isHost       = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT  = 8;

const RED_SUITS = new Set(['♥','♦']);

// ─── Sound Engine (Web Audio API, no files needed) ───────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let soundEnabled = true;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playTone(freq, type, duration, vol = 0.18, delay = 0) {
  if (!soundEnabled) return;
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type      = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + .05);
  } catch (e) {}
}

const SFX = {
  cardDraw:   () => { playTone(440, 'sine', .08, .15); playTone(520, 'sine', .06, .10, .05); },
  myTurn:     () => { playTone(660, 'sine', .12, .20); playTone(880, 'sine', .10, .15, .08); },
  kerriGet:   () => { playTone(220, 'sawtooth', .35, .22); playTone(180, 'sawtooth', .25, .18, .15); },
  win:        () => { [523,659,784,1047].forEach((f,i) => playTone(f,'sine',.2,.18,i*.1)); },
  lose:       () => { [300,250,200].forEach((f,i) => playTone(f,'sawtooth',.25,.18,i*.12)); },
  chat:       () => { playTone(880, 'sine', .07, .08); },
  join:       () => { playTone(600, 'sine', .10, .12); playTone(750, 'sine', .08, .10, .07); },
  error:      () => { playTone(300, 'square', .15, .15); },
};

// ─── Loading Screen ───────────────────────────────────────────



// ─── Username persistence ─────────────────────────────────────
function loadSavedUsername() {
  const saved = localStorage.getItem('kerri_username');
  if (saved) {
    document.getElementById('home-name').value = saved;
    updateAvatar(saved);
  }
}

function saveUsername(name) {
  localStorage.setItem('kerri_username', name);
  updateAvatar(name);
}

function updateAvatar(name) {
  const av = document.getElementById('home-avatar');
  if (av && name) av.textContent = name.charAt(0).toUpperCase();
}

// ─── Session persistence (reconnect) ─────────────────────────
function saveSession() {
  if (myId && roomCode) {
    localStorage.setItem('kerri_session', JSON.stringify({ myId, roomCode, myName, isHost }));
  }
}

function clearSession() {
  localStorage.removeItem('kerri_session');
}

function getSavedSession() {
  try { return JSON.parse(localStorage.getItem('kerri_session')); } catch { return null; }
}

// ─── WebSocket connect/reconnect ─────────────────────────────
function connect(onOpen) {
  if (ws) { try { ws.close(); } catch {} }
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(\`\${proto}://\${location.host}\`);

  ws.onopen    = onOpen;
  ws.onmessage = e => handleMessage(JSON.parse(e.data));
  ws.onclose   = handleDisconnect;
  ws.onerror   = () => {};
}

function handleDisconnect() {
  if (reconnectAttempts >= MAX_RECONNECT) {
    hideBanner();
    showError('home-error', 'Lidhja u ndërpre. Rifresko faqen.');
    clearSession();
    return;
  }

  const sess = getSavedSession();
  if (!sess?.myId) return;

  showBanner();
  const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 15000);
  reconnectAttempts++;

  reconnectTimer = setTimeout(() => {
    connect(() => {
      sendMsg({ type: 'reconnect', playerId: sess.myId, roomCode: sess.roomCode });
    });
  }, delay);
}

function showBanner()  { document.getElementById('reconnect-banner').style.display = 'flex'; }
function hideBanner()  { document.getElementById('reconnect-banner').style.display = 'none'; }

// ─── Message handler ──────────────────────────────────────────
function handleMessage(msg) {
  switch (msg.type) {

    case 'joined':
      myId     = msg.playerId;
      isHost   = msg.isHost;
      roomCode = msg.roomCode;
      reconnectAttempts = 0;
      hideBanner();
      saveSession();
      showPhase('lobby');
      SFX.join();
      break;

    case 'reconnected':
      myId     = msg.playerId;
      isHost   = msg.isHost;
      roomCode = msg.roomCode;
      reconnectAttempts = 0;
      hideBanner();
      saveSession();
      break;

    case 'reconnect_failed':
      clearSession();
      hideBanner();
      showPhase('home');
      break;

    case 'lobby_state':
      renderLobby(msg);
      break;

    case 'game_state':
      renderGame(msg);
      break;

    case 'game_over':
      renderGameOver(msg);
      break;

    case 'chat':
      appendChat(msg);
      if (!msg.system) SFX.chat();
      break;

    case 'kicked':
      clearSession();
      showPhase('home');
      showError('home-error', 'U hoqe nga dhoma nga hosti.');
      break;

    case 'error':
      showError('home-error', msg.message);
      showError('create-error', msg.message);
      SFX.error();
      break;
  }
}

// ─── Home ─────────────────────────────────────────────────────
function goCreate() {
  const name = document.getElementById('home-name').value.trim();
  if (!name) { showError('home-error', 'Shkruaj emrin tënd!'); SFX.error(); return; }
  myName = name;
  saveUsername(name);
  hideError('home-error');
  showPhase('create');
}

function goJoin() {
  const name = document.getElementById('home-name').value.trim();
  const code = document.getElementById('home-code').value.trim().toUpperCase();
  if (!name) { showError('home-error', 'Shkruaj emrin tënd!'); SFX.error(); return; }
  if (code.length !== 4) { showError('home-error', 'Kodi duhet të jetë 4 karaktere!'); SFX.error(); return; }
  myName = name;
  saveUsername(name);
  hideError('home-error');
  connect(() => sendMsg({ type: 'join_room', name: myName, roomCode: code }));
}

// ─── Create room ──────────────────────────────────────────────
function createRoom() {
  const kerriType = document.querySelector('input[name="kerri"]:checked')?.value || 'joker';
  connect(() => sendMsg({ type: 'create_room', name: myName, kerriType }));
}

// Kerri option selector
document.addEventListener('DOMContentLoaded', () => {
  // Loading

  // Username
  loadSavedUsername();

  // Live avatar update
  const nameInput = document.getElementById('home-name');
  if (nameInput) nameInput.addEventListener('input', e => updateAvatar(e.target.value));

  // Kerri options
  document.querySelectorAll('.kerri-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.kerri-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      opt.querySelector('input').checked = true;
    });
  });

  // Try reconnect on load
  const sess = getSavedSession();
  if (sess?.myId && sess?.roomCode) {
    myId     = sess.myId;
    myName   = sess.myName;
    isHost   = sess.isHost;
    roomCode = sess.roomCode;
    setTimeout(() => {
      showBanner();
      connect(() => sendMsg({ type: 'reconnect', playerId: sess.myId, roomCode: sess.roomCode }));
    }, 2000); // after loading screen
  }
});

// ─── Lobby ────────────────────────────────────────────────────
function renderLobby(msg) {
  showPhase('lobby');
  document.getElementById('lobby-code').textContent  = msg.roomCode;
  document.getElementById('lobby-count').textContent = msg.players.length;

  const list = document.getElementById('lobby-players');
  list.innerHTML = msg.players.map(p => {
    const isMe    = p.id === myId;
    const disc    = p.disconnected;
    const kickBtn = isHost && !p.isHost && !isMe
      ? \`<button class="kick-btn" onclick="kickPlayer('\${p.id}')">Hiq</button>\` : '';
    return \`
      <div class="lobby-player-row">
        <div class="player-dot \${disc ? 'offline' : ''}"></div>
        <div class="player-name-col">
          <span>\${escHtml(p.name)}\${isMe ? ' <span style="color:var(--hint);font-size:12px">(ti)</span>' : ''}</span>
          \${disc ? '<span style="font-size:11px;color:var(--hint)"> · shkëputur</span>' : ''}
        </div>
        \${p.isHost ? '<span class="host-badge">Host</span>' : ''}
        \${kickBtn}
      </div>\`;
  }).join('');

  // Leaderboard
  if (msg.leaderboard && msg.leaderboard.length > 0) {
    document.getElementById('lobby-lb-wrap').style.display = 'block';
    document.getElementById('lobby-leaderboard').innerHTML = renderLbRows(msg.leaderboard);
  }

  const hostArea = document.getElementById('lobby-host-area');
  const waitArea = document.getElementById('lobby-wait-area');
  if (isHost) {
    hostArea.style.display = 'block'; waitArea.style.display = 'none';
    document.getElementById('start-btn').disabled = msg.players.length < 2;
  } else {
    hostArea.style.display = 'none'; waitArea.style.display = 'block';
  }
}

function startGame()  { sendMsg({ type: 'start_game' }); }
function kickPlayer(id) { sendMsg({ type: 'kick_player', targetId: id }); }

function copyCode() {
  const code = document.getElementById('lobby-code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.innerHTML = '✓ Kopjuar!';
    setTimeout(() => btn.innerHTML = '<span id="copy-icon">⧉</span> Kopjo', 2000);
  });
}

// ─── Game render ──────────────────────────────────────────────
let prevMyTurn = false;

function renderGame(state) {
  showPhase('game');

  const activePlayer = state.players.find(p => p.id === state.activePlayerId);
  const isMyTurn     = state.isMyTurn;

  // Sound: radha ime filloi
  if (isMyTurn && !prevMyTurn) SFX.myTurn();
  prevMyTurn = isMyTurn;

  const turnChip = document.getElementById('chip-turn');
  turnChip.textContent = isMyTurn ? '🎯 Radha jote!' : \`Radha e: \${activePlayer?.name || '—'}\`;
  turnChip.className   = 'chip' + (isMyTurn ? ' my-turn' : '');
  document.getElementById('chip-room').textContent = \`♠ \${state.roomCode}\`;

  renderMsg(state);
  renderOpponents(state);
  renderMyHand(state.myHand);

  const logEl = document.getElementById('game-log');
  logEl.innerHTML = (state.log || []).map((l,i) =>
    \`<div class="log-item">\${escHtml(l)}</div>\`).join('');

  // Leaderboard panel update (nëse hapur)
  if (document.getElementById('lb-panel').style.display !== 'none') {
    renderLbPanel(state.leaderboard);
  }
}

function renderMsg(state) {
  const msg      = document.getElementById('game-msg');
  const drawFrom = state.opponents?.find(o => o.id === state.drawFromId);

  if (!state.myHand || state.myHand.length === 0) {
    msg.className   = 'msg-box success';
    msg.textContent = '✅ Bravo! Ke dalë — prit të mbarojnë të tjerët.';
  } else if (state.isMyTurn && drawFrom) {
    msg.className   = 'msg-box';
    msg.textContent = \`🎯 Radha jote! Kliko mbi kartolat e "\${drawFrom.name}" për të zgjedhur.\`;
  } else if (state.isMyTurn) {
    msg.className   = 'msg-box success';
    msg.textContent = '✅ Prit radhën tjetër.';
  } else {
    const active    = state.players?.find(p => p.id === state.activePlayerId);
    msg.className   = 'msg-box warn';
    msg.textContent = \`⏳ \${active?.name || '—'} po luan...\`;
  }
}

function renderOpponents(state) {
  const area = document.getElementById('opponents-area');
  area.innerHTML = '';

  state.opponents.forEach(opp => {
    const isDrawable = state.isMyTurn && opp.id === state.drawFromId && opp.cardCount > 0;
    const row        = document.createElement('div');
    row.className    = 'opp-row';

    const cardsHtml = Array.from({ length: opp.cardCount }, (_, i) => {
      const cls = ['card-back'];
      if (opp.disconnected)   cls.push('disc');
      else if (isDrawable)    cls.push('drawable');
      else                    cls.push('not-my-turn');
      const click = isDrawable
        ? \`onclick="openDrawModal('\${opp.id}','\${escAttr(opp.name)}',\${opp.cardCount})"\` : '';
      return \`<div class="\${cls.join(' ')}" \${click}>♠</div>\`;
    }).join('');

    const outBadge  = opp.isOut ? '<span class="badge badge-out">✓ Doli</span>' : '';
    const discTag   = opp.disconnected ? '<span class="disc-tag">shkëputur</span>' : '';

    row.innerHTML = \`
      <div class="opp-info">
        <div class="opp-name">\${escHtml(opp.name)} \${discTag} \${outBadge}</div>
        <div class="opp-meta">\${opp.cardCount} letra</div>
      </div>
      <div class="opp-cards">\${cardsHtml}</div>\`;
    area.appendChild(row);
  });
}

function renderMyHand(hand) {
  const container = document.getElementById('my-hand');
  const countEl   = document.getElementById('my-hand-count');

  if (!hand || hand.length === 0) {
    container.innerHTML = '<span style="font-size:14px;color:#999">Ke dalë ✓</span>';
    if (countEl) countEl.textContent = '';
    return;
  }
  if (countEl) countEl.textContent = hand.length;

  container.innerHTML = hand.map(card => {
    let cls = 'playing-card';
    if (card.isKerri)                   cls += ' kerri-card';
    else if (RED_SUITS.has(card.suit))  cls += ' red-card';
    else                                cls += ' black-card';
    return \`<div class="\${cls}"><div class="rank">\${card.rank}</div><div class="suit">\${card.suit}</div></div>\`;
  }).join('');
}

// ─── Draw modal ───────────────────────────────────────────────
function openDrawModal(fromPlayerId, fromName, cardCount) {
  document.getElementById('modal-title').textContent = \`Dora e \${fromName}\`;
  const container = document.getElementById('modal-cards');
  container.innerHTML = Array.from({ length: cardCount }, (_, i) => \`
    <div class="playing-card drawable-card black-card" onclick="confirmDraw('\${fromPlayerId}',\${i})">
      <div class="rank">♠</div>
      <div class="suit" style="font-size:11px">\${i+1}</div>
    </div>\`).join('');
  document.getElementById('draw-modal').style.display = 'flex';
}

function confirmDraw(fromPlayerId, cardIndex) {
  sendMsg({ type: 'draw_card', fromPlayerId, cardIndex });
  SFX.cardDraw();
  closeDrawModal();
}

function closeDrawModal() {
  document.getElementById('draw-modal').style.display = 'none';
}

function handleModalOutsideClick(e) {
  if (e.target === document.getElementById('draw-modal')) closeDrawModal();
}

// ─── Leaderboard ──────────────────────────────────────────────
function renderLbRows(lb) {
  if (!lb || lb.length === 0) return '<div style="font-size:13px;color:var(--hint)">Ende nuk ka lojëra.</div>';
  const medals = ['gold','silver','bronze'];
  return lb.map((p, i) => \`
    <div class="lb-row">
      <div class="lb-rank \${medals[i] || ''}">\${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
      <div class="lb-name">\${escHtml(p.name)}</div>
      <div class="lb-stats">
        <span class="lb-win">\${p.wins}W</span>
        <span class="lb-loss">\${p.losses}L</span>
      </div>
    </div>\`).join('');
}

function toggleLeaderboard() {
  const panel = document.getElementById('lb-panel');
  const open  = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  document.getElementById('lb-toggle-btn').textContent = open ? '✕' : '🏆';
}

function renderLbPanel(lb) {
  document.getElementById('lb-content').innerHTML = renderLbRows(lb);
}

// ─── Game over ────────────────────────────────────────────────
function renderGameOver(msg) {
  showPhase('gameover');
  const isMe = msg.loserId === myId;
  document.getElementById('go-emoji').textContent = isMe ? '😱' : '🎉';
  document.getElementById('go-loser').textContent = msg.loserName;
  document.getElementById('go-sub').textContent   = isMe ? 'Ty të ngeci Kerri!' : 'Atij/Asaj i ngeci Kerri!';

  // Sound
  if (isMe) { SFX.lose(); SFX.kerriGet(); }
  else       SFX.win();

  document.getElementById('go-results').innerHTML = msg.results.map(r => {
    let badgeClass, badgeText;
    if (r.hasKerri)          { badgeClass='badge-kerri'; badgeText='★ Kerri'; }
    else if (r.cardCount===0){ badgeClass='badge-out';   badgeText='✓ Doli'; }
    else                     { badgeClass='badge-safe';  badgeText=\`\${r.cardCount} letra\`; }
    return \`<div class="result-row"><span>\${escHtml(r.name)}</span><span class="badge \${badgeClass}">\${badgeText}</span></div>\`;
  }).join('');

  // Leaderboard
  if (msg.leaderboard && msg.leaderboard.length > 0) {
    document.getElementById('go-lb-card').style.display = 'block';
    document.getElementById('go-leaderboard').innerHTML = renderLbRows(msg.leaderboard);
  } else {
    document.getElementById('go-lb-card').style.display = 'none';
  }

  if (isHost) {
    document.getElementById('go-host-btns').style.display = 'block';
    document.getElementById('go-wait-btns').style.display = 'none';
  } else {
    document.getElementById('go-host-btns').style.display = 'none';
    document.getElementById('go-wait-btns').style.display = 'block';
  }
}

function playAgain() { sendMsg({ type: 'start_game' }); }

function leaveGame() {
  clearSession();
  if (ws) { try { ws.close(); } catch {} }
  location.reload();
}

// ─── Chat ─────────────────────────────────────────────────────
function sendChat() {
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;
  sendMsg({ type: 'chat', text });
  input.value = '';
}

function appendChat(msg) {
  const area = document.getElementById('chat-messages');
  if (!area) return;
  const div  = document.createElement('div');
  if (msg.system) {
    div.className   = 'chat-msg system';
    div.textContent = msg.text;
  } else {
    div.className = 'chat-msg';
    div.innerHTML = \`<span class="chat-sender">\${escHtml(msg.sender)}:</span> \${escHtml(msg.text)}\`;
  }
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

// ─── Utilities ────────────────────────────────────────────────
function sendMsg(data) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function showPhase(id) {
  document.querySelectorAll('.phase').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('phase-' + id);
  if (el) el.classList.add('active');
  // Scroll top on phase change (mobile)
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent    = msg;
  el.style.display  = 'block';
}

function hideError(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(str) {
  return String(str).replace(/'/g, '&#39;').replace(/"/g,'&quot;');
}

</script>
</body>
</html>
`;

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(HTML);
});
app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(HTML);
});

wss.on('connection', ws => {
  const newPlayerId = uuidv4();
  clients.set(ws, { playerId: newPlayerId });

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const clientInfo = clients.get(ws);
    const playerId   = clientInfo.playerId;

    switch (msg.type) {

      // ── Reconnect ──────────────────────────────────────────
      case 'reconnect': {
        const pid  = msg.playerId;
        const code = msg.roomCode;
        if (pid && tryReconnect(ws, pid, code)) break;
        // Nëse nuk ka session, trego ekranin kryesor
        send(ws, { type: 'reconnect_failed' });
        break;
      }

      // ── Krijo dhomë ────────────────────────────────────────
      case 'create_room': {
        const code = makeRoomCode();
        const room = {
          code, phase: 'lobby',
          kerriType:   msg.kerriType || 'joker',
          players: [], hands: {}, activeIdx: 0, log: [],
          leaderboard: {}, roundNumber: 0,
        };
        rooms[code] = room;
        const player = { id: playerId, name: msg.name || 'Lojtar 1', ws, isHost: true };
        room.players.push(player);
        sessions[playerId] = { name: player.name, roomCode: code, isHost: true };
        clientInfo.roomCode = code;
        send(ws, { type: 'joined', playerId, roomCode: code, isHost: true });
        sendLobbyState(room);
        break;
      }

      // ── Bashkohu ───────────────────────────────────────────
      case 'join_room': {
        const room = rooms[msg.roomCode?.toUpperCase()];
        if (!room)                    { send(ws, { type: 'error', message: 'Dhoma nuk u gjet!' }); break; }
        if (room.phase !== 'lobby')   { send(ws, { type: 'error', message: 'Loja ka filluar tashmë!' }); break; }
        if (room.players.length >= 6) { send(ws, { type: 'error', message: 'Dhoma është plot (max 6)!' }); break; }

        // Kontrollo nëse emri është i zënë
        const nameTaken = room.players.some(p => p.name.toLowerCase() === (msg.name||'').toLowerCase());
        if (nameTaken) { send(ws, { type: 'error', message: 'Ky emër është i zënë në këtë dhomë!' }); break; }

        const player = { id: playerId, name: msg.name || `Lojtar ${room.players.length + 1}`, ws, isHost: false };
        room.players.push(player);
        sessions[playerId] = { name: player.name, roomCode: room.code, isHost: false };
        clientInfo.roomCode = room.code;
        send(ws, { type: 'joined', playerId, roomCode: room.code, isHost: false });
        room.log.push(`${player.name} u bashkua.`);
        sendLobbyState(room);
        broadcast(room, { type: 'chat', text: `${player.name} u bashkua!`, system: true }, ws);
        break;
      }

      // ── Fillo lojën ────────────────────────────────────────
      case 'start_game': {
        const room = rooms[clientInfo.roomCode];
        if (!room) break;
        const host = room.players.find(p => p.id === playerId);
        if (!host?.isHost)            { send(ws, { type: 'error', message: 'Vetëm hosti mund ta fillojë.' }); break; }
        if (room.players.length < 2)  { send(ws, { type: 'error', message: 'Duhen të paktën 2 lojtarë!' }); break; }
        // Nëse po rinis nga gameover, ri-shto të gjithë lojtarët e leaderboard
        if (room.phase === 'gameover') room.phase = 'lobby';
        startGame(room);
        break;
      }

      // ── Merr letër ─────────────────────────────────────────
      case 'draw_card': {
        const room = rooms[clientInfo.roomCode];
        if (!room || room.phase !== 'playing') break;
        const activePlayer = room.players[room.activeIdx];
        if (activePlayer.id !== playerId) { send(ws, { type: 'error', message: 'Nuk është radha jote!' }); break; }

        const fromPlayer = room.players.find(p => p.id === msg.fromPlayerId);
        if (!fromPlayer) break;
        const fromHand = room.hands[fromPlayer.id];
        if (!fromHand || fromHand.length === 0) break;

        const cardIdx = msg.cardIndex;
        if (cardIdx === undefined || cardIdx < 0 || cardIdx >= fromHand.length) break;

        const card = fromHand.splice(cardIdx, 1)[0];
        room.hands[playerId].push(card);
        room.log.unshift(`${activePlayer.name} mori "${card.isKerri ? '★ KERRI' : card.rank + card.suit}" nga ${fromPlayer.name}`);
        autoRemovePairs(room.hands[playerId]);

        if (checkGameOver(room)) break;
        advanceTurn(room);
        break;
      }

      // ── Chat ───────────────────────────────────────────────
      case 'chat': {
        const room = rooms[clientInfo.roomCode];
        if (!room) break;
        const sender = room.players.find(p => p.id === playerId);
        const text   = String(msg.text || '').slice(0, 200);
        if (!text.trim()) break;
        broadcast(room, { type: 'chat', text, sender: sender?.name || '?' });
        break;
      }

      // ── Kick (vetëm host) ──────────────────────────────────
      case 'kick_player': {
        const room = rooms[clientInfo.roomCode];
        if (!room || room.phase !== 'lobby') break;
        const host = room.players.find(p => p.id === playerId);
        if (!host?.isHost) break;
        const target = room.players.find(p => p.id === msg.targetId);
        if (!target || target.isHost) break;
        send(target.ws, { type: 'kicked' });
        room.players = room.players.filter(p => p.id !== msg.targetId);
        delete sessions[msg.targetId];
        sendLobbyState(room);
        broadcast(room, { type: 'chat', text: `${target.name} u hoq nga dhoma.`, system: true });
        break;
      }
    }
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    if (!info) return;
    const pid  = info.playerId;
    const sess = sessions[pid];
    if (!sess?.roomCode) return;
    const room = rooms[sess.roomCode];
    if (!room) return;

    const player = room.players.find(p => p.id === pid);
    if (!player) return;

    if (room.phase === 'lobby') {
      // Në lobby → hiq lojtarin
      room.players = room.players.filter(p => p.id !== pid);
      delete sessions[pid];
      if (room.players.length === 0) { delete rooms[sess.roomCode]; return; }
      if (!room.players.some(p => p.isHost)) room.players[0].isHost = true;
      sendLobbyState(room);
      broadcast(room, { type: 'chat', text: `${player.name} u largua.`, system: true });
    } else {
      // Gjatë lojës → shëno si disconnected, mos e hiq
      player.disconnected = true;
      player.ws = null;
      room.log.unshift(`${player.name} u shkëput (60s për rilidhje).`);
      broadcast(room, { type: 'chat', text: `${player.name} u shkëput — duke pritur rilidhjen...`, system: true });

      // Nëse ishte radha e tij, kalo
      const activePlayer = room.players[room.activeIdx];
      if (activePlayer?.id === pid && room.phase === 'playing') advanceTurn(room);
      else if (room.phase === 'playing') sendGameState(room);

      // Timeout 60s — nëse nuk rilidhët, largo
      setTimeout(() => {
        if (!player.disconnected) return; // u rilidhë
        room.players = room.players.filter(p => p.id !== pid);
        delete sessions[pid];
        if (room.players.length === 0) { delete rooms[sess.roomCode]; return; }
        if (!room.players.some(p => p.isHost)) room.players[0].isHost = true;
        broadcast(room, { type: 'chat', text: `${player.name} u largua nga loja.`, system: true });
        if (room.phase === 'playing') {
          if (!checkGameOver(room)) sendGameState(room);
        } else sendLobbyState(room);
      }, 60000);
    }
  });
});

// ─── Pastro dhoma boshe çdo 30 min ───────────────────────────
setInterval(() => {
  Object.keys(rooms).forEach(code => {
    if (rooms[code].players.length === 0) delete rooms[code];
  });
}, 30 * 60 * 1000);

server.listen(PORT, () => console.log(`✅ Kerri server: http://localhost:${PORT}`));
