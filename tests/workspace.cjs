const assert=require("node:assert/strict");
const fs=require("node:fs");
const {chromium}=require("playwright");
const serve=require("./serve-assets.cjs");
const origin="https://appassets.androidplatform.net/assets/";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.addInitScript(()=>{window.nativeLayoutRequests=[];window.refreshRequests=[];window.AudioDesk={layoutNativeWidgets(payload){nativeLayoutRequests.push(JSON.parse(payload))},requestNativeWidgets(){},setSpectrumActive(){},requestLauncherApps(){window.receiveLauncherApps?.([],[],true)},setRefreshEnabled(value){refreshRequests.push(value)},setStatusBarTheme(){},setWallpaperTone(){},isDefaultLauncher(){return true}}});
  await page.route("**/*",route=>{
   if(route.request().url()===origin+"index.html")return route.fulfill({contentType:"text/html",body:fs.readFileSync("app/src/main/assets/index.html")});
   const local=serve(route);if(local)return local;return route.fulfill({json:{status:"ok",items:[]}});
  });
  await page.goto(origin+"index.html");
  const dialog=page.locator("#deskWorkspace");await dialog.waitFor({state:"attached"});
  await page.evaluate(()=>setLauncherPage("events",false));
  await page.getByRole("button",{name:"WORKSPACE ↗",exact:true}).click();
  await dialog.getByLabel("Project name").fill("Film mix");
  await dialog.getByLabel("Details").fill("Atmos delivery");
  await dialog.getByRole("button",{name:"Add entry",exact:true}).click();
  assert.match(await dialog.textContent(),/Film mix/);
  await dialog.getByRole("button",{name:"Tools",exact:true}).click();
  assert.match(await dialog.textContent(),/480 samples/);
  await dialog.getByRole("button",{name:"Search",exact:true}).click();
  await dialog.getByLabel("Search apps, cached news and workspace").fill("Film Atmos");
  assert.match(await dialog.textContent(),/Film mix/);
  await dialog.getByLabel("Search apps, cached news and workspace").fill("Film   Atmos");
  assert.match(await dialog.textContent(),/Film mix/);
  assert.equal(await page.evaluate(()=>hasLauncherOverlay()),true);
  assert.equal(await page.evaluate(()=>refreshRequests.at(-1)),false);
  await page.evaluate(()=>window.launcherBack());
  assert.equal(await dialog.isVisible(),false);
  assert.equal(await page.evaluate(()=>hasLauncherOverlay()),false);
  assert.equal(await page.evaluate(()=>refreshRequests.at(-1)),true);
  await page.reload();await dialog.waitFor({state:"attached"});
  await page.evaluate(()=>setLauncherPage("events",false));
  await page.getByRole("button",{name:"WORKSPACE ↗",exact:true}).click();
  assert.match(await dialog.textContent(),/Film mix/);
  // Corrupt records should not crash the workspace or wipe valid entries.
  await page.evaluate(()=>{const d=JSON.parse(deskStorage.getItem("ad_workspace_v1"));d.projects.push(null,5,{id:"broken"});d.topics.push(null,7);d.running={start:Date.now(),rate:-1};d.mode="constructor";deskStorage.setItem("ad_workspace_v1",JSON.stringify(d))});
  await page.reload();await dialog.waitFor({state:"attached"});
  await page.evaluate(()=>{setLauncherTheme("warm");setLauncherPage("home",false);window.receiveAudioDeskNativeWidgets([{id:42,label:"Test widget",pkg:"test.widget",width:220,height:130}]);});
  await page.waitForFunction(()=>window.nativeLayoutRequests.some(x=>x.home));
  await page.getByText("▤ AUDIO WORKSPACE",{exact:true}).evaluate(el=>el.click());
  await dialog.waitFor({state:"visible"});
  assert.match(await dialog.textContent(),/Film mix/);
  await page.waitForFunction(()=>nativeLayoutRequests.at(-1)?.home===false);
  await dialog.getByRole("button",{name:"Sessions",exact:true}).click();
  assert.equal(await dialog.getByRole("button",{name:"Start session",exact:true}).count(),1);
  await dialog.getByRole("button",{name:"Close",exact:true}).click();
  await page.waitForFunction(()=>nativeLayoutRequests.at(-1)?.home===true);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
