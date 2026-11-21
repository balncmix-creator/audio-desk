/* Native RemoteViews host slots share the same collision-safe editor as
   all other Home widgets. Native views are clipped to the visible viewport. */
(()=>{
"use strict";
const api=window.AudioDesk;
if(typeof api?.layoutNativeWidgets!=="function")return;
const home=document.getElementById("launcherHomePage"),anchor=document.getElementById("launcherFavorites");
const slots=new Map();
let raf=0,lastPayload="",motionUntil=0;
function schedule(animate=false){
 if(animate)motionUntil=performance.now()+350;
 if(!raf)raf=requestAnimationFrame(sync);
}
function hiddenByOverlay(){
 if(document.body.classList.contains("widget-dragging"))return true;
 const editing=document.getElementById("widgetLayoutOverlay");
 if(editing&&!editing.hidden)return true;
 // Both built-in and dynamically-created modal sheets take precedence.
 if(typeof hasLauncherOverlay==="function"&&hasLauncherOverlay())return true;
 return [...document.querySelectorAll('[role="dialog"],[aria-modal="true"],.customize-overlay')].some(el=>el.id!=="orbitWidgetPreview"&&!el.hidden&&el.getClientRects().length&&getComputedStyle(el).visibility!=="hidden"&&getComputedStyle(el).display!=="none");
}
function sync(now=performance.now()){
 raf=0;
 const orbit=launcherTheme==="orbit";
 const active=launcherTheme!=="extreme"&&launcherPage==="home"&&!home.hidden&&!document.hidden&&window.audioDeskForeground!==false;
 const allowed=active&&!hiddenByOverlay();
 const style=getComputedStyle(document.documentElement);
 const top=Math.max(0,parseFloat(style.getPropertyValue("--status-top"))||0);
 const bottom=innerHeight-Math.max(0,parseFloat(style.getPropertyValue("--system-bottom"))||0);
 const out=[];
 if(allowed&&orbit){
  // The current Android widget renders inside Orbit's custom ring.
  // Other widgets remain hosted but hidden to preserve their state.
  const target=window.audioDeskOrbitWidgetSlot?.();
  if(target&&slots.has(target.id)){
   const {x,y,w,h}=target;
   if([x,y,w,h].every(Number.isFinite)&&w>0&&h>0)
    out.push({id:target.id,x,y,w,h,left:0,top,right:innerWidth,bottom,radius:11});
  }
 }
 if(allowed&&!orbit)for(const [id,entry] of slots){
  if(entry.node.hidden||entry.node.hasAttribute("data-widget-removed")||!entry.node.getClientRects().length)continue;
  const b=entry.body.getBoundingClientRect();
  if(b.width<1||b.height<1||b.bottom<=top||b.top>=bottom)continue;
  // Never cover the Home controls or alphabet rail at the edges.
  let right=innerWidth;
  const rail=document.getElementById("launcherAlphaIndex");
  if(rail&&rail.getClientRects().length&&getComputedStyle(rail).visibility!=="hidden"){
   const r=rail.getBoundingClientRect();
   if(b.top<r.bottom&&b.bottom>r.top&&r.left>b.left)right=Math.min(right,r.left-2);
  }
  if(b.left>=right||b.right<=0)continue;
  const radius=parseFloat(getComputedStyle(entry.body).borderTopLeftRadius)||0;
  out.push({id,x:b.left,y:b.top,w:b.width,h:b.height,left:0,top,right,bottom,radius});
 }
 const payload=JSON.stringify({home:allowed,width:innerWidth,slots:out});
 if(payload!==lastPayload){lastPayload=payload;api.layoutNativeWidgets(payload)}
 if(now<motionUntil&&active)schedule();
}
window.audioDeskSyncNativeWidgets=()=>{lastPayload="";schedule(true)};
window.audioDeskOrbitWidgets=()=>[...slots].map(([id,e])=>({
 id,label:e.label.textContent||"App widget",
 pkg:e.node.dataset.nativeWidgetPackage||"",
 accent:e.node.style.getPropertyValue("--native-provider-accent")||""
}));
const resize=typeof ResizeObserver==="function"?new ResizeObserver(()=>schedule(true)):null;
resize?.observe(home);
function create(entry){
 const id="nativeWidget_"+entry.id,node=document.createElement("section");
 node.id=id;node.className="native-app-widget";node.setAttribute("aria-label",entry.label+" widget");
 const head=document.createElement("div");head.className="native-widget-head";
 const label=document.createElement("span");label.textContent=entry.label;
 const edit=document.createElement("button");edit.type="button";edit.textContent="⋯";edit.setAttribute("aria-label","Edit "+entry.label+" widget");
 edit.onclick=()=>window.audioDeskBeginWidgetResize?.(id);
 head.append(label,edit);
 const body=document.createElement("div");body.className="native-widget-body";
 const hint=document.createElement("span");hint.textContent="Android app widget";body.append(hint);
 node.append(head,body);
 anchor.before(node);
 const result={node,body,label,edit};
 slots.set(entry.id,result);resize?.observe(node);
 window.audioDeskRegisterNativeWidget?.(id,entry.label);
 return result;
}
const settings=document.getElementById("nativeWidgetsOpen");
const manage=document.createElement("button");manage.className="launcher-options-action";manage.type="button";manage.textContent="Manage app widgets";
settings.after(manage);
const list=document.createElement("div");list.className="native-widget-manage";list.hidden=true;manage.after(list);
manage.onclick=()=>{list.hidden=!list.hidden};
function renderManage(){
 list.replaceChildren();manage.hidden=!slots.size;
 for(const [id,e] of slots){
  const button=document.createElement("button");button.type="button";button.className="launcher-options-action";
  button.textContent="Delete "+e.label.textContent+" from all themes";
  button.onclick=()=>{if(confirm("Delete this app widget from all Audio Desk themes?"))api.deleteNativeWidget(id)};
  list.append(button);
 }
}
window.receiveAudioDeskNativeWidgets=data=>{
 if(!Array.isArray(data))return;
 const incoming=new Set();
 let changed=false;
 for(const raw of data.slice(0,64)){
  if(!Number.isInteger(raw?.id)||raw.id<=0)continue;
  incoming.add(raw.id);
  const name=String(raw.label||"App widget").slice(0,150);
  let entry=slots.get(raw.id);
  if(!entry){entry=create({id:raw.id,label:name});changed=true}
  const {node,body,label}=entry;
  label.textContent=name;
  node.dataset.nativeWidgetPackage=typeof raw.pkg==="string"?raw.pkg:"";
  const accent=String(raw.accent||"");
  if(/^#[0-9a-f]{6}$/i.test(accent))node.style.setProperty("--native-provider-accent",accent);
  else node.style.removeProperty("--native-provider-accent");
  const w=Math.max(100,Math.min(800,Number(raw.width)||220)),h=Math.max(70,Math.min(900,Number(raw.height)||130));
  const mw=Math.max(72,Math.min(w,Number(raw.minWidth)||w)),mh=Math.max(56,Math.min(h,Number(raw.minHeight)||h));
  node.dataset.nativeMinWidth=String(mw);node.dataset.nativeMinHeight=String(mh+28);
  node.dataset.nativeHorizontal=String(raw.horizontal!==false);node.dataset.nativeVertical=String(raw.vertical!==false);
  node.style.setProperty("--native-default-width",w+"px");
  node.style.setProperty("--native-default-height",h+"px");
  window.audioDeskRegisterNativeWidget?.(node.id,name);
 }
 for(const [id,entry] of slots)if(!incoming.has(id)){
  resize?.unobserve(entry.node);window.audioDeskUnregisterNativeWidget?.(entry.node.id);
  entry.node.remove();slots.delete(id);changed=true;
 }
 if(changed)window.audioDeskRestoreWidgetLayouts?.();
 renderManage();lastPayload="";schedule(true);
 window.dispatchEvent(new Event("audio-desk-native-widgets-changed"));
};
for(const event of ["audio-desk-layout-changed","audio-desk-widget-visibility","launcher-page-changed","audio-desk-foreground","audio-desk-theme-changed"])window.addEventListener(event,()=>schedule(true));
window.addEventListener("scroll",()=>schedule(),{passive:true,capture:true});
window.addEventListener("resize",()=>schedule(true));
document.addEventListener("visibilitychange",()=>schedule());
const oldTheme=setLauncherTheme;setLauncherTheme=function(theme){oldTheme(theme);schedule(true)};
const observer=new MutationObserver(()=>schedule(true));
observer.observe(document.body,{attributes:true,attributeFilter:["class","data-launcher-theme","data-home-page"]});
observer.observe(home,{subtree:true,attributes:true,attributeFilter:["hidden","data-widget-removed","data-layout-sized"]});
for(const id of ["widgetLayoutOverlay","launcherHomeOptions","launcherLetterPanel","launcherShortcutMenu","launcherThemeDialog","launcherWallpaperDialog","launcherClockDialog","gridDetail","agendaOverlay","launcherFolderSheet","musicSpectrumTuningOverlay"]){
 const node=document.getElementById(id);if(node)observer.observe(node,{attributes:true,attributeFilter:["hidden","class"]});
}
api.requestNativeWidgets?.();schedule();
})();
