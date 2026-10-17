const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Run the real handlers with isolated sockets and a controllable disconnect clock.
function game() {
  const source = fs.readFileSync(require.resolve('../server.js'), 'utf8');
  const sockets = new Map(), timers = new Set();
  let connect, nextId = 0;
  const io = { on: (_, fn) => { connect = fn; }, sockets: { sockets },
    to: () => ({ emit() {} }) };
  const context = vm.createContext({ io, uuidv4: () => `id-${++nextId}`,
    setTimeout: fn => { timers.add(fn); return fn; }, clearTimeout: fn => timers.delete(fn) });
  vm.runInContext(source.slice(source.indexOf('const rooms='), source.indexOf('server.listen(')) +
    ';globalThis.state={rooms,sessions,startGame,checkGameOver,buildDeck,autoRemovePairs};', context);
  function socket() {
    const handlers = {}, events = [];
    const s = { id: `socket-${++nextId}`, events, on: (e, f) => { handlers[e] = f; },
      emit: (e, data) => events.push({ e, data }), join() {}, leave() {},
      disconnect() { handlers.disconnect(); },
      send(e, data) { handlers[e](data); },
      last(e) { return events.filter(x => x.e === e).at(-1)?.data; } };
    sockets.set(s.id, s); connect(s); return s;
  }
  const host = socket(); host.send('create_room', { name: 'Host' });
  const joined = host.last('joined'), room = context.state.rooms[joined.roomCode];
  function join(name) { const s = socket(); s.send('join_room', { name, roomCode: room.code }); return s; }
  return { ...context.state, host, joined, room, join, socket,
    expire() { for (const fn of [...timers]) { timers.delete(fn); fn(); } } };
}

test('malformed events cannot crash the server', () => {
  const g = game(), s = g.socket();
  for (const event of ['create_room', 'join_room', 'reconnect_session', 'draw_card', 'reorder_hand', 'chat', 'kick_player']) {
    for (const value of [undefined, null, 3, 'bad', [], { name: {}, roomCode: 42 }]) {
      assert.doesNotThrow(() => s.send(event, value), event);
    }
  }
});

test('one socket cannot create duplicate room memberships', () => {
  const g = game(); g.host.send('create_room', { name: 'Again' });
  assert.equal(Object.keys(g.rooms).length, 1);
});

test('reconnection requires a private token, and the host retains controls', () => {
  const g = game(); g.join('Guest');
  const attacker = g.socket();
  attacker.send('reconnect_session', { playerId: g.joined.playerId, roomCode: g.room.code });
  assert.equal(g.room.players[0].socketId, g.host.id);
  g.host.send('disconnect');
  const restored = g.socket();
  restored.send('reconnect_session', g.joined);
  assert.ok(restored.last('reconnected'));
  restored.send('start_game');
  assert.equal(g.room.phase, 'playing');
  restored.send('chat', { text: 'Back' });
  assert.equal(g.room.players[0].disconnected, false);
});

test('draws enforce the next opponent and integer indices', () => {
  const g = game(); g.join('B'); g.join('C');
  const [a,b,c] = g.room.players;
  const card = rank => ({ rank, suit: 'S', id: rank, isKerri: false });
  g.room.phase = 'playing'; g.room.hands = { [a.id]: [card('2')], [b.id]: [card('3')], [c.id]: [card('4')] };
  for (const cardIndex of [undefined, null, '0', 0.5, -1, NaN]) {
    g.host.send('draw_card', { fromPlayerId: b.id, cardIndex });
    assert.equal(g.room.hands[b.id].length, 1);
  }
  for (const fromPlayerId of [a.id, c.id]) {
    g.host.send('draw_card', { fromPlayerId, cardIndex: 0 });
    assert.equal(g.room.hands[fromPlayerId].length, 1);
  }
  g.host.send('draw_card', { fromPlayerId: b.id, cardIndex: 0 });
  assert.equal(g.room.hands[b.id].length, 0);
});

test('a disconnect preserves cards and pauses until reconnection or timeout', () => {
  const g = game(); const guest = g.join('Guest'); g.host.send('start_game');
  const before = JSON.stringify(g.room.hands);
  guest.send('disconnect');
  assert.equal(g.room.phase, 'playing');
  assert.equal(JSON.stringify(g.room.hands), before);
  g.expire();
  assert.equal(g.room.phase, 'gameover');
});

test('reorder rejects missing and fractional indices', () => {
  const g = game(); g.join('Guest'); g.host.send('start_game');
  g.room.hands[g.joined.playerId] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const before = JSON.stringify(g.room.hands);
  for (const fromIdx of [undefined, null, '0', 0.5]) g.host.send('reorder_hand', { fromIdx, toIdx: 0 });
  assert.equal(JSON.stringify(g.room.hands), before);
});

