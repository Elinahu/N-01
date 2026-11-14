import {assetUrl} from './assets.js';

const NS='http://www.w3.org/2000/svg';

export function initializeStoryCollection(art,{page,onReturn,onOpen}={}){
  const overlay=document.createElement('section');
  overlay.className='survivor-story-player';overlay.hidden=true;overlay.tabIndex=-1;
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Story collection');
  overlay.innerHTML='<div class="story-ambient" aria-hidden="true"><i></i><i></i><i></i></div><div class="story-collection-shell"><div class="story-collection-card"></div><div class="story-collection-controls"><button type="button" data-story-action="previous" aria-label="Previous story">‹</button><span class="story-page-counter" aria-live="polite">01 / 06</span><button type="button" data-story-action="next" aria-label="Next story">›</button></div></div>';
  const root=art.querySelector('[id$="-_备忘录"]').firstElementChild;
  // The source body is outlined lettering. Replace that body only; retain the supplied frame and title styling.
  [...root.children].filter(e=>e.localName==='g'&&e.hasAttribute('class')).forEach(e=>e.remove());
  const heading=root.querySelector('text');
  heading.setAttribute('transform','translate(308.04 97.03)');heading.setAttribute('text-anchor','middle');
  const closeControl=[...root.children].find(e=>e.localName==='g'&&e.querySelector('line'));
  closeControl.classList.add('story-close-control');
  Object.entries({role:'button',tabindex:0,'aria-label':'Return to MAIL'}).forEach(([k,v])=>closeControl.setAttribute(k,v));
  const closeHit=document.createElementNS(NS,'rect');
  Object.entries({x:588.69,y:0,width:22.4,height:21.5,fill:'transparent','pointer-events':'all',class:'story-close-hit'}).forEach(([k,v])=>closeHit.setAttribute(k,v));closeControl.prepend(closeHit);
  closeControl.addEventListener('click',close);
  closeControl.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();close()}});
  const foreign=document.createElementNS(NS,'foreignObject');
  Object.entries({x:75,y:146,width:466,height:646}).forEach(([k,v])=>foreign.setAttribute(k,v));
  const reading=document.createElementNS('http://www.w3.org/1999/xhtml','div');
  reading.className='story-reading-window';reading.tabIndex=0;reading.setAttribute('role','article');
  foreign.append(reading);root.append(foreign);
  art.removeAttribute('aria-hidden');art.setAttribute('role','group');
  overlay.querySelector('.story-collection-card').append(art);page.append(overlay);
  let stories=[],index=0,lastTime=0,openingHold=0,bottomHold=0,manualHold=0,scrollPosition=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function showStory(next){
    if(!stories.length)return;
    index=(next+stories.length)%stories.length;
    const story=stories[index];heading.querySelector('tspan').textContent=story.title;
    reading.replaceChildren(...story.paragraphs.map(text=>{const p=document.createElementNS('http://www.w3.org/1999/xhtml','p');p.textContent=text;return p}));
    reading.setAttribute('aria-label',story.title);reading.scrollTop=0;scrollPosition=0;
    overlay.querySelector('.story-page-counter').textContent=String(index+1).padStart(2,'0')+' / '+String(stories.length).padStart(2,'0');
    overlay.dataset.storyIndex=String(index);openingHold=3000;bottomHold=0;manualHold=0;
  }
  const ready=fetch(assetUrl('text/stories.md')).then(response=>{if(!response.ok)throw Error('Story content unavailable');return response.text()}).then(text=>{
    const sections=[...text.matchAll(/^\*\*(.+?)\*\*\s*$([\s\S]*?)(?=^\*\*|(?![\s\S]))/gm)];
    stories=sections.map(match=>({title:match[1].trim(),paragraphs:match[2].trim().split(/\r?\n\s*\r?\n/).map(p=>p.replace(/\s+/g,' ').trim()).filter(Boolean)}));
    if(!stories.length)throw Error('Story collection is empty');
    overlay.dataset.storyCount=String(stories.length);showStory(0);
  }).catch(error=>{console.error('故事集加载失败',error);reading.textContent='Story content could not be loaded.'});
  function close(){if(overlay.hidden)return;overlay.hidden=true;lastTime=0;onReturn?.()}
  overlay.querySelector('[data-story-action="previous"]').addEventListener('click',()=>showStory(index-1));
  overlay.querySelector('[data-story-action="next"]').addEventListener('click',()=>showStory(index+1));
  overlay.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();return}
    if(event.key==='Tab'){
      const stops=[reading,closeControl,...overlay.querySelectorAll('button')],current=stops.indexOf(document.activeElement);
      event.preventDefault();stops[(current+(event.shiftKey?stops.length-1:1))%stops.length].focus();
    }
  },true);
  ['wheel','pointerdown','keydown'].forEach(type=>reading.addEventListener(type,()=>{manualHold=5000;bottomHold=0;scrollPosition=reading.scrollTop}));
  return {
    ready,
    open(){if(!overlay.hidden)return;overlay.hidden=false;lastTime=0;reading.focus({preventScroll:true});onOpen?.()},
    snapshot(){return overlay.hidden ? null : { index, scroll: reading.scrollTop }},
    async restore(saved){
      if (!saved) return;
      await ready;
      if (Number.isInteger(saved.index) && saved.index >= 0) showStory(saved.index);
      overlay.hidden = false;
      scrollPosition = Number(saved.scroll) || 0;
      reading.scrollTop = scrollPosition;
    },
    close,
    render(now){
      if(overlay.hidden||document.hidden){lastTime=0;return}
      const dt=lastTime?Math.max(0,Math.min(100,now-lastTime)):0;lastTime=now;
      if(reduced||!stories.length)return;
      if(openingHold>0){openingHold-=dt;return}
      if(manualHold>0){manualHold-=dt;scrollPosition=reading.scrollTop;return}
      const end=Math.max(0,reading.scrollHeight-reading.clientHeight);
      scrollPosition=Math.min(end,scrollPosition+dt*.016);reading.scrollTop=scrollPosition;
      if(scrollPosition>=end){bottomHold+=dt;if(bottomHold>=2500)showStory(index+1)}else bottomHold=0;
    },
    get isOpen(){return !overlay.hidden}
  };
}
