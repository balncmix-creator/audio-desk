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
let active=false,hasData=false,frameAt=0;
let listeningAt=0,idleTimer=0;
const RESOLUTION=64;
// Frames come exclusively from native Android PCM; no synthetic movements.
const target=new Float32Array(RESOLUTION);
const smooth=new Float32Array(RESOLUTION);
let history=[],pendingFrame=0,previousTick=0,lastDraw=0,historyTick=0;
let level=0,targetLevel=0;
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
 cancelAnimationFrame(pendingFrame);pendingFrame=0;
 previousTick=0;lastDraw=0;historyTick=0;
 hasData=false;frameAt=0;level=0;targetLevel=0;
 target.fill(0);smooth.fill(0);history=[];
 resizeCanvas();draw();
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
// Convert actual signed PCM into a time-windowed local RMS contour. Using
// smoothed energy instead of instantaneous phase prevents high-frequency
// samples from snapping/jittering between adjacent capture frames.
function pcmContour(samples){
 const raw=new Float32Array(RESOLUTION),out=new Float32Array(RESOLUTION);
 for(let i=0;i<RESOLUTION;i++){
  const middle=Math.round(i*(samples.length-1)/(RESOLUTION-1));
  let total=0,n=0;
  for(let j=Math.max(0,middle-3);j<=Math.min(samples.length-1,middle+3);j++){
   const sample=Math.max(-1,Math.min(1,Number(samples[j])||0));
   total+=sample*sample;n++;
  }
  raw[i]=Math.sqrt(total/Math.max(1,n));
 }
 // A second, spatially-local smoothing pass makes the ripples rounded like
 // liquid, without inventing any amplitudes absent from the real PCM.
 for(let i=0;i<RESOLUTION;i++){
  const left2=raw[Math.max(0,i-2)],left=raw[Math.max(0,i-1)];
  const right=raw[Math.min(RESOLUTION-1,i+1)];
  const right2=raw[Math.min(RESOLUTION-1,i+2)];
  out[i]=(left2+2*left+3*raw[i]+2*right+right2)/9;
 }
 return out;
}
function curve(points,offset,gain,w,h,polarity){
 const count=points.length;
 if(count<2)return;
 const y=i=>{
  const edge=Math.pow(Math.sin(Math.PI*i/(count-1)),.58);
  return h*.5+offset+polarity*points[i]*edge*h*.31*gain;
 };
 context.beginPath();context.moveTo(0,y(0));
 for(let i=0;i<count-1;i++){
  const middle=(i+.5)*w/(count-1),left=i*w/(count-1);
  context.quadraticCurveTo(left,y(i),middle,(y(i)+y(i+1))*.5);
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
 // Transparent canvas: no inner square. The center line is real silence.
 context.save();
 context.strokeStyle=accent;context.globalAlpha=.15;
 context.lineWidth=Math.max(1,w/420);
 context.beginPath();context.moveTo(2,h/2);context.lineTo(w-2,h/2);
 context.stroke();context.restore();
 if(!active||!hasData||level<.006)return;
 context.save();
 const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches||
  document.body.classList.contains("low-power");
 const layers=reduced?3:7;
 context.globalCompositeOperation="screen";
 for(let i=layers-1;i>=0;i--){
  const wave=i===0?smooth:history[Math.min(i-1,history.length-1)]||smooth;
  const polarity=i%2===0?1:-1;
  const offset=i===0?0:(i%2?1:-1)*Math.floor((i+1)/2)*Math.min(h*.022,1.6);
  const gain=(.37+level*.98)*(1+i*.07);
  curve(wave,offset,gain,w,h,polarity);
  context.strokeStyle=i===0?accent:(i%3===0?pale:accent);
  context.lineWidth=(i===0?2.1:1.05)*Math.min(1.5,window.devicePixelRatio||1);
  context.globalAlpha=i===0?.94:Math.max(.10,.60-i*.075);
  context.shadowColor=accent;
  context.shadowBlur=reduced?0:(i===0?15:11)*Math.min(1.6,window.devicePixelRatio||1);
  context.stroke();
 }
 context.restore();
}
function tick(now){
 pendingFrame=0;
 const seconds=previousTick?
  Math.max(.008,Math.min(.07,(now-previousTick)/1000)):.016;
 previousTick=now;
 // When input stops, ease to silence; don't fabricate a looping wave.
 if(frameAt&&now-frameAt>160){
  target.fill(0);targetLevel=0;
 }
 // Water-like movement: ~420ms rise and ~1050ms decay, time-based so it
 // remains consistent on both 30Hz budget phones and fast 120Hz screens.
 for(let i=0;i<RESOLUTION;i++){
  const tau=target[i]>smooth[i]?.42:1.05;
  const blend=1-Math.exp(-seconds/tau);
  smooth[i]+=(target[i]-smooth[i])*blend;
 }
 const levelTau=targetLevel>level?.42:1.05;
 level+=(targetLevel-level)*(1-Math.exp(-seconds/levelTau));
 if(!historyTick||now-historyTick>=105){
  historyTick=now;
  history.unshift(Float32Array.from(smooth));
  if(history.length>7)history.length=7;
 }
 const lowPower=document.body.classList.contains("low-power");
 if(now-lastDraw>=(lowPower?50:32)){
  lastDraw=now;resizeCanvas();draw();
 }
 if(targetLevel>.001||level>.006||(frameAt&&now-frameAt<160)){
  pendingFrame=requestAnimationFrame(tick);
 }else{
  level=0;hasData=false;target.fill(0);smooth.fill(0);history=[];
  draw();
 }
}
function scheduleDraw(){
 if(!pendingFrame)pendingFrame=requestAnimationFrame(tick);
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
 const rms=Math.min(1,Math.max(0,Number(data.rms)||0));
 if(rms>.009){
  active=true;hasData=true;frameAt=performance.now();
  target.set(pcmContour(data.samples));
  targetLevel=Math.min(1,rms*2.1);
  if(status.textContent!=="Live · real audio, smoothed")
   setStatus("Live · real audio, smoothed");
  showProjection(false);
 }else{
  // Silence falls away gently; do not immediately erase a real last wave.
  target.fill(0);targetLevel=0;
  if(level<.006)setStatus("Silent or paused · waveform at rest");
 }
 scheduleDraw();
};
const stateHandler=window.receiveAudioDeskMedia;
window.receiveAudioDeskMedia=function(data){
 stateHandler?.(data);
 if(!data?.playing&&active&&performance.now()-frameAt>450){
  target.fill(0);targetLevel=0;scheduleDraw();
  setStatus("Paused · smoothly returning to rest");
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
 smoothing:()=>({level,targetLevel,riseMs:420,releaseMs:1050}),
 stop:()=>{wanted=false;deskStorage.setItem(key,"false");sync()}
};
})();
