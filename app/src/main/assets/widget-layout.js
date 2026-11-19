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
 size.natural=chosen.dataset.layoutSized!=="true";
 size.w=Math.round(r.width);size.h=Math.round(r.height);
 size.x=Math.round(parseFloat(chosen.style.getPropertyValue("--widget-x"))||0);
 size.y=Math.round(parseFloat(chosen.style.getPropertyValue("--widget-y"))||0);
 geometry[chosen.id]=size;
 deskStorage.setItem(storeKey(),JSON.stringify(geometry));
}
function minWidth(el,fallback){return Math.min(innerWidth-18,Math.max(el?.id==="launcherMusicWidget"?76:fallback,Number(el?.dataset.nativeMinWidth)||0))}
function minHeight(el,fallback){return Math.max(el?.id==="launcherMusicWidget"?48:fallback,Number(el?.dataset.nativeMinHeight)||0)}
function layoutChanged(){window.dispatchEvent(new Event("audio-desk-layout-changed"))}
function applySizes(){
 closeEditor();
 document.body.classList.add("widget-dragging");
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
  const height=limit(g.h,minimum,Math.max(minimum,innerHeight*4));
  if(!g.natural){
   el.style.setProperty("--user-widget-width",Math.round(width)+"px");
   el.style.setProperty("--user-widget-height",Math.round(height)+"px");
   el.dataset.layoutSized="true";
  }
  el.style.setProperty("--widget-x",limit(g.x,-innerWidth,innerWidth)+"px");
  const maxOffset=Math.max(innerHeight,Math.min(40000,Math.abs(g.y)));
  el.style.setProperty("--widget-y",limit(g.y,-maxOffset,maxOffset)+"px");
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
 deskStorage.setItem(storeKey(),JSON.stringify(geometry));updateHomeExtent();document.body.classList.remove("widget-dragging");layoutChanged();
}
function closeEditor(){
 hold&&clearTimeout(hold.timer);hold=null;
 edit=null;gesture=null;
 if(chosen){chosen.classList.remove("widget-editing");chosen=null}
 document.body.classList.remove("widget-dragging","widget-layout-editing");
 document.getElementById("widgetLayoutOverlay")?.setAttribute("hidden","");
 guides.replaceChildren();overlay.style.removeProperty("--ds-accent");guides.style.removeProperty("--ds-accent");layoutChanged();
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
// Only the moving edge may snap. Never compare a stationary opposite edge
// or a center: that would make the handle stick even while the finger moves.
function edgeSnap(point,axis,low,high,perp,neighbors,enabled){
 const raw=limit(point,low,Math.max(low,high));
 if(!enabled)return {coordinate:raw,match:null};
 const screen=axis==="x"?innerWidth:innerHeight;
 const targets=[{target:0,priority:1},{target:margin,priority:1},
  {target:screen-margin,priority:1},{target:screen,priority:1}];
 for(const r of neighbors){
  const p=axis==="x"?[r.t,r.b]:[r.l,r.r];
  const gap=Math.max(0,p[0]-perp[1],perp[0]-p[1]);
  const a=axis==="x"?r.l:r.t,b=axis==="x"?r.r:r.b;
  // Nearby intersections are preferred, but aligned edges on the next
  // row/column are useful too. Offscreen neighbors are ignored.
  if(r.b<0||r.t>innerHeight||r.r<0||r.l>innerWidth)continue;
  targets.push({target:a,priority:gap<=26?0:2},{target:b,priority:gap<=26?0:2});
 }
 const valid=targets.filter(v=>v.target>=low-.01&&v.target<=high+.01&&Math.abs(v.target-raw)<=snapDistance)
  .sort((a,b)=>Math.abs(a.target-raw)-Math.abs(b.target-raw)||a.priority-b.priority);
 const best=valid[0];
 return best?{coordinate:best.target,match:{axis,target:best.target}}:{coordinate:raw,match:null};
}
function resizeDimensions(start,edge,dx,dy,snap=true){
 let {l,t,r,b}=start;
 const mw=Math.min(start.w,minWidth(chosen,chosen?.id==="launcherMusicWidget"?175:chosen?.id==="launcherAgendaWidget"?160:chosen?.id==="launcherSplWidget"||chosen?.id==="launcherMicAnalyzer"?200:106));
 const mh=Math.min(start.h,minHeight(chosen,chosen?.id==="launcherMusicWidget"?202:chosen?.id==="launcherAgendaWidget"?156:chosen?.id==="launcherSplWidget"||chosen?.id==="launcherMicAnalyzer"?230:49));
 const west=edge.includes("w")&&chosen?.dataset.nativeHorizontal!=="false";
 const east=edge.includes("e")&&chosen?.dataset.nativeHorizontal!=="false";
 const north=edge.includes("n")&&chosen?.dataset.nativeVertical!=="false";
 const south=edge.includes("s")&&chosen?.dataset.nativeVertical!=="false";
 const others=movable().filter(el=>el!==chosen&&!el.contains(chosen)&&!chosen.contains(el)).map(layout);
 // Keep the original opposite edge fixed even at screen bounds. Allow
 // document-relative vertical resizing when the Home page is scrolled.
 const topBound=Math.min(start.t,-window.scrollY),bottomBound=Math.max(start.b,innerHeight,document.documentElement.scrollHeight-window.scrollY);
 // A card already touching or extending beyond the viewport must not
 // reverse resize direction when the CSS width cap is reached.
 const maxW=Math.max(start.w,innerWidth);
 const westBound=Math.min(start.l,Math.max(0,start.r-maxW));
 const eastBound=Math.max(start.r,Math.min(innerWidth,start.l+maxW));
 if(west)l=limit(start.l+dx,westBound,start.r-mw);
 if(east)r=limit(start.r+dx,start.l+mw,eastBound);
 if(north)t=limit(start.t+dy,topBound,start.b-mh);
 if(south)b=limit(start.b+dy,start.t+mh,bottomBound);
 let sx=null,sy=null;
 if(west||east){
  sx=edgeSnap(west?l:r,"x",west?westBound:start.l+mw,west?start.r-mw:eastBound,[t,b],others,snap);
  if(west)l=sx.coordinate;else r=sx.coordinate;
 }
 if(north||south){
  sy=edgeSnap(north?t:b,"y",north?topBound:start.t+mh,north?start.b-mh:bottomBound,[l,r],others,snap);
  if(north)t=sy.coordinate;else b=sy.coordinate;
 }
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
function offset(el,axis){return parseFloat(el.style.getPropertyValue("--widget-"+axis))||0}
// Width/height changes may change a centered or grid-aligned widget's
// natural origin. Read the actual rect AFTER sizing, then compensate the
// translate to keep the requested opposite edge anchored.
function applyRect(rect,edge){
 const el=chosen;if(!el)return;
 const current=layout(el);
 if(edge){
  if(edge.includes("w")||edge.includes("e"))
   el.style.setProperty("--user-widget-width",Math.round(rect.r-rect.l)+"px");
  else el.style.setProperty("--user-widget-width",Math.round(current.w)+"px");
  if(edge.includes("n")||edge.includes("s"))
   el.style.setProperty("--user-widget-height",Math.round(rect.b-rect.t)+"px");
  else el.style.setProperty("--user-widget-height",Math.round(current.h)+"px");
  el.dataset.layoutSized="true";
 }
 const measured=layout(el);
 const x=edge?.includes("w")&&el.dataset.nativeHorizontal!=="false"?rect.r-measured.r:rect.l-measured.l;
 const y=edge?.includes("n")&&el.dataset.nativeVertical!=="false"?rect.b-measured.b:rect.t-measured.t;
 el.style.setProperty("--widget-x",Math.round(offset(el,"x")+x)+"px");
 el.style.setProperty("--widget-y",Math.round(offset(el,"y")+y)+"px");
}
// A bad snap candidate should not freeze a valid raw drag. Try the exact
// unsnapped target; if still blocked, advance toward it up to the last safe
// boundary. Geometry is checked after CSS has actually laid out neighbors.
function applySafeResize(rect,raw,edge){
 if(guardedChange(chosen,()=>applyRect(rect,edge)))return;
 if(guardedChange(chosen,()=>applyRect(raw,edge)))return;
 const from=layout(chosen);
 let lo=0,hi=1;
 for(let i=0;i<7;i++){
  const k=(lo+hi)/2;
  const p={};for(const key of ["l","t","r","b"])p[key]=from[key]+(raw[key]-from[key])*k;
  if(guardedChange(chosen,()=>applyRect(p,edge)))lo=k;else hi=k;
 }
 guides.replaceChildren();
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
  const edge=button.dataset.edge,p=positions[edge];
  button.disabled=(chosen.dataset.nativeHorizontal==="false"&&/[we]/.test(edge))||
   (chosen.dataset.nativeVertical==="false"&&/[ns]/.test(edge));
  const halfW=(button.offsetWidth||34)/2,halfH=(button.offsetHeight||34)/2;
  button.style.left=limit(p[0],Math.max(halfW+1,28),innerWidth-Math.max(halfW+1,28))+"px";
  button.style.top=limit(p[1],halfH+1,innerHeight-halfH-1)+"px";
 }
 const bar=overlay.querySelector(".layout-toolbar"),grip=overlay.querySelector(".layout-move-handle");
 bar.style.left=limit(r.left,5,Math.max(5,innerWidth-bar.offsetWidth-5))+"px";
 const top=r.top-49,bottom=r.bottom+20;
 bar.style.top=limit(top>=11?top:bottom+bar.offsetHeight<innerHeight?bottom:11,11,innerHeight-42)+"px";
 grip.style.left=limit(centerX,50,innerWidth-50)+"px";
 grip.style.top=limit(centerY,30,innerHeight-30)+"px";
}
function openEditor(id){
 const el=byId(id);if(!el||!movable().includes(el))return false;
 closeEditor();
 chosen=el;chosen.classList.add("widget-editing");document.body.classList.add("widget-layout-editing");
 const accent=el.style.getPropertyValue("--native-provider-accent").trim();
 if(/^#[0-9a-f]{6}$/i.test(accent)){
  overlay.style.setProperty("--ds-accent",accent);guides.style.setProperty("--ds-accent",accent);
 }
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
  delete el.dataset.layoutSized;updateHomeExtent();layoutChanged();
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
 try{target.setPointerCapture?.(e.pointerId)}catch{}
 document.body.classList.add("widget-dragging");
});
overlay.addEventListener("pointermove",e=>{
 if(!gesture||gesture.pointerId!==e.pointerId)return;
 e.preventDefault();
 const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
 const rect=gesture.kind==="move"?
   moveDimensions(gesture.rect,dx,dy):
   resizeDimensions(gesture.rect,gesture.edge,dx,dy);
 if(gesture.kind==="resize"){
  // Preserve guides from the snapped proposal while computing raw fallback.
  const savedGuides=[...guides.children];
  const raw=resizeDimensions(gesture.rect,gesture.edge,dx,dy,false);
  guides.replaceChildren(...savedGuides);
  applySafeResize(rect,raw,gesture.edge);
 }else guardedChange(chosen,()=>applyRect(rect,null));
 requestPos();
});
function endGesture(e){
 if(!gesture||gesture.pointerId!==e.pointerId)return;
 gesture=null;save();updateHomeExtent();guides.replaceChildren();
 document.body.classList.remove("widget-dragging");
 requestPos();
}
overlay.addEventListener("pointerup",endGesture);
overlay.addEventListener("pointercancel",endGesture);
overlay.addEventListener("lostpointercapture",endGesture);
overlay.addEventListener("keydown",e=>{
 const btn=e.target.closest("[data-edge],[data-layout-control='move']");
 if(!btn||!chosen||!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))return;
 e.preventDefault();
 const delta=e.shiftKey?1:10;
 const dx=(e.key==="ArrowLeft"?-delta:e.key==="ArrowRight"?delta:0);
 const dy=(e.key==="ArrowUp"?-delta:e.key==="ArrowDown"?delta:0);
 const r=layout(chosen);
 const pos=btn.dataset.edge?resizeDimensions(r,btn.dataset.edge,dx,dy,false):moveDimensions(r,dx,dy);
 if(btn.dataset.edge)applySafeResize(pos,pos,btn.dataset.edge);
 else guardedChange(chosen,()=>applyRect(pos,null));
 save();updateHomeExtent();requestPos();
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
window.addEventListener("scroll",()=>{if(chosen&&!gesture)requestPos()},{passive:true});
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
// Whole-page shelf packing. Keep provider content, sizes, removed widgets
// and each theme's state intact; undo restores the exact saved geometry.
const previousKey=()=>"ad_widget_previous_layout_v1_"+launcherTheme;
function updateHomeExtent(){
 const home=byId("launcherHomePage");
 if(!home||home.hidden)return;
 home.style.removeProperty("--widget-arranged-height");
 const bounds=home.getBoundingClientRect();
 let bottom=0;
 for(const el of movable())bottom=Math.max(bottom,layout(el).b-bounds.top);
 if(bottom>0)home.style.setProperty("--widget-arranged-height",Math.ceil(bottom+110)+"px");
}
function arrangeWidgets(random){
 if(launcherPage!=="home")return false;
 closeEditor();
 const home=byId("launcherHomePage"),visible=movable(),nodes=visible.filter(el=>!visible.some(p=>p!==el&&p.contains(el)));
 if(!nodes.length)return false;
 const before=JSON.stringify(geometry),snapshots=nodes.map(el=>[el,snapshot(el)]);
 const original=nodes.map(el=>({el,r:layout(el)})).sort((a,b)=>a.r.t-b.r.t||a.r.l-b.r.l);
 const left=Math.max(8,Math.min(...original.map(o=>o.r.l))),right=Math.min(innerWidth-12,Math.max(...original.map(o=>o.r.r)));
 const ordered=original.slice();
 if(random&&ordered.length>1){
  for(let i=ordered.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ordered[i],ordered[j]]=[ordered[j],ordered[i]]}
  if(ordered.every((o,i)=>o===original[i]))ordered.push(ordered.shift());
 }
 const top=Math.min(...original.map(o=>o.r.t));
 const rail=byId("launcherAlphaIndex");
 const railRect=rail&&rail.getClientRects().length?rail.getBoundingClientRect():null;
 const ceiling=railRect&&railRect.width>0&&railRect.left>left?Math.min(right,railRect.left-5):right;
 const available=Math.max(...original.map(o=>o.r.w),ceiling-left);
 const reserve=byId("launcherTilesSearch");
 const obstacle=reserve&&reserve.getClientRects().length&&getComputedStyle(reserve).display!=="none"?layout(reserve):null;
 let x=left,y=top,row=0;
 const positions=[];
 for(const o of ordered){
  const w=o.r.w,h=o.r.h;
  if(x>left&&x+w>left+available+1){x=left;y+=row+10;row=0}
  if(obstacle&&overlapArea({l:x,r:x+w,t:y,b:y+h},obstacle)>0){x=left;y=Math.max(y+row+10,obstacle.b+10);row=0}
  positions.push({el:o.el,l:Math.min(x,innerWidth-w-4),t:y,w,h});
  x+=w+10;row=Math.max(row,h);
 }
 document.body.classList.add("widget-dragging");
 for(const p of positions){
  const r=layout(p.el);
  p.el.style.setProperty("--widget-x",Math.round(offset(p.el,"x")+p.l-r.l)+"px");
  p.el.style.setProperty("--widget-y",Math.round(offset(p.el,"y")+p.t-r.t)+"px");
 }
 const valid=positions.every(p=>!collisions(p.el).length)&&positions.every(p=>{const r=layout(p.el);return r.l>=-1&&r.r<=innerWidth+1&&(!obstacle||overlapArea(r,obstacle)===0)});
 if(!valid){
  for(const [el,state] of snapshots)restoreSnapshot(el,state);
  document.body.classList.remove("widget-dragging");
  updateHomeExtent();layoutChanged();return false;
 }
 deskStorage.setItem(previousKey(),before);
 for(const p of positions){const r=layout(p.el);geometry[p.el.id]={w:Math.round(r.w),h:Math.round(r.h),x:Math.round(offset(p.el,"x")),y:Math.round(offset(p.el,"y")),natural:p.el.dataset.layoutSized!=="true"}}
 deskStorage.setItem(storeKey(),JSON.stringify(geometry));
 updateHomeExtent();document.body.classList.remove("widget-dragging");layoutChanged();return true;
}
function restorePrevious(){
 const previous=deskStorage.getItem(previousKey());
 if(!previous)return false;
 deskStorage.setItem(storeKey(),previous);
 deskStorage.setItem(previousKey(),"");
 applySizes();return true;
}
const toolsPanel=document.createElement("div");toolsPanel.id="widgetArrangementTools";toolsPanel.className="widget-arrangement-tools";
toolsPanel.innerHTML='<button type="button" class="launcher-options-action" id="widgetAutoArrange">Auto arrange widgets</button><button type="button" class="launcher-options-action" id="widgetRandomize">Randomize widget positions</button><button type="button" class="launcher-options-action" id="widgetUndoArrange">Restore previous positions</button><small id="widgetArrangementStatus" role="status"></small>';
restoreList.after(toolsPanel);
function refreshArrangement(){byId("widgetUndoArrange").disabled=!deskStorage.getItem(previousKey())}
function act(random){const ok=arrangeWidgets(random);byId("widgetArrangementStatus").textContent=ok?"Layout saved. Restore previous positions to undo.":"No collision-free arrangement found. Layout unchanged.";refreshArrangement()}
byId("widgetAutoArrange").onclick=()=>act(false);
byId("widgetRandomize").onclick=()=>act(true);
byId("widgetUndoArrange").onclick=()=>{if(restorePrevious())byId("widgetArrangementStatus").textContent="Previous layout restored.";refreshArrangement()};
window.addEventListener("audio-desk-layout-changed",refreshArrangement);
applySizes();
refreshArrangement();
})();
