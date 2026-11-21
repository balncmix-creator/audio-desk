/* Audio Desk Minimal Gallery: 180 original SVG wallpapers, generated on demand.
   15 original compositions x 12 original color palettes, offline and resolution-independent. */
(()=>{
"use strict";
const byId=id=>document.getElementById(id);
const stage=byId("wallpaperStage"),dialog=byId("launcherWallpaperDialog");
if(!stage||!dialog)return;
const palettes=[
["obsidian","Obsidian","#0a1011","#243235","#b4d0c4",false],
["graphite","Graphite","#181b20","#444d57","#c0c8d2",false],
["ivory","Ivory","#f2ede4","#d8d0c2","#59626c",true],
["sand","Warm Sand","#ead7bd","#cdb49b","#816958",true],
["rose","Muted Rose","#e8d7d9","#be9eac","#855b68",true],
["sage","Soft Sage","#d9e4d8","#9db6a8","#557b6c",true],
["forest","Forest","#0d1c18","#24483c","#a2d5b2",false],
["navy","Midnight Blue","#0a1627","#223e60","#7cb4ed",false],
["indigo","Indigo","#151b36","#434b80","#b0b9f5",false],
["copper","Copper","#2b1c1b","#754638","#efbc85",false],
["teal","Sea Glass","#102c31","#2b6771","#91d7d6",false],
["lavender","Lavender","#e0dbe9","#a89ac4","#655a89",true]];
const patterns=[
["Still Horizon","Nature","horizon"],["Silent Monolith","Geometric","monolith"],
["Concentric Calm","Geometric","rings"],["Infinite Arc","Geometric","arcs"],
["Volume Study","Audio","bars"],["Slow Frequency","Audio","frequency"],
["Dune Layers","Nature","dunes"],["Quiet Staircase","Geometric","steps"],
["Orbital Study","Geometric","orbits"],["Star Field","Nature","stars"],
["Pixel Valley","Pixel","pixels"],["Gentle Strata","Nature","strata"],
["Prism Silence","Geometric","prism"],["Moonrise","Nature","moon"],
["Grid Garden","Pixel","grid"]];
const artworks=patterns.flatMap((pattern,i)=>palettes.map((palette,j)=>({
id:"mg-"+pattern[2]+"-"+palette[0],name:pattern[0]+" · "+palette[1],
pattern:pattern[2],category:pattern[1],palette,light:palette[5],sort:i*12+j
})));
const enc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const n=x=>Number(x).toFixed(1);
const key=theme=>"ad_minimal_gallery_v1_"+theme;
const find=id=>artworks.find(a=>a.id===id);
function illustration(x){
 const k=x.pattern,base=x.palette[2],mid=x.palette[3],accent=x.palette[4];
 let v="";
 if(k==="horizon")v='<circle cx="540" cy="1040" r="280" fill="'+accent+'" opacity=".17"/><path d="M0 1075H1080" stroke="'+accent+'" stroke-width="3" opacity=".5"/><path d="M0 1078H1080V1920H0Z" fill="'+mid+'" opacity=".4"/><circle cx="520" cy="1070" r="140" fill="'+accent+'" opacity=".28"/>';
 else if(k==="monolith")v='<path d="M310 370L705 300L750 1710L275 1740Z" fill="'+mid+'" opacity=".48"/><path d="M550 350L705 300L750 1710L595 1700Z" fill="'+accent+'" opacity=".16"/>';
 else if(k==="rings")for(let i=0;i<18;i++)v+='<circle cx="725" cy="970" r="'+(100+i*34)+'" fill="none" stroke="'+accent+'" stroke-width="'+(i%4?1.5:4)+'" opacity="'+n(.09+.017*(i%6))+'"/>';
 else if(k==="arcs")for(let i=0;i<18;i++)v+='<path d="M'+(-115-i*8)+' '+(1100+i*16)+' A'+(620+i*26)+' '+(620+i*26)+' 0 0 1 '+(1100+i*8)+' '+(315+i*5)+'" fill="none" stroke="'+accent+'" stroke-width="'+(i%5?2:5)+'" opacity="'+n(.12+.013*(i%5))+'"/>';
 else if(k==="bars")for(let i=0;i<44;i++){const h=36+220*Math.abs(Math.sin(i*.47)*Math.cos(i*.16))+170*Math.exp(-Math.pow((i-24)/11,2));v+='<rect x="'+n(i*25.5-7)+'" y="'+n(1130-h/2)+'" width="10" height="'+n(h)+'" rx="4" fill="'+accent+'" opacity="'+n(.15+.42*Math.abs(Math.sin(i*.13)))+'"/>'}
 else if(k==="frequency")for(let j=0;j<22;j++){let d="";for(let i=-40;i<=1120;i+=24){const y=1070+Math.sin(i*.009+j*.16)*95+Math.cos(i*.004+j*.22)*105+(j-11)*13;d+=(i===-40?"M":"L")+i+","+n(y)+" "}v+='<path d="'+d+'" stroke="'+accent+'" stroke-width="'+(j===11?3:1.6)+'" opacity="'+n(.08+.32*(1-Math.abs(j-11)/11))+'" fill="none"/>'}
 else if(k==="dunes")for(let j=0;j<8;j++){const y=950+j*115;v+='<path d="M-90 '+n(y+130)+'Q260 '+n(y-240)+' 580 '+n(y+45)+'T1180 '+n(y-70)+'L1180 2000H-90Z" fill="'+(j%2?mid:accent)+'" opacity="'+n(.07+j*.024)+'"/>'}
 else if(k==="steps")for(let j=0;j<10;j++)v+='<rect x="'+(115+j*61)+'" y="'+(470+j*99)+'" width="'+(800-j*67)+'" height="'+(1300-j*80)+'" rx="2" fill="none" stroke="'+accent+'" stroke-width="'+(j%3?2:5)+'" opacity="'+n(.11+j*.016)+'"/>';
 else if(k==="orbits"){for(let j=0;j<13;j++)v+='<ellipse cx="620" cy="980" rx="'+(190+j*28)+'" ry="'+(80+j*20)+'" transform="rotate('+(j*15)+' 620 980)" fill="none" stroke="'+accent+'" stroke-width="2" opacity="'+n(.12+.013*j)+'"/>';v+='<circle cx="620" cy="980" r="85" fill="'+accent+'" opacity=".20"/>'}
 else if(k==="stars"){for(let j=0;j<132;j++)v+='<circle cx="'+n((j*317.71+79)%1080)+'" cy="'+n((j*557.17+143)%1920)+'" r="'+(j%19===0?3.6:1.4)+'" fill="'+accent+'" opacity="'+n(.12+((j*11)%19)*.022)+'"/>';v+='<circle cx="740" cy="490" r="165" fill="none" stroke="'+accent+'" opacity=".22" stroke-width="2"/>'}
 else if(k==="pixels")for(let j=0;j<35;j++)for(let m=0;m<16;m++){if(m<Math.sin(j*.31)*3+Math.cos(j*.17)*3+7)continue;v+='<rect x="'+(j*34-4)+'" y="'+(1120+m*35)+'" width="32" height="33" fill="'+(m%3?mid:accent)+'" opacity="'+n(.09+.019*m)+'"/>'}
 else if(k==="strata")for(let j=0;j<24;j++){const y=690+j*33;v+='<path d="M-20 '+n(y)+'Q250 '+n(y+Math.sin(j*.57)*160)+' 580 '+n(y-80*Math.cos(j*.46))+'T1100 '+n(y+Math.cos(j*.31)*90)+'" fill="none" stroke="'+accent+'" stroke-width="'+(j%6?1.4:4)+'" opacity="'+n(.10+.012*j)+'"/>'}
 else if(k==="prism")v='<path d="M540 235L980 1060L520 1620L120 1110Z" fill="'+mid+'" opacity=".43"/><path d="M540 235L980 1060L520 1620Z" fill="'+accent+'" opacity=".19"/><path d="M540 235L520 1620L120 1110Z" fill="none" stroke="'+accent+'" opacity=".45" stroke-width="4"/>';
 else if(k==="moon")v='<circle cx="660" cy="650" r="215" fill="'+accent+'" opacity=".46"/><circle cx="750" cy="572" r="217" fill="'+base+'"/><path d="M0 1400Q400 1250 1080 1400V1920H0Z" fill="'+mid+'" opacity=".43"/>';
 else if(k==="grid"){for(let j=0;j<22;j++)v+='<path d="M'+(j*55-20)+' 160V1810M0 '+(j*76+160)+'H1080" stroke="'+accent+'" stroke-width="1.5" opacity=".17"/>';v+='<rect x="310" y="675" width="460" height="460" rx="8" fill="'+mid+'" opacity=".32"/><circle cx="540" cy="905" r="146" fill="none" stroke="'+accent+'" opacity=".42" stroke-width="5"/>'}
 return v;
}
function svg(x){
 const p=x.palette;
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">'+
 '<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+p[2]+'"/><stop offset=".64" stop-color="'+p[3]+'"/><stop offset="1" stop-color="'+p[2]+'"/></linearGradient><radialGradient id="g"><stop stop-color="'+p[4]+'" stop-opacity=".12"/><stop offset="1" stop-color="'+p[4]+'" stop-opacity="0"/></radialGradient></defs>'+
 '<rect width="1080" height="1920" fill="url(#b)"/><ellipse cx="800" cy="840" rx="720" ry="840" fill="url(#g)"/>'+illustration(x)+'</svg>';
}
const src=x=>"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg(x));
const image=document.createElement("img");image.id="minimalGalleryWallpaperImage";image.alt="";image.decoding="async";image.setAttribute("aria-hidden","true");image.hidden=true;stage.append(image);
const css=document.createElement("style");css.textContent=
 '#minimalGalleryWallpaperImage[hidden]{display:none!important}#minimalGalleryWallpaperImage{position:absolute;z-index:4;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}'+
 'body[data-minimal-wallpaper] #wallpaperStage .wallpaper-image{opacity:0!important}body[data-minimal-wallpaper] #wallpaperStage::after{background:transparent!important}body[data-minimal-wallpaper] #wallpaperEffect,body[data-minimal-wallpaper] #audioArtworkImage{display:none!important}'+
 '#minimalGalleryGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0}.minimal-gallery-entry{display:flex;flex-direction:column;gap:6px;min-width:0;padding:6px!important;border:2px solid var(--ds-line,#444)!important;border-radius:var(--ds-radius,12px)!important;background:var(--ds-panel2,#252a28)!important;color:var(--ds-text,#fff)!important;font:500 11px/1.2 system-ui,sans-serif!important;box-shadow:none!important;text-align:left!important}'+
 '.minimal-gallery-entry img{display:block;width:100%;height:140px;object-fit:cover;border-radius:8px;background:#29322b}.minimal-gallery-entry span{padding:0 2px 2px}.minimal-gallery-entry[aria-pressed="true"]{border-color:var(--ds-accent,#b9dec0)!important;outline:1px solid var(--ds-accent,#b9dec0)}'+
 '#minimalGalleryFilters{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 10px}#minimalGalleryFilters button,#minimalGalleryMore{font:500 11px system-ui,sans-serif;color:var(--ds-text,#fff);padding:9px 11px;border:1px solid var(--ds-line,#657063);border-radius:9px;background:var(--ds-panel2,#333)}#minimalGalleryFilters button[aria-pressed="true"]{border-color:var(--ds-accent,#b9dec0);font-weight:700}#minimalGalleryMore{width:100%;margin:5px 0 15px}#minimalGalleryCount{font-size:11px;opacity:.78}';document.head.append(css);
const heading=document.createElement("div");heading.className="theme-wallpaper-heading";heading.innerHTML='<strong>Minimal Gallery · 180 wallpapers</strong><small>Original, offline, high-resolution vectors</small>';
const filters=document.createElement("div");filters.id="minimalGalleryFilters";filters.setAttribute("aria-label","Wallpaper collection filters");
const counter=document.createElement("div");counter.id="minimalGalleryCount";
const grid=document.createElement("div");grid.id="minimalGalleryGrid";grid.setAttribute("role","group");grid.setAttribute("aria-label","180 minimalist wallpapers");
const more=document.createElement("button");more.id="minimalGalleryMore";more.type="button";more.textContent="Show more wallpapers";
const anchor=byId("audioWallpaperGrid")||byId("wallpaperGrid");
anchor.after(heading,filters,counter,grid,more);
const categories=["All","Dark","Light","Geometric","Nature","Audio","Pixel"];
let category="All",shown=12,current="";
const filtered=()=>artworks.filter(x=>category==="All"||category==="Dark"&&!x.light||category==="Light"&&x.light||x.category===category);
function render(){
 if(dialog.hidden)return;
 filters.innerHTML=categories.map(c=>'<button type="button" data-minimal-category="'+c+'" aria-pressed="'+(c===category)+'">'+c+'</button>').join("");
 const list=filtered();counter.textContent=list.length+" wallpapers · "+Math.min(shown,list.length)+" shown";
 grid.innerHTML=list.slice(0,shown).map(x=>'<button type="button" class="minimal-gallery-entry" data-minimal-id="'+x.id+'" aria-pressed="'+(x.id===current)+'"><img loading="lazy" decoding="async" alt="" src="'+enc(src(x))+'"><span>'+enc(x.name)+'</span></button>').join("");
 more.hidden=shown>=list.length;
}
function select(id,persist=true){
 const art=find(id);current=art?.id||"";
 if(persist)deskStorage.setItem(key(launcherTheme),current);
 if(!art){image.hidden=true;image.removeAttribute("src");delete document.body.dataset.minimalWallpaper;render();return}
 image.src=src(art);image.hidden=false;document.body.dataset.minimalWallpaper=art.id;
 document.body.dataset.wallpaperLight=String(art.light);document.body.dataset.wallpaperStatusLight=String(art.light);
 window.audioDeskApplyWallpaperColors?.(art.palette[4],art.palette[2]);render();
}
function clear(){if(current)select("")}
function applyAndroid(){
 const art=find(current);if(!art)return false;
 const api=window.AudioDesk,status=byId("wallpaperSystemStatus");
 if(typeof api?.setSystemWallpaperCustom!=="function"){status.textContent="Saved in Audio Desk. Applying Android wallpaper requires the installed APK.";return true}
 const request=++systemWallpaperRequest,img=new Image();
 img.onload=()=>{
  if(request!==systemWallpaperRequest)return;
  try{
   const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1920;
   canvas.getContext("2d").drawImage(img,0,0,1080,1920);
   api.setSystemWallpaperCustom(canvas.toDataURL("image/jpeg",.91),50,byId("wallpaperApplyLock").checked,request);
   status.textContent="Applying 1080 × 1920 Minimal Gallery wallpaper to Android…";
  }catch{status.textContent="Unable to export this wallpaper."}
 };
 img.onerror=()=>{status.textContent="Unable to decode the selected wallpaper."};img.src=src(art);
 return true;
}
filters.addEventListener("click",e=>{
 const cat=e.target.closest("[data-minimal-category]")?.dataset.minimalCategory;
 if(!categories.includes(cat))return;category=cat;shown=12;render();
});
more.addEventListener("click",()=>{shown+=12;render()});
grid.addEventListener("click",e=>{
 const id=e.target.closest("[data-minimal-id]")?.dataset.minimalId;
 if(!find(id))return;
 window.audioDeskClearAudioWallpaper?.();
 select(id);applyAndroid();
});
for(const id of ["themePaletteGrid","wallpaperGrid","audioWallpaperGrid","customWallpaperRestore"]){
 byId(id)?.addEventListener("click",e=>{
  if(id==="themePaletteGrid"&&!e.target.closest("[data-palette]"))return;
  if(id==="wallpaperGrid"&&!e.target.closest("[data-wallpaper]"))return;
  if(id==="audioWallpaperGrid"&&!e.target.closest("[data-audio-art]"))return;
  clear();
 },true);
}
byId("customWallpaperFile").addEventListener("change",e=>{if(e.target.files?.length)clear()});
const baseApply=applySystemWallpaper;
applySystemWallpaper=function(){return current?applyAndroid():baseApply()};
byId("wallpaperApplySystem").onclick=()=>applySystemWallpaper();
const baseTheme=setLauncherTheme;
setLauncherTheme=function(theme){baseTheme(theme);select(deskStorage.getItem(key(theme))||"",false)};
const basePicker=renderWallpaperPicker;
renderWallpaperPicker=function(){basePicker();render()};
new MutationObserver(()=>{if(!dialog.hidden)render()}).observe(dialog,{attributes:true,attributeFilter:["hidden"]});
select(deskStorage.getItem(key(launcherTheme))||"",false);
window.audioDeskMinimalGalleryCount=()=>artworks.length;
})();
