const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const serve=require('./serve-assets.cjs');
const origin='https://appassets.androidplatform.net/assets/';
const html=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'));
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const legacy of [false,true]){
   const page=await browser.newPage({viewport:{width:360,height:740},hasTouch:true,isMobile:true});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(({legacy})=>{
    // Valid JSON with an obsolete/wrong schema previously crashed before Home booted.
    for(const key of ['ar_items','ar_saved_items','ar_auto_feeds','ar_removed_feeds','ar_feeds','ar_saved'])localStorage.setItem(key,'{"bad":true}');
    if(legacy){Element.prototype.getAnimations=undefined;Element.prototype.animate=undefined;HTMLImageElement.prototype.decode=undefined;window.createImageBitmap=undefined;Blob.prototype.arrayBuffer=undefined}
    window.refreshStates=[];window.keyboardHidden=0;window.appLaunches=0;window.forceRequests=[];
    window.AudioDesk={
     setRefreshEnabled(value){refreshStates.push(value)},hideSearchKeyboard(){keyboardHidden++},
     requestSearchKeyboard(){},setWallpaperTone(){},
     requestLauncherApps(force){forceRequests.push(force);window.receiveLauncherApps([{pkg:'test.music',activity:'Main',label:'Music'}],[],true)},
     launchExternalApp(){appLaunches++},getAppShortcuts(){},refreshStarted(){},refreshFinished(){}
    };
   },{legacy});
   await page.route('**/*',route=>{
    const local=serve(route);if(local)return local;
    const url=route.request().url();
    if(url===origin+'index.html')return route.fulfill({contentType:'text/html',body:html});
    if(url.includes('api.rss2json.com'))return route.fulfill({json:{status:'ok',items:[
     {title:'Unsafe link',link:'javascript:window.feedExecuted=true',description:'bad'},
     {title:'Valid article',link:'https://example.test/story',description:'<img src="bad" onerror="window.feedExecuted=true"><p>Readable description</p>'}
    ]}});
    if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
    return route.abort();
   });
   await page.goto(origin+'index.html');
   await page.waitForFunction(()=>document.querySelector('#wallpaperImage')?.naturalWidth>0);
   await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
   assert.equal(await page.evaluate(()=>launcherPage),'home');
   assert.equal(await page.evaluate(()=>refreshStates.at(-1)),false,'background News loading never enables a Home pull');
   assert.equal(await page.evaluate(()=>window.feedExecuted),undefined,'feed markup remains inert');
   assert.equal(await page.evaluate(()=>items.length),1,'unsafe article schemes are discarded');
   assert.equal(await page.evaluate(()=>items[0].desc),'Readable description');
   for(const url of ['https://127.0.0.1/a','https://10.0.0.1/a','https://172.20.1.2/a','https://192.168.1.2/a','https://[::1]/a'])assert.equal(await page.evaluate(url=>safeDemoURL(url),url),'');
   const swipe=async(selector,from,to)=>page.evaluate(({selector,from,to})=>{
    const target=document.querySelector(selector);
    const emit=(type,point)=>{const touch=new Touch({identifier:1,target,clientX:point[0],clientY:point[1]});target.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[touch],changedTouches:[touch]}))};
    emit('touchstart',from);emit('touchmove',[(from[0]+to[0])/2,(from[1]+to[1])/2]);emit('touchend',to);
   },{selector,from,to});
   // A customization sheet must own all drags, including non-control space.
   await page.evaluate(()=>openClockCustomizer());
   await swipe('#launcherClockDialog .customize-panel',[300,250],[30,251]);
   assert.equal(await page.evaluate(()=>launcherPage),'home');
   assert.equal(await page.locator('#launcherClockDialog').isVisible(),true);
   await page.evaluate(()=>{closeCustomize();openClockCustomizer()});
   await page.waitForTimeout(300);
   assert.equal(await page.locator('#launcherClockDialog').isVisible(),true,'old closing callbacks cannot hide a reopened sheet');
   await page.evaluate(()=>window.launcherGoHome());
   assert.equal(await page.locator('#launcherClockDialog').isVisible(),false,'Home dismisses sheets even while already Home');
   // Windows tiles expose shortcuts, while Minimal keeps Home free of an app list.
   await page.evaluate(()=>setLauncherTheme('windows'));
   // Directional app gestures: right opens quick actions, left opens All Apps.
   await swipe('#launcherFavorites .launcher-app',[70,320],[280,320]);
   assert.equal(await page.locator('#launcherShortcutMenu').isVisible(),true);
   await page.evaluate(()=>window.launcherGoHome());
   await swipe('#launcherFavorites .launcher-app',[280,320],[70,320]);
   assert.equal(await page.evaluate(()=>launcherPage),'apps');
   assert.equal(await page.locator('#launcherShortcutMenu').isVisible(),false);
   assert.equal(await page.locator('#wallpaperStage').isVisible(),true,'selected wallpaper stays visible in All Apps');
   assert.equal(await page.evaluate(()=>document.body.dataset.motionPaused),'true','drawer wallpaper stays static to save power');
   await swipe('#launcherAppsGrid .launcher-app',[280,320],[70,320]);
   assert.equal(await page.locator('#launcherShortcutMenu').isVisible(),false,'left swipe never opens quick actions');
   await page.evaluate(()=>{window.launcherGoHome();setLauncherTheme('minimal')});
   assert.equal(await page.locator('#launcherFavorites .launcher-app').count(),0);
   // Swiping up on empty Home opens All Apps and focuses the keyboard immediately.
   await swipe('#launcherHomePage',[170,450],[170,210]);
   assert.equal(await page.evaluate(()=>launcherPage),'apps');
   assert.equal(await page.locator('#launcherAppSearch').evaluate(el=>el===document.activeElement),true);
   assert.equal(await page.evaluate(()=>appLaunches),0);
   await page.evaluate(()=>window.launcherGoHome());
   assert.ok(await page.evaluate(()=>keyboardHidden)>0);
   assert.equal(await page.locator('#launcherAppSearch').evaluate(el=>el===document.activeElement),false);
   await page.evaluate(()=>{setLauncherPage('events',false);setView('samples')});
   assert.equal(await page.locator('#stories').isVisible(),false,'resource directory hides news cards even in compact grid mode');
   assert.equal(await page.locator('#stats').isVisible(),false,'resource directory hides headline counters');
   assert.equal(await page.locator('#resourceHub').isVisible(),true);
   await page.evaluate(()=>setView('news'));
   assert.equal(await page.evaluate(()=>refreshStates.at(-1)),true);
   await page.evaluate(()=>{setCardDensity(3);openGridDetails(items[0])});
   await page.waitForFunction(()=>refreshStates.at(-1)===false);
   await page.evaluate(()=>window.launcherGoHome());
   assert.equal(await page.locator('#gridDetail').isVisible(),false);
   assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
   await page.evaluate(()=>{
    setLauncherPage('events',false);
    const output=document.createElement('div');output.className='sample-demo-output';
    output.innerHTML='<audio></audio><iframe src="about:blank"></iframe>';document.querySelector('#stories').append(output);
    setLauncherPage('home',false);
   });
   assert.equal(await page.locator('.sample-demo-output iframe').count(),0,'embedded players stop on leaving News');
   await page.evaluate(()=>{document.querySelector('#launcherClock').textContent='STALE';launcherOnResume()});
   assert.notEqual(await page.locator('#launcherClock').textContent(),'STALE');
   assert.equal(await page.evaluate(()=>forceRequests.at(-1)),true,'resume bypasses the app cache');
   await page.evaluate(()=>{document.documentElement.style.setProperty('--status-top','32px');setLauncherPage('apps',false)});
   assert.ok(await page.locator('#launcherNavigation').evaluate(el=>el.getBoundingClientRect().top)>=32,'sticky app navigation stays below Android status bar');
   await page.evaluate(()=>window.launcherGoHome());
   await page.evaluate(()=>{openWallpaperPicker();closeCustomize();openWallpaperPicker()});
   const thumbRatio=await page.locator('.wallpaper-thumb').first().evaluate(el=>{const r=el.getBoundingClientRect();return r.height/r.width});
   assert.ok(Math.abs(thumbRatio-400/180)<.02,'gallery thumbnail height follows its portrait aspect ratio');
   assert.ok(await page.locator('#customWallpaperChoose').evaluate(el=>el.getBoundingClientRect().bottom<innerHeight),'custom photo control is immediately visible');
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.waitForTimeout(220);
   assert.equal(await page.locator('#launcherWallpaperDialog').isVisible(),true);
   await page.evaluate(()=>closeCustomize());
   assert.equal(await page.locator('#launcherWallpaperDialog').isVisible(),false,'reduced-motion dismissal is immediate');
   if(legacy){
    await page.evaluate(()=>openWallpaperPicker());
    // Unknown MIME from a document provider is verified by file signature, then decoded safely.
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
    await page.locator('#customWallpaperFile').setInputFiles({name:'photo.png',mimeType:'',buffer:png});
    await page.waitForFunction(()=>document.querySelector('#customWallpaperStatus').textContent.includes('Saved on this phone'));
   }
   await page.clock.install({time:new Date('2026-11-15T07:00:59.500Z')});
   await page.evaluate(()=>formatLauncherClock());
   const before=await page.locator('#launcherClock').textContent();
   await page.clock.runFor(1000);
   assert.notEqual(await page.locator('#launcherClock').textContent(),before,'Home clock advances at the minute boundary');
   assert.deepEqual(errors,[],legacy?'legacy WebView fallback':'modern interaction flow');
   await page.close();
  }
  console.log('PASS: corrupt storage recovery, inert feeds/URL validation, modal gesture ownership, interrupted animation, Home cleanup, app-row swipe-up, keyboard dismissal, media pause, forced resume scan and legacy WebView/photo fallback');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
