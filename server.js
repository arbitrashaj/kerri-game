// ============================================================
//  Kujt i ngec Kerri — Server v3 (Socket.io)
// ============================================================
const express = require('express');
const http    = require('http');
const path    = require('path');
const { Server } = require('socket.io');
const { randomUUID: uuidv4, randomInt } = require('node:crypto');
const { createStore } = require('./server/store');
const store = createStore(process.env.KERRI_DB || path.join(__dirname,'data/kerri.sqlite'), {
  analyticsEnabled: process.env.ANALYTICS_ENABLED === 'true',
});
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://localhost,capacitor://localhost').split(',').map(s=>s.trim());
function acceptsOrigin(origin,host) {
  if(!origin || allowedOrigins.includes(origin))return true;
  try { const url=new URL(origin);return ['http:','https:'].includes(url.protocol)&&url.host===host; } catch {return false;}
}

const app    = express();
app.disable('x-powered-by');
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('X-Frame-Options','DENY');
  if(req.headers.origin){
    if(!acceptsOrigin(req.headers.origin,req.headers.host))return res.status(403).json({message:'Origjinë e palejuar.'});
    res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods','GET, POST, PATCH, OPTIONS');
  }
  if(req.method==='OPTIONS')return res.sendStatus(204);
  next();
});
app.use('/api',express.json({limit:'4kb'}),(req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  if(!consumeLimit('http:'+req.socket.remoteAddress,120,60000))return res.status(429).json({message:'Shumë kërkesa. Provo pas pak.'});
  next();
});
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: (origin,cb)=>cb(null,origin||false) },
  allowRequest: (req,cb)=>cb(null,acceptsOrigin(req.headers.origin,req.headers.host)),
  maxHttpBufferSize: 8192,
  transports: ['websocket', 'polling'],
});
const PORT = process.env.PORT || 3000;

const bearer = req => (req.headers.authorization||'').replace(/^Bearer /,'');
function api(fn){return (req,res)=>{try{res.json(fn(req));}catch(error){
  if(error.code?.startsWith('ERR_SQLITE')){console.error(JSON.stringify({event:'database_error',code:error.code}));return res.status(503).json({message:'Ruajtja nuk është e disponueshme. Provo përsëri.'});}
  res.status(400).json({message:error.message});
}};}
app.get('/healthz',(req,res)=>res.json({ok:true}));
app.get('/api/config',(req,res)=>res.json({analyticsEnabled:process.env.ANALYTICS_ENABLED==='true',protocol:2}));
app.post('/api/profile',api(req=>{
  if(!consumeLimit('profile:'+req.socket.remoteAddress,10,60000))throw Error('Prit pak përpara se të krijosh profil tjetër.');
  return store.profile(req.body?.token,req.body?.name);
}));
app.get('/api/profile',api(req=>{const p=store.authenticate(bearer(req));if(!p)throw Error('Sesioni ka skaduar. Hyr përsëri.');return p;}));
app.patch('/api/profile',api(req=>store.updateProfile(bearer(req),req.body)));
app.get('/api/leaderboard',api(()=>store.leaderboard()));
app.get('/api/social',api(req=>store.social(bearer(req))));
app.post('/api/friends',api(req=>store.requestFriend(bearer(req),req.body?.friendCode)));
app.post('/api/friends/accept',api(req=>store.acceptFriend(bearer(req),req.body?.profileId)));
app.post('/api/invites',api(req=>{
  const p=store.authenticate(bearer(req)),room=rooms[req.body?.roomCode];
  if(!p||!room||room.phase!=='lobby'||!room.players.some(x=>x.profileId===p.id&&!x.disconnected))throw Error('Hyr në një dhomë për të ftuar miqtë.');
  return store.inviteFriend(bearer(req),req.body?.profileId,room.code);
}));
app.post('/api/metrics',api(req=>{const p=store.authenticate(bearer(req));if(!p)throw Error('Hyr përsëri.');store.metric(p.id,req.body?.event);return {ok:true};}));
app.get('/config.js',(req,res)=>res.type('js').send('window.KERRI_SERVER_URL="";'));
app.get('/vendor/socket.io.min.js',(req,res)=>res.sendFile(path.join(__dirname,'node_modules/socket.io/client-dist/socket.io.min.js')));
app.use(express.static(path.join(__dirname,'www'),{maxAge:0}));
app.use((error,req,res,next)=>res.status(error.status||500).json({message:'Kërkesë e pavlefshme.'}));

