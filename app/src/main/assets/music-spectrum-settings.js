/* Lightweight visualizer tune panel. All controls edit the LIVE, real-PCM
 * visualizer state. No generated beats, sound, or artificial audio signals. */
(()=>{
"use strict";
const spectrum=window.audioDeskSpectrum;
const actions=document.getElementById("musicSpectrumActions");
if(!spectrum||!actions)return;
const presets={
 fast:{speed:5,attackMs:18,releaseMs:115,sensitivity:175,height:95,glow:70,trails:6},
 balanced:{speed:3,attackMs:55,releaseMs:240,sensitivity:145,height:88,glow:65,trails:6},
 fluid:{speed:2,attackMs:115,releaseMs:450,sensitivity:125,height:90,glow:85,trails:7}
};
const controls=[
 ["speed","Wave speed",1,8,1,"×","How quickly real RMS readings move across the wave"],
 ["attackMs","Attack",8,240,1," ms","How quickly the visualizer rises on a beat"],
 ["releaseMs","Release",40,850,10," ms","How long energy fades after each beat"],
 ["sensitivity","RMS sensitivity",50,400,5,"%","How prominently quiet music appears"],
 ["height","Wave height",40,100,5,"%","How tall the wave grows inside the widget"],
 ["glow","Glow",0,100,5,"%","Soft halo around the waveform lines"],
 ["trails","Wave layers",1,7,1,"","Number of overlapping glowing lines"]
];
const button=document.createElement("button");
button.id="musicSpectrumSettingsToggle";
button.type="button";
button.textContent="⚙ Tune";
button.setAttribute("aria-controls","musicSpectrumTuningDialog");
button.setAttribute("aria-expanded","false");
button.setAttribute("aria-label","Open music visualizer settings");
actions.appendChild(button);
const overlay=document.createElement("div");
overlay.id="musicSpectrumTuningOverlay";
overlay.className="music-spectrum-tuning-overlay";
overlay.hidden=true;
overlay.innerHTML=`
 <section id="musicSpectrumTuningDialog" class="music-spectrum-tuning"
  role="dialog" aria-modal="true" aria-label="Music visualizer settings">
  <div class="spectrum-tuning-header">
   <div><strong>Visualizer settings</strong><small>Adjust response while listening</small></div>
   <button type="button" id="musicSpectrumTuningClose" aria-label="Close visualizer settings">×</button>
  </div>
  <div class="spectrum-tuning-presets" role="group" aria-label="Visualizer presets">
   <button type="button" data-spectrum-preset="fast">Fast</button>
   <button type="button" data-spectrum-preset="balanced">Balanced</button>
   <button type="button" data-spectrum-preset="fluid">Fluid</button>
  </div>
  <div id="musicSpectrumTuningControls" class="spectrum-tuning-controls"></div>
  <div class="spectrum-tuning-footer">
   <small>Updates immediately · saved automatically on this phone. Audio data stays on-device.</small>
   <button type="button" id="musicSpectrumTuningReset">Reset</button>
  </div>
 </section>`;
document.body.appendChild(overlay);
const closeButton=document.getElementById("musicSpectrumTuningClose");
const sliderHost=document.getElementById("musicSpectrumTuningControls");
for(const [key,label,min,max,step,unit,helper] of controls){
 const row=document.createElement("div");
 row.className="spectrum-tuning-row";
 row.innerHTML='<div class="spectrum-tuning-label"><label for="spec-setting-'+key+'">'+
  label+'</label><output id="spec-value-'+key+'" for="spec-setting-'+key+
  '"></output></div><input type="range" id="spec-setting-'+key+
  '" min="'+min+'" max="'+max+'" step="'+step+'">'+
  '<small>'+helper+'</small>';
 sliderHost.appendChild(row);
 row.querySelector("input").addEventListener("input",event=>{
  spectrum.configure({[key]:Number(event.target.value)});
  update();
 });
}
function update(){
 const values=spectrum.settings();
 for(const [key,,min,max,step,unit] of controls){
  const input=document.getElementById("spec-setting-"+key);
  input.value=values[key];
  document.getElementById("spec-value-"+key).textContent=values[key]+unit;
 }
 overlay.querySelectorAll("[data-spectrum-preset]").forEach(preset=>{
  const p=presets[preset.dataset.spectrumPreset];
  const pressed=Object.keys(p).every(k=>values[k]===p[k]);
  preset.setAttribute("aria-pressed",String(pressed));
 });
}
function close(){
 if(overlay.hidden)return;
 overlay.hidden=true;
 button.setAttribute("aria-expanded","false");
 if(document.activeElement?.closest("#musicSpectrumTuningOverlay"))button.focus();
}
button.addEventListener("click",()=>{
 update();
 overlay.hidden=false;
 button.setAttribute("aria-expanded","true");
 closeButton.focus();
});
closeButton.addEventListener("click",close);
overlay.addEventListener("click",event=>{if(event.target===overlay)close()});
window.addEventListener("keydown",event=>{
 if(!overlay.hidden&&event.key==="Escape"){event.preventDefault();close()}
});
window.addEventListener("launcher-page-changed",close);
overlay.querySelectorAll("[data-spectrum-preset]").forEach(preset=>{
 preset.addEventListener("click",()=>{
  spectrum.preset(preset.dataset.spectrumPreset);
  update();
 });
});
document.getElementById("musicSpectrumTuningReset").addEventListener("click",()=>{
 spectrum.preset("fast");update();
});
update();
})();
