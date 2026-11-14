const NS = 'http://www.w3.org/2000/svg';

export function initializeFileThreeFolders(svg, { onOpenFolder, onReveal } = {}) {
  svg.setAttribute('role','group');
  const root=svg.querySelector('[id$="-file3-root"]');
  const ids=['_04_文件夹_1_档案甲','_04_文件夹_1_档案甲-3','_04_文件夹_1_档案甲-4','_04_文件夹_1_档案甲-5','_04_文件夹_1_档案甲-2'];
  const keys=['alpha','beta','gamma','delta','restricted'];
  const visited=new Set();
  let revealed=false;
  const frame=document.createElementNS(NS,'g');
  frame.classList.add('file3-hover-frame');
  frame.setAttribute('pointer-events','none');
  frame.setAttribute('hidden','');
  const folders=ids.map((id,index)=>{
    const group=svg.querySelector(`[id$="-${id}"]`);
    const corners=[...group.querySelectorAll(':scope > path')].slice(0,4);
    if(index===0) corners.forEach(path=>frame.append(path.cloneNode(true)));
    corners.forEach(path=>path.remove());
    const icon=group.querySelector('path');
    group.classList.add('file3-folder');
    group.dataset.folder=keys[index];
    group.setAttribute('role','button');
    group.setAttribute('tabindex','0');
    group.setAttribute('aria-label',index===4?'Open restricted folder':`Open ${keys[index]} dossier`);
    if(index===4)group.setAttribute('hidden','');
    function select(){
      if(index===4&&!revealed)return;
      const base=folders[0].icon.getBBox(), target=icon.getBBox();
      frame.removeAttribute('hidden');
      frame.style.transform=`translate(${target.x-base.x}px, ${target.y-base.y}px)`;
      svg.dataset.hoveredFolder=keys[index];
    }
    group.addEventListener('pointerenter',select);
    group.addEventListener('focus',select);
    group.addEventListener('click',()=>{if(index!==4||revealed)onOpenFolder?.(keys[index])});
    group.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!event.repeat&&(index!==4||revealed))onOpenFolder?.(keys[index])}
    });
    return {group,icon,hitReady:false};
  });
  root.append(frame);
  function addHit(folder){
    if(folder.hitReady)return;
    const box=folder.group.getBBox();
    const hit=document.createElementNS(NS,'rect');
    Object.entries({x:box.x-18,y:box.y-24,width:box.width+36,height:box.height+32,fill:'transparent','pointer-events':'all'}).forEach(([key,value])=>hit.setAttribute(key,value));
    folder.group.prepend(hit);
    folder.hitReady=true;
  }
  return {
    markViewed(key){if(keys.slice(0,4).includes(key)){visited.add(key);svg.dataset.viewedFolders=String(visited.size)}},
    snapshot(){return [...visited]},
    restore(saved){if(Array.isArray(saved))saved.forEach(key=>this.markViewed(key))},
    isRestrictedVisible:()=>revealed,
    show(){
      folders.slice(0,4).forEach(addHit);
      if(visited.size===4&&!revealed){
        revealed=true;
        folders[4].group.removeAttribute('hidden');
        folders[4].group.classList.add('file3-restricted-reveal');
        addHit(folders[4]);
        svg.dataset.restrictedVisible='true';
        onReveal?.();
      }
    }
  };
}

export function initializeRestrictedFolder(svg, {onUnlocked}={}) {
  svg.setAttribute('role','group');
  const root=svg.querySelector('[id$="-file3-root"]');
  const placeholder=[...root.querySelectorAll('text')].find(text=>text.textContent.trim()==='S_');
  placeholder.setAttribute('visibility','hidden');
  const foreign=document.createElementNS(NS,'foreignObject');
  Object.entries({x:2517.39,y:568.11,width:336.89,height:57.1}).forEach(([key,value])=>foreign.setAttribute(key,value));
  const input=document.createElementNS('http://www.w3.org/1999/xhtml','input');
  input.className='file3-password';
  Object.entries({type:'password',placeholder:'S',autocomplete:'off',spellcheck:'false','aria-label':'Restricted folder password',maxlength:'32'}).forEach(([key,value])=>input.setAttribute(key,value));
  const field=document.createElementNS('http://www.w3.org/1999/xhtml','div');
  field.className='file3-password-field';
  const caret=document.createElementNS('http://www.w3.org/1999/xhtml','span');
  caret.className='file3-password-caret';caret.setAttribute('aria-hidden','true');caret.textContent='_';
  const eye=document.createElementNS('http://www.w3.org/1999/xhtml','button');
  eye.className='file3-password-toggle';eye.type='button';
  eye.setAttribute('aria-label','Show password');eye.setAttribute('aria-pressed','false');
  eye.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="file3-eye-slash" d="m3 3 18 18"/></svg>';
  const measure=document.createElement('canvas').getContext('2d');
  function updateCaret(){
    // Keep the original S_ prompt, then move only its underscore as the player types.
    measure.font='32px Consolas, monospace';
    const before=input.value.slice(0,input.selectionStart??input.value.length);
    const text=input.value?(input.type==='password'?'•'.repeat(before.length):before):'S';
    const left=76+measure.measureText(text).width-input.scrollLeft;
    caret.style.left=Math.max(76,Math.min(272,left))+'px';
    caret.hidden=input.disabled;
  }
  eye.addEventListener('pointerdown',event=>event.preventDefault());
  eye.addEventListener('click',()=>{
    const {selectionStart,selectionEnd}=input;
    input.type=input.type==='password'?'text':'password';
    const visible=input.type==='text';
    eye.setAttribute('aria-pressed',String(visible));
    eye.setAttribute('aria-label',visible?'Hide password':'Show password');
    if(selectionStart!==null)input.setSelectionRange(selectionStart,selectionEnd);
    updateCaret();
  });
  ['input','select','keyup','click','scroll','focus'].forEach(name=>input.addEventListener(name,()=>requestAnimationFrame(updateCaret)));
  field.append(input,caret,eye);foreign.append(field);root.append(foreign);
  const status=document.createElementNS(NS,'text');
  Object.entries({x:2685.84,y:725,fill:'#ead6b3','font-size':20,'font-family':'Consolas, monospace','text-anchor':'middle',role:'status','aria-live':'polite'}).forEach(([key,value])=>status.setAttribute(key,value));
  root.append(status);
  let unlocked=false;
  function check(explicit=false){
    if(unlocked)return;
    if(input.value.trim().toLowerCase()==='survivor'){
      unlocked=true;input.disabled=true;
      input.setAttribute('aria-invalid','false');
      svg.dataset.passwordUnlocked='true';
      status.textContent='ACCESS GRANTED.';
      onUnlocked?.();
    }else if(explicit){
      input.setAttribute('aria-invalid','true');
      status.textContent='ACCESS DENIED.';
    }else{
      input.removeAttribute('aria-invalid');status.textContent='';
    }
  }
  input.addEventListener('input',event=>{if(!event.isComposing)check()});
  input.addEventListener('compositionend',()=>check());
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();event.stopPropagation();check(true)}});
  svg.dataset.passwordUnlocked='false';
  updateCaret();
  return {show(){if(!unlocked)input.focus({preventScroll:true})}};
}
