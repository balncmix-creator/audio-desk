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
  await page.addInitScript(()=>{window.AudioDesk={requestLauncherApps(){window.receiveLauncherApps?.([],[],true)},setRefreshEnabled(){},setStatusBarTheme(){},setWallpaperTone(){},isDefaultLauncher(){return true}}});
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
  await dialog.getByLabel("Search apps, cached news and workspace").fill("Atmos");
  assert.match(await dialog.textContent(),/Film mix/);
  await page.evaluate(()=>window.launcherBack());
  assert.equal(await dialog.isVisible(),false);
  await page.reload();await dialog.waitFor({state:"attached"});
  await page.evaluate(()=>setLauncherPage("events",false));
  await page.getByRole("button",{name:"WORKSPACE ↗",exact:true}).click();
  assert.match(await dialog.textContent(),/Film mix/);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
