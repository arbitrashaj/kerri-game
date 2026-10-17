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
  return { close: () => ws.close(), emit: (e,p) => ws.send('42'+JSON.stringify([e,p])), messages,
    async next(event) {
      const deadline = Date.now()+5000;
      while (true) {
        const idx = messages.findIndex(m => (Array.isArray(event)?event:[event]).includes(m.event));
        if (idx >= 0) return messages.splice(idx,1)[0].payload;
        if (Date.now()>deadline) throw new Error('Timed out waiting for '+event);
        await new Promise(resolve => { const timer=setTimeout(resolve,100); waiting.push(() => { clearTimeout(timer);resolve(); }); });
      }
    } };
}

test('real HTTP and Socket.IO: play full rounds and restore host/chat', { timeout: 30000 }, async t => {
  const reservation = net.createServer(); reservation.listen(0,'127.0.0.1'); await once(reservation,'listening');
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const server = spawn(process.execPath, ['server.js'], { cwd: require('node:path').join(__dirname,'..'), env: { ...process.env, PORT: String(port) }, stdio: ['ignore','pipe','pipe'] });
  t.after(() => server.kill());
  await once(server.stdout,'data');
  const url = `http://127.0.0.1:${port}`;
  const page = await fetch(url); assert.equal(page.status,200); assert.match(await page.text(), /Kujt i ngec Kerri/);
  const clients = [await client(url),await client(url),await client(url)];
  t.after(() => clients.forEach(c => c.close()));
  const host = clients[0]; host.emit('create_room',{name:'Host',kerriType:'queen'});
  const joined = await host.next('joined');
  for(let i=1;i<clients.length;i++){clients[i].emit('join_room',{name:'Player '+i,roomCode:joined.roomCode.toLowerCase()});await clients[i].next('joined');}
  host.emit('start_game');
  let turns=0,seed=17,result;
  while(true){
    const states = await Promise.all(clients.map(c=>c.next(['game_state','game_over'])));
    if(!states[0].phase){result=states[0];break;}
    const idx=states.findIndex(s=>s.isMyTurn); assert.ok(idx>=0);
    assert.ok(states[idx].drawFromId);
    const count=states[idx].opponents.find(p=>p.id===states[idx].drawFromId).cardCount;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    clients[idx].emit('draw_card',{fromPlayerId:states[idx].drawFromId,cardIndex:seed%count});
    await host.next('card_revealed');
    assert.ok(++turns<2000,'Round must terminate');
  }
  assert.equal(result.results.filter(r=>r.hasKerri).length,1);
  assert.equal(result.results.reduce((n,r)=>n+r.cardCount,0),1);
  host.close();
  const restored = await client(url);clients.push(restored);
  restored.emit('reconnect_session',joined);await restored.next('reconnected');
  assert.equal((await restored.next('game_over')).loserId,result.loserId);
  restored.emit('chat',{text:'Reconnected'});
  let chat; do { chat=await clients[1].next('chat'); } while(chat.system);
  assert.equal(chat.sender,'Host'); assert.equal(chat.text,'Reconnected');
  restored.emit('start_game'); const nextRound=await restored.next('game_state'); assert.equal(nextRound.phase,'playing');
});
