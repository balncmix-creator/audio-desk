/* 16 original vector audio wallpapers: four pieces designed independently
   for each launcher theme. SVG is resolution independent; Android is served
   1080x1920 JPEG only on explicit selection. No external stock images. */
(()=>{
"use strict";
const byId=id=>document.getElementById(id);
const artworks={
 orbit:[["orbit-vinyl","Forest Orbit","#101211","#35483c","#c5e0c8","vinyl"],["orbit-signal","Midnight Signal","#101621","#283d56","#a8c8f2","wave"],["orbit-graphite","Graphite Studio","#111315","#353b42","#d1d7de","ribbons"],["orbit-amber","Amber Frequency","#171410","#493a26","#e6c89a","bars"]],
 minimal:[
  ["mono-wave","Monochrome Wave","#080b0e","#3f4850","#dee3e6","wave"],
  ["quiet-spectrum","Quiet Spectrum","#121516","#33383b","#bfc5c7","bars"],
  ["studio-curves","Studio Curves","#1b1d20","#41474b","#c2c9c9","ribbons"],
  ["dark-vinyl","Dark Vinyl","#080a0b","#293033","#adb6ba","vinyl"]
 ],
 pixel:[
  ["pixel-night","Pixel Night Studio","#101025","#362455","#bd8bfa","studio"],
  ["pixel-levels","8-Bit Levels","#060e1d","#172b49","#69c5e5","pixels"],
  ["pixel-cassette","Pixel Cassette","#160f21","#4f3155","#e9afd5","cassette"],
  ["pixel-pulse","Arcade Pulse","#080e12","#1b453e","#8df2b1","pixels"]
 ],
 windows:[
  ["metro-frequency","Metro Frequency","#05172e","#104b7b","#35c0fc","metro"],
  ["blue-spectrum","Blue Spectrum","#071529","#14385c","#75d1ff","bars"],
  ["teal-wave","Teal Signal","#08272d","#1b5960","#77e0d9","metro"],
  ["indigo-pulse","Indigo Pulse","#121627","#37446d","#a0b9ff","wave"]
 ],
 warm:[
  ["warm-vinyl","Analog Vinyl","#171416","#554548","#ddaaa6","vinyl"],
  ["grey-frequency","Grey Frequency","#252629","#5e6266","#d5cfca","wave"],
  ["tape-blush","Blush Tape","#35292c","#80666a","#efc6bc","cassette"],
  ["warm-flow","Soft Analog Flow","#1f1d20","#6b555a","#efc4b5","ribbons"]
 ]
};
const themeStorage=theme=>"ad_audio_wallpaper_v1_"+theme;
const available=()=>artworks[launcherTheme]||[];
const chosen=id=>available().find(a=>a[0]===id);
let currentId="",pending=0,svgUrl="";
const xml=s=>s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
function levels(accent,baseY=1020){
 let out="";
 for(let i=0;i<65;i++){
  const height=18+Math.abs(Math.sin(i*.29)*Math.cos(i*.41)+Math.sin(i*.13))*120+
   160*Math.exp(-Math.pow((i-32)/13,2));
  const x=70+i*14.7;
  out+='<rect x="'+x.toFixed(1)+'" y="'+(baseY-height/2).toFixed(1)+'" width="7.6" height="'+height.toFixed(1)+'" fill="'+accent+'" opacity="'+(.16+.6*Math.abs(Math.sin(i*.19))).toFixed(2)+'"/>';
 }
 return out;
}
function wavePaths(accent){
 let out="";
 for(let n=0;n<21;n++){
  let d="";
  for(let x=-90;x<=1160;x+=12){
   const y=1040+Math.sin(x*.009+n*.15)*90+
    Math.sin(x*.005+n*.19)*110+Math.sin(x*.018+n*.21)*37+(n-10)*7;
   d+=(x===-90?"M":"L")+x+" "+y.toFixed(1)+" ";
  }
  out+='<path d="'+d+'" fill="none" stroke="'+accent+'" stroke-width="'+(n===10?2.3:1.05)+'" opacity="'+(.12+(.54-Math.abs(n-10)*.04)).toFixed(2)+'"/>';
 }
 return out;
}
function vinyl(accent){
 let out="";
 for(let i=0;i<54;i++){
  const r=150+i*10;
  out+='<circle cx="1030" cy="650" r="'+r+'" fill="none" stroke="'+accent+
   '" stroke-width="'+(i%8===0?2.4:1.05)+'" opacity="'+(.11+((i%7)*.016)).toFixed(2)+'"/>';
 }
 out+='<circle cx="1030" cy="650" r="190" fill="#090b0d" opacity=".85"/>'+
 '<circle cx="1030" cy="650" r="145" fill="'+accent+'" opacity=".55"/>'+
 '<circle cx="1030" cy="650" r="9" fill="#161318"/>';
 return out+wavePaths(accent);
}
function pixelStudio(accent){
 let out='<g shape-rendering="crispEdges">';
 for(let i=0;i<47;i++){
  const h=30+Math.round((Math.sin(i*.72)+1)*32),x=i*26;
  out+='<rect x="'+x+'" y="'+(1600-h*2)+'" width="22" height="'+h*2+'" fill="'+accent+'" opacity=".13"/>';
 }
 out+='<rect x="125" y="950" width="830" height="450" fill="#191627" stroke="'+accent+'" stroke-width="8" opacity=".9"/>'+
 '<rect x="164" y="1000" width="752" height="295" fill="#0b1022" stroke="'+accent+'" stroke-width="7"/>'+
 levels(accent,1142)+
 '<rect x="70" y="1450" width="940" height="60" fill="'+accent+'" opacity=".21"/>';
 for(let x of [140,770]){
  out+='<rect x="'+x+'" y="730" width="160" height="180" fill="#141326" stroke="'+accent+'" stroke-width="7"/>'+
  '<circle cx="'+(x+80)+'" cy="832" r="46" fill="#0b0b14" stroke="'+accent+'" stroke-width="7"/>';
 }
 return out+"</g>";
}
function cassette(accent){
 let out='<g stroke="'+accent+'" stroke-width="7" fill="none">';
 out+='<rect x="155" y="750" width="770" height="482" rx="19" fill="#111016" fill-opacity=".43"/>'+
 '<rect x="222" y="824" width="640" height="236" rx="15" fill="'+accent+'" fill-opacity=".06"/>';
 for(const x of [368,714]){
  out+='<circle cx="'+x+'" cy="941" r="79"/><circle cx="'+x+'" cy="941" r="23"/>';
  for(let n=0;n<10;n++){
   const a=n*Math.PI/5;out+='<path d="M'+(x+35*Math.cos(a)).toFixed(1)+' '+(941+35*Math.sin(a)).toFixed(1)+
   'L'+(x+65*Math.cos(a)).toFixed(1)+' '+(941+65*Math.sin(a)).toFixed(1)+'"/>';
  }
 }
 return out+'<path d="M278 1178h530"/><path d="M418 1068h260"/></g>';
}
function metro(accent){
 let out='<g shape-rendering="geometricPrecision">';
 const tiles=[[570,210,420,330],[105,550,420,420],[570,580,420,370],[105,1020,420,350],[570,1010,420,400]];
 for(const [x,y,w,h] of tiles){
  out+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+accent+'" opacity=".09"/>'+
   '<path d="M'+x+' '+(y+h)+'V'+y+'H'+(x+w)+'" stroke="'+accent+'" stroke-width="1.4" opacity=".42" fill="none"/>';
 }
 return out+levels(accent,1010)+'</g>';
}
function artworkSvg(p){
 const [id,name,dark,mid,accent,design]=p;
 const bars=levels(accent),waves=wavePaths(accent);
 const visual=design==="wave"?waves+bars:
  design==="bars"?bars+waves:
  design==="ribbons"?waves+wavePaths(mid)+levels(accent,1540):
  design==="vinyl"?vinyl(accent):
  design==="studio"?pixelStudio(accent):
  design==="cassette"?cassette(accent):
  design==="metro"?metro(accent):bars;
 const grid=launcherTheme==="pixel"?
  '<path d="M0 1320H1080M0 1600H1080" stroke="'+accent+'" opacity=".1" stroke-width="3"/>':"";
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">'+
  '<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+dark+'"/>'+
  '<stop offset=".72" stop-color="'+mid+'"/><stop offset="1" stop-color="'+dark+'"/></linearGradient>'+
  '<radialGradient id="a"><stop stop-color="'+accent+'" stop-opacity=".17"/>'+
  '<stop offset="1" stop-color="'+accent+'" stop-opacity="0"/></radialGradient></defs>'+
  '<rect width="1080" height="1920" fill="url(#b)"/>'+
  '<ellipse cx="810" cy="450" rx="710" ry="680" fill="url(#a)"/>'+grid+visual+
  '<rect width="1080" height="1920" fill="none" stroke="'+accent+'" opacity=".07" stroke-width="3"/>'+
  '</svg>';
}
function svgData(p){return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(artworkSvg(p))}
const artworkImg=document.createElement("img");
artworkImg.id="audioArtworkImage";artworkImg.alt="";artworkImg.decoding="async";
artworkImg.setAttribute("aria-hidden","true");
byId("wallpaperStage").appendChild(artworkImg);
function renderActive(id){
 const art=chosen(id);
 currentId=art?art[0]:"";
 if(art){
  document.body.dataset.audioWallpaper=art[0];
  artworkImg.src=svgData(art);
  artworkImg.hidden=false;
  // Audio SVGs are vector sharp at every Android screen density.
  document.body.dataset.wallpaperLight="false";
  document.body.dataset.wallpaperStatusLight="false";
   window.audioDeskApplyWallpaperColors?.(art[4],art[2]);
 }else{
  delete document.body.dataset.audioWallpaper;
  artworkImg.hidden=true;artworkImg.removeAttribute("src");
  window.audioDeskRefreshWallpaperColors?.();
 }
 renderChoices();
}
function saveSelected(id){
 deskStorage.setItem(themeStorage(launcherTheme),id||"");
 renderActive(id);
}
function switchArt(theme){
 const id=deskStorage.getItem(themeStorage(theme))||"";
 renderActive(id);
}
const grid=document.createElement("div");
grid.id="audioWallpaperGrid";grid.className="theme-palette-grid audio-wallpaper-grid";
grid.setAttribute("role","group");grid.setAttribute("aria-label","Audio-inspired wallpapers");
const heading=document.createElement("div");
heading.className="theme-wallpaper-heading";
heading.innerHTML='<strong>Audio wallpapers</strong><small>Four originals for this theme</small>';
byId("wallpaperGrid").before(heading,grid);
function renderChoices(){
 // Skip expensive SVG thumbnail work until the actual picker is on screen.
 if(byId("launcherWallpaperDialog").hidden)return;
 grid.innerHTML=available().map(p=>
  '<button type="button" class="audio-art-choice" data-audio-art="'+p[0]+'" aria-pressed="'+
  (p[0]===currentId)+'"><img loading="lazy" alt="" src="'+xml(svgData(p))+'">'+
  '<strong>'+xml(p[1])+'</strong></button>').join("");
}
function applyAndroidAudio(){
 const p=chosen(currentId);
 if(!p)return null;
 const native=window.AudioDesk;
 if(typeof native?.setSystemWallpaperCustom!=="function"){
  byId("wallpaperSystemStatus").textContent="Saved in Audio Desk; Android wallpaper application requires the installed APK.";
  return null;
 }
 const request=++systemWallpaperRequest;
 const image=new Image();
 image.onload=()=>{
  if(request!==systemWallpaperRequest)return;
  try{
   const canvas=document.createElement("canvas");
   canvas.width=1080;canvas.height=1920;
   canvas.getContext("2d").drawImage(image,0,0,1080,1920);
   const data=canvas.toDataURL("image/jpeg",.91);
   native.setSystemWallpaperCustom(data,50,byId("wallpaperApplyLock").checked,request);
   byId("wallpaperSystemStatus").textContent="Applying sharp 1080 × 1920 audio wallpaper to Android…";
  }catch(e){byId("wallpaperSystemStatus").textContent="Wallpaper export failed. Try a different option."}
 };
 image.onerror=()=>{byId("wallpaperSystemStatus").textContent="Audio artwork could not be decoded."};
 image.src=svgData(p);
 return request;
}
grid.addEventListener("click",e=>{
 const id=e.target.closest("[data-audio-art]")?.dataset.audioArt;
 if(!chosen(id))return;
 saveSelected(id);
 applyAndroidAudio();
});
const baseRender=renderWallpaperPicker;
renderWallpaperPicker=function(){baseRender();renderChoices()};
const baseSet=setLauncherTheme;
setLauncherTheme=function(theme){
 baseSet(theme);
 switchArt(theme);
};
const baseApply=applySystemWallpaper;
applySystemWallpaper=function(){
 if(currentId)return applyAndroidAudio();
 return baseApply();
};
byId("wallpaperApplySystem").onclick=()=>applySystemWallpaper();
for(const id of ["themePaletteGrid","wallpaperGrid","customWallpaperRestore"]){
 byId(id).addEventListener("click",e=>{
  if(id==="themePaletteGrid"&&!e.target.closest("[data-palette]"))return;
  if(id==="wallpaperGrid"&&!e.target.closest("[data-wallpaper]"))return;
  saveSelected("");
 },true);
}
byId("customWallpaperFile").addEventListener("change",e=>{
 if(e.target.files?.length)saveSelected("");
},true);
new MutationObserver(()=>{
 if(!byId("launcherWallpaperDialog").hidden)renderChoices();
}).observe(byId("launcherWallpaperDialog"),{attributes:true,attributeFilter:["hidden"]});
switchArt(launcherTheme);
})();
