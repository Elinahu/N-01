import {setTypingSound} from './typing-audio.js';
import {assetUrl} from './assets.js';
const NS='http://www.w3.org/2000/svg';

// Reveal original SVG glyphs, retaining every tspan coordinate, font and color.
function typeArtwork(svg,onComplete,{paused=false,revealed=0}={}){
  const defs=svg.querySelector('defs');
  const passages=[...svg.querySelectorAll('text')].map((text,index)=>{
    const count=text.getNumberOfChars(),rows=new Map(),glyphs=[];
    const clip=document.createElementNS(NS,'clipPath');clip.id=svg.id+'-typing-'+index;clip.setAttribute('clipPathUnits','userSpaceOnUse');defs.append(clip);
    for(let i=0;i<count;i++){
      const box=text.getExtentOfChar(i),baseline=Math.round(text.getStartPositionOfChar(i).y*10)/10;
      let row=rows.get(baseline);
      if(!row){
        const rect=document.createElementNS(NS,'rect');
        row={rect,left:box.x-1,top:box.y-2,bottom:box.y+box.height+2};rows.set(baseline,row);clip.append(rect);
        rect.setAttribute('x',row.left);rect.setAttribute('width','0');
      }
      row.top=Math.min(row.top,box.y-2);row.bottom=Math.max(row.bottom,box.y+box.height+2);
      glyphs.push({row,edge:box.x+box.width+1});
    }
    rows.forEach(row=>{row.rect.setAttribute('y',row.top);row.rect.setAttribute('height',row.bottom-row.top)});
    const accents=[];let offset=0;
    const leaves=[...text.querySelectorAll('tspan')].filter(span=>!span.querySelector('tspan'));
    leaves.forEach((span,leafIndex)=>{
      const size=span.getNumberOfChars(),color=getComputedStyle(span).fill;
      if(size&&span.textContent.trim()&&['rgb(204, 61, 33)','rgb(238, 132, 43)'].includes(color)){
        // Apply the halo to a full SVG text element: filters on tspan are unreliable.
        // Transparent siblings retain the exact original positioning and spacing.
        const glow=text.cloneNode(true);
        glow.removeAttribute('id');glow.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
        glow.setAttribute('aria-hidden','true');glow.setAttribute('pointer-events','none');
        glow.setAttribute('clip-path',`url(#${clip.id})`);glow.style.visibility='hidden';
        const glowLeaves=[...glow.querySelectorAll('tspan')].filter(node=>!node.querySelector('tspan'));
        glowLeaves.forEach((node,i)=>node.style.fill=i===leafIndex?color:'transparent');
        glow.style.setProperty('--accent-color',color);text.before(glow);
        accents.push({glow,start:offset,shown:false});
      }
      offset+=size;
    });
    text.setAttribute('clip-path',`url(#${clip.id})`);text.dataset.visibleCharacters='0';
    return {text,clip,glyphs,accents,revealed:0};
  });
  let passage=0,next=0,cancelled=false,frame,running=false,shown=0;
  const finish=()=>{running=false;svg.dataset.typingState='complete';setTypingSound('ending',false);onComplete?.()};
  svg.dataset.typingState='typing';
  function paint(current,glyph){
    glyph.row.rect.setAttribute('width',Math.max(0,glyph.edge-glyph.row.left));
    current.revealed++;shown++;current.text.dataset.visibleCharacters=String(current.revealed);
    current.accents.forEach(accent=>{if(!accent.shown&&current.revealed>accent.start){accent.shown=true;accent.glow.style.visibility='visible';accent.glow.classList.add('fca-ending-accent-glow')}});
  }
  function finishPassage(current){
    current.text.removeAttribute('clip-path');current.accents.forEach(accent=>accent.glow.removeAttribute('clip-path'));current.clip.remove();
    passage++;
  }
  while(shown<revealed&&passage<passages.length){
    const current=passages[passage],glyph=current.glyphs[current.revealed];
    if(glyph)paint(current,glyph);
    if(current.revealed>=current.glyphs.length)finishPassage(current);
  }
  if(passage===passages.length)finish();
  function render(now){
    if(!running)return;
    if(!document.hidden&&now>=next){
      const current=passages[passage];
      if(!current){finish();return}
      const glyph=current.glyphs[current.revealed];
      if(glyph){
        paint(current,glyph);
        setTypingSound('ending',true);
      }
      const upcoming=current.glyphs[current.revealed];
      next=now+(upcoming&&upcoming.row!==glyph?.row?160:25);
      if(current.revealed>=current.glyphs.length){
        finishPassage(current);setTypingSound('ending',false);next=now+220;
        if(passage===passages.length){finish();return}
      }
    }
    frame=requestAnimationFrame(render);
  }
  function start(){
    if(running||cancelled||passage===passages.length)return;
    running=true;next=performance.now()+250;frame=requestAnimationFrame(render);
  }
  function pause(){running=false;cancelAnimationFrame(frame);setTypingSound('ending',false)}
  if(!paused)start();
  return {start,pause,get shown(){return shown},cancel(){cancelled=true;pause()}};
}

