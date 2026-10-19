var socket=null,myId=null,myName="",roomCode=null,isHost=false,sessionToken=null;
var lastState=null,myReady=false;
var RED_SUITS={"\u2665":true,"\u2666":true};

var AudioCtx=window.AudioContext||window.webkitAudioContext;
var audioCtx=null;
function getAC(){if(!audioCtx)audioCtx=new AudioCtx();return audioCtx;}
function playTone(freq,type,dur,vol,delay){
  if(window.kerriSettings&&!window.kerriSettings.sound)return;
  vol=vol||0.15;delay=delay||0;
  try{var ctx=getAC(),osc=ctx.createOscillator(),g=ctx.createGain();
  osc.connect(g);g.connect(ctx.destination);osc.type=type;
  osc.frequency.setValueAtTime(freq,ctx.currentTime+delay);
  g.gain.setValueAtTime(vol,ctx.currentTime+delay);
  g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+dur);
  osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+dur+.05);}catch(e){}}
var SFX={
  cardDraw:function(){playTone(440,"sine",.08,.15);playTone(520,"sine",.06,.10,.05);},
  myTurn:function(){playTone(660,"sine",.12,.20);playTone(880,"sine",.10,.15,.08);},
  win:function(){[523,659,784,1047].forEach(function(f,i){playTone(f,"sine",.2,.18,i*.1);});},
  lose:function(){[300,250,200].forEach(function(f,i){playTone(f,"sawtooth",.25,.18,i*.12);});},
  chat:function(){playTone(880,"sine",.07,.08);},
  join:function(){playTone(600,"sine",.10,.12);playTone(750,"sine",.08,.10,.07);},
  error:function(){playTone(300,"square",.15,.15);}
};

function loadSavedUsername(){try{var s=localStorage.getItem("kerri_username");if(s){document.getElementById("home-name").value=s;updateAvatar(s);}}catch(e){}}
function saveUsername(n){try{localStorage.setItem("kerri_username",n);}catch(e){}updateAvatar(n);}
function updateAvatar(n){var a=document.getElementById("home-avatar");if(a&&n)a.textContent=n.charAt(0).toUpperCase();}

function saveSession(){try{if(myId&&roomCode)localStorage.setItem("kerri_session",JSON.stringify({myId:myId,roomCode:roomCode,myName:myName,isHost:isHost,sessionToken:sessionToken}));}catch(e){}}
function clearSession(){try{localStorage.removeItem("kerri_session");}catch(e){}}
function getSavedSession(){try{return JSON.parse(localStorage.getItem("kerri_session"));}catch(e){return null;}}

function connectSocket(cb){
  if(socket&&socket.connected){cb();return;}
  if(socket){socket.off();socket.disconnect();}
  socket=io(window.KERRI_SERVER_URL||undefined,{transports:["websocket","polling"]});
  var firstConnect=true;
  socket.on("connect",function(){
    if(firstConnect){firstConnect=false;cb();return;}
    var sess=getSavedSession();
    if(sess)socket.emit("reconnect_session",{playerId:sess.myId,roomCode:sess.roomCode,sessionToken:sess.sessionToken});
    else document.getElementById("reconnect-banner").style.display="none";
  });
  socket.on("disconnect",function(){document.getElementById("reconnect-banner").style.display="flex";});
  socket.on("joined",handleJoined);
  socket.on("reconnected",handleJoined);
  socket.on("reconnect_failed",function(){clearSession();myId=null;sessionToken=null;document.getElementById("reconnect-banner").style.display="none";showPhase("home");});
  socket.on("lobby_state",renderLobby);
  socket.on("game_state",renderGame);
  socket.on("action_error",function(msg){closeDrawModal();closeSeatZoom();document.getElementById("game-msg").textContent=msg.message;});
  socket.on("connect_error",function(){showError("home-error","Nuk u lidhëm me serverin. Kontrollo internetin dhe provo përsëri.");});
  socket.on("card_revealed",showCardReveal);
  socket.on("game_over",renderGameOver);
  socket.on("chat",function(msg){appendChat(msg);if(!msg.system)SFX.chat();});
  socket.on("kicked",function(){clearSession();showPhase("home");showError("home-error","U hoqe nga dhoma.");});
  socket.on("error_msg",function(msg){showError("home-error",msg.message);showError("create-error",msg.message);document.getElementById("game-msg").textContent=msg.message;SFX.error();});
}
function sendMsg(type,data){
  if(!socket||!socket.connected)return;
  data=data||{};
  if(type==='draw_card'||type==='reorder_hand'){
    if(!lastState)return;
    data=Object.assign({},data,{roundId:lastState.roundId,turnVersion:lastState.turnVersion,
      sourceVersion:lastState.sourceVersion,handVersion:lastState.handVersion,
      actionId:Array.from(crypto.getRandomValues(new Uint8Array(16)),function(n){return n.toString(16).padStart(2,'0');}).join('')});
  }
  socket.emit(type,data);
}

