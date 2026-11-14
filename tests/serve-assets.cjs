const fs=require('node:fs');
const path=require('node:path');
// All browser tests exercise the same local files Android's asset loader serves.
module.exports=function serveLocalAsset(route,edition='main'){
 const url=new URL(route.request().url());
 if(url.origin!=='https://appassets.androidplatform.net')return false;
 const relative=decodeURIComponent(url.pathname).replace(/^\/assets\//,'');
 if(!/^(personalization\.(js|css)|wallpapers\/[\w./-]+|fonts\/[\w.-]+|pixel-icons\/[\w.-]+)$/.test(relative)||relative.includes('..'))return false;
 const root=path.resolve(__dirname,edition==='play'?'../app/build/generated/playAssets':'../app/src/main/assets');
 const file=path.join(root,relative);
 if(!fs.existsSync(file))return route.fulfill({status:404,body:'Missing bundled asset'});
 const contentType={'.js':'application/javascript','.css':'text/css','.webp':'image/webp','.ttf':'font/ttf','.svg':'image/svg+xml'}[path.extname(file)]||'text/plain';
 return route.fulfill({contentType,body:fs.readFileSync(file)});
};
