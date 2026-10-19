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
    to: target => ({ emit(e,data) { for(const s of sockets.values()) if(s.id===target || s.rooms.has(target)) s.emit(e,structuredClone(data)); } }) };
  const context = vm.createContext({ io, console, process, randomInt: require('node:crypto').randomInt, store: { authenticate: () => null, recordRound: () => false, metric() {} }, uuidv4: () => `id-${++nextId}`,
    setTimeout: fn => { timers.add(fn); return fn; }, clearTimeout: fn => timers.delete(fn) });
  vm.runInContext(source.slice(source.indexOf('const rooms='), source.indexOf('server.listen(')) +
    ';globalThis.state={rooms,sessions,startGame,checkGameOver,buildDeck,autoRemovePairs};', context);
  function socket() {
    const handlers = {}, events = [];
    const s = { id: `socket-${++nextId}`, events, on: (e, f) => { handlers[e] = f; },
      rooms: new Set(), emit: (e, data) => events.push({ e, data }), join(r) { this.rooms.add(r); }, leave(r) { this.rooms.delete(r); },
      disconnect() { handlers.disconnect(); this.rooms.clear(); },
      send(e, data) { handlers[e](data); },
      last(e) { return events.filter(x => x.e === e).at(-1)?.data; } };
    sockets.set(s.id, s); connect(s); return s;
  }
  const host = socket(); host.send('create_room', { name: 'Host' });
  const joined = host.last('joined'), room = context.state.rooms[joined.roomCode];
  function join(name) { const s = socket(); s.send('join_room', { name, roomCode: room.code }); s.send('set_ready',{ready:true}); return s; }
  return { ...context.state, host, joined, room, join, socket,
    expire() { for (const fn of [...timers]) { timers.delete(fn); fn(); } } };
}

function draw(g) {
  const state=g.room, source=state.players[(state.activeIdx+1)%state.players.length];
  return {actionId:require('node:crypto').randomUUID(),roundId:state.roundId,turnVersion:state.turnVersion,sourceVersion:state.handVersions[source.id],fromPlayerId:source.id,cardIndex:0};
}

test('readiness prevents starting before guests consent', () => {
  const g=game(), guest=g.socket();
  guest.send('join_room',{name:'Unready',roomCode:g.room.code});
  g.host.send('start_game'); assert.equal(g.room.phase,'lobby');
  guest.send('set_ready',{ready:true});
  g.host.send('start_game'); assert.equal(g.room.phase,'playing');
});

test('public queue starts after readiness and practice bots take real turns', () => {
  const g=game();g.host.send('leave_room');
  g.host.send('quick_play',{name:'Host'});
  const room=g.rooms[g.host.last('joined').roomCode];
  assert.equal(room.isPublic,true);
  const guest=g.socket();guest.send('quick_play',{name:'Guest'});
  assert.equal(guest.last('joined').roomCode,room.code);assert.equal(room.phase,'lobby');
  guest.send('set_ready',{ready:true});assert.equal(room.phase,'playing');
  const practice=g.socket();practice.send('practice',{name:'Practice'});
  const training=g.rooms[practice.last('joined').roomCode];
  assert.equal(training.mode,'practice');assert.equal(training.players.filter(p=>p.isBot).length,2);
  const [human,bot,other]=training.players;
  training.phase='playing';training.activeIdx=1;
  training.hands={[human.id]:[{id:'2',rank:'2'}],[bot.id]:[{id:'3',rank:'3'}],[other.id]:[{id:'KERRI',isKerri:true,rank:'*'}]};
  practice.send('resync_state');const version=training.turnVersion;
  g.expire();assert.equal(training.turnVersion,version+1);
  assert.equal(practice.last('card_revealed'),undefined);
});