function handleJoined(msg){
  myId=msg.playerId;isHost=msg.isHost;roomCode=msg.roomCode;sessionToken=msg.sessionToken;
  document.getElementById("reconnect-banner").style.display="none";
  saveSession();showPhase("lobby");SFX.join();
}

function goCreate(){
  var name=document.getElementById("home-name").value.trim();
  if(!name){showError("home-error","Shkruaj emrin tend!");SFX.error();return;}
  myName=name;saveUsername(name);hideError("home-error");showPhase("create");
}
function goJoin(){
  var name=document.getElementById("home-name").value.trim();
  var code=document.getElementById("home-code").value.trim().toUpperCase();
  if(!name){showError("home-error","Shkruaj emrin tend!");SFX.error();return;}
  if(code.length!==4){showError("home-error","Kodi duhet 4 karaktere!");SFX.error();return;}
  myName=name;saveUsername(name);hideError("home-error");
  joinWithProfile('join_room',{roomCode:code});
}
function createRoom(){
  var el=document.querySelector("input[name=kerri]:checked");
  var kerriType=el?el.value:"joker";
  joinWithProfile('create_room',{kerriType:kerriType});
}

function renderLobby(msg){
  myReady=!!msg.players.find(function(p){return p.id===myId;})?.ready;
  document.getElementById('ready-btn').textContent=myReady?'Nuk jam gati':'Jam gati';
  syncHost(msg.players);
  showPhase("lobby");
  document.getElementById("lobby-code").textContent=msg.roomCode;
  document.getElementById("lobby-count").textContent=msg.players.length;
  document.getElementById("lobby-players").innerHTML=msg.players.map(function(p){
    var isMe=p.id===myId;
    var kick=isHost&&!p.isHost&&!isMe
      ? "<button class=\"kick-btn\" onclick=\"kickPlayer('"+escAttr(p.id)+"')\">Ηiq</button>"
      : "";
    var meLabel=isMe?" <span style=\"color:var(--hint);font-size:11px\">(ti)</span>":"";
    var hostBadge="<span class=\"host-badge\">"+(p.isHost?'Host · ':'')+(p.ready?'Gati':'Duke pritur')+"</span>";
    var dot="<div class=\"player-dot "+(p.disconnected?"offline":"")+"\"></div>";
    return "<div class=\"lobby-player-row\">"+dot+"<div class=\"player-name-col\">"+escHtml(p.name)+meLabel+"</div>"+hostBadge+kick+"</div>";
  }).join("");
  if(msg.leaderboard&&msg.leaderboard.length>0){
    document.getElementById("lobby-lb-wrap").style.display="block";
    document.getElementById("lobby-leaderboard").innerHTML=renderLbRows(msg.leaderboard);
  }
  var ha=document.getElementById("lobby-host-area"),wa=document.getElementById("lobby-wait-area");
  if(isHost){ha.style.display="block";wa.style.display="none";document.getElementById("start-btn").disabled=msg.players.filter(function(p){return !p.disconnected;}).length<2||msg.players.some(function(p){return !p.disconnected&&!p.ready;});}
  else{ha.style.display="none";wa.style.display="block";}
}
function startGame(){sendMsg("start_game");}
function toggleReady(){sendMsg('set_ready',{ready:!myReady});}
function kickPlayer(id){sendMsg("kick_player",{targetId:id});}
function copyCode(){
  if(!navigator.clipboard){document.getElementById("copy-btn").textContent="Kodi: "+roomCode;return;}
  navigator.clipboard.writeText(document.getElementById("lobby-code").textContent).then(function(){
    var b=document.getElementById("copy-btn");b.innerHTML="✓ Kopjuar!";
    setTimeout(function(){b.innerHTML="⧉ Kopjo";},2000);
  }).catch(function(){document.getElementById("copy-btn").textContent="Kodi: "+roomCode;});
}

