const { DatabaseSync } = require('node:sqlite');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { mkdirSync } = require('node:fs');
const { dirname } = require('node:path');

const DAY = 86400000;
const COSMETICS = {
  avatar: { eagle: 0, mountain: 0, sun: 0, crown: 10 },
  cardBack: { classic: 0, eagle: 3, gold: 10 },
  tableTheme: { emerald: 0, midnight: 3, burgundy: 10 }
};
const EVENTS = new Set(['tutorial_complete','invite_shared','reconnect_failed','first_match','match_complete','rematch','app_open']);
const hash = token => createHash('sha256').update(token).digest('hex');
function name(value) {
  if(typeof value !== 'string' || !value.trim() || value.trim().length > 20) throw Error('Emri duhet të ketë 1–20 karaktere.');
  return value.trim();
}

function createStore(filename, { analyticsEnabled = false } = {}) {
  if(filename !== ':memory:') mkdirSync(dirname(filename), {recursive:true});
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY, secret TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL,
      name TEXT NOT NULL, friend_code TEXT UNIQUE NOT NULL, created INTEGER NOT NULL,
      avatar TEXT NOT NULL DEFAULT 'eagle', card_back TEXT NOT NULL DEFAULT 'classic', table_theme TEXT NOT NULL DEFAULT 'emerald');
    CREATE TABLE IF NOT EXISTS rounds (id TEXT PRIMARY KEY, room_code TEXT, mode TEXT, started INTEGER, ended INTEGER, forfeit INTEGER);
    CREATE TABLE IF NOT EXISTS results (round_id TEXT REFERENCES rounds(id), profile_id TEXT REFERENCES profiles(id), lost INTEGER, xp INTEGER,
      PRIMARY KEY(round_id,profile_id));
    CREATE TABLE IF NOT EXISTS friendships (sender TEXT REFERENCES profiles(id), recipient TEXT REFERENCES profiles(id), accepted INTEGER DEFAULT 0,
      PRIMARY KEY(sender,recipient));
    CREATE TABLE IF NOT EXISTS invites (sender TEXT REFERENCES profiles(id), recipient TEXT REFERENCES profiles(id), room_code TEXT, expires INTEGER,
      PRIMARY KEY(sender,recipient));
    CREATE TABLE IF NOT EXISTS metrics (profile_id TEXT REFERENCES profiles(id), event TEXT, at INTEGER);
    CREATE INDEX IF NOT EXISTS results_profile ON results(profile_id);
    CREATE INDEX IF NOT EXISTS metrics_time ON metrics(at);`);
  const get = (sql,...args) => db.prepare(sql).get(...args);
  const all = (sql,...args) => db.prepare(sql).all(...args);
  const run = (sql,...args) => db.prepare(sql).run(...args);
  function publicProfile(id) {
    const p = get('SELECT * FROM profiles WHERE id=?',id);
    if(!p) return null;
    const counts = get(`SELECT COUNT(*) games, COALESCE(SUM(lost),0) losses, COALESCE(SUM(xp),0) xp
      FROM results JOIN rounds ON rounds.id=round_id WHERE profile_id=? AND mode='online' AND forfeit=0`,id);
    const stats={games:counts.games,wins:counts.games-counts.losses,losses:counts.losses,xp:counts.xp};
    const today = get(`SELECT COUNT(*) games FROM results JOIN rounds ON rounds.id=round_id
      WHERE profile_id=? AND mode='online' AND forfeit=0 AND ended>=?`,id,Math.floor(Date.now()/DAY)*DAY).games;
    return {id:p.id,name:p.name,avatar:p.avatar,cardBack:p.card_back,tableTheme:p.table_theme,friendCode:p.friend_code,stats,
      dailyChallenge:{id:'play_three',target:3,progress:Math.min(today,3),complete:today>=3,reward:'Pjesëmarrje; 10 XP për raund, deri në 100 XP/ditë (UTC).'},
      achievements:[...(stats.games>=1?['first_round']:[]),...(stats.games>=10?['ten_rounds']:[])],
      cosmetics:Object.fromEntries(Object.entries(COSMETICS).map(([kind,items])=>[kind,Object.entries(items).map(([id,games])=>({id,games,unlocked:stats.games>=games}))])),
      history:all(`SELECT rounds.id, room_code AS roomCode, mode, ended AS endedAt, forfeit, lost, xp FROM results
        JOIN rounds ON rounds.id=round_id WHERE profile_id=? ORDER BY ended DESC LIMIT 20`,id)};
  }
  function authenticate(token) {
    if(typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
    const p=get('SELECT id FROM profiles WHERE secret=? AND expires>?',hash(token),Date.now());
    if(!p) return null;
    run('UPDATE profiles SET expires=? WHERE id=?',Date.now()+90*DAY,p.id);
    activity(p.id);
    return publicProfile(p.id);
  }
  function requireProfile(token) { const p=authenticate(token); if(!p) throw Error('Sesioni ka skaduar. Hyr përsëri.'); return p; }
  function profile(token, displayName) {
    if(token) { const p=requireProfile(token); return displayName === undefined ? p : updateProfile(token,{name:displayName}); }
    const secret=randomBytes(32).toString('hex'), id=randomUUID();
    run('INSERT INTO profiles(id,secret,expires,name,friend_code,created) VALUES(?,?,?,?,?,?)',
      id,hash(secret),Date.now()+90*DAY,displayName===undefined?'Mik':name(displayName),randomBytes(6).toString('hex').toUpperCase(),Date.now());
    activity(id);
    return {...publicProfile(id),token:secret};
  }
  function updateProfile(token, patch) {
    const p=requireProfile(token);
    if(!patch || typeof patch!=='object' || Array.isArray(patch)) throw Error('Profil i pavlefshëm.');
    for(const kind of Object.keys(COSMETICS)) if(patch[kind]!==undefined) {
      if(typeof patch[kind]!=='string' || !Object.hasOwn(COSMETICS[kind],patch[kind]) || p.stats.games<COSMETICS[kind][patch[kind]]) throw Error('Kjo pamje ende nuk është hapur.');
      p[kind]=patch[kind];
    }
    run('UPDATE profiles SET name=?,avatar=?,card_back=?,table_theme=? WHERE id=?',patch.name===undefined?p.name:name(patch.name),p.avatar,p.cardBack,p.tableTheme,p.id);
    return publicProfile(p.id);
  }
  function recordRound(round) {
    const {id,roomCode,mode='online',startedAt,endedAt,loserId,forfeit=false,players}=round;
    if(typeof id!=='string'||!id||!Array.isArray(players)||!Number.isFinite(startedAt)||!Number.isFinite(endedAt)||endedAt<startedAt) throw Error('Rezultat i pavlefshëm.');
    const humans=players.filter(p=>!p.isBot&&p.profileId);
    if(new Set(humans.map(p=>p.profileId)).size!==humans.length) throw Error('Profil i përsëritur.');
    if(!forfeit && !players.some(p=>p.id===loserId||p.profileId===loserId)) throw Error('Humbësi nuk u gjet.');
    const eligible=mode==='online'&&!forfeit&&humans.length>=2&&humans.length===players.length;
    db.exec('BEGIN IMMEDIATE');
    try {
      if(get('SELECT id FROM rounds WHERE id=?',id)) { db.exec('ROLLBACK'); return false; }
      run('INSERT INTO rounds VALUES(?,?,?,?,?,?)',id,roomCode||'',eligible?'online':mode==='online'?'unranked':mode,startedAt,endedAt,forfeit?1:0);
      for(const p of humans) {
        const earned=get(`SELECT COALESCE(SUM(xp),0) xp FROM results JOIN rounds ON rounds.id=round_id
          WHERE profile_id=? AND ended>=? AND ended<?`,p.profileId,Math.floor(endedAt/DAY)*DAY,(Math.floor(endedAt/DAY)+1)*DAY).xp;
        run('INSERT INTO results VALUES(?,?,?,?)',id,p.profileId,p.id===loserId||p.profileId===loserId?1:0,eligible&&earned<100?10:0);
      }
      db.exec('COMMIT'); return true;
    } catch(error) { db.exec('ROLLBACK'); throw error; }
  }
  function leaderboard() {
    return all(`SELECT profiles.id,profiles.name,profiles.avatar,COUNT(*) games, SUM(results.xp) xp FROM results
      JOIN profiles ON profiles.id=profile_id JOIN rounds ON rounds.id=round_id
      WHERE mode='online' AND forfeit=0 GROUP BY profile_id ORDER BY games DESC,profiles.id LIMIT 50`);
  }
  const friend = (a,b) => get('SELECT 1 FROM friendships WHERE accepted=1 AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))',a,b,b,a);
  const brief = id => { const p=get('SELECT id,name,avatar FROM profiles WHERE id=?',id); return p?{...p}:null; };
  function social(token) {
    const p=requireProfile(token); run('DELETE FROM invites WHERE expires<=?',Date.now());
    const relations=all('SELECT * FROM friendships WHERE sender=? OR recipient=?',p.id,p.id);
    return {friends:relations.filter(r=>r.accepted).map(r=>brief(r.sender===p.id?r.recipient:r.sender)),
      incoming:relations.filter(r=>!r.accepted&&r.recipient===p.id).map(r=>brief(r.sender)),
      outgoing:relations.filter(r=>!r.accepted&&r.sender===p.id).map(r=>brief(r.recipient)),
      invites:all('SELECT sender,room_code AS roomCode,expires FROM invites WHERE recipient=?',p.id).map(r=>({...r,from:brief(r.sender)}))};
  }
  function requestFriend(token,code) {
    const p=requireProfile(token);
    if(typeof code!=='string') throw Error('Kod miku i pavlefshëm.');
    const target=get('SELECT id FROM profiles WHERE friend_code=?',code.trim().toUpperCase());
    if(!target||target.id===p.id) throw Error('Kodi i mikut nuk u gjet.');
    if(!get('SELECT 1 FROM friendships WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)',p.id,target.id,target.id,p.id)) {
      if([p.id,target.id].some(id=>get('SELECT COUNT(*) n FROM friendships WHERE sender=? OR recipient=?',id,id).n>=100)) throw Error('Kufiri i miqve u arrit.');
      run('INSERT INTO friendships(sender,recipient) VALUES(?,?)',p.id,target.id);
    }
    return social(token);
  }
  function acceptFriend(token,id) {
    const p=requireProfile(token);
    if(typeof id!=='string'||!run('UPDATE friendships SET accepted=1 WHERE sender=? AND recipient=?',id,p.id).changes) throw Error('Kërkesa nuk u gjet.');
    return social(token);
  }
  function inviteFriend(token,id,roomCode) {
    const p=requireProfile(token);
    if(typeof id!=='string'||!friend(p.id,id)) throw Error('Ftesat lejohen vetëm mes miqve.');
    if(typeof roomCode!=='string'||!/^[A-Z0-9]{4,8}$/.test(roomCode)) throw Error('Kod dhome i pavlefshëm.');
    run('INSERT OR REPLACE INTO invites VALUES(?,?,?,?)',p.id,id,roomCode,Date.now()+15*60000);
    return social(token);
  }
  function metric(profileId,event) {
    if(!analyticsEnabled||typeof profileId!=='string'||!EVENTS.has(event)||!get('SELECT id FROM profiles WHERE id=?',profileId)) return false;
    run('DELETE FROM metrics WHERE at<?',Date.now()-30*DAY);
    run('INSERT INTO metrics VALUES(?,?,?)',profileId,event,Date.now()); return true;
  }
  function activity(id) {
    if(analyticsEnabled&&!get('SELECT 1 FROM metrics WHERE profile_id=? AND event=? AND at>=? LIMIT 1',id,'app_open',Math.floor(Date.now()/DAY)*DAY)) metric(id,'app_open');
  }
  function report() {
    if(!analyticsEnabled) return {enabled:false,events:{}};
    const now=Date.now();
    run('DELETE FROM metrics WHERE at<?',now-30*DAY);
    const retention = days => {
      const cohort=all(`SELECT id,created FROM profiles WHERE created>=? AND created<?`,now-30*DAY,now-(days+1)*DAY);
      const returned=cohort.filter(p=>get('SELECT 1 FROM metrics WHERE profile_id=? AND at>=? AND at<? LIMIT 1',p.id,p.created+days*DAY,p.created+(days+1)*DAY)).length;
      return {eligible:cohort.length,returned,rate:cohort.length?returned/cohort.length:null};
    };
    return {enabled:true,windowDays:30,events:Object.fromEntries(all('SELECT event,COUNT(*) n FROM metrics GROUP BY event').map(r=>[r.event,r.n])),
      retention:{day1:retention(1),day7:retention(7)}};
  }
  return {profile,authenticate,updateProfile,recordRound,leaderboard,social,requestFriend,acceptFriend,inviteFriend,metric,report,close:()=>db.close()};
}
module.exports = {createStore,COSMETICS};
