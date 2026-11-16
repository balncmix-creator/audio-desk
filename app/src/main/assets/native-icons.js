/* Audio Desk Icon Studio — private, native-based, theme-specific app icons.
   The native service lazily loads only visible installed launchable app icons.
   It never queries a server or sends installed-app names outside the device.
   SVG silhouettes remain as reliable fallbacks on browser/unsupported devices. */
(()=>{
 "use strict";
 const nativeReady=(()=>{
  try{return window.AudioDesk?.supportsAdaptiveAppIcons?.()===true}catch{return false}
 })();
 const originalIcon=launcherIcon;
 const key=()=>"ad_icon_studio_mode_v1_"+launcherTheme;
 function selected(){
  const saved=deskStorage.getItem(key())||"themed";
  return ["themed","original","outline"].includes(saved)?saved:"themed";
 }
 function effectiveTheme(){
  const mode=selected();
  return mode==="original"?"original":launcherTheme;
 }
 function validPackage(pkg){
  return typeof pkg==="string"&&/^[A-Za-z0-9_.]{4,180}$/.test(pkg);
 }
 function nativeIcon(app){
  const fallback=originalIcon(app);
  if(!nativeReady||selected()==="outline"||!validPackage(app.pkg))return fallback;
  const src="/app-icons/"+effectiveTheme()+"/"+encodeURIComponent(app.pkg)+".png";
  return '<span class="ad-icon-shell ad-icon-'+launcherTheme+'" aria-hidden="true">'+
   '<span class="ad-icon-fallback">'+fallback+'</span>'+
   '<img class="ad-icon-image" src="'+src+'" alt="" decoding="async" loading="lazy"></span>';
 }
 launcherIcon=nativeIcon;
 document.addEventListener("load",e=>{
  const img=e.target;
  if(!(img instanceof HTMLImageElement)||!img.classList.contains("ad-icon-image"))return;
  if(img.naturalWidth>0)img.closest(".ad-icon-shell")?.classList.add("icon-loaded");
 },true);
 document.addEventListener("error",e=>{
  const img=e.target;
  if(img instanceof HTMLImageElement&&img.classList.contains("ad-icon-image"))
   img.closest(".ad-icon-shell")?.classList.remove("icon-loaded");
 },true);
 function rerender(){
  // Recents normally skip identical app lists; icons change even when apps do not.
  delete document.getElementById("launcherRecentQuick").dataset.fingerprint;
  renderLauncherHome();
  if(launcherPage==="apps")renderLauncherApps();
  if(!document.getElementById("launcherRecentDrawer").hidden)renderLauncherRecents();
 }
 const launchTheme=setLauncherTheme;
 setLauncherTheme=function(theme){
  launchTheme(theme);
  rerender();
  updateStudio();
 };
 const menuButton=document.createElement("button");
 menuButton.id="launcherIconStudio";
 menuButton.type="button";
 menuButton.className="launcher-options-action";
 menuButton.textContent="App Icon Studio";
 const anchor=document.getElementById("launcherFolderCreate")||
  document.getElementById("launcherThemeChoose");
 anchor.after(menuButton);
 const dialog=document.createElement("div");
 dialog.id="launcherIconStudioDialog";
 dialog.hidden=true;
 dialog.setAttribute("role","dialog");
 dialog.setAttribute("aria-modal","true");
 dialog.setAttribute("aria-label","App Icon Studio");
 dialog.innerHTML='<section class="icon-studio-panel">'+
  '<div class="icon-studio-heading"><div><strong>App Icon Studio</strong>'+
  '<p>Icons follow the selected launcher theme.</p></div>'+
  '<button type="button" id="iconStudioClose" aria-label="Close Icon Studio">×</button></div>'+
  '<div class="icon-studio-options" role="group" aria-label="Icon rendering preference">'+
  '<button type="button" data-icon-mode="themed">Theme-matched<small>Generate a matching style from each installed app icon</small></button>'+
  '<button type="button" data-icon-mode="original">Original<small>Show the installed app’s full-colour icon</small></button>'+
  '<button type="button" data-icon-mode="outline">Simple outline<small>Use lightweight matching vector categories</small></button></div>'+
  '<div class="icon-studio-subtitle">Preview from your installed apps</div>'+
  '<div id="iconStudioPreview" class="icon-studio-preview"></div>'+
  '<p id="iconStudioStatus" class="icon-studio-note"></p>'+
  '<button type="button" id="iconStudioDone">Done</button></section>';
 document.body.appendChild(dialog);
 function updateStudio(){
  dialog.querySelectorAll("[data-icon-mode]").forEach(b=>
   b.setAttribute("aria-pressed",String(b.dataset.iconMode===selected())));
  const chosen=launcherSuggestedApps().slice(0,8);
  const preview=document.getElementById("iconStudioPreview");
  preview.innerHTML=chosen.map(app=>'<div class="icon-studio-preview-app">'+
   nativeIcon(app)+'<span>'+esc(app.label)+'</span></div>').join("");
  document.getElementById("iconStudioStatus").textContent=nativeReady?
   "Icons are generated privately on your phone, on demand. The preview shows the style currently selected for "+
    (launcherTheme==="warm"?"Warm Minimal":launcherTheme==="pixel"?"8-Bit":launcherTheme==="windows"?"Windows Tiles":"Minimal")+
    ". Each theme remembers its own icon preference.":
   "Preview uses lightweight outline fallbacks in the browser. Native icon generation is available in the installed Android APK.";
 }
 function closeStudio(){dialog.hidden=true}
 menuButton.onclick=()=>{
  if(typeof closeHomeOptions==="function")closeHomeOptions(true);
  dialog.hidden=false;
  updateStudio();
 };
 dialog.querySelector("#iconStudioClose").onclick=closeStudio;
 dialog.querySelector("#iconStudioDone").onclick=closeStudio;
 dialog.onclick=e=>{if(e.target===dialog)closeStudio()};
 dialog.addEventListener("click",e=>{
  const mode=e.target.closest("[data-icon-mode]")?.dataset.iconMode;
  if(!mode)return;
  deskStorage.setItem(key(),mode);
  rerender();
  updateStudio();
 });
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!dialog.hidden)closeStudio()});
 window.addEventListener("launcher-page-changed",()=>{
  if(!dialog.hidden)closeStudio();
 });
 // Useful for Playwright and future icon preference syncing. No permissions needed.
 window.audioDeskIconStudio={
  nativeReady,
  mode:()=>selected(),
  open:()=>{dialog.hidden=false;updateStudio()},
  setMode:mode=>{if(["themed","original","outline"].includes(mode)){
   deskStorage.setItem(key(),mode);rerender();updateStudio();
  }}
 };
 rerender();
})();
