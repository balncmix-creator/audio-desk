const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const serve=require('./serve-assets.cjs');
const assets=path.join(__dirname,'../app/src/main/assets');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   window.AudioDesk={requestLauncherApps(){window.receiveLauncherApps([
    {pkg:'com.android.phone',activity:'Phone',label:'Phone',uses:4,icon:''},
    {pkg:'com.android.messaging',activity:'Messages',label:'Messages',uses:3,icon:''},
    {pkg:'com.android.camera',activity:'Camera',label:'Camera',uses:2,icon:''},
    {pkg:'com.example.music',activity:'Music',label:'Music',uses:1,icon:''}
   ],[],true)},setWallpaperTone(){}};
  });
  await page.route('**/*',route=>{
   const local=serve(route);if(local)return local;
   if(route.request().url()==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(assets,'index.html'))});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage')?.complete);
  for(const size of [{width:360,height:640},{width:393,height:852},{width:360,height:800}]){
   await page.setViewportSize(size);
   for(let i=0;i<10;i++){
    await page.evaluate(i=>{selectedWallpaper=i;customWallpaperSelected=false;return applyWallpaper()},i);
    const result=await page.locator('#wallpaperImage').evaluate(image=>{
     const box=image.getBoundingClientRect();return {width:image.naturalWidth,height:image.naturalHeight,
      top:box.top,left:box.left,right:box.right,bottom:box.bottom,fit:getComputedStyle(image).objectFit};
    });
    assert.equal(result.width,1024);assert.equal(result.height,1536);
    assert.equal(result.top,0);assert.equal(result.left,0);assert.equal(result.right,size.width);assert.equal(result.bottom,size.height);
    assert.equal(result.fit,'cover');
    const color=await page.locator('#launcherClock').evaluate(e=>getComputedStyle(e).color);
    assert.equal(color,i>=5?'rgb(16, 21, 27)':'rgb(243, 243, 243)','clock contrast follows wallpaper palette');
    if(process.env.WALLPAPER_QA_DIR&&size.width===393){
     fs.mkdirSync(process.env.WALLPAPER_QA_DIR,{recursive:true});
     await page.emulateMedia({reducedMotion:'reduce'});
     await page.screenshot({path:path.join(process.env.WALLPAPER_QA_DIR,`${i}.png`)});
    }
   }
  }
  await page.evaluate(()=>openWallpaperPicker());
  const thumbnails=page.locator('.wallpaper-thumb');assert.equal(await thumbnails.count(),10);
  for(let i=0;i<10;i++){
   await thumbnails.nth(i).scrollIntoViewIfNeeded();
   await thumbnails.nth(i).evaluate(image=>image.decode());
   assert.equal(await thumbnails.nth(i).evaluate(image=>image.naturalWidth),180);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: all 10 actual wallpaper assets fill 16:9, 20:9 and tall phone viewports, preserve native resolution, render appropriate text contrast and have decodable independent thumbnails');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
