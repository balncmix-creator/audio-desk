const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const demoApps=[
 {pkg:'com.example.reaper',activity:'com.example.reaper.Main',label:'REAPER Remote',icon:'',uses:9},
 {pkg:'com.example.files',activity:'com.example.files.Main',label:'Files',icon:'',uses:2},
 {pkg:'com.example.browser',activity:'com.example.browser.Main',label:'Browser',icon:'',uses:4},
 {pkg:'com.example.recorder',activity:'com.example.recorder.Main',label:'Recorder',icon:'',uses:12},
 {pkg:'com.example.player',activity:'com.example.player.Main',label:'Music',icon:'',uses:1},
 {pkg:'com.example.settings',activity:'com.example.settings.Main',label:'Settings',icon:'',uses:0},
 {pkg:'com.example.camera',activity:'com.example.camera.Main',label:'Camera',icon:'',uses:0},
 {pkg:'com.example.audio',activity:'com.example.audio.Main',label:'Audio Tools',icon:'',uses:0}
];
(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1,hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.addInitScript(apps=>{
   window.appLaunchCalls=[];window.makeDefaultRequests=0;
   window.launcherDemoApps=apps;window.launcherDemoHistory=[];
   window.AudioDesk={
    requestLauncherApps(){setTimeout(()=>window.receiveLauncherApps(
     window.launcherDemoApps,window.launcherDemoHistory,window.makeDefaultRequests>0),0)},
    launchExternalApp(pkg,activity){
     window.appLaunchCalls.push([pkg,activity]);
     const match=window.launcherDemoApps.find(x=>x.pkg===pkg&&x.activity===activity);
     if(match){
      match.uses=(match.uses||0)+1;
      window.launcherDemoHistory=[{...match,opened:Date.now()},
       ...window.launcherDemoHistory.filter(x=>x.pkg!==pkg)];
     }
     window.launcherLaunchResult(!!match);
    },
    requestDefaultLauncher(){
     window.makeDefaultRequests++;
     window.receiveLauncherApps(window.launcherDemoApps,window.launcherDemoHistory,true);
    }
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
   if(url.includes('api.rss2json.com'))
    return route.fulfill({json:{status:'ok',items:[
     {title:'A new REAPER editing script',link:'https://example.test/reaper',
      description:'REAPER post-production tools',pubDate:'2026-11-14T12:00:00Z'}
    ]}});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('GitHub:'));
  await page.waitForFunction(()=>launcherApps.length===8);
  assert.equal(await page.evaluate(()=>launcherPage),'home','launcher must open on favorites Home');
  assert.equal(await page.locator('#launcherHomePage').isVisible(),true);
  assert.equal(await page.locator('#launcherNavigation').isVisible(),false,
   'Home has no visible tab bar');
  assert.equal(await page.locator('#launcherHomeOptions').isVisible(),false,
   'Home controls are tucked away behind one small button');
  assert.equal(await page.locator('#launcherSettingsToggle').isVisible(),true);
  assert.equal(await page.locator('#launcherHomeSetup').isVisible(),false);
  assert.equal(await page.locator('#launcherFavorites .n-star').first().isVisible(),false,
   'Home list has no distracting pin icons');
  assert.equal(await page.locator('header').isVisible(),false);
  assert.equal(await page.locator('#stories .story').count(),1,'news remains cached');
  assert.equal(await page.locator('#launcherFavorites .n-app-row').count(),8);
  assert.match(await page.locator('#launcherFavorites .n-app-row').first().textContent(),/Recorder/);
  assert.equal(await page.locator('[data-home-nav="home"].active').count(),1);
  assert.match(await page.locator('#densityHint').textContent(),/PINCH IN/);

  await page.locator('#launcherSettingsToggle').click();
  assert.equal(await page.locator('#launcherHomeOptions').isVisible(),true);
  await page.locator('#launcherAllApps').click();
  assert.equal(await page.locator('#launcherHomeOptions').isVisible(),false);
  assert.equal(await page.evaluate(()=>launcherPage),'apps');
  assert.equal(await page.locator('#launcherAppsGrid .n-app-row').count(),8,'all installed apps shown alphabetically');
  assert.equal(await page.locator('#launcherAlphaIndex [data-launcher-letter]').count(),26);
  await page.locator('#launcherAlphaIndex [data-launcher-letter="R"]').click();
  assert.equal(await page.locator('#launcherAlphaIndex [data-launcher-letter="R"].active').count(),1);
  await page.locator('#launcherAppSearch').fill('reap');
  assert.equal(await page.locator('#launcherAppsGrid .n-app-row').count(),1);
  assert.equal(await page.locator('#launcherAlphaIndex').isVisible(),false);
  await page.locator('#launcherAppsGrid .n-star').click();
  await page.locator('#launcherAppSearch').fill('');
  await page.locator('[data-home-nav="home"]').click();
  assert.match(await page.locator('#launcherFavorites .n-app-row').first().textContent(),/REAPER Remote/,'pinning takes priority');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ar_launcher_pins')).length),1);
  await page.locator('#launcherFavorites .launcher-app').first().click();
  await page.waitForFunction(()=>window.appLaunchCalls.length===1);
  assert.deepEqual((await page.evaluate(()=>window.appLaunchCalls))[0],[
   'com.example.reaper','com.example.reaper.Main'
  ]);
  await page.locator('#launcherSettingsToggle').click();
  await page.locator('#launcherShowRecents').click();
  await page.waitForFunction(()=>!document.getElementById('launcherRecentDrawer').hidden);
  await page.waitForFunction(()=>launcherRecents.length===1);
  assert.equal(await page.locator('#launcherRecentGrid .launcher-recent-card').count(),1);
  await page.locator('#launcherRecentGrid .launcher-resume').click();
  assert.equal(await page.evaluate(()=>window.appLaunchCalls.length),2);
  await page.locator('#launcherMakeDefault').click();
  assert.equal(await page.evaluate(()=>window.makeDefaultRequests),1);
  assert.equal(await page.locator('#launcherMakeDefault').isVisible(),false);
  await page.locator('#launcherOptionsClose').click();

  const swipe=async(target,x0,x1)=>{
   await page.evaluate(({target,x0,x1})=>{
    const el=document.getElementById(target);
    function fire(stage,x,y){
     const t=new Touch({identifier:9,target:el,clientX:x,clientY:y,screenX:x,screenY:y});
     const touches=stage==='touchend'?[]:[t];
     el.dispatchEvent(new TouchEvent(stage,{bubbles:true,cancelable:true,
      touches,targetTouches:touches,changedTouches:[t]}));
    }
    fire('touchstart',x0,260);
    fire('touchmove',(x0+x1)/2,262);
    fire('touchmove',x1,261);
    fire('touchend',x1,261);
   },{target,x0,x1});
  };

  // Home -> apps: swipe RIGHT to LEFT (all-apps direction).
  await swipe('launcherHomePage',335,38);
  assert.equal(await page.evaluate(()=>launcherPage),'apps');
  await swipe('launcherAppsPage',48,343);
  assert.equal(await page.evaluate(()=>launcherPage),'home');
  // Home -> original Audio Desk feed: swipe LEFT to RIGHT.
  await swipe('launcherHomePage',45,345);
  assert.equal(await page.evaluate(()=>launcherPage),'events');
  assert.equal(await page.locator('.story').count(),1);
  await swipe('swipeMain',386,82); // News edge swipe returns to Home.
  assert.equal(await page.evaluate(()=>launcherPage),'home');
  await page.evaluate(()=>window.launcherGoHome());
  assert.equal(await page.evaluate(()=>launcherPage),'home','Android Home intent shows favorites');
  await page.evaluate(()=>window.launcherBack());
  assert.equal(await page.evaluate(()=>launcherPage),'home');
  await page.setViewportSize({width:320,height:640});
  await page.evaluate(()=>setLauncherPage('home',false));
  const metrics=await page.evaluate(()=>({
   bodyWidth:document.body.scrollWidth,
   viewport:innerWidth,
   clockSize:parseFloat(getComputedStyle(document.querySelector('#launcherClock')).fontSize),
   firstBorder:getComputedStyle(document.querySelector('#launcherFavorites .n-app-row')).borderBottomWidth,
   homeNav:getComputedStyle(document.getElementById('launcherNavigation')).display
  }));
  assert.ok(metrics.bodyWidth<=metrics.viewport+1,'minimal Home avoids horizontal overflow on narrow Android');
  assert.ok(metrics.clockSize>=50,'clock is a prominent part of Home');
  assert.equal(metrics.firstBorder,'0px','Home app rows have no dividers');
  assert.equal(metrics.homeNav,'none','no visible navbar on Home');
  assert.deepEqual(errors,[],'no launcher errors');
  console.log('PASS: favorite home, frequent rank, pins, alphabetical rail, search, app launch, local recents, default Home and both swipe directions');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
