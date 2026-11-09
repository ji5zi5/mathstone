// Render the original atlas pieces as separate UI layers; artwork and text stay live.
let serial=0;
const texture=name=>`/public/ui/${name}.png`;
export function frameHTML(type='minion'){
 const key=`frame-${++serial}`,weapon=type==='weapon',spell=['spell','hero','location'].includes(type);
 const outer=spell||weapon?'M104 37 Q88 37 88 62 V482 Q88 505 111 507 H397 Q422 507 422 482 V60 Q422 36 398 36Z':'M110 39 Q89 37 89 65 V480 Q88 509 116 509 H397 Q422 508 422 478 V65 Q421 39 396 39Z';
 const crown=spell?'':weapon?'<ellipse cx="256" cy="160" rx="147" ry="146" fill="white"/>':'<ellipse cx="256" cy="166" rx="128" ry="162" fill="white"/>';
 const hole=spell?'<path d="M128 91 Q251 40 385 91 V245 Q256 304 128 245Z" fill="black"/>':weapon?'<ellipse cx="256" cy="158" rx="113" ry="112" fill="black"/>':'<ellipse cx="256" cy="165" rx="105" ry="143" fill="black"/>';
 const name=spell?'spell-frame':weapon?'weapon-frame':'minion-frame';
 return `<svg class="card-frame" viewBox="82 0 344 512" preserveAspectRatio="none" aria-hidden="true"><defs><mask id="${key}" maskUnits="userSpaceOnUse" x="82" y="0" width="344" height="512"><path d="${outer}" fill="white"/>${crown}${hole}</mask></defs><image href="${texture(name)}" width="512" height="512" mask="url(#${key})"/></svg>`;
}
export function ribbonHTML(){const key=`ribbon-${++serial}`;return `<svg class="name-ribbon" viewBox="250 0 262 66" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="${key}"><path d="M254 16 Q263 25 263 37 L256 53 Q275 65 304 58 Q412 40 498 58 Q491 37 505 16 Q470 -3 429 4 L290 18 Q267 16 254 16Z"/></clipPath></defs><image href="${texture('banners')}" width="512" height="512" clip-path="url(#${key})"/></svg>`;}
export function gemHTML(kind){
 const key=`gem-${++serial}`,shape=kind==='mana'?'M43 20L83 17L110 64L86 102L43 105L22 64Z':kind==='health'?'M62 7L85 37L114 66L111 81L94 102L63 120L29 100L15 75L26 51Z':'M25 7L36 8L48 21L65 25L71 36Q111 40 116 79L119 107L104 114L83 106Q47 122 28 97Q13 73 30 49L25 37L7 33L8 21Z';
 const color=kind==='mana'?'#2679c1':kind==='health'?'#ac2929':'#c49425';
 return `<svg class="stat-gem" viewBox="0 0 128 128" aria-hidden="true"><defs><linearGradient id="${key}-metal" x2="1" y2="1"><stop stop-color="#f5e5b3"/><stop offset=".45" stop-color="${color}"/><stop offset="1" stop-color="#382920"/></linearGradient><clipPath id="${key}"><path d="${shape}"/></clipPath></defs><g clip-path="url(#${key})"><path d="${shape}" fill="url(#${key}-metal)" stroke="#d3b780" stroke-width="5"/><image href="${texture(kind)}" width="128" height="128"/></g></svg>`;
}
export function inPlayFrame(){const key=`play-${++serial}`;return `<svg class="piece-frame" viewBox="65 0 420 512" preserveAspectRatio="none" aria-hidden="true"><defs><mask id="${key}" maskUnits="userSpaceOnUse" x="65" y="0" width="420" height="512"><ellipse cx="276" cy="254" rx="202" ry="249" fill="white"/><ellipse cx="276" cy="254" rx="162" ry="207" fill="black"/></mask></defs><image href="${texture('inplay-frame')}" width="512" height="512" mask="url(#${key})"/></svg>`;}
