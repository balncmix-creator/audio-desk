/* Separate files; source provenance is recorded by scripts/import-wallpapers.py. */
const WALLPAPERS = [
 {id:"moonlit-city",name:"Moonlit City",light:false,motion:"stars",position:"90% center"},
 {id:"rainy-neon",name:"Rainy Neon",light:false,motion:"rain"},
 {id:"northern-lights",name:"Northern Lights",light:false,motion:"aurora"},
 {id:"purple-planet",name:"Purple Planet",light:false,motion:"stars",position:"60% center"},
 {id:"midnight-studio",name:"Midnight Studio",light:false,motion:"studio"},
 {id:"cyberpunk-rooftops",name:"Cyberpunk Rooftops",light:false,motion:"studio"},
 {id:"cyberpunk-alley",name:"Cyberpunk Alley",light:false,motion:"rain"},
 {id:"brutalist-concrete",name:"Brutalist Concrete Noir",light:false,motion:"none"},
 {id:"brutalist-monolith",name:"Brutalist Monolith",light:false,motion:"none"},
 {id:"brutalist-tower",name:"Brutalist Tower",light:false,motion:"stars"},
 {id:"brutalist-stairs",name:"Brutalist Stairs",light:false,motion:"none"},
 {id:"brutalist-courtyard",name:"Brutalist Courtyard",light:false,motion:"studio"},
 {id:"brutalist-red",name:"Brutalist Red",light:false,motion:"none"},
 {id:"minimal-lunar",name:"Minimal Lunar",light:false,motion:"stars",position:"100% center"},
 {id:"crt-terminal",name:"Retro CRT Terminal",light:false,motion:"studio",position:"70% center"},
 {id:"arcade-afterhours",name:"Arcade After Hours",light:false,motion:"studio",position:"75% center"}
].map(item=>({...item,src:"wallpapers/"+item.id+".webp",thumb:"wallpapers/thumbs/"+item.id+".webp",position:item.position||"35% center"}));
