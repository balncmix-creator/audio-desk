const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const serve=require('./serve-assets.cjs');
const assets=path.join(__dirname,'../app/src/main/assets');
const origin='https://appassets.androidplatform.net/assets/';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:360,height:800},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[],wallpaperRequests=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Synthetic imagery exercises loading/cropping without pretending to recover originals.
  await page.goto('about:blank');
  const fixture=Buffer.from(await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=1080;c.height=2400;
   const x=c.getContext('2d');x.fillStyle='#142a3f';x.fillRect(0,0,1080,2400);
   x.fillStyle='#30ffca';x.fillRect(750,1100,300,900);return c.toDataURL('image/png').split(',')[1];
  }),'base64');
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url.startsWith(origin+'wallpapers/')&&url.endsWith('.webp')){
    wallpaperRequests.push(url);return route.fulfill({contentType:'image/png',body:fixture});
   }
   const local=serve(route);if(local)return local;
   if(url===origin+'index.html')return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(assets,'index.html'))});
   if(url.includes('api.rss2json.com'))return route.fulfill({json:{status:'ok',items:[]}});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.addInitScript(()=>{
   window.wallpaperNativeCalls=[];
   window.wallpaperStatusCalls=[];
   window.AudioDesk={
    setStatusBarTheme(theme,light){wallpaperStatusCalls.push({theme,light})},
    setSystemWallpaperBundled(id,position,lock,requestId){
     wallpaperNativeCalls.push({kind:'bundled',id,position,lock});
     window.audioDeskWallpaperResult(requestId,true,'Applied');
    },
    setSystemWallpaperCustom(data,position,lock,requestId){
     wallpaperNativeCalls.push({kind:'custom',prefix:data.slice(0,32),bytes:data.length,position,lock});
     window.audioDeskWallpaperResult(requestId,true,'Applied');
    }
   };
  });
  await page.goto(origin+'index.html');
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage')?.complete);
  assert.equal(await page.evaluate(()=>wallpaperNativeCalls.length),0,'startup must never overwrite Android wallpaper');
  const statusSurface=page.locator('#launcherStatusBackplate');
  assert.equal(await statusSurface.isVisible(),false,'Home never adds an unrelated status-bar panel');
  for(const theme of ['windows','pixel','minimal']){
   await page.evaluate(theme=>setLauncherTheme(theme),theme);
   assert.equal(await statusSurface.isVisible(),false,theme+' must keep actual wallpaper behind status icons');
   assert.equal(await page.locator('#wallpaperStage').evaluate(el=>el.getBoundingClientRect().top),0,
    'selected wallpaper extends through Android status inset');
   assert.equal(await page.evaluate(()=>wallpaperStatusCalls.at(-1).theme),theme);
  }
  await page.evaluate(()=>setLauncherPage('events'));
  assert.equal(await statusSurface.isVisible(),true,'News retains an accessible dark status background');
  await page.evaluate(()=>setLauncherPage('home'));
  assert.equal(wallpaperRequests.filter(u=>!u.includes('/thumbs/')).length,1,'only selected full-size wallpaper loads');
  assert.equal(await page.locator('#wallpaperStage').evaluate(e=>e.getBoundingClientRect().top),0,'wallpaper covers status-bar region');
  assert.equal(await page.locator('#wallpaperImage').evaluate(e=>getComputedStyle(e).objectFit),'cover');
  await page.evaluate(()=>openWallpaperPicker());
  assert.equal(await page.locator('.wallpaper-choice').count(),16);
  assert.equal(await page.locator('#wallpaperApplyLock').isChecked(),true,
   'wallpaper picker defaults to matching Android Home and Lock backgrounds');
  await page.locator('[data-wallpaper="1"]').click();
  assert.deepEqual(await page.evaluate(()=>wallpaperNativeCalls.at(-1)),
   {kind:'bundled',id:'rainy-neon',position:35,lock:true},
   'gallery selection applies Android Home and Lock wallpapers by default');
  assert.match(await page.locator('#wallpaperSystemStatus').textContent(),/Home and Lock/);
  await page.locator('#wallpaperApplyLock').uncheck();
  await page.locator('#wallpaperApplySystem').click();
  assert.deepEqual(await page.evaluate(()=>wallpaperNativeCalls.at(-1)),
   {kind:'bundled',id:'rainy-neon',position:35,lock:false},
   'a deliberate opt-out updates Android Home only');
  await page.evaluate(()=>{closeCustomize(true);openWallpaperPicker()});
  assert.equal(await page.locator('#wallpaperApplyLock').isChecked(),false,
   'reopening the picker retains the opt-out instead of resetting it');
  await page.locator('#wallpaperApplyLock').check();
  await page.evaluate(()=>{closeCustomize(true);openWallpaperPicker()});
  assert.equal(await page.locator('#wallpaperApplyLock').isChecked(),true,
   'reopening the picker remembers opt-in to updating both screens');
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage').src.endsWith('/rainy-neon.webp'));
  assert.equal(await page.locator('#wallpaperStage .wallpaper-image').count(),1,'one resident image');
  const full=wallpaperRequests.filter(u=>!u.includes('/thumbs/'));
  assert.equal(full.length,2,'gallery never fetches the remaining original portraits');
  await page.locator('[data-wallpaper="15"]').click();
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage').src.endsWith('/arcade-afterhours.webp'));
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage')?.src.endsWith('/arcade-afterhours.webp'));
  await page.evaluate(()=>openWallpaperPicker());
  assert.equal(await page.locator('#wallpaperApplyLock').isChecked(),true,'lock wallpaper preference persists across reload');
  assert.equal(await page.locator('[data-wallpaper="15"]').getAttribute('aria-pressed'),'true','new wallpaper indices above nine persist after restart');
  await page.locator('[data-wallpaper="1"]').click();
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage').src.endsWith('/rainy-neon.webp'));
  for(const effect of ['rain','aurora','stars','ocean','studio']){
   await page.locator('#wallpaperEffectSelect').selectOption(effect);
   assert.equal(await page.evaluate(()=>document.body.dataset.wallpaperMotion),effect);
   const first=await page.locator('#wallpaperEffect').evaluate(e=>{
    const a=e.getAnimations()[0];return {name:getComputedStyle(e).animationName,time:a?.currentTime};
   });
   assert.notEqual(first.name,'none');
   await page.waitForTimeout(100);
   const second=await page.locator('#wallpaperEffect').evaluate(e=>e.getAnimations()[0]?.currentTime);
   assert.ok(second>first.time,'wallpaper animation actually advances');
  }
  await page.evaluate(()=>window.launcherWallpaperActive(false));
  assert.equal(await page.locator('#wallpaperEffect').evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
  await page.evaluate(()=>window.launcherWallpaperActive(true));
  await page.evaluate(()=>setLauncherPage('apps'));
  assert.equal(await page.locator('#wallpaperEffect').evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
  await page.evaluate(()=>setLauncherPage('home'));
  await page.evaluate(()=>openWallpaperPicker());
  await page.locator('#customWallpaperFile').setInputFiles({name:'custom.png',mimeType:'image/png',buffer:fixture});
  await page.waitForFunction(()=>document.querySelector('#customWallpaperStatus').textContent.includes('Saved on this phone'));
  await page.waitForFunction(()=>wallpaperNativeCalls.some(x=>x.kind==='custom'));
  const customSystem=await page.evaluate(()=>wallpaperNativeCalls.filter(x=>x.kind==='custom').at(-1));
  assert.match(customSystem.prefix,/^data:image\/webp;base64/);
  assert.equal(customSystem.lock,true,'imported photos also apply to the Lock screen when enabled');
  assert.ok(customSystem.bytes>200,'custom photos are delivered to the Android wallpaper bridge');
  assert.equal(await page.locator('#wallpaperImage').evaluate(e=>e.src.startsWith('blob:')),true);
  await page.locator('#customWallpaperPosition').fill('70');
  assert.equal(await page.locator('#wallpaperImage').evaluate(e=>e.style.objectPosition),'70% center');
  await page.waitForFunction(()=>wallpaperNativeCalls.some(x=>x.kind==='custom'&&x.position===70));
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage')?.src.startsWith('blob:'));
  assert.equal(await page.locator('#wallpaperImage').evaluate(e=>e.style.objectPosition),'70% center','custom image and crop survive restart');
  await page.evaluate(()=>openWallpaperPicker());
  await page.locator('[data-wallpaper="2"]').click();
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage').src.endsWith('/northern-lights.webp'));
  await page.locator('#customWallpaperRestore').click();
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage').src.startsWith('blob:'));
  await page.locator('#customWallpaperFile').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
  await page.waitForFunction(()=>!document.querySelector('#customWallpaperChoose').disabled);
  assert.equal(await page.locator('#wallpaperImage').evaluate(e=>e.src.startsWith('blob:')),true,'invalid file preserves current wallpaper');
  await page.evaluate(()=>openClockCustomizer());
  await page.evaluate(()=>Promise.all(['25px "Press Start 2P"','400 25px Silkscreen','700 25px Silkscreen'].map(f=>document.fonts.load(f))));
  for(let i=0;i<10;i++){
   const choice=page.locator(`[data-clock-design="${i}"]`);await choice.click();
   const matches=await page.evaluate(i=>{
    const home=document.querySelector('#launcherClock'),sample=document.querySelector(`.clock-sample[data-design="${i}"]`);
    sample.style.fontSize=getComputedStyle(home).fontSize;
    const fields=['fontFamily','fontWeight','letterSpacing','textShadow','borderTopWidth','borderBottomWidth','paddingTop'];
    const a=getComputedStyle(home),b=getComputedStyle(sample);
    return fields.filter(k=>a[k]!==b[k]).map(k=>[k,a[k],b[k]]);
   },i);
   assert.deepEqual(matches,[],`clock ${i} preview must match home styling`);
   assert.equal(await page.locator(`[data-clock-design="${i}"]`).getAttribute('aria-pressed'),'true');
  }
  await page.setViewportSize({width:320,height:740});
  await page.locator('#clockSizeSlider').fill('110');
  for(const design of [1,4,9]){
   await page.locator(`[data-clock-design="${design}"]`).click();
   assert.equal(await page.locator('#launcherClock').evaluate(e=>e.scrollWidth<=e.parentElement.clientWidth+1),true,'large clock fits narrow phone');
  }
  await page.evaluate(()=>window.launcherBack());
  await page.waitForFunction(()=>document.querySelector('#launcherClockDialog').hidden);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('#wallpaperEffect').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.evaluate(()=>openWallpaperPicker());
  assert.match(await page.locator('#wallpaperMotionStatus').textContent(),/reduced-motion/);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>document.body.classList.add('low-power'));
  assert.equal(await page.locator('#wallpaperEffect').evaluate(e=>getComputedStyle(e).animationTimingFunction),'steps(12)');
  const invalid=await page.evaluate(()=>{localStorage.setItem('ar_wallpaper_v1','garbage');return loadPersonalInt('ar_wallpaper_v1',0,9)});
  assert.equal(invalid,0);
  assert.deepEqual(errors,[]);
  if(process.env.PERSONALIZATION_SCREENSHOT){
   await page.evaluate(()=>openClockCustomizer());
   await page.evaluate(()=>Promise.all(document.querySelector('#launcherClockDialog').getAnimations({subtree:true}).filter(a=>a.effect.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
   await page.screenshot({path:process.env.PERSONALIZATION_SCREENSHOT,fullPage:true});
  }
  console.log('PASS: clock preview fidelity/offline fonts, custom-photo persistence/crop, selected-image loading, five visible effects, lifecycle pause, reduced motion and narrow-screen sizing (synthetic image fixtures)');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
