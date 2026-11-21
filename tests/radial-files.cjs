const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body data-launcher-theme="orbit" data-home-page="home"></body></html>');
  await page.addStyleTag({path:path.resolve('app/src/main/assets/radial-files.css')});
  await page.evaluate(()=>{
   window.nativeFileCalls=[];
   window.launcherBack=()=>window.nativeFileCalls.push(['launcherBack']);
   window.confirm=()=>{throw Error('Rectangular confirm dialog forbidden')};
   window.prompt=()=>{throw Error('Rectangular input prompt forbidden')};
   window.AudioDesk={
    radialFilesList(){window.nativeFileCalls.push(['list'])},
    radialFilesPick(){window.nativeFileCalls.push(['pick'])},
    radialFilesRequestFullAccess(location){window.nativeFileCalls.push(['all-files',location])},
    radialFilesUp(){window.nativeFileCalls.push(['up'])},
    radialFilesEnter(id){window.nativeFileCalls.push(['enter',id])},
    radialFilesOpen(id){window.nativeFileCalls.push(['open',id])},
    radialFilesShare(id){window.nativeFileCalls.push(['share',id])},
    radialFilesRename(id,name){window.nativeFileCalls.push(['rename',id,name])},
    radialFilesDelete(id){window.nativeFileCalls.push(['delete',id])},
    radialFilesCreate(name){window.nativeFileCalls.push(['create',name])},
    setStatusBarTheme(theme,light){window.nativeFileCalls.push(['statusTheme',theme,light])}
   };
   // Simulate Android's @JavascriptInterface receiver requirement.
   // This catches the real-device failure: detached bridge methods throw.
   const bridge=window.AudioDesk;
   for(const [name,original] of Object.entries(bridge)){
    bridge[name]=function(...args){
     if(this!==bridge)throw new Error('Detached Android bridge: '+name);
     return original.apply(this,args);
    };
   }
   window.audioDeskSyncWallpaperStatus=()=>window.nativeFileCalls.push(['restoreStatus']);
  });
  await page.addScriptTag({path:path.resolve('app/src/main/assets/radial-files.js')});
  assert.equal(await page.locator('#radialFilesPanel').isVisible(),false);
  assert.equal(await page.locator('#orbitFilesTrigger').count(),0,'no floating rectangular Files shortcut');
  await page.evaluate(()=>window.audioDeskOpenRadialFiles());
  assert.equal(await page.locator('#radialFilesPanel').isVisible(),true);
  assert.deepEqual(await page.evaluate(()=>window.nativeFileCalls.at(-1)),['list']);
  assert.ok(await page.evaluate(()=>window.nativeFileCalls.some(x=>x[0]==='statusTheme'&&x[1]==='orbit'&&x[2]===false)),
   'dark file manager must use light Android status glyphs');
  assert.equal(await page.locator('#rdfWheel #rdfFileRing').count(),1);
  assert.equal(await page.locator('#rdfFileRing .rdf-start').count(),6,
   'six actionable file categories, not an empty blank ring on first launch');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('radialFilesPanel')).backgroundColor),
   'rgb(8, 19, 14)','panel must be opaque enough to hide launcher beneath');
  await page.locator('#rdfFileRing [data-rdf-action="start:music"]').click();
  assert.deepEqual(await page.evaluate(()=>window.nativeFileCalls.at(-1)),['all-files','music'],
   'Music sector must request direct shared-storage access, not Android folder picker');
  await page.locator('#rdfFileRing [data-rdf-action="start:folder"]').click();
  assert.deepEqual(await page.evaluate(()=>window.nativeFileCalls.at(-1)),['pick'],
   'Folder sector must keep the scoped Android folder picker as fallback');
  assert.equal(await page.locator('#rdfList,.rdf-list,.rdf-actions,.rdf-top-actions').count(),0,
    'file list and menu must live only inside radial sectors');
  await page.locator('#rdfWheel [data-rdf-action="device"]').click();
  assert.deepEqual(await page.evaluate(()=>window.nativeFileCalls.at(-1)),['all-files','root'],
   'Main radial menu offers device-wide shared storage access');
  const fixture=[
   {id:'d1',name:'Session',folder:true,mime:'',size:0,modified:100,writable:true},
   {id:'a1',name:'Foley 01.wav',folder:false,mime:'audio/wav',size:2048,modified:201,writable:true},
   {id:'a2',name:'Ambience.mp3',folder:false,mime:'audio/mpeg',size:8900,modified:202,writable:true},
   {id:'p1',name:'unsafe <img src=x onerror=alert(1)>.png',folder:false,mime:'image/png',size:80,modified:301,writable:true},
   ...Array.from({length:9},(_,i)=>({id:'s'+i,name:'Take '+i+'.wav',folder:false,mime:'audio/wav',size:800+i,modified:50+i,writable:true}))
  ];
  await page.evaluate(items=>window.receiveAudioDeskRadialFiles({
   type:'listing',mode:'device',path:['Internal storage','Music'],entries:items,count:items.length,
   canGoUp:true,writable:true,truncated:false
  }),fixture);
  assert.match(await page.locator('#rdfHint').innerText(),/BROWSE/,
   'direct device folder browsing should start with all file types available');
  assert.equal(await page.locator('#rdfWheel #rdfFileRing .rdf-file').count(),6,
    'six actual file/folder wedges, not a text list');
  assert.equal(await page.locator('#rdfWheel #rdfCommandRing .rdf-command').count(),6,
    'all navigation buttons are radial sectors');
  assert.equal(await page.locator('img[onerror],svg img').count(),0,'file names are escaped');
  assert.equal(await page.locator('#rdfPath').innerText(),'Internal storage / Music');
  await page.locator('#rdfWheel [data-rdf-action="next"]').click();
  assert.match(await page.locator('#rdfHint').innerText(),/2\/3/);
  await page.locator('#rdfWheel [data-rdf-action="prev"]').click();
  assert.match(await page.locator('#rdfHint').innerText(),/1\/3/);
  await page.locator('#rdfWheel [data-rdf-action="filter"]').click();
  assert.equal(await page.locator('#rdfWheel [data-rdf-action^="filter:"]').count(),6);
  await page.locator('#rdfWheel [data-rdf-action="filter:audio"]').click();
  assert.equal(await page.locator('#rdfWheel .rdf-file').count(),6);
  assert.match(await page.locator('#rdfHint').innerText(),/Audio/i);
  await page.locator('#rdfWheel [data-rdf-action="select:a1"]').click();
  assert.equal(await page.locator('#rdfWheel [data-rdf-action="open"]').count(),1);
  assert.equal(await page.locator('#rdfWheel [data-rdf-action="share"]').count(),1);
  await page.locator('#rdfWheel [data-rdf-action="open"]').click();
  assert.deepEqual(await page.evaluate(()=>window.nativeFileCalls.at(-1)),['open','a1']);
  await page.locator('#rdfWheel [data-rdf-action="share"]').click();
  assert.deepEqual(await page.evaluate(()=>window.nativeFileCalls.at(-1)),['share','a1']);
  await page.locator('#rdfWheel [data-rdf-action="rename"]').click();
  assert.equal(await page.locator('#rdfEditor').isVisible(),true);
  await page.locator('#rdfEditorInput').fill('Foley final.wav');
  await page.locator('#rdfWheel [data-rdf-action="save"]').click();
  assert.deepEqual(await page.evaluate(()=>window.nativeFileCalls.at(-1)),['rename','a1','Foley final.wav']);
  await page.locator('#rdfWheel [data-rdf-action="delete"]').click();
  assert.equal(await page.locator('#rdfWheel [data-rdf-action="confirm-delete"]').count(),1);
  await page.locator('#rdfWheel [data-rdf-action="cancel"]').click();
  assert.notDeepEqual(await page.evaluate(()=>window.nativeFileCalls.at(-1)),['delete','a1']);
  await page.locator('#rdfWheel [data-rdf-action="delete"]').click();
  await page.locator('#rdfWheel [data-rdf-action="confirm-delete"]').click();
  assert.deepEqual(await page.evaluate(()=>window.nativeFileCalls.at(-1)),['delete','a1'],
   'deletion requires a dedicated radial confirmation');
  await page.locator('#rdfWheel [data-rdf-action="more"]').click();
  await page.locator('#rdfWheel [data-rdf-action="device"]').click();
  assert.deepEqual(await page.evaluate(()=>window.nativeFileCalls.at(-1)),['all-files','root'],
    'context radial menu can return to full internal shared storage');
  await page.locator('#rdfWheel [data-rdf-action="new"]').click();
  await page.locator('#rdfEditorInput').fill('New sound folder');
  await page.locator('#rdfWheel [data-rdf-action="save"]').click();
  assert.deepEqual(await page.evaluate(()=>window.nativeFileCalls.at(-1)),['create','New sound folder']);
  await page.locator('#rdfWheel [data-rdf-action="more"]').click();
  await page.locator('#rdfWheel [data-rdf-action="search"]').click();
  assert.equal(await page.locator('#rdfEditor').isVisible(),true,'search editor sits in circular hub');
  await page.locator('#rdfEditorInput').fill('Foley');
  assert.equal(await page.locator('#rdfWheel #rdfFileRing .rdf-file').count(),1,
    'search filters radial file sectors, not a separate list');
  await page.locator('#rdfWheel [data-rdf-action="done"]').click();
  await page.locator('#rdfWheel [data-rdf-action="more"]').click();
  await page.locator('#rdfWheel [data-rdf-action="sort"]').click();
  await page.locator('#rdfWheel [data-rdf-action="sort:date"]').click();
  await page.evaluate(()=>window.launcherBack());
  assert.deepEqual(await page.evaluate(()=>window.nativeFileCalls.at(-1)),['up']);
  await page.locator('#rdfWheel [data-rdf-action="close"]').click();
  assert.equal(await page.locator('#radialFilesPanel').isVisible(),false);
  assert.deepEqual(await page.evaluate(()=>window.nativeFileCalls.at(-1)),['restoreStatus'],
   'restore wallpaper-based Android status icon contrast after leaving file manager');
  const bounds=await page.evaluate(()=>{
   const b=document.querySelector('#rdfWheel').getBoundingClientRect();
   return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:innerWidth,height:innerHeight}
  });
  assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.right<=bounds.width&&bounds.bottom<=bounds.height,
   'full dial fits phone screen');
  await page.evaluate(()=>{document.body.dataset.launcherTheme='pixel';window.dispatchEvent(new Event('audio-desk-theme-changed'));window.audioDeskOpenRadialFiles()});
  assert.equal(await page.locator('#radialFilesPanel').isVisible(),false,'only Orbit theme may open Files');
  assert.deepEqual(errors,[],'no JS errors');
  console.log('PASS: Fully radial file sectors, menu rings, filters, search, editing, confirmation, pagination and theme isolation');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
