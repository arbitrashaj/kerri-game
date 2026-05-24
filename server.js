// ============================================================
//  Kujt i ngec Kerri — Server v3 (Socket.io)
// ============================================================
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});
const PORT = process.env.PORT || 3000;

// HTML is stored in a separate variable built safely
function buildHTML() {
  return [
    '<!DOCTYPE html>',
    '<html lang="sq">',
    '<head>',
    '  <meta charset="UTF-8"/>',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>',
    '  <meta name="theme-color" content="#1a1a1a"/>',
    '  <title>Kujt i ngec Kerri \u2660</title>',
    '  <script src="/socket.io/socket.io.js"><\/script>',
    '  <style>',
    '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}',
    ':root{',
    '  --bg:#f0ede8;--surface:#fff;--border:rgba(0,0,0,.10);--border-mid:rgba(0,0,0,.18);',
    '  --text:#1a1a1a;--muted:#666;--hint:#aaa;',
    '  --r-md:10px;--r-lg:16px;--r-xl:22px;',
    '  --red:#c0392b;--red-bg:#fef2f2;--blue:#1a56db;--blue-bg:#eff6ff;',
    '  --green:#166534;--green-bg:#f0fdf4;--amber:#92400e;--amber-bg:#fffbeb;',
    '  --kerri:#be123c;--kerri-bg:#fff1f2;--kerri-br:#fb7185;',
    '  --purple:#6d28d9;--purple-bg:#f5f3ff;--gold:#b45309;--gold-bg:#fef3c7;',
    '  --shadow-sm:0 1px 3px rgba(0,0,0,.08);--shadow-md:0 4px 12px rgba(0,0,0,.10);',
    '}',
    'body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden}',
    '.phase{display:none}.phase.active{display:block;animation:fadeIn .2s ease}',
    '@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '.home-wrap{max-width:440px;margin:0 auto;padding:2rem 1rem 4rem}',
    '.game-wrap{max-width:680px;margin:0 auto;padding:.75rem .75rem 2rem}',
    '.home-logo{font-size:56px;text-align:center;margin-bottom:.5rem}',
    'h1{font-size:26px;font-weight:700;text-align:center;letter-spacing:-.5px}',
    'h2{font-size:20px;font-weight:600;margin-bottom:1rem}',
    '.home-sub{font-size:13px;color:var(--muted);text-align:center;margin:4px 0 1.5rem}',
    '.card{background:var(--surface);border:.5px solid var(--border);border-radius:var(--r-lg);padding:1.1rem 1.15rem;margin-bottom:.85rem;box-shadow:var(--shadow-sm)}',
    '.section-label{display:block;font-size:12px;color:var(--muted);margin-bottom:8px;font-weight:500;text-transform:uppercase;letter-spacing:.4px}',
    '.username-row{display:flex;gap:8px;align-items:center}',
    '.username-avatar{width:40px;height:40px;flex-shrink:0;background:#1a1a1a;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600}',
    'input[type=text],select{width:100%;padding:10px 13px;border:.5px solid var(--border-mid);border-radius:var(--r-md);font-size:15px;background:var(--bg);color:var(--text);font-family:inherit;outline:none;-webkit-appearance:none}',
    'input:focus,select:focus{border-color:#94a3b8;box-shadow:0 0 0 3px rgba(99,102,241,.1)}',
    '.code-row{display:flex;gap:8px}',
    '.code-row input{text-transform:uppercase;letter-spacing:4px;font-size:18px;font-weight:700;text-align:center}',
    '.kerri-options{display:flex;gap:8px}',
    '.kerri-opt{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 8px;border:1.5px solid var(--border-mid);border-radius:var(--r-md);cursor:pointer;transition:border-color .15s,background .15s}',
    '.kerri-opt:hover{background:var(--bg)}',
    '.kerri-opt.selected{border-color:#1a1a1a;background:#f8f8f8}',
    '.ko-icon{font-size:20px;font-weight:700}',
    '.ko-label{font-size:12px;color:var(--muted)}',
    '.btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:12px 16px;border-radius:var(--r-md);border:.5px solid var(--border-mid);background:var(--surface);font-size:15px;cursor:pointer;color:var(--text);font-family:inherit;text-align:center;transition:background .12s,transform .08s}',
    '.btn:hover{background:var(--bg)}.btn:active{transform:scale(.98)}',
    '.btn-primary{font-weight:600;font-size:16px;padding:14px;border-radius:var(--r-lg);background:#1a1a1a;color:#fff;border-color:#1a1a1a;margin-bottom:4px;box-shadow:var(--shadow-sm)}',
    '.btn-primary:hover{background:#2d2d2d}',
    '.btn-primary:disabled{background:#999;border-color:#999;cursor:not-allowed;transform:none}',
    '.btn-secondary{margin-top:8px;color:var(--muted)}',
    '.btn-back{background:none;border:none;font-size:14px;color:var(--muted);cursor:pointer;margin-bottom:1rem;padding:0;font-family:inherit;display:flex;align-items:center;gap:4px}',
    '.btn-back:hover{color:var(--text)}',
    '.btn-join{padding:10px 20px;border-radius:var(--r-md);border:.5px solid var(--border-mid);background:var(--surface);font-size:15px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit}',
    '.btn-join:hover{background:var(--bg)}',
    '.divider{text-align:center;font-size:13px;color:var(--hint);margin:1rem 0;position:relative}',
    ".divider::before,.divider::after{content:'';position:absolute;top:50%;width:38%;height:.5px;background:var(--border-mid)}",
    '.divider::before{left:0}.divider::after{right:0}',
    '.error-msg{background:var(--red-bg);color:var(--red);border-radius:var(--r-md);padding:10px 14px;font-size:14px;margin-top:8px;border:.5px solid #fecaca}',
    '.lobby-hero{text-align:center;margin-bottom:1rem;padding:1.5rem 1rem;background:var(--surface);border-radius:var(--r-lg);border:.5px solid var(--border);box-shadow:var(--shadow-sm)}',
    '.lobby-label{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}',
    '.room-code{font-size:46px;font-weight:800;letter-spacing:8px;color:var(--text);line-height:1;margin-bottom:12px}',
    '.lobby-hint{font-size:12px;color:var(--hint);margin-top:4px}',
    '.lobby-hint.center{text-align:center}',
    '.btn-copy{display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:var(--r-md);border:.5px solid var(--border-mid);background:var(--bg);font-size:13px;cursor:pointer;font-family:inherit}',
    '.btn-copy:hover{background:#e5e3de}',
    '.lobby-player-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:.5px solid var(--border);font-size:14px}',
    '.lobby-player-row:last-child{border:none}',
    '.player-dot{width:9px;height:9px;border-radius:50%;background:#22c55e;flex-shrink:0}',
    '.player-dot.offline{background:#d1d5db}',
    '.player-name-col{flex:1}',
    '.host-badge{font-size:11px;background:var(--gold-bg);color:var(--gold);border-radius:99px;padding:2px 8px}',
    '.kick-btn{background:none;border:.5px solid var(--border-mid);border-radius:6px;padding:3px 8px;font-size:12px;color:var(--muted);cursor:pointer}',
    '.kick-btn:hover{background:var(--red-bg);color:var(--red);border-color:#fecaca}',
    '.lb-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:.5px solid var(--border);font-size:13px}',
    '.lb-row:last-child{border:none}',
    '.lb-rank{width:22px;text-align:center;font-weight:700;color:var(--muted)}',
    '.lb-rank.gold{color:#d97706}.lb-rank.silver{color:#6b7280}.lb-rank.bronze{color:#92400e}',
    '.lb-name{flex:1;font-weight:500}',
    '.lb-stats{display:flex;gap:6px}',
    '.lb-win{font-size:12px;background:var(--green-bg);color:var(--green);border-radius:99px;padding:2px 8px;font-weight:500}',
    '.lb-loss{font-size:12px;background:var(--red-bg);color:var(--red);border-radius:99px;padding:2px 8px;font-weight:500}',
    '.lb-panel{background:var(--surface);border:.5px solid var(--border);border-radius:var(--r-lg);padding:1rem;margin-bottom:.85rem;box-shadow:var(--shadow-sm)}',
    '.lb-title{font-size:13px;font-weight:600;margin-bottom:8px}',
    '.game-topbar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:.75rem;align-items:center}',
    '.chip{background:var(--surface);border:.5px solid var(--border);border-radius:99px;padding:5px 13px;font-size:13px;color:var(--muted);box-shadow:var(--shadow-sm)}',
    '.chip span{font-weight:600;color:var(--text)}',
    '.chip.my-turn{background:#1a1a1a;color:#fff;border-color:#1a1a1a;font-weight:600}',
    '.chip-btn{cursor:pointer;border:.5px solid var(--border-mid);padding:5px 11px}',
    '.chip-btn:hover{background:var(--bg)}',
    '.msg-box{border-radius:var(--r-md);padding:10px 14px;font-size:14px;margin-bottom:.85rem;background:var(--blue-bg);color:var(--blue);border:.5px solid #bfdbfe}',
    '.msg-box.warn{background:var(--amber-bg);color:var(--amber);border-color:#fde68a}',
    '.msg-box.success{background:var(--green-bg);color:var(--green);border-color:#bbf7d0}',
    '#opponents-area{background:var(--surface);border:.5px solid var(--border);border-radius:var(--r-lg);padding:.9rem;margin-bottom:.85rem;box-shadow:var(--shadow-sm)}',
    '.opp-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:.5px solid var(--border)}',
    '.opp-row:last-child{border:none}',
    '.opp-info{min-width:90px}',
    '.opp-name{font-size:14px;font-weight:600;display:flex;align-items:center;gap:5px;flex-wrap:wrap}',
    '.opp-name .disc-tag{font-size:11px;background:#f3f4f6;color:#9ca3af;border-radius:99px;padding:1px 7px}',
    '.opp-meta{font-size:12px;color:var(--hint);margin-top:2px}',
    '.opp-cards{display:flex;flex-wrap:wrap;gap:4px;flex:1}',
    '.card-back{display:inline-flex;align-items:center;justify-content:center;width:38px;height:54px;border-radius:7px;border:.5px solid var(--border-mid);background:linear-gradient(135deg,#ddd6fe 0%,#c4b5fd 100%);font-size:15px;font-weight:800;color:#6d28d9;transition:transform .12s,box-shadow .12s;user-select:none}',
    '.card-back.drawable{cursor:pointer;border-color:#7c3aed;animation:pulse-glow .9s ease-in-out infinite alternate;box-shadow:0 0 0 2px rgba(124,58,237,.2)}',
    '.card-back.drawable:hover{transform:translateY(-7px) scale(1.05);box-shadow:0 6px 16px rgba(124,58,237,.3)}',
    '@keyframes pulse-glow{from{border-color:#7c3aed;box-shadow:0 0 0 2px rgba(124,58,237,.15)}to{border-color:#a78bfa;box-shadow:0 0 0 4px rgba(124,58,237,.05)}}',
    '.card-back.not-my-turn{opacity:.45}',
    '.card-back.disc{opacity:.25;pointer-events:none}',
    '.hand-area{background:var(--surface);border:.5px solid var(--border);border-radius:var(--r-lg);padding:.9rem;margin-bottom:.85rem;min-height:108px;box-shadow:var(--shadow-sm)}',
    '.hand-label{font-size:12px;color:var(--muted);margin-bottom:8px;display:flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:.4px;font-weight:500}',
    '.hand-count{font-weight:700;color:var(--text);background:var(--bg);border-radius:99px;padding:1px 8px;font-size:12px}',
    '.cards-row{display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end}',
    '.playing-card{display:flex;flex-direction:column;align-items:center;justify-content:center;width:52px;height:74px;border-radius:8px;border:.5px solid var(--border-mid);background:var(--surface);user-select:none;box-shadow:var(--shadow-sm)}',
    '.playing-card .rank{font-size:17px;font-weight:700;line-height:1}',
    '.playing-card .suit{font-size:13px;line-height:1;margin-top:3px}',
    '.playing-card.red-card .rank,.playing-card.red-card .suit{color:var(--red)}',
    '.playing-card.black-card .rank,.playing-card.black-card .suit{color:#111}',
    '.playing-card.kerri-card{border-color:var(--kerri-br);background:var(--kerri-bg);animation:kerri-pulse 1.5s ease-in-out infinite alternate}',
    '.playing-card.kerri-card .rank,.playing-card.kerri-card .suit{color:var(--kerri)}',
    '@keyframes kerri-pulse{from{box-shadow:0 0 0 2px rgba(244,63,94,.15)}to{box-shadow:0 0 0 5px rgba(244,63,94,.05)}}',
    '.drawable-card{cursor:pointer;transition:transform .13s}',
    '.drawable-card:hover{transform:translateY(-8px);box-shadow:var(--shadow-md)}',
    '.log-area{background:var(--surface);border:.5px solid var(--border);border-radius:var(--r-lg);padding:.9rem;margin-bottom:.85rem;box-shadow:var(--shadow-sm)}',
    '.log-label{font-size:12px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.4px;font-weight:500}',
    '.log-item{font-size:13px;color:var(--muted);padding:3px 0;border-bottom:.5px solid var(--border)}',
    '.log-item:first-child{color:var(--text);font-weight:500}',
    '.log-item:last-child{border:none}',
    '.chat-area{background:var(--surface);border:.5px solid var(--border);border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--shadow-sm)}',
    '#chat-messages{max-height:130px;overflow-y:auto;padding:.7rem .9rem;display:flex;flex-direction:column;gap:3px}',
    '.chat-msg{font-size:13px;color:var(--text);line-height:1.4}',
    '.chat-msg .chat-sender{font-weight:600;color:var(--purple)}',
    '.chat-msg.system{color:var(--hint);font-style:italic}',
    '.chat-input-row{display:flex;border-top:.5px solid var(--border)}',
    '.chat-input-row input{flex:1;border:none;border-radius:0;background:var(--surface);padding:10px 13px;font-size:14px}',
    '.btn-send{padding:10px 15px;background:none;border:none;border-left:.5px solid var(--border);cursor:pointer;font-size:16px;color:var(--purple)}',
    '.btn-send:hover{background:var(--purple-bg)}',
    '.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center;z-index:200;padding:.5rem}',
    '@media(min-width:480px){.modal-overlay{align-items:center}}',
    '.modal-box{background:var(--surface);border-radius:var(--r-xl) var(--r-xl) 0 0;padding:1.5rem 1.25rem 2rem;width:100%;max-width:520px;animation:slideUp .2s ease}',
    '@media(min-width:480px){.modal-box{border-radius:var(--r-xl);padding:1.5rem}}',
    '@keyframes slideUp{from{transform:translateY(40px);opacity:.6}to{transform:none;opacity:1}}',
    '.modal-title{font-size:17px;font-weight:600;margin-bottom:4px}',
    '.modal-subtitle{font-size:13px;color:var(--muted)}',
    '.go-emoji{font-size:64px;text-align:center;margin-bottom:.5rem}',
    '.go-loser{font-size:30px;font-weight:700;color:var(--red);text-align:center;margin-bottom:4px}',
    '.go-sub{font-size:15px;color:var(--muted);text-align:center;margin-bottom:1.5rem}',
    '.result-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:14px;border-bottom:.5px solid var(--border)}',
    '.result-row:last-child{border:none}',
    '.badge{font-size:12px;font-weight:500;padding:3px 10px;border-radius:99px}',
    '.badge-kerri{background:var(--red-bg);color:var(--red)}',
    '.badge-out{background:var(--green-bg);color:var(--green)}',
    '.badge-safe{background:var(--blue-bg);color:var(--blue)}',
    '#reconnect-banner{position:fixed;top:0;left:0;right:0;z-index:500;background:#1a1a1a;color:#fff;padding:10px 16px;display:flex;align-items:center;justify-content:center;font-size:14px;gap:10px;box-shadow:var(--shadow-md)}',
    '.reconnect-inner{display:flex;align-items:center;gap:10px}',
    '.reconnect-spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:white;border-radius:50%;animation:spin .8s linear infinite}',
    '@keyframes spin{to{transform:rotate(360deg)}}',
    '@media(max-width:400px){',
    '  .room-code{font-size:36px;letter-spacing:6px}',
    '  .playing-card{width:44px;height:64px}',
    '  .playing-card .rank{font-size:15px}',
    '  .card-back{width:32px;height:46px;font-size:13px}',
    '}',
    '*{-webkit-tap-highlight-color:transparent}',
    'button,input{touch-action:manipulation}',
    '  </style>',
    '</head>',
    '<body>',
    '',
    '<div id="phase-home" class="phase active">',
    '  <div class="home-wrap">',
    '    <div class="home-logo">\u2660</div>',
    '    <h1>Kujt i ngec Kerri</h1>',
    '    <p class="home-sub">Loja shqiptare me letra \u00b7 Multiplayer Online</p>',
    '    <div class="card">',
    '      <label class="section-label">Emri yt</label>',
    '      <div class="username-row">',
    '        <input type="text" id="home-name" placeholder="p.sh. Ardi" maxlength="20" autocomplete="off"/>',
    '        <div class="username-avatar" id="home-avatar">?</div>',
    '      </div>',
    '    </div>',
    '    <button class="btn btn-primary" onclick="goCreate()">\uff0b Krijo dhom\u00eb t\u00eb re</button>',
    '    <div class="divider">ose</div>',
    '    <div class="card">',
    '      <label class="section-label">Bashkohu me kod</label>',
    '      <div class="code-row">',
    '        <input type="text" id="home-code" placeholder="p.sh. A3BX" maxlength="4" oninput="this.value=this.value.toUpperCase()" autocomplete="off"/>',
    '        <button class="btn-join" onclick="goJoin()">Hyr \u2192</button>',
    '      </div>',
    '    </div>',
    '    <div id="home-error" class="error-msg" style="display:none"></div>',
    '  </div>',
    '</div>',
    '',
    '<div id="phase-create" class="phase">',
    '  <div class="home-wrap">',
    '    <button class="btn-back" onclick="showPhase(\'home\')">\u2190 Kthehu</button>',
    '    <h2>Krijo dhom\u00eb t\u00eb re</h2>',
    '    <div class="card">',
    '      <label class="section-label">Lloji i Kerrit</label>',
    '      <div class="kerri-options">',
    '        <label class="kerri-opt selected" data-val="joker">',
    '          <input type="radio" name="kerri" value="joker" checked hidden/>',
    '          <span class="ko-icon">\u2605</span><span class="ko-label">Xholi</span>',
    '        </label>',
    '        <label class="kerri-opt" data-val="queen">',
    '          <input type="radio" name="kerri" value="queen" hidden/>',
    '          <span class="ko-icon">\u2660Q</span><span class="ko-label">Mbret\u00ebresha</span>',
    '        </label>',
    '        <label class="kerri-opt" data-val="ace">',
    '          <input type="radio" name="kerri" value="ace" hidden/>',
    '          <span class="ko-icon">\u2665A</span><span class="ko-label">Asi</span>',
    '        </label>',
    '      </div>',
    '    </div>',
    '    <button class="btn btn-primary" onclick="createRoom()">Krijo dhe prit lojtar\u00ebt \u25b6</button>',
    '    <div id="create-error" class="error-msg" style="display:none"></div>',
    '  </div>',
    '</div>',
    '',
    '<div id="phase-lobby" class="phase">',
    '  <div class="game-wrap">',
    '    <div class="lobby-hero">',
    '      <div class="lobby-label">Kodi i dhom\u00ebs</div>',
    '      <div class="room-code" id="lobby-code">----</div>',
    '      <button class="btn-copy" onclick="copyCode()" id="copy-btn">\u29c9 Kopjo</button>',
    '    </div>',
    '    <div class="card">',
    '      <div class="section-label">Lojtar\u00ebt (<span id="lobby-count">1</span>/6)</div>',
    '      <div id="lobby-players"></div>',
    '    </div>',
    '    <div id="lobby-lb-wrap" style="display:none">',
    '      <div class="card">',
    '        <div class="section-label">\U0001f3c6 Leaderboard</div>',
    '        <div id="lobby-leaderboard"></div>',
    '      </div>',
    '    </div>',
    '    <div id="lobby-host-area" style="display:none">',
    '      <button class="btn btn-primary" id="start-btn" onclick="startGame()" disabled>Fillo loj\u00ebn \u25b6</button>',
    '      <p class="lobby-hint center">Duhen t\u00eb pakt\u00ebn 2 lojtar\u00eb</p>',
    '    </div>',
    '    <div id="lobby-wait-area" style="display:none">',
    '      <div class="msg-box warn">\u23f3 Duke pritur hostin...</div>',
    '    </div>',
    '  </div>',
    '</div>',
    '',
    '<div id="phase-game" class="phase">',
    '  <div class="game-wrap">',
    '    <div class="game-topbar">',
    '      <div class="chip" id="chip-turn">\u2014</div>',
    '      <div class="chip" id="chip-room">\u2014</div>',
    '      <button class="chip chip-btn" onclick="toggleLeaderboard()" id="lb-toggle-btn">\U0001f3c6</button>',
    '    </div>',
    '    <div id="lb-panel" class="lb-panel" style="display:none">',
    '      <div class="lb-title">\U0001f3c6 Leaderboard</div>',
    '      <div id="lb-content"></div>',
    '    </div>',
    '    <div class="msg-box" id="game-msg">Duke pritur...</div>',
    '    <div id="opponents-area"></div>',
    '    <div class="hand-area">',
    '      <div class="hand-label">Letrat e tua <span class="hand-count" id="my-hand-count"></span></div>',
    '      <div class="cards-row" id="my-hand"></div>',
    '    </div>',
    '    <div class="log-area">',
    '      <div class="log-label">Aktivitet</div>',
    '      <div id="game-log"></div>',
    '    </div>',
    '    <div class="chat-area">',
    '      <div id="chat-messages"></div>',
    '      <div class="chat-input-row">',
    '        <input type="text" id="chat-input" placeholder="Shkruaj mesazh..." onkeydown="if(event.key===\'Enter\')sendChat()" maxlength="200"/>',
    '        <button class="btn-send" onclick="sendChat()">\u27a4</button>',
    '      </div>',
    '    </div>',
    '    <button class="btn btn-secondary" onclick="leaveGame()" style="margin-top:.5rem;opacity:.7">Dil nga loja</button>',
    '  </div>',
    '</div>',
    '',
    '<div id="phase-gameover" class="phase">',
    '  <div class="home-wrap">',
    '    <div class="go-emoji" id="go-emoji">\U0001f631</div>',
    '    <div class="go-loser" id="go-loser"></div>',
    '    <div class="go-sub" id="go-sub"></div>',
    '    <div class="card" style="margin-bottom:1rem">',
    '      <div class="section-label">Rezultatet</div>',
    '      <div id="go-results"></div>',
    '    </div>',
    '    <div class="card" id="go-lb-card" style="display:none">',
    '      <div class="section-label">\U0001f3c6 Leaderboard total</div>',
    '      <div id="go-leaderboard"></div>',
    '    </div>',
    '    <div id="go-host-btns" style="display:none">',
    '      <button class="btn btn-primary" onclick="playAgain()">Raundi tjet\u00ebr \u25b6</button>',
    '    </div>',
    '    <div id="go-wait-btns" style="display:none">',
    '      <div class="msg-box warn">\u23f3 Duke pritur hostin...</div>',
    '    </div>',
    '    <button class="btn btn-secondary" onclick="leaveGame()">Dil nga loja</button>',
    '  </div>',
    '</div>',
    '',
    '<div id="draw-modal" class="modal-overlay" style="display:none" onclick="handleModalOutsideClick(event)">',
    '  <div class="modal-box">',
    '    <div class="modal-title" id="modal-title">Zgjedh nj\u00eb let\u00ebr</div>',
    '    <div class="modal-subtitle">Klikoni nj\u00eb kart\u00eb p\u00ebr ta marr\u00eb!</div>',
    '    <div class="cards-row" id="modal-cards" style="justify-content:center;margin:1rem 0;gap:8px"></div>',
    '    <button class="btn btn-secondary" onclick="closeDrawModal()">Anulo</button>',
    '  </div>',
    '</div>',
    '',
    '<div id="reconnect-banner" style="display:none">',
    '  <div class="reconnect-inner">',
    '    <div class="reconnect-spinner"></div>',
    '    <span>Duke u rilidhur...</span>',
    '  </div>',
    '</div>',
    '',
    '<script>',
    'var socket=null,myId=null,myName="",roomCode=null,isHost=false;',
    'var RED_SUITS={"\\u2665":true,"\\u2666":true};',
    '',
    'var AudioCtx=window.AudioContext||window.webkitAudioContext;',
    'var audioCtx=null;',
    'function getAC(){if(!audioCtx)audioCtx=new AudioCtx();return audioCtx;}',
    'function playTone(freq,type,dur,vol,delay){',
    '  vol=vol||0.15;delay=delay||0;',
    '  try{var ctx=getAC(),osc=ctx.createOscillator(),g=ctx.createGain();',
    '  osc.connect(g);g.connect(ctx.destination);osc.type=type;',
    '  osc.frequency.setValueAtTime(freq,ctx.currentTime+delay);',
    '  g.gain.setValueAtTime(vol,ctx.currentTime+delay);',
    '  g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+dur);',
    '  osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+dur+.05);}catch(e){}}',
    'var SFX={',
    '  cardDraw:function(){playTone(440,"sine",.08,.15);playTone(520,"sine",.06,.10,.05);},',
    '  myTurn:function(){playTone(660,"sine",.12,.20);playTone(880,"sine",.10,.15,.08);},',
    '  win:function(){[523,659,784,1047].forEach(function(f,i){playTone(f,"sine",.2,.18,i*.1);});},',
    '  lose:function(){[300,250,200].forEach(function(f,i){playTone(f,"sawtooth",.25,.18,i*.12);});},',
    '  chat:function(){playTone(880,"sine",.07,.08);},',
    '  join:function(){playTone(600,"sine",.10,.12);playTone(750,"sine",.08,.10,.07);},',
    '  error:function(){playTone(300,"square",.15,.15);}',
    '};',
    '',
    'function loadSavedUsername(){var s=localStorage.getItem("kerri_username");if(s){document.getElementById("home-name").value=s;updateAvatar(s);}}',
    'function saveUsername(n){localStorage.setItem("kerri_username",n);updateAvatar(n);}',
    'function updateAvatar(n){var a=document.getElementById("home-avatar");if(a&&n)a.textContent=n.charAt(0).toUpperCase();}',
    '',
    'function saveSession(){if(myId&&roomCode)localStorage.setItem("kerri_session",JSON.stringify({myId:myId,roomCode:roomCode,myName:myName,isHost:isHost}));}',
    'function clearSession(){localStorage.removeItem("kerri_session");}',
    'function getSavedSession(){try{return JSON.parse(localStorage.getItem("kerri_session"));}catch(e){return null;}}',
    '',
    'function connectSocket(cb){',
    '  if(socket&&socket.connected){cb();return;}',
    '  socket=io({transports:["websocket","polling"]});',
    '  socket.on("connect",cb);',
    '  socket.on("disconnect",function(){document.getElementById("reconnect-banner").style.display="flex";});',
    '  socket.on("reconnect",function(){',
    '    document.getElementById("reconnect-banner").style.display="none";',
    '    var sess=getSavedSession();',
    '    if(sess)socket.emit("reconnect_session",{playerId:sess.myId,roomCode:sess.roomCode});',
    '  });',
    '  socket.on("joined",handleJoined);',
    '  socket.on("reconnected",handleJoined);',
    '  socket.on("reconnect_failed",function(){clearSession();showPhase("home");});',
    '  socket.on("lobby_state",renderLobby);',
    '  socket.on("game_state",renderGame);',
    '  socket.on("game_over",renderGameOver);',
    '  socket.on("chat",function(msg){appendChat(msg);if(!msg.system)SFX.chat();});',
    '  socket.on("kicked",function(){clearSession();showPhase("home");showError("home-error","U hoqe nga dhoma.");});',
    '  socket.on("error_msg",function(msg){showError("home-error",msg.message);showError("create-error",msg.message);SFX.error();});',
    '}',
    'function sendMsg(type,data){if(socket)socket.emit(type,data||{});}',
    '',
    'function handleJoined(msg){',
    '  myId=msg.playerId;isHost=msg.isHost;roomCode=msg.roomCode;',
    '  document.getElementById("reconnect-banner").style.display="none";',
    '  saveSession();showPhase("lobby");SFX.join();',
    '}',
    '',
    'function goCreate(){',
    '  var name=document.getElementById("home-name").value.trim();',
    '  if(!name){showError("home-error","Shkruaj emrin tend!");SFX.error();return;}',
    '  myName=name;saveUsername(name);hideError("home-error");showPhase("create");',
    '}',
    'function goJoin(){',
    '  var name=document.getElementById("home-name").value.trim();',
    '  var code=document.getElementById("home-code").value.trim().toUpperCase();',
    '  if(!name){showError("home-error","Shkruaj emrin tend!");SFX.error();return;}',
    '  if(code.length!==4){showError("home-error","Kodi duhet 4 karaktere!");SFX.error();return;}',
    '  myName=name;saveUsername(name);hideError("home-error");',
    '  connectSocket(function(){sendMsg("join_room",{name:myName,roomCode:code});});',
    '}',
    'function createRoom(){',
    '  var el=document.querySelector("input[name=kerri]:checked");',
    '  var kerriType=el?el.value:"joker";',
    '  connectSocket(function(){sendMsg("create_room",{name:myName,kerriType:kerriType});});',
    '}',
    '',
    'function renderLobby(msg){',
    '  showPhase("lobby");',
    '  document.getElementById("lobby-code").textContent=msg.roomCode;',
    '  document.getElementById("lobby-count").textContent=msg.players.length;',
    '  document.getElementById("lobby-players").innerHTML=msg.players.map(function(p){',
    '    var isMe=p.id===myId;',
    '    var kick=isHost&&!p.isHost&&!isMe',
    '      ? "<button class=\\"kick-btn\\" onclick=\\"kickPlayer(\'"+escAttr(p.id)+"\')\\">\u0397iq</button>"',
    '      : "";',
    '    var meLabel=isMe?" <span style=\\"color:var(--hint);font-size:11px\\">(ti)</span>":"";',
    '    var hostBadge=p.isHost?"<span class=\\"host-badge\\">Host</span>":"";',
    '    var dot="<div class=\\"player-dot "+(p.disconnected?"offline":"")+"\\"></div>";',
    '    return "<div class=\\"lobby-player-row\\">"+dot+"<div class=\\"player-name-col\\">"+escHtml(p.name)+meLabel+"</div>"+hostBadge+kick+"</div>";',
    '  }).join("");',
    '  if(msg.leaderboard&&msg.leaderboard.length>0){',
    '    document.getElementById("lobby-lb-wrap").style.display="block";',
    '    document.getElementById("lobby-leaderboard").innerHTML=renderLbRows(msg.leaderboard);',
    '  }',
    '  var ha=document.getElementById("lobby-host-area"),wa=document.getElementById("lobby-wait-area");',
    '  if(isHost){ha.style.display="block";wa.style.display="none";document.getElementById("start-btn").disabled=msg.players.length<2;}',
    '  else{ha.style.display="none";wa.style.display="block";}',
    '}',
    'function startGame(){sendMsg("start_game");}',
    'function kickPlayer(id){sendMsg("kick_player",{targetId:id});}',
    'function copyCode(){',
    '  navigator.clipboard.writeText(document.getElementById("lobby-code").textContent).then(function(){',
    '    var b=document.getElementById("copy-btn");b.innerHTML="\u2713 Kopjuar!";',
    '    setTimeout(function(){b.innerHTML="\u29c9 Kopjo";},2000);',
    '  });',
    '}',
    '',
    'var prevMyTurn=false;',
    'function renderGame(state){',
    '  showPhase("game");',
    '  var ap=null;',
    '  for(var i=0;i<state.players.length;i++){if(state.players[i].id===state.activePlayerId){ap=state.players[i];break;}}',
    '  var isMT=state.isMyTurn;',
    '  if(isMT&&!prevMyTurn)SFX.myTurn();',
    '  prevMyTurn=isMT;',
    '  var tc=document.getElementById("chip-turn");',
    '  tc.textContent=isMT?"\U0001f3af Radha jote!":"Radha e: "+(ap?ap.name:"\u2014");',
    '  tc.className="chip"+(isMT?" my-turn":"");',
    '  document.getElementById("chip-room").textContent="\u2660 "+state.roomCode;',
    '  renderMsg(state);renderOpponents(state);renderMyHand(state.myHand);',
    '  document.getElementById("game-log").innerHTML=(state.log||[]).map(function(l){return "<div class=\\"log-item\\">"+escHtml(l)+"</div>";}).join("");',
    '  if(document.getElementById("lb-panel").style.display!=="none")renderLbPanel(state.leaderboard);',
    '}',
    'function renderMsg(state){',
    '  var m=document.getElementById("game-msg");',
    '  var df=null;',
    '  if(state.opponents){for(var i=0;i<state.opponents.length;i++){if(state.opponents[i].id===state.drawFromId){df=state.opponents[i];break;}}}',
    '  if(!state.myHand||state.myHand.length===0){m.className="msg-box success";m.textContent="\u2705 Bravo! Ke dal\u00ebt!";}',
    '  else if(state.isMyTurn&&df){m.className="msg-box";m.textContent="\U0001f3af Radha jote! Kliko kartolat e \\""+df.name+"\\".";}',
    '  else if(state.isMyTurn){m.className="msg-box success";m.textContent="\u2705 Prit radhën.";}',
    '  else{var a=null;if(state.players){for(var i=0;i<state.players.length;i++){if(state.players[i].id===state.activePlayerId){a=state.players[i];break;}}}m.className="msg-box warn";m.textContent="\u23f3 "+(a?a.name:"\u2014")+" po luan...";}',
    '}',
    'function renderOpponents(state){',
    '  var area=document.getElementById("opponents-area");area.innerHTML="";',
    '  state.opponents.forEach(function(opp){',
    '    var iD=state.isMyTurn&&opp.id===state.drawFromId&&opp.cardCount>0;',
    '    var row=document.createElement("div");row.className="opp-row";',
    '    var cards="";',
    '    for(var i=0;i<opp.cardCount;i++){',
    '      var cls="card-back "+(opp.disconnected?"disc":iD?"drawable":"not-my-turn");',
    '      var clk=iD?" onclick=\\"openDrawModal(\'"+escAttr(opp.id)+"\',\'"+escAttr(opp.name)+"\',"+opp.cardCount+")\\"":" ";',
    '      cards+="<div class=\\""+cls+"\\""+clk+">\u2660</div>";',
    '    }',
    '    var discTag=opp.disconnected?"<span class=\\"disc-tag\\">shk\u00ebputur</span>":"";',
    '    var outBadge=opp.isOut?"<span class=\\"badge badge-out\\">\u2713</span>":"";',
    '    row.innerHTML="<div class=\\"opp-info\\"><div class=\\"opp-name\\">"+escHtml(opp.name)+discTag+outBadge+"</div><div class=\\"opp-meta\\">"+opp.cardCount+" letra</div></div><div class=\\"opp-cards\\">"+cards+"</div>";',
    '    area.appendChild(row);',
    '  });',
    '}',
    'function renderMyHand(hand){',
    '  var c=document.getElementById("my-hand"),cnt=document.getElementById("my-hand-count");',
    '  if(!hand||hand.length===0){c.innerHTML="<span style=\\"font-size:14px;color:#999\\">Ke dal\u00ebt \u2713</span>";if(cnt)cnt.textContent="";return;}',
    '  if(cnt)cnt.textContent=hand.length;',
    '  c.innerHTML=hand.map(function(card){',
    '    var cls="playing-card";',
    '    if(card.isKerri)cls+=" kerri-card";',
    '    else if(RED_SUITS[card.suit])cls+=" red-card";',
    '    else cls+=" black-card";',
    '    return "<div class=\\""+cls+"\\"><div class=\\"rank\\">"+card.rank+"</div><div class=\\"suit\\">"+card.suit+"</div></div>";',
    '  }).join("");',
    '}',
    'function openDrawModal(fId,fName,cnt){',
    '  document.getElementById("modal-title").textContent="Dora e "+fName;',
    '  var indices=[];for(var i=0;i<cnt;i++)indices.push(i);',
    '  for(var i=indices.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var tmp=indices[i];indices[i]=indices[j];indices[j]=tmp;}',
    '  var html="";',
    '  for(var k=0;k<indices.length;k++){',
    '    html+="<div class=\\\"playing-card drawable-card black-card\\\" onclick=\\\"confirmDraw(\\\'"+escAttr(fId)+"\\\',"+ indices[k] +")\\\"><div class=\\\"rank\\\">\u2660</div><div class=\\\"suit\\\" style=\\\"font-size:11px\\\">"+(k+1)+"</div></div>";',
    '  }',
    '  document.getElementById("modal-cards").innerHTML=html;',
    '  document.getElementById("draw-modal").style.display="flex";',
    '}',
    'function closeDrawModal(){document.getElementById("draw-modal").style.display="none";}',
    'function confirmDraw(fId,idx){closeDrawModal();sendMsg("draw_card",{fromPlayerId:fId,cardIndex:idx});}',
    'function handleModalOutsideClick(e){if(e.target===document.getElementById("draw-modal"))closeDrawModal();}',
    '',
    'function renderLbRows(lb){',
    '  if(!lb||lb.length===0)return "<div style=\\"font-size:13px;color:var(--hint)\\">Ende nuk ka loj\u00ebra.</div>";',
    '  var medals=["\U0001f947","\U0001f948","\U0001f949"];',
    '  var m=["gold","silver","bronze"];',
    '  return lb.map(function(p,i){',
    '    var rank=medals[i]||(i+1);',
    '    return "<div class=\\"lb-row\\"><div class=\\"lb-rank "+(m[i]||"")+"\\">"+rank+"</div><div class=\\"lb-name\\">"+escHtml(p.name)+"</div><div class=\\"lb-stats\\"><span class=\\"lb-win\\">"+p.wins+"W</span><span class=\\"lb-loss\\">"+p.losses+"L</span></div></div>";',
    '  }).join("");',
    '}',
    'function toggleLeaderboard(){',
    '  var p=document.getElementById("lb-panel"),open=p.style.display==="none";',
    '  p.style.display=open?"block":"none";',
    '  document.getElementById("lb-toggle-btn").textContent=open?"\u2715":"\U0001f3c6";',
    '}',
    'function renderLbPanel(lb){document.getElementById("lb-content").innerHTML=renderLbRows(lb);}',
    '',
    'function renderGameOver(msg){',
    '  showPhase("gameover");',
    '  var isMe=msg.loserId===myId;',
    '  document.getElementById("go-emoji").textContent=isMe?"\U0001f631":"\U0001f389";',
    '  document.getElementById("go-loser").textContent=msg.loserName;',
    '  document.getElementById("go-sub").textContent=isMe?"Ty t\u00eb ngeci Kerri!":"Atij/Asaj i ngeci Kerri!";',
    '  if(isMe)SFX.lose();else SFX.win();',
    '  document.getElementById("go-results").innerHTML=msg.results.map(function(r){',
    '    var bc,bt;',
    '    if(r.hasKerri){bc="badge-kerri";bt="\u2605 Kerri";}',
    '    else if(r.cardCount===0){bc="badge-out";bt="\u2713 Doli";}',
    '    else{bc="badge-safe";bt=r.cardCount+" letra";}',
    '    return "<div class=\\"result-row\\"><span>"+escHtml(r.name)+"</span><span class=\\"badge "+bc+"\\">"+bt+"</span></div>";',
    '  }).join("");',
    '  var lbc=document.getElementById("go-lb-card");',
    '  if(msg.leaderboard&&msg.leaderboard.length>0){lbc.style.display="block";document.getElementById("go-leaderboard").innerHTML=renderLbRows(msg.leaderboard);}',
    '  else lbc.style.display="none";',
    '  if(isHost){document.getElementById("go-host-btns").style.display="block";document.getElementById("go-wait-btns").style.display="none";}',
    '  else{document.getElementById("go-host-btns").style.display="none";document.getElementById("go-wait-btns").style.display="block";}',
    '}',
    'function playAgain(){sendMsg("start_game");}',
    'function leaveGame(){clearSession();try{if(socket){socket.off();socket.disconnect();}}catch(e){}setTimeout(function(){location.href=location.origin+location.pathname;},150);}',
    '',
    'function sendChat(){',
    '  var inp=document.getElementById("chat-input"),text=inp.value.trim();',
    '  if(!text)return;sendMsg("chat",{text:text});inp.value="";',
    '}',
    'function appendChat(msg){',
    '  var area=document.getElementById("chat-messages");if(!area)return;',
    '  var div=document.createElement("div");',
    '  if(msg.system){div.className="chat-msg system";div.textContent=msg.text;}',
    '  else{div.className="chat-msg";div.innerHTML="<span class=\\"chat-sender\\">"+escHtml(msg.sender)+":</span> "+escHtml(msg.text);}',
    '  area.appendChild(div);area.scrollTop=area.scrollHeight;',
    '}',
    '',
    'function showPhase(id){',
    '  document.querySelectorAll(".phase").forEach(function(p){p.classList.remove("active");});',
    '  var el=document.getElementById("phase-"+id);if(el)el.classList.add("active");',
    '  window.scrollTo({top:0,behavior:"smooth"});',
    '}',
    'function showError(id,msg){var el=document.getElementById(id);if(!el)return;el.textContent=msg;el.style.display="block";}',
    'function hideError(id){var el=document.getElementById(id);if(el)el.style.display="none";}',
    'function escHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}',
    'function escAttr(s){return String(s).replace(/\'/g,"&#39;").replace(/"/g,"&quot;");}',
    '',
    'document.addEventListener("DOMContentLoaded",function(){',
    '  loadSavedUsername();',
    '  var ni=document.getElementById("home-name");',
    '  if(ni)ni.addEventListener("input",function(e){updateAvatar(e.target.value);});',
    '  document.querySelectorAll(".kerri-opt").forEach(function(opt){',
    '    opt.addEventListener("click",function(){',
    '      document.querySelectorAll(".kerri-opt").forEach(function(o){o.classList.remove("selected");});',
    '      opt.classList.add("selected");opt.querySelector("input").checked=true;',
    '    });',
    '  });',
    '  try{',
    '    var sess=getSavedSession();',
    '    if(sess&&sess.myId&&sess.roomCode){',
    '      myId=sess.myId;myName=sess.myName||"";isHost=sess.isHost||false;roomCode=sess.roomCode;',
    '      document.getElementById("reconnect-banner").style.display="flex";',
    '      connectSocket(function(){sendMsg("reconnect_session",{playerId:sess.myId,roomCode:sess.roomCode});});',
    '    }',
    '  }catch(e){clearSession();}',
    '});',
    '<\/script>',
    '</body>',
    '</html>'
  ].join('\n');
}

