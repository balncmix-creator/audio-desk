const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const serve=require('./serve-assets.cjs');
const origin='https://appassets.androidplatform.net/assets/';
const assets=path.join(__dirname,'../app/src/main/assets');
const hexRgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('about:blank');
  const fixtures=await page.evaluate(()=>{
   const make=(background,detail,side)=>{
    const c=document.createElement('canvas');c.width=1080;c.height=1920;
    const x=c.getContext('2d');x.fillStyle=background;x.fillRect(0,0,1080,1920);
    x.fillStyle=detail;x.fillRect(180,140,600,540);
    x.fillStyle=side;x.fillRect(120,1180,670,450);
    return c.toDataURL('image/png');
   };
   return {
    warm:make('#b49b7f','#e0cbb4','#78614e'),
    cool:make('#254b83','#65a6e2','#243a66')
   };
  });
  const warm=Buffer.from(fixtures.warm.split(',')[1],'base64');
  const cool=Buffer.from(fixtures.cool.split(',')[1],'base64');
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url===origin+'wallpapers/moonlit-city.webp')return route.fulfill({contentType:'image/png',body:warm});
   if(url===origin+'wallpapers/rainy-neon.webp')return route.fulfill({contentType:'image/png',body:cool});
   if(url===origin+'index.html')return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(assets,'index.html'))});
   if(serve(route))return;
   if(url.includes('api.github.com')||url.includes('api.rss2json.com'))return route.fulfill({json:{items:[],status:'ok'}});
   return route.abort();
  });
  await page.addInitScript(()=>{
   window.AudioDesk={
    setStatusBarTheme(){},
    setSystemWallpaperBundled(){},
    setSystemWallpaperCustom(){},
    requestLauncherApps(){},
    setRefreshEnabled(){},
    requestMediaState(){}
   };
  });
  await page.goto(origin+'index.html');
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage')?.naturalWidth>0);
  await page.evaluate(()=>setLauncherTheme('orbit'));
  await page.waitForFunction(()=>document.body.dataset.launcherTheme==='orbit'&&
    document.querySelector('#orbitDial .orbit-ring'));
  await page.evaluate(()=>openWallpaperPicker());
  // Capture-phase listeners clear any saved color preset, and the decoded
  // gallery image must then replace it with true source-image colors.
  await page.evaluate(()=>document.querySelector('#wallpaperGrid [data-wallpaper="0"]').click());
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage')?.src.includes('moonlit-city.webp')&&
    document.body.dataset.wallpaperPaletteSource==='photo');
  const palette=()=>page.evaluate(()=>{
   const style=getComputedStyle(document.documentElement);
   const ring=document.querySelector('#orbitDial .orbit-ring');
   return {
    accent:style.getPropertyValue('--theme-accent').trim(),
    surface:style.getPropertyValue('--theme-surface').trim(),
    surface2:style.getPropertyValue('--theme-surface2').trim(),
    line:style.getPropertyValue('--theme-line').trim(),
    clockFill:ring?getComputedStyle(ring).fill:null,
    source:document.body.dataset.wallpaperPaletteSource
   };
  });
  const warmPalette=await palette();
  const w=hexRgb(warmPalette.surface);
  assert.ok(w[0]>w[2]+7,
   'Orbit dial must follow warm beige/brown wallpaper, not stale blue-grey: '+JSON.stringify(warmPalette));
  assert.ok(warmPalette.clockFill!=='rgb(32, 38, 34)','real SVG ring must use derived surface');
  assert.notEqual(warmPalette.surface,warmPalette.surface2,'rings have distinct photo-derived shades');
  await page.evaluate(()=>document.querySelector('#wallpaperGrid [data-wallpaper="1"]').click());
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage')?.src.includes('rainy-neon.webp'));
  await page.waitForFunction(()=>{const v=getComputedStyle(document.documentElement).getPropertyValue('--theme-surface');
   if(!v.startsWith('#'))return false;
   const r=parseInt(v.slice(1,3),16),b=parseInt(v.slice(5,7),16);return b>r+8;
  });
  const coolPalette=await palette();
  assert.notEqual(coolPalette.accent,warmPalette.accent,'every wallpaper change must refresh accent');
  const b=hexRgb(coolPalette.surface);
  assert.ok(b[2]>b[0]+8,'blue wallpaper produces blue Orbit dial: '+JSON.stringify(coolPalette));
  // Imported custom photos must use the same update path, not a separate
  // static palette left over from the selected bundled wallpaper.
  await page.locator('#customWallpaperFile').setInputFiles({
   name:'warm-interior.png',mimeType:'image/png',buffer:warm
  });
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage')?.src.startsWith('blob:')&&
   document.body.dataset.wallpaperPaletteSource==='photo');
  await page.waitForFunction(()=>{const v=getComputedStyle(document.documentElement).getPropertyValue('--theme-surface');
   if(!v.startsWith('#'))return false;
   return parseInt(v.slice(1,3),16)>parseInt(v.slice(5,7),16)+7;
  });
  const customPalette=await palette();
  assert.ok(hexRgb(customPalette.surface)[0]>hexRgb(customPalette.surface)[2]+7,
    'imported warm photo drives warm Orbit ring');
  assert.deepEqual(errors,[],'wallpaper and theme loading must have no JS exceptions');
  console.log('PASS: Orbit accent and ring colors update for warm, cool and imported photo wallpapers');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
