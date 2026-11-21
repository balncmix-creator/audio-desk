const assert=require("node:assert/strict");
const path=require("node:path");
const {chromium}=require("playwright");
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.setContent('<!doctype html><html><body data-launcher-theme="orbit" data-home-page="home"></body></html>');
  await page.addStyleTag({path:path.resolve("app/src/main/assets/radial-files.css")});
  await page.evaluate(()=>{
   window.nativeFileCalls=[];
   window.launcherBack=()=>window.nativeFileCalls.push(["launcherBack"]);
   window.AudioDesk={
    radialFilesList(){window.nativeFileCalls.push(["list"])},
    radialFilesPick(){window.nativeFileCalls.push(["pick"])},
    radialFilesUp(){window.nativeFileCalls.push(["up"])},
    radialFilesEnter(id){window.nativeFileCalls.push(["enter",id])},
    radialFilesOpen(id){window.nativeFileCalls.push(["open",id])},
    radialFilesShare(id){window.nativeFileCalls.push(["share",id])},
    radialFilesRename(id,name){window.nativeFileCalls.push(["rename",id,name])},
    radialFilesDelete(id){window.nativeFileCalls.push(["delete",id])},
    radialFilesCreate(name){window.nativeFileCalls.push(["create",name])}
   };
  });
  await page.addScriptTag({path:path.resolve("app/src/main/assets/radial-files.js")});
  assert.equal(await page.locator("#radialFilesPanel").isVisible(),false);
  assert.equal(await page.locator("#orbitFilesTrigger").isVisible(),true);
  await page.locator("#orbitFilesTrigger").click();
  assert.equal(await page.locator("#radialFilesPanel").isVisible(),true);
  assert.deepEqual(await page.evaluate(()=>window.nativeFileCalls[0]),["list"]);
  const fixture=[
   {id:"d1",name:"Session",folder:true,mime:"",size:0,modified:100,writable:true},
   {id:"a1",name:"Foley 01.wav",folder:false,mime:"audio/wav",size:2048,modified:201,writable:true},
   {id:"a2",name:"Ambience.mp3",folder:false,mime:"audio/mpeg",size:8900,modified:202,writable:true},
   {id:"p1",name:'unsafe <img src=x onerror=alert(1)>.png',folder:false,mime:"image/png",size:80,modified:301,writable:true},
   ...Array.from({length:7},(_,i)=>({id:"s"+i,name:"Take "+i+".wav",folder:false,mime:"audio/wav",size:800+i,modified:50+i,writable:true}))
  ];
  await page.evaluate(items=>window.receiveAudioDeskRadialFiles({
   type:"listing",path:["Audio","Project"],entries:items,count:items.length,
   canGoUp:true,writable:true,truncated:false
  }),fixture);
  assert.equal(await page.locator(".rdf-item").count(),11);
  assert.equal(await page.locator('#rdfList img').count(),0,"untrusted filenames escaped");
  assert.equal(await page.locator('#rdfWheel [data-rdf-action^="select:"]').count(),5);
  await page.locator('#rdfWheel [data-rdf-action="filter:audio"]').click();
  assert.equal(await page.locator(".rdf-item").count(),9);
  await page.locator('[data-rdf-action="next"]').last().click();
  assert.match(await page.locator("#rdfPage").innerText(),/2 \/ 2/);
  await page.locator("#rdfSearch").fill("Foley");
  assert.equal(await page.locator(".rdf-item").count(),1,"search filters category");
  await page.locator(".rdf-item").click();
  await page.locator("#rdfWheel [data-rdf-action='open']").click();
  await page.locator("#rdfWheel [data-rdf-action='share']").click();
  assert.deepEqual(await page.evaluate(()=>window.nativeFileCalls.slice(-2)),[["open","a1"],["share","a1"]]);
  await page.locator("#rdfSearch").fill("");
  await page.locator('#rdfWheel [data-rdf-action="filter:all"]').click();
  await page.locator('.rdf-item[data-rdf-action="select:d1"]').click();
  await page.locator("#rdfWheel [data-rdf-action='open']").click();
  assert.deepEqual(await page.evaluate(()=>window.nativeFileCalls.at(-1)),["enter","d1"]);
  await page.evaluate(()=>window.launcherBack());
  assert.deepEqual(await page.evaluate(()=>window.nativeFileCalls.at(-1)),["up"]);
  await page.locator('[data-rdf-action="close"]').click();
  assert.equal(await page.locator("#radialFilesPanel").isVisible(),false);
  await page.evaluate(()=>{document.body.dataset.launcherTheme="pixel";window.dispatchEvent(new Event("audio-desk-theme-changed"))});
  assert.equal(await page.locator("#orbitFilesTrigger").isVisible(),false,"feature is Orbit-specific");
  await page.evaluate(()=>window.audioDeskOpenRadialFiles());
  assert.equal(await page.locator("#radialFilesPanel").isVisible(),false);
  assert.deepEqual(errors,[],"no script errors");
  console.log("PASS: Orbit Files radial browsing, category/search, actions, navigation, filename safety, theme isolation");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
