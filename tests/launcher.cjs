const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const demoApps=[
 {pkg:'com.example.reaper',activity:'com.example.reaper.Main',label:'REAPER Remote',icon:''},
 {pkg:'com.example.files',activity:'com.example.files.Main',label:'Files',icon:''},
 {pkg:'com.example.browser',activity:'com.example.browser.Main',label:'Browser',icon:''},
 {pkg:'com.example.recorder',activity:'com.example.recorder.Main',label:'Recorder',icon:''},
 {pkg:'com.example.player',activity:'com.example.player.Main',label:'Music',icon:''},
 {pkg:'com.example.settings',activity:'com.example.settings.Main',label:'Settings',icon:''}
];
(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1,hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.addInitScript((apps)=>{
   window.appLaunchCalls=[];
   window.makeDefaultRequests=0;
   window.launcherDemoApps=apps;
   window.launcherDemoHistory=[];
   window.AudioDesk={
    requestLauncherApps(){setTimeout(()=>window.receiveLauncherApps(
     window.launcherDemoApps,window.launcherDemoHistory,window.makeDefaultRequests>0),0)},
    launchExternalApp(pkg,activity){
     window.appLaunchCalls.push([pkg,activity]);
     const match=window.launcherDemoApps.find(x=>x.pkg===pkg&&x.activity===activity);
     if(match)window.launcherDemoHistory=[{...match,opened:Date.now()},
      ...window.launcherDemoHistory.filter(x=>x.pkg!==pkg)];
     window.launcherLaunchResult(!!match);
    },
    requestDefaultLauncher(){
     window.makeDefaultRequests++;
     window.receiveLauncherApps(window.launcherDemoApps,window.launcherDemoHistory,true);
    },
    isDefaultLauncher(){return window.makeDefaultRequests>0}
   };
  },demoApps);
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',body:fs.readFileSync(
     path.join(__dirname,'../app/src/main/assets/index.html'),'utf8')});
   if(url.endsWith('/assets/desk-premium.webp'))
    return route.fulfill({contentType:'image/webp',body:fs.readFileSync(
     path.join(__dirname,'../app/src/main/assets/desk-premium.webp'))});
   if(url.includes('api.rss2json.com'))return route.fulfill({json:{status:'ok',items:[
    {title:'A new REAPER editing script',link:'https://example.test/reaper',
     description:'REAPER post-production tools',pubDate:'2026-11-14T12:00:00Z'}
   ]}});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('GitHub:'));
  assert.equal(await page.evaluate(()=>launcherPage),'events','news remains launcher home');
  assert.equal(await page.locator('#stories .story').count(),1);
  assert.equal(await page.locator('[data-home-nav]').count(),3);
  assert.match(await page.locator('#densityHint').textContent(),/PINCH IN/);

  await page.locator('[data-home-nav="apps"]').click();
  await page.waitForFunction(()=>launcherApps.length===6);
  assert.equal(await page.evaluate(()=>launcherPage),'apps');
  assert.equal(await page.locator('#launcherAppsGrid button').count(),6);
  assert.equal(await page.locator('#launcherAppsPage').isVisible(),true);
  assert.equal(await page.locator('header').isVisible(),false);
  assert.equal(await page.locator('.bottom-dock').isVisible(),false);
  assert.equal(await page.locator('#launcherHomeStatus').textContent(),
   'CHOOSE AUDIO DESK AS YOUR DEFAULT HOME APP IN ANDROID SETTINGS.');
  await page.locator('#launcherAppSearch').fill('reap');
  assert.equal(await page.locator('#launcherAppsGrid button').count(),1);
  await page.locator('#launcherAppsGrid button').click();
  await page.waitForFunction(()=>window.appLaunchCalls.length>0);
  const calls=await page.evaluate(()=>window.appLaunchCalls);
  assert.deepEqual(calls[0],['com.example.reaper','com.example.reaper.Main']);
  await page.locator('#launcherAppSearch').fill('');
  await page.locator('#launcherMakeDefault').click();
  assert.equal(await page.evaluate(()=>window.makeDefaultRequests),1);
  assert.equal(await page.locator('#launcherMakeDefault').isVisible(),false);

  await page.locator('[data-home-nav="recents"]').click();
  assert.equal(await page.locator('#launcherRecentGrid .launcher-recent-card').count(),1);
  assert.match(await page.locator('#launcherRecentGrid').textContent(),/REAPER Remote/);
  assert.match(await page.locator('#launcherRecentsPage .note').textContent(),/RECENTLY LAUNCHED/i);
  await page.locator('.launcher-recent-card button').click();
  assert.equal(await page.evaluate(()=>window.appLaunchCalls.length),2);

  const send=async(stage,target,x,y)=>{
   await page.evaluate(({stage,target,x,y})=>{
    const el=document.getElementById(target);
    const t=new Touch({identifier:19,target:el,clientX:x,clientY:y,screenX:x,screenY:y});
    const touches=stage==='touchend'?[]:[t];
    el.dispatchEvent(new TouchEvent(stage,{bubbles:true,cancelable:true,
     touches,targetTouches:touches,changedTouches:[t]}));
   },{stage,target,x,y});
  };
  const swipe=async(target,x0,x1)=>{
   await send('touchstart',target,x0,270);
   await send('touchmove',target,(x0+x1)/2,272);
   await send('touchmove',target,x1,271);
   await send('touchend',target,x1,271);
  };
  // Full-page horizontal swipe from Open Apps to Applications.
  await swipe('launcherRecentsPage',45,340);
  assert.equal(await page.evaluate(()=>launcherPage),'apps');
  // And from Applications to Events.
  await swipe('launcherAppsPage',45,345);
  assert.equal(await page.evaluate(()=>launcherPage),'events');
  assert.equal(await page.locator('#stories .story').count(),1,'news remains cached');
  // From the RIGHT SCREEN EDGE, swipe left to Applications without stealing
  // a regular news tab swipe originating within the content.
  await swipe('swipeMain',388,100);
  assert.equal(await page.evaluate(()=>launcherPage),'apps','N9 style edge swipe works');
  await page.evaluate(()=>window.launcherBack());
  assert.equal(await page.evaluate(()=>launcherPage),'events','back returns Home');
  assert.deepEqual(errors,[],'launcher has no JavaScript errors');
  console.log('PASS: Home/Events, installed apps, search, native launch bridge, recent reopen, role request, swipe gestures, return to news');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
