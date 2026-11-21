const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

// Validate the actual Android integration, not only a browser representation.
const native=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/LocalAppIconProvider.kt','utf8');
const activity=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/MainActivity.kt','utf8');
const launcher=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/HomeLauncherSupport.kt','utf8');
assert.match(native,/WebViewAssetLoader\.PathHandler/,'native icons are delivered by Android asset loader');
assert.match(native,/getApplicationIcon\(pkg\)/,'icons use actual installed app resources');
assert.match(native,/isLaunchable\(pkg\)/,'icon requests may only target verified installed launcher apps');
assert.match(native,/LruCache<String, ByteArray>/,'on-device icon bytes have bounded RAM caching');
assert.match(native,/if \(theme == "pixel" \|\| theme == "pack-arcade"\) 32 else 128/,'8-bit and Arcade pack use deliberately pixelated resources');
for(const theme of ['pixel','windows','warm','original'])
 assert.ok(native.includes('"'+theme+'"'),'native icon generator must recognize '+theme);
assert.match(native,/original\|minimal\|pixel\|windows\|warm/,
 'native path routing covers all four themes plus original mode');
assert.match(activity,/addPathHandler\("\/app-icons\/", appIconProvider\)/);
assert.match(activity,/supportsAdaptiveAppIcons\(\): Boolean = true/);
assert.match(launcher,/fun hasLaunchablePackage\(pkg: String\)/);
assert.doesNotMatch(native,/\b(?:HttpURLConnection|OkHttpClient|URL\(.*https|retrofit)\b/i,
 'the native icon builder must never send installed-app icons over the network');

(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
  const exceptions=[];page.on('pageerror',e=>exceptions.push(e.message));
  const iconPNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGM8P33jfwY8gAmf5PBRAAAwGQMm1+BwEAAAAABJRU5ErkJggg==','base64');
  await page.addInitScript(()=>{
   window.AudioDesk={
    supportsAdaptiveAppIcons(){return true},
    requestLauncherApps(){
     const apps=[
      {pkg:'com.sample.audio',activity:'AudioHome',label:'Audio Player',uses:7,icon:''},
      {pkg:'com.sample.games',activity:'GamesHome',label:'Games',uses:6,icon:''},
      {pkg:'com.sample.unknown',activity:'Unknown Utility',label:'Unknown Utility',uses:5,icon:''},
      {pkg:'com.sample.photos',activity:'PhotosHome',label:'Photo Gallery',uses:4,icon:''},
      {pkg:'com.sample.chat',activity:'ChatHome',label:'Chat',uses:3,icon:''},
      {pkg:'com.sample.mixer',activity:'MixerHome',label:'Mixer Pro',uses:2,icon:''},
      {pkg:'com.sample.broken',activity:'BrokenHome',label:'Broken Icon Test',uses:1,icon:''}
     ];
     setTimeout(()=>window.receiveLauncherApps?.(apps,[],false),0);
    },
    requestMediaState(){window.receiveAudioDeskMedia?.({enabled:false,available:false})},
    setStatusBarTheme(){},setWallpaperTone(){},setRefreshEnabled(){},
    isDefaultLauncher(){return false}
   };
  });
  const requested=[];
  await page.route('**/*',route=>{
   const local=require('./serve-assets.cjs')(route);if(local)return local;
   const url=new URL(route.request().url());
   if(url.href==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',
     body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'))});
   if(url.pathname.startsWith('/app-icons/')){
    requested.push(url.pathname);
    if(url.pathname.endsWith('/com.sample.broken.png'))
     return route.fulfill({contentType:'image/png',body:Buffer.alloc(0)});
    return route.fulfill({contentType:'image/png',body:iconPNG});
   }
   if(url.hostname.includes('rss2json.com')||url.hostname.includes('github.com'))
    return route.fulfill({json:{status:'ok',items:[]}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.waitForFunction(()=>window.audioDeskIconStudio?.nativeReady===true&&launcherApps.length===7);
  await page.evaluate(()=>{setLauncherTheme('warm');setLauncherPage('apps',false)});
  assert.equal(await page.locator('#launcherAppsGrid .ad-icon-shell').count(),7,
   'all seven installed apps get a native icon request instead of generic four-square symbols');
  const icons=await page.locator('#launcherAppsGrid .ad-icon-image')
   .evaluateAll(images=>images.map(img=>new URL(img.src).pathname));
  assert.ok(icons.every(x=>x.startsWith('/app-icons/warm/com.sample.')),
   'Warm Minimal icons are generated in warm theme, not an unrelated icon pack');
  await page.locator('#launcherAppsGrid .ad-icon-image')
   .evaluateAll(images=>images.forEach(img=>{img.loading='eager'}));
  await page.waitForFunction(()=>document.querySelectorAll('#launcherAppsGrid .ad-icon-shell.icon-loaded').length===6,
   null,{timeout:6000});
  assert.equal(await page.locator('#launcherAppsGrid .ad-icon-shell.icon-loaded').count(),6,
   'all valid example icons load while a bad icon falls back safely');
  assert.equal(await page.locator('#launcherAppsGrid .ad-icon-shell:not(.icon-loaded) .warm-line-icon').count(),1,
   'an unavailable native icon retains a recognizable inline fallback');
  await page.evaluate(()=>audioDeskIconStudio.open());
  assert.equal(await page.locator('#launcherIconStudioDialog').isVisible(),true);
  assert.equal(await page.locator('#iconStudioPreview .ad-icon-shell').count(),7);
  assert.equal(await page.locator('[data-icon-mode="themed"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-icon-mode="original"]').click();
  assert.equal(await page.evaluate(()=>audioDeskIconStudio.mode()),'original');
  assert.ok((await page.locator('#iconStudioPreview .ad-icon-image').first().getAttribute('src'))
   .startsWith('/app-icons/original/'));
  await page.locator('[data-icon-mode="outline"]').click();
  assert.equal(await page.locator('#iconStudioPreview .ad-icon-shell').count(),0,
   'simple outlines do not fetch native images');
  assert.equal(await page.locator('#iconStudioPreview .warm-line-icon svg').count(),7);
  await page.locator('[data-icon-mode="themed"]').click();
  await page.locator('#iconStudioDone').click();
  await page.evaluate(()=>setLauncherTheme('pixel'));
  assert.equal(await page.evaluate(()=>audioDeskIconStudio.mode()),'themed');
  assert.ok((await page.locator('#launcherAppsGrid .ad-icon-image').first().getAttribute('src'))
   .startsWith('/app-icons/pixel/'));
  const rendering=await page.locator('#launcherAppsGrid .ad-icon-image').first()
   .evaluate(el=>getComputedStyle(el).imageRendering);
  assert.equal(rendering,'pixelated','8-Bit icons use crisp pixels rather than filtered blurry icons');
  await page.evaluate(()=>audioDeskIconStudio.setMode('original'));
  await page.evaluate(()=>setLauncherTheme('warm'));
  assert.equal(await page.evaluate(()=>audioDeskIconStudio.mode()),'themed',
   'icon presentation is saved independently for each theme');
  await page.evaluate(()=>setLauncherTheme('windows'));
  assert.ok((await page.locator('#launcherAppsGrid .ad-icon-image').first().getAttribute('src'))
   .startsWith('/app-icons/windows/'),'Windows Tiles gets a separate colour-matched icon version');
  assert.ok(requested.some(x=>x.startsWith('/app-icons/warm/')));
  assert.deepEqual(exceptions,[],'no JavaScript errors while changing icon design modes');
  console.log('PASS: all installed app icons use local native assets with fallback, original/outline choices, per-theme persistence and crisp pixel-mode rendering');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
