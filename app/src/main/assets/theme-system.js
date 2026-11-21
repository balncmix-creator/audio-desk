/* Audio Desk unified theme layer.
 * Theme-specific surfaces, persistent wallpapers, opt-in player controls,
 * long-press/drag resizing. Runs only in the foreground WebView. */
(()=>{
"use strict";
const byId=id=>document.getElementById(id);
const palettes={
 orbit:[["forest","Forest"," #101211".trim(),"#35483c","#c5e0c8","#536858"],["graphite","Graphite","#111315","#353b42","#d1d7de","#505b68"],["navy","Midnight","#101621","#283d56","#a8c8f2","#455e7b"],["amber","Amber","#171410","#493a26","#e6c89a","#725638"]],
 extreme:[["black","Pure black","#000000","#000000","#f1f1f1","#151515"]],
 minimal:[
  ["ink","Ink black","#080a0d","#24282b","#e1e5e7","#f5f5f5"],
  ["charcoal","Charcoal","#1b1d20","#4e555b","#e5e8e9","#d4d5d5"],
  ["stone","Stone grey","#373b3e","#777a7e","#f4f4f4","#e2e2e0"],
  ["mist","Mist","#697176","#b5b8b9","#282c31","#e4e4e4"]
 ],
 pixel:[
  ["arcade","Arcade black","#100b22","#24123f","#b97cff","#4c3474"],
  ["mono","Mono 8-bit","#070707","#303030","#e7e7e7","#565656"],
  ["blue","Pixel blue","#081330","#1c4684","#5cd4fe","#3568a5"],
  ["violet","Pixel violet","#241035","#61346d","#f09bea","#714887"]
 ],
 windows:[
  ["metro","Metro black","#060b12","#172d3e","#5db8f1","#257dc1"],
  ["slate","Slate grey","#1b2026","#4c5b66","#e7edf0","#718490"],
  ["azure","Azure","#07152e","#19609a","#f5f8fe","#4eabda"],
  ["plum","Plum","#22142a","#5e3267","#f0dff4","#884da2"]
 ],
 warm:[
  ["black","Warm black","#0b0a0c","#282326","#eedbd4","#eedbd4"],
  ["graphite","Graphite grey","#252529","#525155","#d8d3d0","#cac4c2"],
  ["grey","Silver grey","#4b4d51","#999b9b","#e5e4e1","#eceae8"],
  ["blush","Soft blush","#30272c","#665154","#f4e0d9","#e5c8bf"]
 ]
};
const defaults={orbit:"palette:forest",extreme:"palette:black",minimal:"bundled:0",pixel:"palette:arcade",windows:"palette:metro",warm:"palette:black"};
const key=theme=>"ad_wallpaper_by_theme_v2_"+theme;
let paletteId=null;
let switching=false;
const activePalette=()=>palettes[launcherTheme].find(p=>p[0]===paletteId);
// One wallpaper-derived palette drives all Warm surfaces, not only the picker.
const colorRgb=hex=>{
 const m=/^#([0-9a-f]{6})$/i.exec(hex||"");
 return m?[0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16)):null;
};
const rgbHex=rgb=>"#"+rgb.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("");
const mixColor=(a,b,t)=>rgbHex(a.map((v,i)=>v*(1-t)+b[i]*t));
function setWallpaperColors(accent,panel,dark){
 const a=colorRgb(accent),p=colorRgb(panel),d=colorRgb(dark);
 if(!a||!p||!d)return;
 const root=document.documentElement.style;
 const panelLuma=(p[0]*.2126+p[1]*.7152+p[2]*.0722)/255;
 const darkLuma=(d[0]*.2126+d[1]*.7152+d[2]*.0722)/255;
 const tint=mixColor(a,[255,255,255],.10);
 root.setProperty("--theme-accent",tint);
 root.setProperty("--theme-accent-ink",darkLuma>.58?"#181719":"#121419");
 root.setProperty("--theme-panel",panel);
 root.setProperty("--theme-ink",panelLuma>.56?"#25252b":"#f9f7f6");
 root.setProperty("--theme-dark",dark);
 root.setProperty("--theme-text",darkLuma>.58?"#17171a":mixColor(a,[250,250,250],.82));
 root.setProperty("--theme-surface",mixColor(d,a,.16));
 root.setProperty("--theme-surface2",mixColor(d,a,.28));
 root.setProperty("--theme-line",mixColor(d,a,.49));
 root.setProperty("--theme-muted",mixColor(a,[240,239,240],.64));
 root.setProperty("--theme-glass",mixColor(p,[244,240,238],.18));
}
// Sample the *rendered crop* of the wallpaper, not the full original image.
// The Orbit dial sits above the lower-right crop, but its overall palette must
// still reflect the dominant photo, including warm neutrals and muted colors.
function sampleDisplayedWallpaper(img){
 if(!img || !img.naturalWidth || !img.naturalHeight) return null;
 const stage=byId("wallpaperStage"),rect=stage?.getBoundingClientRect();
 const screenW=Math.max(1,Math.round(rect?.width||innerWidth||360));
 const screenH=Math.max(1,Math.round(rect?.height||innerHeight||760));
 const canvas=document.createElement("canvas");
 canvas.width=72;
 canvas.height=Math.min(160,Math.max(72,Math.round(72*screenH/screenW)));
 const ctx=canvas.getContext("2d",{willReadFrequently:true});
 if(!ctx)return null;
 const fit=getComputedStyle(img);
 const position=(fit.objectPosition||img.style.objectPosition||"50% 50%").split(/\\s+/);
 const pct=(value,defaultValue)=>value?.endsWith("%")?
  Math.max(0,Math.min(1,Number.parseFloat(value)/100)):defaultValue;
 const xPercent=pct(position[0],.5);
 const yPercent=pct(position[1],.5);
 const scale=Math.max(canvas.width/img.naturalWidth,canvas.height/img.naturalHeight);
 const displayedW=img.naturalWidth*scale,displayedH=img.naturalHeight*scale;
 ctx.drawImage(img,(canvas.width-displayedW)*xPercent,(canvas.height-displayedH)*yPercent,displayedW,displayedH);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
 const general=[0,0,0],bins=Array.from({length:12},()=>({color:[0,0,0],weight:0}));
 let mass=0,colored=0,valid=0;
 for(let i=0;i<pixels.length;i+=4){
  const alpha=pixels[i+3]/255;
  if(alpha<.2)continue;
  const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
  const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
  const luma=(r*.2126+g*.7152+b*.0722)/255;
  const saturation=max?delta/max:0;
  // Pale sunlit walls are meaningful colors. Avoid letting small vivid details
  // drown out a broad beige/blue background; avoid near-black/noisy shadows.
  const base=alpha*(.40+.60*Math.sqrt(Math.max(0,luma)));
  general[0]+=r*base;general[1]+=g*base;general[2]+=b*base;
  mass+=base;valid++;
  if(saturation<.075||luma<.10||luma>.97)continue;
  let hue;
  if(delta===0)continue;
  if(max===r)hue=((g-b)/delta+6)%6;
  else if(max===g)hue=(b-r)/delta+2;
  else hue=(r-g)/delta+4;
  hue*=60;
  const bin=Math.min(11,Math.floor(hue/30));
  const weight=base*(.20+saturation*1.60);
  bins[bin].color[0]+=r*weight;
  bins[bin].color[1]+=g*weight;
  bins[bin].color[2]+=b*weight;
  bins[bin].weight+=weight;
  colored+=weight;
 }
 if(valid<20||mass<=0)return null;
 const avg=general.map(x=>x/mass);
 const best=bins.reduce((a,b)=>b.weight>a.weight?b:a);
 const dominant=best.weight>Math.max(mass*.035,colored*.17)?
  best.color.map(x=>x/best.weight):avg;
 let accent=mixColor(dominant,[248,244,238],.18);
 // Preserve a visible accent against dark Orbit rings even on dim photos.
 for(let n=0;n<4;n++){
  const rgb=colorRgb(accent),lum=(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)/255;
  if(lum>.54)break;
  accent=mixColor(rgb,[249,246,240],.22);
 }
 return {
  accent,
  panel:mixColor(avg,[244,241,237],.66),
  dark:mixColor(dominant,[14,16,18],.81)
 };
}
let wallpaperPaletteFrame=0;
function refreshWallpaperColors(){
 const p=activePalette();
 if(p){setWallpaperColors(p[4],p[5],p[2]);return}
 // Audio wallpapers supply their own exact source palette through
 // audioDeskApplyWallpaperColors rather than sampling an unrelated photo.
 if(document.body.dataset.audioWallpaper)return;
 const img=byId("wallpaperImage");
 if(!img?.naturalWidth){
  if(!document.documentElement.style.getPropertyValue("--theme-accent"))
   setWallpaperColors("#c5e0c8","#536858","#101211");
  return;
 }
 try{
  const colors=sampleDisplayedWallpaper(img);
  if(colors){
   setWallpaperColors(colors.accent,colors.panel,colors.dark);
   document.body.dataset.wallpaperPaletteSource="photo";
  }
 }catch{
  // A failed decode / cross-origin photo must not replace the last valid
  // palette with a static pink or blue-grey fallback.
 }
}
function scheduleWallpaperColors(){
 if(wallpaperPaletteFrame)cancelAnimationFrame(wallpaperPaletteFrame);
 wallpaperPaletteFrame=requestAnimationFrame(()=>{
  wallpaperPaletteFrame=0;
  refreshWallpaperColors();
 });
}
// The wallpaper picker and imported images all pass through this decoded-image path.
const originalApplyWallpaper=applyWallpaper;
applyWallpaper=async function(){
 await originalApplyWallpaper();
 scheduleWallpaperColors();
};
// Also support wallpaper replacement by other built-in/gallery flows. The
// asynchronous decoded image is inserted into wallpaperStage at the end.
const wallpaperStage=byId("wallpaperStage");
if(wallpaperStage){
 new MutationObserver(records=>{
  if(records.some(r=>Array.from(r.addedNodes).some(n=>
   n.nodeType===1&&(n.id==="wallpaperImage"||n.querySelector?.("#wallpaperImage")))))
   scheduleWallpaperColors();
 }).observe(wallpaperStage,{childList:true,subtree:true});
}
byId("customWallpaperPosition")?.addEventListener("input",scheduleWallpaperColors);
window.addEventListener("resize",scheduleWallpaperColors);
window.addEventListener("audio-desk-theme-changed",scheduleWallpaperColors);
window.audioDeskApplyWallpaperColors=(accent,dark)=>{
 const a=colorRgb(accent);if(!a||!colorRgb(dark))return;
 setWallpaperColors(accent,
  mixColor(a,[241,240,242],.66),dark);
};
window.audioDeskRefreshWallpaperColors=refreshWallpaperColors;
function setPalette(id){
 paletteId=palettes[launcherTheme].some(p=>p[0]===id)?id:null;
 const p=activePalette();
 document.body.dataset.themePalette=paletteId||"";
 const root=document.documentElement.style;
 root.setProperty("--theme-wallpaper",p?"linear-gradient(152deg,"+p[2]+"," +p[3]+ " 64%,"+p[2]+")":"none");
 refreshWallpaperColors();
 if(p){
  document.body.dataset.wallpaperLight="false";
  document.body.dataset.wallpaperStatusLight="false";
 }
}
function storedTheme(theme){
 return deskStorage.getItem(key(theme))|| (theme==="minimal"?"bundled:"+selectedWallpaper:defaults[theme]);
}
function rememberWallpaper(value){deskStorage.setItem(key(launcherTheme),value)}
function updatePaletteGrid(){
 const grid=byId("themePaletteGrid");if(!grid)return;
 grid.innerHTML=palettes[launcherTheme].map(p=>
  '<button type="button" class="theme-palette-choice" data-palette="'+p[0]+'" aria-pressed="'+(paletteId===p[0])+'">'+
  '<span class="theme-palette-swatch" style="--swatch-dark:'+p[2]+';--swatch-mid:'+p[3]+';--swatch-accent:'+p[4]+'"></span>'+
  '<strong>'+p[1]+'</strong></button>').join("");
}
function paletteImage(p){
 const c=document.createElement("canvas");c.width=480;c.height=960;
 const g=c.getContext("2d"),gradient=g.createLinearGradient(0,0,480,960);
 gradient.addColorStop(0,p[2]);gradient.addColorStop(.65,p[3]);gradient.addColorStop(1,p[2]);
 g.fillStyle=gradient;g.fillRect(0,0,480,960);
 const glow=g.createRadialGradient(385,200,0,385,200,350);
 glow.addColorStop(0,p[4]+"44");glow.addColorStop(1,p[4]+"00");
 g.fillStyle=glow;g.fillRect(0,0,480,650);
 return c.toDataURL("image/jpeg",.87);
}
const applyNativeWallpaper=applySystemWallpaper;
async function applyPaletteWallpaper(){
 const p=activePalette();
 if(!p)return applyNativeWallpaper();
 const native=window.AudioDesk;
 const status=byId("wallpaperSystemStatus");
 if(typeof native?.setSystemWallpaperCustom!=="function"){
  status.textContent="Theme colour saved. Android wallpaper application is available in the installed APK.";
  return;
 }
 const request=++systemWallpaperRequest;
 const lock=byId("wallpaperApplyLock").checked;
 systemWallpaperPendingLock=lock;
 status.textContent="Applying "+p[1]+" to Android "+(lock?"Home and Lock":"Home")+"…";
 try{
  native.setSystemWallpaperCustom(paletteImage(p),35,lock,request);
 }catch(e){if(request===systemWallpaperRequest)status.textContent=e.message||"Wallpaper update failed."}
}
applySystemWallpaper=applyPaletteWallpaper;
byId("wallpaperApplySystem").onclick=applyPaletteWallpaper;
const baseRenderWallpapers=renderWallpaperPicker;
renderWallpaperPicker=function(){
 baseRenderWallpapers();
 updatePaletteGrid();
};
byId("themePaletteGrid").addEventListener("click",e=>{
 const button=e.target.closest("[data-palette]");if(!button)return;
 setPalette(button.dataset.palette);
 rememberWallpaper("palette:"+paletteId);
 customWallpaperSelected=false;
 wallpaperEffectChoice="none";
 syncWallpaperMotion();
 updatePaletteGrid();
 applyPaletteWallpaper();
});
byId("wallpaperGrid").addEventListener("click",e=>{
 const b=e.target.closest("[data-wallpaper]");if(!b)return;
 setPalette(null);rememberWallpaper("bundled:"+Number(b.dataset.wallpaper));
},true);
byId("customWallpaperFile").addEventListener("change",e=>{
 if(!e.target.files.length)return;
 setPalette(null);rememberWallpaper("custom");
},true);
byId("customWallpaperRestore").addEventListener("click",()=>{
 setPalette(null);rememberWallpaper("custom");
},true);
async function restoreWallpaper(theme){
 if(theme==="extreme")await applyWallpaper();
 if(launcherTheme!==theme)return;
 const choice=theme==="extreme"?"palette:black":storedTheme(theme);
 if(choice.startsWith("palette:")){
  setPalette(choice.slice(8));
  customWallpaperSelected=false;
  wallpaperEffectChoice="none";syncWallpaperMotion();
 }else if(choice.startsWith("bundled:")){
  setPalette(null);
  const n=Number(choice.slice(8));
  selectedWallpaper=Number.isInteger(n)&&WALLPAPERS[n]?n:0;
  customWallpaperSelected=false;
  deskStorage.setItem("ar_wallpaper_v1",selectedWallpaper);
  await applyWallpaper();
 }else if(choice==="custom"){
  setPalette(null);
  try {
   const record=await customWallpaperStore();
   if(launcherTheme!==theme)return;
   if(record){useCustomWallpaper(record);customWallpaperSelected=true;await applyWallpaper()}
   else{customWallpaperSelected=false;await applyWallpaper()}
  }catch{customWallpaperSelected=false;await applyWallpaper()}
 }
 if(launcherTheme===theme)updatePaletteGrid();
}
const baseSetLauncherTheme=setLauncherTheme;
setLauncherTheme=function(theme){
 if(!LAUNCHER_THEMES.includes(theme))return;
 const prev=launcherTheme;
 if(prev===theme){refreshThemeChrome();applySavedSizes();return}
 if(!deskStorage.getItem(key(prev)))
  deskStorage.setItem(key(prev),paletteId?"palette:"+paletteId:
   customWallpaperSelected?"custom":"bundled:"+selectedWallpaper);
 switching=true;
 baseSetLauncherTheme(theme);
 closeLauncherLetterPanel();
 renderLauncherApps();
 refreshThemeChrome();
 restoreWallpaper(theme).then(()=>{if(launcherTheme===theme){refreshThemeChrome();applySavedSizes()}}).catch(()=>{});
 switching=false;
 applySavedSizes();
};
function refreshThemeChrome(){
 const modern=launcherTheme!=="pixel";
 const labels={
 launcherAllApps:["All applications","▦ ALL APPS","apps"],
 launcherOpenNews:["Audio Desk news","◂ AUDIO NEWS","audio"],
 launcherThemeChoose:["Choose theme","▤ HOME THEME","settings"],
 launcherFavoritesEdit:["Manage pinned apps","☆ MANAGE APP TILES","apps"],
 launcherWallpaperChoose:["Wallpapers & colours","▧ WALLPAPERS & ANIMATION","image"],
 launcherClockChoose:["Clock design & size","◷ CLOCK STYLE & SIZE","clock"],
 launcherShowRecents:["Recently opened","▣ RECENTLY OPENED APPS","clock"],
 launcherRecentRefresh:["Refresh","REFRESH ↻","arrow"]
 };
 for(const id of Object.keys(labels)){
  const b=byId(id),data=labels[id];if(!b)continue;
  b.textContent=modern?data[0]:data[1];
  if(modern&&typeof warmIconSvg==="function"){
   const icon=document.createElement("span");icon.className="theme-action-icon";
   icon.innerHTML=warmIconSvg(data[2]);b.prepend(icon);
  }
 }
 byId("launcherAllAppsHeading").textContent=launcherTheme==="pixel"?"[ ALL APPLICATIONS ]":
  launcherTheme==="windows"?"APPS":"All applications";
 byId("launcherAppSearch").placeholder=launcherTheme==="pixel"?"SEARCH INSTALLED APPS…":"Search installed apps";
 const summary=document.querySelector("#launcherAppsPage .launcher-summary span:last-child");
 if(summary)summary.textContent=launcherTheme==="pixel"?"DRAG A—Z ON RIGHT":"Browse A–Z";
 document.querySelector("#launcherAppsPage .launcher-foot").textContent=
  launcherTheme==="pixel"?"TAP APP TO OPEN · STAR TO PIN · SWIPE RIGHT HOME":
  "Tap an app to open · Star to pin · Swipe right to Home";
 document.querySelector("#launcherOptionsSheet .launcher-options-heading span").textContent=
  launcherTheme==="pixel"?"AUDIO DESK":"Audio Desk · Home options";
 const navLabels=launcherTheme==="pixel"?["◂ NEWS","◉ HOME","APPS ▸"]:
  launcherTheme==="windows"?["News","Home","Apps"]:
  launcherTheme==="warm"?["Audio Desk","Home","Applications"]:["News","Home","All apps"];
 document.querySelectorAll("#launcherNavigation [data-home-nav]").forEach((b,i)=>{
  b.textContent=navLabels[i];
 });
}

// Theme-matched media controls; never skip prohibited ads or ignore player actions.
let mediaState={enabled:false,available:false},mediaSignature="",mediaTimer=0;
window.receiveAudioDeskMedia=function(data){
 if(!data||typeof data!=="object")return;
 mediaState=data;
 const signature=JSON.stringify([data.enabled,data.available,data.playing,data.title,data.artist,data.app,data.canPrevious,data.canNext,data.canToggle]);
 if(signature===mediaSignature)return;
 mediaSignature=signature;
 const available=!!data.available;
 byId("musicTrackTitle").textContent=available?(data.title||"Unknown track"):
  (data.enabled?"No active player":"Music controls");
 byId("musicTrackArtist").textContent=available?(data.artist||data.app||"Media session"):
  (data.enabled?"Open your music player":"Connect a compatible player");
 byId("musicPrev").disabled=!available||!data.canPrevious;
 byId("musicNext").disabled=!available||!data.canNext;
 const toggle=byId("musicToggle");
 toggle.disabled=!available||!data.canToggle;
 // The icon describes the action: pause while playing, play while paused.
 const isPlaying=available&&data.playing===true;
 toggle.textContent=isPlaying?"❚❚":"▶";
 toggle.setAttribute("aria-label",isPlaying?"Pause playback":"Play playback");
 toggle.title=isPlaying?"Pause":"Play";
 toggle.dataset.playing=String(isPlaying);
 byId("musicAccess").hidden=!!data.enabled;
 byId("musicAccessNote").textContent=available?
  (data.canNext?"Skip follows the player’s Next permission. Ads are not bypassed.":
   "This player currently does not permit skipping."):
  (data.enabled?"Start playing music in a compatible app.":
   "Optional Notification Access enables media sessions; notification text is not read.");
};
byId("musicAccess").onclick=()=>window.AudioDesk?.requestMediaAccess?.();
for(const [id,action] of [["musicPrev","previous"],["musicToggle","toggle"],["musicNext","next"]]){
 byId(id).onclick=()=>{if(!byId(id).disabled)window.AudioDesk?.mediaCommand?.(action)};
}
function refreshMedia(){
 clearTimeout(mediaTimer);
 const music=byId("launcherMusicWidget");
 if(launcherTheme==="extreme"||document.hidden||window.audioDeskForeground===false||launcherPage!=="home"||
  (music.hasAttribute("data-widget-removed")&&launcherTheme!=="windows"&&launcherTheme!=="orbit"))return;
 window.AudioDesk?.requestMediaState?.();
 mediaTimer=setTimeout(refreshMedia,lowPowerMode()?(mediaState.playing?6000:18000):(mediaState.playing?3500:9000));
}
window.addEventListener("launcher-page-changed",refreshMedia);
window.addEventListener("audio-desk-theme-changed",refreshMedia);
window.addEventListener("audio-desk-foreground",refreshMedia);
window.addEventListener("audio-desk-widget-visibility",refreshMedia);
document.addEventListener("visibilitychange",refreshMedia);
const origResume=window.launcherOnResume;
window.launcherOnResume=function(){origResume?.();refreshMedia()};
refreshMedia();

// Unified, eight-handle Home layout editor is initialized by widget-layout.js.
// Theme switches call through the editor so each theme retains its own geometry.
function applySavedSizes(){window.audioDeskRestoreWidgetLayouts?.()}
refreshThemeChrome();
applySavedSizes();
const startupWallpaper=deskStorage.getItem(key(launcherTheme));
if(startupWallpaper||launcherTheme!=="minimal")
 restoreWallpaper(launcherTheme).catch(()=>{});
else setPalette(null); // Already decoded once by the legacy minimal-home bootstrap.
})();