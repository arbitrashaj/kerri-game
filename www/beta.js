var profileToken='',profile=null,pendingJoin=false,pick=null;
window.kerriSettings={sound:true,motion:false};

async function api(route,method,body){
  var response=await fetch((window.KERRI_SERVER_URL||'')+'/api/'+route,{
    method:method||'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+profileToken},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  var data=await response.json();
  if(!response.ok)throw Error(data.message||'Kërkesa dështoi.');
  return data;
}
async function ensureProfile(){
  var name=document.getElementById('home-name').value.trim();
  if(!name)throw Error('Shkruaj emrin tënd.');
  var data=await api('profile','POST',{token:profileToken||undefined,name:name});
  if(data.token){
    profileToken=data.token;
    try{localStorage.setItem('kerri_profile_token',profileToken);}catch(e){}
  }
  profile=data;myName=data.name;saveUsername(myName);applyCosmetics();
  return profile;
}
async function joinWithProfile(event,details){
  if(pendingJoin)return;
  pendingJoin=true;
  try{
    await ensureProfile();
    connectSocket(function(){sendMsg(event,Object.assign({},details,{name:myName,profileToken:profileToken}));});
  }catch(error){showError('home-error',error.message);showError('create-error',error.message);}
  finally{pendingJoin=false;}
}
function applyCosmetics(){
  if(!profile)return;
  document.body.dataset.table=profile.tableTheme;
  document.body.dataset.back=profile.cardBack;
  document.getElementById('home-avatar').textContent=({eagle:'♠',mountain:'▲',sun:'☀',crown:'♛'})[profile.avatar];
}
function openTutorial(){document.getElementById('tutorial').showModal();}
function finishTutorial(){
  document.getElementById('tutorial').close();
  try{localStorage.setItem('kerri_tutorial','done');}catch(e){}
  if(profileToken)api('metrics','POST',{event:'tutorial_complete'}).catch(function(){});
}
function saveSettings(){
  window.kerriSettings={sound:document.getElementById('sound-setting').checked,motion:document.getElementById('motion-setting').checked};
  document.body.classList.toggle('reduce-motion',window.kerriSettings.motion);
  try{localStorage.setItem('kerri_settings',JSON.stringify(window.kerriSettings));}catch(e){}
}
async function shareRoom(){
  var link=new URL(window.KERRI_SERVER_URL||location.href);
  link.search='';link.hash='';link.searchParams.set('room',roomCode);
  try{
    if(navigator.share)await navigator.share({title:'Kujt i ngec Kerri',url:link.href});
    else await navigator.clipboard.writeText(link.href);
    document.getElementById('copy-btn').textContent='Ftesa u nda';
    if(profileToken)api('metrics','POST',{event:'invite_shared'}).catch(function(){});
  }catch(error){document.getElementById('copy-btn').textContent='Kodi: '+roomCode;}
}
async function openAccount(){
  var dialog=document.getElementById('account');
  if(!dialog.open)dialog.showModal();
  document.getElementById('account-content').textContent='Duke ngarkuar…';
  document.getElementById('account-error').textContent='';
  try{
    await ensureProfile();
    var results=await Promise.all([api('social'),api('leaderboard')]),social=results[0],leaders=results[1];
    var html='<p><strong>'+escHtml(profile.name)+'</strong> · '+profile.stats.games+' raunde · '+profile.stats.xp+' XP</p>';
    html+='<p>Sot: '+profile.dailyChallenge.progress+'/3 raunde. Deri 100 XP/ditë.</p>';
    html+='<p>Kodi yt i mikut: <strong>'+escHtml(profile.friendCode)+'</strong></p>';
    html+='<p class="beta-note">Profili ruhet në këtë shfletues. Fshirja e të dhënave të tij humbet hyrjen në profil.</p>';
    html+='<h3>Pamja jote</h3>';
    var labels={avatar:'Avatar',cardBack:'Prapa letrave',tableTheme:'Tavolina'};
    Object.keys(labels).forEach(function(kind){
      html+='<label class="setting">'+labels[kind]+'<select onchange="changeCosmetic(\''+kind+'\',this.value)">';
      profile.cosmetics[kind].forEach(function(item){html+='<option value="'+item.id+'"'+(item.id===profile[kind]?' selected':'')+(!item.unlocked?' disabled':'')+'>'+item.id+(!item.unlocked?' · '+item.games+' raunde':'')+'</option>';});
      html+='</select></label>';
    });
    html+='<h3>Miqtë</h3><label for="friend-code">Kodi i mikut</label><div class="action-row"><input id="friend-code" type="text" maxlength="12"/><button class="btn" onclick="socialAction(\'friends\',{friendCode:document.getElementById(\'friend-code\').value})">Dërgo kërkesë</button></div>';
    social.incoming.forEach(function(p){html+='<p>'+escHtml(p.name)+' <button class="btn" onclick="socialAction(\'friends/accept\',{profileId:\''+escAttr(p.id)+'\'})">Prano</button></p>';});
    social.outgoing.forEach(function(p){html+='<p>'+escHtml(p.name)+' · kërkesë në pritje</p>';});
    social.friends.forEach(function(p){html+='<p>'+escHtml(p.name)+(roomCode?' <button class="btn" onclick="socialAction(\'invites\',{profileId:\''+escAttr(p.id)+'\',roomCode:roomCode})">Fto në dhomë</button>':'')+'</p>';});
    if(!social.friends.length)html+='<p>Ende nuk ke miq të shtuar.</p>';
    social.invites.forEach(function(inv){html+='<p>'+escHtml(inv.from.name)+' të fton: <button class="btn" onclick="acceptInvite(\''+escAttr(inv.roomCode)+'\')">'+escHtml(inv.roomCode)+'</button></p>';});
    html+='<h3>Raundet e fundit</h3>';
    html+=profile.history.length?'<ul>'+profile.history.map(function(r){return '<li>'+new Date(r.endedAt).toLocaleDateString('sq')+' · '+(r.mode==='practice'?'Praktikë':r.forfeit?'Ndërprerë':r.lost?'Kerri':'Doli')+' · '+r.xp+' XP</li>';}).join('')+'</ul>':'<p>Luaj raundin e parë për të parë historikun.</p>';
    html+='<h3>Renditja e pjesëmarrjes</h3><p>Raunde të përfunduara me njerëz; jo vlerësim aftësie.</p>';
    html+=leaders.length?'<ol>'+leaders.map(function(p){return '<li>'+escHtml(p.name)+' · '+p.games+' raunde</li>';}).join('')+'</ol>':'<p>Ende nuk ka raunde të renditura.</p>';
    document.getElementById('account-content').innerHTML=html;
  }catch(error){document.getElementById('account-content').textContent='';document.getElementById('account-error').textContent=error.message;}
}
async function socialAction(route,body){
  try{await api(route,'POST',body);await openAccount();if(route==='invites')document.getElementById('account-error').textContent='Ftesa u dërgua.';}
  catch(error){document.getElementById('account-error').textContent=error.message;}
}
async function changeCosmetic(kind,value){
  try{profile=await api('profile','PATCH',{[kind]:value});applyCosmetics();}
  catch(error){document.getElementById('account-error').textContent=error.message;}
}
function acceptInvite(code){
  if(roomCode){document.getElementById('account-error').textContent='Dil nga dhoma aktuale përpara se të pranosh ftesën.';return;}
  document.getElementById('account').close();document.getElementById('home-code').value=code;goJoin();
}

function openSeatZoom(el){
  if(!lastState||!lastState.isMyTurn||lastState.drawFromId!==el.dataset.id)return;
  pick={fromPlayerId:el.dataset.id,cardIndex:null,roundId:lastState.roundId,turnVersion:lastState.turnVersion,sourceVersion:lastState.sourceVersion};
  document.getElementById('pick-title').textContent='Dora e '+el.dataset.name;
  var options=document.getElementById('pick-options');options.replaceChildren();
  for(var i=0;i<Number(el.dataset.count);i++){
    var button=document.createElement('button');button.className='pick-option';button.textContent='♠ '+(i+1);
    button.dataset.index=i;button.setAttribute('aria-label','Letra e fshehur '+(i+1));button.setAttribute('aria-pressed','false');
    button.onclick=function(){
      pick.cardIndex=Number(this.dataset.index);
      options.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',String(b===this));},this);
      document.getElementById('pick-confirm').disabled=false;
    };
    options.appendChild(button);
  }
  document.getElementById('pick-confirm').disabled=true;
  document.getElementById('pick-card').showModal();
}
function closeSeatZoom(){pick=null;document.getElementById('pick-card').close();}
function commitPick(){
  if(!pick||pick.cardIndex===null||!lastState)return;
  if(pick.roundId===lastState.roundId&&pick.turnVersion===lastState.turnVersion&&pick.sourceVersion===lastState.sourceVersion)
    sendMsg('draw_card',{fromPlayerId:pick.fromPlayerId,cardIndex:pick.cardIndex});
  closeSeatZoom();
}
document.addEventListener('DOMContentLoaded',function(){
  try{
    profileToken=localStorage.getItem('kerri_profile_token')||'';
    Object.assign(window.kerriSettings,JSON.parse(localStorage.getItem('kerri_settings')||'{}'));
  }catch(e){}
  if(profileToken)api('profile').then(function(data){profile=data;applyCosmetics();}).catch(function(error){showError('home-error',error.message);});
  document.getElementById('sound-setting').checked=window.kerriSettings.sound;
  document.getElementById('motion-setting').checked=window.kerriSettings.motion;
  document.body.classList.toggle('reduce-motion',window.kerriSettings.motion);
  var code=new URLSearchParams(location.search).get('room');
  if(code&&/^[A-Z0-9]{4}$/i.test(code))document.getElementById('home-code').value=code.toUpperCase();
  document.querySelectorAll('.error-msg').forEach(function(el){el.setAttribute('role','alert');});
  document.getElementById('chat-input').setAttribute('aria-label','Mesazhi');
  document.getElementById('chat-toggle-btn').setAttribute('aria-label','Hap ose mbyll bisedën');
  document.getElementById('lb-toggle-btn').setAttribute('aria-label','Renditja e dhomës');
});
document.addEventListener('visibilitychange',function(){
  if(document.hidden){if(audioCtx)audioCtx.suspend();return;}
  if(audioCtx&&window.kerriSettings.sound)audioCtx.resume().catch(function(){});
  if(socket&&socket.connected)sendMsg('resync_state');
});
