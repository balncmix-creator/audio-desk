/* Full-resolution wallpapers are decoded only when selected. Gallery uses small files. */
const CLOCK_DESIGNS=["Minimal","Arcade Pixel","Bold Mono","Thin","8-Bit Block","Shadow","Heavy","Underlined","Neon Pixel","Framed"];
const loadPersonalInt=(key,fallback,max)=>{const raw=localStorage.getItem(key);const n=raw===null?NaN:Number(raw);return Number.isInteger(n)&&n>=0&&n<=max?n:fallback};
let selectedWallpaper=loadPersonalInt("ar_wallpaper_v1",0,WALLPAPERS.length-1);
let clockDesign=loadPersonalInt("ar_clock_style_v1",0,9);
let clockSize=loadPersonalInt("ar_clock_size_v1",66,110);
if(clockSize<48)clockSize=66;
const motionPreference=window.matchMedia("(prefers-reduced-motion: reduce)");
const EFFECTS=["auto","none","rain","aurora","stars","ocean","studio"];
let wallpaperEffectChoice=localStorage.getItem("ar_wallpaper_effect_v2")||
 (localStorage.getItem("ar_wallpaper_motion_v1")==="false"?"none":"auto");
if(!EFFECTS.includes(wallpaperEffectChoice))wallpaperEffectChoice="auto";
let customWallpaper=null,customWallpaperUrl="",wallpaperLoad=0;
let customWallpaperSelected=localStorage.getItem("ar_wallpaper_custom_v2")==="true";
let customPosition=loadPersonalInt("ar_wallpaper_position_v2",35,100);
let nativeWallpaperActive=true;
function syncWallpaperMotion(){
 const effect=wallpaperEffectChoice==="auto"?(customWallpaperSelected?"stars":WALLPAPERS[selectedWallpaper].motion):wallpaperEffectChoice;
 const paused=document.hidden||!nativeWallpaperActive||launcherPage!=="home"||motionPreference.matches;
 document.body.dataset.motionPaused=String(paused);
 document.body.dataset.wallpaperMotion=effect==="none"?"":effect;
 if(window.AudioDesk&&typeof window.AudioDesk.setWallpaperTone==="function")
  window.AudioDesk.setWallpaperTone(launcherPage==="home"&&document.body.dataset.wallpaperLight==="true");
 const status=$("wallpaperMotionStatus");
 if(status)status.textContent=motionPreference.matches?"Animations paused by your phone’s reduced-motion setting.":
  effect==="none"?"Static wallpaper. Choose an effect to animate it.":"Live "+effect+" effect · pauses when Home is hidden.";
}
window.launcherWallpaperActive=function(active){nativeWallpaperActive=active;syncWallpaperMotion()};
document.addEventListener("visibilitychange",syncWallpaperMotion);
window.addEventListener("launcher-page-changed",syncWallpaperMotion);
if(motionPreference.addEventListener)motionPreference.addEventListener("change",syncWallpaperMotion);
else motionPreference.addListener(syncWallpaperMotion);
async function applyWallpaper(){
 const token=++wallpaperLoad,wallpaper=WALLPAPERS[selectedWallpaper];
 const custom=customWallpaperSelected&&customWallpaper;
 const src=custom?customWallpaperUrl:wallpaper.src;
 const image=new Image();image.className="wallpaper-image";image.alt="";image.decoding="async";
 image.style.objectPosition=custom?customPosition+"% center":wallpaper.position;
 image.src=src;
 try{
  await image.decode();
  if(token!==wallpaperLoad)return;
  const old=$("wallpaperImage");image.id="wallpaperImage";
  if(old)old.replaceWith(image);else $("wallpaperStage").prepend(image);
  if(!motionPreference.matches)image.animate([{opacity:.25},{opacity:1}],{duration:LOW_POWER_DEVICE?140:260,easing:"ease-out"});
  const light=custom?customWallpaper.light:wallpaper.light;
  document.body.dataset.wallpaperLight=String(light);
 }catch(e){
  if(token!==wallpaperLoad)return;
  $("wallpaperImage")?.remove();
  document.body.dataset.wallpaperLight="false";
  $("customWallpaperStatus").textContent="Wallpaper file unavailable. Choose a photo from your phone.";
 }
 syncWallpaperMotion();
}
function fitClock(){
 const face=$("launcherClock");
 const available=face.parentElement.clientWidth;
 if(!available)return;
 face.style.setProperty("--clock-fit","110px");
 const width=face.scrollWidth;
 if(width>available)face.style.setProperty("--clock-fit",Math.floor(clockSize*available/width)+"px");
}
function applyClockDesign(){
 document.body.dataset.clockStyle=String(clockDesign);
 const face=$("launcherClock");face.classList.add("clock-face");face.dataset.design=clockDesign;
 document.documentElement.style.setProperty("--clock-size",clockSize+"px");
 $("clockSizeSlider").value=clockSize;$("clockSizeValue").textContent=clockSize+"px";
 fitClock();
}
window.addEventListener("resize",fitClock);
window.addEventListener("launcher-page-changed",()=>{if(launcherPage==="home")applyClockDesign()});
document.fonts.ready.then(fitClock);
function closeCustomize(){
 for(const id of ["launcherWallpaperDialog","launcherClockDialog"]){
  const dialog=$(id);if(dialog.hidden)continue;
  if(!motionPreference.matches){
   const anim=dialog.querySelector(".customize-panel").animate([{transform:"translateY(0)",opacity:1},{transform:"translateY(24px)",opacity:0}],{duration:LOW_POWER_DEVICE?100:160,easing:"ease-in"});
   anim.onfinish=()=>{dialog.hidden=true};
  }else dialog.hidden=true;
 }
}
function openCustomize(id){
 closeHomeOptions();
 for(const other of ["launcherWallpaperDialog","launcherClockDialog"]){
  $(other).getAnimations({subtree:true}).forEach(a=>a.cancel());$(other).hidden=true;
 }
 $(id).hidden=false;
}
function openWallpaperPicker(){renderWallpaperPicker();openCustomize("launcherWallpaperDialog")}
function openClockCustomizer(){renderClockCustomizer();openCustomize("launcherClockDialog")}
function renderWallpaperPicker(){
 $("wallpaperGrid").innerHTML=WALLPAPERS.map((wallpaper,i)=>
  '<button type="button" class="wallpaper-choice" data-wallpaper="'+i+'" aria-pressed="'+(!customWallpaperSelected&&selectedWallpaper===i)+'">'+
  '<img class="wallpaper-thumb" src="'+wallpaper.thumb+'" alt="" loading="lazy" decoding="async" width="180" height="400">'+
  '<span>'+wallpaper.name+'</span><small>'+wallpaper.motion+' animation</small></button>').join("");
 $("wallpaperEffectSelect").value=wallpaperEffectChoice;
 $("customWallpaperCrop").hidden=!customWallpaperSelected;
 $("customWallpaperPosition").value=customPosition;
 $("customWallpaperRestore").hidden=!customWallpaper||customWallpaperSelected;
 syncWallpaperMotion();
}
function renderClockCustomizer(){
 $("clockDesignGrid").innerHTML=CLOCK_DESIGNS.map((name,i)=>
  '<button type="button" class="clock-choice" data-clock-design="'+i+'" aria-pressed="'+(clockDesign===i)+'">'+
  '<span class="clock-sample clock-face" data-design="'+i+'">19:24</span><span class="clock-choice-name">'+name+'</span></button>').join("");
 applyClockDesign();
}
$("wallpaperGrid").addEventListener("click",e=>{
 const b=e.target.closest("[data-wallpaper]");if(!b)return;
 customWallpaperSelected=false;localStorage.setItem("ar_wallpaper_custom_v2","false");
 selectedWallpaper=Number(b.dataset.wallpaper);localStorage.setItem("ar_wallpaper_v1",selectedWallpaper);
 applyWallpaper();renderWallpaperPicker();
});
$("wallpaperEffectSelect").onchange=e=>{
 wallpaperEffectChoice=e.target.value;localStorage.setItem("ar_wallpaper_effect_v2",wallpaperEffectChoice);syncWallpaperMotion();
};
$("clockDesignGrid").addEventListener("click",e=>{
 const b=e.target.closest("[data-clock-design]");if(!b)return;
 clockDesign=Number(b.dataset.clockDesign);localStorage.setItem("ar_clock_style_v1",clockDesign);
 applyClockDesign();renderClockCustomizer();
 if(!motionPreference.matches)$("launcherClock").animate([{opacity:.4,transform:"translateY(4px)"},{opacity:1,transform:"translateY(0)"}],{duration:180});
});
$("clockSizeSlider").addEventListener("input",e=>{
 clockSize=Number(e.target.value);localStorage.setItem("ar_clock_size_v1",clockSize);applyClockDesign();
});
/* One Blob in IndexedDB survives restarts without base64 or broad storage permissions. */
function customWallpaperStore(write){return new Promise((resolve,reject)=>{
 const open=indexedDB.open("audio-desk-wallpapers",1);
 open.onupgradeneeded=()=>open.result.createObjectStore("wallpapers");
 open.onerror=()=>reject(open.error);
 open.onsuccess=()=>{
  const db=open.result,tx=db.transaction("wallpapers",write?"readwrite":"readonly"),store=tx.objectStore("wallpapers");
  const req=write?store.put(write,"custom"):store.get("custom");
  let result;req.onsuccess=()=>{result=req.result};
  tx.oncomplete=()=>{db.close();resolve(write||result)};
  tx.onerror=()=>{db.close();reject(tx.error)};tx.onabort=()=>{db.close();reject(tx.error)};
 };
})}
function useCustomWallpaper(record){
 if(customWallpaperUrl)URL.revokeObjectURL(customWallpaperUrl);
 customWallpaper=record;customWallpaperUrl=URL.createObjectURL(record.blob);
}
async function imageDimensions(file){
 const b=new Uint8Array(await file.slice(0,1048576).arrayBuffer());
 const v=new DataView(b.buffer),ascii=(at,n)=>String.fromCharCode(...b.slice(at,at+n));
 if(b.length>=24&&ascii(1,3)==="PNG")return [v.getUint32(16),v.getUint32(20)];
 if(b.length>=30&&ascii(0,4)==="RIFF"&&ascii(8,4)==="WEBP"){
  const le24=at=>b[at]|b[at+1]<<8|b[at+2]<<16;
  if(ascii(12,4)==="VP8X")return [1+le24(24),1+le24(27)];
  if(ascii(12,4)==="VP8 ")return [v.getUint16(26,true)&16383,v.getUint16(28,true)&16383];
  if(ascii(12,4)==="VP8L")return [1+(b[21]|(b[22]&63)<<8),1+((b[22]>>6)|b[23]<<2|(b[24]&15)<<10)];
 }
 if(b[0]===255&&b[1]===216){
  let at=2;
  while(at+8<b.length){
   if(b[at]!==255)break;const marker=b[at+1];
   if(marker===255){at++;continue}
   if(marker>=192&&marker<=207&&![196,200,204].includes(marker))return [v.getUint16(at+7),v.getUint16(at+5)];
   const length=v.getUint16(at+2);if(length<2)break;at+=length+2;
  }
 }
 throw new Error("Could not read this image. Choose a standard JPEG, PNG or WebP photo.");
}
$("customWallpaperChoose").onclick=()=>$("customWallpaperFile").click();
$("customWallpaperRestore").onclick=()=>{
 customWallpaperSelected=true;localStorage.setItem("ar_wallpaper_custom_v2","true");applyWallpaper();renderWallpaperPicker();
};
$("customWallpaperFile").onchange=async e=>{
 const input=e.target,file=input.files[0];if(!file)return;
 const status=$("customWallpaperStatus");status.textContent="Preparing your wallpaper…";
 const choose=$("customWallpaperChoose");choose.disabled=true;
 let decoded;
 try{
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>30*1024*1024)throw new Error("Choose a JPEG, PNG or WebP image smaller than 30 MB.");
  // Decode directly to a bounded bitmap, including the image's orientation.
  const dimensions=await imageDimensions(file);
  if(dimensions.some(n=>!Number.isFinite(n)||n<1))throw new Error("Invalid image dimensions.");
  decoded=await createImageBitmap(file,{resizeWidth:Math.min(1440,...dimensions),resizeQuality:"high",imageOrientation:"from-image"});
  const scale=Math.min(1,3200/decoded.height,Math.sqrt(4608000/(decoded.width*decoded.height)));
  const canvas=document.createElement("canvas");canvas.width=Math.round(decoded.width*scale);canvas.height=Math.round(decoded.height*scale);
  const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(decoded,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(Math.floor(canvas.width*.15),0,Math.max(1,Math.floor(canvas.width*.35)),Math.max(1,Math.floor(canvas.height*.35))).data;
  let luma=0;for(let i=0;i<pixels.length;i+=16)luma+=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;
  const light=luma/(pixels.length/16)>150;
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",.94));
  if(!blob)throw new Error("This image could not be prepared. Try another photo.");
  const record={blob,light,width:canvas.width,height:canvas.height};
  await customWallpaperStore(record);useCustomWallpaper(record);
  customWallpaperSelected=true;localStorage.setItem("ar_wallpaper_custom_v2","true");
  await applyWallpaper();renderWallpaperPicker();status.textContent="Saved on this phone. Adjust the crop below.";
 }catch(error){status.textContent=error.message||"Could not save that wallpaper. Try another photo."}
 finally{decoded?.close();input.value="";choose.disabled=false}
};
$("customWallpaperPosition").oninput=e=>{
 customPosition=Number(e.target.value);localStorage.setItem("ar_wallpaper_position_v2",customPosition);
 if(customWallpaperSelected&&$("wallpaperImage"))$("wallpaperImage").style.objectPosition=customPosition+"% center";
};
$("launcherWallpaperChoose").onclick=openWallpaperPicker;$("launcherClockChoose").onclick=openClockCustomizer;
$("wallpaperClose").onclick=closeCustomize;$("clockClose").onclick=closeCustomize;
for(const id of ["launcherWallpaperDialog","launcherClockDialog"]){$(id).addEventListener("click",e=>{if(e.target===$(id))closeCustomize()})}
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeCustomize()});
let longHold=0,longStart=null,longConsumed=false;
function cancelHomeHold(){clearTimeout(longHold);longHold=0;longStart=null}
$("launcherHomePage").addEventListener("touchstart",e=>{
 if(e.touches.length!==1||launcherPage!=="home")return;
 const target=e.target;if(target.closest("button,input,textarea,.launcher-app,.customize-overlay,#launcherHomeOptions"))return;
 const clock=!!target.closest(".launcher-clock"),t=e.touches[0];longStart={x:t.clientX,y:t.clientY};longConsumed=false;
 clearTimeout(longHold);longHold=setTimeout(()=>{longConsumed=true;upStart=null;longStart=null;if(clock)openClockCustomizer();else $("launcherSettingsToggle").click()},520);
},{passive:true});
$("launcherHomePage").addEventListener("touchmove",e=>{if(!longStart||e.touches.length!==1)return;const t=e.touches[0];if(Math.hypot(t.clientX-longStart.x,t.clientY-longStart.y)>14)cancelHomeHold()},{passive:true});
$("launcherHomePage").addEventListener("touchend",cancelHomeHold,{passive:true});
$("launcherHomePage").addEventListener("touchcancel",cancelHomeHold,{passive:true});
$("launcherHomePage").addEventListener("contextmenu",e=>{if(e.target.closest(".launcher-app,button,.customize-overlay"))return;e.preventDefault();if(e.target.closest(".launcher-clock"))openClockCustomizer();else $("launcherSettingsToggle").click()});
applyClockDesign();syncWallpaperMotion();
customWallpaperStore().then(record=>{
 if(record)useCustomWallpaper(record);else customWallpaperSelected=false;
 applyWallpaper();
}).catch(()=>{customWallpaperSelected=false;applyWallpaper()});
