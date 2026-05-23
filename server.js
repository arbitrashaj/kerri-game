// ============================================================
//  Kujt i ngec Kerri — Server v2
//  + Reconnect, Leaderboard, Username persistence, Room cleanup
// ============================================================
const express  = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const { v4: uuidv4 } = require('uuid');
const http     = require('http');
const path     = require('path');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 10000;

// ─── Strukturat kryesore ──────────────────────────────────────
// rooms[code]      = { code, phase, kerriType, players[], hands{}, activeIdx, log[], leaderboard{} }
// sessions[pid]    = { name, roomCode, isHost, hand snapshot for reconnect }
// clients WeakMap  = ws → { playerId }
const rooms    = {};
const sessions = {};           // pid → { name, roomCode, isHost }
const clients  = new WeakMap();

// ─── Kuverta ──────────────────────────────────────────────────
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS = ['♠','♣','♥','♦'];
const KERRI_CONFIGS = {
  joker: { rank: '★', suit: '★' },
  queen: { rank: 'Q', suit: '♠' },
  ace:   { rank: 'A', suit: '♥' },
};

function buildDeck(kerriType) {
  const cfg = KERRI_CONFIGS[kerriType] || KERRI_CONFIGS.joker;
  const deck = [];
  SUITS.forEach(s => RANKS.forEach(r => {
    if (r === cfg.rank && s === cfg.suit) return;
    deck.push({ rank: r, suit: s, isKerri: false, id: r + s });
  }));
  deck.push({ rank: cfg.rank, suit: cfg.suit, isKerri: true, id: 'KERRI' });
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function autoRemovePairs(hand) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < hand.length; i++) {
      if (hand[i].isKerri) continue;
      for (let j = i + 1; j < hand.length; j++) {
        if (!hand[j].isKerri && hand[i].rank === hand[j].rank) {
          hand.splice(j, 1); hand.splice(i, 1);
          changed = true; break;
        }
      }
      if (changed) break;
    }
  }
}

// ─── Utilities ────────────────────────────────────────────────
function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms[code] ? makeRoomCode() : code;
}

function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function broadcast(room, data, excludeWs = null) {
  room.players.forEach(p => {
    if (p.ws !== excludeWs) send(p.ws, data);
  });
}

// ─── Leaderboard helpers ──────────────────────────────────────
function initLeaderboard(room) {
  room.leaderboard = room.leaderboard || {};
  room.players.forEach(p => {
    if (!room.leaderboard[p.id])
      room.leaderboard[p.id] = { name: p.name, wins: 0, losses: 0, games: 0 };
  });
}

function updateLeaderboard(room, loserId) {
  room.players.forEach(p => {
    if (!room.leaderboard[p.id])
      room.leaderboard[p.id] = { name: p.name, wins: 0, losses: 0, games: 0 };
    room.leaderboard[p.id].games++;
    if (p.id === loserId) room.leaderboard[p.id].losses++;
    else                  room.leaderboard[p.id].wins++;
  });
}

function getLeaderboardArray(room) {
  return Object.values(room.leaderboard || {})
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
}

// ─── sendGameState ────────────────────────────────────────────
function sendGameState(room) {
  room.players.forEach(player => {
    const opponents = room.players
      .filter(p => p.id !== player.id)
      .map(p => ({
        id:        p.id,
        name:      p.name,
        cardCount: room.hands[p.id] ? room.hands[p.id].length : 0,
        isActive:  room.activeIdx === room.players.findIndex(x => x.id === p.id),
        isOut:     room.hands[p.id] && room.hands[p.id].length === 0,
        disconnected: p.disconnected || false,
      }));

    const myHand       = room.hands[player.id] || [];
    const activePlayer = room.players[room.activeIdx];
    const isMyTurn     = activePlayer && activePlayer.id === player.id;

    let drawFromId = null;
    if (isMyTurn) {
      const myIdx = room.players.findIndex(p => p.id === player.id);
      for (let d = 1; d < room.players.length; d++) {
        const t  = (myIdx + d) % room.players.length;
        const tp = room.players[t];
        if (!tp.disconnected && room.hands[tp.id] && room.hands[tp.id].length > 0) {
          drawFromId = tp.id; break;
        }
      }
    }

    send(player.ws, {
      type:           'game_state',
      phase:          room.phase,
      myHand,
      opponents,
      activePlayerId: activePlayer ? activePlayer.id : null,
      isMyTurn,
      drawFromId,
      roomCode:       room.code,
      players:        room.players.map(p => ({ id: p.id, name: p.name, disconnected: p.disconnected || false })),
      log:            room.log.slice(0, 8),
      leaderboard:    getLeaderboardArray(room),
    });
  });
}

