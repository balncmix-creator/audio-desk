const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.nativeIconRequests=[];
   // Valid tiny PNG; actual app produces 72px, four-tone Android source icons.
   const data='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS6sAAAAASUVORK5CYII=';
   const apps=Array.from({length:100},(_,i)=>({
    pkg:'com.example.app'+i,activity:'Main',label:'App '+String(i).padStart(3,'0'),uses:100-i
   }));
   window.AudioDesk={
    requestLauncherApps(){window.receiveLauncherApps(apps,[],true)},
    requestLauncherIcon(pkg,activity,theme){
     window.nativeIconRequests.push({pkg,activity,theme});
     setTimeout(()=>{
      window.receiveAudioDeskAppIcon?.(pkg,activity,theme,
       pkg==='com.example.app4'?null:data);
     },8);
    },
    requestMediaState(){window.receiveAudioDeskMedia({enabled:false,available:false})},
    hideSearchKeyboard(){},requestSearchKeyboard(){},launchExternalApp(){}
   };
  });
  await page.route('**/*',route=>{
   const asset=require('./serve-assets.cjs')(route);if(asset)return asset;
   const u=route.request().url();
   if(u==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',
      body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8')});
   if(u.includes('api.rss2json.com')||u.includes('api.github.com'))
    return route.fulfill({json:{items:[],status:'ok'}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.waitForFunction(()=>typeof launcherApps!=='undefined'&&launcherApps.length===100);
  await page.evaluate(()=>{setLauncherTheme('warm');setLauncherPage('apps',false)});
  await page.waitForFunction(()=>document.querySelectorAll('#launcherAppsGrid .auto-app-icon.has-native-icon').length>=3);
  const initial=await page.evaluate(()=>nativeIconRequests.filter(x=>x.theme==='warm').length);
  assert.ok(initial>=3&&initial<50,
   'native icons load only visible or near-visible rows, not all 100 installed apps');
  const first=page.locator('#launcherAppsGrid .auto-app-icon').first();
  assert.match(await first.locator('.native-app-image').getAttribute('src'),
   /^data:image\/png;base64,/);
  assert.equal(await first.locator('.icon-fallback').isVisible(),false,
   'matching native icon replaces the generic placeholder');
  // Android icons are cache-scoped by both app identity and visual theme.
  await page.evaluate(()=>setLauncherTheme('pixel'));
  await page.waitForFunction(()=>nativeIconRequests.some(x=>x.theme==='pixel'));
  assert.equal(await page.locator('#launcherAppsGrid .auto-app-icon[data-icon-theme="pixel"]').count(),100);
  await page.evaluate(()=>setLauncherTheme('windows'));
  await page.waitForFunction(()=>nativeIconRequests.some(x=>x.theme==='windows'));
  await page.evaluate(()=>setLauncherTheme('minimal'));
  await page.waitForFunction(()=>nativeIconRequests.some(x=>x.theme==='minimal'));
  await page.evaluate(()=>setLauncherTheme('warm'));
  const before=await page.evaluate(()=>nativeIconRequests.filter(x=>x.theme==='warm').length);
  await page.evaluate(()=>renderLauncherApps());
  await page.waitForTimeout(100);
  const after=await page.evaluate(()=>nativeIconRequests.filter(x=>x.theme==='warm').length);
  assert.equal(after,before,'re-rendered apps reuse the in-memory native icon cache');
  // The fallback stays intact if Android cannot supply an app icon.
  await page.waitForFunction(()=>document.querySelector('#launcherAppsGrid .auto-app-icon[data-icon-pkg="com.example.app4"]')?.dataset.iconState==='fallback');
  const unknown=page.locator('#launcherAppsGrid .auto-app-icon[data-icon-pkg="com.example.app4"]');
  assert.equal(await unknown.locator('.icon-fallback').isVisible(),true);
  // The exact same icon engine is shared by Home, Recents, Apps, and folders.
  await page.evaluate(()=>setLauncherPage('home',false));
  assert.ok(await page.locator('#launcherRecentQuick .auto-app-icon').count()>0);
  await page.evaluate(()=>setLauncherPage('apps',false));
  await page.locator('[data-apps-layout="grid"]').click();
  assert.ok(await page.locator('#launcherAppsGrid .auto-app-icon').count()===100);
  assert.deepEqual(errors,[],'no unexpected JavaScript errors while icons change themes');
  console.log('PASS: native icon loading is lazy; Warm, Pixel, Windows and Minimal each request their own icons; results are cached across renders, and missing icons keep a themed fallback');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
