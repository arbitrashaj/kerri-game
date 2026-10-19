const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function client() {
  const sent = [];
  const context = vm.createContext({ window: {}, document: { addEventListener() {} },
    crypto: require('node:crypto').webcrypto, console, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(require.resolve('../www/app.js'), 'utf8'), context);
  context.socket = { connected: true, emit: (event, data) => sent.push({event, data}) };
  return { context, sent };
}

test('two-step selection rejects a changed source hand and only commits the selected position', () => {
  const {context:c,sent}=client();
  const elements={};
  c.document.getElementById=id=>elements[id]||(elements[id]={close(){}});
  vm.runInContext(fs.readFileSync(require.resolve('../www/beta.js'),'utf8'),c);
  c.lastState={roundId:'round',turnVersion:4,sourceVersion:2};
  c.pick={fromPlayerId:'source',cardIndex:3,roundId:'round',turnVersion:4,sourceVersion:1};
  c.commitPick();assert.equal(sent.length,0);
  c.pick={fromPlayerId:'source',cardIndex:null,roundId:'round',turnVersion:4,sourceVersion:2};
  c.commitPick();assert.equal(sent.length,0);
  c.pick.cardIndex=3;c.commitPick();
  assert.equal(sent.length,1);assert.equal(sent[0].data.cardIndex,3);assert.equal(sent[0].data.fromPlayerId,'source');
  c.commitPick();assert.equal(sent.length,1);
});

test('client sends authoritative versions and unique IDs with draw and reorder actions', () => {
  const {context:c, sent} = client();
  c.lastState = {roundId:'round-1',turnVersion:3,sourceVersion:5,handVersion:2};
  c.sendMsg('draw_card',{fromPlayerId:'other',cardIndex:1});
  c.sendMsg('reorder_hand',{fromIdx:0,toIdx:1});
  assert.equal(sent[0].data.roundId,'round-1');
  assert.equal(sent[0].data.turnVersion,3);
  assert.equal(sent[0].data.sourceVersion,5);
  assert.equal(sent[1].data.handVersion,2);
  assert.ok(sent[0].data.actionId.length>=8);
  assert.notEqual(sent[0].data.actionId,sent[1].data.actionId);
});

test('client does not send game actions without a state or a connection', () => {
  const {context:c, sent} = client();
  c.sendMsg('draw_card',{cardIndex:0});
  assert.equal(sent.length,0);
  c.socket.connected=false;
  c.sendMsg('chat',{text:'hello'});
  assert.equal(sent.length,0);
});