function sendLobbyState(room) {
  broadcast(room, {
    type:        'lobby_state',
    roomCode:    room.code,
    players:     room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, disconnected: p.disconnected || false })),
    phase:       room.phase,
    leaderboard: getLeaderboardArray(room),
  });
}

// ─── startGame ────────────────────────────────────────────────
function startGame(room) {
  room.phase = 'playing';
  room.log   = [];
  initLeaderboard(room);

  const deck = shuffle(buildDeck(room.kerriType));
  room.hands = {};
  room.players.forEach(p => room.hands[p.id] = []);
  deck.forEach((card, i) => {
    const p = room.players[i % room.players.length];
    room.hands[p.id].push(card);
  });
  room.players.forEach(p => autoRemovePairs(room.hands[p.id]));

  room.activeIdx = 0;
  room.roundNumber = (room.roundNumber || 0) + 1;
  room.log.push(`Raundi ${room.roundNumber} filloi me ${room.players.length} lojtarë!`);
  sendGameState(room);
}

// ─── checkGameOver ────────────────────────────────────────────
function checkGameOver(room) {
  const alive = room.players.filter(p => room.hands[p.id] && room.hands[p.id].length > 0);
  if (alive.length > 1) return false;

  room.phase = 'gameover';
  let loserId = null;
  room.players.forEach(p => {
    if (room.hands[p.id]?.some(c => c.isKerri)) loserId = p.id;
  });
  if (!loserId && alive.length === 1) loserId = alive[0].id;

  const loserName = room.players.find(p => p.id === loserId)?.name || '???';
  room.log.unshift(`Raundi ${room.roundNumber}: ${loserName} i ngeci Kerri!`);

  updateLeaderboard(room, loserId);

  broadcast(room, {
    type:        'game_over',
    loserId,
    loserName,
    results:     room.players.map(p => ({
      id:        p.id,
      name:      p.name,
      hasKerri:  room.hands[p.id]?.some(c => c.isKerri) || false,
      cardCount: room.hands[p.id]?.length || 0,
    })),
    leaderboard: getLeaderboardArray(room),
  });
  return true;
}

// ─── advanceTurn ──────────────────────────────────────────────
function advanceTurn(room) {
  let safety = 0;
  do {
    room.activeIdx = (room.activeIdx + 1) % room.players.length;
    safety++;
  } while (
    (room.hands[room.players[room.activeIdx].id]?.length === 0 ||
     room.players[room.activeIdx].disconnected) &&
    safety < room.players.length
  );
  sendGameState(room);
}

// ─── Reconnect logic ──────────────────────────────────────────
function tryReconnect(ws, playerId, roomCode) {
  const session = sessions[playerId];
  if (!session) return false;
  const room = rooms[session.roomCode || roomCode];
  if (!room) return false;

  const player = room.players.find(p => p.id === playerId);
  if (!player) return false;

  // Rilidh WebSocket-in
  player.ws           = ws;
  player.disconnected = false;
  clients.set(ws, { playerId });

  send(ws, { type: 'reconnected', playerId, roomCode: room.code, isHost: player.isHost });

  if (room.phase === 'lobby')   sendLobbyState(room);
  else if (room.phase === 'playing') sendGameState(room);
  else if (room.phase === 'gameover') {
    // Ridërgo game_over
    let loserId = null;
    room.players.forEach(p => { if (room.hands[p.id]?.some(c => c.isKerri)) loserId = p.id; });
    send(ws, {
      type:        'game_over',
      loserId,
      loserName:   room.players.find(p => p.id === loserId)?.name || '???',
      results:     room.players.map(p => ({
        id: p.id, name: p.name,
        hasKerri:  room.hands[p.id]?.some(c => c.isKerri) || false,
        cardCount: room.hands[p.id]?.length || 0,
      })),
      leaderboard: getLeaderboardArray(room),
    });
  }

  broadcast(room, { type: 'chat', text: `${player.name} u rilidhë!`, system: true }, ws);
  return true;
}

// ─── WebSocket ────────────────────────────────────────────────
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
