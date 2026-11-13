const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const logo=JSON.parse(fs.readFileSync(path.join(__dirname,'../brand/desk-logo.json'),'utf8'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852}});
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='https://appassets.androidplatform.net/assets/index.html')return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8')});
   if(url.includes('api.rss2json.com'))return route.fulfill({json:{status:'ok',items:[]}});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  const icon=page.locator('#animatedDeskLogo');
  assert.equal(await icon.count(),1,'animated desk appears next to Audio Desk title');
  const geometry=await icon.locator('[data-desk-part]').evaluateAll(parts=>Object.fromEntries(parts.map(p=>[p.dataset.deskPart,p.getAttribute('d')])));
  for(const part of ['top','front','side','legs'])assert.equal(geometry[part],logo[part],part+' matches the launcher geometry');
  assert.ok(geometry.wave.startsWith('M36,51'),'waveform must be the projected Audio Desk waveform');
  assert.equal(await page.locator('.brand-line .brand').innerText(),'THE AUDIO DESK_');
  const spin=page.locator('.header-desk-spin');
  const float=page.locator('.header-desk-float');
  const wave=page.locator('.header-desk-wave');
  const running=await page.evaluate(()=>['.header-desk-spin','.header-desk-float','.header-desk-wave'].map(s=>getComputedStyle(document.querySelector(s)).animationName));
  assert.deepEqual(running,['desk-masthead-spin','desk-masthead-float','desk-masthead-wave'],'all three animations run by default');
  const iconBox=await icon.boundingBox(), titleBox=await page.locator('.brand-line .brand').boundingBox(),refreshBox=await page.locator('#refresh').boundingBox();
  assert.ok(iconBox && iconBox.width>=40,'icon is visible at phone width');
  assert.ok(titleBox && refreshBox && titleBox.x+titleBox.width<=refreshBox.x+1,'masthead does not overlap refresh button');
  await page.setViewportSize({width:320,height:720});
  const small=await icon.boundingBox(),button=await page.locator('#refresh').boundingBox();
  assert.ok(small && button && small.x+small.width<=button.x+1,'desk icon does not overlap the refresh button on narrow devices');
  await page.emulateMedia({reducedMotion:'reduce'});
  const reduced=await page.evaluate(()=>['.header-desk-spin','.header-desk-float','.header-desk-wave'].map(s=>getComputedStyle(document.querySelector(s)).animationName));
  assert.deepEqual(reduced,['none','none','none'],'reduced motion disables all header icon animations');
  console.log('PASS: correct launcher geometry, rotating and floating desk, pulsing waveform, compact header and reduced-motion support');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
