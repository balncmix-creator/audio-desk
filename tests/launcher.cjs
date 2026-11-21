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
   window.nativeLayoutRequests=[];window.nativePickerOpen=0;window.nativeDeleteCalls=[];
   window.systemWallpaperCalls=[];
   window.launcherDemoApps=apps;window.launcherDemoHistory=[];
   window.AudioDesk={
    layoutNativeWidgets(payload){window.nativeLayoutRequests.push(JSON.parse(payload))},
    requestNativeWidgets(){},
    openNativeWidgets(){window.nativePickerOpen++},
    setSystemWallpaperCustom(data,position,lock,request){window.systemWallpaperCalls.push({data,position,lock,request})},
    deleteNativeWidget(id){window.nativeDeleteCalls.push(id)},
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
  const localAsset = require('./serve-assets.cjs')(route); if(localAsset)return localAsset;
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
   // QA: the browser has no internet. Keep image identity/credits real but mock bytes.
   if(url.startsWith('https://images.unsplash.com/'))
    return route.fulfill({status:200,contentType:'image/png',
     headers:{'Access-Control-Allow-Origin':'*'},
     body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAFElEQVR4nGP0LethYGBgYmBgQFAAGPIBVaOwJEQAAAAASUVORK5CYII=','base64')});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('GitHub:'));
  await page.waitForFunction(()=>launcherApps.length===8);
  const ranking=await page.evaluate(()=>rankedLauncherApps('nin',[
   {label:'Awakening',pkg:'example.awakening',activity:'a'},
   {label:'LibreTorrent',pkg:'example.nin.libre',activity:'b'},
   {label:'Ninja VPN',pkg:'example.vpn',activity:'c'}]).map(a=>a.label));
  assert.equal(ranking[0],'Ninja VPN','label prefix outranks unrelated package and substring matches');
  assert.ok(!ranking.includes('LibreTorrent'),'package-only results are suppressed when names match');
  const habitResult=await page.evaluate(()=>{
   const oldApps=launcherApps,oldPins=launcherPins;
   try{
    launcherPins=[];
    launcherApps=[
     {label:'Daily music',pkg:'example.music',activity:'a',usageDays:12,habitScore:10,uses:13},
     {label:'One-off app',pkg:'example.once',activity:'b',usageDays:1,habitScore:1.15,uses:200},
     {label:'Daily messages',pkg:'example.messages',activity:'c',usageDays:6,habitScore:6,uses:8},
     {label:'New app',pkg:'example.new',activity:'d',usageDays:2,habitScore:2,uses:60}
    ];
    return launcherSuggestedApps().map(a=>a.label);
   }finally{launcherApps=oldApps;launcherPins=oldPins}
  });
  assert.deepEqual(habitResult,['Daily music','Daily messages'],
   'habit ranking requires distinct active days and ignores one-off high launch counts');
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
  assert.equal(await page.locator('#launcherFavorites .n-app-row').count(),0,'Minimal Home has no duplicate app list');
  assert.equal(await page.locator('#launcherRecentQuick .launcher-app').count(),6,'Minimal Home has six suggested rows until local history exists');
  assert.equal(await page.locator('#launcherRecentQuick .warm-line-icon svg').count(),6,
   'Minimal uses modern outline app symbols instead of Pixel theme sprites');
  const recentLayout=await page.locator('#launcherRecentQuick').evaluate(el=>{
   const rows=[...el.querySelectorAll('.launcher-app')];
   const a=rows[0].getBoundingClientRect(),b=rows[1].getBoundingClientRect();
   const icon=rows[0].querySelector('.warm-line-icon').getBoundingClientRect();
   return {direction:getComputedStyle(el).flexDirection,stacked:b.top>=a.bottom-1,iconOnLeft:icon.left<a.left+a.width/2};
  });
  assert.equal(recentLayout.direction,'column');
  assert.ok(recentLayout.stacked&&recentLayout.iconOnLeft,'recent app shortcuts are vertical icon-and-label rows');
  assert.match(await page.locator('#launcherRecentStripTitle').textContent(),/FREQUENTLY USED/);
  assert.equal(await page.locator('#launcherAlphaIndex').isVisible(),true,'Home shows quick alphabetical rail');
  await page.locator('#launcherAlphaIndex [data-launcher-letter="R"]').click();
  assert.equal(await page.locator('#launcherLetterPanel').isVisible(),true);
  assert.match(await page.locator('#launcherLetterApps').textContent(),/Recorder|REAPER Remote/);
  await page.locator('#launcherLetterClose').click();
  assert.equal(await page.locator('#launcherLetterPanel').isVisible(),false);
  assert.equal(await page.locator('[data-home-nav="home"].active').count(),1);
  assert.match(await page.locator('#densityHint').textContent(),/PINCH IN/);

  await page.locator('#launcherSettingsToggle').click();
  assert.equal(await page.locator('#launcherHomeOptions').isVisible(),true);
  assert.equal(await page.locator('#launcherHomeOptions').evaluate(el=>getComputedStyle(el).userSelect),'none','long-pressing options should not select menu text');
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
  await page.locator('#launcherSettingsToggle').click();
  await page.locator('#launcherThemeChoose').click();
  await page.locator('[data-launcher-theme-choice="warm"]').click();
  assert.equal(await page.evaluate(()=>launcherTheme),'warm','Warm Minimal is a fourth selectable theme');
  assert.equal(await page.locator('#launcherMusicWidget').isVisible(),true,'all themes include the media widget');
  await page.waitForTimeout(240);
  const musicRail=await page.evaluate(()=>{
   const music=document.getElementById('launcherMusicWidget').getBoundingClientRect();
   const rail=document.getElementById('launcherAlphaIndex').getBoundingClientRect();
   return {gap:rail.left-music.right,musicRight:music.right,railLeft:rail.left,
    width:getComputedStyle(document.getElementById('launcherMusicWidget')).width};
  });
  assert.ok(musicRail.gap>=8,'Warm media controls must not intersect A–Z navigation: '+JSON.stringify(musicRail));
  assert.equal(await page.evaluate(()=>window.audioDeskBeginWidgetResize('launcherMusicWidget')),true,
   'long press opens a widget resize surface');
  assert.equal(await page.locator('#widgetLayoutOverlay .widget-resize-handle').count(),8,
   'widget editor offers four corners plus four independently draggable sides');
  assert.equal(await page.locator('#widgetLayoutOverlay .layout-move-handle').count(),1,
   'selected widget has a move grip');
  await page.locator('#widgetLayoutOverlay [data-edge="se"]').focus();
  await page.keyboard.press('ArrowDown');
  assert.ok(await page.locator('#launcherMusicWidget').evaluate(el=>
   el.style.getPropertyValue('--user-widget-height').endsWith('px')),
   'resizing is keyboard accessible and changes widget dimensions');
  await page.locator('#widgetLayoutOverlay [data-layout-control="done"]').click();
  assert.equal(await page.locator('#launcherMusicWidget').evaluate(el=>getComputedStyle(el).fontFamily.includes('system-ui')),true);
  assert.equal(await page.locator('#launcherHomeOptions').isVisible(),false);
  await page.locator('#launcherSettingsToggle').click();
  assert.equal(await page.locator('#launcherOptionsSheet .launcher-options-heading').evaluate(el=>getComputedStyle(el).fontFamily.includes('system-ui')),true,
   'Warm quick actions and settings use system sans, not pixel glyphs');
  assert.equal(await page.locator('#launcherThemeChoose').textContent().then(x=>x.includes('Choose theme')),true,
   'Warm settings use themed labels');
  await page.locator('#launcherOptionsClose').click();
  await page.locator('#launcherHomeOptions').waitFor({state:'hidden'});
  assert.equal(await page.locator('#warmWidgets').isVisible(),true,'rounded Warm Minimal widgets display on Home');
  assert.equal(await page.locator('#launcherClock').isVisible(),false,'Warm Minimal has its own date card instead of duplicate clock');
  assert.equal(await page.locator('#launcherRecentQuick .launcher-app').count(),7,
   'Warm Minimal renders seven real pinned or frequent app shortcuts');
  assert.match(await page.locator('#launcherRecentStripTitle').textContent(),/FAVORITES & FREQUENT/);
  assert.equal(await page.locator('#launcherRecentQuick').evaluate(el=>getComputedStyle(el).flexDirection),'column');
  assert.equal(await page.locator('#warmDateLabel').textContent(),
   new Date().toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}));
  assert.match(await page.locator('#warmTimeLabel').textContent(),/^\d{2}:\d{2}$/);
  assert.equal(await page.locator('#launcherHomePage').evaluate(el=>getComputedStyle(el,'::before').content),'none',
   'Warm Minimal removes the old 7-shaped diagonal overlay');
  const warmPanel=await page.locator('#launcherRecentStrip').evaluate(el=>{
   const panel=el.getBoundingClientRect();
   const first=el.querySelector('.launcher-app').getBoundingClientRect();
   const icon=el.querySelector('.warm-line-icon').getBoundingClientRect();
   const last=el.querySelector('.launcher-app:last-child').getBoundingClientRect();
   const style=getComputedStyle(el);
   return {clip:style.clipPath,bg:style.backgroundColor,
    panel:[panel.left,panel.right,panel.top,panel.bottom],
    first:[first.left,first.right,first.top,first.bottom],
    icon:[icon.left,icon.right,icon.top,icon.bottom],
    last:[last.left,last.right,last.top,last.bottom]};
  });
  assert.equal(warmPanel.clip,'none','the cream panel is straight, not clipped into a diagonal');
  assert.ok(warmPanel.panel[0]<=warmPanel.first[0]&&warmPanel.panel[1]>=warmPanel.first[1]
   &&warmPanel.first[2]>=warmPanel.panel[2]&&warmPanel.panel[3]>=warmPanel.last[3],
   'all seven favorite rows stay inside the cream panel');
  assert.ok(warmPanel.icon[0]>=warmPanel.panel[0]&&warmPanel.icon[1]<=warmPanel.panel[1]
   &&warmPanel.icon[2]>=warmPanel.panel[2],
   'first app icon is never masked by a color boundary');
  assert.ok(warmPanel.panel[3]>=await page.evaluate(()=>innerHeight),
   'straight cream panel continues to the device bottom without a dark gap');
  const alphaGap=await page.evaluate(()=>{
   const card=document.getElementById('warmAudioWidget').getBoundingClientRect();
   const rail=document.getElementById('launcherAlphaIndex').getBoundingClientRect();
   return rail.left-card.right;
  });
  assert.ok(alphaGap>=8,'top widgets leave breathing room for the A–Z rail');
  assert.equal(await page.locator('#launcherRecentQuick .warm-line-icon svg').count(),7,
   'every Warm Minimal app uses a native-looking line icon');
  assert.equal(await page.locator('#launcherRecentQuick img[src*="pixel-icons"]').count(),0,
   'no 8-bit app artwork appears in Warm Minimal');
  assert.equal(await page.locator('#launcherRecentQuick .pixel-letter').count(),0,
   'no 8-bit fallback letters appear in Warm Minimal');
  assert.equal(await page.locator('#launcherSettingsToggle img').isVisible(),false,
   '8-bit settings icon is hidden when switching to Warm Minimal');
  assert.equal(await page.locator('#launcherSettingsToggle .warm-settings-symbol svg').isVisible(),true,
   'settings control uses a matching outline icon');
  assert.ok((await page.locator('#launcherAlphaIndex button').first().evaluate(el=>getComputedStyle(el).fontFamily)).includes('system-ui'),
   'A–Z labels use modern system typography rather than a pixel font');
  assert.equal(await page.locator('#launcherAlphaIndex').isVisible(),true,'the A–Z rail remains usable');
  await page.locator('#warmSearchWidget').click();
  assert.equal(await page.evaluate(()=>launcherPage),'apps','Warm search opens real installed apps');
  assert.equal(await page.locator('#launcherAppsGrid .warm-line-icon svg').count(),8,
   'All Apps drawer also uses matching outline icons in Warm Minimal');
  assert.equal(await page.locator('#launcherAppsGrid img[src*="pixel-icons"]').count(),0,
   'pixel icons do not leak into the Warm Minimal app drawer');
  assert.equal(await page.locator('#launcherAppSearch').evaluate(el=>document.activeElement===el),true);
  assert.equal(await page.locator('#launcherAppsPage .launcher-titlebar strong').evaluate(el=>getComputedStyle(el).fontFamily.includes('system-ui')),true,
   'Warm All Apps title uses the theme font');
  assert.equal(await page.locator('#launcherAlphaIndex button').first().evaluate(el=>getComputedStyle(el).fontFamily.includes('system-ui')),true,
   'Warm A–Z rail switches to the matching typeface');
  await page.evaluate(()=>setLauncherPage('home',false));
  await page.locator('#warmDateWidget').click();
  assert.equal(await page.evaluate(()=>launcherPage),'apps','date widget opens Calendar search when no Calendar is installed');
  assert.equal(await page.locator('#launcherAppSearch').inputValue(),'calendar');
  await page.evaluate(()=>setLauncherPage('home',false));
  await page.locator('#warmAudioWidget').click();
  assert.equal(await page.evaluate(()=>launcherPage),'events','audio widget opens real Audio Desk news, not fake media playback');
  await page.evaluate(()=>setLauncherPage('home',false));
  assert.equal(await page.evaluate(()=>localStorage.getItem('ad_launcher_theme_v1')),'warm',
   'selected theme persists across app restarts');
  await page.evaluate(()=>openThemePicker());
  await page.locator('[data-launcher-theme-choice="windows"]').click();
  assert.equal(await page.evaluate(()=>launcherTheme),'windows');
  assert.equal(await page.locator('#launcherTilesSearch').isVisible(),true);
  assert.equal(await page.locator('#launcherLiveTiles').isVisible(),true,'Clock, date and news live tiles are visible in Windows theme');
  assert.equal(await page.locator('#launcherLiveTime').textContent()!== "--:--",true);
  assert.equal(await page.locator('#launcherLiveDay').textContent(),String(new Date().getDate()));
  assert.match(await page.locator('#launcherLiveHeadline').textContent(),/REAPER editing script/);
  assert.match(await page.locator('#launcherFavorites .n-app-row').first().textContent(),/REAPER Remote/,'pinned Windows tile takes priority');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ar_launcher_pins')).length),1);
  await page.locator('#launcherFavorites .launcher-app').first().click();
  await page.waitForFunction(()=>window.appLaunchCalls.length===1);
  await page.waitForFunction(()=>launcherRecents.length===1);
  await page.evaluate(()=>setLauncherTheme('minimal'));
  assert.match(await page.locator('#launcherRecentStripTitle').textContent(),/FREQUENTLY USED/);
  assert.equal(await page.locator('#launcherRecentQuick .launcher-app').count(),6);
  assert.match(await page.locator('#launcherRecentQuick .launcher-app').first().textContent(),/REAPER Remote/);
  await page.evaluate(()=>setLauncherTheme('windows'));
  assert.equal(await page.locator('#launcherLiveTiles').isVisible(),true);
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
  await page.locator('#launcherHomeOptions').waitFor({state:'hidden'});

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
  assert.equal(metrics.firstBorder,'0px','Windows tiles have no list dividers');
  assert.equal(metrics.homeNav,'none','no visible navbar on Home');
  await page.evaluate(()=>setLauncherTheme('extreme'));
  assert.equal(await page.evaluate(()=>launcherTheme),'extreme');
  assert.equal(await page.evaluate(()=>lowPowerMode()),true);
  assert.equal(await page.locator('#wallpaperStage').isVisible(),false);
  assert.equal(await page.locator('#launcherMusicWidget').isVisible(),false);
  assert.equal(await page.locator('#launcherYouTubeWidget').isVisible(),false);
  assert.equal(await page.locator('#launcherRecentQuick .launcher-app img').count(),0);
  assert.equal(await page.locator('#extremeSearch').isVisible(),true);
  await page.locator('#extremeSearch').click();
  assert.equal(await page.evaluate(()=>launcherPage),'apps');
  assert.equal(await page.locator('#launcherAppsGrid .ad-icon-image').count(),0);
  await page.evaluate(()=>{setLauncherPage('home',false);setLauncherTheme('windows')});
  assert.equal(await page.locator('#extremeSearch').isVisible(),false);
  assert.equal(await page.evaluate(()=>launcherTheme),'windows');
  // Orbit: real search, live clock, three independently rotating dials,
  // true media state and wallpaper palette; preserve all previous editions.
  await page.evaluate(()=>setLauncherTheme('orbit'));
  await page.locator('#orbitHome').waitFor({state:'visible'});
  assert.equal(await page.locator('#launcherClockWidget').isVisible(),false);
  assert.equal(await page.locator('#launcherMusicWidget').isVisible(),false);
  assert.ok((await page.locator('#orbitClock').textContent()).match(/\d/));
  assert.equal(await page.locator('#orbitWidgets [data-orbit-widget]').count(),3);
  assert.equal(await page.locator('#orbitWidgets [data-orbit-action="connect"]').count(),1,
   'unconnected player has one clear connect action, not redundant transport buttons');
  assert.equal(await page.locator('#orbitWidgets [data-orbit-action="media:toggle"]').count(),0);
  assert.ok((await page.locator('#orbitWidgets').textContent()).includes('CONNECT PLAYER'));
  await page.evaluate(()=>{window.receiveAudioDeskMedia({enabled:true,available:true,playing:true,title:'Orbit test track',artist:'Audio Desk',durationMs:120000,positionMs:45000,canSeek:true,canToggle:true,canPrevious:true,canNext:true})});
  assert.ok((await page.locator('#orbitWidgets').textContent()).includes('Orbit test track'));
  assert.equal(await page.locator('#orbitWidgets [data-orbit-action="media:toggle"]').count(),1,
   'transport controls appear only when a real player is active');
  assert.equal(await page.locator('#orbitWidgets [role="slider"]').count(),1);
  await page.evaluate(()=>{window.orbitCommands=[];window.AudioDesk.mediaCommand=x=>window.orbitCommands.push(x);window.AudioDesk.seekMedia=x=>window.orbitCommands.push(x)});
  await page.locator('#orbitWidgets [data-orbit-action="media:toggle"]').dispatchEvent('click');
  assert.deepEqual(await page.evaluate(()=>window.orbitCommands),['toggle']);
  // Orbit uses private on-device adaptive icons rather than expecting a data: icon
  // in the package manager's app listing.
  await page.evaluate(()=>{
   launcherRecents=window.launcherDemoApps.slice(0,5).map((app,i)=>({...app,opened:Date.now()-i*60000}));
   renderLauncherHome();
  });
  assert.ok((await page.locator('#orbitRecents image[href="/app-icons/orbit/com.example.reaper.png"]').count())>=1,
   'radial recent-app segment requests native device icon by package');
  assert.equal((await page.locator('#orbitRecents').textContent()).includes('REAPER'),false,
   'recent apps are represented by icons, not written app names');
  assert.equal(await page.locator('#orbitAlphabetPointer').count(),1);
  const arrow=await page.locator('#orbitAlphabetPointer path').evaluate(node=>({width:node.getBBox().width,fill:node.getAttribute('fill')}));
  assert.ok(arrow.width>11&&arrow.width<25&&arrow.fill==='#f2fff3','small, visible fixed arrow');
  assert.equal(await page.locator('#orbitLetterMenu').count(),0,'no separate floating app popup');
  await page.locator('#orbitLetters [data-orbit-action="letter:A"]').dispatchEvent('click');
  assert.equal(await page.locator('#orbitRadialBackdrop').isVisible(),true,'blur backdrop behind active ring');
  assert.equal(await page.locator('#orbitAppIconLayers [data-picker-pkg="com.example.audio"]').count(),1,'A apps render in recents ring');
  assert.equal(await page.locator('#orbitAppIconLayers image[href="/app-icons/orbit/com.example.audio.png"]').count(),1,'native installed icon');
  await page.waitForTimeout(340);
  assert.equal(await page.locator('#orbitAppIconLayers .orbit-app-layer').count(),1,'single settled icon fan');
  assert.ok((await page.locator('#orbitAppIconLayers [data-picker-pkg="com.example.audio"]').getAttribute('transform')).includes('translate('));
  await page.locator('#orbitLetters [data-orbit-action="letter:B"]').dispatchEvent('click');
  assert.equal(await page.locator('#orbitAppIconLayers .orbit-app-layer').count(),2,'crossfade layers while letter changes');
  assert.equal(await page.locator('#orbitAppIconLayers [data-picker-pkg="com.example.browser"]').count(),1,'B selects browser');
  await page.waitForTimeout(340);
  assert.equal(await page.locator('#orbitAppIconLayers .orbit-app-layer').count(),1,'outgoing app layer cleaned up');
  await page.locator('#orbitLetters [data-orbit-action="letter:A"]').dispatchEvent('click');
  await page.waitForTimeout(340);
  await page.locator('#orbitAppIconLayers [data-picker-pkg="com.example.audio"]').dispatchEvent('click');
  assert.equal(await page.locator('#orbitAppIconLayers').count(),0,'launch restores recent apps');
  assert.ok(await page.evaluate(()=>window.appLaunchCalls.some(x=>x[0]==='com.example.audio')),'radial app icon launches native app');
      // Synthetic drag, with deterministic pointer coordinates, verifies continuous
  // visual movement and that the other dials stay at their own positions.
  const momentum=await page.evaluate(async()=>{
   const dial=document.getElementById('orbitDial');
   const rect=dial.getBoundingClientRect();
   dial.setPointerCapture=()=>{};
   const at=a=>({
    clientX:rect.right-86*Math.cos(a*Math.PI/180)*rect.width/334,
    clientY:rect.bottom-86*Math.sin(a*Math.PI/180)*rect.height/334
   });
   const dispatch=(name,a)=>dial.dispatchEvent(new PointerEvent(name,{
    bubbles:true,pointerId:7,button:0,...at(a)
   }));
   const widgetsBefore=document.getElementById('orbitWidgets').innerHTML;
   dispatch('pointerdown',12);
   await new Promise(r=>setTimeout(r,36));
   dispatch('pointermove',26);
   await new Promise(r=>setTimeout(r,36));
   dispatch('pointermove',39);
   const dragHtml=document.getElementById('orbitLetters').innerHTML;
   dispatch('pointerup',39);
   await new Promise(requestAnimationFrame);
   const inertiaHtml=document.getElementById('orbitLetters').innerHTML;
   return {moved:dragHtml!==inertiaHtml,otherUnchanged:widgetsBefore===document.getElementById('orbitWidgets').innerHTML};
  });
  assert.equal(momentum.moved,true,'ring continues moving after touch release');
  assert.equal(momentum.otherUnchanged,true,'independent radial app ring stays stationary');
  assert.equal(await page.locator('#orbitRadialBackdrop').isVisible(),true,'alphabet momentum keeps the inline picker active');
  await page.evaluate(()=>document.getElementById('orbitRadialBackdrop').click());
  assert.equal(await page.locator('#orbitAppIconLayers').count(),0,'dismiss backdrop restores recents');
  await page.waitForTimeout(1000);
  const previousLetters=await page.locator('#orbitLetters').textContent();
  await page.locator('#orbitWidgets [data-orbit-action="widget:1"]').dispatchEvent('click');
  assert.equal(await page.locator('#orbitLetters').textContent(),previousLetters);
  assert.ok((await page.locator('#orbitWidgets').textContent()).includes('Calendar'));

  // Approved Orbit settings gear and two independent widget rings.
  const displayedTime=await page.locator('#orbitClock textPath').first().textContent();
  const dateParts=await page.evaluate(()=>new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit",hour12:true}).formatToParts(new Date()));
  assert.equal(displayedTime, dateParts.find(x=>x.type==="hour").value+":"+dateParts.find(x=>x.type==="minute").value,
   'clock shows the full local 12-hour time, without clipping the first digit');
  assert.equal(await page.locator('#orbitSettingsGear').isVisible(),true,
   'Audio Desk settings gear is discoverable in the top-left');
  assert.equal(await page.locator('#launcherSettingsToggle').isVisible(),false,
   'Orbit does not show two overlapping settings buttons');
  assert.equal(await page.locator('#orbitExternalWidgets').count(),1,
   'app widget dial is separate from the built-in Audio Desk dial');
  assert.equal(await page.locator('#orbitClock textPath').count(),2,
   'time and date follow actual clock arc paths');
  assert.deepEqual(await page.locator('#orbitClock text').evaluateAll(els=>els.map(t=>Number(t.getAttribute('font-size')))),[16,8],
   'clock type fits the narrow 29-unit annulus');
  assert.ok((await page.locator('#orbitWidgets textPath').count())>=2,
   'Audio Desk widget titles and subtitles curve along their dial');
  assert.ok((await page.locator('#orbitExternalWidgets textPath').count())>=1,
   'custom app-widget names follow the outer widget dial');
  assert.ok((await page.locator('#orbitLetters textPath').count())>=4,
   'alphabet letters are oriented on their radial trajectory');
  assert.equal(await page.evaluate(()=>{
   const paths=[...document.querySelectorAll('#orbitDial textPath')];
   return paths.every(p=>{
    const href=p.getAttribute('href');
    const track=href&&document.querySelector(href);
    return track?.getAttribute('d')?.includes(' A');
   });
  }),true,'all curved Orbit text attaches to real elliptical-arc SVG geometry');
  assert.equal(await page.locator('#orbitWidgets [data-orbit-widget]').count(),3,
   'music, calendar and news are retained in their own original ring');
  await page.evaluate(()=>window.receiveAudioDeskNativeWidgets([
   {id:17,label:'Weather',pkg:'com.example.camera',accent:'#85bb93',width:180,height:90,minWidth:100,minHeight:56},
   {id:19,label:'YouTube',pkg:'com.example.player',accent:'#ff3248',width:180,height:90,minWidth:100,minHeight:56}
  ]));
  assert.equal(await page.locator('#orbitExternalWidgets [data-orbit-external="17"]').count(),1);
  assert.equal(await page.locator('#orbitExternalWidgets image[href="/app-icons/orbit/com.example.camera.png"]').count(),1,
   'external app widget dial gets the native provider icon');
  await page.waitForTimeout(120);
  const nativeBefore=await page.evaluate(()=>window.nativeLayoutRequests.at(-1));
  assert.equal(nativeBefore.slots.length,0,
   'no native Android widget overlays appear across the radial clock or music dial');
  const ownWidgetsBefore=await page.locator('#orbitWidgets').innerHTML();
  await page.locator('#orbitExternalWidgets [data-orbit-action="external:focus:0"]').dispatchEvent('click');
  assert.equal(await page.locator('#orbitWidgetPreview').isVisible(),true,
   'tapping the current widget opens a dedicated native widget preview');
  await page.waitForTimeout(120);
  const nativeShown=await page.evaluate(()=>window.nativeLayoutRequests.at(-1));
  assert.equal(nativeShown.slots.length,1,'preview hosts the actual interactive Android widget');
  assert.equal(nativeShown.slots[0].id,17);
  const viewRect=await page.locator('#orbitWidgetPreviewSlot').boundingBox();
  assert.ok(Math.abs(nativeShown.slots[0].x-(viewRect.x+5))<3,
   'widget is positioned inside its preview, not floating over the radial rings');
  assert.ok(nativeShown.slots[0].w>95&&nativeShown.slots[0].h>60);
  await page.locator('#orbitWidgetPreviewClose').click();
  await page.waitForTimeout(90);
  assert.equal(await page.evaluate(()=>window.nativeLayoutRequests.at(-1).slots.length),0,
   'closing preview hides native widget without deleting it');
  await page.locator('#orbitExternalWidgets [data-orbit-action="external:focus:1"]').dispatchEvent('click');
  await page.waitForTimeout(90);
  assert.equal(await page.evaluate(()=>window.nativeLayoutRequests.at(-1).slots.length),0,
   'rotating app widgets never creates floating native overlays');
  await page.locator('#orbitExternalWidgets [data-orbit-action="external:focus:1"]').dispatchEvent('click');
  assert.equal(await page.locator('#orbitWidgetPreviewTitle').textContent(),'YouTube');
  await page.waitForTimeout(90);
  assert.equal(await page.evaluate(()=>window.nativeLayoutRequests.at(-1).slots[0]?.id),19,
   'second real app widget opens and stays inside its own panel');
  await page.locator('#orbitWidgetPreviewShade').dispatchEvent('click');
  await page.waitForTimeout(90);
  assert.equal(await page.evaluate(()=>window.nativeLayoutRequests.at(-1).slots.length),0);
  assert.equal(await page.locator('#orbitWidgets').innerHTML(),ownWidgetsBefore,
   'rotating app widgets does not move Audio Desk built-in widget ring');
  await page.locator('#orbitSettingsGear').click();
  assert.equal(await page.locator('#orbitSettingsPanel').isVisible(),true);
  assert.equal(await page.locator('#orbitSettingsPanel [data-orbit-tab]').count(),6,
   'settings panel has six sections');
  const settingsMetrics=await page.evaluate(()=>{
   const r=document.getElementById('orbitSettingsPanel').getBoundingClientRect();
   return {width:r.width,right:r.right,vw:innerWidth,
    minHit:Math.min(...[...document.querySelectorAll('#orbitSettingsTabs button')]
     .map(el=>el.getBoundingClientRect().height))};
  });
  assert.ok(settingsMetrics.width>=Math.min(350,settingsMetrics.vw-24)&&settingsMetrics.right<=settingsMetrics.vw, "Settings geometry: "+JSON.stringify(settingsMetrics));
  assert.ok(settingsMetrics.minHit>=40,'settings controls must be finger accessible');
  await page.locator('#orbitSettingsTabs [data-orbit-tab="widgets"]').click();
  assert.ok((await page.locator('#orbitSettingsContent').textContent()).includes('Audio Desk widgets'));
  await page.locator('#orbitSettingsContent [data-orbit-settings-action="add-widget"]').click();
  assert.equal(await page.evaluate(()=>window.nativePickerOpen),1,
   'add-widget invokes Android native picker rather than a fabricated sample list');
  await page.locator('#orbitSettingsGear').click();
  await page.locator('#orbitSettingsTabs [data-orbit-tab="dials"]').click();
  await page.locator('#orbitSettingsContent [data-orbit-preference="momentum"]').uncheck();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ad_orbit_settings_v2')).momentum),false,
   'dial momentum preference is persistent');
  await page.locator('#orbitSettingsClose').click();
  assert.equal(await page.locator('#orbitSettingsPanel').isVisible(),false);
  await page.evaluate(()=>document.getElementById('launcherHomePage').dispatchEvent(
   new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:100,clientX:35,clientY:200})));
  await page.waitForTimeout(620);
  assert.equal(await page.locator('#orbitQuickCustomize').isVisible(),true,
   'long-press on empty Home opens quick customization');
  await page.locator('#orbitSettingsShade').dispatchEvent('click'); // outside-tap handler
  assert.equal(await page.locator('#orbitQuickCustomize').isVisible(),false);
  await page.locator('#orbitLetters [data-orbit-action^="letter:"]').first().dispatchEvent('click');
  assert.equal(await page.locator('#orbitAppIconLayers').count(),1);
  assert.equal(await page.locator('#orbitFanCount textPath').count(),1,
   'alphabet app count also follows the recents ring curve');
  await page.evaluate(()=>document.getElementById('orbitRadialBackdrop').dispatchEvent(
   new MouseEvent('click',{bubbles:true})));
  assert.equal(await page.locator('#orbitAppIconLayers').count(),0,
   'tapping empty Home dismisses A–Z and restores recent apps');
  await page.locator('#orbitSettingsGear').click();
  await page.locator('#orbitSettingsTabs [data-orbit-tab="widgets"]').click();
  await page.locator('#orbitSettingsContent [data-orbit-preference="showAppWidgets"]').uncheck();
  assert.equal(await page.locator('#orbitExternalWidgets').isVisible(),false,
   'user can hide the external widget ring without hiding built-in widgets');
  assert.equal(await page.locator('#orbitWidgets [data-orbit-widget]').count(),3);
  await page.locator('#orbitSettingsContent [data-orbit-preference="showAppWidgets"]').check();
  await page.locator('#orbitSettingsClose').click();



  // QA #15: real photo provenance, bounded picker, and Android wallpaper export.
  assert.equal(await page.evaluate(()=>window.audioDeskMinimalGalleryCount()),9);
  const galleryInfo=await page.evaluate(()=>window.audioDeskStudioGallery());
  assert.equal(galleryInfo.pageSize,4);
  assert.equal(galleryInfo.credited,true);
  assert.deepEqual(galleryInfo.collections,['Featured','Architecture','Nature','Monochrome']);
  await page.locator('#orbitSettingsGear').click();
  await page.locator('#orbitSettingsTabs [data-orbit-tab="wallpaper"]').click();
  await page.locator('#orbitSettingsContent [data-orbit-settings-action="wallpaper"]').click();
  assert.equal(await page.locator('#launcherWallpaperDialog').isVisible(),true);
  assert.equal(await page.locator('#minimalGalleryGrid .minimal-gallery-entry').count(),4);
  assert.equal(await page.locator('#wallpaperMoreOptions').getAttribute('open'),null);
  assert.equal(await page.locator('#minimalGalleryCount').textContent(),'1 / 1 · 4 photos');
  assert.equal(await page.locator('#minimalGalleryNext').isEnabled(),false);
  assert.ok((await page.locator('#minimalGalleryGrid').textContent()).includes('Photo:'));
  await page.locator('#minimalGalleryGrid img').first().dispatchEvent('error');
  assert.equal(await page.locator('#minimalGalleryGrid .minimal-gallery-unavailable').first().isVisible(),true,
   'failed thumbnail displays a human-readable offline state, not a blank card');
  await page.locator('#minimalGalleryFilters [data-minimal-category="Nature"]').click();
  assert.equal(await page.locator('#minimalGalleryCount').textContent(),'1 / 1 · 4 photos');
  await page.locator('#minimalGalleryFilters [data-minimal-category="Architecture"]').click();
  assert.equal(await page.locator('#minimalGalleryCount').textContent(),'1 / 1 · 3 photos');
  await page.locator('#minimalGalleryGrid .minimal-gallery-entry').first().click();
  await page.waitForFunction(()=>document.body.dataset.minimalWallpaper?.startsWith('photo-'));
  assert.equal(await page.locator('#minimalGalleryWallpaperImage').isVisible(),true);
  assert.ok((await page.locator('#minimalGalleryWallpaperImage').getAttribute('src')).startsWith('https://images.unsplash.com/photo-'));
  assert.ok((await page.locator('#minimalGalleryStatus').textContent()).includes('Unsplash'));
  await page.waitForTimeout(180);
  assert.ok((await page.evaluate(()=>window.systemWallpaperCalls)).length>0,
   'native wallpaper API receives decoded raster photograph');
  await page.locator('#wallpaperClose').click();
  await page.evaluate(()=>setLauncherTheme('warm'));
  await page.evaluate(()=>setLauncherTheme('orbit'));
  await page.waitForFunction(()=>document.body.dataset.minimalWallpaper?.startsWith('photo-'));
  assert.equal(await page.locator('#minimalGalleryWallpaperImage').isVisible(),true);
  await page.locator('#orbitSettingsGear').click();
  await page.locator('#orbitSettingsTabs [data-orbit-tab="wallpaper"]').click();
  await page.locator('#orbitSettingsContent [data-orbit-settings-action="wallpaper"]').click();
  await page.locator('#minimalGalleryFilters [data-minimal-category="Monochrome"]').click();
  assert.equal(await page.locator('#minimalGalleryCount').textContent(),'1 / 1 · 2 photos');
  await page.locator('#minimalGalleryGrid .minimal-gallery-entry').first().click();
  await page.waitForFunction(()=>document.body.dataset.minimalWallpaper?.startsWith('photo-'));
  await page.locator('#wallpaperClose').click();

  // Regression: actual Android users cold-start directly into their saved Orbit theme.
  // Previously startup saved preferences before initializing lastExternalNativeId,
  // throwing an exception and leaving a visible gear over a completely blank Home.
  assert.equal(await page.evaluate(()=>localStorage.getItem('ad_launcher_theme_v1')),'orbit');
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>launcherApps.length===8);
  assert.equal(await page.evaluate(()=>launcherTheme),'orbit',
   'Orbit is restored on cold start without needing to switch themes');
  await page.locator('#orbitHome').waitFor({state:'visible'});
  assert.equal(await page.locator('#orbitSettingsGear').isVisible(),true);
  assert.ok((await page.locator('#orbitClock path').count())>0,
   'clock ring actually renders on startup, not only the top-left settings button');
  assert.ok((await page.locator('#orbitWidgets [data-orbit-widget]').count())>=2,
   'built-in widget ring is visible on startup');
  assert.ok((await page.locator('#orbitExternalWidgets path').count())>0,
   'third-party app-widget ring renders on startup');
  assert.ok((await page.locator('#orbitLetters textPath').count())>=4,
   'alphabet ring has curved visible labels after cold start');
  const orbitColdStart=await page.locator('#orbitHome').evaluate(el=>{
   const svg=el.querySelector('svg');
   return {host:el.getBoundingClientRect().toJSON(),dial:svg.getBoundingClientRect().toJSON(),
    rings:svg.querySelectorAll('#orbitClock path,#orbitWidgets path,#orbitExternalWidgets path,#orbitLetters path').length};
  });
  assert.ok(orbitColdStart.host.width>100&&orbitColdStart.host.height>100&&orbitColdStart.rings>9,
   'startup layout has correctly sized and populated radial dials: '+JSON.stringify(orbitColdStart));
await page.locator('#orbitSearch [data-orbit-action="search"]').dispatchEvent('click');
  assert.equal(await page.evaluate(()=>launcherPage),'apps');
  assert.equal(await page.locator('#orbitHome').isVisible(),false);
  await page.evaluate(()=>{setLauncherPage('home',false);setLauncherTheme('windows')});
  assert.equal(await page.locator('#orbitHome').isVisible(),false);
  assert.deepEqual(errors,[],'no launcher errors');
  console.log('PASS: minimal Home without list, Niagara-style A-Z rail and panel, Windows tiles, pins, search, launches, recents and swipe navigation');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
