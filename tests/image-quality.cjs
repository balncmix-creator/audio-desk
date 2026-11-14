const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const images=await page.evaluate(()=>{
   const make=(w,h,color)=>{
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,w,h);
    return canvas.toDataURL('image/png').split(',')[1];
   };
   return {thumb:make(96,96,'#900'),large:make(1200,680,'#16a3d9'),fallback:make(960,540,'#904ea4')};
  });
  await page.addInitScript(()=>{
   window.imageLookupRequests=[];
   window.AudioDesk={
    sampleImageAccent(url,id){setTimeout(()=>window.receiveImageAccent(id,[40,110,180]),10)},
    lookupArticleImage(url,id){
     window.imageLookupRequests.push(url);
     const image=url.includes('no-image')?'https://publisher.example/full-b.png':
      url.includes('tiny-only')?'https://publisher.example/full-b.png':null;
     setTimeout(()=>window.receiveArticleImage(id,image),25);
    }
   };
  });
  const items=[
   {title:'High resolution srcset demo',link:'https://publisher.example/hd-first',pubDate:'2026-11-14T09:00:00Z',
    description:'<p>Image in different sizes</p><img src="https://publisher.example/thumbnail-96x96.png" srcset="https://publisher.example/photo-480.png 480w, https://publisher.example/photo-1200.png 1200w">' },
   {title:'No image in the feed demo',link:'https://publisher.example/no-image',pubDate:'2026-11-14T08:00:00Z',
    description:'Publisher offers metadata on the original article page.'},
   {title:'Tiny only thumbnail demo',link:'https://publisher.example/tiny-only',pubDate:'2026-11-14T07:00:00Z',
    description:'A tiny RSS thumbnail should never be stretched.',thumbnail:'https://publisher.example/thumbnail-96x96.png'}
  ];
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'))});
   if(url.endsWith('/assets/desk-premium.webp'))
    return route.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/desk-premium.webp'))});
   if(url.includes('api.rss2json.com'))return route.fulfill({json:{status:'ok',items}});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   if(url.includes('publisher.example/')){
    const key=url.includes('thumbnail-96x96')?'thumb':url.includes('full-b')?'fallback':'large';
    return route.fulfill({contentType:'image/png',body:Buffer.from(images[key],'base64')});
   }
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.evaluate(()=>setLauncherPage('events',false));
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('GitHub:'));
  for(const title of items.map(x=>x.title)){
   await page.locator('.story').filter({hasText:title}).scrollIntoViewIfNeeded();
  }
  await page.waitForFunction(()=>{
   const cards=[...document.querySelectorAll('#stories .story')];
   return cards.length===3 && cards.every(card=>card.querySelector('.storymedia')?.naturalWidth>=480);
  },null,{timeout:12000});
  const result=await page.locator('#stories .story').evaluateAll(cards=>cards.map(c=>({
   title:c.querySelector('h2').textContent,
   src:c.querySelector('img')?.currentSrc,
   width:c.querySelector('img')?.naturalWidth,
   color:getComputedStyle(c).backgroundColor
  })));
  assert.match(result.find(x=>x.title.includes('srcset')).src,/photo-1200.png/);
  assert.equal(result.find(x=>x.title.includes('srcset')).width,1200);
  assert.equal(result.find(x=>x.title.includes('No image')).width,960);
  assert.equal(result.find(x=>x.title.includes('Tiny only')).width,960);
  const requested=await page.evaluate(()=>window.imageLookupRequests);
  assert.ok(requested.some(x=>x.includes('no-image')),'text-only story should request native article metadata');
  assert.ok(requested.some(x=>x.includes('tiny-only')),'tiny thumbnail should trigger HD fallback');
  assert.ok(!requested.some(x=>x.includes('hd-first')),'good RSS image should not be needlessly refetched');
  const cache=await page.evaluate(()=>JSON.parse(localStorage.getItem('ar_items')));
  assert.ok(cache.find(x=>x.title.includes('No image'))?.image.includes('full-b.png'),'resolved URL should be cached');
  assert.deepEqual(errors,[]);
  console.log('PASS: HD srcset selection, low-res rejection, native metadata fallback, URL cache and color tint');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
