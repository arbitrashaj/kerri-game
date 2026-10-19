const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../server/store');

function setup(t, options) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kerri-store-'));
  const filename = path.join(dir, 'game.sqlite');
  let store = createStore(filename, options);
  t.after(() => { store.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  return { get store() { return store; }, reopen() { store.close(); store = createStore(filename, options); return store; } };
}
function round(a,b, extra={}) {
  return { id: 'round-1', roomCode: 'ABCD', mode: 'online', startedAt: Date.now()-1000,
    endedAt: Date.now(), loserId: b.id, players: [a,b].map(p=>({id:p.id,profileId:p.id,name:p.name})), ...extra };
}
test('guest authentication and results survive reopening; round commits exactly once', t=>{
  const db=setup(t); const a=db.store.profile(null,'Ana'), b=db.store.profile(null,'Beni');
  assert.equal(db.store.authenticate('invalid'),null);
  assert.equal(db.store.authenticate(a.token).token,undefined);
  assert.equal(db.store.recordRound(round(a,b)),true);
  assert.equal(db.store.recordRound(round(a,b)),false);
  const p=db.reopen().authenticate(a.token);
  assert.deepEqual(p.stats,{games:1,wins:1,losses:0,xp:10});
  assert.equal(p.history.length,1); assert.equal(db.store.leaderboard().length,2);
});
test('friendship requires consent and invites require friendship',t=>{
  const {store}=setup(t), a=store.profile(), b=store.profile();
  assert.throws(()=>store.inviteFriend(a.token,b.id,'ABCD'));
  store.requestFriend(a.token,b.friendCode);
  assert.equal(store.social(b.token).incoming[0].id,a.id);
  assert.throws(()=>store.acceptFriend(a.token,b.id));
  store.acceptFriend(b.token,a.id); store.inviteFriend(a.token,b.id,'ABCD');
  assert.equal(store.social(b.token).friends[0].id,a.id);
  assert.equal(store.social(b.token).invites[0].roomCode,'ABCD');
});
test('cosmetics require participation; practice and forfeits earn no XP',t=>{
  const {store}=setup(t), a=store.profile(), b=store.profile();
  assert.throws(()=>store.updateProfile(a.token,{cardBack:'eagle'}));
  assert.throws(()=>store.updateProfile(a.token,{avatar:'<script>'}));
  store.recordRound(round(a,b,{mode:'practice'}));
  store.recordRound(round(a,b,{id:'forfeit',forfeit:true}));
  assert.equal(store.authenticate(a.token).stats.xp,0);
  for(let i=0;i<12;i++) store.recordRound(round(a,b,{id:'online-'+i}));
  assert.equal(store.authenticate(a.token).stats.xp,100);
  assert.equal(store.updateProfile(a.token,{cardBack:'eagle'}).cardBack,'eagle');
});
test('metrics are opt-in and allowlisted',t=>{
  const db=setup(t); const a=db.store.profile();
  assert.equal(db.store.metric(a.id,'tutorial_complete'),false);
  assert.equal(db.store.report().enabled,false);
  const enabled=setup(t,{analyticsEnabled:true}).store, b=enabled.profile();
  assert.equal(enabled.metric(b.id,'anything'),false);
  assert.equal(enabled.metric(undefined,'first_match'),false);
  assert.equal(enabled.metric(b.id,'tutorial_complete'),true);
  assert.equal(enabled.report().events.tutorial_complete,1);
});
test('guest expiry, daily activity and retention use actual authenticated visits',t=>{
  const originalNow=Date.now, start=originalNow(); let now=start;
  Date.now=()=>now;
  try {
    const {store}=setup(t,{analyticsEnabled:true}), a=store.profile();
    store.authenticate(a.token);
    assert.equal(store.report().events.app_open,1);
    now+=86400000+1000; store.authenticate(a.token);
    now+=86400000;
    assert.equal(store.report().retention.day1.returned,1);
    assert.equal(store.report().retention.day1.eligible,1);
    now+=91*86400000;
    assert.equal(store.authenticate(a.token),null);
    assert.equal(store.report().events.app_open,undefined);
  } finally { Date.now=originalNow; }
});
test('invalid participant rolls back entire round and allows corrected retry',t=>{
  const {store}=setup(t), a=store.profile(), b=store.profile();
  const broken=round(a,b);
  broken.players[1].profileId='missing-profile';
  assert.throws(()=>store.recordRound(broken));
  assert.equal(store.authenticate(a.token).stats.games,0);
  assert.equal(store.recordRound(round(a,b)),true);
});
