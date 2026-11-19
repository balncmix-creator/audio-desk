const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const serve=require('./serve-assets.cjs');
const origin='https://appassets.androidplatform.net/assets/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.micCalls=[];window.permissionCalls=0;window.nativeWidgetCalls=0;
   window.AudioDesk={
    setAcousticActive(s,f){window.micCalls.push([s,f])},
    enableAcousticMic(){window.permissionCalls++;setTimeout(()=>window.receiveAudioDeskAcoustics({state:'granted'}),20)},
    openNativeWidgets(){window.nativeWidgetCalls++},
    requestLauncherApps(){window.receiveLauncherApps([],[],true)},
    requestMediaState(){},setStatusBarTheme(){},setWallpaperTone(){},setRefreshEnabled(){},isDefaultLauncher(){return true}
   };
  });
  await page.route('**/*',route=>{
   const u=route.request().url();
   if(u===origin+'index.html')return route.fulfill({contentType:'text/html',body:fs.readFileSync('app/src/main/assets/index.html')});
   const local=serve(route);if(local)return local;
   if(u.includes('github.com')||u.includes('rss2json.com'))return route.fulfill({json:{status:'ok',items:[]}});
   return route.abort();
  });
  await page.goto(origin+'index.html');
  await page.waitForFunction(()=>typeof window.receiveAudioDeskAcoustics==='function');
  const spl=page.locator('#launcherSplWidget'),fft=page.locator('#launcherMicAnalyzer');
  assert.equal(await spl.isVisible(),false);assert.equal(await fft.isVisible(),false);
  await page.locator('#launcherSettingsToggle').click();
  await page.locator('#acousticAddSpl').click();
  await page.locator('#acousticAddFft').click();
  await page.locator('#launcherOptionsClose').click();
  assert.equal(await spl.isVisible(),true);assert.equal(await fft.isVisible(),true);
  assert.equal(await page.evaluate(()=>window.permissionCalls),0,'adding widgets never activates mic');
  await page.locator('#splStart').click();
  await page.waitForFunction(()=>window.micCalls.at(-1)?.[0]===true);
  await page.locator('#micFftStart').click();
  await page.waitForFunction(()=>window.micCalls.at(-1)?.every(Boolean));
  await page.evaluate(()=>window.receiveAudioDeskAcoustics({state:'active',raw:true,sampleRate:48000,fftSize:8192,levels:{
   A:{fast:-50,slow:-52},C:{fast:-47,slow:-48},Z:{fast:-45,slow:-45}},bands:Array.from({length:160},(_,i)=>-30-Math.abs(i-55))}));
  assert.equal(await page.locator('#splReading').textContent(),'-50.0');
  await page.locator('#splWeight').selectOption('Z');
  assert.equal(await page.locator('#splReading').textContent(),'-45.0');
  await page.locator('#splOffset').fill('130');
  await page.locator('#splOffset').dispatchEvent('change');
  assert.equal(await page.locator('#splReading').textContent(),'85.0');
  assert.match(await page.locator('#splUnit').textContent(),/SPL \(est\.\)/);
  assert.match(await page.locator('#micFftStatus').textContent(),/8192 FFT/);
  await page.evaluate(()=>window.audioDeskSetForeground(false));
  assert.deepEqual(await page.evaluate(()=>window.micCalls.at(-1)),[false,false]);
  await page.evaluate(()=>window.audioDeskSetForeground(true));
  await page.evaluate(()=>window.audioDeskBeginWidgetResize('launcherSplWidget'));
  await page.locator('#widgetLayoutOverlay [data-layout-control="remove"]').click();
  assert.equal(await spl.isVisible(),false);
  assert.deepEqual(await page.evaluate(()=>window.micCalls.at(-1)),[false,true]);
  await page.locator('#launcherSettingsToggle').click();
  await page.locator('#nativeWidgetsOpen').click();
  assert.equal(await page.evaluate(()=>window.nativeWidgetCalls),1);
  assert.deepEqual(await page.evaluate(()=>window.micCalls.at(-1)),[false,false]);
  await page.reload();await page.waitForFunction(()=>typeof window.receiveAudioDeskAcoustics==='function');
  assert.equal(await fft.isVisible(),true);
  assert.equal(await page.evaluate(()=>window.permissionCalls),0);
  assert.deepEqual(await page.evaluate(()=>window.micCalls.at(-1)),[false,false]);
  assert.deepEqual(errors,[]);
  console.log('PASS: optional acoustic widgets, permission gating, shared mic, weighting/calibration, FFT UI, removal, foreground lifecycle and native widget picker');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
