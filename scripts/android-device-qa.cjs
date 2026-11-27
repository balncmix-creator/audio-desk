// Real installed APK on a disposable Android emulator. No mocked Android bridge.
// Setup uses CDP to select editions; taps use Android input, with screen/log evidence.
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const pkg='com.balnc.audioddesk', dir='android-qa';
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
async function test(name,fn){
 try{await fn();results.push({name,status:'passed'});console.log('PASS',name);}
 catch(e){results.push({name,status:'failed',error:String(e.stack||e)});console.error('FAIL',name,e);try{screenshot('FAIL-'+name.replace(/[^a-z0-9-]/gi,'-'));}catch{}}
}
const visible=selector=>'(()=>{const e=document.querySelector('+JSON.stringify(selector)+');return !!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=="hidden"})()';
async function tap(c,selector){
 const p=await c.evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e||!e.getClientRects().length)return null;e.scrollIntoView({block:"nearest"});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()');
 assert.ok(p,'Visible tap target '+selector);
 // Older factory WebView has unreliable CDP touch dispatch. Use Android's
 // actual input service there instead; never skip the assertion.
 if(apiLevel<=30){const dpr=await c.evaluate('devicePixelRatio');adb('shell','input','tap',String(Math.round(p.x*dpr)),String(Math.round(p.y*dpr)));}
 else {await c.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await sleep(80);await c.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 await sleep(350);
}
(async()=>{
 let c;
 try{
  adb('logcat','-c');
  adb('shell','am','start','-W','-n',pkg+'/.MainActivity');
  c=await connect();
  const themes=['minimal','warm','pixel','windows','extreme','orbit'];
  for(const theme of themes){
   await test(theme+'-home',async()=>{
    await c.evaluate('setLauncherTheme('+JSON.stringify(theme)+');setLauncherPage("home",false)');
    await sleep(600);
    assert.equal(await c.evaluate('document.body.dataset.launcherTheme'),theme);
    assert.equal(await c.evaluate('document.body.dataset.homePage'),'home');
    assert.ok(await c.evaluate(visible(theme==='orbit'?'#orbitHome':'#launcherHomePage')));
    screenshot(theme+'-home');
   });
   await test(theme+'-apps-search',async()=>{
    await c.evaluate('setLauncherPage("apps",false)');
    await poll(()=>c.evaluate('launcherApps.length>0'));
    assert.ok(await c.evaluate(visible('#launcherAppSearch')));
    await tap(c,'#launcherAppSearch');
    if(apiLevel<=30)adb('shell','input','text','zzqa_no_app_zz');else await c.call('Input.insertText',{text:'zzqa_no_app_zz'});
    await sleep(350);
    assert.equal(await c.evaluate('document.getElementById("launcherAppSearch").value'),'zzqa_no_app_zz');
    await c.evaluate('document.getElementById("launcherAppSearch").value="";document.getElementById("launcherAppSearch").dispatchEvent(new Event("input",{bubbles:true}));document.getElementById("launcherAppSearch").blur()');
    await c.evaluate('window.AudioDesk.hideSearchKeyboard()');
    await sleep(400);
    screenshot(theme+'-apps');
   });
   await test(theme+'-news-palette',async()=>{
    await c.evaluate('setLauncherPage("events",false)');
    await sleep(450);
    assert.equal(await c.evaluate('document.body.dataset.homePage'),'events');
    const colors=await c.evaluate('(()=>{const b=document.body;const old=b.dataset.glassMode;b.dataset.glassMode="opaque";const p=document.createElement("i");p.style.backgroundColor="var(--news-bg)";b.append(p);const result=[getComputedStyle(p).backgroundColor,...["header","#launcherNavigation","nav.bottom-dock"].map(s=>getComputedStyle(document.querySelector(s)).backgroundColor)];p.remove();if(old===undefined)delete b.dataset.glassMode;else b.dataset.glassMode=old;return result})()');
    assert.notEqual(colors[0],'rgba(0, 0, 0, 0)');
    assert.ok(colors.every(v=>v===colors[0]),JSON.stringify(colors));
    screenshot(theme+'-news');
   });
  }
  await test('warm-settings-and-glass',async()=>{
   await c.evaluate('setLauncherTheme("warm");setLauncherPage("home",false)');
   await tap(c,'#launcherSettingsToggle');
   await poll(()=>c.evaluate(visible('#launcherHomeOptions')));
   for(const mode of ['liquid','aero','mica','opaque']){
    await c.evaluate('(()=>{const e=document.getElementById("launcherGlassMode");e.value='+JSON.stringify(mode)+';e.dispatchEvent(new Event("change",{bubbles:true}))})()');
    await poll(()=>c.evaluate('document.body.dataset.glassMode==='+JSON.stringify(mode)));
    await sleep(300);screenshot('warm-glass-'+mode);
   }
   await tap(c,'#launcherOptionsClose');
  });
  await test('warm-wallpaper-picker',async()=>{
   await c.evaluate('openWallpaperPicker()');
   await poll(()=>c.evaluate(visible('#launcherWallpaperDialog')));
   assert.ok(await c.evaluate('document.querySelectorAll(".wallpaper-choice").length>0'));
   screenshot('warm-wallpapers');
   await c.evaluate('closeCustomize(true)');
  });
  // Exercise real installed widget UI; never inject fabricated sensor samples.
  async function activate(selector){
   await c.evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e)throw Error("missing "+'+JSON.stringify(selector)+');e.click()})()');
   await sleep(350);
  }
  async function select(id,value){
   await c.evaluate('(()=>{const e=document.getElementById('+JSON.stringify(id)+');if(!e)throw Error("missing control");e.value='+JSON.stringify(value)+';e.dispatchEvent(new Event("change",{bubbles:true}));return e.value})()');
   assert.equal(await c.evaluate('document.getElementById('+JSON.stringify(id)+').value'),value);
  }
  for(const theme of ['minimal','warm','pixel','windows']){
   await test(theme+'-music-widget-layout',async()=>{
    await c.evaluate('setLauncherTheme('+JSON.stringify(theme)+');setLauncherPage("home",false);window.audioDeskRestoreWidget("launcherMusicWidget");window.scrollTo(0,0)');
    await poll(()=>c.evaluate(visible('#launcherMusicWidget')));
    assert.ok(await c.evaluate('document.getElementById("musicTrackTitle").textContent.trim().length>0'));
    await c.evaluate('document.getElementById("launcherMusicWidget").scrollIntoView({block:"center"})');
    assert.equal(await c.evaluate('window.audioDeskBeginWidgetResize("launcherMusicWidget")'),true);
    await poll(()=>c.evaluate(visible('#widgetLayoutOverlay')));
    assert.equal(await c.evaluate('document.querySelectorAll("#widgetLayoutOverlay .widget-resize-handle").length'),8);
    assert.ok(await c.evaluate(visible('#widgetLayoutOverlay [data-layout-control="move"]')));
    screenshot(theme+'-music-resize');
    await activate('#widgetLayoutOverlay [data-layout-control="done"]');
    assert.equal(await c.evaluate(visible('#widgetLayoutOverlay')),false);
   });
   await test(theme+'-agenda-widget',async()=>{
    await c.evaluate('window.audioDeskRestoreWidget("launcherAgendaWidget")');
    assert.ok(await c.evaluate('typeof window.audioDeskAgenda?.open==="function"'));
    await c.evaluate('window.audioDeskAgenda.open()');
    await poll(()=>c.evaluate(visible('#agendaOverlay')));
    await activate('#agendaRefresh');
    screenshot(theme+'-agenda');
    await activate('#agendaClose');
    assert.equal(await c.evaluate(visible('#agendaOverlay')),false);
   });
   await test(theme+'-acoustic-controls',async()=>{
    for(const [widget,toggle] of [['launcherSplWidget','acousticAddSpl'],['launcherMicAnalyzer','acousticAddFft']]){
     if(!await c.evaluate(visible('#'+widget)))await activate('#'+toggle);
     await poll(()=>c.evaluate(visible('#'+widget)));
    }
    for(const weight of ['A','C','Z'])await select('splWeight',weight);
    await select('splResponse','slow');await activate('#splReset');
    assert.match(await c.evaluate('document.getElementById("splMax").textContent'),/Max/);
    await select('micFftRange','120');
    const before=await c.evaluate('document.getElementById("micFftPeak").getAttribute("aria-pressed")');
    await activate('#micFftPeak');
    assert.notEqual(await c.evaluate('document.getElementById("micFftPeak").getAttribute("aria-pressed")'),before);
    await activate('#micFftClear');
    for(const id of ['launcherSplWidget','launcherMicAnalyzer']){
     await c.evaluate('document.getElementById('+JSON.stringify(id)+').scrollIntoView({block:"center"})');
     await sleep(300);screenshot(theme+'-'+id);
    }
   });
   await test(theme+'-youtube-widget',async()=>{
    if(!await c.evaluate(visible('#launcherYouTubeWidget')))await activate('#youtubeWidgetToggle');
    await poll(()=>c.evaluate(visible('#launcherYouTubeWidget')));
    assert.ok(await c.evaluate('!!document.getElementById("ytSearchInput") && !!document.getElementById("ytHome")'));
    await c.evaluate('document.getElementById("launcherYouTubeWidget").scrollIntoView({block:"center"})');
    await sleep(500);screenshot(theme+'-youtube-widget');
    // Avoid account sign-in or external actions; check the installed widget controls.
    await activate('#youtubeWidgetToggle');
    assert.equal(await c.evaluate(visible('#launcherYouTubeWidget')),false);
   });
  }
  await test('widget-removal-and-restore',async()=>{
   await c.evaluate('setLauncherTheme("warm");setLauncherPage("home",false);window.audioDeskRestoreWidget("launcherMusicWidget");document.getElementById("launcherMusicWidget").scrollIntoView({block:"center"})');
   assert.equal(await c.evaluate('window.audioDeskBeginWidgetResize("launcherMusicWidget")'),true);
   await activate('#widgetLayoutOverlay [data-layout-control="remove"]');
   assert.equal(await c.evaluate('window.audioDeskWidgetRemoved("launcherMusicWidget")'),true);
   await c.evaluate('window.audioDeskRestoreWidget("launcherMusicWidget")');
   assert.equal(await c.evaluate('window.audioDeskWidgetRemoved("launcherMusicWidget")'),false);
  });
  await test('modal-alphabet-rail-is-hidden',async()=>{
   await c.evaluate('openWallpaperPicker()');
   await poll(()=>c.evaluate(visible('#launcherWallpaperDialog')));
   assert.equal(await c.evaluate('getComputedStyle(document.getElementById("launcherAlphaIndex")).visibility'),'hidden');
   screenshot('warm-wallpaper-modal-fixed');
   await c.evaluate('closeCustomize(true)');
  });
  await test('warm-theme-persists-after-process-restart',async()=>{
   await c.evaluate('setLauncherTheme("warm");setLauncherPage("home",false)');
   c.close();c=null;
   adb('shell','am','force-stop',pkg);
   adb('shell','am','start','-W','-n',pkg+'/.MainActivity');
   c=await connect();
   assert.equal(await c.evaluate('document.body.dataset.launcherTheme'),'warm');
   screenshot('warm-restart');
  });
  await test('native-catalog-activity-launch',async()=>{
   if(c)c.close();c=null;
   const output=adb('shell','am','start','-W','-n',pkg+'/.NativeCatalogActivity');
   assert.match(output,/Status: ok/);
   await sleep(1500);
   adb('shell','uiautomator','dump','/sdcard/audio-desk-window.xml');
   const xml=adb('shell','cat','/sdcard/audio-desk-window.xml');
   fs.writeFileSync(dir+'/native-catalog.xml',xml);
   assert.match(xml,/Native catalog/);
   screenshot('native-catalog');
  });
 }catch(e){results.push({name:'emulator-session',status:'failed',error:String(e.stack||e)});}
 finally{
  if(c)c.close();
  for(const [name,args] of [
    ['logcat.txt',['logcat','-d','-v','threadtime']],
    ['meminfo.txt',['shell','dumpsys','meminfo',pkg]],
    ['gfxinfo.txt',['shell','dumpsys','gfxinfo',pkg]],
    ['device.txt',['shell','getprop']],
  ]){try{fs.writeFileSync(dir+'/'+name,adb(...args));}catch(e){results.push({name,status:'failed',error:String(e)});}}
  const log=fs.existsSync(dir+'/logcat.txt')?fs.readFileSync(dir+'/logcat.txt','utf8'):'';
  if(/FATAL EXCEPTION[\s\S]{0,600}Process: com\.balnc\.audioddesk(?:,|:)/.test(log))results.push({name:'AndroidRuntime crash',status:'failed'});
  if(errors.length)results.push({name:'WebView uncaught exceptions',status:'failed',errors});
  fs.writeFileSync(dir+'/report.json',JSON.stringify({results,errors,limitations:['Emulated Android; not a physical device.','Theme setup and widget control changes use CDP; selected interactions use touch events. No claim of complete drag or external widget testing.','Hardware microphone, real media projection, Google sign-in, third-party widgets and real-device battery measurements not covered.']},null,2));
  console.log(JSON.stringify(results,null,2));
  if(results.some(r=>r.status==='failed'))process.exitCode=1;
 }
})().catch(e=>{console.error(e);process.exitCode=1});
