/* Orbit's scoped, quarter-circle file browser. No filesystem is read by
 * JavaScript: native Android SAF returns only explicitly granted folder items. */
(()=>{
"use strict";
const root=document.createElement("section");
root.id="radialFilesPanel";root.hidden=true;root.setAttribute("role","dialog");
root.setAttribute("aria-modal","true");root.setAttribute("aria-label","Orbit file manager");
root.innerHTML='<header class="rdf-top"><div class="rdf-heading"><small>AUDIO DESK / ORBIT</small><strong>Files</strong></div>'+
 '<div class="rdf-top-actions"><button data-rdf-action="change" type="button">Choose folder</button>'+
 '<button data-rdf-action="close" type="button" aria-label="Close file manager">×</button></div></header>'+
 '<div class="rdf-path" id="rdfPath">Choose a folder to begin</div>'+
 '<div class="rdf-main"><div class="rdf-sidebar">'+
 '<div class="rdf-controls"><input id="rdfSearch" type="search" autocomplete="off" spellcheck="false" placeholder="Search this folder" aria-label="Search files in current folder">'+
 '<select id="rdfSort" aria-label="File sorting"><option value="name">Name</option><option value="date">Newest first</option><option value="size">Largest first</option></select></div>'+
 '<div class="rdf-list" id="rdfList" role="group" aria-label="Files and folders"></div>'+
 '<div class="rdf-actions"><button type="button" data-rdf-action="up">Back</button>'+
 '<button type="button" data-rdf-action="new">+ Folder</button>'+
 '<button type="button" data-rdf-action="refresh">Refresh</button></div>'+
 '<div class="rdf-status" id="rdfStatus" aria-live="polite"></div></div>'+
 '<div class="rdf-wheel-box"><svg id="rdfWheel" viewBox="-330 -330 330 330" role="group" aria-label="Radial file navigation" xmlns="http://www.w3.org/2000/svg"></svg>'+
 '<div class="rdf-pagination"><button data-rdf-action="prev" type="button" aria-label="Previous file page">‹</button>'+
 '<span id="rdfPage">1 / 1</span><button data-rdf-action="next" type="button" aria-label="Next file page">›</button></div></div></div>';
document.body.append(root);
const trigger=document.createElement("button");
trigger.type="button";trigger.id="orbitFilesTrigger";trigger.textContent="◔ Files";
trigger.setAttribute("aria-label","Open Orbit radial file manager");
document.body.append(trigger);
const q=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const categories=[["all","All"],["folder","Folders"],["audio","Audio"],["image","Images"],["video","Video"],["document","Docs"]];
const slots=5;
let current={entries:[],path:[],count:0,writable:false,canGoUp:false,truncated:false};
let selected="",filter="all",page=0,sort="name",busy=false,status="Choose a folder to browse";
function active(){return document.body.dataset.launcherTheme==="orbit"&&document.body.dataset.homePage==="home"}
function selectedItem(){return current.entries.find(f=>f.id===selected)||null}
function typeOf(f){
 if(f.folder)return "folder";
 const mime=(f.mime||"").toLowerCase(),name=(f.name||"").toLowerCase();
 if(mime.startsWith("audio/")||/\.(wav|aiff?|mp3|flac|ogg|m4a|mid|midi|opus)$/.test(name))return "audio";
 if(mime.startsWith("image/")||/\.(png|jpe?g|webp|gif|heic|svg)$/.test(name))return "image";
 if(mime.startsWith("video/")||/\.(mp4|mkv|mov|webm|avi)$/.test(name))return "video";
 return "document";
}
function iconOf(f){return f.folder?"▣":typeOf(f)==="audio"?"♪":typeOf(f)==="image"?"▧":typeOf(f)==="video"?"▶":"▤"}
function shown(){
 const query=q("rdfSearch").value.trim().toLocaleLowerCase();
 return current.entries.filter(f=>(filter==="all"||typeOf(f)===filter)&&(!query||f.name.toLocaleLowerCase().includes(query)))
  .sort((a,b)=>Number(b.folder)-Number(a.folder)||
   (sort==="date"?(b.modified||0)-(a.modified||0):sort==="size"?(b.size||0)-(a.size||0):0)||
   a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"}));
}
const pi=Math.PI;
function polar(r,a){const rad=a*pi/180;return [(-r*Math.sin(rad)).toFixed(2),(-r*Math.cos(rad)).toFixed(2)]}
function section(a,b,inner,outer){
 const p1=polar(outer,a+0.45),p2=polar(outer,b-0.45);
 const p3=polar(inner,b-0.45),p4=polar(inner,a+0.45);
 return "M"+p1+" A"+outer+" "+outer+" 0 0 0 "+p2+" L"+p3+
  " A"+inner+" "+inner+" 0 0 1 "+p4+" Z";
}
function svgSegment(kind,index,label,sub,a,b,r0,r1,action,pressed=false,disabled=false){
 const at=(a+b)/2,pos=polar((r0+r1)/2,at),name=esc(label);
 const off=sub?7:0;
 return '<g data-rdf-action="'+esc(action)+'" role="button" tabindex="'+(disabled?"-1":"0")+
  '" aria-label="'+esc(kind+" "+label)+'" aria-pressed="'+pressed+'" aria-disabled="'+disabled+'">'+
  '<path class="rdf-segment '+(kind==="Action"?"rdf-action-segment":"")+'" d="'+section(a,b,r0,r1)+'"/>'+
  '<text x="'+pos[0]+'" y="'+(Number(pos[1])-off)+'" class="'+(kind==="File"?"rdf-small":"")+'">'+name+'</text>'+
  (sub?'<text class="rdf-small" x="'+pos[0]+'" y="'+(Number(pos[1])+10)+'">'+esc(sub)+'</text>':"")+'</g>';
}
function wheel(items){
 let html="";
 const catStep=90/categories.length;
 categories.forEach(([id,label],i)=>{
  html+=svgSegment("Filter",i,label,"",i*catStep,(i+1)*catStep,277,322,"filter:"+id,filter===id);
 });
 const start=page*slots,visible=items.slice(start,start+slots),fileStep=90/slots;
 for(let i=0;i<slots;i++){
  const f=visible[i],a=i*fileStep,b=(i+1)*fileStep;
  if(f)html+=svgSegment("File",i,(f.name||"").slice(0,10),iconOf(f),a,b,145,273,"select:"+f.id,f.id===selected);
  else html+='<path class="rdf-segment" d="'+section(a,b,145,273)+'" opacity=".30"/>';
 }
 const item=selectedItem();
 const actions=[["open","Open",!!item],["share","Share",!!item&&!item.folder],
  ["rename","Rename",!!item&&current.writable&&item.writable],
  ["delete","Delete",!!item&&current.writable&&item.writable],
  ["new","+ Folder",current.writable]];
 const actStep=90/actions.length;
 actions.forEach(([action,label,enabled],i)=>{
  html+=svgSegment("Action",i,label,"",i*actStep,(i+1)*actStep,76,141,action,false,!enabled);
 });
 html+='<g role="button" tabindex="0" data-rdf-action="up" aria-label="Go up or close">'+
  '<path class="rdf-core" d="'+section(0,90,0.2,73)+'"/>'+
  '<text class="rdf-core-label" x="-26" y="-28">↖</text></g>';
 q("rdfWheel").innerHTML=html;
}
function readableSize(bytes){
 if(!bytes)return "0 B";const units=["B","KB","MB","GB","TB"];
 const i=Math.min(units.length-1,Math.floor(Math.log(bytes)/Math.log(1024)));
 return (bytes/1024**i).toFixed(i?1:0)+" "+units[i];
}
function render(){
 const files=shown(),pages=Math.max(1,Math.ceil(files.length/slots));
 page=Math.min(page,pages-1);
 q("rdfPath").textContent=current.path.length?current.path.join(" / "):"No folder access yet";
 q("rdfList").innerHTML=files.length?files.map(f=>'<button type="button" class="rdf-item" data-rdf-action="select:'+esc(f.id)+
  '" aria-pressed="'+(f.id===selected)+'" title="'+esc(f.name)+'">'+
  '<span class="rdf-file-icon" aria-hidden="true">'+iconOf(f)+'</span>'+
  '<span class="rdf-item-text"><strong>'+esc(f.name)+'</strong><small>'+
  (f.folder?"Folder":readableSize(f.size))+'</small></span></button>').join("") :
  '<div class="rdf-empty">'+(busy?"Loading files…":current.path.length?"No matching items. Choose another category or clear search.":"Choose folder to grant access using Android Files.")+'</div>';
 wheel(files);
 q("rdfPage").textContent=(page+1)+" / "+pages;
 root.querySelector('[data-rdf-action="prev"]').disabled=page===0;
 root.querySelector('[data-rdf-action="next"]').disabled=page>=pages-1;
 root.querySelector('[data-rdf-action="new"]').disabled=!current.writable;
 root.querySelector('[data-rdf-action="up"]').disabled=!current.canGoUp;
 q("rdfStatus").textContent=(selectedItem()?.name||status)+
  (current.truncated?" · First 700 items shown":"")+
  (current.path.length&&!current.writable?" · Read only":"");
}
function call(name,...args){
 const fn=window.AudioDesk?.[name];
 if(typeof fn!=="function"){status="Install the Android build to browse device files.";render();return false}
 try{fn(...args);return true}catch{status="Android could not complete the operation.";render();return false}
}
function show(){
 if(!active())return;
 root.hidden=false;document.body.classList.add("orbit-files-open");
 window.audioDeskSyncNativeWidgets?.();
 status="Loading folder";render();
 call("radialFilesList");q("rdfSearch").focus();
}
function close(){
 root.hidden=true;document.body.classList.remove("orbit-files-open");
 window.audioDeskSyncNativeWidgets?.();
}
window.audioDeskOpenRadialFiles=show;
window.audioDeskRadialFilesBack=()=>{
 if(root.hidden)return false;
 if(current.canGoUp){call("radialFilesUp");return true}
 close();return true;
};
const nativeBack=window.launcherBack;
window.launcherBack=function(...args){
 if(window.audioDeskRadialFilesBack())return;
 if(typeof nativeBack==="function")return nativeBack.apply(this,args);
};
window.receiveAudioDeskRadialFiles=function(payload){
 if(!payload||typeof payload!=="object")return;
 if(payload.type==="loading"){busy=true;status="Loading files…";render();return}
 busy=false;
 if(payload.type==="listing"){
  const previousPath=current.path.join("/");
  current={
   entries:Array.isArray(payload.entries)?payload.entries:[],
   path:Array.isArray(payload.path)?payload.path:[],
   count:Number(payload.count)||0,
   writable:payload.writable===true,
   canGoUp:payload.canGoUp===true,
   truncated:payload.truncated===true
  };
  if(previousPath!==current.path.join("/")){q("rdfSearch").value="";page=0;filter="all";}
  selected="";status=current.entries.length+" items";
 }else if(payload.type==="permission"){
  current={entries:[],path:[],count:0,writable:false,canGoUp:false,truncated:false};
  selected="";status=payload.message||"Choose a folder";
 }else if(payload.type==="error")status=payload.message||"Cannot access this folder";
 render();
};
function act(code){
 if(!code)return;
 if(code==="close"){close();return}
 if(code==="change"){call("radialFilesPick");return}
 if(code==="refresh"){call("radialFilesList");return}
 if(code==="up"){if(current.canGoUp)call("radialFilesUp");else close();return}
 if(code==="next"||code==="prev"){page+=code==="next"?1:-1;render();return}
 if(code.startsWith("filter:")){filter=code.slice(7);page=0;selected="";render();return}
 if(code.startsWith("select:")){
  const id=code.slice(7);
  if(id===selected){const f=selectedItem();if(f?.folder)call("radialFilesEnter",id);else call("radialFilesOpen",id)}
  else{selected=id;render()}
  return;
 }
 if(code==="new"){
  if(!current.writable)return;
  const name=prompt("New folder name");
  if(name!==null&&name.trim())call("radialFilesCreate",name);
  return;
 }
 const item=selectedItem();
 if(!item)return;
 if(code==="open")call(item.folder?"radialFilesEnter":"radialFilesOpen",item.id);
 else if(code==="share"&&!item.folder)call("radialFilesShare",item.id);
 else if(code==="rename"&&current.writable&&item.writable){
  const name=prompt("Rename item",item.name);
  if(name!==null&&name.trim()&&name!==item.name)call("radialFilesRename",item.id,name);
 }else if(code==="delete"&&current.writable&&item.writable){
  if(confirm('Permanently delete "'+item.name+'"? This cannot be undone.'))
   call("radialFilesDelete",item.id);
 }
}
root.addEventListener("click",e=>{
 const hit=e.target.closest("[data-rdf-action]");
 if(hit&&hit.getAttribute("aria-disabled")!=="true"&&!hit.disabled)act(hit.dataset.rdfAction);
});
root.addEventListener("keydown",e=>{
 if(e.key!=="Enter"&&e.key!==" ")return;
 const hit=e.target.closest("svg [data-rdf-action]");
 if(hit){e.preventDefault();if(hit.getAttribute("aria-disabled")!=="true")act(hit.dataset.rdfAction)}
});
trigger.addEventListener("click",show);
q("rdfSearch").addEventListener("input",()=>{page=0;render()});
q("rdfSort").addEventListener("change",e=>{sort=e.target.value;page=0;render()});
document.addEventListener("keydown",e=>{
 if(!root.hidden&&e.key==="Escape"){e.preventDefault();close()}
});
for(const name of ["launcher-page-changed","audio-desk-theme-changed"])
 window.addEventListener(name,()=>{if(!active()&&!root.hidden)close()});
render();
})();
