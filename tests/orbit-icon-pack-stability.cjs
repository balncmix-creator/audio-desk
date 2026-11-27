const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const native=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/LocalAppIconProvider.kt','utf8');
const orbit=fs.readFileSync('app/src/main/assets/orbit-theme.js','utf8');
assert.match(native,/if \(theme == "windows" && drawable !is AdaptiveIconDrawable/,
 'generated icon packs cannot use destructive white-matte stripping');
assert.doesNotMatch(native,/theme == "windows" \|\| pack != null/,
 'pack native generator must preserve legacy branded glyphs');
assert.match(orbit,/orbit-icon-loaded/,'Orbit fallback must be removed only after the PNG loads');
assert.match(orbit,/orbit-icon-failed/,'invalid icons must keep a safe fallback');
assert.match(orbit,/orbitIconMarkup/,'recents, fan, and widget icon layouts should share the same rendering rule');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  const apps=[
   {pkg:'com.example.audio',activity:'Main',label:'Audio',uses:8},
   {pkg:'com.example.broken',activity:'Main',label:'Broken test',uses:7},
   {pkg:'com.example.chat',activity:'Main',label:'Chat',uses:6},
   {pkg:'com.example.photos',activity:'Main',label:'Photos',uses:5},
   {pkg:'com.example.reaper',activity:'Main',label:'REAPER',uses:4}
  ];
  await page.addInitScript(items=>{
   window.AudioDesk={
    supportsAdaptiveAppIcons(){return true},
    requestLauncherApps(){
     window.receiveLauncherApps?.(items,items.map((app,i)=>({...app,opened:Date.now()-i*1000})),true)
    },
    requestMediaState(){window.receiveAudioDeskMedia?.({enabled:true,available:false})},
    isDefaultLauncher(){return false},setStatusBarTheme(){},
    setRefreshEnabled(){}
   };
  },apps);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGM8P33jfwY8gAmf5PBRAAAwGQMm1+BwEAAAAABJRU5ErkJggg==','base64');
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',body:fs.readFileSync('app/src/main/assets/index.html')});
   if(url.includes('/app-icons/')){
    requests.push(new URL(url).pathname);
    const broken=/com\.example\.broken\.png$/.test(url);
    const packError=url.includes('/pack-')&&url.includes('com.example.audio.png');
    return route.fulfill({contentType:'image/png',body:broken||packError?Buffer.from([]):png});
   }
   if(require('./serve-assets.cjs')(route))return;
   if(url.includes('api.github.com')||url.includes('api.rss2json.com'))
    return route.fulfill({json:{status:'ok',items:[]}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.waitForFunction(()=>window.audioDeskIconStudio?.nativeReady===true&&launcherApps.length===5);
  await page.evaluate(()=>{setLauncherTheme('orbit');setLauncherPage('home',false);audioDeskIconStudio.setPack('copper')});
  await page.waitForFunction(()=>document.querySelectorAll('#orbitRecents .orbit-icon-slot').length>=3);
  await page.waitForFunction(()=>{
   const slots=Array.from(document.querySelectorAll('#orbitRecents .orbit-icon-slot'));
   return slots.filter(s=>s.classList.contains('orbit-icon-loaded')||
     s.classList.contains('orbit-icon-failed')).length>=3;
  },null,{timeout:12000});
  const slots=await page.locator('#orbitRecents .orbit-icon-slot').evaluateAll(elements=>
   elements.map(g=>({
    status:g.className.baseVal,
    text:g.querySelector('text')?.textContent,
    fallback:getComputedStyle(g.querySelector('.orbit-icon-fallback')).display,
    image:g.querySelector('image')?.getAttribute('href'),
    imageVisible:g.querySelector('image')?getComputedStyle(g.querySelector('image')).visibility:null,
    tile:g.querySelector('.orbit-icon-tile')?.getAttribute('fill')
   })));
  assert.ok(slots.length>=3,'recent apps have SVG pack tiles');
  assert.ok(slots.some(s=>s.status.includes('orbit-icon-loaded')),'at least one pack image genuinely loads');
  assert.ok(slots.filter(s=>s.status.includes('orbit-icon-loaded')).every(s=>s.fallback==='none'),
   'loaded native app icon must never overlap its fallback letter: '+JSON.stringify(slots));
  assert.ok(slots.filter(s=>s.status.includes('orbit-icon-loaded')).every(s=>s.imageVisible==='visible'),
   'loaded icons are visible and not placeholders');
  assert.ok(slots.every(s=>s.text.length<=2),'no truncated app names behind pack glyphs');
  assert.ok(slots.every(s=>s.tile==='#482f25'),'radial app tiles share the chosen Copper pack palette');
  assert.ok(requests.some(s=>s.includes('/app-icons/pack-copper/com.example.audio.png')));
  assert.ok(requests.some(s=>s.includes('/app-icons/original/com.example.audio.png')),
   'broken generated icon retries original app PNG before showing fallback');
  const brokenSlots=slots.filter(s=>s.status.includes('orbit-icon-failed'));
  assert.ok(brokenSlots.length>=1,'unavailable app renders a fallback tile');
  assert.ok(brokenSlots.every(s=>s.fallback!=='none'),
   'failed image still has a readable single-letter fallback');
  // Actual touch hit-test on a recent radial icon, not a fabricated DOM event.
  const hit=await page.evaluate(()=>{
   for(const el of document.querySelectorAll('#orbitRecents [data-orbit-action^="recent:"]')){
    const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    if(x>0&&y>0&&x<innerWidth&&y<innerHeight&&document.elementFromPoint(x,y)?.closest('[data-orbit-action]')===el)return {x,y};
   }return null;
  });
  assert.ok(hit,'a radial recent icon must be touchable');
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[hit]});
  await page.waitForTimeout(600);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await page.locator('#appManageSheet').isVisible(),true,'radial recents long press opens viewport management');
  await page.locator('#appManageSheet [data-manage="close"]').click();
  const widgetText=await page.locator('#orbitWidgets').textContent();
  assert.ok((widgetText.match(/NO ACTIVE PLAYER/g)||[]).length<=1,
   'idle media panel does not duplicate status labels');
  assert.equal(await page.locator('#orbitWidgets [data-orbit-action="media:toggle"]').count(),0,
   'idle player must not show disabled controls over the label');
  // Same atomic loading/failure design is used when A-Z fan is expanded.
  await page.locator('#orbitLetters [data-orbit-action="letter:A"]').dispatchEvent('click');
  await page.waitForFunction(()=>document.querySelector('#orbitAppIconLayers .orbit-icon-slot'));
  await page.waitForFunction(()=>{
   const s=document.querySelector('#orbitAppIconLayers .orbit-icon-slot');
   return s&&(s.classList.contains('orbit-icon-loaded')||s.classList.contains('orbit-icon-failed'));
  });
  const fanFallback=await page.locator('#orbitAppIconLayers .orbit-icon-slot.orbit-icon-loaded .orbit-icon-fallback').first()
   .evaluate(e=>getComputedStyle(e).display);
  assert.equal(fanFallback,'none','A-Z picker icons also hide fallback when loaded');
  assert.deepEqual(errors,[],'icon pack changes must not crash Orbit');
  console.log('PASS: Orbit icon pack is legible, no stacked letters, original PNG retry, bad-source fallback, A-Z fan, idle music UI');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
