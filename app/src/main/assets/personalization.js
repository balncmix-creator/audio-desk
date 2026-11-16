/* Full-resolution wallpapers are decoded only when selected. Gallery uses small files. */
const CLOCK_DESIGNS=["Minimal","Arcade Pixel","Bold Mono","Thin","8-Bit Block","Shadow","Heavy","Underlined","Neon Pixel","Framed"];
const loadPersonalInt=(key,fallback,max)=>{const raw=deskStorage.getItem(key);const n=raw===null?NaN:Number(raw);return Number.isInteger(n)&&n>=0&&n<=max?n:fallback};
let selectedWallpaper=loadPersonalInt("ar_wallpaper_v1",0,WALLPAPERS.length-1);
let clockDesign=loadPersonalInt("ar_clock_style_v1",0,9);
let clockSize=loadPersonalInt("ar_clock_size_v1",66,110);
if(clockSize<48)clockSize=66;
const motionPreference=window.matchMedia("(prefers-reduced-motion: reduce)");
const EFFECTS=["auto","none","rain","aurora","stars","ocean","studio"];
let wallpaperEffectChoice=deskStorage.getItem("ar_wallpaper_effect_v2")||
 (deskStorage.getItem("ar_wallpaper_motion_v1")==="false"?"none":"auto");
