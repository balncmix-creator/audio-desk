const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function adb(...args){return execFileSync('adb',args,{timeout:30000,encoding:'utf8'});}
async function hierarchy(){
 let last;
 for(let i=0;i<4;i++){
  try{adb('shell','uiautomator','dump','/sdcard/native-home-qa.xml');return adb('shell','cat','/sdcard/native-home-qa.xml');}
  catch(e){last=e;await sleep(700);}
 }
 throw last;
}
function bounds(xml,label){
 const node=xml.match(new RegExp('<node[^>]*text="'+label+'"[^>]*>'));
 assert.ok(node,'Missing native control: '+label);
 const m=node[0].match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
 assert.ok(m,'Missing native control bounds: '+label);return [(+m[1]+ +m[3])/2|0,(+m[2]+ +m[4])/2|0];
}
function tap(x,y){adb('shell','input','tap',String(x),String(y));}
function screen(name){fs.writeFileSync('android-qa/native-'+name+'.png',execFileSync('adb',['exec-out','screencap','-p'],{timeout:30000}));}
(async()=>{
 fs.mkdirSync('android-qa',{recursive:true});
 adb('shell','am','start','-W','-n','com.balnc.audioddesk/.NativeDeskActivity');
 await sleep(1200);
 let xml=await hierarchy();assert.match(xml,/text="CLOCK"/);assert.match(xml,/text="Music player"/);
 assert.doesNotMatch(xml,/class="android\.webkit\.WebView"/);
 screen('home');
 const [x,y]=bounds(xml,'Music player');
 adb('shell','input','swipe',String(x),String(y),String(x),String(y),'900');
 await sleep(500);xml=await hierarchy();assert.match(xml,/content-desc="Resize nw"/);assert.match(xml,/text="Done"/);
 screen('layout');tap(...bounds(xml,'Done'));await sleep(300);
 xml=await hierarchy();tap(...bounds(xml,'Apps'));await sleep(500);
 xml=await hierarchy();assert.match(xml,/Search installed apps/);assert.doesNotMatch(xml,/class="android\.webkit\.WebView"/);
 screen('apps');
 tap(...bounds(xml,'‹ Home'));await sleep(500);xml=await hierarchy();assert.match(xml,/text="CLOCK"/);
 tap(...bounds(xml,'Settings'));await sleep(400);xml=await hierarchy();assert.match(xml,/Choose bundled wallpaper/);
 screen('settings');
 adb('shell','input','keyevent','4');
 console.log('PASS: independent native Home, native widget editor, app list, wallpaper settings and no WebView');
})().catch(e=>{console.error(e);process.exit(1)});
