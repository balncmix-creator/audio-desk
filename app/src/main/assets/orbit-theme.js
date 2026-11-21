/* Orbit: four concentric dials. Motion only runs after interaction. */
(()=>{
"use strict";
const home=document.getElementById("launcherHomePage");
const host=document.createElement("div");host.id="orbitHome";host.hidden=true;
host.innerHTML='<svg id="orbitDial" viewBox="-334 -334 334 334" role="group" aria-label="Orbit radial launcher"><defs><clipPath id="orbitQuarter"><rect x="-334" y="-334" width="334" height="334"/></clipPath></defs><g clip-path="url(#orbitQuarter)"><g id="orbitClock"></g><g id="orbitExternalWidgets"></g><g id="orbitWidgets"></g><g id="orbitRecents"></g><g id="orbitLetters"></g><g id="orbitSearch"></g></g></svg>';
home.prepend(host);

// Blurred backdrop stays below the dial. Icons fan out IN the recent-apps ring.
const softBackdrop=document.createElement("div");
softBackdrop.id="orbitRadialBackdrop";
softBackdrop.setAttribute("aria-hidden","true");
home.prepend(softBackdrop);

const style=document.createElement("style");
style.textContent='#orbitHome[hidden]{display:none!important}#orbitHome{position:fixed;right:0;bottom:0;bottom:env(safe-area-inset-bottom,0px);width:min(100vw,calc(100dvh - 100px),600px);aspect-ratio:1;z-index:3;touch-action:none;user-select:none;-webkit-user-select:none}#orbitDial{display:block;width:100%;height:100%;overflow:hidden;font-family:system-ui,sans-serif;touch-action:none}#orbitDial text{pointer-events:none;fill:var(--theme-text,#e5f0e7)}#orbitDial .orbit-ring{fill:var(--theme-surface,#202622)}#orbitDial .orbit-raised{fill:var(--theme-surface2,#35483c)}#orbitDial .orbit-line{stroke:var(--theme-line,#617568);fill:none}#orbitDial .orbit-accent{fill:var(--theme-accent,#c5e0c8)}#orbitDial .orbit-ink{fill:var(--theme-accent-ink,#18251d)}#orbitDial .orbit-muted{opacity:.75}#orbitDial .orbit-app-icon{image-rendering:auto;pointer-events:none}#orbitDial [role=button]{cursor:pointer;outline:none}#orbitDial [role=button]:focus-visible{outline:2px solid var(--theme-accent)}#orbitDial [aria-disabled=true]{opacity:.4}body[data-launcher-theme=orbit][data-home-page=home] #launcherHomePage{padding:0!important;min-height:100dvh!important;height:100dvh!important;max-width:none!important}body[data-launcher-theme=orbit][data-home-page=home] #launcherHomePage>:not(#orbitHome):not(#orbitRadialBackdrop):not(#launcherLetterPanel):not(#launcherHomeOptions):not(#launcherSettingsToggle):not(#launcherShortcutMenu){display:none!important}body[data-launcher-theme=orbit][data-home-page=home] #launcherAlphaIndex,body[data-launcher-theme=orbit][data-home-page=home] #launcherAlphaBubble{display:none!important}body[data-launcher-theme=orbit][data-home-page=home] #launcherSettingsToggle{position:fixed!important;left:12px!important;right:auto!important;top:max(36px,calc(var(--status-top,24px) + 12px))!important;bottom:auto!important;z-index:8!important}body[data-launcher-theme=orbit] :is(#launcherClockChoose,#nativeWidgetsOpen,#acousticAddSpl,#acousticAddFft,#youtubeWidgetToggle,#agendaWidgetVisibility){display:none!important}.orbit-preview{background:#101211!important;position:relative;overflow:hidden}.orbit-preview:after{content:"";position:absolute;right:0;bottom:0;width:85%;aspect-ratio:1;background:radial-gradient(circle at bottom right,#35483c 0 17%,#101211 17% 19%,#303a32 19% 32%,#101211 32% 34%,#202622 34% 53%,#101211 53% 55%,#35483c 55% 79%,#101211 79% 81%,#29392e 81% 98%,transparent 98%)}.orbit-preview i{z-index:1;position:relative}';
style.textContent+="\n#orbitRadialBackdrop{position:fixed;inset:0;z-index:2;opacity:0;visibility:hidden;pointer-events:none;background:rgba(8,17,11,.34);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:opacity .28s ease,visibility .28s ease}\nbody.orbit-letter-active[data-launcher-theme=\"orbit\"] #orbitRadialBackdrop{opacity:1;visibility:visible;pointer-events:auto}\nbody.orbit-letter-active[data-launcher-theme=\"orbit\"] #orbitDial #orbitClock,\nbody.orbit-letter-active[data-launcher-theme=\"orbit\"] #orbitDial #orbitWidgets,\nbody.orbit-letter-active[data-launcher-theme=\"orbit\"] #orbitDial #orbitSearch{filter:blur(2.5px);opacity:.55}\n#orbitDial #orbitClock,#orbitDial #orbitWidgets,#orbitDial #orbitSearch{transition:filter .26s ease,opacity .26s ease}\n#orbitRecents .orbit-app-ring{stroke:var(--theme-line,#6c8873);stroke-width:1;fill:var(--theme-surface2,#35483c)}\n#orbitRecents .orbit-fan-item{cursor:pointer}\n#orbitRecents .orbit-fan-item circle{fill:var(--theme-surface,#263d30);stroke:var(--theme-line,#91ab97);stroke-width:1}\n#orbitRecents .orbit-fan-item:focus-visible circle{stroke:var(--theme-accent,#c6e9c8);stroke-width:3}\n#orbitRecents .orbit-fan-item image{pointer-events:none}\n#orbitRecents #orbitFanCount{font-size:10px;opacity:.83}\n#orbitRecents .orbit-page-button{cursor:pointer}\n#orbitRecents .orbit-page-button text{font-size:14px;fill:var(--theme-text,#e5f0e7)}\nbody[data-launcher-theme=orbit] #launcherHomePage>:not(#orbitHome):not(#orbitRadialBackdrop):not(#launcherLetterPanel):not(#launcherHomeOptions):not(#launcherSettingsToggle):not(#launcherShortcutMenu){display:none!important}\n@media(prefers-reduced-motion:reduce){#orbitRadialBackdrop,#orbitDial #orbitClock,#orbitDial #orbitWidgets,#orbitDial #orbitSearch{transition:none!important}#orbitRadialBackdrop{backdrop-filter:none;-webkit-backdrop-filter:none}}\n";
// A transparent backdrop must remain layout-visible; opacity and hit-testing own its state.
style.textContent+='#orbitRadialBackdrop{display:block!important;visibility:visible!important}';
style.textContent+="\n#orbitExternalWidgets .orbit-external-segment{fill:var(--theme-surface,#304b37);stroke:var(--theme-line,#58715f);stroke-width:1}\n#orbitExternalWidgets .orbit-external-focused{fill:var(--theme-surface2,#416348);stroke:var(--theme-accent,#b4d9ba);stroke-width:1.7}\n#orbitExternalWidgets [data-orbit-action]{cursor:pointer;outline:none}\n";
style.textContent+="\n#orbitSettingsGear{display:none;position:fixed;top:max(34px,calc(var(--status-top,24px) + 10px));left:12px;z-index:8;width:38px;height:38px;place-items:center;border-radius:12px;border:1px solid var(--theme-line,#607b66);background:var(--theme-surface2,#2d4837);color:var(--theme-accent,#cce8d0);box-shadow:0 3px 15px #0003;cursor:pointer}\nbody[data-launcher-theme=\"orbit\"][data-home-page=\"home\"] #orbitSettingsGear{display:grid}\nbody[data-launcher-theme=\"orbit\"][data-home-page=\"home\"] #launcherSettingsToggle{display:none!important}\n#orbitSettingsShade[hidden],#orbitSettingsPanel[hidden],#orbitQuickCustomize[hidden],#orbitToast[hidden]{display:none!important}\n#orbitSettingsShade{position:fixed;inset:0;z-index:26;background:#061008a6;backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}\n#orbitSettingsPanel,#orbitQuickCustomize{font-family:system-ui,sans-serif;position:fixed;z-index:27;box-sizing:border-box;color:var(--theme-text,#e2f0e5);border:1px solid var(--theme-line,#718d78);background:var(--theme-surface,#223729);box-shadow:0 15px 45px #0008}\n#orbitSettingsPanel{left:12px;top:max(69px,calc(var(--status-top,24px) + 46px));width:min(310px,calc(100vw - 24px));max-height:min(74dvh,600px);border-radius:17px;display:flex;flex-direction:column;overflow:hidden}\n#orbitSettingsPanel header{display:flex;align-items:center;justify-content:space-between;padding:14px 15px 12px;gap:15px}\n#orbitSettingsPanel header>div{display:flex;flex-direction:column;gap:4px}\n#orbitSettingsPanel header small{font-size:10px;letter-spacing:.12em;opacity:.72}\n#orbitSettingsPanel header strong{font-size:21px}\n#orbitSettingsPanel button,#orbitQuickCustomize button{font:inherit;cursor:pointer;color:inherit}\n#orbitSettingsClose{width:32px;height:30px;border:0;background:var(--theme-surface2,#365540);border-radius:9px;font-size:23px}\n#orbitSettingsTabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:0 12px 12px;border-bottom:1px solid var(--theme-line,#58745f)}\n#orbitSettingsTabs button{min-width:0;padding:8px 2px;background:var(--theme-surface2,#365540);border:0;border-radius:8px;font-size:11px}\n#orbitSettingsTabs button[aria-selected=\"true\"]{background:var(--theme-accent,#c9e3ce);color:var(--theme-accent-ink,#183120);font-weight:700}\n#orbitSettingsContent{min-height:120px;overflow:auto;overscroll-behavior:contain;padding:13px 14px 16px;font-size:12px}\n#orbitSettingsContent h3{font-size:14px;font-weight:650;margin:0 0 11px}\n#orbitSettingsContent p{opacity:.77;font-size:11px;line-height:1.5;margin:7px 0 12px}\n#orbitSettingsContent .orbit-settings-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--theme-line,#4d6655)}\n#orbitSettingsContent .orbit-settings-row small{display:block;font-size:10px;opacity:.72;padding-top:4px}\n#orbitSettingsContent button{background:var(--theme-surface2,#3f5c49);border:1px solid var(--theme-line,#627c68);border-radius:9px;padding:8px 10px;font-size:11px}\n#orbitSettingsContent .orbit-settings-buttons{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}\n#orbitSettingsContent .orbit-settings-buttons button[aria-pressed=\"true\"]{border-color:var(--theme-accent,#d7ebd9);font-weight:700}\n#orbitSettingsContent input[type=checkbox]{accent-color:var(--theme-accent,#c5dec8);width:17px;height:17px;flex-shrink:0}\n#orbitQuickCustomize{top:max(108px,calc(var(--status-top,24px) + 88px));left:13px;width:min(230px,calc(100vw - 30px));padding:9px;border-radius:14px}\n#orbitQuickCustomize strong{display:block;padding:7px 8px 9px;color:var(--theme-accent,#bad8c2);font-size:12px}\n#orbitQuickCustomize button{display:block;text-align:left;width:100%;border:0;border-radius:9px;padding:10px 8px;background:transparent;font-size:12px}\n#orbitQuickCustomize button:active{background:var(--theme-surface2,#3f5c49)}\n#orbitToast{position:fixed;z-index:35;bottom:max(48px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);background:var(--theme-accent,#d8eedb);color:var(--theme-accent-ink,#193522);padding:10px 14px;border-radius:10px;font:12px system-ui,sans-serif;box-shadow:0 7px 25px #0007;max-width:90vw}\n@media(prefers-reduced-motion:reduce){#orbitSettingsShade{backdrop-filter:none;-webkit-backdrop-filter:none}}\n";
document.head.append(style);

const orbitSettingsGear=document.createElement("button");
orbitSettingsGear.id="orbitSettingsGear";orbitSettingsGear.type="button";
orbitSettingsGear.setAttribute("aria-label","Audio Desk settings");
orbitSettingsGear.setAttribute("aria-controls","orbitSettingsPanel");
orbitSettingsGear.setAttribute("aria-expanded","false");
orbitSettingsGear.innerHTML='<svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M10 2.5h4l.6 2.3 1.8.8 2.1-1.1 2.9 2.9-1.1 2.1.8 1.8 2.3.6v4l-2.3.6-.8 1.8 1.1 2.1-2.9 2.9-2.1-1.1-1.8.8-.6 2.3h-4l-.6-2.3-1.8-.8-2.1 1.1-2.9-2.9 1.1-2.1-.8-1.8-2.3-.6v-4l2.3-.6.8-1.8-1.1-2.1 2.9-2.9 2.1 1.1 1.8-.8z" transform="translate(12 12) scale(.78) translate(-12 -12)"/></svg>';
const settingsShade=document.createElement("div");
settingsShade.id="orbitSettingsShade";settingsShade.hidden=true;
const settingsPanel=document.createElement("section");
settingsPanel.id="orbitSettingsPanel";settingsPanel.hidden=true;
settingsPanel.setAttribute("role","dialog");settingsPanel.setAttribute("aria-modal","true");
settingsPanel.setAttribute("aria-label","Audio Desk settings");
settingsPanel.innerHTML='<header><div><small>AUDIO DESK</small><strong>Settings</strong></div><button id="orbitSettingsClose" type="button" aria-label="Close settings">×</button></header>'+
'<nav id="orbitSettingsTabs" aria-label="Settings categories">'+
['Themes','Wallpaper','Dials','Widgets','Gestures','General'].map(label=>'<button type="button" data-orbit-tab="'+label.toLowerCase()+'">'+label+'</button>').join("")+
'</nav><div id="orbitSettingsContent"></div>';
const quickPanel=document.createElement("div");
quickPanel.id="orbitQuickCustomize";quickPanel.hidden=true;
quickPanel.setAttribute("role","dialog");quickPanel.setAttribute("aria-label","Customize Home");
quickPanel.innerHTML='<strong>Customize Home</strong>'+
'<button type="button" data-orbit-quick="wallpaper">◈ &nbsp; Change wallpaper</button>'+
'<button type="button" data-orbit-quick="widgets">▦ &nbsp; Manage widgets</button>'+
'<button type="button" data-orbit-quick="dials">◎ &nbsp; Customize dials</button>'+
'<button type="button" data-orbit-quick="themes">⚙ &nbsp; Audio Desk settings</button>';
const orbitToast=document.createElement("div");orbitToast.id="orbitToast";
orbitToast.setAttribute("role","status");orbitToast.hidden=true;
document.body.append(orbitSettingsGear,settingsShade,settingsPanel,quickPanel,orbitToast);

const svg=host.querySelector("svg"),q=id=>document.getElementById(id);
const pi=Math.PI,rad=a=>a*pi/180;
const point=(r,a)=>[-r*Math.cos(rad(a)),-r*Math.sin(rad(a))];
const p=(r,a)=>point(r,a).map(v=>v.toFixed(3)).join(",");
const arc=(r,a,b)=>"M"+p(r,a)+" A"+r+","+r+" 0 0 1 "+p(r,b);
const ring=(R,r)=>arc(R,0,90)+" L"+p(r,90)+" A"+r+","+r+" 0 0 0 "+p(r,0)+" Z";
const sector=(a,b,R=249,r=182)=>{
 // Parallel 2-unit insets on both radial edges give a constant 4-unit gap.
 const gap=2,c=6,outer=Math.asin(gap/R)*180/pi,inner=Math.asin(gap/r)*180/pi;
 const A=a+outer,B=b-outer,C=a+inner,D=b-inner;
 const rs=R-c,rt=r+c,e=Math.asin(gap/rs)*180/pi,f=Math.asin(gap/rt)*180/pi;
 return arc(R,A+c/R*180/pi,B-c/R*180/pi)+" Q"+p(R,B)+" "+p(rs,b-e)+" L"+p(rt,b-f)+" Q"+p(r,D)+" "+p(r,D-c/r*180/pi)+" A"+r+","+r+" 0 0 0 "+p(r,C+c/r*180/pi)+" Q"+p(r,C)+" "+p(rt,a+f)+" L"+p(rs,a+e)+" Q"+p(R,A)+" "+p(R,A+c/R*180/pi)+" Z";
};
const wrap=(n,l)=>((n%l)+l)%l;
const txt=(s,y=4,size=13,cls="")=>'<text text-anchor="middle" y="'+y+'" font-size="'+size+'" class="'+cls+'">'+esc(String(s))+'</text>';
const g=(r,a,body,attrs="",rotate=true)=>'<g transform="translate('+p(r,a)+')'+(rotate?' rotate('+(a-90)+')':'')+'" '+attrs+'>'+body+'</g>';
const button=(action,label,disabled=false)=>'role="button" tabindex="'+(disabled?-1:0)+'" aria-label="'+esc(label)+'" data-orbit-action="'+esc(action)+'"'+(disabled?' aria-disabled="true"':'');
const path=(d,cls,more="")=>'<path d="'+d+'" class="'+cls+'" '+more+'/>';
const trunc=(s,n)=>Array.from(String(s||"")).slice(0,n).join("")+(Array.from(String(s||"")).length>n?"…":"");
const letters="ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");
const pointerAngle=45; // fixed poker-dial indicator, independent of each ring
const widgets=["music","calendar","news"];
let externalWidgets=[],externalIndex=0;
const externalRingStep=38;
const externalWidgetsList=()=>[...externalWidgets,{id:0,label:"Add widget",pkg:"",accent:""}];
function selectedExternal(){const list=externalWidgetsList();return list[wrap(externalIndex,list.length)]}
function nativeWidgetList(){
 try{return window.audioDeskOrbitWidgets?.()||[]}catch{return[]}
}
function redrawExternal(){
 if(!active())return;
 externalWidgets=nativeWidgetList();
 externalIndex=wrap(externalIndex,externalWidgetsList().length);
 drawExternalWidgets();
 window.audioDeskSyncNativeWidgets?.();
}
window.audioDeskOrbitWidgetSlot=()=>{
 if(!active()||popupVisible||settingsVisible||quickVisible||host.hidden)return null;
 const selected=selectedExternal();
 if(!selected?.id)return null;
 const rect=host.getBoundingClientRect();
 if(!rect.width)return null;
 const scale=rect.width/334;
 const [dx,dy]=point(276,45);
 const centerX=rect.right+dx*scale,centerY=rect.bottom+dy*scale;
 const w=Math.min(170,Math.max(108,rect.width*.42)),h=Math.min(61,Math.max(44,rect.width*.145));
 return {id:selected.id,x:centerX-w/2,y:centerY-h/2,w,h};
};
function rotateExternal(delta){
 const count=externalWidgetsList().length;
 if(!count)return;
 externalIndex=wrap(externalIndex+delta,count);
 drawExternalWidgets();window.audioDeskSyncNativeWidgets?.();
}

let indices={letters:0,recents:0,widgets:0,external:0},drag=null,suppressNativeClickUntil=0;
// Each dial has a continuously changing angle; the other dials stay still.
const offsets={letters:0,recents:0,widgets:0,external:0};
const spinning={letters:0,recents:0,widgets:0,external:0};
const prefersReducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
function ringStep(which){
 if(which==="widgets")return 60;
 if(which==="external")return externalRingStep;
 if(which==="letters")return 11.25;
 return 90/Math.min(5,Math.max(1,recentList.length));
}
function ringLength(which){
 return which==="widgets"?widgets.length:which==="external"?externalWidgetsList().length:which==="letters"?letters.length:recentList.length;
}
function paintRing(which){
 if(which==="widgets")drawWidgets();
 else if(which==="external"){externalIndex=indices.external;drawExternalWidgets();}
 else if(which==="letters")drawLetters();
 else drawRecents();
}
function advanceRing(which,delta){
 const len=ringLength(which);if(!len||!Number.isFinite(delta))return;
 const step=ringStep(which);offsets[which]+=delta;
 // Cross a notch without changing the visual angle: no snapping jump.
 const crossings=Math.round(offsets[which]/step);
 if(crossings){
  indices[which]=wrap(indices[which]-crossings,len);
  if(which==="external")externalIndex=indices.external;
  offsets[which]-=crossings*step;
 }
 paintRing(which);
}
function stopSpin(which){
 if(spinning[which])cancelAnimationFrame(spinning[which]);
 spinning[which]=0;
}
function stopAllSpins(){for(const which of Object.keys(spinning))stopSpin(which)}
function settleRing(which,velocity=0){
 stopSpin(which);
 if(!ringLength(which))return;
 if(prefersReducedMotion.matches){
  advanceRing(which,-offsets[which]);return;
 }
 let v=Math.max(-0.75,Math.min(0.75,velocity)); // deg/ms
 let last=performance.now();
 function frame(now){
  if(!active()||document.hidden||window.audioDeskForeground===false){
   spinning[which]=0;return;
  }
  const dt=Math.min(40,Math.max(1,now-last));last=now;
  if(Math.abs(v)>0.018){
   // Framerate-independent exponential momentum (mobile and low-end phones).
   const friction=Math.exp(-dt/165);
   advanceRing(which,v*165*(1-friction));
   v*=friction;
  }else{
   // Ease into the nearest notch without an abrupt change of angle.
   v=0;
   const distance=-offsets[which];
   if(Math.abs(distance)<0.12){
    advanceRing(which,distance);spinning[which]=0;return;
   }
   advanceRing(which,distance*(1-Math.exp(-dt/75)));
  }
  spinning[which]=requestAnimationFrame(frame);
 }
 spinning[which]=requestAnimationFrame(frame);
}
let recentList=[],media={},lastClock="";
const active=()=>launcherTheme==="orbit"&&launcherPage==="home";


let popupVisible=false,popupLetter="",popupPage=0,popupSignature="";
let fanCurrent=null,fanAnimation=0;
const fanPageSize=5,svgNS="http://www.w3.org/2000/svg";
function iconSource(app){
 const pkg=String(app.pkg||"");
 if(!/^[A-Za-z0-9_.]{4,180}$/.test(pkg))return "";
 const mode=window.audioDeskIconStudio?.mode?.()==="original"?"original":"orbit";
 return "/app-icons/"+mode+"/"+encodeURIComponent(pkg)+".png";
}
function stopFan(){
 if(fanAnimation)cancelAnimationFrame(fanAnimation);
 fanAnimation=0;
}
function showPopup(){
 if(!active())return;
 if(popupVisible){refreshPopup();return}
 popupVisible=true;popupLetter="";popupPage=0;popupSignature="";
 document.body.classList.add("orbit-letter-active");
 drawRecents();
 refreshPopup();
}
function hidePopup(){
 const wasVisible=popupVisible;
 popupVisible=false;popupLetter="";popupPage=0;popupSignature="";
 document.body.classList.remove("orbit-letter-active");
 stopFan();fanCurrent=null;
 if(wasVisible&&active())drawRecents();
}
softBackdrop.addEventListener("click",hidePopup);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&popupVisible)hidePopup()});
function selectLetter(letter){
 const index=letters.indexOf(letter);
 if(index<0)return;
 stopSpin("letters");
 indices.letters=index;offsets.letters=0;
 showPopup();drawLetters();
}
function ensureAppRing(){
 const ringNode=q("orbitRecents");
 if(!ringNode.querySelector("#orbitAppIconLayers")){
  ringNode.innerHTML=path(ring(178,112),"orbit-app-ring")+
   '<g id="orbitAppIconLayers"></g><g id="orbitFanCount" aria-hidden="true"></g><g id="orbitFanPaging"></g>';
  fanCurrent=null;popupSignature="";
 }
}
function makeLayer(apps){
 const layer=document.createElementNS(svgNS,"g");
 layer.setAttribute("class","orbit-app-layer");
 const entries=[],total=apps.length;
 apps.forEach((app,i)=>{
  const a=total===1?45:12+i*66/(total-1);
  const node=document.createElementNS(svgNS,"g");
  node.setAttribute("class","orbit-fan-item");
  node.setAttribute("role","button");
  node.setAttribute("tabindex","0");
  node.setAttribute("aria-label","Open "+app.label);
  node.setAttribute("data-orbit-action","picker:launch");
  node.dataset.pickerPkg=app.pkg;
  node.dataset.pickerActivity=app.activity;
  const circle=document.createElementNS(svgNS,"circle");circle.setAttribute("r","19");
  const label=document.createElementNS(svgNS,"text");
  label.setAttribute("text-anchor","middle");label.setAttribute("font-size","12");label.setAttribute("y","4");
  label.textContent=trunc(app.label,2).toUpperCase();
  node.append(circle,label);
  const url=iconSource(app);
  if(url){
   const icon=document.createElementNS(svgNS,"image");
   icon.setAttribute("href",url);
   icon.setAttribute("x","-15");icon.setAttribute("y","-15");
   icon.setAttribute("width","30");icon.setAttribute("height","30");
   icon.setAttribute("preserveAspectRatio","xMidYMid meet");
   icon.setAttribute("class","orbit-app-icon");
   node.append(icon);
  }
  layer.append(node);
  entries.push({node,a,r:145,opacity:1,scale:1});
 });
 return {layer,entries};
}
function placeFan(entry,r,a,opacity,scale){
 const xy=point(r,a);
 entry.node.setAttribute("transform","translate("+xy[0].toFixed(2)+" "+xy[1].toFixed(2)+") scale("+scale.toFixed(3)+")");
 entry.node.setAttribute("opacity",opacity.toFixed(3));
 entry.r=r;entry.opacity=opacity;entry.scale=scale;
}
function transitionAppIcons(apps){
 ensureAppRing();
 stopFan();
 const holder=q("orbitAppIconLayers"),old=fanCurrent;
 // Preserve the latest partially animated layer as the outgoing one.
 for(const child of [...holder.children])if(!old||child!==old.layer)child.remove();
 const incoming=makeLayer(apps);
 holder.append(incoming.layer);fanCurrent=incoming;
 const oldStart=old?old.entries.map(x=>({r:x.r,opacity:x.opacity,scale:x.scale})):null;
 const duration=prefersReducedMotion.matches?0:285;
 const initial=performance.now();
 function animate(now){
  const elapsed=Math.max(0,now-initial);
  if(old)old.entries.forEach((entry,i)=>{
   const v=Math.min(1,elapsed/175),ease=1-Math.pow(1-v,3),from=oldStart[i];
   placeFan(entry,from.r+14*ease,entry.a,from.opacity*(1-ease),from.scale*(1-.12*ease));
  });
  incoming.entries.forEach((entry,i)=>{
   const t=Math.min(1,Math.max(0,(elapsed-i*22)/(duration-i*22||1)));
   const ease=1-Math.pow(1-t,3);
   const r=117+28*ease,scale=.70+.30*ease;
   placeFan(entry,r,entry.a-6*(1-ease),ease,scale);
  });
  if(elapsed<duration)fanAnimation=requestAnimationFrame(animate);
  else{old?.layer.remove();fanAnimation=0;}
 }
 if(duration)animate(initial);
 else{
  incoming.entries.forEach(entry=>placeFan(entry,145,entry.a,1,1));
  old?.layer.remove();
 }
}
function refreshPopup(){
 if(!popupVisible||!active())return;
 ensureAppRing();
 const letter=letters[indices.letters];
 if(letter!==popupLetter){popupLetter=letter;popupPage=0;popupSignature=""}
 const apps=launcherGroups.get(letter)||[];
 const totalPages=Math.max(1,Math.ceil(apps.length/fanPageSize));
 popupPage=wrap(popupPage,totalPages);
 const subset=apps.slice(popupPage*fanPageSize,(popupPage+1)*fanPageSize);
 const signature=letter+":"+popupPage+":"+apps.map(a=>launcherAppKey(a)).join("|")+":"+window.audioDeskIconStudio?.mode?.();
 if(signature===popupSignature)return;
 popupSignature=signature;
 // Use the EXISTING recent-apps ring; never create a floating top-left dialog.
 transitionAppIcons(subset);
 q("orbitFanCount").innerHTML=g(169,45,txt(letter+" · "+apps.length,4,10));
 q("orbitFanPaging").innerHTML=totalPages>1?
  g(123,8,'<circle r="11" fill="transparent"/>'+txt("‹",5,16),button("fan-page:-1","Previous "+letter+" apps"),false)+
  g(123,82,'<circle r="11" fill="transparent"/>'+txt("›",5,16),button("fan-page:1","Next "+letter+" apps"),false):"";
}
function turnAppPage(delta){
 if(!popupVisible)return;
 const len=Math.max(1,Math.ceil((launcherGroups.get(letters[indices.letters])||[]).length/fanPageSize));
 if(len<2)return;
 popupPage=wrap(popupPage+delta,len);popupSignature="";
 refreshPopup();
}
function drawClock(){
 if(!active())return;
 const now=new Date(),time=now.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",hour12:false}),date=now.toLocaleDateString([],{weekday:"short",day:"numeric",month:"short"}).toUpperCase();
 if(lastClock===time+date&&q("orbitClock").childNodes.length)return;lastClock=time+date;
 let h=path(ring(330,301),"orbit-ring");
 for(let i=0;i<=22;i++){const a=1+i*4;h+='<line x1="'+point(326,a)[0]+'" y1="'+point(324,a)[1]+'" x2="'+point(i%3===0?322:324,a)[0]+'" y2="'+point(i%3===0?317:321,a)[1]+'" class="orbit-line" stroke-width="1"/>'}
 const digits=Array.from(time);
 digits.forEach((v,i)=>{h+=g(317,45+(i-(digits.length-1)/2)*4.1,txt(v,8,24))});
 h+=g(302,45,txt(date,3,8,"orbit-muted"));q("orbitClock").innerHTML=h;
}
function currentRecents(){
 // Actual launches only, no invented app labels. Deduplicate activities.
 const seen=new Set();return launcherRecents.filter(a=>{const k=launcherAppKey(a);if(seen.has(k))return false;seen.add(k);return true});
}

