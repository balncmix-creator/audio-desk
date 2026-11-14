/* Separate files; source provenance is recorded by scripts/import-wallpapers.py. */
const WALLPAPERS = [
 {id:"moonlit-city",name:"Moonlit City",light:false,motion:"stars"},
 {id:"rainy-neon",name:"Rainy Neon",light:false,motion:"rain"},
 {id:"northern-lights",name:"Northern Lights",light:false,motion:"aurora"},
 {id:"purple-planet",name:"Purple Planet",light:false,motion:"stars"},
 {id:"midnight-studio",name:"Midnight Studio",light:false,motion:"studio"},
 {id:"pastel-sunrise",name:"Pastel Sunrise",light:true,motion:"aurora"},
 {id:"tropical-beach",name:"Tropical Beach",light:true,motion:"ocean"},
 {id:"sunset-highway",name:"Sunset Highway",light:true,motion:"stars"},
 {id:"floating-islands",name:"Floating Islands",light:true,motion:"aurora"},
 {id:"retro-music",name:"Retro Music",light:true,motion:"studio"}
].map(item=>({...item,src:"wallpapers/"+item.id+".webp",thumb:"wallpapers/thumbs/"+item.id+".webp",position:"35% center"}));
