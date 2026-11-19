/* Audio Desk movable Home widgets / snap-to-widget layout editor.
   No browser storage other than the launcher local prefs. 8 accessible handles,
   an explicit move grip, and per-theme saved px geometry. */
(()=>{
"use strict";
const ids=["launcherClockWidget","warmDateWidget","warmAudioWidget","warmSearchWidget",
 "launcherMusicWidget","launcherFavorites","launcherRecentStrip",
 "liveClockWidget","liveCalendarWidget","liveNewsWidget","launcherAgendaWidget","launcherSplWidget","launcherMicAnalyzer"];
const byId=id=>document.getElementById(id);
const movable=()=>ids.map(byId).filter(el=>el&&!el.hidden&&el.getClientRects().length&&
  getComputedStyle(el).display!=="none"&&el.getBoundingClientRect().width>16);
const storeKey=()=>"ad_widget_layout_v2_"+launcherTheme;
const removedKey=()=>"ad_widget_removed_v1_"+launcherTheme;
const labels={launcherClockWidget:"Clock",warmDateWidget:"Date",warmAudioWidget:"Audio",warmSearchWidget:"Search",
 launcherMusicWidget:"Music player",launcherFavorites:"Favourites",launcherRecentStrip:"Recents",
 liveClockWidget:"Live clock",liveCalendarWidget:"Live calendar",liveNewsWidget:"Live news",launcherAgendaWidget:"Agenda",launcherSplWidget:"SPL meter",launcherMicAnalyzer:"Mic spectrum"};
let removed=new Set();
function readRemoved(){
 try{const saved=JSON.parse(deskStorage.getItem(removedKey())||"[]");
  return new Set(Array.isArray(saved)?saved.filter(id=>ids.includes(id)):[]);
 }catch{return new Set()}
}
function applyRemoved(){
 removed=readRemoved();
 for(const id of ids){const node=byId(id);if(node)node.toggleAttribute("data-widget-removed",removed.has(id))}
 renderRemoved();
 window.dispatchEvent(new Event("audio-desk-widget-visibility"));
}
function setRemoved(id,value){
 if(!ids.includes(id)||!byId(id))return false;
 removed=readRemoved();
 if(value)removed.add(id);else removed.delete(id);
 deskStorage.setItem(removedKey(),JSON.stringify([...removed]));
 applyRemoved();return true;
}
window.audioDeskRestoreWidget=id=>setRemoved(id,false);
window.audioDeskWidgetRemoved=id=>readRemoved().has(id);
const limit=(v,a,b)=>Math.min(Math.max(v,a),b);
let chosen=null,edit=null,hold=null,gesture=null,cancelClickUntil=0,raf=0;
let geometry={};
function read(){
 try{
  const raw=JSON.parse(deskStorage.getItem(storeKey())||"{}");
  return raw&&typeof raw==="object"?raw:{};
 }catch{return{}}
}
function save(){
 if(!chosen)return;
 const r=chosen.getBoundingClientRect();
 const size=geometry[chosen.id]||{};
 size.w=Math.round(r.width);size.h=Math.round(r.height);
 size.x=Math.round(parseFloat(chosen.style.getPropertyValue("--widget-x"))||0);
 size.y=Math.round(parseFloat(chosen.style.getPropertyValue("--widget-y"))||0);
 geometry[chosen.id]=size;
 deskStorage.setItem(storeKey(),JSON.stringify(geometry));
}
function minWidth(el,fallback){return Math.min(innerWidth-18,Math.max(fallback,Number(el?.dataset.nativeMinWidth)||0))}
function minHeight(el,fallback){return Math.max(fallback,Number(el?.dataset.nativeMinHeight)||0)}
function layoutChanged(){window.dispatchEvent(new Event("audio-desk-layout-changed"))}
function applySizes(){
 closeEditor();
 geometry=read();
 applyRemoved();
 ids.forEach(id=>{
  const el=byId(id);if(!el)return;
  const g=geometry[id];
  for(const name of ["--widget-x","--widget-y","--user-widget-width","--user-widget-height"])
   el.style.removeProperty(name);
  delete el.dataset.layoutSized;
  if(!g||![g.w,g.h,g.x,g.y].every(Number.isFinite))return;
  const width=limit(g.w,minWidth(el,id==="launcherAgendaWidget"?160:id==="launcherSplWidget"||id==="launcherMicAnalyzer"?200:100),Math.max(160,innerWidth-18));
  const minimum=minHeight(el,id==="launcherMusicWidget"?202:id==="launcherAgendaWidget"?156:id==="launcherSplWidget"||id==="launcherMicAnalyzer"?230:48);
  const height=limit(g.h,minimum,Math.max(minimum,320,innerHeight*.8));
  el.style.setProperty("--user-widget-width",Math.round(width)+"px");
  el.style.setProperty("--user-widget-height",Math.round(height)+"px");
  el.style.setProperty("--widget-x",limit(g.x,-innerWidth*.7,innerWidth*.7)+"px");
  el.style.setProperty("--widget-y",limit(g.y,-innerHeight*.7,innerHeight*.7)+"px");
  el.dataset.layoutSized="true";
 });
 // Older versions permitted overlapping saved positions. Prefer original
 // flow placement for affected widgets; retain size if that is sufficient.
 const visible=movable();
 for(const el of visible){
  if(!collisions(el).length||!geometry[el.id])continue;
  el.style.removeProperty("--widget-x");el.style.removeProperty("--widget-y");
  if(collisions(el).length){
   el.style.removeProperty("--user-widget-width");
   el.style.removeProperty("--user-widget-height");delete el.dataset.layoutSized;
  }
  if(geometry[el.id]){
   if(el.dataset.layoutSized){geometry[el.id].x=0;geometry[el.id].y=0}
   else delete geometry[el.id];
  }
 }
 deskStorage.setItem(storeKey(),JSON.stringify(geometry));layoutChanged();
}
function closeEditor(){
 hold&&clearTimeout(hold.timer);hold=null;
 edit=null;gesture=null;
 if(chosen){chosen.classList.remove("widget-editing");chosen=null}
 document.body.classList.remove("widget-dragging");
 document.getElementById("widgetLayoutOverlay")?.setAttribute("hidden","");
 guides.replaceChildren();layoutChanged();
}
const overlay=document.createElement("div");
overlay.id="widgetLayoutOverlay";
overlay.hidden=true;
overlay.setAttribute("role","group");
overlay.setAttribute("aria-label","Edit Home widget position, size or visibility");
overlay.innerHTML='<div class="layout-outline"></div>'+
 '<div class="layout-toolbar">'+
 '<button type="button" data-layout-control="remove">Remove</button>'+
 '<button type="button" data-layout-control="reset">Reset</button>'+
 '<button type="button" data-layout-control="done">Done</button></div>'+
 '<button type="button" class="layout-move-handle" data-layout-control="move" aria-label="Drag to move widget">⠿ Move</button>'+
 ["nw","n","ne","w","e","sw","s","se"].map(edge=>
  '<button type="button" class="widget-resize-handle" data-edge="'+edge+
  '" aria-label="Drag '+edge+' edge to resize widget"></button>').join("");
document.body.appendChild(overlay);
const guides=document.createElement("div");
guides.id="widgetSnapGuides";
document.body.appendChild(guides);
const edges=["nw","n","ne","w","e","sw","s","se"];
const margin=14, snapDistance=12;
function layout(el){
 const r=el.getBoundingClientRect();
 return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height};
}
function snapDimension(proposed,span,perpendicular,axis,exclude){
 const other=movable().filter(el=>el!==exclude).map(layout);
 const values=[margin,(axis==="x"?innerWidth:innerHeight)-margin];
 for(const r of other){
  const hasCross=axis==="x"?
   perpendicular[1]>=r.t-26&&perpendicular[0]<=r.b+26:
   perpendicular[1]>=r.l-26&&perpendicular[0]<=r.r+26;
  if(!hasCross)continue;
  const low=axis==="x"?r.l:r.t,high=axis==="x"?r.r:r.b;
  values.push(low,high,(low+high)/2);
 }
 let match=null,best=snapDistance+1;
 for(const target of values){
  for(const [name,point] of [["start",proposed],["end",proposed+span],["center",proposed+span/2]]){
   const d=Math.abs(point-target);
   if(d<best){best=d;match={offset:target-point,target,axis,name}}
  }
 }
 return match?{coordinate:proposed+match.offset,match}: {coordinate:proposed,match:null};
}
function showGuides(xs,ys){
 guides.replaceChildren();
 for(const s of [xs,ys]){
  if(!s?.match)continue;
  const line=document.createElement("div");
  line.className="widget-snap-line "+(s.match.axis==="x"?"vertical":"horizontal");
  if(s.match.axis==="x")line.style.left=s.match.target+"px";
  else line.style.top=s.match.target+"px";
  guides.appendChild(line);
 }
}
function moveDimensions(r,deltaX,deltaY){
 let x=limit(r.l+deltaX,margin,Math.max(margin,innerWidth-r.w-margin));
 let y=limit(r.t+deltaY,margin,Math.max(margin,innerHeight-r.h-margin));
 const sx=snapDimension(x,r.w,[y,y+r.h],"x",chosen);
 x=limit(sx.coordinate,margin,Math.max(margin,innerWidth-r.w-margin));
 const sy=snapDimension(y,r.h,[x,x+r.w],"y",chosen);
 y=limit(sy.coordinate,margin,Math.max(margin,innerHeight-r.h-margin));
 showGuides(sx,sy);
 return {l:x,t:y,r:x+r.w,b:y+r.h};
}
function resizeDimensions(start,edge,dx,dy){
 let {l,t,r,b}=start;
 if(edge.includes("w"))l+=dx;
 if(edge.includes("e"))r+=dx;
 if(edge.includes("n"))t+=dy;
 if(edge.includes("s"))b+=dy;
 const minimumWidth=minWidth(chosen,chosen?.id==="launcherMusicWidget"?175:chosen?.id==="launcherAgendaWidget"?160:chosen?.id==="launcherSplWidget"||chosen?.id==="launcherMicAnalyzer"?200:106);
 const minimumHeight=minHeight(chosen,chosen?.id==="launcherMusicWidget"?202:chosen?.id==="launcherAgendaWidget"?156:chosen?.id==="launcherSplWidget"||chosen?.id==="launcherMicAnalyzer"?230:49);
 if(chosen?.dataset.nativeHorizontal==="false"){l=start.l;r=start.r}
 if(chosen?.dataset.nativeVertical==="false"){t=start.t;b=start.b}
 if(r-l<minimumWidth){if(edge.includes("w"))l=r-minimumWidth;else r=l+minimumWidth}
 if(b-t<minimumHeight){if(edge.includes("n"))t=b-minimumHeight;else b=t+minimumHeight}
 l=limit(l,0,innerWidth-70);r=limit(r,l+minimumWidth,innerWidth);
 t=limit(t,0,innerHeight-45);b=limit(b,t+minimumHeight,Math.max(innerHeight,document.documentElement.scrollHeight));
 const sx=snapDimension(l,r-l,[t,b],"x",chosen);
 if(sx.match){
  if(edge.includes("w"))l=sx.coordinate;
  else if(edge.includes("e"))r+=sx.coordinate-l;
 }
 const sy=snapDimension(t,b-t,[l,r],"y",chosen);
 if(sy.match){
  if(edge.includes("n"))t=sy.coordinate;
  else if(edge.includes("s"))b+=sy.coordinate-t;
 }
 // Provider-fixed axes must stay fixed even after edge snapping.
 if(chosen?.dataset.nativeHorizontal==="false"){l=start.l;r=start.r}
 if(chosen?.dataset.nativeVertical==="false"){t=start.t;b=start.b}
 if(r-l<minimumWidth){if(edge.includes("w"))l=r-minimumWidth;else r=l+minimumWidth}
 if(b-t<minimumHeight){if(edge.includes("n"))t=b-minimumHeight;else b=t+minimumHeight}
 showGuides(sx,sy);
 return {l,t,r,b};
}
// Edge contact is allowed; actual intersecting interiors are not.
function overlapArea(a,b){
 return Math.max(0,Math.min(a.r,b.r)-Math.max(a.l,b.l)-1)*
  Math.max(0,Math.min(a.b,b.b)-Math.max(a.t,b.t)-1);
}
function collisions(el){
 return movable().filter(other=>other!==el&&!other.contains(el)&&!el.contains(other))
  .map(other=>({other,area:overlapArea(layout(el),layout(other))})).filter(x=>x.area>0);
}
const layoutProps=["--widget-x","--widget-y","--user-widget-width","--user-widget-height"];
function snapshot(el){
 return {values:layoutProps.map(name=>el.style.getPropertyValue(name)),sized:el.dataset.layoutSized};
}
function restoreSnapshot(el,snapshot){
 layoutProps.forEach((name,i)=>snapshot.values[i]?el.style.setProperty(name,snapshot.values[i]):el.style.removeProperty(name));
 if(snapshot.sized===undefined)delete el.dataset.layoutSized;else el.dataset.layoutSized=snapshot.sized;
}
function guardedChange(el,change){
 const before=snapshot(el);
 const nodes=movable();
 function pairs(){
  const out=new Map(),rects=nodes.map(layout);
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
   if(nodes[i].contains(nodes[j])||nodes[j].contains(nodes[i]))continue;
   out.set(i+":"+j,overlapArea(rects[i],rects[j]));
  }
  return out;
 }
 const previous=pairs();
 change();
 // Check actual DOM bounds after CSS, not only requested geometry:
 // resizing one flow item can move another item's natural position.
 if([...pairs()].some(([key,area])=>area>(previous.get(key)||0)+1)){
  restoreSnapshot(el,before);guides.replaceChildren();return false;
 }
 return true;
}
function setRect(rect,original){
 if(!chosen)return;
 const width=Math.round(rect.r-rect.l),height=Math.round(rect.b-rect.t);
 const naturalLeft=original.l-Number(chosen.style.getPropertyValue("--widget-x").replace("px","")||0);
 const naturalTop=original.t-Number(chosen.style.getPropertyValue("--widget-y").replace("px","")||0);
 chosen.style.setProperty("--user-widget-width",width+"px");
 chosen.style.setProperty("--user-widget-height",height+"px");
 chosen.style.setProperty("--widget-x",Math.round(rect.l-naturalLeft)+"px");
 chosen.style.setProperty("--widget-y",Math.round(rect.t-naturalTop)+"px");
 chosen.dataset.layoutSized="true";
 requestPos();
}
function requestPos(){
 cancelAnimationFrame(raf);raf=requestAnimationFrame(position);
}
function position(){
 if(!chosen||overlay.hidden)return;
 layoutChanged();
 const r=chosen.getBoundingClientRect();
 const outline=overlay.querySelector(".layout-outline");
 Object.assign(outline.style,{left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px"});
 const centerX=(r.left+r.right)/2,centerY=(r.top+r.bottom)/2;
 const positions={
  nw:[r.left,r.top],n:[centerX,r.top],ne:[r.right,r.top],
  w:[r.left,centerY],e:[r.right,centerY],
  sw:[r.left,r.bottom],s:[centerX,r.bottom],se:[r.right,r.bottom]
 };
 for(const button of overlay.querySelectorAll(".widget-resize-handle")){
  const p=positions[button.dataset.edge];
  button.style.left=limit(p[0],17,innerWidth-17)+"px";
  button.style.top=limit(p[1],17,innerHeight-17)+"px";
 }
 const bar=overlay.querySelector(".layout-toolbar"),grip=overlay.querySelector(".layout-move-handle");
 bar.style.left=limit(r.left,5,Math.max(5,innerWidth-bar.offsetWidth-5))+"px";
 bar.style.top=limit(r.top-49,11,innerHeight-42)+"px";
 grip.style.left=limit(centerX,50,innerWidth-50)+"px";
 grip.style.top=limit(r.top+28,30,innerHeight-30)+"px";
}
function openEditor(id){
 const el=byId(id);if(!el||!movable().includes(el))return false;
 closeEditor();
 chosen=el;chosen.classList.add("widget-editing");
 overlay.hidden=false;
 cancelClickUntil=Date.now()+850;
 position();
 return true;
}
window.audioDeskBeginWidgetResize=openEditor;
window.audioDeskRestoreWidgetLayouts=applySizes;
overlay.addEventListener("click",e=>{
 const action=e.target.closest("[data-layout-control]")?.dataset.layoutControl;
 if(action==="done"){save();closeEditor()}
 if(action==="remove"&&chosen){
  const id=chosen.id;save();closeEditor();setRemoved(id,true);
 }
 if(action==="reset"&&chosen){
  delete geometry[chosen.id];deskStorage.setItem(storeKey(),JSON.stringify(geometry));
  const el=chosen;closeEditor();
  ["--widget-x","--widget-y","--user-widget-width","--user-widget-height"].forEach(x=>el.style.removeProperty(x));
  delete el.dataset.layoutSized;layoutChanged();
 }
});
overlay.addEventListener("pointerdown",e=>{
 const target=e.target.closest("[data-edge],[data-layout-control='move']");
 if(!target||!chosen||e.button!==0)return;
 e.preventDefault();e.stopPropagation();
 const initial=layout(chosen);
 gesture={pointerId:e.pointerId,kind:target.dataset.edge?"resize":"move",
  edge:target.dataset.edge,x:e.clientX,y:e.clientY,rect:initial,
  initialX:Number(chosen.style.getPropertyValue("--widget-x").replace("px",""))||0,
  initialY:Number(chosen.style.getPropertyValue("--widget-y").replace("px",""))||0};
 target.setPointerCapture?.(e.pointerId);
 document.body.classList.add("widget-dragging");
});
overlay.addEventListener("pointermove",e=>{
 if(!gesture||gesture.pointerId!==e.pointerId)return;
 e.preventDefault();
 const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
 const rect=gesture.kind==="move"?
   moveDimensions(gesture.rect,dx,dy):
   resizeDimensions(gesture.rect,gesture.edge,dx,dy);
 const naturalLeft=gesture.rect.l-gesture.initialX,naturalTop=gesture.rect.t-gesture.initialY;
 guardedChange(chosen,()=>{
  if(gesture.kind==="resize"){
   chosen.style.setProperty("--user-widget-width",Math.round(rect.r-rect.l)+"px");
   chosen.style.setProperty("--user-widget-height",Math.round(rect.b-rect.t)+"px");
   chosen.dataset.layoutSized="true";
  }
  chosen.style.setProperty("--widget-x",Math.round(rect.l-naturalLeft)+"px");
  chosen.style.setProperty("--widget-y",Math.round(rect.t-naturalTop)+"px");
 });
 requestPos();
});
function endGesture(e){
 if(!gesture||gesture.pointerId!==e.pointerId)return;
 gesture=null;save();guides.replaceChildren();
 document.body.classList.remove("widget-dragging");
 requestPos();
}
overlay.addEventListener("pointerup",endGesture);
overlay.addEventListener("pointercancel",endGesture);
overlay.addEventListener("keydown",e=>{
 const btn=e.target.closest("[data-edge],[data-layout-control='move']");
 if(!btn||!chosen||!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))return;
 e.preventDefault();
 const delta=e.shiftKey?1:10;
 const dx=(e.key==="ArrowLeft"?-delta:e.key==="ArrowRight"?delta:0);
 const dy=(e.key==="ArrowUp"?-delta:e.key==="ArrowDown"?delta:0);
 const r=layout(chosen);
 const pos=btn.dataset.edge?resizeDimensions(r,btn.dataset.edge,dx,dy):moveDimensions(r,dx,dy);
 const oldX=Number(chosen.style.getPropertyValue("--widget-x").replace("px",""))||0;
 const oldY=Number(chosen.style.getPropertyValue("--widget-y").replace("px",""))||0;
 guardedChange(chosen,()=>{
  if(btn.dataset.edge){
   chosen.style.setProperty("--user-widget-width",Math.round(pos.r-pos.l)+"px");
   chosen.style.setProperty("--user-widget-height",Math.round(pos.b-pos.t)+"px");
   chosen.dataset.layoutSized="true";
  }
  chosen.style.setProperty("--widget-x",Math.round(oldX+pos.l-r.l)+"px");
  chosen.style.setProperty("--widget-y",Math.round(oldY+pos.t-r.t)+"px");
 });save();requestPos();
});
function registerWidget(id){
 const el=byId(id);if(!el||el.dataset.widgetResizable==="true")return;
 el.dataset.widgetResizable="true";el.addEventListener("contextmenu",e=>e.preventDefault());
 el.addEventListener("pointerdown",e=>{
  if(e.button!==0||launcherPage!=="home"||e.target.closest(".launcher-app,.folder-tile,[data-folder-id]"))return;
  clearTimeout(hold?.timer);
  hold={id,x:e.clientX,y:e.clientY,pointerId:e.pointerId,
   timer:setTimeout(()=>{hold=null;openEditor(id)},550)};
 });
 el.addEventListener("pointermove",e=>{
  if(!hold||hold.pointerId!==e.pointerId)return;
  if(Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>10){
   clearTimeout(hold.timer);hold=null;
  }
 });
 for(const type of ["pointerup","pointercancel","pointerleave"]){
  el.addEventListener(type,()=>{if(hold){clearTimeout(hold.timer);hold=null}});
 }
}
for(const id of ids)registerWidget(id);
window.audioDeskRegisterNativeWidget=(id,label)=>{
 if(!/^nativeWidget_\d+$/.test(id)||!byId(id))return;
 if(!ids.includes(id))ids.push(id);
 labels[id]=String(label);registerWidget(id);
};
window.audioDeskUnregisterNativeWidget=id=>{
 if(!/^nativeWidget_\d+$/.test(id))return;
 const i=ids.indexOf(id);if(i>=0)ids.splice(i,1);delete labels[id];
 for(const theme of ["minimal","pixel","windows","warm"]){
  const k="ad_widget_layout_v2_"+theme,r="ad_widget_removed_v1_"+theme;
  try{const g=JSON.parse(deskStorage.getItem(k)||"{}");delete g[id];deskStorage.setItem(k,JSON.stringify(g));}catch{}
  try{const h=JSON.parse(deskStorage.getItem(r)||"[]");deskStorage.setItem(r,JSON.stringify(h.filter(v=>v!==id)));}catch{}
 }
};
document.addEventListener("click",e=>{
 // Suppress only the matching long-pressed widget, never unrelated widgets.
 // Dismissing the editor must restore normal click actions immediately.
 if(chosen&&Date.now()<cancelClickUntil&&e.target.closest("[data-widget-resizable]")===chosen){
  e.preventDefault();e.stopImmediatePropagation();
 }
},true);
document.addEventListener("keydown",e=>{
 if(e.key==="Escape"&&!overlay.hidden)closeEditor();
});
document.addEventListener("pointerdown",e=>{
 if(chosen&&!e.target.closest("#widgetLayoutOverlay")&&!e.target.closest("#"+chosen.id))closeEditor();
},true);
window.addEventListener("resize",()=>{applySizes();requestPos()});
window.addEventListener("launcher-page-changed",closeEditor);
const restoreToggle=document.createElement("button");
restoreToggle.id="widgetRestoreToggle";restoreToggle.type="button";
restoreToggle.className="launcher-options-action";
restoreToggle.setAttribute("aria-expanded","false");
const restoreList=document.createElement("div");
restoreList.id="widgetRestoreList";restoreList.hidden=true;
const anchor=byId("launcherThemeChoose");
anchor?.after(restoreToggle,restoreList);
restoreToggle.onclick=()=>{
 restoreList.hidden=!restoreList.hidden;
 restoreToggle.setAttribute("aria-expanded",String(!restoreList.hidden));
};
function renderRemoved(){
 restoreToggle.textContent="▤ RESTORE WIDGETS"+(removed.size?" ("+removed.size+")":"");
 restoreList.replaceChildren();
 if(!removed.size){
  const p=document.createElement("p");p.textContent="No removed widgets in this theme.";restoreList.append(p);return;
 }
 for(const id of removed){
  const b=document.createElement("button");b.type="button";b.className="launcher-options-action";
  b.dataset.restoreWidget=id;b.textContent="+ Restore "+labels[id];
  b.onclick=()=>{setRemoved(id,false);};
  restoreList.append(b);
 }
}
applySizes();
})();
