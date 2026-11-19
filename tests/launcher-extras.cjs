const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.testAppSettings=[];
   window.nativeWallpapers=[];
   window.AudioDesk={
    requestLauncherApps(){
     window.receiveLauncherApps([
      {pkg:'com.example.music',activity:'Music',label:'Music',uses:6},
      {pkg:'com.example.games',activity:'Games',label:'Games',uses:5},
      {pkg:'com.example.camera',activity:'Camera',label:'Camera',uses:4},
      {pkg:'com.example.search',activity:'Search',label:'Search',uses:3},
      {pkg:'com.example.folder',activity:'Files',label:'Files',uses:2},
      {pkg:'com.example.pay',activity:'Pay',label:'Pay',uses:1},
      {pkg:'com.example.audio',activity:'Audio',label:'Audio',uses:1}
     ],[],true);
    },
    openAppSettings(pkg,action){window.testAppSettings.push({pkg,action})},
    setSystemWallpaperCustom(dataUrl,position,lock,request){
     window.nativeWallpapers.push({prefix:dataUrl.slice(0,26),bytes:dataUrl.length,
      position,lock,request});
     window.audioDeskWallpaperResult?.(request,true,'Applied');
    },
    setSystemWallpaperBundled(id,position,lock,request){},
    getAppShortcuts(){},
    requestMediaState(){window.receiveAudioDeskMedia({
     enabled:true,available:false,playing:false,canNext:false,canToggle:false,canPrevious:false
    })},
    hideSearchKeyboard(){},
    requestSearchKeyboard(){},
    launchExternalApp(){},
    requestDefaultLauncher(){}
   };
  });
  await page.route('**/*',route=>{
   const asset=require('./serve-assets.cjs')(route);if(asset)return asset;
   const u=route.request().url();
   if(u==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',
     body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'))});
   if(u.includes('api.github.com')||u.includes('api.rss2json.com'))
    return route.fulfill({json:{items:[],status:'ok'}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.waitForFunction(()=>typeof launcherApps!=='undefined'&&launcherApps.length===7);
  await page.evaluate(()=>{setLauncherTheme('warm');setLauncherPage('apps',false)});
  assert.equal(await page.evaluate(()=>document.body.dataset.appLayout),'list',
   'the existing vertical app list is still the default');
  await page.locator('[data-apps-layout="grid"]').click();
  assert.equal(await page.evaluate(()=>document.body.dataset.appLayout),'grid');
  assert.equal(await page.locator('#launcherAppsGrid').evaluate(el=>getComputedStyle(el).display),'grid');
  await page.locator('[data-apps-layout="list"]').click();
  assert.equal(await page.evaluate(()=>document.body.dataset.appLayout),'list');
  assert.equal(await page.locator('#appsLayoutControls').isVisible(),true);
  // A horizontal app-list swipe must not open Home-only published shortcuts.
  await page.evaluate(()=>{
   const el=document.querySelector('#launcherAppsGrid .launcher-app');
   const fire=(type,x)=>{
    const t=new Touch({identifier:8,target:el,clientX:x,clientY:420,screenX:x,screenY:420});
    el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,
     touches:type==='touchend'?[]:[t],changedTouches:[t],targetTouches:type==='touchend'?[]:[t]}));
   };
   fire('touchstart',105);fire('touchend',285);
  });
  assert.equal(await page.locator('#launcherShortcutMenu').isVisible(),false,
   'swiping app rows never triggers Home quick actions');
  // Long-pressing Apps opens genuine Android management choices.
  const appButton=page.locator('#launcherAppsGrid .launcher-app').first();
  const r=await appButton.boundingBox();
  await appButton.dispatchEvent('pointerdown',{button:0,pointerId:77,clientX:r.x+25,clientY:r.y+25});
  await page.waitForTimeout(610);
  assert.equal(await page.locator('#appManageSheet').isVisible(),true);
  assert.equal(await page.locator('#appManageSheet [data-manage="storage"]').isVisible(),true);
  await page.locator('#appManageSheet [data-manage="storage"]').click();
  assert.equal((await page.evaluate(()=>window.testAppSettings)).at(-1).action,'storage');
  assert.equal(await page.locator('#appManageSheet').isVisible(),false);
  // Per-theme transparency and persistence.
  await page.evaluate(()=>setLauncherPage('home',false));
  await page.locator('#launcherSettingsToggle').click();
  await page.locator('#launcherGlassMode').selectOption('liquid');
  assert.equal(await page.evaluate(()=>document.body.dataset.glassMode),'liquid');
  await page.evaluate(()=>setLauncherTheme('pixel'));
  assert.equal(await page.evaluate(()=>document.body.dataset.glassMode),'opaque',
   'glass preference does not bleed between themes');
  await page.evaluate(()=>setLauncherTheme('warm'));
  assert.equal(await page.evaluate(()=>document.body.dataset.glassMode),'liquid',
   'Warm Minimal remembers its own glass preference');
  await page.locator('#launcherOptionsClose').click();
  await page.locator('#launcherHomeOptions').waitFor({state:'hidden'});
  // A physical touch hold on a widget must open ONLY its layout editor.
  // The Home long-press listener must not also open Audio Desk settings.
  await page.evaluate(()=>{
   const widget=document.getElementById('launcherRecentStrip');
   const point={clientX:90,clientY:165,screenX:90,screenY:165};
   widget.dispatchEvent(new PointerEvent('pointerdown',{
    bubbles:true,pointerId:41,pointerType:'touch',isPrimary:true,button:0,...point
   }));
   const touch=new Touch({identifier:41,target:widget,...point});
   widget.dispatchEvent(new TouchEvent('touchstart',{
    bubbles:true,cancelable:true,touches:[touch],targetTouches:[touch],changedTouches:[touch]
   }));
  });
  await page.waitForTimeout(650);
  assert.equal(await page.locator('#widgetLayoutOverlay').isVisible(),true,
   'holding a widget opens its eight-handle editor');
  assert.equal(await page.locator('#launcherHomeOptions').isVisible(),false,
   'widget hold never opens Audio Desk settings at the same time');
  await page.locator('#widgetLayoutOverlay [data-layout-control="done"]').click();
  // Folders created from quick actions appear on Home and can be edited by holding.
  await page.evaluate(()=>window.audioDeskFolderCreate());
  await page.locator('#folderNameInput').fill('Games');
  await page.locator('#folderAppSearch').fill('Games');
  await page.locator('#folderAppChoices input[type="checkbox"]').first().check();
  await page.locator('[data-folder-action="save"]').click();
  assert.equal(await page.locator('#launcherRecentQuick [data-folder-id]').count(),1);
  await page.locator('#launcherRecentQuick [data-folder-id]').click();
  assert.equal(await page.locator('#launcherFolderSheet').isVisible(),true);
  assert.match(await page.locator('#folderDialogBody').textContent(),/Games/);
  await page.locator('[data-folder-action="edit"]').click();
  assert.equal(await page.locator('#folderNameInput').inputValue(),'Games');
  await page.locator('[data-folder-action="cancel"]').click();
  // Eight handles include an accessible left-side grip for the Home recent widget.
  assert.equal(await page.evaluate(()=>window.audioDeskBeginWidgetResize('launcherRecentStrip')),true);
  assert.equal(await page.locator('#widgetLayoutOverlay .widget-resize-handle').count(),8);
  const west=await page.locator('#widgetLayoutOverlay [data-edge="w"]').boundingBox();
  assert.ok(west.x>=-1&&west.x+west.width<=391,
   'left resize handle remains on-screen even when the cream panel touches the edge');
  const music=await page.evaluate(()=>document.getElementById('launcherMusicWidget').getBoundingClientRect().toJSON());
  await page.locator('#widgetLayoutOverlay [data-layout-control="done"]').click();
  assert.equal(await page.evaluate(()=>window.audioDeskBeginWidgetResize('launcherMusicWidget')),true);
  const grip=await page.locator('#widgetLayoutOverlay [data-layout-control="move"]').boundingBox();
  await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);
  await page.mouse.down();await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2+37,{steps:5});
  await page.mouse.up();
  const intersect=await page.evaluate(()=>{
   const a=document.getElementById('launcherMusicWidget').getBoundingClientRect();
   return [...document.querySelectorAll('[data-widget-resizable]')].filter(el=>el.id!=='launcherMusicWidget'&&el.getClientRects().length&&el.getBoundingClientRect().width>16).some(el=>{
    const b=el.getBoundingClientRect();return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
   });
  });
  assert.equal(intersect,false,'dragged widget must never overlap adjacent widgets');
  await page.locator('#widgetLayoutOverlay [data-layout-control="done"]').click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ad_widget_layout_v2_warm')));
  assert.ok(saved.launcherMusicWidget,'per-theme widget positions are persisted');
  // Exercise real edge drags on an isolated dynamic Home widget pair.
  await page.evaluate(()=>{
   const home=document.getElementById('launcherHomePage');
   // Isolate geometry from unrelated warm Home cards (including naturally
   // tall recents). Preserve original inline styles exactly for later tests.
   window.savedWidgetDisplay=[...home.querySelectorAll('[data-widget-resizable]')].map(el=>[el,el.style.getPropertyValue('display'),el.style.getPropertyPriority('display')]);
   for(const [node] of window.savedWidgetDisplay)node.style.setProperty('display','none','important');
   window.scrollTo(0,0);
   for(const id of ['nativeWidget_701','nativeWidget_702']){
    const node=document.createElement('div');node.id=id;
    node.style.cssText='position:fixed!important;width:140px;height:100px;left:100px;top:280px;z-index:40;box-sizing:border-box';
    // Deliberately use viewport coordinates, independent of Home ancestor
    // transforms/clipping and the previous test's scroll offset.
    document.body.append(node);window.audioDeskRegisterNativeWidget(id,id);
   }
   document.querySelector('#nativeWidget_702').style.top='450px';
  });
  await page.evaluate(()=>window.audioDeskBeginWidgetResize('nativeWidget_701'));
  const bounds=async()=>page.locator('#nativeWidget_701').evaluate(el=>el.getBoundingClientRect().toJSON());
  const drag=async(edge,dx,dy)=>{
   const handle=page.locator('#widgetLayoutOverlay [data-edge="'+edge+'"]');
   const b=await handle.boundingBox();
   const hit=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[data-edge]')?.dataset.edge,{x:b.x+b.width/2,y:b.y+b.height/2});
   assert.equal(hit,edge,'pointer must actually hit the intended resize handle');
   await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
   await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2+dy,{steps:4});await page.mouse.up();
   await page.waitForTimeout(50);
  };
  let initial=await bounds();
  // Snap the moving left edge to the neighboring alignment line at x=100
  // only when close; a deliberate change must preserve the opposite edge.
  await drag('w',-30,0);
  let changed=await bounds();
  assert.ok(changed.left<initial.left-15&&Math.abs(changed.right-initial.right)<2,'west edge grows with right edge fixed: '+JSON.stringify({initial,changed}));
  initial=changed;
  await drag('e',35,0);changed=await bounds();
  assert.ok(changed.right>initial.right+15&&Math.abs(changed.left-initial.left)<2,'east edge moves independently');
  initial=changed;
  await drag('s',0,65);changed=await bounds();
  assert.ok(Math.abs(changed.bottom-450)<3&&Math.abs(changed.top-initial.top)<2,'south snaps to adjacent widget top');
  initial=changed;
  await drag('n',0,-35);changed=await bounds();
  assert.ok(changed.top<initial.top-15&&Math.abs(changed.bottom-initial.bottom)<2,'north edge grows with bottom fixed');
  await page.locator('#widgetLayoutOverlay [data-layout-control="done"]').click();
  await page.evaluate(()=>{
   for(const [el,value,priority] of window.savedWidgetDisplay){if(value)el.style.setProperty('display',value,priority);else el.style.removeProperty('display')}
   delete window.savedWidgetDisplay;
   for(const id of ['nativeWidget_701','nativeWidget_702']){
    window.audioDeskUnregisterNativeWidget(id);document.getElementById(id).remove();
   }
   window.audioDeskRestoreWidgetLayouts();
  });
  // Exercise actual Home cards, not a pair of detached fixed test elements.
  // Reproduce the reported scattered original arrangement and a huge
  // decorative recents panel. Packing must ignore the old flow positions.
  await page.evaluate(()=>{
   window.scrollTo(0,0);
   const el=document.getElementById('launcherMusicWidget');
   el.style.setProperty('--widget-y','340px');
   const recent=document.getElementById('launcherRecentStrip');
   recent.style.setProperty('--widget-y','180px');
  });
  const beforeArrange=await page.evaluate(()=>localStorage.getItem('ad_widget_layout_v2_warm'));
  await page.evaluate(()=>document.getElementById('widgetAutoArrange').click());
  assert.match(await page.locator('#widgetArrangementStatus').textContent(),/Layout saved/);
  const packed=async()=>page.evaluate(()=>{
   const home=document.getElementById('launcherHomePage'),hr=home.getBoundingClientRect();
   const nodes=[...home.querySelectorAll('[data-widget-packed="true"]')].filter(el=>el.getClientRects().length&&el.getBoundingClientRect().height>0);
   return {scroll:scrollY,homeHeight:hr.height,vh:innerHeight,rows:nodes.map(el=>{
    const r=el.getBoundingClientRect();return {id:el.id,l:r.left-hr.left,t:r.top-hr.top,r:r.right-hr.left,b:r.bottom-hr.top,h:r.height};
   })};
  });
  const auto=await packed();
  assert.ok(auto.rows.length>=4,'real Home includes multiple packed widgets');
  assert.ok(Math.min(...auto.rows.map(r=>r.t))<80,'pack begins at safe top, not old scattered position');
  assert.equal(auto.scroll,0,'auto arrange returns to top');
  for(const r of auto.rows)for(const q of auto.rows)if(r!==q)assert.ok(Math.min(r.r,q.r)-Math.max(r.l,q.l)<=1||Math.min(r.b,q.b)-Math.max(r.t,q.t)<=1,'no overlapping packed cards');
  const ordered=auto.rows.slice().sort((a,b)=>a.t-b.t);
  let frontier=ordered[0].b;
  for(const r of ordered.slice(1)){assert.ok(r.t<=frontier+12,'no empty vertical shelf bands');frontier=Math.max(frontier,r.b)}
  assert.ok(auto.homeHeight<=Math.max(auto.vh,frontier+102),'no unused original flow extent');
  const recent=auto.rows.find(r=>r.id==='launcherRecentStrip');
  assert.ok(recent&&recent.h<auto.vh*.75,'frequently used card is content-sized, not viewport-sized');
  const afterAuto=await page.evaluate(()=>localStorage.getItem('ad_widget_layout_v2_warm'));
  await page.evaluate(()=>window.audioDeskRestoreWidgetLayouts());
  const reloaded=await packed();
  assert.deepEqual(reloaded.rows,auto.rows,'packed coordinates survive layout reload');
  await page.evaluate(()=>document.getElementById('widgetRandomize').click());
  assert.match(await page.locator('#widgetArrangementStatus').textContent(),/Layout saved/);
  const afterRandom=await page.evaluate(()=>localStorage.getItem('ad_widget_layout_v2_warm'));
  assert.notEqual(afterRandom,afterAuto,'randomize changes positions');
  await page.evaluate(()=>document.getElementById('widgetUndoArrange').click());
  assert.equal(await page.evaluate(()=>localStorage.getItem('ad_widget_layout_v2_warm')),afterAuto,'undo restores previous packed layout');
  // Repeat auto arrangement and undo from default/natural mode.
  await page.evaluate(()=>{
   localStorage.setItem('ad_widget_layout_v2_warm',JSON.stringify({}));
   window.audioDeskRestoreWidgetLayouts();
   document.getElementById('widgetAutoArrange').click();
   document.getElementById('widgetUndoArrange').click();
  });
  assert.equal(await page.locator('#launcherHomePage').getAttribute('data-packed-layout'),null,'undo restores natural layout mode');
  // Every theme has four distinct sharp, original audio compositions.
  await page.evaluate(()=>openWallpaperPicker());
  for(const theme of ['warm','minimal','pixel','windows']){
   await page.evaluate(theme=>setLauncherTheme(theme),theme);
   assert.equal(await page.locator('#audioWallpaperGrid .audio-art-choice').count(),4,
    'each theme has its own four-image audio collection');
  }
  // Pixel and Warm accents are tied to the actual selected wallpaper.
  for(const [theme,colors] of [['pixel',['blue','violet']],['warm',['grey','blush']]]){
   await page.evaluate(theme=>{closeCustomize(true);setLauncherTheme(theme)},theme);
   await page.evaluate(()=>openWallpaperPicker());
   const borders=[];
   for(const color of colors){
    await page.locator('[data-palette="'+color+'"]').click();
    borders.push(await page.locator('#launcherAlphaIndex').evaluate(el=>getComputedStyle(el).borderTopColor));
    const token=await page.evaluate(()=>document.documentElement.style.getPropertyValue('--theme-accent'));
    assert.ok(/^#[0-9a-f]{6}$/i.test(token),'wallpaper supplies a real accent');
   }
   assert.notEqual(borders[0],borders[1],theme+' A-Z index border must follow wallpaper color');
  }
  await page.evaluate(()=>setLauncherTheme('warm'));
  await page.locator('#audioWallpaperGrid .audio-art-choice').first().click();
  assert.equal(await page.locator('#audioArtworkImage').isVisible(),true);
  await page.waitForFunction(()=>window.nativeWallpapers?.length>0);
  const wallpaper=(await page.evaluate(()=>window.nativeWallpapers)).at(-1);
  assert.match(wallpaper.prefix,/^data:image\/jpeg;base64,/);
  assert.ok(wallpaper.bytes>5000,'full-resolution audio artwork is exported for Android Home and Lock');
  assert.ok(await page.evaluate(()=>localStorage.getItem('ad_audio_wallpaper_v1_warm')?.length>2));
  await page.evaluate(()=>{closeCustomize(true);setLauncherPage('events',false)});
  // Entire News feed supports the intended right-to-left Home gesture,
  // not merely swipes originating at the right screen edge.
  await page.evaluate(()=>{
   const el=document.getElementById('swipeMain');
   const fire=(type,x)=>{
    const t=new Touch({identifier:5,target:el,clientX:x,clientY:300,screenX:x,screenY:300});
    el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,
     touches:type==='touchend'?[]:[t],changedTouches:[t],targetTouches:type==='touchend'?[]:[t]}));
   };
   fire('touchstart',290);fire('touchmove',215);fire('touchend',68);
  });
  assert.equal(await page.evaluate(()=>launcherPage),'home',
   'News right-to-left swipe anywhere opens Home');
  assert.deepEqual(errors,[],'no JavaScript runtime errors');
  console.log('PASS: list/grid, Home-only app shortcuts, Android app settings, theme glass, folders, 8 resizing grips, widget movement, 16 wallpapers and News→Home swipes');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
