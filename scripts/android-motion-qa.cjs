const fs=require('node:fs');
const {execFileSync,spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const pkg='com.balnc.audioddesk', dir='motion-qa';
fs.mkdirSync(dir,{recursive:true});
const results=[], errors=[];
const apiLevel=Number(execFileSync('adb',['shell','getprop','ro.build.version.sdk'],{encoding:'utf8'}).trim());
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:45000,maxBuffer:32*1024*1024});
const screenshot=name=>fs.writeFileSync(dir+'/'+name+'.png',execFileSync('adb',['exec-out','screencap','-p'],{timeout:15000,maxBuffer:16*1024*1024}));
async function poll(fn,ms=30000){
 const end=Date.now()+ms;let last;
 while(Date.now()<end){try{const v=await fn();if(v)return v;}catch(e){last=e;}await sleep(400);}
 throw Error('Timed out: '+(last?.message||fn.toString().slice(0,150)));
}
async function connect(){
 const pid=await poll(()=>adb('shell','pidof',pkg).trim().split(' ')[0]);
 adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+pid);
 const target=await poll(async()=>{
  const list=await (await fetch('http://127.0.0.1:9222/json/list',{signal:AbortSignal.timeout(3000)})).json();
  return list.find(t=>t.url.includes('/assets/index.html'));
 });
 const ws=new WebSocket(target.webSocketDebuggerUrl);let id=0;const pending=new Map();
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',e=>{
  const m=JSON.parse(e.data);
  if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
  if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.description||m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
 });
 function call(method,params={}){
  return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout '+method));},12000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
 }
 async function evaluate(expression){
  const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result.value;
 }
 await call('Runtime.enable');
 await poll(()=>evaluate('typeof setLauncherTheme==="function" && typeof setLauncherPage==="function" && !!window.AudioDesk'));
 return {evaluate,call,close:()=>ws.close()};
}

