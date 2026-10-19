// Local Chrome smoke test. Uses an isolated temporary profile and an in-memory server.
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const net=require('node:net');
const root=path.resolve(__dirname,'..');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function port(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function main(){
  const webPort=await port(),debugPort=await port();
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kerri-chrome-'));
  const chromePath=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(webPort),KERRI_DB:':memory:',ANALYTICS_ENABLED:'true'},stdio:['ignore','pipe','pipe']});
  const errors=[];server.stderr.on('data',b=>errors.push(b.toString()));
  let chrome,ws;
  try{
    await once(server.stdout,'data');
    chrome=spawn(chromePath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${temp}`,'about:blank'],{stdio:'ignore',windowsHide:true});
    let info;
    for(let n=0;n<100;n++){try{info=await fetch(`http://127.0.0.1:${debugPort}/json/version`).then(r=>r.json());break;}catch{await delay(100);}}
    assert.ok(info,'Chrome debugging endpoint must start');
    ws=new WebSocket(info.webSocketDebuggerUrl);await once(ws,'open');
    const pending=new Map();let nextId=0;
    ws.addEventListener('message',({data})=>{
      const message=JSON.parse(data);
      if(message.id){const call=pending.get(message.id);if(call){pending.delete(message.id);message.error?call.reject(Error(message.error.message)):call.resolve(message.result);}}
      else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text+': '+message.params.exceptionDetails.exception?.description);
      else if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')errors.push(message.params.entry.text+' '+(message.params.entry.url||''));
    });
    function cdp(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,sessionId}));});}
    async function page(width,height){
      const {browserContextId}=await cdp('Target.createBrowserContext');
      const {targetId}=await cdp('Target.createTarget',{url:'about:blank',browserContextId});
      const {sessionId}=await cdp('Target.attachToTarget',{targetId,flatten:true});
      const call=(method,params)=>cdp(method,params,sessionId);
      await call('Runtime.enable');await call('Log.enable');await call('Page.enable');
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
      const wait=async expression=>{for(let n=0;n<100;n++){try{if(await evaluate(expression))return;}catch{}await delay(100);}throw Error('Browser wait failed: '+expression);};
      const click=async selector=>{
        const {root:doc}=await call('DOM.getDocument');
        const {nodeId}=await call('DOM.querySelector',{nodeId:doc.nodeId,selector});
        if(nodeId)await call('DOM.scrollIntoViewIfNeeded',{nodeId});
        const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
        assert.ok(point,`Clickable: ${selector}`);
        await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
        await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
      };
      const fill=async(selector,text)=>{await click(selector);await call('Input.insertText',{text});};
      await call('Page.navigate',{url:`http://127.0.0.1:${webPort}`});
      await wait('document.readyState==="complete"');
      return {call,evaluate,wait,click,fill};
    }
    const host=await page(1280,800),guest=await page(390,844);
    await host.fill('#home-name','Browser Host');await host.click('[onclick="goCreate()"]');await host.click('[onclick="createRoom()"]');
    await host.wait('!!roomCode');const code=await host.evaluate('roomCode');
    await guest.fill('#home-name','Browser Guest');await guest.fill('#home-code',code);await guest.click('[onclick="goJoin()"]');
    await guest.wait('document.getElementById("phase-lobby").classList.contains("active")');
    await host.click('#phase-lobby [onclick="openAccount()"]');
    await host.wait('!!document.getElementById("friend-code")');
    const friendCode=await host.evaluate('profile.friendCode');
    await host.click('#account > button');
    await guest.click('#phase-lobby [onclick="openAccount()"]');await guest.wait('!!document.getElementById("friend-code")');
    await guest.fill('#friend-code',friendCode);await guest.click('#account button[onclick^="socialAction"]');
    await guest.wait('document.getElementById("account-content").textContent.includes("kërkesë në pritje")');await guest.click('#account > button');
    await host.click('#phase-lobby [onclick="openAccount()"]');await host.wait('!!document.querySelector('+JSON.stringify('#account button[onclick*="friends/accept"]')+')');
    await host.click('#account button[onclick*="friends/accept"]');
    await host.wait('!!document.querySelector('+JSON.stringify('#account button[onclick*="invites"]')+')');
    await host.click('#account button[onclick*="invites"]');await host.wait('document.getElementById("account-error").textContent.includes("Ftesa u dërgua")');await host.click('#account > button');
    await guest.click('#ready-btn');await host.wait('!document.getElementById("start-btn").disabled');await host.click('#start-btn');
    await host.wait('!!lastState');await guest.wait('!!lastState');
    await delay(350);
    assert.equal(await guest.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'Phone must not overflow horizontally');
    const artifacts=path.join(root,'artifacts');fs.mkdirSync(artifacts,{recursive:true});
    for(const [name,p] of [['desktop',host],['phone',guest]]){
      const shot=await p.call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifacts,name+'.png'),Buffer.from(shot.data,'base64'));
    }
    // Drive the real two-step controls until the round finishes.
    for(let turn=0;turn<1000;turn++){
      if(await host.evaluate('document.getElementById("phase-gameover").classList.contains("active")'))break;
      const p=await host.evaluate('!!lastState?.isMyTurn')?host:guest;
      await p.wait('!!lastState?.isMyTurn');
      const version=await p.evaluate('lastState.turnVersion');
      await p.click('.seat-cards[role="button"]');await p.wait('document.getElementById("pick-card").open');
      await p.click('.pick-option');
      assert.equal(await p.evaluate('lastState.turnVersion'),version,'Selecting alone must not draw');
      await p.click('#pick-confirm');
      await p.wait(`!lastState||lastState.turnVersion>${version}`);
      if(turn===999)throw Error('Round did not terminate');
    }
    await host.wait('document.getElementById("phase-gameover").classList.contains("active")');
    await host.call('Page.reload');await host.wait('document.getElementById("phase-gameover").classList.contains("active")');
    await host.click('[onclick="playAgain()"]');await host.wait('!!lastState');
    await host.click('.leave-game-btn');await host.wait('document.getElementById("phase-home").classList.contains("active")');
    await host.click('[onclick="openAccount()"]');await host.wait('document.getElementById("account-content").textContent.includes("10 XP")');
    await host.click('#account > button');
    await host.click('[onclick="joinWithProfile(\'practice\')"]');await host.wait('lastState?.mode==="practice"');
    assert.equal(await host.evaluate('lastState.opponents.every(p=>p.isBot)'),true);
    await delay(350);
    const practiceShot=await host.call('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(artifacts,'practice.png'),Buffer.from(practiceShot.data,'base64'));
    await delay(1200);
    assert.deepEqual(errors,[],'Browser and server must have no errors');
    console.log('Browser checks passed: desktop/phone, friends/invites, readiness, two-step draw, full round, refresh, rematch, profile XP, practice. Screenshots: artifacts/.');
  }finally{
    if(ws)ws.close();if(chrome)chrome.kill();server.kill();
    // Chrome profile is isolated under the OS temp directory; retain it for failure diagnosis.
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