// ── Game Logic ────────────────────────────────────────────
const rooms=Object.create(null),sessions=Object.create(null),socketToPlayer=Object.create(null);
const limitBuckets=new Map();
const SESSION_TTL=24*60*60*1000;
function consumeLimit(key,max,windowMs){
  const now=Date.now();let bucket=limitBuckets.get(key);
  if(!bucket||now>=bucket.until){
    if(limitBuckets.size>=10000){for(const [k,v] of limitBuckets)if(v.until<=now)limitBuckets.delete(k);if(limitBuckets.size>=10000)return false;}
    bucket={n:0,until:now+windowMs};limitBuckets.set(key,bucket);
  }
  return ++bucket.n<=max;
}
function drawSource(room, pid) {
  const idx=room.players.findIndex(p=>p.id===pid);
  for(let d=1;d<room.players.length;d++) {
    const p=room.players[(idx+d)%room.players.length];
    if((room.hands[p.id]||[]).length) return p;
  }
  return null;
}
function paused(room){return room.players.some(p=>p.disconnected&&(room.hands[p.id]||[]).length);}
function updateHost(room){
  if(!room.players.some(p=>p.isHost&&!p.disconnected)){
    room.players.forEach(p=>{p.isHost=false;});
    const next=room.players.find(p=>!p.disconnected);if(next)next.isHost=true;
  }
}
const RANKS=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS=['\u2660','\u2663','\u2665','\u2666'];
const KERRI_CONFIGS={
  joker:{rank:'\u2605',suit:'\u2605'},
  queen:{rank:'Q',suit:'\u2660',removedSuit:'\u2663'},
  ace:{rank:'A',suit:'\u2665',removedSuit:'\u2666'},
};
function buildDeck(t){
  const cfg=Object.hasOwn(KERRI_CONFIGS,t)?KERRI_CONFIGS[t]:KERRI_CONFIGS.joker,deck=[];
  SUITS.forEach(s=>RANKS.forEach(r=>{if(r===cfg.rank&&(s===cfg.suit||s===cfg.removedSuit))return;deck.push({rank:r,suit:s,isKerri:false,id:r+s});}));
  deck.push({rank:cfg.rank,suit:cfg.suit,isKerri:true,id:'KERRI'});return deck;
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function autoRemovePairs(hand){
  let changed=true;
  while(changed){changed=false;
    for(let i=0;i<hand.length;i++){if(hand[i].isKerri)continue;
      for(let j=i+1;j<hand.length;j++){if(!hand[j].isKerri&&hand[i].rank===hand[j].rank){hand.splice(j,1);hand.splice(i,1);changed=true;break;}}
      if(changed)break;}}
}
function makeRoomCode(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code;do{code='';for(let i=0;i<4;i++)code+=c[randomInt(c.length)];}while(rooms[code]);return code;}
function publicPlayer(p){return {id:p.id,name:p.name,isHost:p.isHost,ready:!!p.ready,isBot:!!p.isBot,avatar:p.avatar||'eagle',cardBack:p.cardBack||'classic',disconnected:!!p.disconnected};}
function getLB(room){return Object.values(room.leaderboard||{}).sort((a,b)=>b.wins-a.wins||a.losses-b.losses);}
function sendGameState(room){
  room.players.forEach(player=>{
    if(player.isBot||player.disconnected)return;
    const opponents=room.players.filter(p=>p.id!==player.id).map(p=>({
      ...publicPlayer(p),cardCount:room.hands[p.id]?room.hands[p.id].length:0,
      isActive:room.activeIdx===room.players.findIndex(x=>x.id===p.id),
      isOut:room.hands[p.id]&&room.hands[p.id].length===0,disconnected:p.disconnected||false,
    }));
    const myHand=room.hands[player.id]||[],ap=room.players[room.activeIdx],isMT=ap&&ap.id===player.id;
    let drawFromId=null;
    if(isMT&&!paused(room)){const source=drawSource(room,player.id);drawFromId=source?source.id:null;}
    io.to(player.socketId).emit('game_state',{phase:room.phase,myHand,opponents,paused:paused(room),activePlayerId:ap?ap.id:null,isMyTurn:isMT&&!paused(room),drawFromId,roomCode:room.code,players:room.players.map(publicPlayer),log:room.log.slice(0,8),leaderboard:getLB(room),roundId:room.roundId,turnVersion:room.turnVersion,handVersion:room.handVersions[player.id],sourceVersion:drawFromId?room.handVersions[drawFromId]:null,mode:room.mode});
  });
  scheduleBot(room);
}
function sendLobbyState(room){io.to(room.code).emit('lobby_state',{roomCode:room.code,players:room.players.map(publicPlayer),phase:room.phase,leaderboard:getLB(room),mode:room.mode,isPublic:room.isPublic});}
function startGame(room){
  clearTimeout(room.botTimer);room.botTimer=null;
  room.roundId=uuidv4();room.turnVersion=0;room.handVersions={};room.actions=new Set();room.startedAt=Date.now();
  room.phase='playing';room.log=[];room.leaderboard=room.leaderboard||{};
  room.players.forEach(p=>{if(!room.leaderboard[p.id])room.leaderboard[p.id]={name:p.name,wins:0,losses:0,games:0};});
  const deck=shuffle(buildDeck(room.kerriType));room.hands={};
  room.players.forEach(p=>{room.hands[p.id]=[];room.handVersions[p.id]=0;store.metric(p.profileId,room.roundNumber?'rematch':'first_match');});
  deck.forEach((card,i)=>room.hands[room.players[i%room.players.length].id].push(card));
  room.players.forEach(p=>autoRemovePairs(room.hands[p.id]));
  room.activeIdx=room.players.findIndex(p=>room.hands[p.id].length>0);room.roundNumber=(room.roundNumber||0)+1;
  room.log.push('Raundi '+room.roundNumber+' filloi!');if(!checkGameOver(room))sendGameState(room);
}
function checkGameOver(room,forfeitId){
  if(room.phase==='gameover')return true;
  const alive=room.players.filter(p=>room.hands[p.id]&&room.hands[p.id].length>0);
  if(!forfeitId&&alive.length>1)return false;
  room.phase='gameover';let loserId=forfeitId||null;
  if(!loserId)room.players.forEach(p=>{if(room.hands[p.id]&&room.hands[p.id].some(c=>c.isKerri))loserId=p.id;});
  if(!loserId&&alive.length===1)loserId=alive[0].id;
  const loserName=room.players.find(p=>p.id===loserId)?room.players.find(p=>p.id===loserId).name:'???';
  room.log.unshift(loserName+(forfeitId?' humbi nga shkëputja.':' i ngeci Kerri!'));
  clearTimeout(room.botTimer);room.botTimer=null;
  room.players.forEach(p=>{if(!room.leaderboard[p.id])room.leaderboard[p.id]={name:p.name,wins:0,losses:0,games:0};room.leaderboard[p.id].games++;if(p.id===loserId)room.leaderboard[p.id].losses++;else room.leaderboard[p.id].wins++;});
  let persisted=false;
  try{persisted=store.recordRound({id:room.roundId,roomCode:room.code,mode:room.mode||'online',startedAt:room.startedAt,endedAt:Date.now(),loserId,forfeit:!!forfeitId,players:room.players});}
  catch(error){console.error(JSON.stringify({event:'round_save_failed',roundId:room.roundId,code:error.code||'storage'}));}
  room.players.forEach(p=>store.metric(p.profileId,'match_complete'));
  room.result={loserId,loserName,forfeit:!!forfeitId,roundId:room.roundId,persisted,mode:room.mode,players:room.players.map(publicPlayer),results:room.players.map(p=>({id:p.id,name:p.name,isBot:!!p.isBot,hasKerri:(room.hands[p.id]||[]).some(c=>c.isKerri),lost:p.id===loserId,cardCount:room.hands[p.id]?room.hands[p.id].length:0})),leaderboard:getLB(room)};
  io.to(room.code).emit('game_over',room.result);
  return true;
}
function advanceTurn(room){
  const total=room.players.length;
  let s=0;
  do{room.activeIdx=(room.activeIdx+1)%total;s++;}
  while(s<total&&(room.hands[room.players[room.activeIdx].id]||[]).length===0);
  if(s>=total){checkGameOver(room);return;}
  sendGameState(room);
}

function performDraw(room,pid,source,index){
  const player=room.players.find(p=>p.id===pid),hand=room.hands[pid];
  const card=room.hands[source.id].splice(index,1)[0];hand.push(card);
  const before=hand.length;autoRemovePairs(hand);const pairCount=(before-hand.length)/2;
  room.handVersions[pid]++;room.handVersions[source.id]++;room.turnVersion++;
  room.log.unshift(player.name+' mori një letër nga '+source.name+(pairCount?' dhe hoqi çift.':'.'));room.log.length=Math.min(room.log.length,50);
  // Only the drawer learns the drawn card. Observers receive counts, never identity.
  if(!player.isBot)io.to(player.socketId).emit('card_revealed',{drawerName:player.name,fromName:source.name,card,pairCount});
  io.to(room.code).emit('card_drawn',{drawerId:pid,drawerName:player.name,fromName:source.name,pairCount,turnVersion:room.turnVersion});
  if(!checkGameOver(room))advanceTurn(room);
}
function scheduleBot(room){
  if(room.botTimer||room.phase!=='playing'||paused(room)||!room.players[room.activeIdx]?.isBot)return;
  room.botTimer=setTimeout(()=>{
    room.botTimer=null;
    if(room.phase!=='playing'||paused(room))return;
    const player=room.players[room.activeIdx],source=drawSource(room,player.id);
    if(player.isBot&&source)performDraw(room,player.id,source,randomInt(room.hands[source.id].length));
  },900);
}
function removePlayer(room,pid){
  const player=room.players.find(p=>p.id===pid);if(!player)return;
  clearTimeout(player.disconnectTimer);delete sessions[pid];delete socketToPlayer[player.socketId];
  const socket=io.sockets.sockets.get(player.socketId);if(socket)socket.leave(room.code);
  player.disconnected=true;
  if(!room.players.some(p=>!p.disconnected&&!p.isBot)){
    clearTimeout(room.botTimer);room.players.forEach(p=>{clearTimeout(p.disconnectTimer);delete sessions[p.id];});delete rooms[room.code];return;
  }
  const activeId=room.players[room.activeIdx]?.id;
  updateHost(room);
  if(room.phase==='playing'&&(room.hands[pid]||[]).length>0)checkGameOver(room,pid);
  room.players=room.players.filter(p=>p.id!==pid);delete room.hands[pid];
  if(room.phase==='playing'){room.activeIdx=room.players.findIndex(p=>p.id===activeId);sendGameState(room);}
  else if(room.phase==='lobby')sendLobbyState(room);
  else if(room.result)io.to(room.code).emit('game_over',{...room.result,players:room.players.map(publicPlayer)});
}

io.on('connection',socket=>{
  if(!consumeLimit('connect:'+(socket.handshake?.address||socket.id),30,60000)){socket.disconnect(true);return;}
  const playerId=uuidv4();
  function resolveId(){const pid=socketToPlayer[socket.id];const sess=sessions[pid];const room=rooms[sess?sess.roomCode:null];return room&&room.players.some(p=>p.id===pid&&p.socketId===socket.id)?pid:null;}
  function error(message){socket.emit('error_msg',{message});}
  function on(event,handler){socket.on(event,data=>{
    if(!consumeLimit('events:'+socket.id,120,10000)){error('Shumë veprime. Prit pak.');return;}
    const pid=resolveId(),sess=sessions[pid];
    if(sess&&sess.expiresAt<=Date.now()){removePlayer(rooms[sess.roomCode],pid);error('Sesioni skadoi. Hyr përsëri.');return;}
    if(data===undefined)data={};
    if(!data||typeof data!=='object'||Array.isArray(data)){error('Mesazh i pavlefshëm.');return;}
    try{handler(data);}catch(err){console.error(JSON.stringify({event:'socket_handler_error',type:event,code:err.code||'invalid_state'}));error('Veprimi nuk u krye. Provo përsëri.');}
  });}
  function validName(name){return typeof name==='string'&&name.trim().length>0&&name.trim().length<=20;}
  function joined(event,player,room){socket.emit(event,{playerId:player.id,roomCode:room.code,isHost:player.isHost,sessionToken:sessions[player.id].token,expiresAt:sessions[player.id].expiresAt});}
  function addPlayer(room,name,profile,isHost){
    if(profile&&Object.values(rooms).some(r=>r.players.some(p=>p.profileId===profile.id))){error('Ky profil është në një dhomë. Rikthehu ose dil prej saj.');return false;}
    const player={id:playerId,name:name.trim(),socketId:socket.id,isHost,ready:isHost,profileId:profile?.id,avatar:profile?.avatar,cardBack:profile?.cardBack};
    room.players.push(player);sessions[playerId]={name:player.name,roomCode:room.code,token:uuidv4(),expiresAt:Date.now()+SESSION_TTL};
    socketToPlayer[socket.id]=playerId;socket.join(room.code);joined('joined',player,room);return true;
  }
  function getProfile(token){const p=token?store.authenticate(token):null;if(token&&!p)throw Error('Invalid profile');return p;}
  function createRoom({name,kerriType,profileToken},mode='online',isPublic=false){
    if(resolveId())return;
    if(!validName(name)){error('Shkruaj një emër me 1–20 karaktere.');return;}
    if(Object.keys(rooms).length>=1000){error('Serveri është plot. Provo më vonë.');return;}
    if(!consumeLimit('join:'+(socket.handshake?.address||socket.id),15,60000)){error('Shumë tentativa. Provo pas një minute.');return;}
    const profile=getProfile(profileToken),code=makeRoomCode();
    const room={code,mode,isPublic,createdAt:Date.now(),phase:'lobby',kerriType:Object.hasOwn(KERRI_CONFIGS,kerriType)?kerriType:'joker',players:[],hands:{},activeIdx:0,log:[],leaderboard:{},roundNumber:0};
    if(!addPlayer(room,name,profile,true))return;
    rooms[code]=room;
    if(mode==='practice'){
      for(let i=1;i<=2;i++)room.players.push({id:uuidv4(),name:'Bot '+i,isBot:true,ready:true,isHost:false});
      startGame(room);
    }else sendLobbyState(room);
  }
  on('create_room',data=>createRoom(data));
  function joinRoom({name,roomCode:code,profileToken}){
    if(resolveId()||!validName(name)||typeof code!=='string'){error('Kontrollo emrin dhe kodin.');return;}
    if(!consumeLimit('join:'+(socket.handshake?.address||socket.id),15,60000)){error('Shumë tentativa. Provo pas një minute.');return;}
    name=name.trim();code=code.trim().toUpperCase();
    const room=rooms[code?code.toUpperCase():null];
    if(!room){socket.emit('error_msg',{message:'Dhoma nuk u gjet!'});return;}
    if(room.phase!=='lobby'){socket.emit('error_msg',{message:'Loja ka filluar!'});return;}
    if(room.players.length>=6){socket.emit('error_msg',{message:'Dhoma eshte plot!'});return;}
    if(room.players.some(p=>p.name.toLowerCase()===(name||'').toLowerCase())){socket.emit('error_msg',{message:'Ky emer eshte i zene!'});return;}
    if(!addPlayer(room,name,getProfile(profileToken),false))return;
    sendLobbyState(room);
    io.to(code).emit('chat',{text:name+' u bashkua!',system:true});
  }
  on('join_room',joinRoom);
  on('practice',data=>createRoom(data,'practice'));
  on('quick_play',data=>{
    if(resolveId())return;
    const room=Object.values(rooms).find(r=>r.isPublic&&r.phase==='lobby'&&r.players.length<6&&!r.players.some(p=>p.name.toLowerCase()===String(data.name).trim().toLowerCase()));
    if(room)joinRoom({...data,roomCode:room.code});else createRoom(data,'online',true);
  });
  on('reconnect_session',({playerId:pid,roomCode:code,sessionToken})=>{
    if(typeof pid!=='string'||typeof code!=='string'||(resolveId()&&resolveId()!==pid))return;
    const sess=sessions[pid];
    if(!consumeLimit('reconnect:'+(socket.handshake?.address||socket.id),20,60000)||!sess||sess.expiresAt<=Date.now()||typeof sessionToken!=='string'||sess.token!==sessionToken||sess.roomCode!==code){socket.emit('reconnect_failed');return;}
    const room=rooms[sess.roomCode];
    if(!room){socket.emit('reconnect_failed');return;}
    const player=room.players.find(p=>p.id===pid);
    if(!player){socket.emit('reconnect_failed');return;}
    const oldSocket=io.sockets.sockets.get(player.socketId);
    if(oldSocket&&oldSocket.id!==socket.id){delete socketToPlayer[oldSocket.id];oldSocket.disconnect(true);}
    clearTimeout(player.disconnectTimer);player.socketId=socket.id;player.disconnected=false;sess.expiresAt=Date.now()+SESSION_TTL;
    socketToPlayer[socket.id]=pid;
    socket.join(room.code);
    joined('reconnected',player,room);
    if(room.phase==='lobby')sendLobbyState(room);else if(room.phase==='playing')sendGameState(room);
    else socket.emit('game_over',{...room.result,players:room.players.map(p=>({id:p.id,isHost:p.isHost}))});
    io.to(room.code).emit('chat',{text:player.name+' u rilidhë!',system:true});
  });
  on('set_ready',({ready})=>{
    const pid=resolveId(),room=rooms[sessions[pid]?.roomCode];if(!room||room.phase==='playing'||typeof ready!=='boolean')return;
    room.players.find(p=>p.id===pid).ready=ready;sendLobbyState(room);
    if(room.isPublic&&room.players.length>=2&&room.players.every(p=>p.ready&&!p.disconnected))startGame(room);
  });
  on('start_game',()=>{
    const pid=resolveId(),sess=sessions[pid],room=rooms[sess?sess.roomCode:null];if(!room||room.phase==='playing')return;
    const player=room.players.find(p=>p.id===pid);
    if(!player||!player.isHost){socket.emit('error_msg',{message:'Vetem hosti!'});return;}
    if(room.players.filter(p=>!p.disconnected).length<2){socket.emit('error_msg',{message:'Duhen 2+ lojtare online!'});return;}
    if(room.players.some(p=>!p.disconnected&&!p.ready)){error('Prit derisa të gjithë të jenë gati.');return;}
    room.players=room.players.filter(p=>{if(!p.disconnected)return true;clearTimeout(p.disconnectTimer);delete sessions[p.id];return false;});
    startGame(room);
  });
  function acceptAction(room,data,valid){
    if(typeof data.actionId!=='string'||data.actionId.length<8||data.actionId.length>80||data.roundId!==room.roundId||room.actions.has(data.actionId)||!valid){
      socket.emit('action_error',{message:'Gjendja ndryshoi. Zgjidh letrën përsëri.'});sendGameState(room);return false;
    }
    room.actions.add(data.actionId);if(room.actions.size>500)room.actions.delete(room.actions.values().next().value);return true;
  }
  on('draw_card',data=>{
    const {fromPlayerId,cardIndex}=data;
    const pid=resolveId(),sess=sessions[pid],room=rooms[sess?sess.roomCode:null];if(!room||room.phase!=='playing')return;
    const ap=room.players[room.activeIdx];if(!ap||ap.id!==pid){socket.emit('error_msg',{message:'Nuk eshte radha jote!'});return;}
    if(paused(room))return;
    const fp=drawSource(room,pid);if(!fp||fp.id!==fromPlayerId)return;
    const fh=room.hands[fp.id];if(!fh||fh.length===0)return;
    if(!Number.isInteger(cardIndex)||cardIndex<0||cardIndex>=fh.length)return;
    if(!acceptAction(room,data,data.turnVersion===room.turnVersion&&data.sourceVersion===room.handVersions[fp.id]))return;
    performDraw(room,pid,fp,cardIndex);
  });
  on('reorder_hand',data=>{
    const {fromIdx,toIdx}=data;
    const pid=resolveId(),sess=sessions[pid],room=rooms[sess?sess.roomCode:null];if(!room||room.phase!=='playing')return;
    const hand=room.hands[pid];if(!hand)return;
    if(!Number.isInteger(fromIdx)||!Number.isInteger(toIdx)||fromIdx<0||fromIdx>=hand.length||toIdx<0||toIdx>=hand.length)return;
    if(!acceptAction(room,data,data.handVersion===room.handVersions[pid]))return;
    const moved=hand.splice(fromIdx,1)[0];
    hand.splice(toIdx,0,moved);
    room.handVersions[pid]++;sendGameState(room);
  });
  on('chat',({text})=>{
    const pid=resolveId(),sess=sessions[pid],room=rooms[sess?sess.roomCode:null];if(!room||typeof text!=='string')return;
    const sender=room.players.find(p=>p.id===pid);
    if(!consumeLimit('chat:'+pid,5,10000)){error('Prit pak përpara mesazhit tjetër.');return;}
    const t=String(text||'').slice(0,200);if(!t.trim())return;
    io.to(room.code).emit('chat',{text:t,sender:sender?sender.name:'?'});
  });
  on('kick_player',({targetId})=>{
    const pid=resolveId(),sess=sessions[pid],room=rooms[sess?sess.roomCode:null];if(!room||room.phase!=='lobby')return;
    const host=room.players.find(p=>p.id===pid);if(!host||!host.isHost)return;
    const target=room.players.find(p=>p.id===targetId);if(!target||target.isHost)return;
    io.to(target.socketId).emit('kicked');removePlayer(room,targetId);
  });
  on('leave_room',()=>{const pid=resolveId(),room=rooms[sessions[pid]?.roomCode];if(room)removePlayer(room,pid);socket.emit('left_room');});
  on('resync_state',()=>{const room=rooms[sessions[resolveId()]?.roomCode];if(!room)return;if(room.phase==='playing')sendGameState(room);else if(room.phase==='lobby')sendLobbyState(room);else socket.emit('game_over',{...room.result,players:room.players.map(publicPlayer)});});
  socket.on('disconnect',()=>{
    const pid=resolveId();delete socketToPlayer[socket.id];
    const sess=sessions[pid];if(!sess||!sess.roomCode)return;
    const room=rooms[sess.roomCode];if(!room)return;
    const player=room.players.find(p=>p.id===pid);if(!player)return;
    {
      player.disconnected=true;room.log.unshift(player.name+' u shkëput.');
      room.log.length=Math.min(room.log.length,50);
      io.to(room.code).emit('chat',{text:player.name+' u shkëput...',system:true});
      if(room.phase==='playing'){
        sendGameState(room);
      }
      else if(room.phase==='lobby')sendLobbyState(room);
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer=setTimeout(()=>{
        if(player.disconnected)removePlayer(room,pid);
      },60000);
    }
  });
});

server.listen(PORT,()=>console.log('Kerri: http://localhost:'+PORT));