test('each Kerri type leaves exactly one unpaired special card', () => {
  const g = game();
  for (const type of ['joker', 'queen', 'ace']) {
    const deck = g.buildDeck(type);
    assert.equal(deck.filter(c => c.isKerri).length, 1);
    assert.equal(deck.length % 2, 1);
    assert.equal(new Set(deck.map(c => c.id)).size, deck.length);
    if (type === 'queen') assert.equal(deck.find(c => c.isKerri).rank, 'Q');
    if (type === 'ace') assert.equal(deck.find(c => c.isKerri).rank, 'A');
    g.autoRemovePairs(deck);
    assert.equal(deck.length, 1);
    assert.ok(deck[0].isKerri);
  }
});

test('reconnected sockets remain authoritative and can reclaim gameover state', () => {
  const g = game(); g.join('Guest');
  const restored = g.socket(); restored.send('reconnect_session', g.joined);
  g.host.send('start_game'); assert.equal(g.room.phase, 'lobby');
  restored.send('start_game'); assert.equal(g.room.phase, 'playing');
  g.checkGameOver(g.room, g.joined.playerId);
  const games = g.room.leaderboard[g.joined.playerId].games;
  const again = g.socket(); again.send('reconnect_session', g.joined);
  assert.equal(again.last('game_over').loserId, g.joined.playerId);
  assert.equal(g.room.leaderboard[g.joined.playerId].games, games);
});

test('disconnect timers cancel on reconnect and transfer host on expiration', () => {
  const g = game(), guest = g.join('Guest');
  g.host.send('disconnect');
  const restored = g.socket(); restored.send('reconnect_session', g.joined);
  g.expire(); assert.equal(g.room.players.length, 2);
  restored.send('disconnect'); g.expire();
  assert.equal(g.room.players.length, 1);
  assert.equal(g.room.players[0].isHost, true);
  g.join('Third'); guest.send('start_game'); assert.equal(g.room.phase, 'playing');
});

test('an eliminated player timing out cannot forfeit or change the current turn', () => {
  const g = game(), guest = g.join('Out');g.join('Still playing');
  g.host.send('start_game');
  const [host,out,other]=g.room.players;
  g.room.phase='playing';g.room.activeIdx=2;
  g.room.hands={[host.id]:[{rank:'2'}],[out.id]:[],[other.id]:[{rank:'3'}]};
  guest.send('disconnect');g.expire();
  assert.equal(g.room.phase,'playing');
  assert.equal(g.room.players[g.room.activeIdx].id,other.id);
});

test('deal selects a nonempty hand and completes an already finished deal', () => {
  const g = game(); g.join('Guest');
  for (let i = 0; i < 100; i++) {
    g.startGame(g.room);
    if (g.room.phase === 'playing') assert.ok(g.room.hands[g.room.players[g.room.activeIdx].id].length);
    else assert.equal(g.room.phase, 'gameover');
  }
});

test('generated client renders valid HTML attributes and handles reconnect only once', () => {
  const source = fs.readFileSync(require.resolve('../server.js'), 'utf8');
  const html = vm.runInNewContext(source.slice(source.indexOf('function buildHTML()'), source.indexOf('const HTML =')) + ';buildHTML()');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  new vm.Script(script);
  const elements = new Map();
  const document = { addEventListener() {}, getElementById(id) {
    if (!elements.has(id)) elements.set(id, { style: { display: 'none' }, classList: { add() {}, remove() {} } });
    return elements.get(id);
  }, querySelectorAll: () => [] };
  const handlers = {}, sent = [];
  const client = { connected: false, on(e, fn) { handlers[e] = fn; }, emit: (...args) => sent.push(args) };
  const store = new Map();
  const ctx = vm.createContext({ document, window: { scrollTo() {} }, io: () => client,
    localStorage: { getItem: k => store.get(k), setItem: (k,v) => store.set(k,v) },
    setTimeout() {}, requestAnimationFrame() {} });
  vm.runInContext(script, ctx);
  assert.doesNotMatch(ctx.renderLbRows([{ name: 'A', wins: 0, losses: 0 }]), /\\"/);
  ctx.SFX = { join() {} };
  ctx.renderLobby({ roomCode: 'ABCD', players: [{ id: 'me', name: 'Me', isHost: true }] });
  assert.doesNotMatch(elements.get('lobby-players').innerHTML, /\\"/);
  ctx.connectSocket(() => sent.push(['create_room']));
  handlers.connect();
  ctx.handleJoined({ playerId: 'me', roomCode: 'ABCD', isHost: true, sessionToken: 'private' });
  handlers.connect();
  assert.equal(sent.filter(x => x[0] === 'create_room').length, 1);
  assert.equal(sent.filter(x => x[0] === 'reconnect_session').length, 1);
});
