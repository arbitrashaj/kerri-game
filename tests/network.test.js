const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const net = require('node:net');

async function client(url) {
  const ws = new WebSocket(url.replace('http', 'ws') + '/socket.io/?EIO=4&transport=websocket');
  const messages = [], waiting = [];
  ws.addEventListener('message', ({ data }) => {
    if (data.startsWith('0')) ws.send('40');
    else if (data === '2') ws.send('3');
    else if (data.startsWith('42')) {
      const [event, payload] = JSON.parse(data.slice(2));
      messages.push({ event, payload });
      for (const notify of waiting.splice(0)) notify();
    }
  });
  await once(ws, 'open');
  // Socket.IO namespace handshake follows the Engine.IO handshake.
  await new Promise(resolve => {
    const ready = ({ data }) => { if (data.startsWith('40')) { ws.removeEventListener('message', ready); resolve(); } };
    ws.addEventListener('message', ready);
  });
  return { close: () => ws.close(), emit: (e,p={}) => ws.send('42'+JSON.stringify([e,p])), messages,
    async next(event) {
      const deadline = Date.now()+5000;
      while (true) {
        const idx = messages.findIndex(m => (Array.isArray(event)?event:[event]).includes(m.event));
        if (idx >= 0) return messages.splice(idx,1)[0].payload;
        if (Date.now()>deadline) throw new Error('Timed out waiting for '+event+'; queued events: '+messages.map(m=>m.event+(m.payload?.message?': '+m.payload.message:'')).join(', '));
        await new Promise(resolve => { const timer=setTimeout(resolve,100); waiting.push(() => { clearTimeout(timer);resolve(); }); });
      }
    } };
}

test('real HTTP and Socket.IO: play full rounds and restore host/chat', { timeout: 120000 }, async t => {
  const reservation = net.createServer(); reservation.listen(0,'127.0.0.1'); await once(reservation,'listening');
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const server = spawn(process.execPath, ['server.js'], { cwd: require('node:path').join(__dirname,'..'), env: { ...process.env, PORT: String(port), KERRI_DB: ':memory:' }, stdio: ['ignore','pipe','pipe'] });
  t.after(() => server.kill());
  let startupError='';server.stderr.on('data',chunk=>{startupError+=chunk;});
  t.after(() => { if(startupError) t.diagnostic(startupError); });
  await Promise.race([once(server.stdout,'data'),once(server,'exit').then(([code])=>{throw Error(`Server exited ${code}: ${startupError}`);})]);
  const url = `http://127.0.0.1:${port}`;
  const page = await fetch(url); assert.equal(page.status,200); assert.match(await page.text(), /Kujt i ngec Kerri/);
  assert.deepEqual(await fetch(url+'/healthz').then(r=>r.json()),{ok:true});
  const clients = [await client(url),await client(url),await client(url)];
  t.after(() => clients.forEach(c => c.close()));
  const profiles=await Promise.all(clients.map((_,i)=>fetch(url+'/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:i?'Player '+i:'Host'})}).then(r=>r.json())));
  assert.ok(profiles.every(p=>p.token));
  const host = clients[0]; host.emit('create_room',{name:'Host',kerriType:'queen',profileToken:profiles[0].token});
  const joined = await host.next('joined');
  for(let i=1;i<clients.length;i++){clients[i].emit('join_room',{name:'Player '+i,roomCode:joined.roomCode.toLowerCase(),profileToken:profiles[i].token});await clients[i].next('joined');clients[i].emit('set_ready',{ready:true});await clients[i].next('lobby_state');}
  // Wait until the host observes readiness, not just socket transport ordering.
  let lobby;do {lobby=await host.next('lobby_state');}while(lobby.players.length!==3||lobby.players.some(p=>!p.ready));
  host.emit('start_game');
  let turns=0,seed=17,result;
  while(true){
    const states = await Promise.all(clients.map(c=>c.next(['game_state','game_over'])));
    if(!states[0].phase){result=states[0];break;}
    const idx=states.findIndex(s=>s.isMyTurn); assert.ok(idx>=0);
    assert.ok(states[idx].drawFromId);
    const count=states[idx].opponents.find(p=>p.id===states[idx].drawFromId).cardCount;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const state=states[idx];
    assert.ok(state.opponents.every(p=>!p.cards&&!p.hand));
    await new Promise(resolve=>setTimeout(resolve,90));
    clients[idx].emit('draw_card',{fromPlayerId:state.drawFromId,cardIndex:seed%count,roundId:state.roundId,turnVersion:state.turnVersion,sourceVersion:state.sourceVersion,actionId:require('node:crypto').randomUUID()});
    const drawn=await host.next('card_drawn');assert.equal(drawn.card,undefined);
    assert.ok((await clients[idx].next('card_revealed')).card);
    for(let i=0;i<clients.length;i++)if(i!==idx)assert.equal(clients[i].messages.some(m=>m.event==='card_revealed'),false);
    assert.ok(++turns<2000,'Round must terminate');
  }
  assert.equal(result.results.filter(r=>r.hasKerri).length,1);
  assert.equal(result.results.reduce((n,r)=>n+r.cardCount,0),1);
  host.close();
  const restored = await client(url);clients.push(restored);
  restored.emit('reconnect_session',joined);await restored.next('reconnected');
  assert.equal((await restored.next('game_over')).loserId,result.loserId);
  for(const profile of profiles){
    const saved=await fetch(url+'/api/profile',{headers:{Authorization:'Bearer '+profile.token}}).then(r=>r.json());
    assert.equal(saved.stats.games,1);assert.equal(saved.history.length,1);assert.equal(saved.stats.xp,10);
  }
  restored.emit('chat',{text:'Reconnected'});
  let chat; do { chat=await clients[1].next('chat'); } while(chat.system);
  assert.equal(chat.sender,'Host'); assert.equal(chat.text,'Reconnected');
  restored.emit('start_game'); const nextRound=await restored.next('game_state'); assert.equal(nextRound.phase,'playing');
});
