/* Audio Desk Studio Wallpapers — a curated gallery of 42 original designs.
   Offline, vector-sharp, with four previews per page. No scraped, copyrighted packs. */
(()=>{
"use strict";
const byId=id=>document.getElementById(id);
const stage=byId("wallpaperStage"),dialog=byId("launcherWallpaperDialog");
if(!stage||!dialog)return;
const P=[
 // Each palette has its own intentional mood, not a uniform 12-color recolor grid.
 ["Night Fog","Gradient","#0c1322","#243553","#8caacb",false],
 ["Porcelain Air","Gradient","#eef1f0","#c4d1d7","#97acc9",true],
 ["Moss Haze","Gradient","#101c19","#356356","#8eb49f",false],
 ["Solar Silk","Gradient","#eee4d7","#d7a9a6","#b77c66",true],
 ["Digital Dusk","Gradient","#15152e","#594c83","#a997c9",false],
 ["Sea Glass","Gradient","#d6eee8","#8fbebc","#467e94",true],
 ["Satin Chrome","Sculpture","#18212c","#607285","#c1d2d8",false],
 ["Alabaster","Sculpture","#edeae2","#c6c4c0","#919da8",true],
 ["Soft Titanium","Sculpture","#373640","#797d85","#d6c7c7",false],
 ["Bronze Fold","Sculpture","#211b23","#8d625e","#cfaaa0",false],
 ["Glacial Curve","Sculpture","#ccd9e4","#83a5ba","#f4fafc",true],
 ["Lime Glass","Sculpture","#142421","#547e66","#a3c0aa",false],
 ["Afterglow","Atmosphere","#1a1c38","#805e8e","#d9a5ae",false],
 ["Blue Hour","Atmosphere","#0b2035","#375c7c","#9ac2cd",false],
 ["Warm Silence","Atmosphere","#ece0d0","#c8a68a","#eacdb4",true],
 ["Coastal Mist","Atmosphere","#dbe4e4","#9ab2b3","#678d91",true],
 ["Copper Dusk","Atmosphere","#25212b","#79565a","#c88e7a",false],
 ["Quiet Valley","Atmosphere","#1c2a26","#526d5e","#c0bea2",false],
 ["Arc Study","Geometry","#171c27","#444b5d","#cad4de",false],
 ["Sand Forms","Geometry","#e6dfd3","#c7b4a7","#8e817e",true],
 ["Concrete","Geometry","#d7d7d5","#9da5a6","#5c6970",true],
 ["Midnight Frames","Geometry","#15171e","#363f4e","#7391b9",false],
 ["Clay Geometry","Geometry","#e1d4ca","#bd9b8e","#735d61",true],
 ["Slate Lines","Geometry","#202d31","#4d6469","#c0d3ca",false],
 ["Deep Current","AMOLED","#030608","#081723","#2f9cb5",false],
 ["Black Pearl","AMOLED","#030405","#131923","#8894b6",false],
 ["Moon Ink","AMOLED","#020409","#18242e","#b7c6cd",false],
 ["Neon Olive","AMOLED","#040708","#122019","#85b58f",false],
 ["Burnt Neon","AMOLED","#060304","#241216","#d07170",false],
 ["Nocturne","AMOLED","#05070f","#181e35","#8582d6",false],
 ["Petal","Soft Color","#f0e4e6","#dbbfc7","#ba97af",true],
 ["Iced Lavender","Soft Color","#e8e9f0","#c5c9e5","#9799cb",true],
 ["Pistachio","Soft Color","#e9efe4","#becfbd","#82a79c",true],
 ["Peach Halo","Soft Color","#f3e6da","#e1bbaa","#c28c7c",true],
 ["Cloud Blue","Soft Color","#e0e9f0","#b6c9db","#799ab8",true],
 ["Apricot","Soft Color","#f5e7d6","#d5b5a5","#bd927d",true],
 ["Signal One","Audio","#0b181b","#1f4350","#83c6b5",false],
 ["Oscillation","Audio","#151924","#323d5c","#8da1e0",false],
 ["Pulse","Audio","#141820","#39454e","#a4c5bb",false],
 ["Soundfield","Audio","#dce6e1","#a3b7ad","#527e78",true],
 ["Resonance","Audio","#1a1a24","#57465c","#c7a9bd",false],
 ["Quiet Note","Audio","#eeeae3","#c8c9c1","#778c88",true]
];
const works=P.map((p,i)=>({id:"mg-studio-"+String(i+1).padStart(2,"0"),name:p[0],
category:p[1],bg:p[2],mid:p[3],accent:p[4],light:p[5],variant:i%6,index:i}));
const groups=["Featured","Gradient","Sculpture","Atmosphere","Geometry","AMOLED","Soft Color","Audio"];
const favoriteOrder=[6,0,24,31,9,12,18,36,29,5,13,33];
const featured=favoriteOrder.map(i=>works[i]);
const storageKey=theme=>"ad_minimal_gallery_v1_"+theme;
const encode=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const find=id=>works.find(x=>x.id===id);
const fmt=n=>Number(n).toFixed(1);
function composition(w){
 const a=w.accent,b=w.mid,k=w.variant,t=w.category;
 const stroke='stroke="'+a+'" fill="none"';
 if(t==="Gradient"){
  const pos=[[960,550],[180,800],[775,1420],[100,360],[700,510],[350,1500]][k];
  return '<ellipse cx="'+pos[0]+'" cy="'+pos[1]+'" rx="650" ry="920" fill="url(#glow)" opacity=".9"/>'+
   '<ellipse cx="'+(1040-pos[0]/2)+'" cy="'+(1700-pos[1]/3)+'" rx="650" ry="690" fill="url(#glow2)" opacity=".85"/>'+
   (k%2?'<path d="M-120 1370 Q560 1070 1200 1600" '+stroke+' stroke-width="2" opacity=".11"/>':'');
 }
 if(t==="Sculpture"){
  if(k===0)return '<path d="M90 550 C380 215 970 400 910 730 S450 940 310 1290 S480 1760 1000 1460" fill="none" stroke="url(#metal)" stroke-width="190" stroke-linecap="round" opacity=".90"/>'+
   '<path d="M90 550 C380 215 970 400 910 730 S450 940 310 1290 S480 1760 1000 1460" fill="none" stroke="'+a+'" stroke-width="2" opacity=".58"/>';
  if(k===1)return '<path d="M155 410Q390 205 810 370L900 1380Q670 1660 190 1470Z" fill="url(#metal)"/><path d="M155 410Q530 620 810 370" fill="none" stroke="'+a+'" stroke-width="5" opacity=".27"/>';
  if(k===2)return '<ellipse cx="550" cy="950" rx="355" ry="480" transform="rotate(-22 550 950)" fill="url(#orb)" opacity=".85"/><path d="M250 1100Q530 1450 890 880" '+stroke+' stroke-width="4" opacity=".45"/>';
  if(k===3)return '<path d="M200 270C730 220 1050 730 760 1010S450 1450 920 1730" fill="none" stroke="url(#metal)" stroke-width="210" stroke-linecap="round"/><path d="M210 270C730 220 1050 730 760 1010S450 1450 920 1730" fill="none" stroke="'+a+'" stroke-width="3" opacity=".32"/>';
  if(k===4)return '<path d="M230 350A360 360 0 0 1 950 350V1410A360 360 0 0 1 230 1410Z" fill="url(#metal)" opacity=".87"/><path d="M350 540A245 245 0 0 1 840 540V1250A245 245 0 0 1 350 1250Z" fill="'+w.bg+'" opacity=".42"/>';
  return '<ellipse cx="590" cy="1010" rx="375" ry="375" fill="url(#orb)"/><ellipse cx="590" cy="1010" rx="410" ry="140" transform="rotate(-31 590 1010)" '+stroke+' stroke-width="5" opacity=".48"/>';
 }
 if(t==="Atmosphere"){
  const height=[900,1130,1100,820,1300,1030][k];
  return '<ellipse cx="'+(410+k*85)+'" cy="'+(height-110)+'" rx="570" ry="630" fill="url(#glow)" opacity=".69"/>'+
   '<path d="M0 '+height+' Q420 '+(height-95-k*18)+' 1080 '+(height+40)+'V1920H0Z" fill="'+b+'" opacity=".37"/>'+
   '<path d="M0 '+(height+240)+' Q560 '+(height+60)+' 1080 '+(height+210)+'V1920H0Z" fill="'+a+'" opacity=".17"/>'+
   (k%2===0?'<circle cx="'+(780-k*33)+'" cy="'+(height-225)+'" r="90" fill="url(#orb)" opacity=".46"/>':'');
 }
 if(t==="Geometry"){
  if(k===0)return '<path d="M-120 1120A710 710 0 0 1 1300 1120" '+stroke+' stroke-width="6" opacity=".45"/><path d="M-50 1120A640 640 0 0 1 1230 1120" '+stroke+' stroke-width="2" opacity=".32"/><path d="M160 1350L900 1350" '+stroke+' stroke-width="3" opacity=".45"/>';
  if(k===1)return '<rect x="215" y="410" width="650" height="1140" rx="300" fill="url(#metal)" opacity=".6"/><rect x="305" y="520" width="470" height="940" rx="235" fill="'+w.bg+'" opacity=".55"/>';
  if(k===2)return '<path d="M135 250L950 500L720 1600L55 1300Z" fill="url(#metal)" opacity=".68"/><path d="M135 250L720 1600L55 1300Z" fill="'+b+'" opacity=".27"/>';
  if(k===3)return Array.from({length:5},(_,i)=>'<rect x="'+(70+i*44)+'" y="'+(290+i*83)+'" width="'+(900-i*88)+'" height="'+(1220-i*158)+'" rx="42" '+stroke+' stroke-width="'+(i===0?4:2)+'" opacity="'+fmt(.41-i*.045)+'"/>').join("");
  if(k===4)return '<circle cx="540" cy="930" r="365" fill="url(#orb)" opacity=".55"/><path d="M0 940H1080M540 230V1670" '+stroke+' stroke-width="2" opacity=".37"/>';
  return Array.from({length:7},(_,i)=>'<path d="M'+(135+i*110)+' 350V1530" '+stroke+' stroke-width="'+(i===3?6:2)+'" opacity="'+fmt(.18+i*.026)+'"/>').join("");
 }
 if(t==="AMOLED"){
  if(k===0)return '<path d="M-180 1400Q420 240 1210 1040" fill="none" stroke="url(#metal)" stroke-width="92" opacity=".86"/>';
  if(k===1)return '<ellipse cx="620" cy="970" rx="255" ry="330" fill="url(#orb)" opacity=".69"/>';
  if(k===2)return '<circle cx="555" cy="1030" r="315" fill="'+w.bg+'"/><circle cx="555" cy="1030" r="310" '+stroke+' stroke-width="6" opacity=".77"/><circle cx="555" cy="1030" r="355" '+stroke+' stroke-width="1" opacity=".30"/>';
  if(k===3)return '<path d="M0 1250Q390 650 1150 1080" '+stroke+' stroke-width="17" opacity=".65"/><path d="M0 1320Q390 720 1150 1150" '+stroke+' stroke-width="2" opacity=".25"/>';
  if(k===4)return '<path d="M220 1410Q320 350 850 610Q1120 840 680 1400Z" fill="url(#metal)" opacity=".51"/>';
  return '<ellipse cx="520" cy="1020" rx="255" ry="460" transform="rotate(34 520 1020)" fill="none" stroke="url(#metal)" stroke-width="42" opacity=".81"/>';
 }
 if(t==="Soft Color"){
  if(k===0)return '<ellipse cx="830" cy="800" rx="470" ry="630" fill="url(#glow)" opacity=".95"/><path d="M140 1390Q480 620 1030 1190" '+stroke+' stroke-width="2" opacity=".18"/>';
  if(k===1)return '<ellipse cx="250" cy="680" rx="530" ry="650" fill="url(#glow)" opacity=".85"/><ellipse cx="890" cy="1240" rx="540" ry="690" fill="url(#glow2)" opacity=".80"/>';
  if(k===2)return '<circle cx="700" cy="900" r="385" fill="url(#orb)" opacity=".64"/><circle cx="700" cy="900" r="420" '+stroke+' stroke-width="1" opacity=".12"/>';
  if(k===3)return '<path d="M-120 860Q350 540 810 800T1180 1160" stroke="url(#metal)" stroke-width="300" opacity=".45" fill="none"/>';
  if(k===4)return '<path d="M0 480Q520 820 1080 480V1920H0Z" fill="'+b+'" opacity=".20"/><ellipse cx="555" cy="780" rx="630" ry="670" fill="url(#glow)" opacity=".85"/>';
  return '<circle cx="540" cy="940" r="330" fill="url(#orb)" opacity=".58"/><ellipse cx="540" cy="940" rx="465" ry="465" fill="none" stroke="'+a+'" opacity=".16" stroke-width="2"/>';
 }
 // Audio: graphic restraint with very thin, precise signal curves.
 if(k===0)return '<path d="M-80 1090C270 1090 280 830 490 830S730 1370 940 1100S1130 1050 1240 1050" '+stroke+' stroke-width="5" opacity=".65"/>';
 if(k===1)return Array.from({length:9},(_,i)=>{
 const y=710+i*63;return '<path d="M-30 '+y+'Q300 '+(y-130*Math.sin(i*.6))+' 570 '+y+'T1140 '+(y+60*Math.cos(i*.5))+'" '+stroke+' stroke-width="'+(i===4?4:1.5)+'" opacity="'+fmt(.10+(i===4?.4:i*.018))+'"/>';
 }).join("");
 if(k===2)return Array.from({length:25},(_,i)=>{
 const v=Math.abs(Math.sin(i*.47)*Math.cos(i*.15));
 return '<rect x="'+(i*44+10)+'" y="'+fmt(1060-v*265)+'" width="5" height="'+fmt(v*530)+'" rx="2.5" fill="'+a+'" opacity="'+fmt(.18+v*.43)+'"/>';
 }).join("");
 if(k===3)return '<circle cx="560" cy="990" r="180" '+stroke+' stroke-width="3" opacity=".38"/><circle cx="560" cy="990" r="290" '+stroke+' stroke-width="2" opacity=".25"/><circle cx="560" cy="990" r="400" '+stroke+' stroke-width="1" opacity=".16"/>';
 if(k===4)return '<path d="M-20 970Q300 910 400 1030T720 1030T1100 930" '+stroke+' stroke-width="3" opacity=".68"/><ellipse cx="520" cy="960" rx="280" ry="430" fill="url(#glow)" opacity=".3"/>';
 return '<path d="M-40 1110H400Q520 1110 535 975Q550 1110 700 1110H1120" '+stroke+' stroke-width="4" opacity=".48"/>';
}
function svg(w){
 const bg=w.bg,mid=w.mid,a=w.accent;
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="2560" viewBox="0 0 1080 1920">'+
 '<defs><linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+bg+'"/><stop offset=".56" stop-color="'+mid+'"/><stop offset="1" stop-color="'+bg+'"/></linearGradient>'+
 '<radialGradient id="glow"><stop stop-color="'+a+'" stop-opacity=".7"/><stop offset=".53" stop-color="'+a+'" stop-opacity=".26"/><stop offset="1" stop-color="'+a+'" stop-opacity="0"/></radialGradient>'+
 '<radialGradient id="glow2"><stop stop-color="'+mid+'" stop-opacity=".74"/><stop offset="1" stop-color="'+mid+'" stop-opacity="0"/></radialGradient>'+
 '<linearGradient id="metal" x1="0" y1="0" x2=".95" y2="1"><stop stop-color="'+bg+'"/><stop offset=".28" stop-color="'+a+'"/><stop offset=".51" stop-color="'+mid+'"/><stop offset=".74" stop-color="'+a+'"/><stop offset="1" stop-color="'+bg+'"/></linearGradient>'+
 '<radialGradient id="orb" cx=".32" cy=".23" r=".85"><stop stop-color="#fff" stop-opacity=".8"/><stop offset=".18" stop-color="'+a+'" stop-opacity=".85"/><stop offset=".65" stop-color="'+mid+'"/><stop offset="1" stop-color="'+bg+'"/></radialGradient></defs>'+
 '<rect width="1080" height="1920" fill="url(#base)"/>'+composition(w)+'</svg>';
}
const src=w=>"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg(w));
const image=document.createElement("img");
image.id="minimalGalleryWallpaperImage";image.alt="";image.decoding="async";
image.setAttribute("aria-hidden","true");image.hidden=true;stage.append(image);
const css=document.createElement("style");css.textContent=
 '#minimalGalleryWallpaperImage[hidden]{display:none!important}#minimalGalleryWallpaperImage{position:absolute;z-index:4;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}'+
 'body[data-minimal-wallpaper] #wallpaperStage .wallpaper-image{opacity:0!important}body[data-minimal-wallpaper] #wallpaperStage::after{background:transparent!important}body[data-minimal-wallpaper] #wallpaperEffect,body[data-minimal-wallpaper] #audioArtworkImage{display:none!important}'+
 '#minimalGalleryStudio{margin:14px 0 12px;padding:12px;border:1px solid var(--ds-line,#435448);border-radius:16px;background:var(--ds-panel,#202a25)}'+
 '#minimalGalleryStudio h3{margin:0;font:650 15px system-ui,sans-serif;color:var(--ds-text,#f0f5f0)}#minimalGalleryStudio .studio-caption{font:11px/1.5 system-ui,sans-serif;opacity:.72;margin:5px 0 10px}'+
 '#minimalGalleryFilters{display:flex;overflow-x:auto;scrollbar-width:none;gap:6px;padding:2px 0 10px;overscroll-behavior-x:contain}#minimalGalleryFilters::-webkit-scrollbar{display:none}'+
 '#minimalGalleryFilters button{white-space:nowrap;flex:0 0 auto;border:1px solid var(--ds-line,#455c49);background:var(--ds-panel2,#304438);color:var(--ds-text,#fff);border-radius:99px;padding:8px 12px;font:500 11px system-ui,sans-serif}'+
 '#minimalGalleryFilters button[aria-pressed="true"]{border-color:var(--ds-accent,#b9ddc0);background:var(--ds-accent,#b9ddc0);color:var(--ds-accent-ink,#16281b);font-weight:700}'+
 '#minimalGalleryGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:3px 0 10px}'+
 '#minimalGalleryGrid .minimal-gallery-entry{display:flex;flex-direction:column;gap:5px;min-width:0;padding:5px!important;border:1px solid var(--ds-line,#4d6555)!important;border-radius:11px!important;background:var(--ds-panel2,#26362e)!important;color:var(--ds-text,#fff)!important;font:500 11px system-ui,sans-serif!important;text-align:left!important;box-shadow:none!important}'+
 '#minimalGalleryGrid img{display:block;width:100%;height:160px;object-fit:cover;object-position:center;background:#172020;border-radius:8px}'+
 '#minimalGalleryGrid .minimal-gallery-entry span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 3px 3px}'+
 '#minimalGalleryGrid .minimal-gallery-entry[aria-pressed="true"]{border-color:var(--ds-accent,#bedfc4)!important;box-shadow:inset 0 0 0 1px var(--ds-accent,#bedfc4)!important}'+
 '#minimalGalleryPager{display:flex;align-items:center;gap:7px;justify-content:space-between}#minimalGalleryPager button{border:1px solid var(--ds-line,#526b57);border-radius:9px;background:var(--ds-panel2,#304438);color:var(--ds-text,#fff);padding:8px 12px;font:600 11px system-ui,sans-serif}'+
 '#minimalGalleryPager button:disabled{opacity:.35}#minimalGalleryCount{font:11px system-ui,sans-serif;opacity:.75;text-align:center;flex:1}'+
 '#wallpaperMoreOptions{margin:14px 0}#wallpaperMoreOptions>summary{cursor:pointer;border-radius:11px;padding:13px 12px;color:var(--ds-text,#fff);background:var(--ds-panel2,#303d34);font:600 12px system-ui,sans-serif}'+
 '#wallpaperMoreOptions[open]{border:1px solid var(--ds-line,#536a58);padding:0 8px 10px;border-radius:12px}'+
 '@media(max-width:350px){#minimalGalleryGrid img{height:130px}#minimalGalleryStudio{padding:9px}}';document.head.append(css);
const studio=document.createElement("section");studio.id="minimalGalleryStudio";
studio.innerHTML='<h3>Studio Wallpapers</h3><p class="studio-caption">42 original, modern wallpapers · sharp, offline, curated</p>';
const filters=document.createElement("div");filters.id="minimalGalleryFilters";filters.setAttribute("role","group");filters.setAttribute("aria-label","Wallpaper collections");
const grid=document.createElement("div");grid.id="minimalGalleryGrid";grid.setAttribute("role","group");grid.setAttribute("aria-label","Curated modern wallpapers");
const pager=document.createElement("div");pager.id="minimalGalleryPager";
pager.innerHTML='<button type="button" id="minimalGalleryPrev" aria-label="Previous wallpaper page">‹ Previous</button><span id="minimalGalleryCount" aria-live="polite"></span><button type="button" id="minimalGalleryNext" aria-label="Next wallpaper page">Next ›</button>';
studio.append(filters,grid,pager);
byId("wallpaperSystemStatus").after(studio);
// Keep pre-existing Audio Desk wallpaper choices, but don't force a huge
// scrolling catalogue before the curated collection.
const more=document.createElement("details");more.id="wallpaperMoreOptions";
more.innerHTML='<summary>More wallpaper options · Colors, audio & photos</summary>';
const colors=byId("themePaletteGrid"),photos=byId("wallpaperGrid"),audio=byId("audioWallpaperGrid");
const colorsTitle=colors?.previousElementSibling,photosTitle=colors?.nextElementSibling,audioTitle=audio?.previousElementSibling;
if(colorsTitle)more.append(colorsTitle);
if(colors)more.append(colors);
if(photosTitle&&photosTitle!==audioTitle)more.append(photosTitle);
if(audioTitle)more.append(audioTitle);
if(audio)more.append(audio);
if(photos)more.append(photos);
studio.after(more);
// Keep established wallpaper controls immediately visible in non-Orbit editions;
// Orbit uses the intentionally compact Studio view unless More is expanded.
more.open=launcherTheme!=="orbit";
let category="Featured",page=0,current="";
const pageSize=4;
const list=()=>category==="Featured"?featured:works.filter(w=>w.category===category);
function render(){
 if(dialog.hidden)return;
 filters.innerHTML=groups.map(g=>'<button type="button" data-minimal-category="'+encode(g)+'" aria-pressed="'+(g===category)+'">'+encode(g)+'</button>').join("");
 const all=list(),max=Math.max(1,Math.ceil(all.length/pageSize));page=Math.max(0,Math.min(page,max-1));
 grid.innerHTML=all.slice(page*pageSize,(page+1)*pageSize).map(w=>
  '<button type="button" class="minimal-gallery-entry" data-minimal-id="'+w.id+'" aria-label="Select '+encode(w.name)+' wallpaper" aria-pressed="'+(w.id===current)+'">'+
  '<img loading="lazy" decoding="async" alt="" src="'+encode(src(w))+'"><span>'+encode(w.name)+'</span></button>').join("");
 byId("minimalGalleryCount").textContent=(page+1)+" / "+max+" · "+all.length+" designs";
 byId("minimalGalleryPrev").disabled=page===0;
 byId("minimalGalleryNext").disabled=page>=max-1;
}
function select(id,persist=true){
 const w=find(id);current=w?.id||"";
 if(persist)deskStorage.setItem(storageKey(launcherTheme),current);
 if(!w){image.hidden=true;image.removeAttribute("src");delete document.body.dataset.minimalWallpaper;render();return}
 image.src=src(w);image.hidden=false;document.body.dataset.minimalWallpaper=w.id;
 document.body.dataset.wallpaperLight=String(w.light);document.body.dataset.wallpaperStatusLight=String(w.light);
 window.audioDeskApplyWallpaperColors?.(w.accent,w.bg);render();
}
function clear(){if(current)select("")}
function applyAndroid(){
 const w=find(current);if(!w)return false;
 const native=window.AudioDesk,status=byId("wallpaperSystemStatus");
 if(typeof native?.setSystemWallpaperCustom!=="function"){status.textContent="Saved in Audio Desk. Native Android wallpaper changes require the installed APK.";return true}
 const request=++systemWallpaperRequest,img=new Image();
 img.onload=()=>{
  if(request!==systemWallpaperRequest)return;
  try{
   const canvas=document.createElement("canvas");canvas.width=1440;canvas.height=2560;
   canvas.getContext("2d").drawImage(img,0,0,1440,2560);
   native.setSystemWallpaperCustom(canvas.toDataURL("image/jpeg",.93),50,byId("wallpaperApplyLock").checked,request);
   status.textContent="Applying 1440 × 2560 Studio wallpaper to Android…";
  }catch{status.textContent="Could not export this wallpaper."}
 };
 img.onerror=()=>{status.textContent="Could not decode the selected wallpaper."};img.src=src(w);
 return true;
}
filters.addEventListener("click",e=>{const c=e.target.closest("[data-minimal-category]")?.dataset.minimalCategory;
 if(!groups.includes(c))return;category=c;page=0;render()});
byId("minimalGalleryPrev").addEventListener("click",()=>{page--;render()});
byId("minimalGalleryNext").addEventListener("click",()=>{page++;render()});
grid.addEventListener("click",e=>{const id=e.target.closest("[data-minimal-id]")?.dataset.minimalId;
 if(!find(id))return;window.audioDeskClearAudioWallpaper?.();select(id);applyAndroid()});
for(const id of ["themePaletteGrid","wallpaperGrid","audioWallpaperGrid","customWallpaperRestore"]){
 byId(id)?.addEventListener("click",e=>{if(id==="themePaletteGrid"&&!e.target.closest("[data-palette]"))return;
 if(id==="wallpaperGrid"&&!e.target.closest("[data-wallpaper]"))return;
 if(id==="audioWallpaperGrid"&&!e.target.closest("[data-audio-art]"))return;clear()},true);
}
byId("customWallpaperFile")?.addEventListener("change",e=>{if(e.target.files?.length)clear()});
const baseApply=applySystemWallpaper;applySystemWallpaper=function(){return current?applyAndroid():baseApply()};
byId("wallpaperApplySystem").onclick=()=>applySystemWallpaper();
function savedForTheme(theme){
 let id=deskStorage.getItem(storageKey(theme))||"";
 if(id.startsWith("mg-")&&!find(id)){
  const oldPalette=id.split("-").slice(-1)[0];
  const migrate={obsidian:24,graphite:0,ivory:7,sand:14,rose:30,sage:32,forest:2,navy:1,indigo:4,copper:16,teal:5,lavender:31};
  id=works[migrate[oldPalette]??0].id;
  deskStorage.setItem(storageKey(theme),id);
 }
 return id;
}
const baseTheme=setLauncherTheme;
setLauncherTheme=function(theme){
 baseTheme(theme);more.open=theme!=="orbit";
 select(savedForTheme(theme),false);
};
const basePicker=renderWallpaperPicker;
renderWallpaperPicker=function(){basePicker();more.open=launcherTheme!=="orbit";render()};
new MutationObserver(()=>{if(!dialog.hidden)render()}).observe(dialog,{attributes:true,attributeFilter:["hidden"]});
// Legacy saved selections are migrated lazily per theme on first use.
select(savedForTheme(launcherTheme),false);
window.audioDeskMinimalGalleryCount=()=>works.length;
window.audioDeskStudioGallery=()=>({count:works.length,collections:groups.slice(),pageSize});
})();