const theme=process.env.MOTION_THEME;
assert.ok(['minimal','warm','pixel','windows','extreme','orbit'].includes(theme));
let c;
const steps=[];
function note(name,status,detail){steps.push({name,status,detail,time:new Date().toISOString()});console.log(status,name,detail||'');}
async function step(name,fn){try{await fn();note(name,'passed')}catch(e){note(name,'failed',String(e.stack||e));try{if(!foreground()){adb('shell','input','keyevent','3');await sleep(900);if(c)c.close();c=await connect();}await closeMenus();await home();}catch(recovery){note(name+'-recovery','failed',String(recovery));}}}
function foreground(){return adb('shell','dumpsys','activity','activities').split('\n').some(l=>/mResumedActivity|topResumedActivity/.test(l)&&l.includes(pkg));}
async function evalJS(x){return c.evaluate(x)}
const visible=s=>'(()=>{const e=document.querySelector('+JSON.stringify(s)+');return !!e&&!e.closest("[hidden]")&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=="hidden"})()';
async function target(s){const p=await evalJS('(()=>{const e=document.querySelector('+JSON.stringify(s)+');if(!e||!e.getClientRects().length||e.closest("[hidden]"))return null;e.scrollIntoView({block:"nearest"});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()');assert.ok(p,'Missing target '+s);return p}
async function gesture(a,b=a,duration=90){
 assert.ok(foreground(),'Launcher is not the foreground activity; refusing to tap external UI');
 // Use the actual Android input service; CDP touch dispatch stalls after
 // an external activity takes and returns focus.
 const dpr=await evalJS('devicePixelRatio');
 const xy=p=>[String(Math.round(p.x*dpr)),String(Math.round(p.y*dpr))];
 if(a.x===b.x&&a.y===b.y&&duration<200)adb('shell','input','tap',...xy(a));
 else adb('shell','input','swipe',...xy(a),...xy(b),String(duration));
 await sleep(850);
}
async function tap(s){await gesture(await target(s))}
async function swipe(x1,y1,x2,y2){const [w,h]=await evalJS('[innerWidth,innerHeight]');await gesture({x:w*x1,y:h*y1},{x:w*x2,y:h*y2},360)}
async function home(){await evalJS('setLauncherPage("home",true);window.scrollTo(0,0)');await sleep(800)}
async function apps(){await evalJS('setLauncherPage("apps",true)');await poll(()=>evalJS(visible('#launcherAppsGrid')));await sleep(700)}
async function closeMenus(){await evalJS('closeCustomize(true);closeHomeOptions(true);closeLauncherLetterPanel()');await sleep(300)}
async function record(name,fn){
 const remote='/sdcard/audio-desk-motion-'+name+'.mp4',local=dir+'/'+theme+'-'+name+'.mp4';
 adb('shell','rm','-f',remote);
 const p=spawn('adb',['shell','screenrecord','--bit-rate','6000000','--time-limit','180',remote],{stdio:['ignore','ignore','pipe']});
 let stderr='';p.stderr.on('data',b=>stderr+=b);const done=new Promise(resolve=>{p.on('exit',resolve);p.on('error',e=>{stderr+=String(e);resolve(-1)})});
 await sleep(1200);
 try{await fn()}catch(e){note(name,'failed',String(e.stack||e))}
 finally{
  await sleep(900);
  try{const ids=adb('shell','pidof','screenrecord').trim().split(/\s+/).filter(x=>/^\d+$/.test(x));if(ids.length)adb('shell','kill','-2',...ids);}catch{}
  await Promise.race([done,sleep(9000)]);if(p.exitCode===null)p.kill();
  try{adb('pull',remote,local);assert.ok(fs.statSync(local).size>10000,'Empty recording');note('record-'+name,'passed',local);adb('shell','rm','-f',remote)}catch(e){note('record-'+name,'failed',String(e)+' '+stderr)}
 }
}
(async()=>{
 try{
  adb('logcat','-c');
  for(const k of ['window_animation_scale','transition_animation_scale','animator_duration_scale'])adb('shell','settings','put','global',k,'1');
  adb('shell','settings','put','system','show_touches','1');
  adb('shell','cmd','package','set-home-activity',pkg+'/.MainActivity');
  adb('shell','am','start','-W','-n',pkg+'/.MainActivity');c=await connect();
  await evalJS('setLauncherTheme('+JSON.stringify(theme)+');setLauncherPage("home",false)');
  await poll(()=>evalJS('document.body.dataset.launcherTheme==='+JSON.stringify(theme)+'&&launcherApps.length>0'));
  await sleep(1600);
  await record('navigation',async()=>{
   await step('home-to-apps-swipe',async()=>{await home();await swipe(.8,.46,.2,.46);assert.equal(await evalJS('launcherPage'),'apps')});
   await step('app-list-scroll',async()=>{await apps();await swipe(.45,.77,.45,.25);await swipe(.45,.25,.45,.77)});
   if(theme==='warm')await step('warm-default-icon-geometry',async()=>{await apps();const boxes=await evalJS('Array.from(document.querySelectorAll("#launcherAppsGrid .launcher-app .ad-icon-shell:not([data-icon-pack])")).slice(0,12).map(e=>({w:e.offsetWidth,h:e.offsetHeight,r:getComputedStyle(e).borderRadius}))');assert.ok(boxes.length>0,'Default native icon sample required');for(const b of boxes){assert.equal(b.w,40);assert.equal(b.h,40);assert.equal(b.r,'11px');}});
   await step('search-keyboard',async()=>{await tap('#launcherAppSearch');adb('shell','input','text','Settings');await sleep(850);assert.match(await evalJS('document.getElementById("launcherAppSearch").value'),/Settings/i);adb('shell','input','keyevent','4');await evalJS('document.getElementById("launcherAppSearch").value="";document.getElementById("launcherAppSearch").dispatchEvent(new Event("input",{bubbles:true}));document.getElementById("launcherAppSearch").blur();window.AudioDesk.hideSearchKeyboard()')});
   await step('apps-to-home-swipe',async()=>{await apps();const p=await target('#launcherAppsGrid .launcher-app');const w=await evalJS('innerWidth');await gesture({x:Math.min(p.x,w*.30),y:p.y},{x:w*.83,y:p.y},550);await sleep(700);assert.equal(await evalJS('launcherPage'),'home');assert.ok(foreground(),'Swipe must not open Android App Info');const xmlPath='/sdcard/warm-swipe-window.xml';adb('shell','uiautomator','dump',xmlPath);const xml=adb('shell','cat',xmlPath);assert.doesNotMatch(xml,/text="(?:App info|Clear cache|Force stop)"/i,'Swipe must not open app management dialog');});
   await step('home-to-news-swipe',async()=>{await home();await swipe(.2,.46,.8,.46);assert.equal(await evalJS('launcherPage'),'events');await swipe(.45,.75,.45,.3)});
   await step('news-to-home-swipe',async()=>{await evalJS('setLauncherPage("events",true)');await sleep(800);await swipe(.8,.46,.2,.46);await poll(()=>evalJS('launcherPage==="home"'));assert.ok(foreground(),'News swipe must not open an external article');});
   await step('home-up-swipe',async()=>{await home();await swipe(.48,.72,.48,.22);if(theme==='windows')assert.equal(await evalJS('launcherPage'),'home');else if(theme!=='orbit')assert.equal(await evalJS('launcherPage'),'apps');adb('shell','input','keyevent','4')});
  });
  await record('settings',async()=>{
   await closeMenus();await home();
   if(theme==='orbit'){
    await step('orbit-settings',async()=>{await tap('#orbitSettingsGear');await poll(()=>evalJS(visible('#orbitSettingsPanel')));for(const tab of ['themes','wallpaper','dials','widgets','gestures','general']){await tap('#orbitSettingsTabs [data-orbit-tab="'+tab+'"]');await swipe(.5,.75,.5,.35)}await tap('#orbitSettingsClose')});
    await step('orbit-dial-motion',async()=>{await home();const r=await evalJS('(()=>{const r=document.querySelector("#orbitDial").getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()');await gesture({x:r.x+r.w*.15,y:r.y+r.h*.75},{x:r.x+r.w*.72,y:r.y+r.h*.15},750);await gesture({x:r.x+r.w*.72,y:r.y+r.h*.15},{x:r.x+r.w*.15,y:r.y+r.h*.75},350)});
   }else{
    if(theme==='warm')await step('warm-settings-icon-geometry',async()=>{await home();const g=await evalJS('(()=>{const e=document.querySelector("#launcherSettingsToggle .warm-settings-symbol svg");const b=e.getBoundingClientRect();return {w:b.width,h:b.height,stroke:getComputedStyle(e).strokeWidth}})()');assert.equal(Math.round(g.w),22);assert.equal(Math.round(g.h),22);assert.equal(parseFloat(g.stroke),1.75);});
    await step('settings-open-scroll-close',async()=>{await tap('#launcherSettingsToggle');await poll(()=>evalJS(visible('#launcherHomeOptions')));await swipe(.5,.75,.5,.3);await swipe(.5,.3,.5,.75);await tap('#launcherOptionsClose')});
    for(const [name,open,close] of [['theme','#launcherThemeChoose','#themeClose'],['wallpaper','#launcherWallpaperChoose','#wallpaperClose'],['clock','#launcherClockChoose','#clockClose'],['favorites','#launcherFavoritesEdit',null]]){
     if(theme==='extreme'&&['wallpaper','clock'].includes(name)){note(name,'not-applicable','Intentionally disabled');continue}
     await step(name+'-menu',async()=>{await closeMenus();await home();await tap('#launcherSettingsToggle');await tap(open);await sleep(1000);await swipe(.5,.75,.5,.35);if(close)await tap(close);else adb('shell','input','keyevent','4')})
    }
    await step('alphabet-index',async()=>{await closeMenus();await home();await tap('#launcherAlphaIndex button[data-launcher-letter="C"]');await sleep(800);await tap('#launcherLetterClose')});
   }
  });
  await record('app-launch',async()=>{
   await closeMenus();await apps();
   const installed=await evalJS('launcherApps.map(a=>({pkg:a.pkg,activity:a.activity,label:a.label}))');
   fs.writeFileSync(dir+'/installed-apps.json',JSON.stringify(installed,null,2));
   const choices=installed.filter(a=>/^(com\.android\.settings|com\.android\.calculator2|com\.google\.android\.calculator|com\.android\.deskclock|com\.google\.android\.deskclock|com\.android\.contacts|com\.google\.android\.contacts)$/.test(a.pkg)).slice(0,4);
   assert.ok(choices.length,'No safe built-in apps found');
   for(const a of choices)await step('launch-and-return-'+a.pkg,async()=>{
    await apps();const sel='#launcherAppsGrid button[data-launch-pkg="'+a.pkg+'"]';await tap(sel);
    await poll(()=>{const x=adb('shell','dumpsys','activity','activities');return x.split('\n').some(l=>/mResumedActivity|topResumedActivity/.test(l)&&l.includes(a.pkg))},15000);
    await sleep(1400);adb('shell','input','keyevent','4');await sleep(900);
    adb('shell','input','keyevent','3');await sleep(1200);
    await poll(()=>adb('shell','dumpsys','activity','activities').split('\n').some(l=>/mResumedActivity|topResumedActivity/.test(l)&&l.includes(pkg)));
    c.close();c=await connect();await poll(()=>evalJS('window.audioDeskForeground!==false'));await sleep(1000);
   });
   await step('app-list-long-press',async()=>{await apps();const sel='#launcherAppsGrid button[data-launch-pkg="'+choices[0].pkg+'"]';await gesture(await target(sel),undefined,850);await sleep(1000);adb('shell','input','keyevent','4')});
   await step('favorite-icon-quick-actions',async()=>{
    const a=choices[0];
    await evalJS('(()=>{const a='+JSON.stringify(a)+';if(!launcherPins.includes(a.pkg+"/"+a.activity))setLauncherPin(a.pkg,a.activity)})()');await home();
    const sel='button[data-launch-pkg="'+a.pkg+'"]';
    if(theme==='orbit'){note('orbit-favorite-touch','not-covered','Radial picker needs a separate gesture path');await evalJS('showAppShortcuts('+JSON.stringify(a.pkg)+','+JSON.stringify(a.activity)+')')}
    else {const selector=await evalJS('Array.from(document.querySelectorAll('+JSON.stringify(sel)+')).find(e=>e.getClientRects().length&&!e.closest("[hidden]"))?.closest("[id]")?.id||null');assert.ok(selector,"Visible pinned app");await gesture(await target('#'+selector+' '+sel),undefined,850);}
    await sleep(1200);adb('shell','uiautomator','dump','/sdcard/motion-window.xml');fs.writeFileSync(dir+'/long-press.xml',adb('shell','cat','/sdcard/motion-window.xml'));adb('shell','input','keyevent','4');await sleep(900);
   });
  });
  if(['minimal','warm','pixel','windows'].includes(theme))await record('widgets',async()=>{
   await closeMenus();await home();
   await step('music-resize-and-move',async()=>{
    await evalJS('window.audioDeskRestoreWidget("launcherMusicWidget");document.getElementById("launcherMusicWidget").scrollIntoView({block:"center"})');
    await gesture(await target('#launcherMusicWidget'),undefined,850);
    if(!await evalJS(visible('#widgetLayoutOverlay'))){note('music-long-press','failed','Editor did not open from touch');assert.equal(await evalJS('window.audioDeskBeginWidgetResize("launcherMusicWidget")'),true)}
    if(theme==='warm'){const angles=await evalJS('Array.from(document.querySelectorAll("#widgetLayoutOverlay .widget-resize-handle")).map(e=>getComputedStyle(e,"::after").transform)');assert.equal(new Set(angles).size,8,'Every Warm Minimal resize handle must indicate its own direction');assert.equal(await evalJS('getComputedStyle(document.getElementById("launcherAlphaIndex")).visibility'),'hidden');}
    const p=await target('#widgetLayoutOverlay .widget-resize-handle[data-edge="se"]');await gesture(p,{x:p.x-24,y:p.y-28},550);
    const m=await target('#widgetLayoutOverlay .layout-move-handle');await gesture(m,{x:m.x,y:m.y+40},600);
    await tap('#widgetLayoutOverlay [data-layout-control="done"]');
   });
   await step('agenda-open-close',async()=>{await evalJS('window.audioDeskRestoreWidget("launcherAgendaWidget");window.audioDeskAgenda.open()');await poll(()=>evalJS(visible('#agendaOverlay')));await tap('#agendaRefresh');await tap('#agendaClose')});
   for(const [id,toggle] of [['launcherSplWidget','acousticAddSpl'],['launcherMicAnalyzer','acousticAddFft'],['launcherYouTubeWidget','youtubeWidgetToggle']])await step(id+'-show',async()=>{if(!await evalJS(visible('#'+id))){await tap('#launcherSettingsToggle');await tap('#'+toggle);await closeMenus()}await poll(()=>evalJS(visible('#'+id)));await target('#'+id);await sleep(1200)});
  });
  else note('rectangular-widgets','not-applicable','Extreme has no live widgets; Orbit uses radial controls');
 }catch(e){note('session','failed',String(e.stack||e))}
 finally{
  if(c)c.close();
  for(const [name,args] of [['logcat',['logcat','-d','-v','threadtime']],['gfxinfo',['shell','dumpsys','gfxinfo',pkg,'framestats']],['meminfo',['shell','dumpsys','meminfo',pkg]]])try{fs.writeFileSync(dir+'/'+name+'.txt',adb(...args))}catch(e){note(name,'failed',String(e))}
  if(errors.length)note('webview-exceptions','failed',errors);
  fs.writeFileSync(dir+'/motion-report.json',JSON.stringify({theme,apiLevel,steps,errors,limitations:['Screen recordings are real emulator output, not physical-device performance measurements.','CDP used for theme setup and touch dispatch; app returns use Android key events.','External sign-in, live media input, third-party providers and destructive actions are not covered.','Recording overhead affects frame statistics. Unreviewed videos do not establish visual correctness.']},null,2));
  if(steps.some(s=>s.status==='failed'))process.exitCode=1;
 }
})().catch(e=>{console.error(e);process.exitCode=1});
