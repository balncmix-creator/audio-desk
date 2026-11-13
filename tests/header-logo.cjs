const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='https://appassets.androidplatform.net/assets/index.html')return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8')});
   if(url.includes('api.rss2json.com'))return route.fulfill({json:{status:'ok',items:[]}});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  const icon=page.locator('#animatedDeskLogo');
  assert.equal(await icon.count(),1,'a single rotating desk sits next to the title');
  assert.equal(await page.locator('.brand-line .brand').innerText(),'THE AUDIO DESK_');
  assert.equal(await icon.getAttribute('width'),'256');
  assert.equal(await icon.getAttribute('height'),'256');
  const first=await icon.evaluate(el=>{
    const ctx=el.getContext('2d'),px=ctx.getImageData(0,0,el.width,el.height).data;
    return {angle:+el.dataset.rotationAngle,opaque:px.some((x,i)=>i%4===3&&x>0)};
  });
  assert.ok(first.opaque,'rendered 3D desk is visible');
  await page.waitForTimeout(230);
  const second=await icon.evaluate(el=>+el.dataset.rotationAngle);
  assert.ok(second>first.angle && second-first.angle<.6,'3D model rotates at a slow steady rate');
  assert.equal(await icon.evaluate(el=>getComputedStyle(el).transform),'none','no CSS transform squeezes the canvas');
  const fixed=await icon.boundingBox();
  await page.waitForTimeout(400);
  const after=await icon.boundingBox();
  assert.equal(fixed.width,after.width,'3D rotation cannot change icon width');
  assert.equal(fixed.height,after.height,'3D rotation cannot change icon height');
  const heading=await page.locator('.brand-line .brand').boundingBox(),button=await page.locator('#refresh').boundingBox();
  assert.ok(heading&&button&&heading.x+heading.width<=button.x+1,'heading fits beside button');
  await page.setViewportSize({width:320,height:720});
  const compact=await icon.boundingBox(),refresh=await page.locator('#refresh').boundingBox();
  assert.ok(compact&&refresh&&compact.x+compact.width<=refresh.x+1,'3D desk does not overlap refresh on narrow phone');
  await page.emulateMedia({reducedMotion:'reduce'});
  const stopped=+await icon.evaluate(el=>el.dataset.rotationAngle);
  await page.waitForTimeout(210);
  assert.equal(+await icon.evaluate(el=>el.dataset.rotationAngle),stopped,'rotation pauses with reduced motion');
  assert.deepEqual(errors,[],'no uncaught script errors');
  console.log('PASS: rigid canvas desk rotates in 3D without CSS squashing, keeps fixed dimensions, fits mobile, respects reduced motion');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