var prevMyTurn=false;
var lastHandData=null;
function renderGame(state){
  lastState=state;
  syncHost(state.players);closeDrawModal();closeSeatZoom();
  showPhase("game");
  var ap=null;
  for(var i=0;i<state.players.length;i++){if(state.players[i].id===state.activePlayerId){ap=state.players[i];break;}}
  var isMT=state.isMyTurn;
  if(isMT&&!prevMyTurn)SFX.myTurn();
  prevMyTurn=isMT;
  var tc=document.getElementById("chip-turn");
  tc.textContent=isMT?"🎯 Radha jote!":"Radha e: "+(ap?ap.name:"—");
  tc.className="chip"+(isMT?" my-turn":"");
  document.getElementById("chip-room").textContent=state.mode==='practice'?'Bots · pa XP':'♠ '+state.roomCode;
  var nc=document.getElementById("my-name-chip");if(nc&&myName)nc.textContent=myName;
  renderMsg(state);renderSeats(state);
  var newHand=state.myHand;
  lastHandData=newHand.slice();
  selectedCardIdx=null;
  renderMyHand(lastHandData);
  var gl=document.getElementById("game-log");if(gl)gl.innerHTML=(state.log||[]).map(function(l){return "<div class='log-item'>"+escHtml(l)+"</div>";}).join("");
  if(document.getElementById("lb-panel").style.display!=="none")renderLbPanel(state.leaderboard);
}
function renderMsg(state){
  var m=document.getElementById("game-msg");
  if(state.paused){m.className="msg-box warn";m.textContent="Lojë në pauzë: presim rilidhjen e lojtarit (deri 60 sekonda).";return;}
  var df=null;
  if(state.opponents){for(var i=0;i<state.opponents.length;i++){if(state.opponents[i].id===state.drawFromId){df=state.opponents[i];break;}}}
  if(!state.myHand||state.myHand.length===0){m.className="msg-box success";m.textContent="✅ Bravo! Ke dalët!";}
  else if(state.isMyTurn&&df){m.className="msg-box";m.textContent="🎯 Radha jote! Kliko kartolat e \""+df.name+"\".";}
  else if(state.isMyTurn){m.className="msg-box success";m.textContent="✅ Prit radhën.";}
  else{var a=null;if(state.players){for(var i=0;i<state.players.length;i++){if(state.players[i].id===state.activePlayerId){a=state.players[i];break;}}}m.className="msg-box warn";m.textContent="⏳ "+(a?a.name:"—")+" po luan...";}
}
function renderOpponents(state){
  var area=document.getElementById("opponents-area");area.innerHTML="";
  state.opponents.forEach(function(opp){
    var iD=state.isMyTurn&&opp.id===state.drawFromId&&opp.cardCount>0;
    var row=document.createElement("div");row.className="opp-row";
    var cards="";
    for(var i=0;i<opp.cardCount;i++){
      var cls="card-back "+(opp.disconnected?"disc":iD?"drawable":"not-my-turn");
      var clk=iD?" onclick=\"openDrawModal('"+escAttr(opp.id)+"','"+escAttr(opp.name)+"',"+opp.cardCount+")\"":" ";
      cards+="<div class=\""+cls+"\""+clk+">♠</div>";
    }
    var discTag=opp.disconnected?"<span class=\"disc-tag\">shkëputur</span>":"";
    var outBadge=opp.isOut?"<span class=\"badge badge-out\">✓</span>":"";
    row.innerHTML="<div class=\"opp-info\"><div class=\"opp-name\">"+escHtml(opp.name)+discTag+outBadge+"</div><div class=\"opp-meta\">"+opp.cardCount+" letra</div></div><div class=\"opp-cards\">"+cards+"</div>";
    area.appendChild(row);
  });
}
function buildCard(card,i,cls,st){
  var h="<button type='button' aria-label='"+escAttr(card.rank+' '+card.suit)+"' class='"+ cls +"' data-idx='"+ i +"' onclick='cardTap("+ i +")' style='"+ st +"'>";
  h+="<div class='card-corner card-tl'><div class='rank'>"+card.rank+"</div><div class='suit-sm'>"+card.suit+"</div></div>";
  h+="<div class='card-center-suit'>"+card.suit+"</div>";
  h+="<div class='card-corner card-br'><div class='rank'>"+card.rank+"</div><div class='suit-sm'>"+card.suit+"</div></div>";
  h+="</button>";return h;
}
var prevHandIds=[];
var selectedCardIdx=null;
function renderMyHand(hand){
  var c=document.getElementById("my-hand"),cnt=document.getElementById("my-hand-count");
  if(!hand||hand.length===0){c.innerHTML="✓ Ke dalët";if(cnt)cnt.textContent="";prevHandIds=[];selectedCardIdx=null;return;}
  if(cnt)cnt.textContent=hand.length;
  var newIds=hand.map(function(c,i){return c.id+"-"+i;});
  var isNew=hand.length>prevHandIds.length;
  var n=hand.length;
  var maxAngle=Math.min(30,n*3);
  c.innerHTML=hand.map(function(card,i){
    var cls="playing-card"+(card.isKerri?" kerri-card":RED_SUITS[card.suit]?" red-card":" black-card");
    if(isNew&&i===hand.length-1)cls+=" just-drawn";
    if(i===selectedCardIdx)cls+=" selected-card";
    var angle=n>1?(i/(n-1)-0.5)*maxAngle:0;
    var lift=n>1?Math.abs(angle)*1.1-18:0;
    var sel=i===selectedCardIdx?" translateY(-16px)":"";
    var cardStyle="transform:rotate("+angle+"deg) translateY("+lift+"px)"+sel+";transform-origin:bottom center";
    return buildCard(card,i,cls,cardStyle);
  }).join("");
  prevHandIds=newIds;
  requestAnimationFrame(function(){
    var cards=c.querySelectorAll(".playing-card");
    if(cards.length>1){
      var cw=cards[0].offsetWidth;
      var avail=(c.clientWidth||window.innerWidth)-64;
      var totalNoOverlap=cw*cards.length;
      var overlap=0;
      if(totalNoOverlap>avail){
        overlap=(totalNoOverlap-avail)/(cards.length-1);
        var maxOverlap=cw*0.7;
        if(overlap>maxOverlap)overlap=maxOverlap;
      }
      for(var i=1;i<cards.length;i++){cards[i].style.marginLeft="-"+overlap+"px";}
    }
  });
}
function cardTap(idx){
  if(selectedCardIdx===null){
    selectedCardIdx=idx;
    renderMyHand(lastHandData);
  }else if(selectedCardIdx===idx){
    selectedCardIdx=null;
    renderMyHand(lastHandData);
  }else{
    var fromI=selectedCardIdx,toI=idx;
    selectedCardIdx=null;
    sendMsg("reorder_hand",{fromIdx:fromI,toIdx:toI});
  }
}
function openDrawModal(fId,fName,cnt){
  document.getElementById("modal-title").textContent="Dora e "+fName;
  var idx=[];for(var i=0;i<cnt;i++)idx.push(i);for(var i=idx.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=idx[i];idx[i]=idx[j];idx[j]=t;}
  var html="";
  for(var k=0;k<idx.length;k++){
    html+="<div class=\"playing-card drawable-card black-card\" onclick=\"confirmDraw('"+escAttr(fId)+"',"+idx[k]+")\"><div class=\"rank\">♠</div><div class=\"suit\" style=\"font-size:11px\">"+(k+1)+"</div></div>";
  }
  document.getElementById("modal-cards").innerHTML=html;
  document.getElementById("draw-modal").style.display="flex";
}
function showCardReveal(data){
  var card=data.card;
  var isKerri=card.isKerri;
  var colorCls=isKerri?"kerri":RED_SUITS[card.suit]?"red":"black";
  var ov=document.createElement("div");ov.className="reveal-overlay";
  ov.innerHTML="<div class=\"reveal-card-wrap\"><div class=\"reveal-card "+(isKerri?"kerri":"normal")+" "+colorCls+"\"><div class=\"reveal-rank\">"+card.rank+"</div><div class=\"reveal-suit\">"+card.suit+"</div></div><div class=\"reveal-label\">"+escHtml(data.drawerName)+" mori nga "+escHtml(data.fromName)+"</div></div>";
  document.body.appendChild(ov);
  if(isKerri)SFX.lose();else SFX.cardDraw();
  setTimeout(function(){ov.remove();},1300);
}
function renderSeats(state){
  var area=document.getElementById("seats-area");if(!area)return;area.innerHTML="";
  area.dataset.count=state.opponents.length;
  state.opponents.forEach(function(opp,si){
    var iD=state.isMyTurn&&opp.id===state.drawFromId&&opp.cardCount>0;
    var av="seat-avatar"+(iD?" active-seat":opp.isOut?" out-seat":opp.disconnected?" disc-seat":"");
    var n=opp.cardCount;
    var cards="";
    for(var k=0;k<n;k++){
      var cc="seat-card-back"+(opp.disconnected?" disc-card":iD?" drawable-seat":"");
      cards+="<div class='"+ cc +"'>&#9824;</div>";
    }
    var lbl=opp.isOut?"<span style='color:var(--green)'>&#10003;</span>":"&#127136;"+n;
    var seat=document.createElement("div");seat.className="seat";seat.id="seat-"+escAttr(opp.id);
    seat.dataset.back=opp.cardBack||'classic';
    var scAttrs=iD?" role='button' tabindex='0' aria-label='Zgjidh nga "+escAttr(opp.name)+"' data-id='"+escAttr(opp.id)+"' data-name='"+escAttr(opp.name)+"' data-count='"+n+"' onclick='openSeatZoom(this)' onkeydown='if(event.key===\"Enter\"||event.key===\" \"){event.preventDefault();openSeatZoom(this)}' style='cursor:pointer'":"";
    var avatar=({eagle:'♠',mountain:'▲',sun:'☀',crown:'♛'})[opp.avatar]||opp.name.charAt(0).toUpperCase();
    seat.innerHTML="<div class='"+ av +"'>"+escHtml(avatar)+"</div><div class='seat-name'>"+escHtml(opp.name)+(opp.isBot?' · Bot':'')+"</div><div class='seat-cards'"+scAttrs+">"+cards+"</div><div style='font-size:10px;color:var(--hint);text-align:center'>"+lbl+"</div>";
    area.appendChild(seat);
  });
  requestAnimationFrame(function(){
    var groups=area.querySelectorAll(".seat-cards");
    groups.forEach(function(g){
      var kids=g.querySelectorAll(".seat-card-back");
      if(kids.length>1){
        var cw=kids[0].offsetWidth;
        var avail=g.clientWidth||70;
        var totalNoOverlap=cw*kids.length;
        var overlap=2;
        if(totalNoOverlap>avail){
          overlap=(totalNoOverlap-avail)/(kids.length-1);
          var maxOverlap=cw*0.82;
          if(overlap>maxOverlap)overlap=maxOverlap;
        }
        for(var i=1;i<kids.length;i++){kids[i].style.marginLeft="-"+overlap+"px";}
      }
    });
  });
}
function confirmDraw(fId,idx){sendMsg("draw_card",{fromPlayerId:fId,cardIndex:idx});SFX.cardDraw();closeDrawModal();}
function closeDrawModal(){document.getElementById("draw-modal").style.display="none";}
function handleModalOutsideClick(e){if(e.target===document.getElementById("draw-modal"))closeDrawModal();}