test('stale and repeated draws cannot mutate hands twice or disclose cards', () => {
  const g=game(), guest=g.join('Guest');g.startGame(g.room);
  const [a,b]=g.room.players;
  g.room.activeIdx=0;g.room.phase='playing';
  g.room.hands={[a.id]:[{id:'2S',rank:'2'}],[b.id]:[{id:'3S',rank:'3'},{id:'KERRI',rank:'*',isKerri:true}]};
  const payload=draw(g), before=JSON.stringify(g.room.hands);
  g.host.send('draw_card',{...payload,turnVersion:-1});
  assert.equal(JSON.stringify(g.room.hands),before);assert.ok(g.host.last('action_error'));
  g.host.send('draw_card',payload);
  const after=JSON.stringify(g.room.hands);assert.notEqual(after,before);
  g.host.send('draw_card',payload);assert.equal(JSON.stringify(g.room.hands),after);
  assert.ok(g.host.last('card_revealed').card);
  assert.equal(guest.last('card_revealed'),undefined);
  assert.equal(guest.last('card_drawn').card,undefined);
  assert.ok(guest.last('game_state').opponents.every(p=>!p.hand&&!p.cards));
  assert.ok(!JSON.stringify(guest.last('game_state').log).includes('3S'));
});

test('leaving transfers host immediately and removes empty rooms', () => {
  const g=game(), guest=g.join('Guest');
  g.host.send('leave_room');
  assert.equal(g.room.players.length,1);assert.equal(g.room.players[0].isHost,true);
  assert.equal(g.sessions[g.joined.playerId],undefined);
  guest.send('leave_room');assert.equal(g.rooms[g.room.code],undefined);
});

test('expired session tokens cannot reclaim a player', () => {
  const g=game();g.sessions[g.joined.playerId].expiresAt=Date.now()-1;
  const attacker=g.socket();attacker.send('reconnect_session',g.joined);
  assert.ok(attacker.events.some(e=>e.e==='reconnect_failed'));
});

test('room events and hidden hands stay isolated', () => {
  const g=game();g.join('Guest');
  const outsider=g.socket();outsider.send('create_room',{name:'Other'});
  outsider.events.length=0;g.host.send('chat',{text:'private room'});g.startGame(g.room);
  assert.equal(outsider.events.length,0);
});

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
  g.startGame(g.room);
  const card = rank => ({ rank, suit: 'S', id: rank, isKerri: false });
  g.room.phase = 'playing'; g.room.activeIdx=0; g.room.hands = { [a.id]: [card('2')], [b.id]: [card('3')], [c.id]: [card('4')] };
  for (const cardIndex of [undefined, null, '0', 0.5, -1, NaN]) {
    g.host.send('draw_card', { ...draw(g), fromPlayerId: b.id, cardIndex });
    assert.equal(g.room.hands[b.id].length, 1);
  }
  for (const fromPlayerId of [a.id, c.id]) {
    g.host.send('draw_card', { ...draw(g), fromPlayerId, cardIndex: 0 });
    assert.equal(g.room.hands[fromPlayerId].length, 1);
  }
  g.host.send('draw_card', { ...draw(g), fromPlayerId: b.id, cardIndex: 0 });
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
  for (const fromIdx of [undefined, null, '0', 0.5]) g.host.send('reorder_hand', { fromIdx, toIdx: 0,roundId:g.room.roundId,handVersion:g.room.handVersions[g.joined.playerId],actionId:require('node:crypto').randomUUID() });
  assert.equal(JSON.stringify(g.room.hands), before);
});

test('reordering invalidates a previously selected source card', () => {
  const g=game(), guest=g.join('Guest');g.startGame(g.room);
  const [a,b]=g.room.players;g.room.activeIdx=0;g.room.phase='playing';
  g.room.hands={[a.id]:[{id:'2S',rank:'2'}],[b.id]:[{id:'3S',rank:'3'},{id:'KERRI',rank:'*',isKerri:true}]};
  const oldSelection=draw(g);
  guest.send('reorder_hand',{fromIdx:0,toIdx:1,roundId:g.room.roundId,handVersion:g.room.handVersions[b.id],actionId:require('node:crypto').randomUUID()});
  assert.equal(g.room.hands[b.id][0].id,'KERRI');
  const before=JSON.stringify(g.room.hands);g.host.send('draw_card',oldSelection);
  assert.equal(JSON.stringify(g.room.hands),before);assert.ok(g.host.last('action_error'));
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
