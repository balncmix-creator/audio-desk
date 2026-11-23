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
 // 20 original, locally generated visual families. These are NOT copies of
 // independent third-party icon packs; every icon is produced from the app
 // already installed on the device with no licensing or coverage gaps.
 const packs=[
  ["ink","Ink Mono","Contrasting black and ivory","#111619","#e8ebe9","50%","flat"],
  ["pearl","Pearl","Soft pearl monochrome","#e7e3db","#4b555b","50%","gloss"],
  ["graphite","Graphite","Subtle neutral slate","#30373f","#bfc8d1","27%","flat"],
  ["sage","Sage","Quiet desaturated green","#304c3e","#afcdb3","28%","glass"],
  ["moss","Moss","Earthy dark greens","#1f3b2c","#a4cc80","25%","flat"],
  ["copper","Copper","Warm bronze outlines","#482f25","#f4b17c","29%","gloss"],
  ["sand","Sandstone","Natural beige and ochre","#ecdcc4","#584132","40%","paper"],
  ["rose","Rose","Soft dusty pink","#5c3048","#f7b5cc","45%","glass"],
  ["lavender","Lavender","Pastel violet","#3e315d","#dec4f6","38%","glass"],
  ["ocean","Ocean","Deep blue and aqua","#102f54","#98d4f5","28%","glass"],
  ["sky","Skyline","Clean cool cyan","#1e5670","#c0f1ff","30%","gloss"],
  ["ember","Ember","Bold rust and red","#4e2431","#ffb47c","28%","gloss"],
  ["citrus","Citrus","Sunny golden yellow","#5f581b","#fbeca0","30%","flat"],
  ["mint","Mint","Fresh green glow","#173d35","#b9f6ce","40%","glass"],
  ["neon","Neon Signal","Electric turquoise","#0c1d30","#7bfde4","22%","neon"],
  ["dusk","Dusk","Dark violet gradients","#261e40","#bd9be6","32%","gloss"],
  ["arcade","Arcade 8-bit","Crisp pixel palette","#1c1331","#e5bcfa","0","pixel"],
  ["blueprint","Blueprint","Architectural white-on-blue","#123c78","#bddcff","0","flat"],
  ["paper","Paper Cut","Warm off-white cutouts","#eee0ca","#483b32","12%","paper"],
  ["glass","Prism Glass","Full-colour glass tiles","#2c3944","#a9d2df","36%","glass"]
 ];
 const packById=new Map(packs.map(p=>[p[0],p]));
 const packKey=()=>"ad_icon_studio_pack_v1_"+launcherTheme;
 function selectedPack(){
  const id=deskStorage.getItem(packKey())||"sage";
  return packById.has(id)?id:"sage";
 }
 const packStyle=pack=>{
  const p=packById.get(pack)||packById.get("sage");
  const [id,, ,background,edge,radius,finish]=p;
  const fill=id==="pearl"?"linear-gradient(135deg,#e7e3db,#faf8f3)":
   finish==="paper"?"linear-gradient(150deg,"+background+",#fff7e8)":
   finish==="neon"?"linear-gradient(140deg,"+background+",#0b2635)":
   finish==="gloss"?"linear-gradient(135deg,"+background+"," +edge+" 190%)":
   finish==="glass"?"linear-gradient(125deg,"+background+"d9,"+background+"9a)":
   background;
  const shadow=finish==="neon"?"0 0 9px "+edge+"80, inset 0 0 7px "+edge+"40":
   finish==="paper"?"2px 3px 0 #0003":"inset 0 1px 0 #ffffff45";
  return '--pack-bg:'+fill+';--pack-edge:'+edge+
   ';--pack-radius:'+radius+';--pack-shadow:'+shadow;
 };

 function selected(){
  const saved=deskStorage.getItem(key())||"themed";
  return ["themed","original","outline","pack"].includes(saved)?saved:"themed";
 }
 function effectiveTheme(){
  const mode=selected();
  return mode==="original"?"original":mode==="pack"?"pack-"+selectedPack():launcherTheme;
 }
 function validPackage(pkg){
  return typeof pkg==="string"&&/^[A-Za-z0-9_.]{4,180}$/.test(pkg);
 }
 function nativeIcon(app,packOverride=null){
  if(launcherTheme==="extreme")return "";
  const fallback=originalIcon(app);
  const mode=selected();
  const selectedId=packOverride||((mode==="pack")?selectedPack():null);
  if(!packOverride&&(mode==="outline"||!validPackage(app?.pkg)))return fallback;
  const route=selectedId?"pack-"+selectedId:effectiveTheme();
  const src="/app-icons/"+route+"/"+encodeURIComponent(app.pkg)+".png";
  const attrs=selectedId?' data-icon-pack="'+esc(selectedId)+'" style="'+esc(packStyle(selectedId))+'"':"";
  return '<span class="ad-icon-shell ad-icon-'+launcherTheme+'"'+attrs+' aria-hidden="true">'+
   '<span class="ad-icon-fallback">'+fallback+'</span>'+
   (nativeReady?'<img class="ad-icon-image" src="'+src+'" alt="" decoding="async" loading="lazy">':"")+
   '</span>';
 }
 launcherIcon=nativeIcon;
 document.addEventListener("load",e=>{
  const img=e.target;
  if(!(img instanceof HTMLImageElement)||!img.classList.contains("ad-icon-image"))return;
  if(img.naturalWidth>0)img.closest(".ad-icon-shell")?.classList.add("icon-loaded");
 },true);
 document.addEventListener("error",e=>{
  const img=e.target;
  if(!(img instanceof HTMLImageElement)||!img.classList.contains("ad-icon-image"))return;
  // If a generated pack rendition cannot be decoded, use the actual native
  // app icon before ever showing a generic letter or theme silhouette.
  if(!img.dataset.nativeOriginalRetry&&/\/app-icons\/pack-[a-z]+\//.test(img.src)){
   img.dataset.nativeOriginalRetry="yes";
   img.src=img.src.replace(/\/app-icons\/pack-[a-z]+\//,"/app-icons/original/");
   return;
  }
  img.closest(".ad-icon-shell")?.classList.remove("icon-loaded");
 },true);
 function rerender(){
  // Recents normally skip identical app lists; icons change even when apps do not.
  delete document.getElementById("launcherRecentQuick").dataset.fingerprint;
  renderLauncherHome();
  if(launcherPage==="apps")renderLauncherApps();
  if(!document.getElementById("launcherRecentDrawer").hidden)renderLauncherRecents();
  window.audioDeskOrbitRedrawIcons?.();
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
  '<p>Choose from 20 free Audio Desk icon families, or keep the original icon.</p></div>'+
  '<button type="button" id="iconStudioClose" aria-label="Close Icon Studio">×</button></div>'+
  '<div class="icon-studio-options" role="group" aria-label="Icon rendering preference">'+
  '<button type="button" data-icon-mode="themed">Theme-matched<small>Generate a matching style from each installed app icon</small></button>'+
  '<button type="button" data-icon-mode="original">Original<small>Show the installed app’s full-colour icon</small></button>'+
  '<button type="button" data-icon-mode="outline">Simple outline<small>Use lightweight matching vector categories</small></button>'+
  '<button type="button" data-icon-mode="pack">Icon packs<small>20 distinct offline looks · your apps stay recognizable</small></button></div>'+
  '<div class="icon-studio-subtitle">20 built-in free icon families</div>'+
  '<div id="iconStudioPacks" class="icon-studio-packs" role="group" aria-label="Choose an icon pack"></div>'+
  '<div class="icon-studio-subtitle">Preview from your installed apps</div>'+
  '<div id="iconStudioPreview" class="icon-studio-preview"></div>'+
  '<p id="iconStudioStatus" class="icon-studio-note"></p>'+
  '<button type="button" id="iconStudioDone">Done</button></section>';
 document.body.appendChild(dialog);
 function updateStudio(){
  dialog.querySelectorAll("[data-icon-mode]").forEach(b=>
   b.setAttribute("aria-pressed",String(b.dataset.iconMode===selected())));
  const chosen=launcherSuggestedApps().slice(0,8);
  const sample=chosen[0];
  const packGrid=document.getElementById("iconStudioPacks");
  packGrid.innerHTML=packs.map(([id,name,description])=>
   '<button type="button" data-icon-pack-choice="'+id+'" aria-pressed="'+
    (selected()==="pack"&&selectedPack()===id)+'" title="'+esc(description)+'">'+
   (sample?nativeIcon(sample,id):'<span class="ad-icon-shell" data-icon-pack="'+id+'" style="'+
     esc(packStyle(id))+'"><span class="ad-pack-placeholder">◈</span></span>')+
   '<strong>'+esc(name)+'</strong><small>'+esc(description)+'</small></button>').join("");
  const preview=document.getElementById("iconStudioPreview");
  preview.innerHTML=chosen.map(app=>'<div class="icon-studio-preview-app">'+
   nativeIcon(app)+'<span>'+esc(app.label)+'</span></div>').join("");
  document.getElementById("iconStudioStatus").textContent=nativeReady?
   "These 20 styles are original Audio Desk recolorings of apps on your phone, not copied commercial artwork. They work offline across Home, Apps, Recents and Orbit. Each theme remembers its selection.":
   "Twenty styles are available for selection. The Android APK will generate their app icons on-device; web preview uses fallbacks.";
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
  const pack=e.target.closest("[data-icon-pack-choice]")?.dataset.iconPackChoice;
  if(packById.has(pack)){
   deskStorage.setItem(packKey(),pack);
   deskStorage.setItem(key(),"pack");
   rerender();updateStudio();return;
  }
  const mode=e.target.closest("[data-icon-mode]")?.dataset.iconMode;
  if(!mode||!["themed","original","outline","pack"].includes(mode))return;
  deskStorage.setItem(key(),mode);
  rerender();updateStudio();
 });
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!dialog.hidden)closeStudio()});
 window.addEventListener("launcher-page-changed",()=>{
  if(!dialog.hidden)closeStudio();
 });
 // Useful for Playwright and future icon preference syncing. No permissions needed.
 window.audioDeskIconStudio={
  nativeReady,
  mode:()=>selected(),
  pack:()=>selectedPack(),
  // SVG Orbit renderer uses the SAME pack's surfaces and shapes as Apps;
  // never derive a separate fixed gray icon style inside the radial dial.
  appearance:()=>{
   if(selected()!=="pack")return null;
   const p=packById.get(selectedPack());
   return p?{id:p[0],background:p[3],edge:p[4],radius:p[5],finish:p[6]}:null;
  },
  packs:()=>packs.map(([id,name,description])=>({id,name,description})),
  iconUrlFor:app=>{
   const pkg=String(app?.pkg||"");
   if(!validPackage(pkg)||selected()==="outline")return "";
   return "/app-icons/"+effectiveTheme()+"/"+encodeURIComponent(pkg)+".png";
  },
  open:()=>{dialog.hidden=false;updateStudio()},
  setMode:mode=>{if(["themed","original","outline","pack"].includes(mode)){
   deskStorage.setItem(key(),mode);rerender();updateStudio();
  }},
  setPack:id=>{if(packById.has(id)){
   deskStorage.setItem(packKey(),id);deskStorage.setItem(key(),"pack");
   rerender();updateStudio();
  }}
 };
 rerender();
})();