const HTML = buildHTML();


app.get('*',(req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.send(HTML);});

// ── Game Logic ────────────────────────────────────────────
const rooms={},sessions={};
const RANKS=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS=['\u2660','\u2663','\u2665','\u2666'];
const KERRI_CONFIGS={
  joker:{rank:'\u2605',suit:'\u2605'},
  queen:{rank:'Q',suit:'\u2660'},
  ace:{rank:'A',suit:'\u2665'},
};
function buildDeck(t){
  const cfg=KERRI_CONFIGS[t]||KERRI_CONFIGS.joker,deck=[];
  SUITS.forEach(s=>RANKS.forEach(r=>{if(r===cfg.rank&&s===cfg.suit)return;deck.push({rank:r,suit:s,isKerri:false,id:r+s});}));
  deck.push({rank:cfg.rank,suit:cfg.suit,isKerri:true,id:'KERRI'});return deck;
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function autoRemovePairs(hand){
  let changed=true;
  while(changed){changed=false;
    for(let i=0;i<hand.length;i++){if(hand[i].isKerri)continue;
      for(let j=i+1;j<hand.length;j++){if(!hand[j].isKerri&&hand[i].rank===hand[j].rank){hand.splice(j,1);hand.splice(i,1);changed=true;break;}}
      if(changed)break;}}
}
function makeRoomCode(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code='';for(let i=0;i<4;i++)code+=c[Math.floor(Math.random()*c.length)];return rooms[code]?makeRoomCode():code;}
function getLB(room){return Object.values(room.leaderboard||{}).sort((a,b)=>b.wins-a.wins||a.losses-b.losses);}
function sendGameState(room){
  room.players.forEach(player=>{
    const opponents=room.players.filter(p=>p.id!==player.id).map(p=>({
      id:p.id,name:p.name,cardCount:room.hands[p.id]?room.hands[p.id].length:0,
      isActive:room.activeIdx===room.players.findIndex(x=>x.id===p.id),
      isOut:room.hands[p.id]&&room.hands[p.id].length===0,disconnected:p.disconnected||false,
    }));
    const myHand=room.hands[player.id]||[],ap=room.players[room.activeIdx],isMT=ap&&ap.id===player.id;
    let drawFromId=null;
    if(isMT){const mi=room.players.findIndex(p=>p.id===player.id);
      for(let d=1;d<room.players.length;d++){const t=(mi+d)%room.players.length,tp=room.players[t];
        if(!tp.disconnected&&room.hands[tp.id]&&room.hands[tp.id].length>0){drawFromId=tp.id;break;}}}
    io.to(player.socketId).emit('game_state',{phase:room.phase,myHand,opponents,activePlayerId:ap?ap.id:null,isMyTurn:isMT,drawFromId,roomCode:room.code,players:room.players.map(p=>({id:p.id,name:p.name,disconnected:p.disconnected||false})),log:room.log.slice(0,8),leaderboard:getLB(room)});
  });
}
function sendLobbyState(room){io.to(room.code).emit('lobby_state',{roomCode:room.code,players:room.players.map(p=>({id:p.id,name:p.name,isHost:p.isHost,disconnected:p.disconnected||false})),phase:room.phase,leaderboard:getLB(room)});}
function startGame(room){
  room.phase='playing';room.log=[];room.leaderboard=room.leaderboard||{};
  room.players.forEach(p=>{if(!room.leaderboard[p.id])room.leaderboard[p.id]={name:p.name,wins:0,losses:0,games:0};});
  const deck=shuffle(buildDeck(room.kerriType));room.hands={};
  room.players.forEach(p=>room.hands[p.id]=[]);
  deck.forEach((card,i)=>room.hands[room.players[i%room.players.length].id].push(card));
  room.players.forEach(p=>autoRemovePairs(room.hands[p.id]));
  room.activeIdx=0;room.roundNumber=(room.roundNumber||0)+1;
  room.log.push('Raundi '+room.roundNumber+' filloi!');sendGameState(room);
}
function checkGameOver(room){
  if(room.phase==='gameover')return true;
  const alive=room.players.filter(p=>!p.disconnected&&room.hands[p.id]&&room.hands[p.id].length>0);
  if(alive.length>1)return false;
  room.phase='gameover';let loserId=null;
  room.players.forEach(p=>{if(room.hands[p.id]&&room.hands[p.id].some(c=>c.isKerri))loserId=p.id;});
  if(!loserId&&alive.length===1)loserId=alive[0].id;
  const loserName=room.players.find(p=>p.id===loserId)?room.players.find(p=>p.id===loserId).name:'???';
  room.log.unshift(loserName+' i ngeci Kerri!');
  room.players.forEach(p=>{if(!room.leaderboard[p.id])room.leaderboard[p.id]={name:p.name,wins:0,losses:0,games:0};room.leaderboard[p.id].games++;if(p.id===loserId)room.leaderboard[p.id].losses++;else room.leaderboard[p.id].wins++;});
  io.to(room.code).emit('game_over',{loserId,loserName,results:room.players.map(p=>({id:p.id,name:p.name,hasKerri:room.hands[p.id]?room.hands[p.id].some(c=>c.isKerri):false,cardCount:room.hands[p.id]?room.hands[p.id].length:0})),leaderboard:getLB(room)});
  return true;
}
function advanceTurn(room){
  const total=room.players.length;
  let s=0;
  do{
    room.activeIdx=(room.activeIdx+1)%total;
    s++;
  }while(s<total&&(
    (room.hands[room.players[room.activeIdx].id]||[]).length===0||
    room.players[room.activeIdx].disconnected
  ));
  if(s>=total){checkGameOver(room);return;}
  sendGameState(room);
}

io.on('connection',socket=>{
  const playerId=uuidv4();
  socket.on('create_room',({name,kerriType})=>{
    const code=makeRoomCode(),room={code,phase:'lobby',kerriType:kerriType||'joker',players:[],hands:{},activeIdx:0,log:[],leaderboard:{},roundNumber:0};
    rooms[code]=room;const player={id:playerId,name:name||'Lojtar 1',socketId:socket.id,isHost:true};
    room.players.push(player);sessions[playerId]={name:player.name,roomCode:code,isHost:true};
    socket.join(code);socket.emit('joined',{playerId,roomCode:code,isHost:true});sendLobbyState(room);
  });
  socket.on('join_room',({name,roomCode:code})=>{
    const room=rooms[code?code.toUpperCase():null];
    if(!room){socket.emit('error_msg',{message:'Dhoma nuk u gjet!'});return;}
    if(room.phase!=='lobby'){socket.emit('error_msg',{message:'Loja ka filluar!'});return;}
    if(room.players.length>=6){socket.emit('error_msg',{message:'Dhoma eshte plot!'});return;}
    if(room.players.some(p=>p.name.toLowerCase()===(name||'').toLowerCase())){socket.emit('error_msg',{message:'Ky emer eshte i zene!'});return;}
    const player={id:playerId,name:name||'Lojtar '+(room.players.length+1),socketId:socket.id,isHost:false};
    room.players.push(player);sessions[playerId]={name:player.name,roomCode:code,isHost:false};
    socket.join(code);socket.emit('joined',{playerId,roomCode:code,isHost:false});
    room.log.push(player.name+' u bashkua.');sendLobbyState(room);
    io.to(code).emit('chat',{text:player.name+' u bashkua!',system:true});
  });
  socket.on('reconnect_session',({playerId:pid,roomCode:code})=>{
    const sess=sessions[pid],room=rooms[sess?sess.roomCode:code];
    if(!room){socket.emit('reconnect_failed');return;}
    const player=room.players.find(p=>p.id===pid);
    if(!player){socket.emit('reconnect_failed');return;}
    player.socketId=socket.id;player.disconnected=false;socket.join(room.code);
    socket.emit('reconnected',{playerId:pid,roomCode:room.code,isHost:player.isHost});
    if(room.phase==='lobby')sendLobbyState(room);else if(room.phase==='playing')sendGameState(room);
    io.to(room.code).emit('chat',{text:player.name+' u rilidhë!',system:true});
  });
  socket.on('start_game',()=>{
    const sess=sessions[playerId],room=rooms[sess?sess.roomCode:null];if(!room)return;
    const player=room.players.find(p=>p.id===playerId);
    if(!player||!player.isHost){socket.emit('error_msg',{message:'Vetem hosti!'});return;}
    if(room.players.length<2){socket.emit('error_msg',{message:'Duhen 2+ lojtare!'});return;}
    startGame(room);
  });
  socket.on('draw_card',({fromPlayerId,cardIndex})=>{
    const sess=sessions[playerId],room=rooms[sess?sess.roomCode:null];if(!room||room.phase!=='playing')return;
    const ap=room.players[room.activeIdx];if(ap.id!==playerId){socket.emit('error_msg',{message:'Nuk eshte radha jote!'});return;}
    const fp=room.players.find(p=>p.id===fromPlayerId);if(!fp)return;
    const fh=room.hands[fp.id];if(!fh||fh.length===0)return;
    if(cardIndex<0||cardIndex>=fh.length)return;
    const card=fh.splice(cardIndex,1)[0];room.hands[playerId].push(card);
    room.log.unshift(ap.name+' mori "'+(card.isKerri?'★ KERRI':card.rank+card.suit)+'" nga '+fp.name);
    autoRemovePairs(room.hands[playerId]);if(checkGameOver(room))return;advanceTurn(room);
  });
  socket.on('chat',({text})=>{
    const sess=sessions[playerId],room=rooms[sess?sess.roomCode:null];if(!room)return;
    const sender=room.players.find(p=>p.id===playerId);
    const t=String(text||'').slice(0,200);if(!t.trim())return;
    io.to(room.code).emit('chat',{text:t,sender:sender?sender.name:'?'});
  });
  socket.on('kick_player',({targetId})=>{
    const sess=sessions[playerId],room=rooms[sess?sess.roomCode:null];if(!room||room.phase!=='lobby')return;
    const host=room.players.find(p=>p.id===playerId);if(!host||!host.isHost)return;
    const target=room.players.find(p=>p.id===targetId);if(!target||target.isHost)return;
    io.to(target.socketId).emit('kicked');room.players=room.players.filter(p=>p.id!==targetId);
    delete sessions[targetId];sendLobbyState(room);
  });
  socket.on('disconnect',()=>{
    const sess=sessions[playerId];if(!sess||!sess.roomCode)return;
    const room=rooms[sess.roomCode];if(!room)return;
    const player=room.players.find(p=>p.id===playerId);if(!player)return;
    if(room.phase==='lobby'){
      room.players=room.players.filter(p=>p.id!==playerId);delete sessions[playerId];
      if(room.players.length===0){delete rooms[sess.roomCode];return;}
      if(!room.players.some(p=>p.isHost))room.players[0].isHost=true;
      sendLobbyState(room);
    }else{
      player.disconnected=true;room.log.unshift(player.name+' u shkëput.');
      io.to(room.code).emit('chat',{text:player.name+' u shkëput...',system:true});
      if(room.phase==='playing'){
        if(checkGameOver(room))return;
        const ap=room.players[room.activeIdx];
        if(ap&&ap.id===playerId)advanceTurn(room);
        else sendGameState(room);
      }
      setTimeout(()=>{
        if(!player.disconnected)return;
        room.players=room.players.filter(p=>p.id!==playerId);delete sessions[playerId];
        if(room.players.length===0){delete rooms[sess.roomCode];return;}
        if(!room.players.some(p=>p.isHost))room.players[0].isHost=true;
        io.to(room.code).emit('chat',{text:player.name+' u largua.',system:true});
        if(room.phase==='playing'){if(!checkGameOver(room))sendGameState(room);}
        else sendLobbyState(room);
      },60000);
    }
  });
});

server.listen(PORT,()=>console.log('Kerri: http://localhost:'+PORT));
