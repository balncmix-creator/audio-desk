/* QA#15 — Original photographs by named photographers, not generated wallpapers.
   Source pages and Unsplash License confirmed 2026-11-21. Online on first load. */
(()=>{
"use strict";
const $=id=>document.getElementById(id),stage=$("wallpaperStage"),dialog=$("launcherWallpaperDialog");
if(!stage||!dialog)return;
const photos=[
["harrison","Architectural Silence","Architecture","Harrison Lin","https://unsplash.com/photos/minimalist-architecture-with-clean-lines-against-sky-BdeFclXOQ2Y","photo-1774249415644-276c3ac1bfaa","#9bbac4","#172532",true],
["lloyd","Modern Lines","Architecture","Lloyd Dirks","https://unsplash.com/photos/modern-architecture-with-a-minimalist-and-clean-aesthetic-5vh1Ss84EGA","photo-1742602400465-ca99195e3383","#789b9e","#18212a",false],
["jimmy","Concrete Shadows","Architecture","Jimmy Liu","https://unsplash.com/photos/concrete-stairs-leading-into-darkness-with-dramatic-lighting-JmtEV6N3YQ4","photo-1776589583350-16fae6a4cacb","#a6b0ba","#1c2025",false],
["annie","Monochrome Ocean","Monochrome","Annie Spratt","https://unsplash.com/photos/a-black-and-white-photo-of-waves-in-the-ocean-yN1lXxg5oKk","photo-1735024172375-0d95f4921ade","#b6c4cc","#171c23",false],
["nir","Desert Shadow","Nature","NIR HIMI","https://unsplash.com/photos/dark-sand-dunes-under-a-hazy-sky-Nl8huOhdcQA","photo-1772289093079-2778f6d8ece4","#b6a294","#272126",false],
["royce","White Dunes","Nature","Royce Fonseca","https://unsplash.com/photos/soft-white-sand-dunes-under-a-pale-sky-2gyUzlvTuRM","photo-1765498069277-dc9bc08b54ea","#d1c7b2","#e5e0d7",true],
["viktoriia","Misty Mountains","Nature","Viktoriia Ananeva","https://unsplash.com/photos/dark-moody-mountain-landscape-shrouded-in-mist-Bp3QHODgRNs","photo-1762878099772-4ba09dfdc9aa","#8095a3","#15242c",false],
["vlad","Still Water","Monochrome","Vlad Zaytsev","https://unsplash.com/photos/calm-water-surface-with-two-dark-structures-T47J5syBYt8","photo-1773982055669-b537fd6d010c","#a4adb3","#222a30",false],
["mario","Desert Horizon","Nature","Mario Dominguez","https://unsplash.com/photos/desert-sand-dunes-under-a-gradient-blue-sky-RvTRcfVm4Rw","photo-1769536426519-615007af6f7a","#9fb1be","#182a3c",false]
].map(([slug,name,category,author,page,photo,accent,base,light])=>({id:"photo-"+slug,name,category,author,page,photo,accent,base,light}));
const groups=["Featured","Architecture","Nature","Monochrome"],featured=["photo-lloyd","photo-annie","photo-nir","photo-harrison"];
const byId=id=>photos.find(p=>p.id===id);
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const url=(p,width,q=84,height=0)=>"https://images.unsplash.com/"+p.photo+"?auto=format&fit=crop&crop=entropy&w="+width+(height?"&h="+height:"")+"&q="+q;
const storageKey=theme=>"ad_minimal_gallery_v1_"+theme;
const image=document.createElement("img");
image.id="minimalGalleryWallpaperImage";image.alt="";image.crossOrigin="anonymous";image.decoding="async";image.hidden=true;stage.append(image);
const style=document.createElement("style");
style.textContent=[
"#minimalGalleryWallpaperImage[hidden]{display:none!important}",
"#minimalGalleryWallpaperImage{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:4;pointer-events:none}",
"body[data-minimal-wallpaper] #wallpaperStage .wallpaper-image{opacity:0!important}",
"body[data-minimal-wallpaper][data-home-page=home] #wallpaperStage::after{background:transparent!important}",
"body[data-minimal-wallpaper][data-home-page=apps] #wallpaperStage::after{content:'';position:absolute;inset:0;z-index:8!important;background:rgba(8,14,21,.84)!important}",
"body[data-minimal-wallpaper] #wallpaperEffect,body[data-minimal-wallpaper] #audioArtworkImage{display:none!important}",
"#minimalGalleryStudio{margin:10px 0 14px;padding:12px;border:1px solid var(--ds-line,#435448);border-radius:14px;background:var(--ds-panel,#222e26);color:var(--ds-text,#f4f4f4)}",
"#minimalGalleryStudio h3{margin:0 0 4px;font:650 16px system-ui,sans-serif}",
"#minimalGalleryStudio .studio-caption{font:12px/1.45 system-ui,sans-serif;opacity:.82;margin:0 0 10px}",
"#minimalGalleryFilters{display:flex;overflow-x:auto;scrollbar-width:none;gap:7px;padding:2px 0 10px}",
"#minimalGalleryFilters button{white-space:nowrap;flex:0 0 auto;border:1px solid var(--ds-line,#455c49);background:var(--ds-panel2,#304438);color:var(--ds-text,#fff);border-radius:32px;min-height:40px;padding:8px 12px;font:600 12px system-ui,sans-serif}",
"#minimalGalleryFilters button[aria-pressed=true]{border-color:var(--ds-accent,#b9ddc0);background:var(--ds-accent,#b9ddc0);color:var(--ds-accent-ink,#16281b)}",
"#minimalGalleryGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:4px 0 10px}",
"#minimalGalleryGrid .minimal-gallery-entry{display:flex;flex-direction:column;min-width:0;gap:4px;padding:5px!important;border:1px solid var(--ds-line,#4d6555)!important;border-radius:12px!important;background:var(--ds-panel2,#26362e)!important;color:var(--ds-text,#fff)!important;text-align:left!important;box-shadow:none!important}",
"#minimalGalleryGrid .minimal-gallery-photo{position:relative;display:block;width:100%;height:145px;border-radius:8px;overflow:hidden;background:#202826}",
"#minimalGalleryGrid .minimal-gallery-photo img{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover}",
"#minimalGalleryGrid .minimal-gallery-photo .minimal-gallery-unavailable{position:absolute;inset:0;display:none;place-items:center;padding:12px;text-align:center;color:var(--ds-muted,#c8d2cc);font:11px/1.45 system-ui,sans-serif}",
"#minimalGalleryGrid .minimal-gallery-photo img[data-failed=true]{display:none}",
"#minimalGalleryGrid .minimal-gallery-photo img[data-failed=true]+.minimal-gallery-unavailable{display:grid}",
"#minimalGalleryGrid .minimal-gallery-entry strong{font:600 12px/1.25 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:2px 3px 0}",
"#minimalGalleryGrid .minimal-gallery-entry small{font:11px/1.35 system-ui,sans-serif;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 3px 3px}",
"#minimalGalleryGrid .minimal-gallery-entry[aria-pressed=true]{border-color:var(--ds-accent,#bddfbf)!important}",
"#minimalGalleryPager{display:flex;gap:7px;align-items:center;justify-content:space-between}",
"#minimalGalleryPager button{min-height:40px;border:1px solid var(--ds-line,#526b57);border-radius:9px;background:var(--ds-panel2,#304438);color:var(--ds-text,#fff);padding:8px 12px;font:600 12px system-ui,sans-serif}",
"#minimalGalleryPager button:disabled{opacity:.4}",
"#minimalGalleryCount{font:12px system-ui,sans-serif;opacity:.83;text-align:center;flex:1}",
"#minimalGalleryStatus{margin:10px 0 0;font:11px/1.5 system-ui,sans-serif;opacity:.88}",
"#minimalGalleryStatus a{color:var(--ds-accent,#cce6d0)}",
"#wallpaperMoreOptions{margin:12px 0}",
"#wallpaperMoreOptions>summary{cursor:pointer;border-radius:11px;padding:13px 12px;color:var(--ds-text,#fff);background:var(--ds-panel2,#303d34);font:600 12px system-ui,sans-serif}",
"#wallpaperMoreOptions[open]{border:1px solid var(--ds-line,#536a58);padding:0 8px 10px;border-radius:12px}",
"@media(max-width:350px){#minimalGalleryGrid .minimal-gallery-entry img{height:117px}}"
].join("");
document.head.append(style);
const studio=document.createElement("section");studio.id="minimalGalleryStudio";
studio.innerHTML='<h3>Photographer Collection</h3><p class="studio-caption">Real photographs, real artists · Internet required for first load</p>';
const filters=document.createElement("div");filters.id="minimalGalleryFilters";
const grid=document.createElement("div");grid.id="minimalGalleryGrid";
const pager=document.createElement("div");pager.id="minimalGalleryPager";
pager.innerHTML='<button type="button" id="minimalGalleryPrev">‹ Previous</button><span id="minimalGalleryCount" aria-live="polite"></span><button type="button" id="minimalGalleryNext">Next ›</button>';
const status=document.createElement("p");status.id="minimalGalleryStatus";status.setAttribute("role","status");
studio.append(filters,grid,pager,status);
$("customWallpaperStatus").after(studio);
const more=document.createElement("details");more.id="wallpaperMoreOptions";
more.innerHTML='<summary>More options · Built-in wallpapers and colours</summary>';
const colors=$("themePaletteGrid"),bundled=$("wallpaperGrid"),audio=$("audioWallpaperGrid");
const colorHeading=colors?.previousElementSibling,bundledHeading=bundled?.previousElementSibling,audioHeading=audio?.previousElementSibling;
for(const node of [colorHeading,colors,audioHeading,audio,bundledHeading,bundled])if(node)more.append(node);
studio.after(more);
more.open=launcherTheme!=="orbit";
let category="Featured",page=0,current="",requestId=0;
const pageSize=4;
const list=()=>category==="Featured"?featured.map(byId).filter(Boolean):photos.filter(p=>p.category===category);
function render(){
 if(dialog.hidden)return;
 filters.innerHTML=groups.map(c=>'<button type="button" data-minimal-category="'+c+'" aria-pressed="'+(c===category)+'">'+c+'</button>').join("");
 const available=list(),total=Math.max(1,Math.ceil(available.length/pageSize));
 page=Math.max(0,Math.min(page,total-1));
 grid.innerHTML=available.slice(page*pageSize,(page+1)*pageSize).map(p=>
  '<button type="button" class="minimal-gallery-entry" data-minimal-id="'+p.id+'" aria-pressed="'+(p.id===current)+'" aria-label="Choose '+esc(p.name)+' by '+esc(p.author)+'"><span class="minimal-gallery-photo"><img alt="" loading="lazy" src="'+esc(url(p,480,72,680))+'"><span class="minimal-gallery-unavailable">Preview needs internet</span></span><strong>'+esc(p.name)+'</strong><small>Photo: '+esc(p.author)+'</small></button>').join("");
 $("minimalGalleryCount").textContent=(page+1)+" / "+total+" · "+available.length+" photos";
 $("minimalGalleryPrev").disabled=page===0;$("minimalGalleryNext").disabled=page>=total-1;
}
function clear(persist=true){
 requestId++;current="";image.hidden=true;image.removeAttribute("src");
 delete document.body.dataset.minimalWallpaper;
 if(persist)deskStorage.setItem(storageKey(launcherTheme),"");
 render();
}
function applyAndroid(p,loaded){
 const native=window.AudioDesk,notice=$("wallpaperSystemStatus");
 if(typeof native?.setSystemWallpaperCustom!=="function"){
  notice.textContent="Selected in Audio Desk. Android wallpaper changes require the installed app.";return;
 }
 const request=++systemWallpaperRequest;
 try{
  const canvas=document.createElement("canvas");canvas.width=1440;canvas.height=2560;
  const ctx=canvas.getContext("2d");ctx.fillStyle=p.base;ctx.fillRect(0,0,1440,2560);
  const zoom=Math.max(1440/loaded.naturalWidth,2560/loaded.naturalHeight);
  const w=loaded.naturalWidth*zoom,h=loaded.naturalHeight*zoom;
  ctx.drawImage(loaded,(1440-w)/2,(2560-h)/2,w,h);
  native.setSystemWallpaperCustom(canvas.toDataURL("image/jpeg",.85),50,$("wallpaperApplyLock").checked,request);
  notice.textContent="Applying "+p.name+" to Android Home"+($("wallpaperApplyLock").checked?" and Lock":"")+"…";
 }catch{notice.textContent="Photo preview works, but this image could not be exported to Android."}
}
// Match status-bar and dial contrast to the actual photograph crop, not the
// manually assigned theme or the overall image average. A bright ocean can
// have a dark lower half while its status-bar strip is almost white.
function samplePhotoTone(photo){
 try{
  const width=72,height=Math.max(110,Math.round(72*innerHeight/Math.max(1,innerWidth)));
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  const scale=Math.max(width/photo.naturalWidth,height/photo.naturalHeight);
  const dw=photo.naturalWidth*scale,dh=photo.naturalHeight*scale;
  ctx.drawImage(photo,(width-dw)/2,(height-dh)/2,dw,dh);
  const brightness=(start,length)=>{
   const rgba=ctx.getImageData(0,start,width,length).data;let sum=0,weight=0;
   for(let i=0;i<rgba.length;i+=4){
    const opacity=rgba[i+3]/255;
    sum+=(rgba[i]*.2126+rgba[i+1]*.7152+rgba[i+2]*.0722)*opacity;weight+=opacity;
   }
   return weight?sum/weight:0;
  };
  return {status:brightness(0,Math.max(8,Math.min(24,Math.round(height*.045))))>151,
   body:brightness(Math.round(height*.12),Math.max(8,Math.round(height*.45)))>156};
 }catch{return null}
}
function select(id,persist=true){
 const p=byId(id);if(!p){clear(persist);return}
 const seq=++requestId,themeWhenChosen=launcherTheme;const previous=current;
 current=p.id;status.textContent="Loading "+p.name+" by "+p.author+"…";render();
 const loaded=new Image();loaded.crossOrigin="anonymous";loaded.decoding="async";
 loaded.onload=()=>{
  if(seq!==requestId||launcherTheme!==themeWhenChosen)return;
  image.src=loaded.src;image.hidden=false;
  document.body.dataset.minimalWallpaper=p.id;
  const tone=samplePhotoTone(loaded);
  document.body.dataset.wallpaperLight=String(tone?.body??p.light);
  document.body.dataset.wallpaperStatusLight=String(tone?.status??p.light);
  window.audioDeskSyncWallpaperStatus?.();
  window.audioDeskApplyWallpaperColors?.(p.accent,p.base);
  if(persist)deskStorage.setItem(storageKey(launcherTheme),p.id);
  status.innerHTML='Photo by <strong>'+esc(p.author)+'</strong> on Unsplash · <a href="'+esc(p.page)+'" rel="noopener noreferrer" target="_blank">Photo &amp; license</a>';
  render();if(persist)applyAndroid(p,loaded);
 };
 loaded.onerror=()=>{
  if(seq!==requestId||launcherTheme!==themeWhenChosen)return;current=previous;
  status.textContent="Could not load this photograph. Check your connection; your previous wallpaper is unchanged.";render();
 };
 loaded.src=url(p,1440,86,2560);
}
filters.addEventListener("click",e=>{const c=e.target.closest("[data-minimal-category]")?.dataset.minimalCategory;
 if(!groups.includes(c))return;category=c;page=0;render()});
$("minimalGalleryPrev").onclick=()=>{page--;render()};
$("minimalGalleryNext").onclick=()=>{page++;render()};
grid.addEventListener("error",e=>{if(e.target.matches?.("img"))e.target.dataset.failed="true"},true);
grid.addEventListener("click",e=>{const id=e.target.closest("[data-minimal-id]")?.dataset.minimalId;
 if(byId(id)){window.audioDeskClearAudioWallpaper?.();select(id)}});
for(const id of ["themePaletteGrid","wallpaperGrid","audioWallpaperGrid","customWallpaperRestore"]){
 $(id)?.addEventListener("click",e=>{
  if(id==="themePaletteGrid"&&!e.target.closest("[data-palette]"))return;
  if(id==="wallpaperGrid"&&!e.target.closest("[data-wallpaper]"))return;
  if(id==="audioWallpaperGrid"&&!e.target.closest("[data-audio-art]"))return;
  clear();
 },true);
}
$("customWallpaperFile")?.addEventListener("change",e=>{if(e.target.files?.length)clear()});
const baseApply=applySystemWallpaper;
applySystemWallpaper=function(){
 const p=byId(current);if(!p)return baseApply();
 if(image.complete&&image.naturalWidth){applyAndroid(p,image);return}
 $("wallpaperSystemStatus").textContent="The selected photograph is loading. Check your connection and retry.";
};
$("wallpaperApplySystem").onclick=()=>applySystemWallpaper();
const baseTheme=setLauncherTheme;
setLauncherTheme=function(theme){baseTheme(theme);more.open=theme!=="orbit";select(deskStorage.getItem(storageKey(theme))||"",false)};
const basePicker=renderWallpaperPicker;
renderWallpaperPicker=function(){basePicker();more.open=launcherTheme!=="orbit";render()};
new MutationObserver(()=>{if(!dialog.hidden)render()}).observe(dialog,{attributes:true,attributeFilter:["hidden"]});
const saved=deskStorage.getItem(storageKey(launcherTheme))||"";
if(byId(saved))select(saved,false);
else if(saved.startsWith("mg-"))deskStorage.setItem(storageKey(launcherTheme),"");
window.audioDeskMinimalGalleryCount=()=>photos.length;
window.audioDeskStudioGallery=()=>({count:photos.length,collections:groups.slice(),pageSize,credited:photos.every(p=>p.author&&p.page&&p.photo)});
})();
