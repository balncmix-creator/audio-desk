// Real Chromium screenshots of the Audio Desk UI with explicitly illustrative demo stories.
// Run from repository root after npm ci / npx playwright install chromium.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const output=path.join(__dirname,'../docs/screenshots');
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:420,height:900},deviceScaleFactor:2,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  const appUrl='https://appassets.androidplatform.net/assets/index.html';
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url===appUrl)return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'))});
   if(url==='https://appassets.androidplatform.net/assets/desk-premium.webp')
    return route.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/desk-premium.webp'))});
   if(url.includes('api.rss2json.com'))return route.fulfill({json:{status:'ok',items:[]}});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.goto(appUrl);
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('GitHub:'));
  await page.evaluate(()=>{
   // Illustrative demo content; not real publisher headlines or current RSS results.
   function art(a,b){
    const c=document.createElement('canvas');c.width=560;c.height=290;const ctx=c.getContext('2d');
    const gradient=ctx.createLinearGradient(0,0,560,290);gradient.addColorStop(0,a);gradient.addColorStop(1,b);
    ctx.fillStyle=gradient;ctx.fillRect(0,0,560,290);
    ctx.fillStyle='rgba(255,255,255,.08)';
    for(let i=0;i<7;i++)ctx.fillRect(32+i*78,40+(i%3)*12,18,190);
    ctx.beginPath();ctx.lineWidth=8;ctx.strokeStyle='rgba(255,255,255,.75)';
    for(let x=42;x<=520;x+=5){
     const y=148+Math.sin(x*.055)*38+Math.sin(x*.018)*19;
     if(x===42)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }ctx.stroke();
    return c.toDataURL('image/png');
   }
   const p1=art('#1c396b','#4a1d4f'),p2=art('#704320','#322c58'),p3=art('#235a50','#172e49');
   const records=[
    ['Audio post workflow: immersive film mixing','Post Production','Audio Post Demo',p1],
    ['Dialogue restoration and Foley editing tools','Post Production','Sound Editorial Demo',p2],
    ['REAPER editing scripts for sound designers','REAPER','REAPER Demo',p3],
    ['New DAW plug-in instruments and updates','DAWs & plugins','Plugin Demo',p1],
    ['Cinematic sample library and field recordings','Sample packs','Library Demo',p2],
    ['Portable production recorder technology','Hardware','Hardware Demo',p3]
   ];
   items=records.map((r,i)=>({
    title:r[0],cat:r[1],source:r[2],image:r[3],
    desc:'Explore audio production news, tools and techniques in this illustrative preview of the Audio Desk interface.',
    date:new Date(Date.UTC(2026,10,14,10,0)-i*3600000).toISOString(),
    link:'https://example.com/audio-desk-demo-'+i,key:'screenshot-demo-'+i
   }));
   active='All';render();
   document.getElementById('status').textContent='DEMONSTRATION HEADLINES · NOT LIVE NEWS';
   document.getElementById('updated').textContent='UI Preview';
  });
  await page.evaluate(()=>setLauncherPage('events',false));
  await page.waitForFunction(()=>[...document.querySelectorAll('.storymedia')].every(img=>img.complete&&img.naturalWidth>0));
  await page.waitForFunction(()=>!!document.querySelector('.story[style*="--story-surface"]'));
  await page.screenshot({path:path.join(output,'news-feed.png')});
  assert.equal(await page.locator('[data-filter="Post Production"]').count(),1);
  await page.locator('[data-filter="Post Production"]').click();
  assert.equal(await page.locator('.story').count(),2);
  await page.screenshot({path:path.join(output,'post-production.png')});
  await page.evaluate(()=>{
   setOfflineNotice(true);
   document.getElementById('status').textContent='OFFLINE DEMONSTRATION · CACHED STORIES AVAILABLE';
  });
  assert.equal(await page.locator('#offlineNotice').isVisible(),true);
  await page.screenshot({path:path.join(output,'offline.png')});
  await page.locator('[data-filter="All"]').click();
  await page.locator('[data-card-density="3"]').click();
  await page.screenshot({path:path.join(output,'grid-three.png')});
  await page.locator('[data-card-density="5"]').click();
  await page.screenshot({path:path.join(output,'grid-five.png')});
  await page.locator('[data-card-density="1"]').click();
  await page.locator('[data-view="samples"]').click();
  assert.equal(await page.locator('#sampleReleases .sample-demo-button').count(),1);
  await page.screenshot({path:path.join(output,'sample-packs.png')});
  // Launcher screenshots: actual HTML/CSS, demonstration apps supplied by the
  // screenshot harness because the CI browser has no Android PackageManager.
  await page.evaluate(()=>{
   function icon(letter,a,b){
    const canvas=document.createElement('canvas');canvas.width=76;canvas.height=76;
    const ctx=canvas.getContext('2d');
    const gradient=ctx.createLinearGradient(0,0,76,76);
    gradient.addColorStop(0,a);gradient.addColorStop(1,b);
    ctx.fillStyle=gradient;ctx.fillRect(0,0,76,76);
    ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=2;ctx.strokeRect(4,4,68,68);
    ctx.fillStyle='#fff';ctx.font='bold 34px monospace';ctx.textAlign='center';
    ctx.fillText(letter,38,51);
    return canvas.toDataURL('image/png');
   }
   const records=[
    ['Audio Desk','A','#3b3b3b','#111'],['REAPER Remote','R','#365f48','#121e18'],
    ['Files','F','#5c472b','#1d1611'],['Browser','B','#254d6e','#0d1826'],
    ['Recorder','●','#6c343b','#251416'],['Music','♫','#5b355f','#1b1221'],
    ['Sample Libraries','S','#4c435f','#171321'],['Plugins','P','#48555c','#101d22'],
    ['Settings','⚙','#444b55','#191b22'],['Camera','C','#4b4942','#191813'],
    ['Messages','M','#2c5a50','#152b26'],['Clock','T','#555','#1a1a1a']
   ];
   const examples=records.map((r,i)=>({
    label:r[0],pkg:'example.preview.app'+i,activity:'example.preview.Launcher',
    icon:icon(r[1],r[2],r[3]),
    uses:Math.max(0,16-i*2)
   }));
   window.receiveLauncherApps(examples,examples.slice(1,5).map((a,i)=>({
    ...a,opened:Date.now()-i*120000
   })),false);
   document.getElementById('launcherClock').textContent='11:20';
   document.getElementById('launcherDate').textContent='SAT, 14 NOV';
  });
  await page.locator('[data-home-nav="home"]').click();
  assert.equal(await page.locator('#launcherFavorites .launcher-app').count(),8);
  await page.screenshot({path:path.join(output,'launcher-home.png')});
  await page.locator('[data-home-nav="apps"]').click();
  assert.equal(await page.locator('#launcherAppsGrid .launcher-app').count(),12);
  await page.screenshot({path:path.join(output,'launcher-applications.png')});
  await page.locator('[data-home-nav="home"]').click();
  await page.locator('#launcherShowRecents').click();
  await page.screenshot({path:path.join(output,'launcher-open-apps.png')});
  assert.deepEqual(errors,[],'the screenshot version of the app must render without script errors');
  console.log('Captured Audio Desk news and launcher UI screenshots with explicitly labeled demo content');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
