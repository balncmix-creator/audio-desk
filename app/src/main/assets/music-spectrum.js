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
// The wave shape comes from actual FFT magnitudes (28 frequency bands).
// RMS controls the energy envelope. Equal-RMS signals with DIFFERENT
// frequency content must look different; a constant oval is not a spectrum.
const SETTINGS_KEY="ad_visualizer_tuning_v1";
const PRESETS={
 fast:{speed:5,attackMs:18,releaseMs:115,sensitivity:175,height:95,glow:70,trails:6},
 balanced:{speed:3,attackMs:55,releaseMs:240,sensitivity:145,height:88,glow:65,trails:6},
 fluid:{speed:2,attackMs:115,releaseMs:450,sensitivity:125,height:90,glow:85,trails:7}
};
const LIMITS={speed:[1,8],attackMs:[8,240],releaseMs:[40,850],
 sensitivity:[50,400],height:[40,100],glow:[0,100],trails:[1,7]};
function loadTuning(){
 const settings={...PRESETS.fast,mode:"spectrum"};
 try{
  const saved=JSON.parse(deskStorage.getItem(SETTINGS_KEY)||"null");
  if(saved&&typeof saved==="object"){
  if(saved.mode==="wave"||saved.mode==="spectrum")settings.mode=saved.mode;
  for(const name of Object.keys(LIMITS)){
   if(Number.isFinite(Number(saved[name]))&&saved[name]!=null){
    const [lo,hi]=LIMITS[name];
    settings[name]=Math.max(lo,Math.min(hi,Math.round(Number(saved[name]))));
   }
  }
 }
 }catch{}
 return settings;
}
const tuning=loadTuning();
function configureTuning(patch){
 if(!patch||typeof patch!=="object")return;
 if(patch.mode==="wave"||patch.mode==="spectrum")tuning.mode=patch.mode;
 for(const name of Object.keys(LIMITS)){
  if(!Object.prototype.hasOwnProperty.call(patch,name)||!Number.isFinite(Number(patch[name])))continue;
  const [lo,hi]=LIMITS[name];
  tuning[name]=Math.max(lo,Math.min(hi,Math.round(Number(patch[name]))));
 }
 deskStorage.setItem(SETTINGS_KEY,JSON.stringify(tuning));
 scheduleDraw();
}
function applyPreset(name){
 if(Object.prototype.hasOwnProperty.call(PRESETS,name))configureTuning(PRESETS[name]);
}
const RMS_REFERENCE=.16,RMS_EXPONENT=.52;
const target=new Float32Array(RESOLUTION);
const smooth=new Float32Array(RESOLUTION);
let history=[],pendingFrame=0,previousTick=0,lastDraw=0,historyTick=0,lastRmsLabelAt=0;
let level=0,targetLevel=0,rawRms=0,lastSource="";
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
function activeHome(){return wanted&&launcherPage==="home"&&!document.hidden&&!widget.hasAttribute("data-widget-removed")}
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
 hasData=false;frameAt=0;level=0;targetLevel=0;rawRms=0;lastSource="";
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
// The Native bridge supplies real root-mean-square PCM levels. Map RMS to
// visually useful height with a compressive curve (without a fake amplitude
// floor), so quiet music remains legible while louder hits can fill the band.
function rmsHeight(rms){
 if(rms<=.006)return 0;
 return Math.min(.98,Math.pow(Math.min(1,rms/(RMS_REFERENCE/(tuning.sensitivity/100))),RMS_EXPONENT));
}
function pushBands(bands,rms){
 // Log-frequency energy from Android FFT or FFT of permitted PCM. The
 // previous code plotted a time-history of ONE RMS value and became an oval.
 const n=bands.length;
 if(n<8)return false;
 const gain=rmsHeight(rms);
 const raw=new Float32Array(RESOLUTION);
 const peak=Math.max(...bands.map(value=>Math.max(0,Number(value)||0)));
 if(peak<.005||gain<=0)return false;
 for(let i=0;i<RESOLUTION;i++){
  const position=i*(n-1)/(RESOLUTION-1);
  const lo=Math.floor(position),hi=Math.min(n-1,lo+1);
  const fraction=position-lo;
  const low=Math.max(0,Math.min(1,Number(bands[lo])||0));
  const high=Math.max(0,Math.min(1,Number(bands[hi])||0));
  // A little local smoothing yields flowing curves without inventing peaks.
  raw[i]=(low*(1-fraction)+high*fraction)*gain;
 }
 for(let i=0;i<RESOLUTION;i++){
  const before=raw[Math.max(0,i-1)];
  const after=raw[Math.min(RESOLUTION-1,i+1)];
  target[i]=(.18*before+.64*raw[i]+.18*after);
 }
 return true;
}
// Single-sided analyzer: frequency runs left-to-right on a logarithmic
// axis and levels rise from the BOTTOM only. No reflection around center.
function spectrumPlot(){
 const w=canvas.width,h=canvas.height;
 const bottom=h-Math.max(12,Math.min(18,h*.18));
 const top=Math.max(4,h*.055);
 const range=Math.max(1,bottom-top);
 const amplitude=(tuning.height/100)*.95;
 return Array.from(smooth,(value,i)=>({
  x:(i/(RESOLUTION-1))*w,
  y:Math.max(top,Math.min(bottom,bottom-Math.max(0,value)*range*amplitude))
 }));
}
function drawSpectrum(accent,reduced){
 if(!context)return;
 const w=canvas.width,h=canvas.height;
 const points=spectrumPlot();
 const bottom=h-Math.max(12,Math.min(18,h*.18));
 const dpr=canvas.width/Math.max(1,shell.clientWidth);
 const ticks=[["50",50],["100",100],["200",200],["500",500],
  ["1k",1000],["2k",2000],["5k",5000],["10k",10000]];
 const left=Math.log(42),span=Math.log(10500)-left;
 context.save();
 context.lineWidth=Math.max(.6,dpr*.5);
 context.textAlign="center";context.textBaseline="bottom";
 context.font=Math.max(8,Math.min(11,h*.115))+"px system-ui, sans-serif";
 for(let j=1;j<=3;j++){
  const y=bottom-j*(bottom-3)/4;
  context.beginPath();context.moveTo(0,y);context.lineTo(w,y);
  context.strokeStyle=accent;context.globalAlpha=.055;context.stroke();
 }
 for(const [name,frequency] of ticks){
  const x=(Math.log(frequency)-left)/span*w;
  if(x<12||x>w-12)continue;
  context.beginPath();context.moveTo(x,3);context.lineTo(x,bottom);
  context.strokeStyle=accent;context.globalAlpha=.095;context.stroke();
  context.fillStyle=accent;context.globalAlpha=.60;context.fillText(name,x,h-1);
 }
 context.beginPath();context.moveTo(0,bottom);
 context.lineTo(w,bottom);
 context.strokeStyle=accent;context.globalAlpha=.26;context.stroke();
 if(active&&hasData&&level>.006&&points.length>=2){
  context.beginPath();context.moveTo(points[0].x,bottom);
  context.lineTo(points[0].x,points[0].y);
  for(let i=1;i<points.length-1;i++){
   const a=points[i],b=points[i+1];
   context.quadraticCurveTo(a.x,a.y,(a.x+b.x)/2,(a.y+b.y)/2);
  }
  const last=points[points.length-1];
  context.lineTo(last.x,last.y);
  context.lineTo(w,bottom);
  context.closePath();
  const fill=context.createLinearGradient(0,0,0,bottom);
  fill.addColorStop(0,accent);
  fill.addColorStop(1,accent);
  context.fillStyle=fill;context.globalAlpha=.17;context.fill();
  context.beginPath();context.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length-1;i++){
   const a=points[i],b=points[i+1];
   context.quadraticCurveTo(a.x,a.y,(a.x+b.x)/2,(a.y+b.y)/2);
  }
  context.lineTo(last.x,last.y);
  context.globalAlpha=.92;context.lineWidth=Math.max(1.15,dpr*1.4);
  context.strokeStyle=accent;
  context.shadowColor=accent;
  context.shadowBlur=reduced?0:Math.min(18,9*dpr)*(tuning.glow/70);
  context.stroke();
 }
 context.restore();
}
function curve(points,offset,gain,w,h,polarity){
 const count=points.length;
 if(count<2)return;
 const y=i=>{
  const edge=Math.pow(Math.sin(Math.PI*i/(count-1)),.58);
  return h*.5+offset+polarity*points[i]*edge*h*.425*gain;
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
 const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches||
  document.body.classList.contains("low-power");
 if(tuning.mode==="spectrum"){
  drawSpectrum(accent,reduced);
  return;
 }
 // Mirrored "Wave" view is the alternative style, not the default.
 // Transparent canvas: no inner square. The center line is real silence.
 context.save();
 context.strokeStyle=accent;context.globalAlpha=.15;
 context.lineWidth=Math.max(1,w/420);
 context.beginPath();context.moveTo(2,h/2);context.lineTo(w-2,h/2);
 context.stroke();context.restore();
 if(!active||!hasData||level<.006)return;
 context.save();
 const layers=Math.min(tuning.trails,reduced?3:7);
 context.globalCompositeOperation="screen";
 for(let i=layers-1;i>=0;i--){
  const wave=i===0?smooth:history[Math.min(i-1,history.length-1)]||smooth;
  const polarity=i%2===0?1:-1;
  const offset=i===0?0:(i%2?1:-1)*Math.floor((i+1)/2)*Math.min(h*.022,1.6);
  // Band heights already include RMS; do not multiply energy twice.
  const gain=(.92+i*.035)*(tuning.height/100);
  curve(wave,offset,gain,w,h,polarity);
  context.strokeStyle=i===0?accent:(i%3===0?pale:accent);
  context.lineWidth=(i===0?2.1:1.05)*Math.min(1.5,window.devicePixelRatio||1);
  context.globalAlpha=i===0?.94:Math.max(.10,.60-i*.075);
  context.shadowColor=accent;
  context.shadowBlur=reduced?0:(i===0?15:11)*Math.min(1.6,window.devicePixelRatio||1)*
   tuning.glow/70;
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
 if(frameAt&&now-frameAt>360){
  target.fill(0);targetLevel=0;
 }
 // Adjustable true RMS ballistics, time-based for all display refresh rates.
 for(let i=0;i<RESOLUTION;i++){
  const tau=(target[i]>smooth[i]?tuning.attackMs:tuning.releaseMs)/
   (1000*(.65+tuning.speed/7));
  const blend=1-Math.exp(-seconds/tau);
  smooth[i]+=(target[i]-smooth[i])*blend;
 }
 const levelTau=(targetLevel>level?tuning.attackMs:tuning.releaseMs)/
  (1000*(.65+tuning.speed/7));
 level+=(targetLevel-level)*(1-Math.exp(-seconds/levelTau));
 if(!historyTick||now-historyTick>=65){
  historyTick=now;
  history.unshift(Float32Array.from(smooth));
  if(history.length>7)history.length=7;
 }
 const lowPower=document.body.classList.contains("low-power");
 if(now-lastDraw>=(lowPower?50:32)){
  lastDraw=now;resizeCanvas();draw();
 }
 if(targetLevel>.001||level>.006||(frameAt&&now-frameAt<360)){
  pendingFrame=requestAnimationFrame(tick);
 }else{
  level=0;hasData=false;target.fill(0);smooth.fill(0);history=[];
  if(wanted&&activeHome()&&active)setStatus("Silent or paused · waveform at rest");
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
 if(state!=="capturing")return;
 const rms=Math.min(1,Math.max(0,Number(data.rms)||0));
 rawRms=rms;frameAt=performance.now();
 if(rms>.006 && Array.isArray(data.bands) && data.bands.length>=8){
  active=true;
  hasData=pushBands(data.bands,rms);
  targetLevel=rmsHeight(rms);
  lastSource=String(data.source||"frequency-fft").slice(0,30);
  if(performance.now()-lastRmsLabelAt>240){
   lastRmsLabelAt=performance.now();
   setStatus("LIVE FFT + RMS "+(20*Math.log10(rms)).toFixed(1)+" dBFS");
  }
  showProjection(false);
 }else{
  target.fill(0);targetLevel=0;
  if(rms>.006){
   // Preserve the truthful RMS meter, but never draw a made-up spectrum.
   setStatus("Audio RMS detected · no frequency data from this player");
   showProjection(true);
  }else if(level<.006)setStatus("Silent or paused · waveform at rest");
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
window.addEventListener("audio-desk-widget-visibility",sync);
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
 smoothing:()=>({level,targetLevel,rawRms,riseMs:tuning.attackMs,releaseMs:tuning.releaseMs,
  currentWaveHeight:smooth[Math.floor(RESOLUTION/2)],
  maxWaveHeight:Math.max(...smooth)}),
 settings:()=>({...tuning}),configure:configureTuning,preset:applyPreset,
 displayGeometry:()=>({mode:tuning.mode,points:spectrumPlot()}),
 frequencyState:()=>({target:Array.from(target),smooth:Array.from(smooth),lastSource}),
 stop:()=>{wanted=false;deskStorage.setItem(key,"false");sync()}
};
})();
