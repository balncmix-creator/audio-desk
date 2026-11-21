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
  assert.equal(await page.locator('#orbitWidgets [data-orbit-action="media:toggle"]').count(),1);
  await page.evaluate(()=>{window.receiveAudioDeskMedia({enabled:true,available:true,playing:true,title:'Orbit test track',artist:'Audio Desk',durationMs:120000,positionMs:45000,canSeek:true,canToggle:true,canPrevious:true,canNext:true})});
  assert.ok((await page.locator('#orbitWidgets').textContent()).includes('Orbit test track'));
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
  assert.ok((await page.locator('#orbitRecents').textContent()).includes('REAPER'),
   'radial app labels remain visible as icon fallback');

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
   const recentsBefore=document.getElementById('orbitRecents').innerHTML;
   dispatch('pointerdown',12);
   await new Promise(r=>setTimeout(r,36));
   dispatch('pointermove',26);
   await new Promise(r=>setTimeout(r,36));
   dispatch('pointermove',39);
   const dragHtml=document.getElementById('orbitLetters').innerHTML;
   dispatch('pointerup',39);
   await new Promise(requestAnimationFrame);
   const inertiaHtml=document.getElementById('orbitLetters').innerHTML;
   return {moved:dragHtml!==inertiaHtml,otherUnchanged:recentsBefore===document.getElementById('orbitRecents').innerHTML};
  });
  assert.equal(momentum.moved,true,'ring continues moving after touch release');
  assert.equal(momentum.otherUnchanged,true,'independent radial app ring stays stationary');
  await page.waitForTimeout(1000);
  const previousLetters=await page.locator('#orbitLetters').textContent();
  await page.locator('#orbitWidgets [data-orbit-action="widget:1"]').dispatchEvent('click');
  assert.equal(await page.locator('#orbitLetters').textContent(),previousLetters);
  assert.ok((await page.locator('#orbitWidgets').textContent()).includes('Calendar'));
  await page.locator('#orbitSearch [data-orbit-action="search"]').dispatchEvent('click');
  assert.equal(await page.evaluate(()=>launcherPage),'apps');
  assert.equal(await page.locator('#orbitHome').isVisible(),false);
  await page.evaluate(()=>{setLauncherPage('home',false);setLauncherTheme('windows')});
  assert.equal(await page.locator('#orbitHome').isVisible(),false);
  assert.deepEqual(errors,[],'no launcher errors');
  console.log('PASS: minimal Home without list, Niagara-style A-Z rail and panel, Windows tiles, pins, search, launches, recents and swipe navigation');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