function renderLbRows(lb){
  if(!lb||lb.length===0)return "<div style=\"font-size:13px;color:var(--hint)\">Ende nuk ka lojëra.</div>";
  var medals=["🥇","🥈","🥉"];
  var m=["gold","silver","bronze"];
  return lb.map(function(p,i){
    var rank=medals[i]||(i+1);
    return "<div class=\"lb-row\"><div class=\"lb-rank "+(m[i]||"")+"\">"+rank+"</div><div class=\"lb-name\">"+escHtml(p.name)+"</div><div class=\"lb-stats\"><span class=\"lb-win\">"+p.wins+"W</span><span class=\"lb-loss\">"+p.losses+"L</span></div></div>";
  }).join("");
}
function toggleLeaderboard(){
  var p=document.getElementById("lb-panel"),open=p.style.display==="none";
  p.style.display=open?"block":"none";
  if(open)document.getElementById("side-panels").classList.add("open");
  document.getElementById("lb-toggle-btn").textContent=open?"✕":"🏆";
}
function renderLbPanel(lb){document.getElementById("lb-content").innerHTML=renderLbRows(lb);}

function renderGameOver(msg){
  lastState=null;
  syncHost(msg.players);closeDrawModal();closeSeatZoom();lastHandData=null;prevMyTurn=false;selectedCardIdx=null;
  showPhase("gameover");
  var isMe=msg.loserId===myId;
  document.getElementById("go-emoji").textContent=isMe?"😱":"🎉";
  document.getElementById("go-loser").textContent=msg.loserName;
  document.getElementById("go-sub").textContent=isMe?"Ty të ngeci Kerri!":"I ngeci Kerri!";
  if(msg.forfeit)document.getElementById("go-sub").textContent="Humbi për shkak të shkëputjes.";
  if(msg.mode==='practice')document.getElementById('go-sub').textContent+=' Praktikë me bots · pa XP.';
  else if(!msg.persisted)document.getElementById('go-sub').textContent+=' Rezultati nuk u ruajt.';
  if(isMe)SFX.lose();else SFX.win();
  document.getElementById("go-results").innerHTML=msg.results.map(function(r){
    var bc,bt;
    if(r.hasKerri){bc="badge-kerri";bt="★ Kerri";}
    else if(r.cardCount===0){bc="badge-out";bt="✓ Doli";}
    else{bc="badge-safe";bt=r.cardCount+" letra";}
    return "<div class=\"result-row\"><span>"+escHtml(r.name)+"</span><span class=\"badge "+bc+"\">"+bt+"</span></div>";
  }).join("");
  var lbc=document.getElementById("go-lb-card");
  if(msg.leaderboard&&msg.leaderboard.length>0){lbc.style.display="block";document.getElementById("go-leaderboard").innerHTML=renderLbRows(msg.leaderboard);}
  else lbc.style.display="none";
  if(isHost){document.getElementById("go-host-btns").style.display="block";document.getElementById("go-wait-btns").style.display="none";}
  else{document.getElementById("go-host-btns").style.display="none";document.getElementById("go-wait-btns").style.display="block";}
}
function playAgain(){sendMsg("start_game");}
function leaveGame(){
  sendMsg('leave_room');clearSession();lastState=null;lastHandData=null;myId=null;roomCode=null;sessionToken=null;
  closeDrawModal();closeSeatZoom();showPhase('home');
}