function drawExternalWidgets(offset=offsets.external){
 // The outer App Widget dial is independent from Audio Desk's native widget
 // dial. Only one real RemoteViews surface is hosted at a time (at 45°).
 const list=externalWidgetsList();
 const selected=list[wrap(externalIndex,list.length)];
 let h="";
 for(let i=-2;i<=2;i++){
  const a=45+i*externalRingStep+offset;
  if(a+19<0||a-19>90)continue;
  const item=list[wrap(externalIndex+i,list.length)];
  const isAdd=item.id===0,chosen=i===0;
  h+=path(sector(a-18.5,a+18.5,299,252),chosen?"orbit-external-focused":"orbit-external-segment",
   'data-orbit-external="'+esc(String(item.id))+'"');
  const symbol=isAdd?"+":(String(item.label||"Widget").trim().charAt(0).toUpperCase()||"▦");
  const iconUrl=!isAdd&&item.pkg?iconSource({pkg:item.pkg}):"";
  let content='<rect x="-39" y="-23" width="78" height="46" rx="9" fill="transparent"/>'+
   (iconUrl?'<image href="'+iconUrl+'" x="-11" y="-19" width="22" height="22" class="orbit-app-icon"/>':txt(symbol,-2,18))+
   txt(trunc(isAdd?"ADD WIDGET":item.label,15).toUpperCase(),17,8);
  h+=g(275,a,content,button(isAdd?"external:add":"external:focus:"+wrap(externalIndex+i,list.length),
   isAdd?"Add an Android app widget":"Select "+item.label+" app widget"),true);
 }
 q("orbitExternalWidgets").innerHTML=h;
 // Don't move native RemoteViews until the selected index actually changes.
 if(selected?.id!==lastExternalNativeId){
  lastExternalNativeId=selected?.id||0;
  window.audioDeskSyncNativeWidgets?.();
 }
}
let lastExternalNativeId=-1;
function openNativeWidgetPicker(){
 hidePopup();closeSettings();closeQuick();
 if(typeof window.AudioDesk?.openNativeWidgets==="function"){
  window.AudioDesk.openNativeWidgets();
 }else{
  showOrbitToast("Android's widget picker is available in the installed APK.");
 }
}
function removeSelectedExternal(){
 const chosen=selectedExternal();
 if(!chosen?.id)return;
 if(!confirm("Remove "+chosen.label+"? This also removes it from other Audio Desk themes."))return;
 window.AudioDesk?.deleteNativeWidget?.(chosen.id);
}
function drawLetters(offset=offsets.letters){
 let h=path(ring(108,64),"orbit-raised");
 for(let i=-5;i<=5;i++){const l=letters[wrap(indices.letters+i,letters.length)],a=pointerAngle+i*11.25+offset;
 if(a< -10||a>100)continue;
 const atPointer=Math.abs(a-pointerAngle)<5.625;
 h+=g(86,a,'<rect x="-9" y="-20" width="18" height="40" rx="5" fill="transparent"/>'+(atPointer?'<circle r="11" class="orbit-accent"/>':"")+txt(l,4,12,atPointer?"orbit-ink":""),button("letter:"+l,"Browse apps beginning with "+l),false);
 }
 // A fixed triangle marks the selected letter while the alphabet rotates.
 // Compact fixed arrow: small enough not to overwhelm the alphabet glyphs.
 h+='<g id="orbitAlphabetPointer" aria-label="Fixed alphabet selection arrow" pointer-events="none">'+
  '<path d="M'+p(104,pointerAngle)+' L'+p(122,pointerAngle-2.2)+' L'+p(122,pointerAngle+2.2)+' Z" fill="#f2fff3" stroke="#162d1d" stroke-width="1.4" stroke-linejoin="round"/>'+
  '</g>';
 q("orbitLetters").innerHTML=h;
 // The wheel alone moves; the arrow is redrawn at its fixed angle.
 if(popupVisible)refreshPopup();
}
function drawRecents(offset=offsets.recents){
 if(popupVisible){ensureAppRing();refreshPopup();return}
 let h=path(ring(178,112),"orbit-ring");
 if(!recentList.length){h+=g(145,45,txt("↺",6,22,"orbit-muted"));q("orbitRecents").innerHTML=h;return}
 const count=Math.min(5,recentList.length),step=90/count;
 for(let i=-2;i<count+2;i++){const k=wrap(indices.recents+i,recentList.length),a=(i+.5)*step+offset;if(a< -15||a>105)continue;
 const app=recentList[k];
 // The Android launcher scan provides package names, not image bytes.
 // Reuse the device-local icon provider used by Audio Desk's app drawer.
 const pkg=String(app.pkg||"");
 const theme=window.audioDeskIconStudio?.mode?.()==="original"?"original":"orbit";
 const iconUrl=/^[A-Za-z0-9_.]{4,180}$/.test(pkg)?
  "/app-icons/"+theme+"/"+encodeURIComponent(pkg)+".png":"";
 const fallback=txt(trunc(app.label,2).toUpperCase(),5,12);
 const icon=fallback+(iconUrl?'<image href="'+iconUrl+'" x="-15" y="-15" width="30" height="30" preserveAspectRatio="xMidYMid meet" class="orbit-app-icon"/>':"");
 h+=g(147,a,'<circle r="19" class="orbit-raised"/>'+icon,button("recent:"+k,"Open "+app.label),false)}
 q("orbitRecents").innerHTML=h;
}
function music(a){
 let h=g(238,a,txt(trunc(media.available?media.title:"Music player",22),3,12));
 h+=g(225,a,txt(trunc(media.available?media.artist:(media.enabled?"Start a player":"Tap to connect"),25),3,9,"orbit-muted"));
 const items=[["previous","Previous track","|◀",media.available&&media.canPrevious],["toggle",media.playing?"Pause":"Play",media.playing?"Ⅱ":"▶",media.available&&media.canToggle],["next","Next track","▶|",media.available&&media.canNext]];
 items.forEach((x,i)=>{const on=i===1;h+=g(206,a+(i-1)*17,'<rect x="-22" y="-12" width="44" height="24" rx="7" class="'+(on?"orbit-accent":"orbit-raised")+'"/><text y="4" text-anchor="middle" font-size="13" class="'+(on?"orbit-ink":"")+'">'+x[2]+'</text>',button("media:"+x[0],x[1],!x[3]))});
 const duration=Number(media.durationMs),position=Number(media.positionMs);
 if(media.available&&duration>0&&position>=0){
 const start=a-24,end=a+24,progress=Math.max(0,Math.min(1,position/duration));
 h+=path(arc(188,start,end),"orbit-line",'stroke-width="3" stroke-linecap="round"');
 if(progress>0)h+=path(arc(188,start,start+48*progress),"orbit-line",'style="stroke:var(--theme-accent)" stroke-width="3" stroke-linecap="round"');
 if(media.canSeek)h+='<path d="'+arc(188,start,end)+'" fill="none" stroke="transparent" stroke-width="19" data-orbit-action="seek" data-orbit-angle="'+a+'" role="slider" aria-label="Playback position" aria-valuemin="0" aria-valuemax="'+duration+'" aria-valuenow="'+Math.round(position)+'" tabindex="0"/>';
 }else if(!media.enabled)h+=g(191,a,'<rect x="-35" y="-9" width="70" height="18" rx="5" fill="transparent"/>'+txt("CONNECT",3,9),button("connect","Enable media controls"));
 else h+=g(191,a,txt(media.available?"Playback time unavailable":"No active player",3,9,"orbit-muted"));
 return h;
}
function drawWidgets(offset=offsets.widgets){
 let h="";
 for(let i=-2;i<=2;i++){
 const a=45+i*60+offset;if(a+30<0||a-30>90)continue;
 const name=widgets[wrap(indices.widgets+i,widgets.length)];
 h+=path(sector(a-30,a+30),i===0?"orbit-raised":"orbit-ring",'data-orbit-widget="'+name+'"');
 if(name==="music")h+=music(a);
 else {
 const isCal=name==="calendar",now=new Date();
 h+=g(235,a,txt(isCal?"Calendar":"Audio Desk",3,13));
 h+=g(219,a,txt(isCal?now.toLocaleDateString([],{weekday:"short",day:"numeric",month:"short"}):"Audio news & discoveries",3,10,"orbit-muted"));
 h+=g(199,a,'<rect x="-32" y="-10" width="64" height="20" rx="6" class="orbit-accent"/><text text-anchor="middle" y="3" font-size="10" class="orbit-ink">OPEN</text>',button(name,isCal?"Open calendar":"Open Audio Desk news"));
 }
 }
 // Readable hints for the clipped neighbouring cards.
 if(Math.abs(offset)<.01){
 const prev=widgets[wrap(indices.widgets-1,widgets.length)],next=widgets[wrap(indices.widgets+1,widgets.length)];
 const symbol=x=>x==="music"?"♫":x==="calendar"?"▦":"≋";
 h+=g(218,7.5,'<rect x="-13" y="-22" width="26" height="44" rx="5" fill="transparent"/>'+txt(symbol(prev),5,19),button("widget:-1","Previous widget: "+prev));
 h+=g(218,82.5,'<rect x="-13" y="-22" width="26" height="44" rx="5" fill="transparent"/>'+txt(symbol(next),5,19),button("widget:1","Next widget: "+next));
 }
 q("orbitWidgets").innerHTML=h;
}
function drawSearch(){q("orbitSearch").innerHTML='<g '+button("search","Search installed apps")+'><path d="'+arc(60,0,90)+' L0,0 Z" class="orbit-raised"/><circle cx="-28" cy="-30" r="9" fill="none" stroke="var(--theme-text,#e5f0e7)" stroke-width="2.5"/><path d="M-21.5,-23.5 L-14,-16" fill="none" stroke="var(--theme-text,#e5f0e7)" stroke-width="2.5" stroke-linecap="round"/></g>'}
function draw(){if(!active())return;host.hidden=false;recentList=currentRecents();drawClock();drawExternalWidgets();drawWidgets();drawRecents();drawLetters();drawSearch();if(popupVisible)refreshPopup()}
function sync(){stopAllSpins();hidePopup();host.hidden=!active();drag=null;if(active()){redrawExternal();draw()}}
const oldHome=renderLauncherHome;
renderLauncherHome=function(){oldHome();if(active()&&!drag)draw()};
const oldClock=formatLauncherClock;formatLauncherClock=function(){oldClock();drawClock()};
const oldMedia=window.receiveAudioDeskMedia;window.receiveAudioDeskMedia=function(data){oldMedia(data);media=data||{};if(active()&&!drag)drawWidgets()};
// Media data arrives asynchronously via receiveAudioDeskMedia; no cross-module globals.
function action(code,target){
 if(!code)return;
 if(code==="picker:launch"){
  const pkg=target?.dataset.pickerPkg,activity=target?.dataset.pickerActivity;
  const match=launcherApps.find(a=>a.pkg===pkg&&a.activity===activity);
  if(match){hidePopup();window.AudioDesk?.launchExternalApp?.(match.pkg,match.activity)}
  return;
 }
 if(code.startsWith("fan-page:")){turnAppPage(Number(code.slice(9))||0);return}
 if(code==="search")openLauncherSearch();
 else if(code==="external:add")openNativeWidgetPicker();
 else if(code.startsWith("external:focus:")){externalIndex=wrap(Number(code.slice("external:focus:".length))||0,externalWidgetsList().length);indices.external=externalIndex;offsets.external=0;drawExternalWidgets()}
 else if(code.startsWith("letter:"))selectLetter(code.slice(7));
 else if(code.startsWith("recent:")){const app=recentList[Number(code.slice(7))];if(app)window.AudioDesk?.launchExternalApp?.(app.pkg,app.activity)}
 else if(code.startsWith("media:")){window.AudioDesk?.mediaCommand?.(code.slice(6))}
 else if(code==="connect")window.AudioDesk?.requestMediaAccess?.();
 else if(code==="calendar")openLauncherCalendar();
 else if(code==="news")setLauncherPage("events");
 else if(code.startsWith("widget:")){indices.widgets=wrap(indices.widgets+Number(code.slice(7)),widgets.length);drawWidgets()}
}
function coordinates(e){const rect=svg.getBoundingClientRect(),x=(e.clientX-rect.right)*334/rect.width,y=(e.clientY-rect.bottom)*334/rect.height;return {r:Math.hypot(x,y),a:Math.atan2(-y,-x)*180/pi}}
function seekAt(a,center){if(media.canSeek&&Number(media.durationMs)>0){const f=Math.max(0,Math.min(1,(a-center+24)/48));window.AudioDesk?.seekMedia?.(Math.round(f*media.durationMs))}}
function angularDifference(from,to){
 let d=to-from;
 if(d>180)d-=360;
 else if(d< -180)d+=360;
 return d;
}
svg.addEventListener("pointerdown",e=>{
 if(!active()||drag||e.button!==0)return;
 const loc=coordinates(e),target=e.target.closest("[data-orbit-action]"),code=target?.dataset.orbitAction;
 const which=loc.r>=182&&loc.r<=266?"widgets":loc.r>=112&&loc.r<=178?"recents":loc.r>=64&&loc.r<=108?"letters":null;
 if(!which&&!code)return;
 if(which)stopSpin(which);
 if(which==="letters")showPopup();
 const t=performance.now();
 drag={id:e.pointerId,which,lastAngle:loc.a,code,target,
  disabled:target?.getAttribute("aria-disabled")==="true",
  center:Number(target?.dataset.orbitAngle),total:0,moved:false,
  samples:[{t,angle:0}]};
 svg.setPointerCapture(e.pointerId);e.preventDefault();
});
svg.addEventListener("pointermove",e=>{
 if(!drag||drag.id!==e.pointerId)return;
 const loc=coordinates(e),change=angularDifference(drag.lastAngle,loc.a);
 drag.lastAngle=loc.a;drag.total+=change;
 const now=performance.now();
 drag.samples.push({t:now,angle:drag.total});
 drag.samples=drag.samples.filter(x=>now-x.t<=110);
 if(Math.abs(drag.total)>3)drag.moved=true;
 if(drag.code==="seek"||!drag.which||(drag.which==="recents"&&popupVisible))return;
 if(drag.moved)advanceRing(drag.which,change);
});
function finish(e,cancel=false){
 if(!drag||drag.id!==e.pointerId)return;
 const d=drag;drag=null;
 suppressNativeClickUntil=performance.now()+350;
 if(cancel){if(d.which)settleRing(d.which);return}
 if(d.code==="seek"){seekAt(coordinates(e).a,d.center);return}
 if(d.which==="recents"&&popupVisible&&d.moved){turnAppPage(d.total<0?1:-1);return}
 if(d.which&&d.moved){
  const last=d.samples[d.samples.length-1],first=d.samples[0];
  const elapsed=last.t-first.t;
  let speed=elapsed>=12?(last.angle-first.angle)/elapsed:0;
  if(performance.now()-last.t>90)speed=0;
  settleRing(d.which,speed);
 }else if(!d.disabled)action(d.code,d.target);
}
svg.addEventListener("pointerup",e=>finish(e));
svg.addEventListener("pointercancel",e=>finish(e,true));
svg.addEventListener("click",e=>{
 if(e.isTrusted&&performance.now()<suppressNativeClickUntil)return;
 const t=e.target.closest("[data-orbit-action]");
 if(t&&t.getAttribute("aria-disabled")!=="true")action(t.dataset.orbitAction,t);
});
svg.addEventListener("keydown",e=>{const t=e.target.closest("[data-orbit-action]");if(!t)return;if(e.key==="Enter"||e.key===" "){e.preventDefault();if(t.getAttribute("aria-disabled")!=="true")action(t.dataset.orbitAction)}else if(t.dataset.orbitAction==="seek"&&["ArrowLeft","ArrowRight"].includes(e.key)){e.preventDefault();window.AudioDesk?.seekMedia?.(Math.max(0,Math.min(media.durationMs,media.positionMs+(e.key==="ArrowLeft"?-5000:5000))))}});
for(const type of ["touchstart","touchmove","touchend","touchcancel"])host.addEventListener(type,e=>e.stopPropagation(),{passive:true});
for(const type of ["audio-desk-theme-changed","launcher-page-changed","audio-desk-foreground"])window.addEventListener(type,sync);
sync();
})();