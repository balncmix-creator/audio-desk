(()=>{
"use strict";
const el=id=>document.getElementById(id);
if(typeof window.AudioDesk?.setAcousticActive!=="function")return;
const spl=el("launcherSplWidget"),fft=el("launcherMicAnalyzer");
const addedKey="ad_acoustic_widgets_v1";
let added=[];try{const a=JSON.parse(deskStorage.getItem(addedKey)||"[]");if(Array.isArray(a))added=a}catch{}
let splOn=false,fftOn=false,permissionPending=false,activeKey="",levels=null,bands=[],peak=[],max=-Infinity,held=false,raw=false;
const weight=el("splWeight"),response=el("splResponse"),offset=el("splOffset"),range=el("micFftRange");
function read(k,def){return deskStorage.getItem("ad_acoustic_"+k)||def}
function save(k,v){deskStorage.setItem("ad_acoustic_"+k,String(v))}
weight.value=read("weight","A");response.value=read("response","fast");offset.value=read("offset","");range.value=read("range","90");
function visible(w){return launcherTheme!=="extreme"&&launcherTheme!=="orbit"&&!w.hidden&&!w.hasAttribute("data-widget-removed")&&document.getElementById("deskWorkspace")?.hidden!==false&&launcherPage==="home"&&!document.hidden&&window.audioDeskForeground!==false}
function sync(){
 const s=!permissionPending&&splOn&&visible(spl),f=!permissionPending&&fftOn&&visible(fft);
 const k=String(s)+":"+String(f);
 if(k!==activeKey){activeKey=k;window.AudioDesk.setAcousticActive(s,f)}
 el("splStart").textContent=splOn?"Stop mic":"Start mic";
 el("micFftStart").textContent=fftOn?"Stop mic":"Start mic";
 if(!s){levels=null;el("splReading").textContent="—";el("splBar").style.width="0%";el("splStatus").textContent=splOn?"Paused · widget not visible":"Microphone off"}
 scheduleNativePlot();
 if(!f){bands=[];peak=[];draw();el("micFftStatus").textContent=fftOn?"Paused · widget not visible":"Microphone off · real dBFS spectrum"}
}
function show(){
 for(const [w,b] of [[spl,el("acousticAddSpl")],[fft,el("acousticAddFft")]]){
  w.hidden=!added.includes(w.id);
  const on=!w.hidden&&!w.hasAttribute("data-widget-removed");
  b.hidden=false;b.textContent=on?"− Hide "+(w===spl?"SPL meter":"Microphone analyzer"):"+ Add "+(w===spl?"SPL meter":"Microphone analyzer");
 }
 sync();
}
function toggleWidget(w){
 const visibleNow=!w.hidden&&!w.hasAttribute("data-widget-removed");
 if(visibleNow){added=added.filter(id=>id!==w.id);if(w===spl)splOn=false;else fftOn=false}
 else{if(!added.includes(w.id))added.push(w.id);window.audioDeskRestoreWidget?.(w.id)}
 deskStorage.setItem(addedKey,JSON.stringify(added));show();
}
el("acousticAddSpl").onclick=()=>toggleWidget(spl);
el("acousticAddFft").onclick=()=>toggleWidget(fft);
const native=el("nativeWidgetsOpen");
if(typeof window.AudioDesk.openNativeWidgets==="function"){
 native.hidden=false;native.onclick=()=>{splOn=false;fftOn=false;sync();closeHomeOptions(true);window.AudioDesk.openNativeWidgets()}
}
function toggle(which){
 if(which==="spl")splOn=!splOn;else fftOn=!fftOn;
 if((which==="spl"?splOn:fftOn)){
  permissionPending=true;
  window.AudioDesk.enableAcousticMic?.();
  sync();
 }else sync();
}
el("splStart").onclick=()=>toggle("spl");
el("micFftStart").onclick=()=>toggle("fft");
function calibrated(){return offset.value.trim()!==""&&offset.validity.valid&&Number.isFinite(Number(offset.value))}
function renderSpl(){
 const value=levels?.[weight.value]?.[response.value];
 const cal=calibrated(),add=cal?Number(offset.value):0;
 el("splUnit").textContent=cal?"dB"+weight.value+" SPL (est.)":"dBFS "+weight.value;
 if(!Number.isFinite(value)){el("splReading").textContent="—";scheduleNativePlot();return}
 const level=value+add;
 max=Math.max(max,level);
 el("splReading").textContent=level.toFixed(1);
 el("splMax").textContent="Max "+max.toFixed(1);
 const p=Math.min(100,Math.max(0,cal?(level-25)/105*100:(value+100)));
 el("splBar").style.width=p+"%";
 el("splStatus").textContent=(cal?"Calibrated estimate":"Uncalibrated · digital level only")+" · "+(raw?"raw mic":"processed mic");
 scheduleNativePlot();
}
for(const [node,k] of [[weight,"weight"],[response,"response"],[offset,"offset"]]){
 node.addEventListener("change",()=>{save(k,node.value);max=-Infinity;el("splMax").textContent="Max —";renderSpl()});
}
el("splCalClear").onclick=()=>{offset.value="";save("offset","");max=-Infinity;el("splMax").textContent="Max —";renderSpl()};
el("splReset").onclick=()=>{max=-Infinity;el("splMax").textContent="Max —";renderSpl()};
const canvas=el("micFftCanvas"),ctx=canvas.getContext("2d");
const nativeCards=typeof window.AudioDesk?.renderNativeAcousticWidgets==="function";
const nativePlot=nativeCards||typeof window.AudioDesk?.renderNativeMicSpectrum==="function";
let lastNativePlot="",plotFrame=0;
function updateNativePlot(){
 if(!nativePlot)return false;
 const editing=el("widgetLayoutOverlay");
 const modal=(typeof hasLauncherOverlay==="function"&&hasLauncherOverlay())||
  [...document.querySelectorAll('[role="dialog"],[aria-modal="true"],.customize-overlay')].some(n=>!n.hidden&&n.getClientRects().length&&getComputedStyle(n).visibility!=="hidden"&&getComputedStyle(n).display!=="none");
 const blocked=modal||document.body.classList.contains("widget-dragging")||(editing&&!editing.hidden);
 const rootStyle=getComputedStyle(document.documentElement);
 const top=Math.max(0,parseFloat(rootStyle.getPropertyValue("--status-top"))||0);
 const bottom=innerHeight-Math.max(0,parseFloat(rootStyle.getPropertyValue("--system-bottom"))||0);
 const toHex=(value,fallback="#dddddd")=>{
  const v=String(value||"").trim();if(/^#[0-9a-f]{6}$/i.test(v))return v;
  const m=v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if(m)return "#"+m.slice(1,4).map(x=>Math.max(0,Math.min(255,+x)).toString(16).padStart(2,"0")).join("");
  if(/^#[0-9a-f]{3}$/i.test(v))return "#"+v.slice(1).split("").map(x=>x+x).join("");
  return fallback;
 };
 function geometry(w,node=w){
  const rect=node.getBoundingClientRect(),style=getComputedStyle(w);
  const allowed=visible(w)&&!blocked&&rect.width>0&&rect.height>0&&rect.bottom>top&&rect.top<bottom&&node.getClientRects().length>0&&getComputedStyle(node).display!=="none";
  if(!allowed)return {visible:false};
  const c=(key,fallback)=>toHex(style.getPropertyValue(key),fallback);
  return {visible:true,x:rect.left,y:rect.top,w:rect.width,h:rect.height,top,bottom,
   panel:c("--ds-panel",toHex(style.backgroundColor,"#27292c")),panel2:c("--ds-panel2","#35383b"),
   ink:c("--ds-text",toHex(style.color)),accent:c("--ds-accent",toHex(style.color)),
   muted:c("--ds-muted",toHex(style.color)),line:c("--ds-line","#555555"),
   radius:parseFloat(style.borderTopLeftRadius)||0,theme:launcherTheme};
 }
 let payload,micVisible;
 if(nativeCards){
  const s=geometry(spl),m=geometry(fft);micVisible=m.visible;
  // Preserve DOM boxes and editor geometry, but do not draw or expose duplicate UI
  // during normal native display. Keep the existing editor preview as a fallback.
  for(const [w,g] of [[spl,s],[fft,m]]){
   w.style.opacity=g.visible?"0":"";
   w.inert=!!g.visible;
  }
  canvas.style.opacity="";
  if(s.visible)Object.assign(s,{start:el("splStart").textContent,status:el("splStatus").textContent,reading:el("splReading").textContent,unit:el("splUnit").textContent,max:el("splMax").textContent,weight:weight.value,response:response.value,offset:offset.value,progress:Math.round(parseFloat(el("splBar").style.width)||0)});
  if(m.visible)Object.assign(m,{start:el("micFftStart").textContent,status:el("micFftStatus").textContent,range:Number(range.value)||90,held,bands,peak});
  payload={viewport:innerWidth,spl:s,mic:m};
 }else{
  const m=geometry(fft,canvas);micVisible=m.visible;
  canvas.style.opacity=m.visible?"0":"";
  payload={...m,viewport:innerWidth,range:Number(range.value)||90,held,bands,peak};
 }
 const json=JSON.stringify(payload);
 if(json!==lastNativePlot){lastNativePlot=json;
  if(nativeCards)window.AudioDesk.renderNativeAcousticWidgets(json);
  else window.AudioDesk.renderNativeMicSpectrum(json);
 }
 return !!micVisible;
}
window.audioDeskNativeAcousticAction=(name,value)=>{
 const clicks={micStart:"micFftStart",splStart:"splStart",reset:"splReset",clearCalibration:"splCalClear",peak:"micFftPeak",clearPeak:"micFftClear"};
 if(Object.prototype.hasOwnProperty.call(clicks,name))el(clicks[name]).click();
 else if(name==="editMic"||name==="editSpl"){window.audioDeskBeginWidgetResize?.(name==="editMic"?fft.id:spl.id)}
 else if(name==="calibration"){
  const n=Number(value);if(!Number.isFinite(n)||n<0||n>180)return;
  offset.value=String(n);offset.dispatchEvent(new Event("change",{bubbles:true}));
 }else{
  const choices={weight:[weight,["A","C","Z"]],response:[response,["fast","slow"]],range:[range,["90","120","60"]]};
  if(!Object.prototype.hasOwnProperty.call(choices,name))return;
  const [node,options]=choices[name];node.value=options[(options.indexOf(node.value)+1)%options.length];node.dispatchEvent(new Event("change",{bubbles:true}));
 }
 lastNativePlot="";scheduleNativePlot();
};
function scheduleNativePlot(){
 if(nativePlot&&!plotFrame)plotFrame=requestAnimationFrame(()=>{plotFrame=0;draw()});
}
function draw(){
 if(updateNativePlot())return;
 if(!ctx||fft.hidden||fft.hasAttribute("data-widget-removed"))return;
 const w=canvas.width,h=canvas.height;if(w<10||h<10)return;
 ctx.clearRect(0,0,w,h);
 const style=getComputedStyle(fft),ink=style.getPropertyValue("--ds-accent").trim()||"#ddd",fore=style.getPropertyValue("--ds-muted").trim()||ink;
 const left=29,right=w-5,top=6,bottom=h-18,span=Number(range.value)||90;
 const x=f=>left+Math.log(f/20)/Math.log(1000)*(right-left);
 const y=v=>top+Math.min(1,Math.max(0,-v/span))*(bottom-top);
 ctx.font="10px system-ui";ctx.textBaseline="middle";ctx.lineWidth=1;
 for(let db=0;db>=-span;db-=30){
  ctx.strokeStyle=fore;ctx.globalAlpha=.17;ctx.beginPath();ctx.moveTo(left,y(db));ctx.lineTo(right,y(db));ctx.stroke();
  ctx.fillStyle=fore;ctx.globalAlpha=.8;ctx.textAlign="right";ctx.fillText(String(db),left-3,y(db));
 }
 for(const [f,label] of [[20,"20"],[100,"100"],[1000,"1k"],[10000,"10k"],[20000,"20k"]]){
  ctx.globalAlpha=.17;ctx.strokeStyle=fore;ctx.beginPath();ctx.moveTo(x(f),top);ctx.lineTo(x(f),bottom);ctx.stroke();
  ctx.globalAlpha=.8;ctx.fillStyle=fore;ctx.textAlign=f===20?"left":f===20000?"right":"center";ctx.fillText(label,x(f),h-6);
 }
 function line(values,fill){
  if(values.length<2)return;
  ctx.beginPath();values.forEach((v,i)=>{const px=left+i/(values.length-1)*(right-left);if(i===0)ctx.moveTo(px,y(v));else ctx.lineTo(px,y(v))});
  if(fill){ctx.lineTo(right,bottom);ctx.lineTo(left,bottom);ctx.closePath();ctx.fillStyle=ink;ctx.globalAlpha=.13;ctx.fill();line(values,false)}
  else{ctx.strokeStyle=ink;ctx.globalAlpha=values===peak?.45:.95;ctx.stroke()}
 }
 line(bands,true);if(held)line(peak,false);ctx.globalAlpha=1;
}
function resize(){
 if(!visible(fft))return;
 const b=canvas.getBoundingClientRect(),w=Math.max(10,Math.round(b.width)),h=Math.max(10,Math.round(b.height));
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}draw()
}
if("ResizeObserver" in window)new ResizeObserver(resize).observe(canvas);
if(nativePlot){
 document.addEventListener("scroll",scheduleNativePlot,true);
 window.addEventListener("resize",scheduleNativePlot);
 for(const event of ["launcher-page-changed","audio-desk-foreground","audio-desk-theme-changed","audio-desk-workspace-visibility","audio-desk-widget-visibility"])
  window.addEventListener(event,()=>{lastNativePlot="";scheduleNativePlot()});
 // Observe only structural and visibility changes, not meter text updates.
 const observer=new MutationObserver(records=>{if(records.some(r=>r.target!==canvas))scheduleNativePlot()});
 observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["hidden","class","aria-modal","data-widget-removed"]});
}
range.onchange=()=>{save("range",range.value);draw()};
el("micFftPeak").onclick=()=>{held=!held;peak=[];el("micFftPeak").setAttribute("aria-pressed",String(held));draw()};
el("micFftClear").onclick=()=>{peak=[];draw()};
window.receiveAudioDeskAcoustics=data=>{
 if(data?.state==="granted"){permissionPending=false;activeKey="";sync();return}
 if(data?.state==="permission"||data?.state==="unavailable"){
  permissionPending=false;splOn=false;fftOn=false;sync();
  el("splStatus").textContent=el("micFftStatus").textContent=data.state==="permission"?"Microphone permission required":"Microphone unavailable";scheduleNativePlot();return
 }
 if(data?.state!=="active")return;
 raw=data.raw===true;
 if(splOn&&visible(spl)&&data.levels){levels=data.levels;renderSpl()}
 if(fftOn&&visible(fft)&&Array.isArray(data.bands)){
  bands=data.bands.map(v=>Number.isFinite(v)?v:-140);
  if(held)peak=bands.map((v,i)=>Math.max(v,peak[i]??-140));
  el("micFftStatus").textContent="Live · "+data.fftSize+" FFT · "+(data.sampleRate/1000)+" kHz · "+(raw?"raw":"processed mic");
  draw();
 }
};
window.addEventListener("audio-desk-widget-visibility",()=>{if(spl.hasAttribute("data-widget-removed"))splOn=false;if(fft.hasAttribute("data-widget-removed"))fftOn=false;show()});
for(const event of ["launcher-page-changed","audio-desk-foreground","audio-desk-theme-changed","audio-desk-workspace-visibility"])window.addEventListener(event,()=>{activeKey="";sync();resize()});
document.addEventListener("visibilitychange",()=>{activeKey="";sync()});
const oldTheme=setLauncherTheme;setLauncherTheme=function(theme){oldTheme(theme);show();resize()};
show();
})();