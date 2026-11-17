const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const serve=require('./serve-assets.cjs');
const origin='https://appassets.androidplatform.net/assets/';
(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   window.liveTilePolls=[];window.notificationSettingOpens=0;
   window.AudioDesk={
    supportsAdaptiveAppIcons(){return true},
    requestLauncherApps(){
     window.receiveLauncherApps([
      {pkg:'com.example.whatsapp',activity:'Main',label:'WhatsApp',uses:12},
      {pkg:'com.example.spotify',activity:'Music',label:'Spotify',uses:11},
      {pkg:'com.example.calendar',activity:'Calendar',label:'Calendar',uses:10},
      {pkg:'com.example.photos',activity:'Gallery',label:'Photos',uses:9},
      {pkg:'com.example.clock',activity:'Clock',label:'Clock',uses:8},
      {pkg:'com.example.news',activity:'Home',label:'Audio Desk News',uses:7},
      {pkg:'com.example.pay',activity:'Pay',label:'GPay',uses:6},
      {pkg:'com.example.browser',activity:'Main',label:'Browser',uses:5}
     ],[],true);
    },
    requestLiveTileCounts(packages){window.liveTilePolls.push(JSON.parse(packages))},
    requestMediaAccess(){window.notificationSettingOpens++},
    requestMediaState(){window.receiveAudioDeskMedia?.({enabled:false,available:false})},
    requestSearchKeyboard(){},setStatusBarTheme(){},setWallpaperTone(){},
    setRefreshEnabled(){},isDefaultLauncher(){return true},launchExternalApp(){}
   };
  });
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGM8P33jfwY8gAmf5PBRAAAwGQMm1+BwEAAAAABJRU5ErkJggg==','base64');
  await page.route('**/*',route=>{
   const u=route.request().url();
   if(u.startsWith(origin+'index.html'))
    return route.fulfill({contentType:'text/html',
     body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'))});
   if(new URL(u).pathname.startsWith('/app-icons/'))
    return route.fulfill({contentType:'image/png',body:png});
   const local=serve(route);if(local)return local;
   if(u.includes('github.com')||u.includes('rss2json.com'))
    return route.fulfill({json:{status:'ok',items:[]}});
   return route.abort();
  });
  await page.goto(origin+'index.html');
  await page.waitForFunction(()=>launcherApps.length===8&&!!window.audioDeskWindowsTiles);
  await page.evaluate(()=>setLauncherTheme('windows'));
  const favorites=page.locator('#launcherFavorites');
  assert.equal(await favorites.locator('.win-live-app').count(),8);
  assert.equal(await page.evaluate(()=>
   document.getElementById('launcherFavorites').previousElementSibling.id),
   'launcherLiveTiles','real clock/calendar/news are visible first');
  assert.equal(await page.evaluate(()=>
   document.getElementById('launcherFavorites').nextElementSibling.id),
   'launcherMusicWidget','the regular media controller is retained below tiles');
  assert.equal(await page.locator('#launcherLiveDay').textContent(),
   String(new Date().getDate()),'date tile shows the actual day');
  const first=favorites.locator('.win-live-app').first();
  assert.equal(await first.locator('.tile-activity').count(),0,
   'no static OPENED usage timestamp sits on a Live Tile');
  const backplate=await first.locator('.ad-icon-shell').evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.equal(backplate,'rgba(0, 0, 0, 0)',
   'Windows tile icon shell has no separate colored square');
  assert.equal(await page.evaluate(()=>window.liveTilePolls.length),0,
   'notification counts never requested without consent');
  const calendar=favorites.locator('.win-live-app[data-launch-pkg="com.example.calendar"]');
  assert.equal(await calendar.getAttribute('data-tile-info'),'date');
  assert.equal(await calendar.locator('.win-tile-back-primary').textContent(),
   String(new Date().getDate()));
  const photos=favorites.locator('.win-live-app[data-launch-pkg="com.example.photos"]');
  assert.equal(await photos.getAttribute('data-tile-info'),'',
   'gallery without photo permission must not show a fabricated slideshow');
  const spotify=favorites.locator('.win-live-app[data-launch-pkg="com.example.spotify"]');
  await page.evaluate(()=>window.receiveAudioDeskMedia({
   enabled:true,available:true,app:'com.example.spotify',
   title:'An actual playing track',artist:'The current artist',
   playing:true,canNext:true,canPrevious:true,canToggle:true
  }));
  assert.equal(await spotify.locator('.win-tile-back-primary').textContent(),
   'An actual playing track','music tile reflects a real active MediaSession');
  await page.evaluate(()=>{
   items=[{title:'Audio Desk real cached headline',link:'https://example.com/story',
    source:'Example',date:'2026-11-17T01:00:00Z'}];
   dispatchEvent(new Event('audio-desk-news-updated'));
  });
  const news=favorites.locator('.win-live-app[data-launch-pkg="com.example.news"]');
  assert.equal(await news.locator('.win-tile-back-primary').textContent(),
   'Audio Desk real cached headline');
  await page.locator('#launcherSettingsToggle').click();
  const consent=page.locator('#windowsTileCountToggle');
  assert.equal(await consent.isChecked(),false,'notification content is opt-in');
  await consent.check();
  assert.equal(await page.evaluate(()=>window.notificationSettingOpens),1,
   "the user's explicit opt-in opens Android access settings");
  assert.ok(await page.evaluate(()=>window.liveTilePolls.length>0),
   'only visible installed app packages are polled for active counts');
  await page.evaluate(()=>window.receiveAudioDeskLiveTileCounts({
   enabled:true,counts:{'com.example.whatsapp':3,'com.example.pay':1}
  }));
  const whatsapp=favorites.locator('.win-live-app[data-launch-pkg="com.example.whatsapp"]');
  assert.equal(await whatsapp.locator('.win-tile-badge').textContent(),'3');
  assert.equal(await whatsapp.locator('.win-tile-back-primary').textContent(),'3');
  assert.equal(await whatsapp.locator('.win-tile-back-detail').textContent(),'ACTIVE NOTIFICATIONS');
  assert.equal((await whatsapp.locator('.win-tile-back').textContent()).includes('message text'),false);
  await page.evaluate(()=>window.receiveAudioDeskLiveTileCounts({enabled:true,counts:{}}));
  assert.equal(await whatsapp.getAttribute('data-tile-info'),'',
   'cleared Android notifications clear the animated badge');
  await consent.uncheck();
  assert.equal(await page.evaluate(()=>window.audioDeskWindowsTiles.optedIn()),false);
  await page.locator('#launcherOptionsClose').click();
  await page.evaluate(()=>setLauncherTheme('warm'));
  assert.equal(await page.evaluate(()=>
   document.getElementById('launcherTilesSearch').previousElementSibling.id),
   'launcherMusicWidget','other themes keep original widget order');
  assert.equal(await page.evaluate(()=>
   document.getElementById('launcherRecentStrip').nextElementSibling.id),
   'launcherLiveTiles','other themes keep original live-tile section position');
  assert.deepEqual(errors,[],'no browser runtime exceptions');
  console.log('PASS: Windows tile faces/badges, original data only, no icon squares, explicit notification consent and other-theme widget positions');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
