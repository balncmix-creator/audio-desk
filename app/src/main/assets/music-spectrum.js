/* Real-time Music Spectrum — Audio Desk.
 * Deliberately renders ONLY Android-provided PCM waveform frames; no
 * simulated activity, fake beats, remote sound, or microphone substitute.
 * Seven layered trails retain the delicacy/glow of the user's reference.
 * Colors come from wallpaper theme tokens; animation never overlaps controls.
 */
(()=>{
"use strict";
const byId=id=>document.getElementById(id);
const widget=byId("launcherMusicWidget");
if(!widget)return;
const key="ad_real_spectrum_optin_v1";
let wanted=deskStorage.getItem(key)==="true";
let active=false, hasData=false, frameAt=0, lastDraw=0;
let listeningAt=0, idleTimer=0;
let trail=[],pendingFrame=0, amplitude=0, liveRms=0;
const head=widget.querySelector(".music-head"),buttons=widget.querySelector(".music-buttons");
const shell=document.createElement("div");
shell.id="musicSpectrum";
shell.className="music-spectrum-shell";
shell.setAttribute("role","img");
shell.setAttribute("aria-label","Audio spectrum driven by captured playback, when available");
const canvas=document.createElement("canvas");
canvas.id="musicSpectrumCanvas";
canvas.setAttribute("aria-hidden","true");
shell.append(canvas);
head.after(shell);
const actions=document.createElement("div");
actions.id="musicSpectrumActions";actions.className="music-spectrum-actions";
actions.innerHTML='<button id="musicSpectrumEnable" type="button">Enable real spectrum</button>'+
 '<button id="musicSpectrumProjection" type="button" hidden>Capture permitted playback</button>'+
 '<small id="musicSpectrumStatus" aria-live="polite">Off · no audio is captured</small>';
shell.after(actions);
const enable=byId("musicSpectrumEnable"),projection=byId("musicSpectrumProjection");
const status=byId("musicSpectrumStatus"),context=canvas.getContext("2d",{alpha:true});
function fontColor(){return getComputedStyle(widget).getPropertyValue("--ds-accent").trim()||"#dddddd"}
function activeHome(){return wanted&&launcherPage==="home"&&!document.hidden}
function setStatus(text){status.textContent=text}
function showProjection(allow){
 projection.hidden=!allow||typeof window.AudioDesk?.requestSpectrumProjection!=="function";
}
function updateButtons(){
 enable.hidden=wanted;
 if(!wanted){
  actions.classList.remove("spectrum-running");
  setStatus("Off · no audio is captured");
  showProjection(false);
 }else actions.classList.add("spectrum-running");
}
function resetWave(){
 hasData=false;amplitude=0;liveRms=0;trail=[];
 scheduleDraw();
}
function resizeCanvas(){
 if(!context)return;
 const box=shell.getBoundingClientRect();
 const dpr=Math.min(document.body.classList.contains("low-power")?1:1.5,
  window.devicePixelRatio||1);
 const width=Math.max(10,Math.round(box.width*dpr));
 const height=Math.max(10,Math.round(box.height*dpr));
 if(canvas.width!==width||canvas.height!==height){
  canvas.width=width;canvas.height=height;draw();
 }
}
function curve(points,offset,gain,w,h){
 const count=points.length;if(count<2)return;
 const y=i=>h*.5+offset+points[i]*h*.31*gain;
 context.beginPath();
 context.moveTo(0,y(0));
 for(let i=0;i<count-1;i++){
  const a=(i+.5)*w/(count-1),b=i*w/(count-1);
  context.quadraticCurveTo(b,y(i),a,(y(i)+y(i+1))*.5);
 }
 context.lineTo(w,y(count-1));
}
function draw(){
 if(!context)return;
 const w=canvas.width,h=canvas.height;
 if(!w||!h)return;
 context.clearRect(0,0,w,h);
 const accent=fontColor();
 const pale=getComputedStyle(widget).getPropertyValue("--theme-text").trim()||accent;
 // The stationary line is legitimate silence, never an idle/simulated wave.
 context.save();
 context.strokeStyle=accent;context.globalAlpha=.22;
 context.lineWidth=Math.max(1,w/370);
 context.beginPath();context.moveTo(2,h/2);context.lineTo(w-2,h/2);
 context.stroke();context.restore();
 if(!active||!hasData||amplitude<.006||!trail.length)return;
 context.save();
 const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches||
  document.body.classList.contains("low-power");
 const layers=reduced?3:7;
 context.globalCompositeOperation="screen";
 for(let i=layers-1;i>=0;i--){
  const wave=trail[Math.min(i,trail.length-1)];
  if(!wave)continue;
  const sign=i%2===0?1:-1;
  const offset=sign*Math.floor(i/2+1)*Math.min(h*.028,2.3);
  const scale=(1+i*.065)*Math.min(1.4,.48+amplitude*1.55);
  curve(wave,offset,scale,w,h);
  const outer=i===0?accent:(i%3===0?pale:accent);
  context.strokeStyle=outer;
  context.lineWidth=(i===0?2.2:1.1)*Math.min(1.5,window.devicePixelRatio||1);
  context.globalAlpha=i===0?.95:Math.max(.11,.66-i*.09);
  context.shadowColor=accent;
  context.shadowBlur=reduced?0:(i===0?14:9)*Math.min(1.6,window.devicePixelRatio||1);
  context.stroke();
 }
 context.restore();
}
function scheduleDraw(){
 if(pendingFrame)return;
 pendingFrame=requestAnimationFrame(()=>{pendingFrame=0;resizeCanvas();draw()});
}
function shouldCapture(){
 return activeHome()&&!!window.AudioDesk?.setSpectrumActive;
}
function sync(){
 const home=activeHome();
 // The native backend stops immediately when Home is hidden or Android loses
 // foreground focus. We do not capture while other activities are displayed.
 try{window.AudioDesk?.setSpectrumActive?.(home)}catch{}
 if(!home){
  active=false;resetWave();
  if(wanted)setStatus("Paused · Home not visible");
 }else if(wanted){
  listeningAt=Date.now();
  setStatus("Listening for actual audio…");
 }
 updateButtons();
}
enable.onclick=()=>{
 wanted=true;
 deskStorage.setItem(key,"true");
 updateButtons();
 if(!window.AudioDesk?.requestSpectrumCapture){
  setStatus("Real capture requires the installed Android APK");
  return;
 }
 listeningAt=Date.now();
 setStatus("Requesting audio visualization permission…");
 window.AudioDesk.requestSpectrumCapture();
};
projection.onclick=()=>{
 if(typeof window.AudioDesk?.requestSpectrumProjection!=="function")return;
 setStatus("Android will ask before capturing permitted playback");
 window.AudioDesk.requestSpectrumProjection();
};
window.receiveAudioDeskSpectrum=function(data){
 if(!wanted||!data||typeof data!=="object")return;
 const state=data.state;
 if(state==="permission"){
  active=false;resetWave();
  setStatus("Audio permission needed · tap Enable in Android settings");
  enable.hidden=false;enable.textContent="Grant audio permission";
  showProjection(false);
  return;
 }
 if(state==="unsupported"){
  active=false;resetWave();
  setStatus("Output mix unavailable. Use Android playback capture instead.");
  showProjection(true);
  return;
 }
 if(state==="stopped"){
  active=false;resetWave();
  if(launcherPage==="home"&&!document.hidden)setStatus("Spectrum idle");
  return;
 }
 if(state==="listening"){
  active=true;listeningAt=Date.now();
  setStatus("Listening to real playback…");
  return;
 }
 if(state!=="capturing"||!Array.isArray(data.samples)||data.samples.length<16)return;
 const wave=data.samples.map(v=>Math.max(-1,Math.min(1,Number(v)||0)));
 const rms=Math.min(1,Math.max(0,Number(data.rms)||0));
 // PCM mean-square energy and every contour point originate in the native
 // audio stream. Trails preserve previous REAL frames; never add randomness.
 if(rms>.009){
  active=true;hasData=true;frameAt=Date.now();
  liveRms=liveRms*.72+rms*.28;
  amplitude=Math.min(1,Math.max(.018,liveRms*2.2));
  trail.unshift(wave);trail.length=Math.min(7,trail.length);
  setStatus("Live · actual playback signal");
  showProjection(false);
 }else{
  liveRms*=.35;amplitude*=.35;
  if(amplitude<.01){resetWave();setStatus("Silent or paused · waveform at rest")}
 }
 scheduleDraw();
};
const stateHandler=window.receiveAudioDeskMedia;
window.receiveAudioDeskMedia=function(data){
 stateHandler?.(data);
 if(!data?.playing&&active&&Date.now()-frameAt>1000){
  resetWave();
  setStatus("Paused · waveform at rest");
 }
};
function checkInput(){
 if(!wanted||!activeHome())return;
 // A player may forbid capture, or Android may expose only silence. We
 // never replace missing audio with a decorative pretend signal.
 if(!hasData&&listeningAt&&Date.now()-listeningAt>5000){
  setStatus("No audio signal · player may block capture");
  showProjection(true);
 }
}
idleTimer=setInterval(checkInput,1200);
window.addEventListener("launcher-page-changed",sync);
window.addEventListener("visibilitychange",sync);
window.addEventListener("focus",()=>{if(wanted)sync()});
const previousResume=window.launcherOnResume;
window.launcherOnResume=function(){previousResume?.();if(wanted)sync()};
if("ResizeObserver" in window)new ResizeObserver(resizeCanvas).observe(shell);
else window.addEventListener("resize",resizeCanvas);
window.addEventListener("resize",scheduleDraw);
updateButtons();resizeCanvas();
if(wanted&&window.AudioDesk?.setSpectrumActive)sync();
window.audioDeskSpectrum={
 active:()=>active,enabled:()=>wanted,
 redraw:draw,
 stop:()=>{wanted=false;deskStorage.setItem(key,"false");sync()}
};
})();
