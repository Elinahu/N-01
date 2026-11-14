import {assetUrl} from './assets.js';

const NS='http://www.w3.org/2000/svg';
const HTML='http://www.w3.org/1999/xhtml';

export function initializeMailContacts(partner, survivor, {isUnlocked, onAdded, onChannelChange}={}) {
  let added=false, active='partner', partnerOffline=false;
  const panels=[];
  const survivorPortrait=assetUrl('images/fca-contact-survivor.png');
  const partnerImages=[...partner.querySelector('[id$="-channels-and-contacts"]').querySelectorAll('image')];
  survivor.querySelector('[id$="-message-history"]').replaceChildren();
  // Resource 45's placeholder history is replaced by the scripted conversation.
  const survivorCursor=[...survivor.querySelectorAll('rect')].find(e=>e.getAttribute('x')==='319.04');
  survivorCursor?.setAttribute('visibility','hidden');
  survivor.dataset.conversation='waiting-for-dialogue';
  survivor.setAttribute('role','group');
  function node(tag,attrs,parent){
    const e=document.createElementNS(NS,tag);
    Object.entries(attrs).forEach(([key,value])=>e.setAttribute(key,value));parent.append(e);return e;
  }
  function action(element,callback){
    element.addEventListener('click',callback);
    element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();if(!event.repeat)callback()}});
  }
  function select(channel, notify = true){
    if(channel==='survivor'&&!added)return;
    panels.forEach(p=>closeInput(p));
    active=channel;
    [partner,survivor].forEach((svg,index)=>{
      const visible=channel===(index===0?'partner':'survivor');
      svg.style.visibility=visible?'visible':'hidden';svg.style.pointerEvents=visible?'':'none';
      svg.classList.toggle('mail-channel-is-hidden',!visible);
      svg.setAttribute('aria-hidden',String(!visible));
    });
    partner.dataset.activeContact=survivor.dataset.activeContact=channel;
    refresh();if(notify)onChannelChange?.(channel);
  }
  function closeInput(panel){panel.field.setAttribute('hidden','');panel.heading.removeAttribute('visibility');panel.plus.setAttribute('aria-expanded','false')}
  function submit(panel,explicit=false){
    if(!isUnlocked?.())return;
    if(panel.input.value==='0-A-0001'){
      const first=!added;added=true;select('survivor');
      panels[1].secondHit.focus({preventScroll:true});
      partner.dataset.survivorAdded=survivor.dataset.survivorAdded='true';
      if(first)onAdded?.();
    }else if(explicit)panel.input.setAttribute('aria-invalid','true');
  }
  function refresh(){
    panels.forEach(p=>{
      p.plus.setAttribute('aria-disabled',String(!isUnlocked?.()));
      p.secondHit.setAttribute('aria-disabled',String(!added));
      p.name.querySelector('tspan').textContent=added?'SURVIVOR':'UNKNOWN';
      p.status.querySelector('tspan').textContent=added?'ONLINE':'OFFLINE';
      p.name.style.fill=p.status.style.fill=added?'#bd4936':'';
      if(added)p.avatar.setAttribute('href',survivorPortrait);
      p.highlight.forEach(e=>e.setAttribute('transform',active==='survivor'?'translate(0 76.79)':'translate(0 0)'));
      p.firstHit.setAttribute('aria-pressed',String(active==='partner'));
      p.secondHit.setAttribute('aria-pressed',String(active==='survivor'));
      p.firstStatus.querySelector('tspan').textContent=partnerOffline?'OFFLINE':'ONLINE';
      p.firstStatus.style.fill=partnerOffline?'#8d8067':'';
    });
  }
  [partner,survivor].forEach((svg,index)=>{
    const layer=svg.querySelector('[id$="-channels-and-contacts"]');
    [...layer.querySelectorAll('path')].find(e=>e.getAttribute('d')==='M262.19,421.85l5.79,6.76')?.remove();
    const texts=[...layer.querySelectorAll('text')];
    const heading=texts.find(t=>t.textContent.trim()==='CONTACTS');
    const name=texts.find(t=>t.textContent.trim()==='UNKNOWN');
    const status=texts.find(t=>t.textContent.trim()==='OFFLINE');
    const firstStatus=texts.find(t=>t.textContent.trim()==='ONLINE');
    if(index===1)partnerImages.forEach(image=>layer.append(image.cloneNode(true)));
    const avatar=[...layer.querySelectorAll('image')][1];
    const highlight=[...layer.children].filter(e=>(e.localName==='rect'&&e.getAttribute('y')==='152.38')||(e.localName==='path'&&/^M(?:19\.77,158\.11|256\.4,178\.16)/.test(e.getAttribute('d')||'')));
    const firstHit=node('rect',{x:20,y:152,width:263,height:66,fill:'transparent',class:'mail-contact-hit',role:'button',tabindex:0,'aria-label':'Open partner conversation','data-contact':'partner'},layer);
    const secondHit=node('rect',{x:20,y:229,width:263,height:66,fill:'transparent',class:'mail-contact-hit',role:'button',tabindex:0,'aria-label':'Open SURVIVOR conversation','data-contact':'survivor'},layer);
    action(firstHit,()=>select('partner'));action(secondHit,()=>select('survivor'));
    const field=node('foreignObject',{x:29,y:76,width:202,height:37,hidden:'',class:'mail-contact-entry'},layer);
    const input=document.createElementNS(HTML,'input');input.className='mail-contact-id';
    Object.entries({type:'text',placeholder:'CONTACT ID',maxlength:'16',autocomplete:'off',spellcheck:'false','aria-label':'Contact ID (case sensitive)'}).forEach(([key,value])=>input.setAttribute(key,value));
    field.append(input);
    const plus=node('rect',{x:240,y:79,width:31,height:32,fill:'transparent',class:'mail-add-contact',role:'button',tabindex:0,'aria-label':'Add contact','aria-expanded':'false'},layer);
    const panel={heading,name,status,firstStatus,avatar,highlight,firstHit,secondHit,field,input,plus};panels.push(panel);
    action(plus,()=>{
      if(!isUnlocked?.())return;
      if(added){select('survivor');return}
      if(!field.hasAttribute('hidden')){submit(panel,true);input.focus();return}
      heading.setAttribute('visibility','hidden');field.removeAttribute('hidden');plus.setAttribute('aria-expanded','true');input.focus();
    });
    input.addEventListener('input',()=>{input.removeAttribute('aria-invalid');submit(panel)});
    input.addEventListener('keydown',event=>{
      if(event.isComposing)return;
      if(event.key==='Enter'){event.preventDefault();event.stopPropagation();submit(panel,true)}
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeInput(panel);plus.focus()}
    });
  });
  [partner,survivor].forEach(svg=>{svg.style.position='absolute';svg.style.inset='0'});
  select('partner');
  return {
    refresh,select,
    restore(saved){
      added = Boolean(saved?.added);
      if (added) partner.dataset.survivorAdded = survivor.dataset.survivorAdded = 'true';
      select(added && saved.active === 'survivor' ? 'survivor' : 'partner', false);
    },
    prompt(channel){panels.forEach(p=>{p.firstHit.classList.toggle('mail-contact-unread',channel==='partner');p.secondHit.classList.toggle('mail-contact-unread',channel==='survivor')})},
    setPartnerOffline(){
      partnerOffline=true;partner.dataset.partnerOffline='true';
      [...partner.querySelector('[id$="-channel-status"]').querySelectorAll('text')].filter(e=>e.textContent.trim()==='ONLINE').forEach(e=>{e.querySelector('tspan').textContent='OFFLINE';e.style.fill='#8d8067'});
      [...partner.querySelector('[id$="-contact-details"]').querySelectorAll('text')].filter(e=>e.textContent.trim()==='● ONLINE').forEach(e=>{e.querySelector('tspan').textContent='● OFFLINE';e.style.fill='#8d8067'});
      const badge=[...partner.querySelector('[id$="-contact-details"]').querySelectorAll('text')].find(text=>/LIVE|OFFLINE/.test(text.textContent)&&text.previousElementSibling?.localName==='rect');
      if(badge){
        const back=badge.previousElementSibling,right=Number(back.getAttribute('x'))+Number(back.getAttribute('width'));
        back.setAttribute('x',right-75);back.setAttribute('width',75);back.style.fill='#342a1c';back.style.stroke='#8d8067';back.style.strokeWidth='.6';
        const baseline=badge.transform.baseVal.consolidate().matrix.f;
        badge.setAttribute('transform',`translate(${right-75+5.22} ${baseline})`);
        const spans=[...badge.querySelectorAll('tspan')];spans[0].textContent='◇';spans.at(-1).textContent=' OFFLINE';spans.forEach(span=>span.style.fill='#cbb28a');
        badge.dataset.liveState='offline';badge.setAttribute('aria-label','Portrait feed offline');
      }
      refresh();
    },
    get activeChannel(){return active},get added(){return added},get partnerOffline(){return partnerOffline}
  };
}

export function playSurvivorIntrusion(page) {
  if(page.querySelector('.mail-intrusion-overlay'))return;
  const overlay=document.createElement('div');overlay.className='mail-intrusion-overlay';overlay.setAttribute('aria-hidden','true');
  // Screen-wide, one-shot interference. No cloned UI or duplicate controls remain afterward.
  [9,23,41,57,73,88].forEach((top,index)=>{
    const band=document.createElement('i');band.style.top=top+'%';band.style.height=(index%3===0?3.2:.8)+'%';band.style.setProperty('--drift',(index%2?-18:23)+'px');overlay.append(band);
  });
  page.append(overlay);page.classList.add('is-survivor-intrusion');page.dataset.survivorIntrusion='active';
  window.setTimeout(()=>{page.classList.remove('is-survivor-intrusion');overlay.remove();page.dataset.survivorIntrusion='complete'},650);
}
