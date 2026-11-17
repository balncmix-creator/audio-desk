/* Audio Desk unified theme layer.
 * Theme-specific surfaces, persistent wallpapers, opt-in player controls,
 * long-press/drag resizing. Runs only in the foreground WebView. */
(()=>{
"use strict";
const byId=id=>document.getElementById(id);
const palettes={
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
const defaults={minimal:"bundled:0",pixel:"palette:arcade",windows:"palette:metro",warm:"palette:black"};
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
function refreshWallpaperColors(){
 const p=activePalette();
 if(p){setWallpaperColors(p[4],p[5],p[2]);return}
 if(document.body.dataset.audioWallpaper)return;
 const img=byId("wallpaperImage");
 if(!img?.naturalWidth){setWallpaperColors("#eedbd4","#f0dad3","#1b181a");return}
 try{
  const canvas=document.createElement("canvas");canvas.width=32;canvas.height=32;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(img,0,0,32,32);
  const pixels=ctx.getImageData(0,0,32,32).data;
  const sum=[0,0,0],chromatic=[0,0,0];let weight=0,colorWeight=0;
  for(let i=0;i<pixels.length;i+=4){
   const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
   const max=Math.max(r,g,b),min=Math.min(r,g,b);
   const saturation=(max-min)/255;
   const visibility=max/255;
   const w=.3+saturation*.9;
   sum[0]+=r*w;sum[1]+=g*w;sum[2]+=b*w;weight+=w;
   // A small, saturated area should set the accent on dark audio wallpapers;
   // averaging the entire frame otherwise turns every accent grey or pink.
   const chromaWeight=saturation*saturation*visibility*visibility;
   if(chromaWeight>.014){
    chromatic[0]+=r*chromaWeight;chromatic[1]+=g*chromaWeight;
    chromatic[2]+=b*chromaWeight;colorWeight+=chromaWeight;
   }
  }
  const avg=sum.map(x=>x/weight);
  const dominant=colorWeight>.3?chromatic.map(x=>x/colorWeight):avg;
  const accent=mixColor(dominant,[250,250,250],.22);
  const panel=mixColor(avg,[242,240,241],.70);
  const dark=mixColor(avg,[15,15,20],.83);
  setWallpaperColors(accent,panel,dark);
 }catch{setWallpaperColors("#eedbd4","#f0dad3","#1b181a")}
}
// The wallpaper picker and imported images all pass through this decoded-image path.
const originalApplyWallpaper=applyWallpaper;
applyWallpaper=async function(){
 await originalApplyWallpaper();
 if(!activePalette())refreshWallpaperColors();
};
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
 const choice=storedTheme(theme);
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
let mediaState={enabled:false,available:false};
window.receiveAudioDeskMedia=function(data){
 if(!data||typeof data!=="object")return;
 mediaState=data;
 const available=!!data.available;
 byId("musicTrackTitle").textContent=available?(data.title||"Unknown track"):
  (data.enabled?"No active player":"Music controls");
 byId("musicTrackArtist").textContent=available?(data.artist||data.app||"Media session"):
  (data.enabled?"Open your music player":"Connect a compatible player");
 byId("musicPrev").disabled=!available||!data.canPrevious;
 byId("musicNext").disabled=!available||!data.canNext;
 byId("musicToggle").disabled=!available||!data.canToggle;
 byId("musicToggle").textContent=data.playing?"Ⅱ":"▶";
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
 if(document.hidden||launcherPage!=="home")return;
 window.AudioDesk?.requestMediaState?.();
}
window.addEventListener("launcher-page-changed",refreshMedia);
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