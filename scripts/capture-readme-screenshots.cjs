// Real Chromium screenshots of the Audio Desk UI with explicitly illustrative demo stories.
// Run from repository root after npm ci / npx playwright install chromium.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const output=path.join(__dirname,'../docs/screenshots');
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:420,height:900},deviceScaleFactor:2,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  const appUrl='https://appassets.androidplatform.net/assets/index.html';
  await page.route('**/*',route=>{
   const localAsset=require('../tests/serve-assets.cjs')(route);if(localAsset)return localAsset;
   const url=route.request().url();
   if(url===appUrl)return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'))});
   if(url.includes('/assets/pixel-icons/') && url.endsWith('.svg')) {
    const name=url.split('/').pop();
    const iconPath=path.join(__dirname,'../app/src/main/assets/pixel-icons',name);
    if(fs.existsSync(iconPath))
     return route.fulfill({contentType:'image/svg+xml',body:fs.readFileSync(iconPath)});
   }
   if(url==='https://appassets.androidplatform.net/assets/desk-premium.webp')
    return route.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/desk-premium.webp'))});
   if(url.includes('api.rss2json.com'))return route.fulfill({json:{status:'ok',items:[]}});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.goto(appUrl);
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('GitHub:'));
  await page.evaluate(()=>{
   // Illustrative demo content; not real publisher headlines or current RSS results.
   function art(a,b){
    const c=document.createElement('canvas');c.width=560;c.height=290;const ctx=c.getContext('2d');
    const gradient=ctx.createLinearGradient(0,0,560,290);gradient.addColorStop(0,a);gradient.addColorStop(1,b);
    ctx.fillStyle=gradient;ctx.fillRect(0,0,560,290);
    ctx.fillStyle='rgba(255,255,255,.08)';
    for(let i=0;i<7;i++)ctx.fillRect(32+i*78,40+(i%3)*12,18,190);
    ctx.beginPath();ctx.lineWidth=8;ctx.strokeStyle='rgba(255,255,255,.75)';
    for(let x=42;x<=520;x+=5){
     const y=148+Math.sin(x*.055)*38+Math.sin(x*.018)*19;
     if(x===42)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }ctx.stroke();
    return c.toDataURL('image/png');
   }
   const p1=art('#1c396b','#4a1d4f'),p2=art('#704320','#322c58'),p3=art('#235a50','#172e49');
   const records=[
    ['Audio post workflow: immersive film mixing','Post Production','Audio Post Demo',p1],
    ['Dialogue restoration and Foley editing tools','Post Production','Sound Editorial Demo',p2],
    ['REAPER editing scripts for sound designers','REAPER','REAPER Demo',p3],
    ['New DAW plug-in instruments and updates','DAWs & plugins','Plugin Demo',p1],
    ['Cinematic sample library and field recordings','Sample packs','Library Demo',p2],
    ['Portable production recorder technology','Hardware','Hardware Demo',p3]
   ];
   items=records.map((r,i)=>({
    title:r[0],cat:r[1],source:r[2],image:r[3],
    desc:'Explore audio production news, tools and techniques in this illustrative preview of the Audio Desk interface.',
    date:new Date(Date.UTC(2026,10,14,10,0)-i*3600000).toISOString(),
    link:'https://example.com/audio-desk-demo-'+i,key:'screenshot-demo-'+i
   }));
   active='All';render();
   document.getElementById('status').textContent='DEMONSTRATION HEADLINES · NOT LIVE NEWS';
   document.getElementById('updated').textContent='UI Preview';
  });
  await page.evaluate(()=>setLauncherPage('events',false));
  await page.waitForFunction(()=>[...document.querySelectorAll('.storymedia')].every(img=>img.complete&&img.naturalWidth>0));
  await page.waitForFunction(()=>!!document.querySelector('.story[style*="--story-surface"]'));
  await page.screenshot({path:path.join(output,'news-feed.png')});
  assert.equal(await page.locator('[data-filter="Post Production"]').count(),1);
  await page.locator('[data-filter="Post Production"]').click();
  assert.equal(await page.locator('.story').count(),2);
  await page.screenshot({path:path.join(output,'post-production.png')});
  await page.evaluate(()=>{
   setOfflineNotice(true);
   document.getElementById('status').textContent='OFFLINE DEMONSTRATION · CACHED STORIES AVAILABLE';
  });
  assert.equal(await page.locator('#offlineNotice').isVisible(),true);
  await page.screenshot({path:path.join(output,'offline.png')});
  await page.locator('[data-filter="All"]').click();
  await page.locator('[data-card-density="3"]').click();
  await page.screenshot({path:path.join(output,'grid-three.png')});
  await page.locator('[data-card-density="5"]').click();
  await page.screenshot({path:path.join(output,'grid-five.png')});
  await page.locator('[data-card-density="1"]').click();
  await page.locator('[data-view="samples"]').click();
  assert.equal(await page.locator('#sampleReleases .sample-demo-button').count(),1);
  await page.screenshot({path:path.join(output,'sample-packs.png')});
  // Launcher screenshots: actual HTML/CSS, demonstration apps supplied by the
  // screenshot harness because the CI browser has no Android PackageManager.
  await page.evaluate(()=>{
   function icon(letter,a,b){
    const canvas=document.createElement('canvas');canvas.width=76;canvas.height=76;
    const ctx=canvas.getContext('2d');
    const gradient=ctx.createLinearGradient(0,0,76,76);
    gradient.addColorStop(0,a);gradient.addColorStop(1,b);
    ctx.fillStyle=gradient;ctx.fillRect(0,0,76,76);
    ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=2;ctx.strokeRect(4,4,68,68);
    ctx.fillStyle='#fff';ctx.font='bold 34px monospace';ctx.textAlign='center';
    ctx.fillText(letter,38,51);
    return canvas.toDataURL('image/png');
   }
   const records=[
    ['Audio Desk','A','#3b3b3b','#111'],['REAPER Remote','R','#365f48','#121e18'],
    ['Files','F','#5c472b','#1d1611'],['Browser','B','#254d6e','#0d1826'],
    ['Recorder','●','#6c343b','#251416'],['Music','♫','#5b355f','#1b1221'],
    ['Sample Libraries','S','#4c435f','#171321'],['Plugins','P','#48555c','#101d22'],
    ['Settings','⚙','#444b55','#191b22'],['Camera','C','#4b4942','#191813'],
    ['Messages','M','#2c5a50','#152b26'],['Clock','T','#555','#1a1a1a']
   ];
   const examples=records.map((r,i)=>({
    label:r[0],pkg:'example.preview.app'+i,activity:'example.preview.Launcher',
    icon:icon(r[1],r[2],r[3]),
    uses:Math.max(0,16-i*2)
   }));
   window.receiveLauncherApps(examples,examples.slice(1,5).map((a,i)=>({
    ...a,opened:Date.now()-i*120000
   })),false);
   document.getElementById('launcherClock').textContent='11:20';
   document.getElementById('launcherDate').textContent='SAT, 14 NOV';
  });
  await page.locator('[data-home-nav="home"]').click();
  assert.equal(await page.locator('#launcherFavorites .launcher-app').count(),0,'Minimal Home hides the duplicate app list');
  assert.equal(await page.locator('#launcherRecentQuick .launcher-app').count(),6,'Home shows six frequently used demo app shortcuts');
  assert.equal(await page.locator('#launcherRecentQuick').evaluate(el=>getComputedStyle(el).flexDirection),'column');
  assert.equal(await page.locator('#launcherAlphaIndex').isVisible(),true,'Home displays the A-Z rail');
  assert.equal(await page.locator('#launcherNavigation').isVisible(),false);
  assert.equal(await page.locator('#launcherSettingsToggle').isVisible(),true);
  await page.screenshot({path:path.join(output,'launcher-home.png')});
  await page.evaluate(()=>setLauncherTheme('pixel'));
  await page.screenshot({path:path.join(output,'launcher-pixel-theme.png')});
  await page.evaluate(()=>setLauncherTheme('windows'));
  assert.equal(await page.locator('#launcherFavorites .launcher-app').count(),8,'Windows Phone-style app tiles remain accessible');
  assert.equal(await page.locator('#launcherLiveTiles .launcher-live-tile').count(),3,'Clock, date and news are real live tiles');
  await page.screenshot({path:path.join(output,'launcher-windows-tiles.png')});
  await page.evaluate(()=>setLauncherTheme('warm'));
  assert.equal(await page.locator('#warmWidgets').isVisible(),true);
  assert.equal(await page.locator('#launcherRecentQuick .launcher-app').count(),7,
   'Warm Minimal captures seven usable installed-app shortcuts');
  assert.equal(await page.locator('#launcherRecentQuick .warm-line-icon svg').count(),7);
  assert.equal(await page.locator('#launcherRecentQuick img[src*="pixel-icons"]').count(),0,
   'warm preview screenshot contains no 8-bit app icons');
  assert.equal(await page.locator('#launcherHomePage').evaluate(el=>getComputedStyle(el,'::before').content),'none');
  const firstGeometry=await page.locator('#launcherRecentStrip').evaluate(panel=>{
   const r=panel.getBoundingClientRect(),i=panel.querySelector('.warm-line-icon').getBoundingClientRect();
   return {inside:i.left>=r.left&&i.right<=r.right&&i.top>=r.top&&i.bottom<=r.bottom};
  });
  assert.equal(firstGeometry.inside,true,'warm screenshot has no clipped first icon');
  const cornerRadii=await page.locator('#launcherRecentStrip').evaluate(el=>{
   const style=getComputedStyle(el);
   return [style.borderTopLeftRadius,style.borderTopRightRadius,
    style.borderBottomRightRadius,style.borderBottomLeftRadius]
    .map(value=>parseFloat(value));
  });
  assert.ok(cornerRadii.every(radius=>radius>=12),
   'Warm Favourites & Recents should round all four corners: '+cornerRadii.join(','));
  assert.ok(await page.evaluate(()=>document.getElementById('launcherAlphaIndex').getBoundingClientRect().left-
   document.getElementById('warmAudioWidget').getBoundingClientRect().right>=8),
   'screenshot widgets do not collide with A–Z letters');
  await page.waitForTimeout(240);
   const gap=await page.evaluate(()=>{
    const music=document.getElementById('launcherMusicWidget').getBoundingClientRect();
    const rail=document.getElementById('launcherAlphaIndex').getBoundingClientRect();
    return rail.left-music.right;
   });
   assert.ok(gap>=8,'Warm music card must clear the A–Z rail, gap='+gap+'px');
   await page.screenshot({path:path.join(output,'launcher-warm-minimal.png')});
   // Capture each themed Apps surface for visual QA, not only each Home.
   for(const mode of ['warm','minimal','pixel','windows']){
    await page.evaluate(mode=>{setLauncherTheme(mode);setLauncherPage('apps',false)},mode);
    assert.equal(await page.locator('#launcherAppsGrid .n-app-row').count(),12);
    const font=await page.locator('#launcherAppsPage .launcher-titlebar strong')
     .evaluate(el=>getComputedStyle(el).fontFamily);
    if(mode==='pixel')assert.ok(font.includes('Press Start 2P'),'8-Bit keeps arcade typography');
    else assert.ok(!/Press Start|Silkscreen/.test(font),'modern themes use non-pixel fonts');
    await page.screenshot({path:path.join(output,'launcher-'+mode+'-applications.png')});
   }
   await page.evaluate(()=>{setLauncherTheme('warm');setLauncherPage('home',false)});
   await page.locator('#launcherSettingsToggle').click();
   assert.equal(await page.locator('#launcherHomeOptions').isVisible(),true);
   await page.screenshot({path:path.join(output,'launcher-warm-quick-actions.png')});
   await page.locator('#launcherOptionsClose').click();
   await page.locator('#launcherHomeOptions').waitFor({state:'hidden'});
  await page.evaluate(()=>setLauncherTheme('minimal'));
  await page.evaluate(()=>setLauncherPage('apps',false));
  assert.equal(await page.locator('#launcherAppsGrid .launcher-app').count(),12);
  await page.screenshot({path:path.join(output,'launcher-applications.png')});
  await page.locator('[data-home-nav="home"]').click();
  await page.locator('#launcherSettingsToggle').click();
  await page.locator('#launcherShowRecents').click();
  await page.screenshot({path:path.join(output,'launcher-open-apps.png')});

  // Expanded visual QA: capture all five launcher themes on four Android-sized
  // viewports, on both Home and Apps. These are honest WebView-style simulator
  // captures with sample apps, not screenshots taken on a physical handset.
  const qaRoot=path.join(__dirname,'../qa-artifacts');
  const qaShots=path.join(qaRoot,'screenshots');
  fs.mkdirSync(qaShots,{recursive:true});
  const qa={source:'Chromium Android-WebView asset simulation',
   created:new Date().toISOString(),sizes:[],warnings:[]};
  const presets=[
   {width:320,height:680},{width:360,height:780},
   {width:393,height:852},{width:430,height:932}
  ];
  const modes=['minimal','pixel','windows','warm','orbit'];
  await page.evaluate(()=>{
   for(const id of ['launcherHomeOptions','launcherRecentDrawer','launcherLetterPanel',
    'launcherShortcutMenu','launcherThemeDialog','launcherWallpaperDialog',
    'launcherClockDialog','iconStudioDialog']){
    const element=document.getElementById(id);if(element)element.hidden=true;
   }
  });
  for(const viewport of presets){
   await page.setViewportSize(viewport);
   for(const mode of modes){
    for(const destination of ['home','apps']){
     await page.evaluate(({mode,destination})=>{
      setLauncherTheme(mode);setLauncherPage(destination,false);
     },{mode,destination});
     await page.waitForTimeout(140);
     const where=mode+'-'+destination+'-'+viewport.width+'x'+viewport.height;
     const metrics=await page.evaluate(({mode,destination})=>{
      const dial=document.getElementById('orbitHome');
      const appList=document.getElementById('launcherAppsGrid');
      const card=mode==='orbit'&&destination==='home'?dial:
       destination==='apps'?appList:document.getElementById('launcherHomePage');
      const rect=card?.getBoundingClientRect();
      return {theme:mode,screen:destination,viewport:[innerWidth,innerHeight],
       radialAssets:typeof window.audioDeskOpenRadialFiles==='function',
       appRows:appList?.querySelectorAll('.launcher-app').length||0,
       rect:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,
       horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
       clockEndRound:mode==='orbit'&&destination==='home'?
        (document.querySelector('#orbitClock .orbit-ring')?.getAttribute('d')||'').includes(' Q'):null
      };
     },{mode,destination});
     assert.equal(metrics.radialAssets,true,'Orbit files must load in the complete launcher WebView');
     if(destination==='apps')assert.ok(metrics.appRows>=10,where+' app list disappeared');
     if(mode==='orbit'&&destination==='home'){
      assert.equal(await page.locator('#orbitWidgets .orbit-widget-preview-hit').count(),2);
      assert.equal(metrics.clockEndRound,true,'Orbit edge caps must remain rounded');
     }
     if(metrics.horizontalOverflow>2)qa.warnings.push(where+' overflow '+metrics.horizontalOverflow+'px');
     qa.sizes.push(metrics);
     await page.screenshot({path:path.join(qaShots,where+'.png'),animations:'disabled'});
    }
   }
  }
  await page.setViewportSize({width:393,height:852});
  await page.evaluate(()=>{setLauncherTheme('orbit');setLauncherPage('home',false)});
  await page.locator('#orbitSettingsGear').click();
  await page.screenshot({path:path.join(qaShots,'orbit-settings-393x852.png')});
  await page.locator('#orbitSettingsClose').click();
  await page.evaluate(()=>window.audioDeskIconStudio.open());
  assert.equal(await page.locator('[data-icon-pack-choice]').count(),20);
  await page.screenshot({path:path.join(qaShots,'icon-studio-393x852.png')});
  await page.locator('#iconStudioDone').click();
  await page.evaluate(()=>window.audioDeskOpenRadialFiles());
  assert.equal(await page.locator('#rdfFileRing .rdf-start').count(),6);
  await page.screenshot({path:path.join(qaShots,'orbit-files-empty-393x852.png')});
  await page.evaluate(()=>window.receiveAudioDeskRadialFiles({
   type:'listing',mode:'device',path:['Internal storage','Music'],
   writable:true,canGoUp:true,count:6,entries:[
    {id:'folder1',name:'Foley',folder:true,writable:true},
    {id:'file1',name:'Ambience.wav',folder:false,mime:'audio/wav',writable:true,size:224000},
    {id:'file2',name:'Dialogue.flac',folder:false,mime:'audio/flac',writable:true,size:544000},
    {id:'file3',name:'Sound Design',folder:true,writable:true},
    {id:'file4',name:'Theme.mp3',folder:false,mime:'audio/mpeg',writable:true,size:154000},
    {id:'file5',name:'Mixdown.wav',folder:false,mime:'audio/wav',writable:true,size:704000}
   ]
  }));
  assert.equal(await page.locator('#rdfFileRing .rdf-file').count(),6);
  await page.screenshot({path:path.join(qaShots,'orbit-files-content-393x852.png')});
  // Restore Orbit Home through its own radial Close action before capturing
  // the A73 layout; otherwise the file manager correctly blocks touches.
  await page.locator('#rdfWheel [data-rdf-action="close"]').dispatchEvent('click');
  assert.equal(await page.locator('#radialFilesPanel').isVisible(),false,
   'A73 screenshots must show Orbit Home rather than an open modal');
  // Simulated Galaxy A73 (393 CSS px / 1080 physical px, One UI gesture inset).
  // These remain browser QA captures; the native build separately identifies
  // the phone through its trusted platform bridge at runtime.
  await page.setViewportSize({width:393,height:873});
  await page.evaluate(()=>{
   setLauncherTheme('orbit');setLauncherPage('home',false);
   document.body.classList.add('orbit-galaxy-a73');
   document.documentElement.style.setProperty('--status-top','28px');
   document.documentElement.style.setProperty('--system-bottom','24px');
  });
  const galaxySafe=await page.locator('#orbitHome').evaluate(node=>{
   const r=node.getBoundingClientRect();return {
    width:r.width,top:r.top,bottom:r.bottom,
    viewportHeight:innerHeight,statusTop:28,navigationBottom:24
   };
  });
  assert.ok(galaxySafe.top>28&&
   Math.abs(galaxySafe.bottom-(galaxySafe.viewportHeight-galaxySafe.navigationBottom))<2,
   'A73 visual QA: radial dial must clear both One UI bars');
  await page.screenshot({path:path.join(qaShots,'orbit-galaxy-a73-393x873.png'),animations:'disabled'});
  await page.locator('#orbitSettingsGear').click();
  await page.screenshot({path:path.join(qaShots,'orbit-galaxy-a73-settings-393x873.png'),animations:'disabled'});
  await page.locator('#orbitSettingsClose').click();
  qa.galaxyA73=galaxySafe;
  qa.uncaughtErrors=errors;
  fs.writeFileSync(path.join(qaRoot,'visual-review.json'),JSON.stringify(qa,null,2));
  assert.equal(qa.sizes.length,40,'Visual QA must capture 5 themes × 2 pages × 4 sizes');

  assert.deepEqual(errors,[],'the screenshot version of the app must render without script errors');
  console.log('Captured Audio Desk news and launcher UI screenshots with explicitly labeled demo content');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
