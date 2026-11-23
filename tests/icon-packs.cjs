const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');

const native=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/LocalAppIconProvider.kt','utf8');
const studio=fs.readFileSync('app/src/main/assets/native-icons.js','utf8');
const orbit=fs.readFileSync('app/src/main/assets/orbit-theme.js','utf8');
const providerPacks=[...native.matchAll(/^\s+"([a-z]+)" to intArrayOf\(/gm)].map(x=>x[1]);
const packNames=[...studio.matchAll(/^  \["([a-z]+)","[^"]+","[^"]+"/gm)].map(x=>x[1]);
assert.equal(providerPacks.length,20,'Android must provide 20 distinct icon palettes');
assert.equal(packNames.length,20,'Icon Studio must expose all 20 palettes');
assert.deepEqual(providerPacks,packNames,'all displayed packs must be backed by native generation');
assert.match(native,/pack-\[a-z0-9-\]/,'native provider must recognize pack routes');
assert.match(native,/!isLaunchable\(pkg\)/,'must not grant arbitrary installed-app icon access');
assert.match(native,/LruCache<String, ByteArray>/,'generated icon memory cache remains bounded');
assert.match(orbit,/audioDeskOrbitRedrawIcons/,'changing packs must update the Orbit radial rings');
assert.match(studio,/ad_icon_studio_pack_v1_/,'packs are persisted per launcher theme');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const mockApps=Array.from({length:8},(_,i)=>({
   pkg:'com.example.icon'+i,activity:'MainActivity',label:['Music','Messages','Files','Browser','Photos','Calendar','Camera','Shop'][i],
   uses:9-i,icon:''
  }));
  await page.addInitScript(apps=>{
   window.AudioDesk={
    supportsAdaptiveAppIcons(){return true},
    requestLauncherApps(){window.receiveLauncherApps?.(apps,[{...apps[0],opened:Date.now()}],true)},
    requestMediaState(){window.receiveAudioDeskMedia?.({enabled:false,available:false})},
    setStatusBarTheme(){},setRefreshEnabled(){},isDefaultLauncher(){return false}
   };
  },mockApps);
  const iconBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGM8P33jfwY8gAmf5PBRAAAwGQMm1+BwEAAAAABJRU5ErkJggg==','base64');
  const seen=[];
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',
     body:fs.readFileSync('app/src/main/assets/index.html')});
   if(url.includes('/app-icons/')){
    seen.push(new URL(url).pathname);
    return route.fulfill({contentType:'image/png',body:iconBytes});
   }
   if(require('./serve-assets.cjs')(route))return;
   if(url.includes('api.rss2json.com')||url.includes('api.github.com'))
    return route.fulfill({json:{items:[],status:'ok'}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.waitForFunction(()=>window.audioDeskIconStudio?.nativeReady&&launcherApps.length===8);
  await page.evaluate(()=>setLauncherTheme('minimal'));
  await page.evaluate(()=>audioDeskIconStudio.open());
  const modeCards=await page.locator('#launcherIconStudioDialog [data-icon-mode]')
   .evaluateAll(buttons=>buttons.map(b=>{
    const r=b.getBoundingClientRect(),s=getComputedStyle(b);
    return {width:r.width,height:r.height,font:s.fontFamily};
   }));
  assert.equal(modeCards.length,4);
  assert.ok(modeCards.every(x=>x.width>=135&&x.height>=70),
   'mode cards must be wide enough to read, not fragmented into tiny text columns');
  assert.ok(modeCards.every(x=>/system-ui|Segoe UI/.test(x.font)),
   'functional Icon Studio controls should use readable non-pixel typography');
  await page.setViewportSize({width:320,height:680});
  const compactModes=await page.locator('#launcherIconStudioDialog [data-icon-mode]')
   .evaluateAll(buttons=>buttons.map(b=>b.getBoundingClientRect().width));
  assert.ok(compactModes.every(w=>w>=225),'320px devices get full-width, readable Icon Studio choices');
  await page.setViewportSize({width:393,height:852});
  assert.equal(await page.locator('[data-icon-pack-choice]').count(),20);
  assert.equal(await page.locator('[data-icon-mode]').count(),4);
  const named=await page.locator('[data-icon-pack-choice] strong').allInnerTexts();
  assert.equal(new Set(named).size,20,'each icon pack has its own title');
  await page.locator('[data-icon-pack-choice="copper"]').click();
  assert.equal(await page.evaluate(()=>audioDeskIconStudio.mode()),'pack');
  assert.equal(await page.evaluate(()=>audioDeskIconStudio.pack()),'copper');
  assert.equal(await page.locator('[data-icon-pack-choice="copper"]').getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>{document.getElementById('iconStudioDone').click();setLauncherPage('apps',false)});
  const sources=await page.locator('#launcherAppsGrid .ad-icon-image').evaluateAll(images=>
   images.map(i=>new URL(i.src).pathname));
  assert.equal(sources.length,8,'every app gets the selected pack');
  assert.ok(sources.every(s=>s.startsWith('/app-icons/pack-copper/com.example.icon')),
   'the selected pack must change actual Android icon URLs');
  assert.equal(await page.locator('#launcherAppsGrid .ad-icon-shell[data-icon-pack="copper"]').count(),8);
  const surface=await page.locator('#launcherAppsGrid .ad-icon-shell').first().evaluate(e=>({
   border:getComputedStyle(e).borderRadius,
   background:getComputedStyle(e).backgroundImage,
   edge:getComputedStyle(e).borderTopColor
  }));
  assert.notEqual(surface.border,'0px','copper supplies its own visual shape');
  assert.ok(surface.background.includes('linear-gradient'),'copper adds a distinct surface treatment');
  await page.evaluate(()=>audioDeskIconStudio.setPack('arcade'));
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#launcherAppsGrid .ad-icon-image'))
    .every(i=>i.src.includes('pack-arcade')));
  assert.equal(await page.locator('#launcherAppsGrid .ad-icon-shell[data-icon-pack="arcade"]').count(),8);
  const arcadeRadius=await page.locator('#launcherAppsGrid .ad-icon-shell').first()
   .evaluate(e=>getComputedStyle(e).borderRadius);
  assert.equal(arcadeRadius,'0px','pixel pack has real square corners');
  await page.evaluate(()=>audioDeskIconStudio.setPack('glass'));
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#launcherAppsGrid .ad-icon-image'))
    .every(i=>i.src.includes('pack-glass')));
  await page.evaluate(()=>{setLauncherTheme('orbit');setLauncherPage('home',false)});
  assert.equal(await page.evaluate(()=>audioDeskIconStudio.mode()),'themed',
   'each launcher theme has its own independent selection');
  await page.evaluate(()=>audioDeskIconStudio.setPack('ocean'));
  await page.waitForFunction(()=>document.querySelector('#orbitRecents image[href*="pack-ocean"]'));
  assert.ok(await page.locator('#orbitRecents image[href*="/app-icons/pack-ocean/"]').count()>0,
   'Orbit radial app ring must use the selected pack too');
  await page.evaluate(()=>{setLauncherTheme('minimal');setLauncherPage('apps',false)});
  assert.equal(await page.evaluate(()=>audioDeskIconStudio.pack()),'glass',
   'returning to previous theme restores its chosen pack');
  await page.evaluate(()=>audioDeskIconStudio.setMode('original'));
  const originals=await page.locator('#launcherAppsGrid .ad-icon-image').evaluateAll(images=>images.map(i=>i.src));
  if(originals.length)assert.ok(originals.every(s=>s.includes('/app-icons/original/')),
    'original app icons must remain available');
  await page.evaluate(()=>audioDeskIconStudio.setMode('outline'));
  assert.equal(await page.locator('#launcherAppsGrid .ad-icon-shell').count(),0,
   'simple outline mode remains an intact fallback');
  // Warm app-list fallback formerly drew white stroke on a pale cream tile,
  // appearing as a blank square in the visual QA screenshots.
  await page.evaluate(()=>{setLauncherTheme('warm');setLauncherPage('apps',false);audioDeskIconStudio.setMode('themed')});
  const warmContrast=await page.locator('#launcherAppsGrid .ad-icon-shell').first().evaluate(shell=>{
   const icon=shell.querySelector('.ad-icon-fallback svg');
   const rgb=s=>Array.from(s.matchAll(/\d+(?:\.\d+)?/g),x=>Number(x[0])).slice(0,3);
   const lum=values=>{
    const linear=values.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});
    return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
   };
   const foreground=lum(rgb(getComputedStyle(icon).stroke));
   const background=lum(rgb(getComputedStyle(shell).backgroundColor));
   return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
  });
  assert.ok(warmContrast>=3,'Warm icon SVGs need visible contrast against their own tile: '+warmContrast);
  assert.ok(seen.some(s=>s.includes('/app-icons/pack-copper/')));
  assert.deepEqual(errors,[],'pack switching must not crash any launcher layout');
  console.log('PASS: 20 free pack presets, local app icons, Orbit ring, per-theme persistence and classic-mode fallback');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