export function initializeEndings({page,createArtwork,sessionMenu,menuIcon,onStart}={}){
  const game = page.closest('#game');
  const overlay=document.createElement('section');overlay.className='fca-ending-overlay';overlay.hidden=true;
  overlay.setAttribute('role','region');overlay.setAttribute('aria-label','Final transmission');overlay.tabIndex=-1;page.append(overlay);
  let active=false,stage='',complete=false,typing,transition=0;
  const menuEntry = document.createElement('button');
  menuEntry.className = 'fca-ending-net-entry';
  menuEntry.type = 'button';
  menuEntry.hidden = true;
  menuEntry.setAttribute('aria-label', '打开 FCA 会话设置');
  menuEntry.setAttribute('aria-haspopup', 'dialog');
  menuEntry.setAttribute('aria-controls', 'fca-ending-net-menu');
  menuEntry.append(menuIcon);
  menuEntry.addEventListener('click', () => {
    if (sessionMenu.open(menuEntry, () => typing?.start())) typing?.pause();
  });
  overlay.append(menuEntry);
  const isMenuEvent = event => event.composedPath().includes(menuEntry) || sessionMenu.ownsEvent(event);
  const assets=Promise.all(['fca-final-transmission.svg','fca-epilogue.svg'].map(async name=>{
    const response=await fetch(assetUrl('images/'+name));
    if(!response.ok)throw Error('Ending artwork could not be loaded: '+name);
    const doc=new DOMParser().parseFromString(await response.text(),'image/svg+xml');
    if(doc.querySelector('parsererror'))throw Error('Invalid ending SVG: '+name);
    return doc;
  }));
  async function show(next, saved){
    if(stage==='epilogue'||stage===next)return;
    const token=++transition;stage=next;complete=false;typing?.cancel();typing=undefined;
    if(!active){active=true;onStart?.();overlay.hidden=false;overlay.focus({preventScroll:true});overlay.classList.add('is-arriving')}
    else {
      overlay.classList.add('is-changing');
      await new Promise(resolve=>setTimeout(resolve,450));
    }
    try{
      const docs=await assets;if(token!==transition)return;
      const svg=createArtwork(docs[next==='transmission'?0:1]);
      svg.style.fontFamily="'FCA Consolas', Consolas, monospace";
      svg.querySelectorAll('style').forEach(style=>{style.textContent=style.textContent.replace(/font-family:\s*Consolas[^;]+;/g,"font-family: 'FCA Consolas', Consolas, monospace;")});
      svg.removeAttribute('aria-hidden');svg.setAttribute('role','group');svg.setAttribute('aria-label',next==='transmission'?'Final transmission':'Epilogue');
      overlay.querySelector(':scope > svg')?.remove();
      overlay.prepend(svg);overlay.dataset.ending=next;overlay.dataset.typingState='typing';
      await document.fonts.ready;if(token!==transition)return;
      const finish=()=>{complete=true;overlay.dataset.typingState='complete'};
      typing=typeArtwork(svg,finish,{paused:Boolean(saved),revealed:saved?.complete?Infinity:Math.max(0,Number(saved?.revealed)||0)});
      if (next === 'epilogue') menuEntry.hidden = false;
      // Commit the new SVG's hidden state before starting its fade in.
      getComputedStyle(svg).opacity;
      overlay.classList.remove('is-changing');
    }catch(error){console.error('结局页面加载失败',error)}
  }
  window.addEventListener('pointerdown',event=>{
    if(!active||game.inert||isMenuEvent(event))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(stage==='transmission'&&complete&&event.button===0)show('epilogue');
  },true);
  ['keydown','wheel','click','contextmenu'].forEach(type=>window.addEventListener(type,event=>{
    if(!active||game.inert||isMenuEvent(event))return;event.preventDefault();event.stopImmediatePropagation();
  },{capture:true,passive:false}));
  return {
    showTransmission:()=>show('transmission'),showEpilogue:()=>show('epilogue'),
    get active(){return active},
    snapshot(){return active ? { stage, complete, revealed:typing?.shown ?? 0 } : null},
    restore(saved){if (['transmission','epilogue'].includes(saved.stage)) return show(saved.stage, saved)},
    resume(){typing?.start()}
  };
}
