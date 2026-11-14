const NS='http://www.w3.org/2000/svg';
const NET_COLOR='#cc3d21';
export function initializeNetSearch(svg,{onWaitInterrupted,onWaitComplete}={}){
  svg.setAttribute('role','group');
  const find=id=>svg.querySelector(`[id$="-${id}"]`);
  const search=find('search-bar'),brand=find('center-brand');
  find('search-placeholder').setAttribute('visibility','hidden');
  const foreign=document.createElementNS(NS,'foreignObject');
  Object.entries({x:530,y:639,width:936,height:60}).forEach(([k,v])=>foreign.setAttribute(k,v));
  const input=document.createElementNS('http://www.w3.org/1999/xhtml','input');input.className='fca-net-input';
  Object.entries({type:'search',placeholder:'Search...',autocomplete:'off',spellcheck:'false','aria-label':'FCA NET search'}).forEach(([k,v])=>input.setAttribute(k,v));
  foreign.append(input);search.append(foreign);
  const submit=find('submit-chevrons');submit.classList.add('fca-net-submit');
  Object.entries({role:'button',tabindex:0,'aria-label':'Search FCA NET'}).forEach(([k,v])=>submit.setAttribute(k,v));
  const hit=document.createElementNS(NS,'rect');
  Object.entries({x:1485,y:634,width:89,height:70,fill:'transparent','pointer-events':'all'}).forEach(([k,v])=>hit.setAttribute(k,v));submit.prepend(hit);
  function node(tag,attrs,parent=svg){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));parent.append(e);return e}
  const hint=node('g',{class:'fca-net-hint',hidden:''});
  const message=node('text',{x:997.46,fill:NET_COLOR,'text-anchor':'middle','font-family':'FCA Consolas, Consolas, monospace','font-size':40,'font-weight':700,role:'status','aria-live':'polite'},hint);
  message.setAttribute('aria-label',"HINT: On the next screen, it's best to do nothing. Take a moment to reflect on everything you've investigated and ask yourself: What exactly is [N-01]?");
  ["HINT: On the next screen, it's best to do nothing.","Take a moment to reflect on everything you've investigated","and ask yourself: What exactly is [N-01]?"].forEach((line,index)=>{node('tspan',{x:997.46,y:548+index*62},message).textContent=line});
  const confirm=node('g',{class:'fca-net-confirm',role:'button',tabindex:0,'aria-label':'OK'},hint);
  node('rect',{x:887.46,y:760,width:220,height:82,rx:3,fill:'transparent',stroke:NET_COLOR,'stroke-width':2,'pointer-events':'all'},confirm);
  node('text',{x:997.46,y:801,'dominant-baseline':'middle','text-anchor':'middle',fill:NET_COLOR,'font-family':'FCA Consolas, Consolas, monospace','font-weight':700,'font-size':40,'pointer-events':'none'},confirm).textContent='OK';
  const countdown=node('text',{x:997.46,y:650,fill:NET_COLOR,'text-anchor':'middle','dominant-baseline':'middle','font-family':'FCA Consolas, Consolas, monospace','font-size':110,'font-weight':700,class:'fca-net-countdown',role:'timer','aria-live':'off',tabindex:-1,hidden:''});
  let deadline=0,clockTimer,completionNotified=false,pausedRemaining=null;
  function interruptWait(event){
    if(svg.dataset.searchState!=='countdown'||!deadline)return;
    // Check the real deadline even if a throttled display timer has not run yet.
    if(performance.now()>=deadline){refreshCountdown();return}
    event.preventDefault();event.stopImmediatePropagation();
    window.clearTimeout(clockTimer);deadline=0;
    svg.dataset.searchState='interrupted';countdown.setAttribute('hidden','');
    // Consume the rest of this gesture so it cannot click or type into MAIL.
    if(event.type==='pointerdown'){
      let releaseTimer;
      const types=['pointerup','pointercancel','mouseup','click','auxclick','contextmenu'];
      const clear=()=>{window.clearTimeout(releaseTimer);types.forEach(type=>window.removeEventListener(type,consume,true))};
      const consume=next=>{
        next.preventDefault();next.stopImmediatePropagation();
        if(['click','auxclick','contextmenu','pointercancel'].includes(next.type))clear();
        else {window.clearTimeout(releaseTimer);releaseTimer=window.setTimeout(clear,250)}
      };
      types.forEach(type=>window.addEventListener(type,consume,{capture:true,passive:false}));
    }else if(event.type==='keydown'){
      const consume=next=>{if(next.code===event.code){next.preventDefault();next.stopImmediatePropagation();if(next.type==='keyup'){window.removeEventListener('keydown',consume,true);window.removeEventListener('keyup',consume,true)}}};
      window.addEventListener('keydown',consume,true);window.addEventListener('keyup',consume,true);
    }
    onWaitInterrupted?.();
  }
  // Capture across the game, including title controls and other windows.
  ['pointerdown','keydown','wheel'].forEach(type=>window.addEventListener(type,interruptWait,{capture:true,passive:false}));
  function refreshCountdown(){
    if(!deadline)return;
    window.clearTimeout(clockTimer);
    const remaining=Math.max(0,deadline-performance.now());
    const seconds=Math.ceil(remaining/1000);
    countdown.textContent=String(seconds).padStart(2,'0');
    countdown.setAttribute('aria-label',seconds?`${seconds} seconds remaining`:'Countdown complete');
    svg.dataset.countdownRemainingMs=String(remaining);
    if(!remaining){
      svg.dataset.searchState='complete';
      if(!completionNotified){completionNotified=true;onWaitComplete?.()}
      return;
    }
    // Recalculate from one monotonic deadline; delayed callbacks never extend the thirty seconds.
    clockTimer=window.setTimeout(refreshCountdown,Math.max(1,Math.ceil(remaining-(seconds-1)*1000)));
  }
  function showCountdown(){
    svg.dataset.searchState='countdown';
    hint.setAttribute('hidden','');countdown.removeAttribute('hidden');
  }
  function startCountdown(){
    if(svg.dataset.searchState!=='hint')return;
    deadline=performance.now()+30000;
    svg.dataset.countdownDeadline=String(deadline);showCountdown();countdown.focus({preventScroll:true});
    refreshCountdown();
  }
  confirm.addEventListener('click',startCountdown);
  confirm.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();if(!event.repeat)startCountdown()}});
  confirm.addEventListener('pointerdown',()=>confirm.classList.add('is-pressed'));
  ['pointerup','pointerleave','pointercancel','blur'].forEach(type=>confirm.addEventListener(type,()=>confirm.classList.remove('is-pressed')));
  window.addEventListener('focus',refreshCountdown);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCountdown()});
  let unlocked=false;
  function showHint(){
    unlocked=true;input.blur();input.setAttribute('disabled','');
    [search,brand].forEach(e=>e.setAttribute('hidden',''));hint.removeAttribute('hidden');
    svg.dataset.searchState='hint';
  }
  function searchNet(){
    if(unlocked)return;
    if(input.value.trim().toLowerCase()!=='blank'){input.setAttribute('aria-invalid','true');return}
    showHint();confirm.focus({preventScroll:true});
  }
  input.addEventListener('input',()=>input.removeAttribute('aria-invalid'));
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();event.stopPropagation();searchNet()}});
  submit.addEventListener('click',searchNet);
  submit.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!event.repeat)searchNet()}});
  submit.addEventListener('pointerdown',()=>submit.classList.add('is-pressed'));
  ['pointerup','pointerleave','pointercancel','blur'].forEach(type=>submit.addEventListener(type,()=>submit.classList.remove('is-pressed')));
  svg.dataset.searchState='search';
  return {
    focus(){if(!unlocked)input.focus({preventScroll:true});else if(svg.dataset.searchState==='hint')confirm.focus({preventScroll:true});else refreshCountdown()},
    snapshot(){
      const state = svg.dataset.searchState;
      return { state, remaining: state === 'countdown' ? pausedRemaining ?? Math.max(0, Math.round(deadline - performance.now())) : null };
    },
    restore(saved){
      if (!['hint','countdown','interrupted','complete'].includes(saved.state)) return;
      showHint();
      if (saved.state === 'countdown') {
        pausedRemaining = Math.max(0, Math.min(30000, Number(saved.remaining) || 0));
        showCountdown();
        countdown.textContent = String(Math.ceil(pausedRemaining / 1000)).padStart(2, '0');
      } else if (saved.state !== 'hint') {
        svg.dataset.searchState = saved.state;
        hint.setAttribute('hidden','');
        if (saved.state === 'complete') {
          countdown.removeAttribute('hidden');
          countdown.textContent = '00';
        }
      }
    },
    resume(){
      if (pausedRemaining === null) return;
      deadline = performance.now() + pausedRemaining;
      pausedRemaining = null;
      svg.dataset.countdownDeadline = String(deadline);
      refreshCountdown();
    }
  };
}