if(!EFFECTS.includes(wallpaperEffectChoice))wallpaperEffectChoice="auto";
let customWallpaper=null,customWallpaperUrl="",wallpaperLoad=0;
let customWallpaperSelected=deskStorage.getItem("ar_wallpaper_custom_v2")==="true";
let customPosition=loadPersonalInt("ar_wallpaper_position_v2",35,100);
let nativeWallpaperActive=true;
function syncWallpaperMotion(){
 const effect=wallpaperEffectChoice==="auto"?(customWallpaperSelected?"stars":WALLPAPERS[selectedWallpaper].motion):wallpaperEffectChoice;
 const saver=document.body.classList.contains("low-power")&&wallpaperEffectChoice==="auto";
 const paused=document.hidden||!nativeWallpaperActive||launcherPage!=="home"||motionPreference.matches||saver;
 document.body.dataset.motionPaused=String(paused);
 document.body.dataset.wallpaperMotion=effect==="none"?"":effect;
 const home=launcherPage==="home";
 const light=home&&launcherTheme!=="windows"&&document.body.dataset.wallpaperStatusLight==="true";
 if(window.AudioDesk&&typeof window.AudioDesk.setStatusBarTheme==="function")
  window.AudioDesk.setStatusBarTheme(home?launcherTheme:"apps",light);
 else if(window.AudioDesk&&typeof window.AudioDesk.setWallpaperTone==="function")
  window.AudioDesk.setWallpaperTone(light);
 const status=$("wallpaperMotionStatus");
 if(status)status.textContent=motionPreference.matches?"Animations paused by your phone’s reduced-motion setting.":
  saver?"Low-power mode keeps the wallpaper still. Choose an animation manually to enable it.":
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
  await decodeWallpaperImage(image);
  if(token!==wallpaperLoad)return;
  const old=$("wallpaperImage");image.id="wallpaperImage";
  if(old)old.replaceWith(image);else $("wallpaperStage").prepend(image);
  DeskMotion.run(image,[{opacity:.25},{opacity:1}]);
  const light=custom?customWallpaper.light:wallpaper.light;
  document.body.dataset.wallpaperLight=String(light);document.body.dataset.wallpaperStatusLight=String(light);
  if(custom)syncCustomWallpaperTone();
 }catch(e){
  if(token!==wallpaperLoad)return;
  // Retain the last decoded portrait when a replacement fails.
  document.body.dataset.wallpaperLight="false";
  $("customWallpaperStatus").textContent="Wallpaper file unavailable. Choose a photo from your phone.";
 }
 syncWallpaperMotion();
}
// Sample the displayed crop, including its separate status-bar strip.
function syncCustomWallpaperTone(){
 if(!customWallpaperSelected||!customWallpaper)return;
 const image=$("wallpaperImage");if(!image?.naturalWidth)return;
 try{
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=Math.max(1,Math.round(64*innerHeight/innerWidth));
  const ctx=canvas.getContext('2d',{willReadFrequently:true}),scale=Math.max(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight);
  const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
  ctx.drawImage(image,(canvas.width-width)*customPosition/100,(canvas.height-height)/2,width,height);
  function bright(x,y,w,h){const pixels=ctx.getImageData(x,y,Math.max(1,w),Math.max(1,h)).data;let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;return sum/(pixels.length/4)>150}
  document.body.dataset.wallpaperLight=String(bright(3,Math.floor(canvas.height*.12),38,Math.max(1,Math.floor(canvas.height*.52))));
  document.body.dataset.wallpaperStatusLight=String(bright(0,0,64,Math.max(1,Math.floor(canvas.height*.04))));
 }catch{}
 syncWallpaperMotion();
}
let cropFrame=0;
function scheduleWallpaperTone(){cancelAnimationFrame(cropFrame);cropFrame=requestAnimationFrame(syncCustomWallpaperTone)}
window.addEventListener('resize',scheduleWallpaperTone);
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
function decodeWallpaperImage(image){
 if(typeof image.decode==="function")return image.decode();
 return new Promise((resolve,reject)=>{if(image.complete){image.naturalWidth?resolve():reject(new Error('Image unavailable'));return}image.onload=resolve;image.onerror=reject});
}
function closeCustomize(immediate=false){
 for(const id of ["launcherThemeDialog","launcherWallpaperDialog","launcherClockDialog"])DeskMotion.hide($(id),immediate===true);
}
function openCustomize(id){
 closeHomeOptions(true);cancelHomeHold();upStart=null;
 for(const other of ["launcherThemeDialog","launcherWallpaperDialog","launcherClockDialog"])DeskMotion.hide($(other),true);
 $(id).querySelector('.customize-panel').scrollTop=0;DeskMotion.show($(id));
 $(id).querySelector('button').focus({preventScroll:true});
}
function openThemePicker(){
 for(const button of $("launcherThemeGrid").querySelectorAll("[data-launcher-theme-choice]"))
  button.setAttribute("aria-pressed",String(button.dataset.launcherThemeChoice===launcherTheme));
 openCustomize("launcherThemeDialog");
}
$("launcherThemeChoose").onclick=openThemePicker;
$("themeClose").onclick=()=>closeCustomize();
$("launcherThemeGrid").addEventListener("click",e=>{
 const button=e.target.closest("[data-launcher-theme-choice]");
 if(!button)return;
 setLauncherTheme(button.dataset.launcherThemeChoice);
 for(const item of $("launcherThemeGrid").querySelectorAll("[data-launcher-theme-choice]"))
  item.setAttribute("aria-pressed",String(item===button));
 closeCustomize();
});
const lockWallpaperPref="ad_apply_lock_wallpaper_v1";
function openWallpaperPicker(){
 // New users default to both screens. Respect a deliberate opt-out across sessions.
 $("wallpaperApplyLock").checked=deskStorage.getItem(lockWallpaperPref)!=="false";
 renderWallpaperPicker();openCustomize("launcherWallpaperDialog");
 requestAnimationFrame(()=>{
  const selected=$("wallpaperGrid").querySelector('[aria-pressed="true"]');
  if(selected)selected.scrollIntoView({block:"nearest",inline:"center",behavior:"instant"});
 });
}
function openClockCustomizer(){renderClockCustomizer();openCustomize("launcherClockDialog")}
function renderWallpaperPicker(){
 // Preserve the chosen card's position when selection changes; no gallery flash.
 const gallery=$("wallpaperGrid"),previousScroll=gallery.scrollLeft;
 gallery.innerHTML=WALLPAPERS.map((wallpaper,i)=>
  '<button type="button" class="wallpaper-choice" data-wallpaper="'+i+'" aria-pressed="'+(!customWallpaperSelected&&selectedWallpaper===i)+'">'+
  '<img class="wallpaper-thumb" src="'+wallpaper.thumb+'" alt="" loading="lazy" decoding="async" width="180" height="400">'+
  '<span>'+wallpaper.name+'</span><small>'+(wallpaper.motion==="none"?"Static · effects available":wallpaper.motion+" animation")+'</small></button>').join("");
 gallery.scrollLeft=previousScroll;
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
 customWallpaperSelected=false;deskStorage.setItem("ar_wallpaper_custom_v2","false");
 selectedWallpaper=Number(b.dataset.wallpaper);deskStorage.setItem("ar_wallpaper_v1",selectedWallpaper);
 applyWallpaper();renderWallpaperPicker();
 applySystemWallpaper();
});
/* The system wallpaper changes only after explicit user selection, never at boot. */
let systemWallpaperRequest=0,systemWallpaperPendingLock=false;
$("wallpaperApplyLock").addEventListener("change",event=>{
 const enabled=event.target.checked;
 deskStorage.setItem(lockWallpaperPref,String(enabled));
 $("wallpaperSystemStatus").textContent=enabled?
  "Next selection will update Android Home and Lock screens.":
  "Next selection will update Android Home only.";
});
window.audioDeskWallpaperResult=function(id,ok,message){
 if(Number(id)!==systemWallpaperRequest)return;
 $("wallpaperSystemStatus").textContent=ok?
  "Android wallpaper updated"+(systemWallpaperPendingLock?" (Home and Lock).":" (Home)."):
  "Android wallpaper update failed: "+String(message||"Check device wallpaper restrictions.");
};
function customPhotoDataUrl(blob){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||""));
  reader.onerror=()=>reject(new Error("Photo could not be read for Android wallpaper."));
  reader.readAsDataURL(blob);
 });
}
async function applySystemWallpaper(){
 const status=$("wallpaperSystemStatus"),native=window.AudioDesk;
 if(!native||typeof native.setSystemWallpaperBundled!=="function"||typeof native.setSystemWallpaperCustom!=="function"){
  status.textContent="Android system wallpaper is available in the installed launcher APK.";
  return;
 }
 const request=++systemWallpaperRequest,alsoLock=$("wallpaperApplyLock").checked;
 systemWallpaperPendingLock=alsoLock;
 status.textContent="Applying to Android "+(alsoLock?"Home and Lock":"Home")+" wallpaper…";
 try{
  if(customWallpaperSelected&&customWallpaper?.blob){
   const data=await customPhotoDataUrl(customWallpaper.blob);
   if(request!==systemWallpaperRequest)return;
   if(data.length>12_000_000)throw new Error("Photo too large for system wallpaper. Choose a smaller photo.");
   native.setSystemWallpaperCustom(data,customPosition,alsoLock,request);
  }else{
   const item=WALLPAPERS[selectedWallpaper];
   if(!item)throw new Error("Wallpaper not found.");
   native.setSystemWallpaperBundled(item.id,parseInt(item.position,10)||35,alsoLock,request);
  }
 }catch(err){
  if(request===systemWallpaperRequest)status.textContent=String(err.message||"Cannot apply Android wallpaper.");
 }
}
$("wallpaperApplySystem").onclick=applySystemWallpaper;
$("wallpaperEffectSelect").onchange=e=>{
 wallpaperEffectChoice=e.target.value;deskStorage.setItem("ar_wallpaper_effect_v2",wallpaperEffectChoice);syncWallpaperMotion();
};
$("clockDesignGrid").addEventListener("click",e=>{
 const b=e.target.closest("[data-clock-design]");if(!b)return;
 clockDesign=Number(b.dataset.clockDesign);deskStorage.setItem("ar_clock_style_v1",clockDesign);
 applyClockDesign();renderClockCustomizer();
 DeskMotion.run($("launcherClock"),[{opacity:.4,transform:"translateY(4px)"},{opacity:1,transform:"translateY(0)"}]);
});
$("clockSizeSlider").addEventListener("input",e=>{
 clockSize=Number(e.target.value);deskStorage.setItem("ar_clock_size_v1",clockSize);applyClockDesign();
});
/* One Blob in IndexedDB survives restarts without base64 or broad storage permissions. */
function customWallpaperStore(write){return new Promise((resolve,reject)=>{
 const open=indexedDB.open("audio-desk-wallpapers",1);
 open.onupgradeneeded=()=>open.result.createObjectStore("wallpapers");
 open.onerror=()=>reject(open.error);
 open.onblocked=()=>reject(new Error("Photo storage is busy. Close another Audio Desk window and try again."));
 open.onsuccess=()=>{
  const db=open.result,tx=db.transaction("wallpapers",write?"readwrite":"readonly"),store=tx.objectStore("wallpapers");
  const req=write?store.put(write,"custom"):store.get("custom");
  let result;req.onsuccess=()=>{result=req.result};
  tx.oncomplete=()=>{db.close();resolve(write||result)};
  tx.onerror=()=>{db.close();reject(tx.error)};tx.onabort=()=>{db.close();reject(tx.error)};
 };
})}
function useCustomWallpaper(record){
 if(!(record?.blob instanceof Blob)||record.blob.size===0)throw new Error("Saved photo unavailable");
 if(customWallpaperUrl)URL.revokeObjectURL(customWallpaperUrl);
 customWallpaper=record;customWallpaperUrl=URL.createObjectURL(record.blob);
}
async function imageDimensions(file){
 const part=file.slice(0,1048576);
 const buffer=typeof part.arrayBuffer==='function'?await part.arrayBuffer():await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsArrayBuffer(part)});
 const b=new Uint8Array(buffer);
 const v=new DataView(b.buffer),ascii=(at,n)=>String.fromCharCode(...b.slice(at,at+n));
 if(b.length>=24&&b[0]===137&&ascii(1,3)==="PNG"&&b[4]===13&&b[5]===10&&b[6]===26&&b[7]===10)return [v.getUint32(16),v.getUint32(20)];
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
 customWallpaperSelected=true;deskStorage.setItem("ar_wallpaper_custom_v2","true");applyWallpaper();renderWallpaperPicker();
 applySystemWallpaper();
};
$("customWallpaperFile").onchange=async e=>{
 const input=e.target,file=input.files[0];if(!file)return;
 const status=$("customWallpaperStatus");status.textContent="Preparing your wallpaper…";
 const choose=$("customWallpaperChoose");choose.disabled=true;
 let decoded;
 try{
  if((file.type&&!/^image\/(jpe?g|png|webp)$/.test(file.type))||file.size>30*1024*1024)throw new Error("Choose a JPEG, PNG or WebP image smaller than 30 MB.");
  // Decode directly to a bounded bitmap, including the image's orientation.
  const dimensions=await imageDimensions(file);
  if(dimensions.some(n=>!Number.isFinite(n)||n<1))throw new Error("Invalid image dimensions.");
  if(typeof createImageBitmap==='function'){
   try{decoded=await createImageBitmap(file,{resizeWidth:Math.min(1440,...dimensions),resizeQuality:"high",imageOrientation:"from-image"})}catch{}
  }
  if(!decoded){
   if(dimensions[0]*dimensions[1]>20000000)throw new Error('This phone needs a smaller photo. Choose one below 20 megapixels.');
   const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await decodeWallpaperImage(image);decoded=image}finally{URL.revokeObjectURL(url)}
  }
  const scale=Math.min(1,1440/decoded.width,3200/decoded.height,Math.sqrt(4608000/(decoded.width*decoded.height)));
  const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(decoded.width*scale));canvas.height=Math.max(1,Math.round(decoded.height*scale));
  const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(decoded,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(Math.floor(canvas.width*.15),0,Math.max(1,Math.floor(canvas.width*.35)),Math.max(1,Math.floor(canvas.height*.35))).data;
  let luma=0;for(let i=0;i<pixels.length;i+=16)luma+=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;
  const light=luma/(pixels.length/16)>150;
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",.94));
  if(!blob)throw new Error("This image could not be prepared. Try another photo.");
  const record={blob,light,width:canvas.width,height:canvas.height};
  await customWallpaperStore(record);useCustomWallpaper(record);
  customWallpaperSelected=true;deskStorage.setItem("ar_wallpaper_custom_v2","true");
  await applyWallpaper();renderWallpaperPicker();status.textContent="Saved on this phone. Adjust the crop below.";
  applySystemWallpaper();
 }catch(error){status.textContent=error.message||"Could not save that wallpaper. Try another photo."}
 finally{if(typeof decoded?.close==="function")decoded.close();input.value="";choose.disabled=false}
};
$("customWallpaperPosition").oninput=e=>{
 customPosition=Number(e.target.value);deskStorage.setItem("ar_wallpaper_position_v2",customPosition);
 if(customWallpaperSelected&&$("wallpaperImage"))$("wallpaperImage").style.objectPosition=customPosition+"% center";
 scheduleWallpaperTone();
};
$("customWallpaperPosition").addEventListener("change",()=>{
 if(customWallpaperSelected)applySystemWallpaper();
});
$("launcherWallpaperChoose").onclick=openWallpaperPicker;$("launcherClockChoose").onclick=openClockCustomizer;
$("wallpaperClose").onclick=()=>closeCustomize();$("clockClose").onclick=()=>closeCustomize();
for(const id of ["launcherThemeDialog","launcherWallpaperDialog","launcherClockDialog"]){$(id).addEventListener("click",e=>{if(e.target===$(id))closeCustomize()})}
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
// Show a bundled portrait immediately; a blocked photo database cannot blank Home.
applyWallpaper();
const initialWallpaperLoad=wallpaperLoad;
customWallpaperStore().then(record=>{
 if(wallpaperLoad!==initialWallpaperLoad)return;
 if(record)useCustomWallpaper(record);else customWallpaperSelected=false;
 if(customWallpaperSelected)applyWallpaper();
}).catch(()=>{if(wallpaperLoad===initialWallpaperLoad)customWallpaperSelected=false});
