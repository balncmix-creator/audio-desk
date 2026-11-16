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
/* One wallpaper-controlled palette for every theme component. */
const wallpaperTokenNames=["--ds-bg","--ds-panel","--ds-panel2","--ds-text","--ds-muted",
 "--ds-line","--ds-accent","--warm-panel","--warm-panel2","--warm-ink",
 "--warm-muted","--warm-search","--warm-search-ink","--theme-panel"];
function themeRgb(color){
 const match=/^#([\da-f]{6})$/i.exec(color||"");
 return match?[0,2,4].map(i=>parseInt(match[1].slice(i,i+2),16)):null;
}
function themeHex(rgb){
 return "#"+rgb.map(x=>Math.round(Math.max(0,Math.min(255,x))).toString(16).padStart(2,"0")).join("");
}
function themeMix(a,b,t){
 const x=themeRgb(a),y=themeRgb(b);
 return x&&y?themeHex(x.map((v,i)=>v*(1-t)+y[i]*t)):a;
}
function themeLuminance(color){
 const values=themeRgb(color)||[0,0,0];
 const [r,g,b]=values.map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});
 return .2126*r+.7152*g+.0722*b;
}
function themeInk(surface){
 return themeLuminance(surface)>.20?"#17191c":"#fafafa";
}
function applyWallpaperTokens(p,photoColor){
 const style=document.body.style;
 for(const key of wallpaperTokenNames)style.removeProperty(key);
 if(!p&&!themeRgb(photoColor))return;
 const base=p?p[2]:({minimal:"#0e1113",pixel:"#08070b",windows:"#101820",warm:"#1e1b1d"}[launcherTheme]||"#101013");
 const middle=p?p[3]:themeMix(photoColor,base,.53);
 const accent=p?p[4]:themeMix(photoColor,"#ffffff",themeLuminance(photoColor)<.28?.4:.08);
 const panel=themeMix(base,middle,.75);
 const panel2=themeMix(base,middle,.94);
 const ink=themeInk(panel);
 const search=themeMix(base,middle,.48);
 const tokens={
  "--ds-bg":base,
  "--ds-panel":panel,
  "--ds-panel2":panel2,
  "--ds-text":themeInk(base),
  "--ds-muted":themeMix(themeInk(base),base,.40),
  "--ds-line":themeMix(middle,accent,.30),
  "--ds-accent":accent,
  "--warm-panel":panel2,
  "--warm-panel2":themeMix(panel2,base,.17),
  "--warm-ink":themeInk(panel2),
  "--warm-muted":themeMix(themeInk(panel2),panel2,.35),
  "--warm-search":search,
  "--warm-search-ink":themeInk(search),
  "--theme-panel":panel2
 };
 for(const [key,value] of Object.entries(tokens))style.setProperty(key,value);
}

