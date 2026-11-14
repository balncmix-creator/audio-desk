const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:360,height:740},hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.testKeyboardRequests=0;window.testShortcutsRequests=[];
   window.AudioDesk={
    requestLauncherApps(){
     window.receiveLauncherApps([
      {pkg:'com.google.android.apps.nbu.paisa.user',activity:'GPayHome',
       label:'Google Pay',uses:5,icon:''},
      {pkg:'com.example.camera',activity:'CameraHome',label:'Camera',uses:2,icon:''}
     ],[],true);
    },
    requestSearchKeyboard(){window.testKeyboardRequests++},
    getAppShortcuts(pkg,activity){
     window.testShortcutsRequests.push({pkg,activity});
     window.receiveAppShortcuts(pkg,activity,[{id:'scan_qr',label:'Scan QR'},{id:'pay',label:'Pay'}]);
    },
    launchAppShortcut(pkg,activity,id){
     window.launchedShortcut={pkg,activity,id};
    },
    launchExternalApp(){},
    requestDefaultLauncher(){}
   };
  });
  await page.route('**/*',route=>{
  const localAsset = require('./serve-assets.cjs')(route); if(localAsset)return localAsset;
   const url=route.request().url();
   if(url==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',body:fs.readFileSync(
     path.join(__dirname,'../app/src/main/assets/index.html'))});
   if(url.includes('/pixel-icons/')){
    const name=url.split('/').pop();
    const file=path.join(__dirname,'../app/src/main/assets/pixel-icons',name);
    if(fs.existsSync(file))return route.fulfill({contentType:'image/svg+xml',body:fs.readFileSync(file)});
   }
   if(url.includes('api.rss2json.com'))return route.fulfill({json:{status:'ok',items:[]}});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.waitForFunction(()=>launcherApps.length===2);
  assert.equal(await page.evaluate(()=>launcherPage),'home');
  const pay=page.locator('#launcherFavorites .launcher-app').filter({hasText:'Google Pay'});
  assert.equal(await pay.locator('img[src*="credit-card.svg"]').count(),1,
   'real pixel icon pack is used for Google Pay');
  assert.equal(await pay.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0),true);

  const gesture=async(target,from,to)=>{
   await page.evaluate(({target,from,to})=>{
    const el=document.querySelector(target);
    function emit(type,pt){
     const t=new Touch({identifier:22,target:el,clientX:pt[0],clientY:pt[1],
      screenX:pt[0],screenY:pt[1]});
     el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,
      touches:type==='touchend'?[]:[t],
      targetTouches:type==='touchend'?[]:[t],changedTouches:[t]}));
    }
    emit('touchstart',from);
    emit('touchmove',[(from[0]+to[0])/2,(from[1]+to[1])/2]);
    emit('touchend',to);
   },{target,from,to});
  };
  // Swipe on the GPay icon horizontally: native-provided scan and pay options.
  await gesture('#launcherFavorites .launcher-app',[250,330],[115,332]);
  assert.equal(await page.locator('#launcherShortcutMenu').isVisible(),true);
  assert.equal((await page.evaluate(()=>window.testShortcutsRequests)).length,1);
  assert.match(await page.locator('#launcherShortcutActions').textContent(),/Scan QR/);
  await page.locator('[data-app-shortcut-id="scan_qr"]').click();
  assert.deepEqual((await page.evaluate(()=>window.launchedShortcut)),{
   pkg:'com.google.android.apps.nbu.paisa.user',activity:'GPayHome',id:'scan_qr'
  });
  assert.equal(await page.locator('#launcherShortcutMenu').isVisible(),false);
  // Swipe up from the home surface (away from app buttons).
  await gesture('#launcherHomePage',[180,660],[179,432]);
  assert.equal(await page.evaluate(()=>launcherPage),'apps');
  assert.equal(await page.locator('#launcherAppSearch').evaluate(x=>document.activeElement===x),true);
  assert.equal(await page.evaluate(()=>window.testKeyboardRequests),1);
  assert.equal(await page.locator('#launcherAlphaIndex').isVisible(),true);

  // Old news content no longer has horizontal category swipe listeners.
  await page.locator('[data-home-nav="events"]').click();
  assert.equal(await page.evaluate(()=>active),'All');
  await gesture('#swipeMain',[160,300],[90,303]); // not an edge swipe
  assert.equal(await page.evaluate(()=>active),'All');
  assert.equal(await page.locator('#tabSwipePreview').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: Pixelarticons, GPay published Scan QR shortcut swipe, automatic search keyboard request, no horizontal news category switching');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
