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
const LOADING_HINTS = [
  'Duke përzier letrat...', 'Duke fshehur Kerrin...',
  'Duke thirrur miqtë...', 'Duke pregatitur kuvertën...',
  'Gati për të luajtur!',
];
let loadPct = 0;
let loadInterval = null;

function startLoading() {
  loadPct = 0;
  let hintIdx = 0;
  document.getElementById('loading-fill').style.width = '0%';
  document.getElementById('loading-hint').textContent = LOADING_HINTS[0];

  loadInterval = setInterval(() => {
    loadPct += Math.random() * 14 + 4;
    if (loadPct > 95) loadPct = 95;
    document.getElementById('loading-fill').style.width = loadPct + '%';
    hintIdx = Math.min(Math.floor(loadPct / 22), LOADING_HINTS.length - 1);
    document.getElementById('loading-hint').textContent = LOADING_HINTS[hintIdx];
  }, 180);
}

function finishLoading() {
  clearInterval(loadInterval);
  document.getElementById('loading-fill').style.width = '100%';
  document.getElementById('loading-hint').textContent = 'Gati!';
  setTimeout(() => {
    const ls = document.getElementById('loading-screen');
    ls.classList.add('fade-out');
    setTimeout(() => ls.style.display = 'none', 500);
  }, 300);
}

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
  ws = new WebSocket(`${proto}://${location.host}`);

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
  startLoading();
  setTimeout(finishLoading, 1800);

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
      ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')">Hiq</button>` : '';
    return `
      <div class="lobby-player-row">
        <div class="player-dot ${disc ? 'offline' : ''}"></div>
        <div class="player-name-col">
          <span>${escHtml(p.name)}${isMe ? ' <span style="color:var(--hint);font-size:12px">(ti)</span>' : ''}</span>
          ${disc ? '<span style="font-size:11px;color:var(--hint)"> · shkëputur</span>' : ''}
        </div>
        ${p.isHost ? '<span class="host-badge">Host</span>' : ''}
        ${kickBtn}
      </div>`;
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
  turnChip.textContent = isMyTurn ? '🎯 Radha jote!' : `Radha e: ${activePlayer?.name || '—'}`;
  turnChip.className   = 'chip' + (isMyTurn ? ' my-turn' : '');
  document.getElementById('chip-room').textContent = `♠ ${state.roomCode}`;

  renderMsg(state);
  renderOpponents(state);
  renderMyHand(state.myHand);

  const logEl = document.getElementById('game-log');
  logEl.innerHTML = (state.log || []).map((l,i) =>
    `<div class="log-item">${escHtml(l)}</div>`).join('');

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
    msg.textContent = `🎯 Radha jote! Kliko mbi kartolat e "${drawFrom.name}" për të zgjedhur.`;
  } else if (state.isMyTurn) {
    msg.className   = 'msg-box success';
    msg.textContent = '✅ Prit radhën tjetër.';
  } else {
    const active    = state.players?.find(p => p.id === state.activePlayerId);
    msg.className   = 'msg-box warn';
    msg.textContent = `⏳ ${active?.name || '—'} po luan...`;
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
        ? `onclick="openDrawModal('${opp.id}','${escAttr(opp.name)}',${opp.cardCount})"` : '';
      return `<div class="${cls.join(' ')}" ${click}>♠</div>`;
    }).join('');

    const outBadge  = opp.isOut ? '<span class="badge badge-out">✓ Doli</span>' : '';
    const discTag   = opp.disconnected ? '<span class="disc-tag">shkëputur</span>' : '';

    row.innerHTML = `
      <div class="opp-info">
        <div class="opp-name">${escHtml(opp.name)} ${discTag} ${outBadge}</div>
        <div class="opp-meta">${opp.cardCount} letra</div>
      </div>
      <div class="opp-cards">${cardsHtml}</div>`;
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
    return `<div class="${cls}"><div class="rank">${card.rank}</div><div class="suit">${card.suit}</div></div>`;
  }).join('');
}

// ─── Draw modal ───────────────────────────────────────────────
function openDrawModal(fromPlayerId, fromName, cardCount) {
  document.getElementById('modal-title').textContent = `Dora e ${fromName}`;
  const container = document.getElementById('modal-cards');
  container.innerHTML = Array.from({ length: cardCount }, (_, i) => `
    <div class="playing-card drawable-card black-card" onclick="confirmDraw('${fromPlayerId}',${i})">
      <div class="rank">♠</div>
      <div class="suit" style="font-size:11px">${i+1}</div>
    </div>`).join('');
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
  return lb.map((p, i) => `
    <div class="lb-row">
      <div class="lb-rank ${medals[i] || ''}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
      <div class="lb-name">${escHtml(p.name)}</div>
      <div class="lb-stats">
        <span class="lb-win">${p.wins}W</span>
        <span class="lb-loss">${p.losses}L</span>
      </div>
    </div>`).join('');
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
    else                     { badgeClass='badge-safe';  badgeText=`${r.cardCount} letra`; }
    return `<div class="result-row"><span>${escHtml(r.name)}</span><span class="badge ${badgeClass}">${badgeText}</span></div>`;
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
    div.innerHTML = `<span class="chat-sender">${escHtml(msg.sender)}:</span> ${escHtml(msg.text)}`;
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