function setPalette(id){
 paletteId=palettes[launcherTheme].some(p=>p[0]===id)?id:null;
 const p=activePalette();
 document.body.dataset.themePalette=paletteId||"";
 const root=document.documentElement.style;
 root.setProperty("--theme-wallpaper",p?"linear-gradient(152deg,"+p[2]+"," +p[3]+ " 64%,"+p[2]+")":"none");
 root.setProperty("--theme-accent",p?.[4]||"#ededed");
 root.setProperty("--theme-panel",p?.[5]||"#f0dad3");
 applyWallpaperTokens(p,null);
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
window.addEventListener("audio-desk-wallpaper-tones",e=>{
 if(!paletteId&&e.detail?.accent)applyWallpaperTokens(null,e.detail.accent);
});
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
 setPalette(null); // Clear the previous edition's tokens before restoring wallpaper.
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

// Widget resize is opt-in via 520ms hold and editable corner handles.
const widgetIds=[
 "launcherMusicWidget","warmDateWidget","warmAudioWidget","warmSearchWidget",
 "launcherClockWidget","liveClockWidget","liveCalendarWidget","liveNewsWidget",
 "launcherRecentStrip"
];
const sizeKey=()=> "ad_widget_sizes_"+launcherTheme+"_v1";
let editing=null,held=null,dragging=null,ignoreClickUntil=0;
function readSizes(){
 try{const x=JSON.parse(deskStorage.getItem(sizeKey())||"{}");return x&&typeof x==="object"?x:{}}catch{return{}}
}
function applySavedSizes(){
 const sizes=readSizes();
 for(const id of widgetIds){
  const el=byId(id);if(!el)continue;
  el.style.removeProperty("--user-widget-width");
  el.style.removeProperty("--user-widget-height");
  const v=sizes[id];
  if(v&&Number.isFinite(v.w)&&Number.isFinite(v.h)){
   el.style.setProperty("--user-widget-width",Math.round(v.w)+"px");
   el.style.setProperty("--user-widget-height",Math.round(v.h)+"px");
  }
 }
 cancelResize();
}
function saveSize(el,w,h){
 const all=readSizes();all[el.id]={w:Math.round(w),h:Math.round(h)};
 deskStorage.setItem(sizeKey(),JSON.stringify(all));
}
function cancelResize(){
 if(editing){editing.querySelector(".widget-resize-frame")?.remove();editing.classList.remove("widget-editing")}
 editing=null;held=null;dragging=null;
}
function beginResize(id){
 const el=byId(id);
 if(!el||el.offsetParent===null)return false;
 cancelResize();editing=el;el.classList.add("widget-editing");
 const frame=document.createElement("div");
 frame.className="widget-resize-frame";
 frame.setAttribute("role","group");
 frame.setAttribute("aria-label","Widget resize controls");
 frame.innerHTML='<span class="widget-resize-label">Drag a corner to resize</span>'+
  '<button class="widget-resize-done" type="button">Done</button>'+
  ["nw","ne","sw","se"].map(c=>'<button type="button" class="widget-resize-handle" data-corner="'+c+
   '" aria-label="Drag '+c+' corner to resize"></button>').join("");
 el.append(frame);
 frame.querySelector(".widget-resize-done").onclick=e=>{
  e.preventDefault();e.stopPropagation();cancelResize();
 };
 function resize(w,h){
  const max=Math.min(window.innerWidth-24,el.parentElement.getBoundingClientRect().width);
  const width=Math.min(max,Math.max(Math.min(160,max),w));
  const height=Math.min(360,Math.max(50,h));
  el.style.setProperty("--user-widget-width",Math.round(width)+"px");
  el.style.setProperty("--user-widget-height",Math.round(height)+"px");
  return {width,height};
 }
 for(const handle of frame.querySelectorAll(".widget-resize-handle")){
  handle.addEventListener("pointerdown",e=>{
   if(e.button!==0)return;
   e.stopPropagation();e.preventDefault();
   const r=el.getBoundingClientRect();
   dragging={el,corner:handle.dataset.corner,x:e.clientX,y:e.clientY,
    w:r.width,h:r.height,moved:false,pointerId:e.pointerId};
   handle.setPointerCapture(e.pointerId);
   document.body.classList.add("widget-dragging");
  });
  handle.addEventListener("pointermove",e=>{
   if(!dragging||dragging.el!==el||dragging.pointerId!==e.pointerId)return;
   e.preventDefault();
   const dx=(dragging.corner.includes("e")?1:-1)*(e.clientX-dragging.x);
   const dy=(dragging.corner.includes("s")?1:-1)*(e.clientY-dragging.y);
   resize(dragging.w+dx,dragging.h+dy);
   dragging.moved=true;
  });
  const finish=e=>{
   if(!dragging||dragging.pointerId!==e.pointerId)return;
   const moved=dragging.moved;dragging=null;
   document.body.classList.remove("widget-dragging");
   if(moved){const r=el.getBoundingClientRect();saveSize(el,r.width,r.height)}
  };
  handle.addEventListener("pointerup",finish);
  handle.addEventListener("pointercancel",finish);
  handle.addEventListener("keydown",e=>{
   if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))return;
   e.preventDefault();e.stopPropagation();
   const r=el.getBoundingClientRect();
   const result=resize(
    r.width+(e.key==="ArrowRight"?12:e.key==="ArrowLeft"?-12:0),
    r.height+(e.key==="ArrowDown"?12:e.key==="ArrowUp"?-12:0)
   );
   saveSize(el,result.width,result.height);
  });
 }
 return true;
}
window.audioDeskBeginWidgetResize=beginResize;
for(const id of widgetIds){
 const el=byId(id);if(!el)continue;
 el.dataset.widgetResizable="true";
 el.addEventListener("contextmenu",e=>{e.preventDefault()});
 if(id==="launcherClockWidget"){
  el.addEventListener("touchstart",e=>e.stopPropagation(),true);
 }
 el.addEventListener("pointerdown",e=>{
  if(e.button!==0||e.target.closest(".widget-resize-frame"))return;
  clearTimeout(held?.timer);
  const x=e.clientX,y=e.clientY;
  held={id,x,y,timer:setTimeout(()=>{
   held=null;
   if(beginResize(id))ignoreClickUntil=Date.now()+800;
  },520)};
 });
 el.addEventListener("pointermove",e=>{
  if(held&&(Math.abs(e.clientX-held.x)>12||Math.abs(e.clientY-held.y)>12)){
   clearTimeout(held.timer);held=null;
  }
 });
 for(const event of ["pointerup","pointercancel","pointerleave"]){
  el.addEventListener(event,()=>{if(held){clearTimeout(held.timer);held=null}});
 }
 el.addEventListener("click",e=>{
  if(Date.now()<ignoreClickUntil&&!e.target.closest(".widget-resize-frame")){
   e.preventDefault();e.stopImmediatePropagation();
  }
 },true);
}
document.addEventListener("pointerdown",e=>{
 if(editing&&!e.target.closest("#"+editing.id))cancelResize();
},true);
window.addEventListener("launcher-page-changed",cancelResize);
refreshThemeChrome();
applySavedSizes();
const startupWallpaper=deskStorage.getItem(key(launcherTheme));
if(startupWallpaper||launcherTheme!=="minimal")
 restoreWallpaper(launcherTheme).catch(()=>{});
else setPalette(null); // Already decoded once by the legacy minimal-home bootstrap.
requestAnimationFrame(()=>{if(!paletteId)window.audioDeskSyncWallpaperAccent?.()});
})();