/* Local calendar agenda. No credentials, network sync, or copied event
 * titles in storage. Only pin occurrence keys and widget visibility persist. */
(()=>{
"use strict";
const el=id=>document.getElementById(id);
const widget=el("launcherAgendaWidget"),overlay=el("agendaOverlay");
if(!widget||!overlay||typeof window.AudioDesk?.requestAgenda!=="function")return;
const pinKey="ad_agenda_pinned_v1",visibilityKey="ad_agenda_visible_v1";
let pins=new Set(),events=[],ordered=[],selected=0,state="loading",gesture=null,blockClickUntil=0;
let widgetVisible=deskStorage.getItem(visibilityKey)!=="false";
try{const saved=JSON.parse(deskStorage.getItem(pinKey)||"[]");
 if(Array.isArray(saved))pins=new Set(saved.filter(v=>typeof v==="string").slice(0,200));
}catch{}
const create=(tag,cls,txt)=>{
 const node=document.createElement(tag);if(cls)node.className=cls;
 if(txt!==undefined)node.textContent=txt;return node;
};
const key=e=>e.id+":"+e.begin;
const dateStamp=(d,utc=false)=>Date.UTC(utc?d.getUTCFullYear():d.getFullYear(),
 utc?d.getUTCMonth():d.getMonth(),utc?d.getUTCDate():d.getDate());
const today=()=>dateStamp(new Date());
const eventDay=e=>Math.max(today(),dateStamp(new Date(e.begin),e.allDay));
const dayDistance=stamp=>Math.round((stamp-today())/86400000);
function dateLabel(stamp){
 const date=new Date(stamp),diff=dayDistance(stamp);
 const label=date.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric",timeZone:"UTC"});
 return label+(diff===0?" · Today":diff===1?" · Tomorrow":diff>1?" · In "+diff+"d":"");
}
function timeLabel(e){
 if(e.allDay)return "All day";
 const opts={hour:"numeric",minute:"2-digit"};
 const a=new Date(e.begin),b=new Date(e.end);
 const now=Date.now();
 if(e.begin<=now&&e.end>now)return "Now · Until "+b.toLocaleTimeString(undefined,opts);
 return a.toLocaleTimeString(undefined,opts)+(e.end>e.begin?" – "+b.toLocaleTimeString(undefined,opts):"");
}
function upcoming(e){
 if(e.allDay)return dateStamp(new Date(e.end),true)>today()||
  (e.end===e.begin&&dateStamp(new Date(e.begin),true)>=today());
 // Today's completed events stay in the agenda; only upcoming/ongoing events rotate.
 return Math.max(e.begin,e.end)>=Date.now();
}
function clean(raw){
 if(!raw||typeof raw.id!=="string"||!/^\d+$/.test(raw.id))return null;
 if(!Number.isFinite(raw.begin)||!Number.isFinite(raw.end))return null;
 const event={id:raw.id,begin:raw.begin,end:raw.end,allDay:raw.allDay===true,
  title:String(raw.title||"(Untitled event)").slice(0,220),
  location:String(raw.location||"").slice(0,300),
  color:/^#[0-9a-f]{6}$/i.test(raw.color||"")?raw.color:""};
 if(event.allDay&&dateStamp(new Date(event.end),true)<=today()&&
    dateStamp(new Date(event.begin),true)<today())return null;
 if(!event.allDay&&dateStamp(new Date(Math.max(event.begin,event.end)))<today())return null;
 return event;
}
function reorder(){
 const keep=ordered[selected]&&key(ordered[selected]);
 ordered=events.filter(e=>upcoming(e)||pins.has(key(e))).sort((a,b)=>
  Number(pins.has(key(b)))-Number(pins.has(key(a)))||a.begin-b.begin);
 const i=ordered.findIndex(e=>key(e)===keep);
 selected=i>=0?i:0;
}
function togglePin(event){
 const k=key(event);
 if(pins.has(k))pins.delete(k);
 else if(pins.size<200)pins.add(k);
 deskStorage.setItem(pinKey,JSON.stringify([...pins]));
 reorder();renderList();renderSlide();
}
function pinButton(event){
 const pinned=pins.has(key(event)),b=create("button","agenda-pin",pinned?"★":"☆");
 b.type="button";b.setAttribute("aria-pressed",String(pinned));
 b.setAttribute("aria-label",(pinned?"Unpin ":"Pin ")+event.title);
 b.title=pinned?"Unpin event":"Pin event";
 b.onclick=()=>togglePin(event);return b;
}
function openEvent(event){
 if(Date.now()<blockClickUntil)return;
 window.AudioDesk.openAgendaEvent?.(event.id,event.begin,event.end);
}
function row(event){
 const root=create("div","agenda-event");
 if(event.color)root.style.setProperty("--event-color",event.color);
 const b=create("button","agenda-event-body");b.type="button";b.onclick=()=>openEvent(event);
 b.append(create("strong","agenda-event-title",event.title),
  create("span","agenda-event-time",timeLabel(event)));
 if(event.location)b.append(create("span","agenda-event-location","⌖ "+event.location));
 root.append(b,pinButton(event));return root;
}
function permissionButton(){
 const b=create("button","agenda-permission","Connect calendar");
 b.type="button";b.onclick=()=>window.AudioDesk.enableAgenda?.();return b;
}
function renderList(){
 const host=el("agendaList"),notice=el("agendaNotice");
 host.replaceChildren();notice.replaceChildren();
 if(state==="permission"){
  notice.append(create("p","","Allow calendar access to show your synced Google Calendar events."),
   permissionButton());return;
 }
 if(state!=="ready"){
  notice.textContent=state==="error"?"Calendar unavailable. Tap refresh to retry.":"Loading calendar…";return;
 }
 const pinned=events.filter(e=>pins.has(key(e)));
 if(pinned.length){
  host.append(create("h3","agenda-date-heading","Pinned events"));
  for(const e of pinned){
   const r=row(e);r.querySelector(".agenda-event-time").prepend(document.createTextNode(dateLabel(eventDay(e))+" · "));
   host.append(r);
  }
 }
 const groups=new Map([[today(),[]]]);
 for(const e of events){
  if(pins.has(key(e)))continue;
  const day=eventDay(e);if(!groups.has(day))groups.set(day,[]);groups.get(day).push(e);
 }
 for(const [stamp,group] of [...groups.entries()].sort((a,b)=>a[0]-b[0])){
  host.append(create("h3","agenda-date-heading",dateLabel(stamp)));
  if(group.length)group.forEach(e=>host.append(row(e)));
  else host.append(create("p","agenda-empty","No unpinned events"));
 }
}
function renderSlide(direction=0){
 const host=el("agendaSlide");host.replaceChildren();
 const event=ordered[selected],position=el("agendaSlidePosition");
 if(state==="permission"){
  host.append(create("small","agenda-slide-date","Calendar"),permissionButton());
 }else if(state!=="ready"){
  host.append(create("strong","agenda-empty",state==="error"?"Calendar unavailable":"Loading agenda…"));
 }else if(!event){
  host.append(create("small","agenda-slide-date",dateLabel(today())),create("strong","agenda-empty","No upcoming events"));
 }else{
  const card=create("div","agenda-slide-card");
  if(event.color)card.style.setProperty("--event-color",event.color);
  card.append(create("small","agenda-slide-date",(pins.has(key(event))?"★ ":"")+dateLabel(eventDay(event))));
  card.append(row(event));host.append(card);
  if(direction&&typeof card.animate==="function"&&!matchMedia("(prefers-reduced-motion: reduce)").matches)
   card.animate([{transform:"translateX("+direction*18+"px)",opacity:.25},{transform:"translateX(0)",opacity:1}],
    {duration:230,easing:"cubic-bezier(.2,.8,.2,1)"});
 }
 position.textContent=state==="ready"&&ordered.length?(selected+1)+" / "+ordered.length:"";
 el("agendaPrevious").disabled=ordered.length<2;el("agendaNext").disabled=ordered.length<2;
}
function step(direction){
 if(ordered.length<2)return;
 selected=(selected+direction+ordered.length)%ordered.length;renderSlide(direction);
}
function refresh(){
 if(document.hidden)return;
 window.AudioDesk.requestAgenda();
}
window.receiveAudioDeskAgenda=data=>{
 state=["ready","permission","error"].includes(data?.state)?data.state:"error";
 const unique=new Map();
 if(state==="ready"&&Array.isArray(data.events)){
  for(const raw of data.events.slice(0,2000)){const v=clean(raw);if(v)unique.set(key(v),v)}
 }
 events=[...unique.values()].sort((a,b)=>a.begin-b.begin);
 reorder();renderList();renderSlide();
};
function open(){
 closeHomeOptions(true);overlay.hidden=false;renderList();refresh();
 el("agendaClose").focus({preventScroll:true});
}
function close(){overlay.hidden=true}
function showWidget(){
 widget.hidden=!widgetVisible;
 const b=el("agendaWidgetVisibility");
 b.textContent=widgetVisible?"Hide agenda widget":"Show agenda widget";
 b.setAttribute("aria-pressed",String(widgetVisible));
}
const add=()=>window.AudioDesk.newAgendaEvent?.(Math.ceil(Date.now()/3600000)*3600000);
el("agendaOpen").onclick=open;
el("agendaSettingsOpen").hidden=false;el("agendaSettingsOpen").onclick=open;
el("agendaWidgetVisibility").hidden=false;el("agendaWidgetVisibility").onclick=()=>{
 widgetVisible=!widgetVisible;deskStorage.setItem(visibilityKey,String(widgetVisible));showWidget();
};
el("agendaWidgetAdd").onclick=add;el("agendaAdd").onclick=add;
el("agendaClose").onclick=close;el("agendaRefresh").onclick=refresh;
el("agendaPrevious").onclick=()=>step(-1);el("agendaNext").onclick=()=>step(1);
overlay.onclick=e=>{if(e.target===overlay)close()};
for(const id of ["warmDateWidget","liveCalendarWidget","launcherDate"]){
 const node=el(id);if(node)node.addEventListener("click",e=>{
  if(Date.now()<blockClickUntil)return;
  e.preventDefault();e.stopImmediatePropagation();open();
 },true);
}
widget.addEventListener("touchstart",e=>{
 if(e.touches.length!==1||widget.classList.contains("widget-editing"))return;
 const t=e.touches[0];gesture={x:t.clientX,y:t.clientY};
},{passive:true});
widget.addEventListener("touchend",e=>{
 const g=gesture;gesture=null;const t=e.changedTouches[0];
 if(!g||!t||widget.classList.contains("widget-editing"))return;
 const dx=t.clientX-g.x,dy=t.clientY-g.y;
 if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy)*1.4){
  blockClickUntil=Date.now()+450;step(dx<0?1:-1);
 }
},{passive:true});
widget.addEventListener("click",e=>{
 if(Date.now()<blockClickUntil){e.preventDefault();e.stopImmediatePropagation()}
},true);
widget.addEventListener("touchcancel",()=>{gesture=null},{passive:true});
const oldBack=window.launcherBack;window.launcherBack=function(){
 if(!overlay.hidden){close();return}oldBack?.();
};
const oldHome=window.launcherGoHome;window.launcherGoHome=function(){close();oldHome?.()};
const oldResume=window.launcherOnResume;window.launcherOnResume=function(){oldResume?.();refresh()};
window.addEventListener("keydown",e=>{if(e.key==="Escape"&&!overlay.hidden){e.preventDefault();close()}});
window.addEventListener("launcher-page-changed",()=>{close();if(launcherPage==="home")refresh()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
setInterval(()=>{if(!document.hidden&&(launcherPage==="home"||!overlay.hidden))refresh()},90000);
setInterval(()=>{
 if(launcherPage==="home"&&overlay.hidden&&!document.hidden&&!widget.hidden&&
  !widget.classList.contains("widget-editing")&&!gesture&&!hasLauncherOverlay()&&
  !matchMedia("(prefers-reduced-motion: reduce)").matches)step(1);
},8500);
showWidget();renderSlide();refresh();
window.audioDeskAgenda={open,close,step,refresh,pins:()=>[...pins]};
})();