function toggleChatPanel(){
  var sp=document.getElementById("side-panels");if(!sp)return;
  sp.classList.toggle("open");
}
function sendChat(){
  var inp=document.getElementById("chat-input"),text=inp.value.trim();
  if(!text)return;sendMsg("chat",{text:text});inp.value="";
}
function appendChat(msg){
  var area=document.getElementById("chat-messages");if(!area)return;
  var div=document.createElement("div");
  if(msg.system){div.className="chat-msg system";div.textContent=msg.text;}
  else{div.className="chat-msg";div.innerHTML="<span class=\"chat-sender\">"+escHtml(msg.sender)+":</span> "+escHtml(msg.text);}
  area.appendChild(div);while(area.children.length>100)area.removeChild(area.firstChild);area.scrollTop=area.scrollHeight;
}

function showPhase(id){
  document.querySelectorAll(".phase").forEach(function(p){p.classList.remove("active");});
  var el=document.getElementById("phase-"+id);if(el)el.classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
}
function showError(id,msg){var el=document.getElementById(id);if(!el)return;el.textContent=msg;el.style.display="block";}
function hideError(id){var el=document.getElementById(id);if(el)el.style.display="none";}
function escHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function escAttr(s){return escHtml(s).replace(/'/g,"&#39;");}
function syncHost(players){var me=(players||[]).find(function(p){return p.id===myId;});if(me){isHost=!!me.isHost;saveSession();}}

document.addEventListener("DOMContentLoaded",function(){
  loadSavedUsername();
  var ni=document.getElementById("home-name");
  if(ni)ni.addEventListener("input",function(e){updateAvatar(e.target.value);});
  document.querySelectorAll(".kerri-opt").forEach(function(opt){
    opt.addEventListener("click",function(){
      document.querySelectorAll(".kerri-opt").forEach(function(o){o.classList.remove("selected");});
      opt.classList.add("selected");opt.querySelector("input").checked=true;
    });
  });
  try{
    var sess=getSavedSession();
    if(sess&&sess.myId&&sess.roomCode){
      myId=sess.myId;myName=sess.myName||"";isHost=sess.isHost||false;roomCode=sess.roomCode;
      document.getElementById("reconnect-banner").style.display="flex";
      connectSocket(function(){sendMsg("reconnect_session",{playerId:sess.myId,roomCode:sess.roomCode,sessionToken:sess.sessionToken});});
    }
  }catch(e){clearSession();}
});
