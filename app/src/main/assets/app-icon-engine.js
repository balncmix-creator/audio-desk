/* Audio Desk's on-device icon designer.
 * Android owns the icon artwork; Audio Desk remaps its tones offline to the
 * selected theme. Only icons about to become visible are requested; raw app
 * icons are never included in the multi-thousand-item app scan.
 */
(()=>{
"use strict";
const native=window.AudioDesk;
const canFetch=typeof native?.requestLauncherIcon==="function";
const modes=new Set(["warm","minimal","windows","pixel"]);
const key=(pkg,activity,theme)=>theme+"\u001f"+pkg+"\u001f"+activity;
const maxMemory=320;
const cache=new Map(); // per-session UI cache; Android keeps a bounded disk cache
const inflight=new Set(),queue=[],queued=new Set();
const limitConcurrent=4;
let scheduled=false;
const iconSelector=".auto-app-icon[data-icon-pkg][data-icon-activity]";
function cachePut(k,value){
 if(cache.has(k))cache.delete(k);
 cache.set(k,value);
 if(cache.size>maxMemory)cache.delete(cache.keys().next().value);
}
function apply(wrapper,image){
 if(!wrapper.isConnected)return;
 if(typeof image==="string"&&image.startsWith("data:image/png;base64,")&&image.length>60&&image.length<85000){
  const img=wrapper.querySelector(".native-app-image");
  if(!img)return;
  img.onload=()=>{
   if(!wrapper.isConnected)return;
   img.hidden=false;
   wrapper.classList.add("has-native-icon");
   wrapper.dataset.iconState="loaded";
  };
  img.onerror=()=>{
   img.hidden=true;wrapper.classList.remove("has-native-icon");
   wrapper.dataset.iconState="fallback";
  };
  img.src=image;
 }else wrapper.dataset.iconState="fallback";
}
function finish(pkg,activity,theme,image){
 if(!modes.has(theme))return;
 const k=key(pkg,activity,theme);
 inflight.delete(k);
 cachePut(k,image||null);
 for(const wrapper of document.querySelectorAll(iconSelector)){
  if(wrapper.dataset.iconTheme===theme&&wrapper.dataset.iconPkg===pkg&&
    wrapper.dataset.iconActivity===activity)apply(wrapper,image);
 }
 pump();
}
window.receiveAudioDeskAppIcon=finish;
function request(wrapper){
 if(!canFetch||!wrapper.isConnected)return;
 const pkg=wrapper.dataset.iconPkg,activity=wrapper.dataset.iconActivity;
 const theme=wrapper.dataset.iconTheme||launcherTheme,k=key(pkg,activity,theme);
 if(cache.has(k)){apply(wrapper,cache.get(k));return}
 if(queued.has(k)||inflight.has(k))return;
 queued.add(k);queue.push({pkg,activity,theme,k});
 pump();
}
function pump(){
 while(queue.length&&inflight.size<limitConcurrent){
  const item=queue.shift();
  queued.delete(item.k);
  if(cache.has(item.k)||inflight.has(item.k))continue;
  inflight.add(item.k);
  try{native.requestLauncherIcon(item.pkg,item.activity,item.theme)}
  catch(_){finish(item.pkg,item.activity,item.theme,null)}
 }
}
const observer=("IntersectionObserver" in window)?
 new IntersectionObserver(entries=>{
  for(const entry of entries){
   if(entry.isIntersecting){observer.unobserve(entry.target);request(entry.target)}
  }
 },{root:null,rootMargin:"240px 0px"}):null;
function prepare(){
 if(!canFetch)return;
 for(const wrapper of document.querySelectorAll(iconSelector)){
  if(wrapper.dataset.iconObserved)return;
  wrapper.dataset.iconObserved="true";
  const k=key(wrapper.dataset.iconPkg,wrapper.dataset.iconActivity,wrapper.dataset.iconTheme);
  if(cache.has(k)){apply(wrapper,cache.get(k));continue}
  if(observer)observer.observe(wrapper);
  else request(wrapper);
 }
}
function schedule(){
 if(scheduled)return;
 scheduled=true;
 requestAnimationFrame(()=>{scheduled=false;prepare()});
}
const originalIcon=launcherIcon;
launcherIcon=function(app){
 const fallback=originalIcon(app);
 if(!app||!app.pkg||!app.activity)return fallback;
 const theme=modes.has(launcherTheme)?launcherTheme:"minimal";
 const pkg=esc(app.pkg),activity=esc(app.activity);
 return '<span class="auto-app-icon" data-icon-pkg="'+pkg+
  '" data-icon-activity="'+activity+'" data-icon-theme="'+theme+
  '" aria-hidden="true">'+
  '<span class="icon-fallback">'+fallback+'</span>'+
  '<img class="native-app-image" alt="" decoding="async" hidden></span>';
};
// Re-render the existing Home, list, Recents, and alphabet using icon wrappers.
// Folders use launcherIcon when they open so icons work there as well.
renderLauncherHome();
renderLauncherApps();
renderLauncherRecents();
const mutation=new MutationObserver(schedule);
mutation.observe(document.body,{childList:true,subtree:true});
window.addEventListener("launcher-page-changed",schedule);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)schedule()});
window.audioDeskRefreshThemeIcons=()=>{
 cache.clear();
 inflight.clear();
 queue.length=0;queued.clear();
 for(const wrapper of document.querySelectorAll(iconSelector)){
  wrapper.removeAttribute("data-icon-observed");
  wrapper.dataset.iconState="pending";
  wrapper.classList.remove("has-native-icon");
  const img=wrapper.querySelector(".native-app-image");
  if(img){img.hidden=true;img.removeAttribute("src")}
 }
 schedule();
};
schedule();
})();
