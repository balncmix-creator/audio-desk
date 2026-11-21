/* Audio Desk Orbit Files — every file, folder, action and menu is a radial
 * sector. Android SAF owns filesystem access; this view only receives scoped
 * opaque IDs from the native bridge. No rectangular list or menu is rendered. */
(()=>{
"use strict";
const root=document.createElement("section");
root.id="radialFilesPanel";root.hidden=true;
root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");
root.setAttribute("aria-label","Orbit radial file manager");
root.innerHTML='<div class="rdf-head"><small>AUDIO DESK / ORBIT</small><strong>FILES</strong>'+
 '<span id="rdfPath">Choose a folder to begin</span></div>'+
 '<div class="rdf-stage" id="rdfStage">'+
 '<svg id="rdfWheel" viewBox="0 0 400 400" role="group" aria-label="Files and commands radial dial">'+
 '<circle cx="200" cy="200" r="195" class="rdf-outer-guide"/>'+
 '<g id="rdfFileRing" aria-label="File and folder sectors"></g>'+
 '<g id="rdfCommandRing" aria-label="Radial commands"></g>'+
 '<g id="rdfCenter"></g></svg>'+
 '<div id="rdfEditor" class="rdf-editor" hidden>'+
 '<label id="rdfEditorLabel" for="rdfEditorInput"></label>'+
 '<input id="rdfEditorInput" type="text" maxlength="120" spellcheck="false" autocomplete="off" aria-label="File manager input"/></div></div>'+
 '<div class="rdf-foot"><div id="rdfHint">Select a file on the outer ring</div>'+
 '<div id="rdfStatus" role="status" aria-live="polite">Choose a folder using the centre dial</div></div>';
document.body.append(root);
const q=id=>document.getElementById(id);
const wheel=q("rdfWheel");
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const filters=[["all","All","◎"],["folder","Folders","▣"],["audio","Audio","♪"],
 ["image","Images","▧"],["video","Video","▶"],["document","Docs","▤"]];
const slots=6,rad=Math.PI/180;
let current={entries:[],path:[],count:0,writable:false,canGoUp:false,truncated:false};
let page=0,selected="",filter="all",sort="name",mode="main",searchTerm="",editing=null;
let busy=false,status="Choose a folder with the centre dial",drag=null,suppressClickUntil=0;
function active(){return document.body.dataset.launcherTheme==="orbit"&&document.body.dataset.homePage==="home"}
function selectedItem(){return current.entries.find(f=>f.id===selected)||null}
function typeOf(f){
 if(f.folder)return "folder";
 const mime=String(f.mime||"").toLowerCase(),name=String(f.name||"").toLowerCase();
 if(mime.startsWith("audio/")||/\.(wav|aiff?|mp3|flac|ogg|m4a|mid|midi|opus)$/.test(name))return "audio";
 if(mime.startsWith("image/")||/\.(png|jpe?g|webp|gif|heic|svg)$/.test(name))return "image";
 if(mime.startsWith("video/")||/\.(mp4|mkv|mov|webm|avi)$/.test(name))return "video";
 return "document";
}
function fileSymbol(f){return f.folder?"▣":({audio:"♪",image:"▧",video:"▶",document:"▤"})[typeOf(f)]}
function shown(){
 const needle=searchTerm.trim().toLocaleLowerCase();
 return current.entries.filter(f=>(filter==="all"||typeOf(f)===filter)&&(!needle||f.name.toLocaleLowerCase().includes(needle)))
  .sort((a,b)=>Number(b.folder)-Number(a.folder)||
    (sort==="date"?(b.modified||0)-(a.modified||0):sort==="size"?(b.size||0)-(a.size||0):0)||
    a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"}));
}
function point(r,a){return [+(200+r*Math.sin(a*rad)).toFixed(2),+(200-r*Math.cos(a*rad)).toFixed(2)]}
function wedge(a,b,inner,outer){
 const gap=.65,o1=point(outer,a+gap),o2=point(outer,b-gap),i1=point(inner,b-gap),i2=point(inner,a+gap);
 return 'M'+o1.join(' ')+' A'+outer+' '+outer+' 0 0 1 '+o2.join(' ')+' L'+i1.join(' ')+
  ' A'+inner+' '+inner+' 0 0 0 '+i2.join(' ')+' Z';
}
function arcLabel(label,angle,radius,className,offset=0){
 const p=point(radius,angle);
 return '<text class="'+className+'" x="'+p[0]+'" y="'+(p[1]+offset)+'">'+esc(label)+'</text>';
}
function glyphSector(action,label,symbol,i,inner,outer,kind,selectedState=false,disabled=false){
 const a=i*60,b=(i+1)*60,center=a+30;
 return '<g class="rdf-hit rdf-'+kind+'" data-rdf-action="'+esc(action)+'"'+
  ' tabindex="'+(disabled?'-1':'0')+'" role="button"'+
  ' aria-label="'+esc(label)+'" aria-pressed="'+selectedState+'" aria-disabled="'+disabled+'">'+
  '<path class="rdf-wedge" d="'+wedge(a,b,inner,outer)+'"/>'+
  (symbol?arcLabel(symbol,center,(inner+outer)/2-7,"rdf-icon"):"")+
  arcLabel(label,center,(inner+outer)/2+9,"rdf-menu-text")+'</g>';
}
function splitName(input){
 const name=String(input||"Untitled").replace(/\s+/g," ").trim();
 return [name.slice(0,15),name.length>15?name.slice(15,29)+(name.length>29?"…":""):""];
}
function fileSector(f,i){
 const a=i*60,b=(i+1)*60,center=a+30,pos=point(153,center),[first,last]=splitName(f.name);
 return '<g class="rdf-hit rdf-file" data-rdf-action="select:'+esc(f.id)+'" data-rdf-file="'+esc(f.id)+'"'+
  ' role="button" tabindex="0" aria-label="'+esc((f.folder?"Open folder ":"Select file ")+f.name)+'"'+
  ' aria-pressed="'+(f.id===selected)+'">'+
  '<path class="rdf-wedge" d="'+wedge(a,b,124,192)+'"/>'+
  '<text class="rdf-file-icon" x="'+pos[0]+'" y="'+(pos[1]-21)+'">'+fileSymbol(f)+'</text>'+
  '<text class="rdf-file-text" x="'+pos[0]+'" y="'+(pos[1]-3)+'">'+esc(first)+'</text>'+
  (last?'<text class="rdf-file-text" x="'+pos[0]+'" y="'+(pos[1]+11)+'">'+esc(last)+'</text>':"")+
  '<text class="rdf-file-type" x="'+pos[0]+'" y="'+(pos[1]+26)+'">'+(f.folder?"FOLDER":typeOf(f).toUpperCase())+'</text>'+
  '</g>';
}
const menu={
 main:()=>[
  [current.canGoUp?"up":"change",current.canGoUp?"Up":"Choose","↖",true],
  ["prev","Prev","‹",shown().length>slots&&page>0],
  ["next","Next","›",shown().length>(page+1)*slots],
  ["filter","Filter","◉",true],
  ["more","More","⋯",true],
  ["close","Close","×",true]],
 selected:()=>[
  ["open","Open","↗",!!selectedItem()],
  ["share","Share","↗",!!selectedItem()&&!selectedItem().folder],
  ["rename","Rename","✎",!!selectedItem()?.writable&&current.writable],
  ["delete","Delete","×",!!selectedItem()?.writable&&current.writable],
  ["new","New","+",current.writable],
  ["back","Back","↶",true]],
 filter:()=>filters.map(([key,label,symbol])=>["filter:"+key,label,symbol,true]),
 more:()=>[
  ["search","Search","⌕",true],
  ["sort","Sort","⇅",true],
  ["change","Choose","▣",true],
  ["refresh","Refresh","⟳",true],
  ["new","New","+",current.writable],
  ["back","Back","↶",true]],
 sort:()=>[
  ["sort:name","Name","A",true],
  ["sort:date","Newest","↘",true],
  ["sort:size","Largest","▥",true],
  ["prev","Prev","‹",shown().length>slots&&page>0],
  ["next","Next","›",shown().length>(page+1)*slots],
  ["back","Back","↶",true]],
 search:()=>[
  ["done","Done","✓",true],
  ["clear","Clear","×",!!searchTerm],
  ["prev","Prev","‹",shown().length>slots&&page>0],
  ["next","Next","›",shown().length>(page+1)*slots],
  ["filter","Filter","◉",true],
  ["cancel","Back","↶",true]],
 edit:()=>[
  ["save","Save","✓",true],
  ["cancel","Cancel","×",true],
  ["","—","",false],["","—","",false],["","—","",false],["","—","",false]],
 confirm:()=>[
  ["confirm-delete","Delete","!",true],
  ["cancel","Cancel","×",true],
  ["","—","",false],["","—","",false],["","—","",false],["","—","",false]]
};
function size(bytes){if(!bytes)return "0 B";const i=Math.min(4,Math.floor(Math.log(bytes)/Math.log(1024)));return (bytes/1024**i).toFixed(i?1:0)+" "+["B","KB","MB","GB","TB"][i]}
function render(){
 const files=shown(),pages=Math.max(1,Math.ceil(files.length/slots));
 page=Math.max(0,Math.min(page,pages-1));
 const visible=files.slice(page*slots,(page+1)*slots);
 let html="";
 visible.forEach((f,i)=>{html+=fileSector(f,i)});
 for(let i=visible.length;i<slots;i++)
  html+='<path class="rdf-empty-sector" d="'+wedge(i*60,(i+1)*60,124,192)+'"/>';
 q("rdfFileRing").innerHTML=html;
 const options=(menu[mode]||menu.main)();
 q("rdfCommandRing").innerHTML=options.map(([code,label,icon,enabled],i)=>glyphSector(
  code,label,icon,i,64,119,"command",
  code==="filter:"+filter||code==="sort:"+sort,
  !enabled)).join("");
 const chosen=selectedItem(),hubLabel=mode==="confirm"?"DELETE?":
  mode==="edit"?"EDIT":mode==="search"?"SEARCH":
  chosen?chosen.folder?"FOLDER":"FILE":"FOLDERS";
 let centerMarkup='<circle cx="200" cy="200" r="58" class="rdf-hub-surface"/>';
 centerMarkup+='<g data-rdf-action="hub" role="button" tabindex="0" aria-label="'+
  esc(chosen?"Open "+chosen.name:current.path.length?"Show folder actions":"Choose a folder")+'">';
 centerMarkup+='<circle cx="200" cy="200" r="52" fill="transparent"/>';
 centerMarkup+=arcLabel(hubLabel,0,0,"rdf-hub-label",-29).replace(/x="200" y="171"/,'x="200" y="176"');
 const lines=chosen?splitName(chosen.name):splitName(current.path.at(-1)||"No folder");
 centerMarkup+='<text x="200" y="196" class="rdf-hub-name">'+esc(lines[0])+'</text>'+
  (lines[1]?'<text x="200" y="209" class="rdf-hub-name">'+esc(lines[1])+'</text>':"");
 const detail=chosen?(chosen.folder?"Open folder":size(chosen.size)):files.length+" items";
 centerMarkup+='<text x="200" y="228" class="rdf-hub-meta">'+esc(detail)+'</text></g>';
 q("rdfCenter").innerHTML=centerMarkup;
 q("rdfPath").textContent=current.path.length?current.path.join("  /  "):"No folder selected";
 const modeTitle=({main:"BROWSE",selected:"SELECTED",filter:"FILTER",more:"OPTIONS",sort:"SORT",
  search:"SEARCH",edit:"SAVE NAME",confirm:"DELETE?"})[mode]||"BROWSE";
 q("rdfHint").textContent=modeTitle+" · "+(page+1)+"/"+pages+
  (filter!=="all"?" · "+filters.find(f=>f[0]===filter)?.[1]:"")+
  (searchTerm?" · “"+searchTerm.slice(0,23)+"”":"");
 q("rdfStatus").textContent=busy?"Reading folder…":status+
   (current.truncated?" · First 700 entries loaded":"")+
   (current.path.length&&!current.writable?" · Read-only":"");
 const editor=q("rdfEditor");
 editor.hidden=!editing;
 if(editing){
  q("rdfEditorLabel").textContent=editing==="search"?"FIND":"NAME";
  if(document.activeElement!==q("rdfEditorInput")&&q("rdfEditorInput").value!==editing.value)
   q("rdfEditorInput").value=editing.value;
 }
}
function call(name,...args){
 const fn=window.AudioDesk?.[name];
 if(typeof fn!=="function"){
  status="Android APK required for real files.";render();return false;
 }
 try{fn(...args);return true}catch{
  status="Android could not complete that operation.";render();return false;
 }
}
function open(){
 if(!active())return;
 root.hidden=false;mode="main";status="Reading selected folder…";
 window.audioDeskSyncNativeWidgets?.();
 render();call("radialFilesList");
}
function close(){root.hidden=true;editing=null;mode="main";window.audioDeskSyncNativeWidgets?.()}
function pageBy(amount){
 const count=Math.max(1,Math.ceil(shown().length/slots));
 page=Math.max(0,Math.min(count-1,page+amount));
 selected="";mode="main";status="Page "+(page+1)+" of "+count;render();
}
function startEdit(kind,value=""){
 editing={kind,value};mode=kind==="search"?"search":"edit";render();
 const input=q("rdfEditorInput");
 input.value=value;input.focus();input.select();
}
function finishEdit(save){
 if(!editing)return;
 const ed=editing,value=q("rdfEditorInput").value.trim();
 if(save){
  if(ed.kind==="search"){searchTerm=value;page=0;status=value?"Search applied":"Search cleared"}
  else if(!value||value==="."||value===".."||/[\\/\x00-\x1f]/.test(value)){
   status="Enter a valid file or folder name.";render();return;
  }else if(ed.kind==="new")call("radialFilesCreate",value);
  else if(ed.kind==="rename"&&selected)call("radialFilesRename",selected,value);
 }else if(ed.kind==="search"){searchTerm=ed.value;page=0;}
 editing=null;
 mode=selected?"selected":"main";render();
}
function back(){
 if(!root.hidden){
  if(mode==="edit"||mode==="search"){finishEdit(false);return true}
  if(mode==="confirm"){mode=selected?"selected":"main";render();return true}
  if(mode!=="main"){mode="main";selected="";render();return true}
  if(current.canGoUp){call("radialFilesUp");return true}
  close();return true;
 }
 return false;
}
const previousBack=window.launcherBack;
window.launcherBack=function(...args){if(back())return;return previousBack?.apply(this,args)};
window.audioDeskOpenRadialFiles=open;
window.audioDeskRadialFilesBack=back;
window.receiveAudioDeskRadialFiles=function(payload){
 if(!payload||typeof payload!=="object")return;
 if(payload.type==="loading"){busy=true;status="Reading folder…";render();return}
 busy=false;
 if(payload.type==="listing"){
  const previous=current.path.join("/");
  const entries=Array.isArray(payload.entries)?payload.entries:[];
  current={entries:entries.filter(f=>f&&typeof f.id==="string"&&typeof f.name==="string"),
   path:Array.isArray(payload.path)?payload.path:[],count:Number(payload.count)||0,
   writable:payload.writable===true,canGoUp:payload.canGoUp===true,truncated:payload.truncated===true};
  if(previous!==current.path.join("/")){page=0;filter="all";searchTerm="";editing=null}
  selected="";mode="main";status=current.count+" items in folder";
 }else if(payload.type==="permission"){
  current={entries:[],path:[],count:0,writable:false,canGoUp:false,truncated:false};
  selected="";page=0;mode="main";status=payload.message||"Choose a folder";
 }else if(payload.type==="error")status=payload.message||"Cannot access the folder.";
 render();
};
function action(code){
 if(!code)return;
 if(code.startsWith("select:")){
  const id=code.slice(7),file=current.entries.find(f=>f.id===id);
  if(!file)return;
  if(id===selected){call(file.folder?"radialFilesEnter":"radialFilesOpen",id);return}
  selected=id;mode="selected";editing=null;status=file.name;render();return;
 }
 if(code.startsWith("filter:")){
  filter=code.slice(7);selected="";page=0;mode="main";status="Showing "+filters.find(f=>f[0]===filter)?.[1];render();return;
 }
 if(code.startsWith("sort:")){
  sort=code.slice(5);selected="";page=0;mode="main";status="Sorted by "+sort;render();return;
 }
 switch(code){
  case "hub":
   if(mode==="edit"||mode==="search"){q("rdfEditorInput").focus();return}
   if(mode==="confirm")return;
   if(selected){const f=selectedItem();if(f)call(f.folder?"radialFilesEnter":"radialFilesOpen",f.id)}
   else if(!current.path.length)call("radialFilesPick");
   else{mode=mode==="more"?"main":"more";render()}
   break;
  case "close":close();break;
  case "up":if(current.canGoUp)call("radialFilesUp");break;
  case "prev":pageBy(-1);break;
  case "next":pageBy(1);break;
  case "more":case "filter":case "sort":mode=code;render();break;
  case "change":call("radialFilesPick");break;
  case "refresh":call("radialFilesList");break;
  case "back":back();break;
  case "open":{
   const f=selectedItem();if(f)call(f.folder?"radialFilesEnter":"radialFilesOpen",f.id);break;
  }
  case "share":if(selectedItem()&&!selectedItem().folder)call("radialFilesShare",selected);break;
  case "new":if(current.writable)startEdit("new");break;
  case "rename":if(selectedItem()?.writable&&current.writable)startEdit("rename",selectedItem().name);break;
  case "delete":if(selectedItem()?.writable&&current.writable){mode="confirm";render()}break;
  case "confirm-delete":if(mode==="confirm"&&selected){call("radialFilesDelete",selected);status="Delete requested";mode="main";selected="";render()}break;
  case "search":startEdit("search",searchTerm);break;
  case "clear":if(editing?.kind==="search"){searchTerm="";editing.value="";q("rdfEditorInput").value="";page=0;render()}break;
  case "done":finishEdit(true);break;
  case "save":finishEdit(true);break;
  case "cancel":
   if(mode==="confirm"){mode=selected?"selected":"main";render()}
   else finishEdit(false);
   break;
 }
}
wheel.addEventListener("click",e=>{
 if(performance.now()<suppressClickUntil)return;
 const hit=e.target.closest("[data-rdf-action]");
 if(hit&&hit.getAttribute("aria-disabled")!=="true")action(hit.dataset.rdfAction);
});
wheel.addEventListener("keydown",e=>{
 if(!["Enter"," "].includes(e.key))return;
 const hit=e.target.closest("[data-rdf-action]");
 if(hit&&hit.getAttribute("aria-disabled")!=="true"){e.preventDefault();action(hit.dataset.rdfAction)}
});
q("rdfEditorInput").addEventListener("input",e=>{
 if(editing){editing.value=e.target.value;if(editing.kind==="search"){searchTerm=e.target.value;page=0;render()}}
});
q("rdfEditorInput").addEventListener("keydown",e=>{
 if(e.key==="Enter"){e.preventDefault();finishEdit(true)}
 if(e.key==="Escape"){e.preventDefault();finishEdit(false)}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!root.hidden){e.preventDefault();back()}});
function pointerAngle(e){
 const box=wheel.getBoundingClientRect();
 const x=e.clientX-(box.left+box.width/2),y=(box.top+box.height/2)-e.clientY;
 return Math.atan2(x,y)*180/Math.PI;
}
function angleDelta(end,start){let d=end-start;while(d>180)d-=360;while(d< -180)d+=360;return d}
wheel.addEventListener("pointerdown",e=>{
 const hit=e.target.closest("[data-rdf-file]");
 if(!hit||e.button!==0)return;
 drag={id:e.pointerId,angle:pointerAngle(e),moved:false,difference:0};
});
wheel.addEventListener("pointermove",e=>{
 if(!drag||e.pointerId!==drag.id)return;
 drag.difference=angleDelta(pointerAngle(e),drag.angle);
 if(Math.abs(drag.difference)>19)drag.moved=true;
});
wheel.addEventListener("pointerup",e=>{
 if(!drag||e.pointerId!==drag.id)return;
 const moved=drag.moved,dir=drag.difference;
 drag=null;
 if(moved){e.preventDefault();suppressClickUntil=performance.now()+400;pageBy(dir>0?1:-1)}
});
wheel.addEventListener("pointercancel",()=>{drag=null});
for(const name of ["launcher-page-changed","audio-desk-theme-changed"])
 window.addEventListener(name,()=>{if(!active()&&!root.hidden)close()});
render();
})();