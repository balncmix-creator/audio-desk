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
assert.match(native,/latestRms = sqrt\(sumSquares \/ waveform.size\)/,
 'RMS must be calculated from the entire native capture buffer');
assert.match(native,/onFftDataCapture/,'Android real FFT callback is enabled');
assert.match(native,/true, true\)/,
 'Android visualizer must request both waveform and frequency data');
const dsp=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/SpectrumBands.kt','utf8');
assert.match(dsp,/fromVisualizerFft/);
assert.match(dsp,/fromPcm/);
assert.match(projection,/FloatArray\(ANALYSIS_WINDOW\)/,'projection must retain a contiguous PCM analysis window for FFT');
assert.match(native,/getMaxCaptureRate\(\)\.coerceAtMost\(30000\)/,
 'native capture should request up to 30Hz to give responsive RMS motion');
assert.match(projection,/now - sent < 32L/,
 'permitted-playback PCM capture refreshes on a responsive cadence');
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
  // User-owned settings, persistent between launches and live-updateable.
  const settingsButton=page.locator('#musicSpectrumSettingsToggle');
  await settingsButton.click();
  const dialog=page.locator('#musicSpectrumTuningDialog');
  assert.equal(await dialog.isVisible(),true,
   'a settings sheet is accessible directly from the music widget');
  let settings=await page.evaluate(()=>window.audioDeskSpectrum.settings());
  assert.equal(settings.mode,'spectrum',
   'single-sided Pro-Q-style spectrum is the default, not the mirror');
  assert.equal(await page.locator('[data-spectrum-mode="spectrum"]').getAttribute('aria-pressed'),
   'true','Spectrum tab is selected');
  await page.locator('[data-spectrum-mode="wave"]').click();
  assert.equal((await page.evaluate(()=>window.audioDeskSpectrum.displayGeometry())).mode,
   'wave','existing mirrored wave is still available');
  await page.locator('[data-spectrum-mode="spectrum"]').click();
  assert.equal((await page.evaluate(()=>window.audioDeskSpectrum.displayGeometry())).mode,
   'spectrum','spectrum can be restored without restarting audio');
  assert.deepEqual([settings.speed,settings.attackMs,settings.releaseMs],
   [5,18,115],'Fast is the new default response preset');
  await page.locator('#spec-setting-speed').evaluate(input=>{
   input.value='8';input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.locator('#spec-setting-attackMs').evaluate(input=>{
   input.value='12';input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.locator('#spec-setting-releaseMs').evaluate(input=>{
   input.value='70';input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  settings=await page.evaluate(()=>window.audioDeskSpectrum.settings());
  assert.deepEqual([settings.speed,settings.attackMs,settings.releaseMs],[8,12,70],
   'sliders update actual meter behavior without restarting playback');
  assert.equal(await page.locator('#spec-value-attackMs').textContent(),'12 ms');
  const persisted=await page.evaluate(()=>JSON.parse(
   deskStorage.getItem('ad_visualizer_tuning_v1')));
  assert.equal(persisted.attackMs,12,'settings are stored on-device');
  await page.reload();
  await page.waitForFunction(()=>!!window.audioDeskSpectrum);
  settings=await page.evaluate(()=>window.audioDeskSpectrum.settings());
  assert.equal(settings.speed,8,'stored speed survives an app reload');
  assert.equal(settings.releaseMs,70,'stored release survives an app reload');
  assert.equal(settings.mode,'spectrum','analyzer mode persists on restart');
  await page.locator('#musicSpectrumSettingsToggle').click();
  await page.locator('[data-spectrum-preset="fluid"]').click();
  settings=await page.evaluate(()=>window.audioDeskSpectrum.settings());
  assert.deepEqual([settings.speed,settings.attackMs,settings.releaseMs],
   [2,115,450],'Fluid preset selects independently slower dynamics');
  await page.locator('[data-spectrum-preset="balanced"]').click();
  settings=await page.evaluate(()=>window.audioDeskSpectrum.settings());
  assert.equal(settings.attackMs,55,'Balanced preset is available');
  await page.locator('[data-spectrum-preset="fast"]').click();
  assert.equal(await page.locator('[data-spectrum-preset="fast"]').getAttribute('aria-pressed'),
   'true','selected preset has accessible pressed state');
  await page.locator('#musicSpectrumTuningClose').click();
  assert.equal(await page.locator('#musicSpectrumTuningOverlay').isVisible(),false,
   'settings are dismissed without covering playback');
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
  const bassBands=Array.from({length:28},(_,i)=>i>=3&&i<=7?.75:.025);
  const trebleBands=Array.from({length:28},(_,i)=>i>=19&&i<=23?.75:.025);
  await page.evaluate(bands=>{
   window.receiveAudioDeskSpectrum({state:'capturing',rms:.4,bands,source:'android-fft'});
  },bassBands);
  const bassState=await page.evaluate(()=>window.audioDeskSpectrum.frequencyState());
  assert.ok(bassState.target[11]>bassState.target[50],
   'bass-rich audio creates a low-frequency peak, not a static oval');
  await page.evaluate(bands=>{
   window.receiveAudioDeskSpectrum({state:'capturing',rms:.4,bands,source:'android-fft'});
  },trebleBands);
  const trebleState=await page.evaluate(()=>window.audioDeskSpectrum.frequencyState());
  assert.ok(trebleState.target[50]>trebleState.target[11],
   'same RMS but different frequencies must produce a DIFFERENT spectrum shape');
  await page.waitForFunction(()=>window.audioDeskSpectrum.active());
  const response=await page.evaluate(()=>window.audioDeskSpectrum.smoothing());
  assert.equal(response.riseMs,18,'Fast preset responds quickly to beats');
  assert.equal(response.releaseMs,115,'Fast preset settles without perceptible lag');
  assert.ok(response.targetLevel>.9,
   'strong actual RMS must produce a clearly visible near-full-height wave');
  await page.waitForTimeout(240);
  const eased=await page.evaluate(()=>window.audioDeskSpectrum.smoothing());
  const graph=await page.evaluate(()=>window.audioDeskSpectrum.displayGeometry());
  assert.equal(graph.mode,'spectrum','single-sided spectrum mode draws real FFT');
  assert.equal(graph.points.length,64);
  const baseline=Math.max(...graph.points.map(p=>p.y));
  assert.ok(graph.points.every(p=>p.y<=baseline&&p.y>=0),
   'the frequency analyzer only rises from its bottom baseline');
  assert.ok(Math.min(...graph.points.map(p=>p.y)) < baseline*.85,
   'frequency content creates raised spectrum peaks');
  assert.ok(graph.points.every((p,i)=>i===0||p.x>graph.points[i-1].x),
   'frequency progresses one direction from bass to treble');
  assert.ok(eased.level>.35,
   'RMS level should rise visibly within a fraction of a second');
  assert.ok(eased.maxWaveHeight>.35,
   'the spectrum itself must have visible height rather than only an RMS label');
  assert.match(await page.locator('#musicSpectrumStatus').textContent(),/FFT \+ RMS .* dBFS/,
   'the widget should display actual measured RMS');
  await page.evaluate(bands=>{
   window.receiveAudioDeskSpectrum({state:'capturing',rms:.04,bands,source:'projection-fft'});
  },trebleBands);
  const quiet=await page.evaluate(()=>window.audioDeskSpectrum.smoothing());
  assert.ok(quiet.targetLevel<response.targetLevel,
   'quiet real PCM must drive a smaller wave than louder real PCM');
  // No FFT means NO invented oval, even if native sends a loud RMS level.
  await page.evaluate(()=>window.receiveAudioDeskSpectrum({state:'capturing',rms:.55}));
  const unavailable=await page.evaluate(()=>window.audioDeskSpectrum.frequencyState());
  assert.ok(unavailable.target.every(value=>value===0),
   'RMS-only input cannot fake frequency contours');
  assert.match(await page.locator('#musicSpectrumStatus').textContent(),/no frequency data/,
   'RMS-only capture is clearly identified');
  await page.evaluate(bands=>{
   window.receiveAudioDeskSpectrum({state:'capturing',rms:.2,bands,source:'pcm-fft'});
  },bassBands);
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
