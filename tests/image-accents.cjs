const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:393,height:852}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const fixtures=await page.evaluate(()=>{
   const data={};
   for(const [name,color] of Object.entries({blue:'#235fd2',amber:'#e69628',mono:'#888'})){
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
    const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,64,64);
    data[name]=canvas.toDataURL('image/png').split(',')[1];
   }
   return data;
  });
  await page.addInitScript(()=>{
   window.accentRequests=[];
   window.AudioDesk={sampleImageAccent(url,id){
    window.accentRequests.push({url,id});
    const rgb=url.includes('blue')?[35,95,210]:url.includes('amber')?[230,150,40]:null;
    setTimeout(()=>window.receiveImageAccent(id,rgb),30);
   }};
  });
  const articles=[['plain','No image',null],['blue','Blue image','blue'],['amber','Amber image','amber'],['mono','Monochrome image','mono'],['broken','Broken image','broken']];
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='https://appassets.androidplatform.net/assets/index.html')return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8')});
   if(url.includes('api.rss2json.com'))return route.fulfill({json:{status:'ok',items:articles.map(([key,title,img],i)=>({title,link:'https://example.com/'+key,pubDate:new Date(Date.now()-i*1000).toISOString(),description:'Test article',thumbnail:img?'https://publisher.example/'+img+'.png':''}))}});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   if(url.startsWith('https://publisher.example/')){
    const key=url.split('/').pop().split('.')[0];
    if(key==='broken')return route.abort();
    // No CORS headers: the real native fallback must be called rather than
    // making the visible image depend on an anonymous CORS load.
    return route.fulfill({contentType:'image/png',body:Buffer.from(fixtures[key],'base64')});
   }
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  for(let i=0;i<articles.length;i++)await page.locator('.story').nth(i).scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('.story')].find(x=>x.textContent.includes('Blue image'))?.style.getPropertyValue('--story-surface'));
  await page.waitForTimeout(350);
  const results=await page.locator('.story').evaluateAll(cards=>cards.map(c=>({title:c.querySelector('h2').textContent,bg:getComputedStyle(c).backgroundColor,images:c.querySelectorAll('img').length})));
  assert.equal(results[0].bg,'rgb(23, 23, 23)');
  assert.equal(results[1].bg,'rgb(24, 32, 45)');
  assert.equal(results[2].bg,'rgb(48, 38, 25)');
  assert.equal(results[3].bg,'rgb(23, 23, 23)');
  assert.equal(results[4].bg,'rgb(23, 23, 23)');
  assert.equal(results[4].images,0);
  assert.equal(results[1].images,1,'sampling must not hide cross-origin publisher images');
  assert.ok((await page.evaluate(()=>window.accentRequests)).some(r=>r.url.includes('blue')));
  // A response from an earlier render cannot recolour a replacement article.
  await page.evaluate(()=>{
   window.oldAccent=window.accentRequests.find(r=>r.url.includes('blue'));
   document.querySelector('[data-filter="Hardware"]').click();
   window.receiveImageAccent(window.oldAccent.id,[255,0,0]);
  });
  assert.equal(await page.locator('.story').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: grey default, blue/amber accents, monochrome/broken fallbacks, native CORS fallback and stale responses');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
