const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const serve=require('./serve-assets.cjs');

const apps=[
 {pkg:'com.example.music',activity:'Main',label:'Music',uses:4},
 {pkg:'com.example.files',activity:'Main',label:'Files',uses:3},
 {pkg:'com.example.camera',activity:'Main',label:'Camera',uses:2},
 {pkg:'com.example.browser',activity:'Main',label:'Browser',uses:1}
];
const origin='https://appassets.androidplatform.net/assets/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const createPage=async profile=>{
   const page=await browser.newPage({
    viewport:{width:393,height:873},deviceScaleFactor:2.75,
    hasTouch:true,isMobile:true
   });
   page.on('pageerror',e=>{throw e});
   await page.addInitScript(({profile,apps})=>{
    window.AudioDesk={
     getOrbitDeviceProfile(){return profile},
     requestLauncherApps(){
      setTimeout(()=>window.receiveLauncherApps?.(
       apps,[{...apps[0],opened:Date.now()}],true),0)
     },
     requestNativeWidgets(){},layoutNativeWidgets(){},
     requestMediaState(){},setStatusBarTheme(){},
     supportsAdaptiveAppIcons(){return true},
     isDefaultLauncher(){return true}
    };
   },{profile,apps});
   await page.route('**/*',route=>{
    const url=route.request().url();
    if(url===origin+'index.html')
     return route.fulfill({contentType:'text/html',
      body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'))});
    if(serve(route))return;
    if(url.includes('api.github.com')||url.includes('api.rss2json.com'))
     return route.fulfill({json:{status:'ok',items:[]}});
    return route.abort();
   });
   await page.goto(origin+'index.html');
   await page.evaluate(()=>{
    document.documentElement.style.setProperty('--status-top','28px');
    document.documentElement.style.setProperty('--system-bottom','24px');
    setLauncherTheme('orbit');
    setLauncherPage('home',false);
   });
   await page.locator('#orbitHome').waitFor({state:'visible'});
   return page;
  };
  const page=await createPage('galaxy-a73');
  const dimensions=()=>page.evaluate(()=>{
   const dial=document.getElementById('orbitHome').getBoundingClientRect();
   const gear=document.getElementById('orbitSettingsGear').getBoundingClientRect();
   return {body:document.body.classList.contains('orbit-galaxy-a73'),
    x:dial.x,y:dial.y,width:dial.width,height:dial.height,
    bottom:dial.bottom,right:dial.right,screenWidth:innerWidth,screenHeight:innerHeight,
    gearWidth:gear.width,gearHeight:gear.height,gearTop:gear.top};
  });
  const portrait=await dimensions();
  assert.equal(portrait.body,true,'native Galaxy A73 profile activates target CSS');
  assert.ok(Math.abs(portrait.width-393)<2,'portrait dial uses available A73 width');
  assert.ok(Math.abs(portrait.bottom-(portrait.screenHeight-24))<2,
   'radial controls stay above actual One UI navigation inset, not under it');
  assert.ok(portrait.y>28,'dial does not cover the status bar or punch-hole area');
  assert.ok(portrait.gearTop>=38&&portrait.gearWidth>=48&&portrait.gearHeight>=48,
   'A73 settings gear has 48x48 touch target below status bar');
  await page.setViewportSize({width:360,height:800});
  const zoomed=await dimensions();
  assert.ok(zoomed.width<=360&&zoomed.x>=-1,'display zoom cannot push radial offscreen');
  assert.ok(Math.abs(zoomed.bottom-(800-24))<2,'navigation inset survives display zoom');
  await page.setViewportSize({width:873,height:393});
  const landscape=await dimensions();
  assert.ok(landscape.width<=335&&landscape.y>=28,
   'landscape dial must fit between status and gesture bars');
  assert.ok(Math.abs(landscape.bottom-(393-24))<2,
   'landscape controls also avoid Samsung gesture area');
  await page.setViewportSize({width:393,height:873});

  // Fast 120Hz touch bursts update state immediately, but only repaint SVG
  // after one animation-frame batch. The last touch remains visible on release.
  const pointerTest=await page.evaluate(async()=>{
   const svg=document.querySelector('#orbitDial'),ring=document.querySelector('#orbitLetters');
   const rect=svg.getBoundingClientRect();
   svg.setPointerCapture=()=>{};
   const pt=a=>({
    clientX:rect.right-86*Math.cos(a*Math.PI/180)*rect.width/334,
    clientY:rect.bottom-86*Math.sin(a*Math.PI/180)*rect.height/334
   });
   const send=(name,a)=>svg.dispatchEvent(new PointerEvent(name,{
    bubbles:true,pointerId:77,button:0,...pt(a)
   }));
   send('pointerdown',16);
   const html=ring.innerHTML;
   const observer=new MutationObserver(()=>{changes++});
   let changes=0;observer.observe(ring,{childList:true,subtree:true});
   for(let i=0;i<26;i++)send('pointermove',16+i*.85);
   const immediate=ring.innerHTML;
   await new Promise(resolve=>requestAnimationFrame(resolve));
   const afterFrame=ring.innerHTML;
   const changesAfterFrame=changes;
   send('pointerup',38);
   await new Promise(resolve=>requestAnimationFrame(resolve));
   observer.disconnect();
   return {coalesced:html===immediate,painted:afterFrame!==html,
    changesAfterFrame,gestureClass:document.body.classList.contains('orbit-gesture-active')};
  });
  assert.equal(pointerTest.coalesced,true,'26 rapid touch moves cannot cause 26 SVG rebuilds');
  assert.equal(pointerTest.painted,true,'the ring visibly moves by the next animation frame');
  assert.ok(pointerTest.changesAfterFrame<6,
   'A73 high-frequency touch stream should generate one SVG paint batch');
  assert.equal(pointerTest.gestureClass,false,
   'GPU blur and gesture state restore after pointer release');

  const generic=await createPage('generic');
  const neutral=await generic.evaluate(()=>{
   const box=document.getElementById('orbitHome').getBoundingClientRect();
   return {hasClass:document.body.classList.contains('orbit-galaxy-a73'),
    bottom:box.bottom,screenHeight:innerHeight};
  });
  assert.equal(neutral.hasClass,false,'other phone models are not forced into Galaxy profile');
  assert.ok(Math.abs(neutral.bottom-neutral.screenHeight)<2,
   'legacy layout remains unchanged on generic phones');
  await generic.close();await page.close();
  console.log('PASS: A73/One UI portrait, display zoom, landscape safe insets, 48px settings, 120Hz pointer coalescing and generic fallback');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
