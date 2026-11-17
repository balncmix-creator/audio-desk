const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const serve=require('./serve-assets.cjs');
const src=path.join(__dirname,'../app/src/main/assets');
const native=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/AudioSpectrumSupport.kt','utf8');
const projection=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/SpectrumProjectionService.kt','utf8');
const activity=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/MainActivity.kt','utf8');
const manifest=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');
assert.match(native,/Visualizer\(0\)/,'global output-mix source must use real Android PCM');
assert.match(native,/onWaveFormDataCapture/,'wave samples must originate in real output audio');
assert.match(native,/RECORD_AUDIO/,'audio visualization requires runtime permission');
assert.match(manifest,/android\.permission\.RECORD_AUDIO/);
assert.match(manifest,/android\.permission\.MODIFY_AUDIO_SETTINGS/);
assert.match(manifest,/android\.permission\.FOREGROUND_SERVICE_MEDIA_PROJECTION/);
assert.match(projection,/AudioPlaybackCaptureConfiguration\.Builder\(token\)/);
assert.match(projection,/ALLOW_CAPTURE|addMatchingUsage\(AudioAttributes.USAGE_MEDIA\)/);
assert.match(activity,/requestSpectrumCapture\(\)/);
assert.match(activity,/requestSpectrumProjection\(\)/);
assert.match(activity,/onPause\(\)[\s\S]*spectrumSupport.stop\(\)/);
assert.doesNotMatch(projection,/MediaRecorder\.AudioSource\.MIC/,'do not fake playback using mic capture');
(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.addInitScript(()=>{
   window.nativeSpectrumRequests=0;window.nativeSpectrumOn=[];
   window.AudioDesk={
    requestLauncherApps(){window.receiveLauncherApps?.([],[],true)},
    requestMediaState(){},
    requestSpectrumCapture(){window.nativeSpectrumRequests++},
    requestSpectrumProjection(){window.nativeProjectionRequests=(window.nativeProjectionRequests||0)+1},
    setSpectrumActive(value){window.nativeSpectrumOn.push(value)},
    setStatusBarTheme(){},setWallpaperTone(){},setRefreshEnabled(){},
    isDefaultLauncher(){return true},launchExternalApp(){}
   };
  });
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',
     body:fs.readFileSync(path.join(src,'index.html'))});
   const local=serve(route);if(local)return local;
   if(url.includes('github.com')||url.includes('rss2json.com'))
    return route.fulfill({json:{status:'ok',items:[]}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.waitForFunction(()=>!!window.audioDeskSpectrum);
  for(const theme of ['minimal','pixel','windows','warm']){
   await page.evaluate(theme=>setLauncherTheme(theme),theme);
   const measure=await page.locator('#launcherMusicWidget').evaluate(el=>{
    const widget=el.getBoundingClientRect();
    const wave=el.querySelector('#musicSpectrum').getBoundingClientRect();
    const controls=el.querySelector('.music-buttons').getBoundingClientRect();
    const note=el.querySelector('.music-note').getBoundingClientRect();
    const css=getComputedStyle(el.querySelector('#musicSpectrum'));
    return {widget:{left:widget.left,right:widget.right,top:widget.top,bottom:widget.bottom},
     wave:{left:wave.left,right:wave.right,top:wave.top,bottom:wave.bottom},
     controls:{left:controls.left,right:controls.right,top:controls.top,bottom:controls.bottom},
     noteBottom:note.bottom,overflow:css.overflow,background:css.backgroundColor,
     border:css.borderTopWidth,shadow:css.boxShadow};
   });
   assert.equal(measure.overflow,'hidden',theme+' spectrum is clipped');
   assert.equal(measure.background,'rgba(0, 0, 0, 0)',
    theme+' visualizer must be transparent without an inner square');
   assert.equal(measure.shadow,'none',
    theme+' visualizer must not draw a rectangular inset shadow');
   assert.equal(measure.border,'0px',
    theme+' visualizer must not have an inner box border');
   assert.ok(measure.wave.left>=measure.widget.left-1&&measure.wave.right<=measure.widget.right+1,
    theme+' waveform must remain within widget width');
   assert.ok(measure.wave.bottom<=measure.controls.top+1,
    theme+' waveform must never collide with playback buttons');
   assert.ok(measure.controls.bottom<=measure.widget.bottom+1,
    theme+' playback buttons remain inside widget');
   assert.ok(measure.noteBottom<=measure.widget.bottom+1,
    theme+' details stay inside widget');
  }
  await page.evaluate(()=>setLauncherTheme('minimal'));
  assert.equal(await page.evaluate(()=>window.nativeSpectrumOn.filter(Boolean).length),0,
   'no automatic capture before consent');
  await page.locator('#musicSpectrumEnable').click();
  assert.equal(await page.evaluate(()=>window.nativeSpectrumRequests),1,
   'native permission request is initiated by the user');
  await page.evaluate(()=>window.receiveAudioDeskMedia?.({
   enabled:true,available:true,playing:true,title:'Playing',artist:'Artist',
   canToggle:true,canNext:true,canPrevious:true
  }));
  assert.equal(await page.locator('#musicToggle').textContent(),'❚❚');
  assert.equal(await page.locator('#musicToggle').getAttribute('aria-label'),'Pause playback');
  await page.evaluate(()=>window.receiveAudioDeskSpectrum({state:'listening'}));
  await page.evaluate(()=>{
   const samples=Array.from({length:96},(_,i)=>Math.sin(i*.37)*.7);
   window.receiveAudioDeskSpectrum({state:'capturing',rms:.4,samples});
  });
  await page.waitForFunction(()=>window.audioDeskSpectrum.active());
  const response=await page.evaluate(()=>window.audioDeskSpectrum.smoothing());
  assert.equal(response.riseMs,420,'real waveform uses a slow liquid attack');
  assert.equal(response.releaseMs,1050,'real waveform glides to rest');
  assert.ok(response.level<response.targetLevel*.7,
   'the waveform must not jump instantly to the captured signal amplitude');
  await page.waitForTimeout(250);
  const eased=await page.evaluate(()=>window.audioDeskSpectrum.smoothing());
  assert.ok(eased.level>=0,'waveform energy stays nonnegative');
  const drawing=await page.locator('#musicSpectrumCanvas').evaluate(el=>
   Array.from(el.getContext('2d').getImageData(0,0,el.width,el.height).data)
    .filter((v,i)=>i%4===3&&v>0).length);
  assert.ok(drawing>30,'actual sample stream draws multiple waveform contours');
  await page.evaluate(()=>window.receiveAudioDeskMedia?.({
   enabled:true,available:true,playing:false,title:'Paused',artist:'Artist',
   canToggle:true,canNext:true,canPrevious:true
  }));
  assert.equal(await page.locator('#musicToggle').textContent(),'▶');
  assert.equal(await page.locator('#musicToggle').getAttribute('aria-label'),'Play playback');
  await page.evaluate(()=>window.receiveAudioDeskSpectrum({state:'unsupported'}));
  assert.equal(await page.locator('#musicSpectrumProjection').isVisible(),true,
   'Android fallback is offered if output mix is unsupported');
  await page.locator('#musicSpectrumProjection').click();
  assert.equal(await page.evaluate(()=>window.nativeProjectionRequests),1);
  await page.evaluate(()=>setLauncherPage('apps',false));
  assert.equal((await page.evaluate(()=>window.nativeSpectrumOn)).at(-1),false,
   'real audio capture stops as soon as Home is hidden');
  assert.deepEqual(errors,[],'no JS exceptions');
  console.log('PASS: real PCM-only glow, playback permissions, clip-safe media layouts in all themes, play/pause and pause outside Home');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
