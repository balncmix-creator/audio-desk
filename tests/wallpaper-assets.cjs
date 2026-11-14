const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const catalog=Array.from(vm.runInNewContext(fs.readFileSync(path.join(assets,'wallpapers/catalog.js'),'utf8')+';WALLPAPERS'));
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
(async()=>{
 assert.equal(catalog.length,10);
 const missing=catalog.flatMap(w=>[w.src,w.thumb]).filter(p=>!fs.existsSync(path.join(assets,p)));
 assert.deepEqual(missing,[],'Original wallpaper files are unavailable. Import approved original portraits; do not upscale the v2.4 sprite.');
 const provenance=JSON.parse(fs.readFileSync(path.join(assets,'wallpapers/provenance.json')));
 assert.equal(provenance.length,10);
 assert.equal(new Set(provenance.map(p=>p.sourceSha256)).size,10,'ten different originals');
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 try{
  const page=await browser.newPage();let total=0;
  for(const wallpaper of catalog){
   const record=provenance.find(p=>p.id===wallpaper.id);assert.ok(record);
   const generated=record.origin==='generated-replacement';
   const minimum=generated?[1024,1536]:[1080,1920];
   assert.ok(record.sourceWidth>=minimum[0]&&record.sourceHeight>=minimum[1]&&record.sourceWidth<record.sourceHeight);
   if(generated){
    assert.equal(record.encoding,'lossless','generated originals must preserve every pixel');
    assert.equal(record.psnr,99);
    assert.deepEqual([record.width,record.height],[record.sourceWidth,record.sourceHeight],'complete native generated resolution is preserved');
   }
   assert.ok(record.psnr>=38,'preserve high-quality original pixels');
   const raw=fs.readFileSync(path.join(assets,wallpaper.src));total+=raw.length;
   assert.equal(raw.subarray(0,4).toString(),'RIFF');assert.equal(raw.subarray(8,12).toString(),'WEBP');
   assert.equal(sha(raw),record.sha256);assert.ok(raw.length<=2500000);
   const dimensions=await page.evaluate(async data=>{
    const img=new Image();img.src='data:image/webp;base64,'+data;await img.decode();return [img.naturalWidth,img.naturalHeight];
   },raw.toString('base64'));
   assert.deepEqual(dimensions,[record.width,record.height]);
   assert.ok(dimensions[0]>=minimum[0]&&dimensions[1]>=minimum[1]&&dimensions[0]<dimensions[1]);
   assert.ok(dimensions[0]<=record.sourceWidth&&dimensions[1]<=record.sourceHeight,'no upscaling');
   const thumb=fs.readFileSync(path.join(assets,wallpaper.thumb));
   assert.equal(sha(thumb),record.thumbnailSha256);assert.ok(thumb.length<75000);
   const thumbSize=await page.evaluate(async data=>{const image=new Image();image.src='data:image/webp;base64,'+data;await image.decode();return [image.naturalWidth,image.naturalHeight]},thumb.toString('base64'));
   assert.deepEqual(thumbSize,[180,400]);
  }
  assert.ok(total<=16000000,'compressed pack stays within low-end storage budget');
  const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
  assert.doesNotMatch(html,/WALLPAPER_SPRITE|background-size:500%|data:image\/webp;base64/);
  console.log('PASS: 10 high-resolution original WebP portraits, provenance, decode, fidelity and size budgets; separate thumbnails');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
