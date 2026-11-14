import { bindReportButton } from './report.js';

const NS = 'http://www.w3.org/2000/svg';
const FEATURE_COLOR = '#ff4856';
export function initializeFacialAnalysis(svg, { evaluateButton, draftButton, onReveal, onDraftReport } = {}) {
  const root = svg.querySelector('[id$="-_线索1"]').firstElementChild;
  const defs = svg.querySelector('defs');
  const find = id => svg.querySelector(`[id$="-${id}"]`);
  function node(tag, attrs = {}, parent = root) {
    const element = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key,value]) => element.setAttribute(key, String(value)));
    parent.append(element);
    return element;
  }
  const summary = [...svg.querySelectorAll('text')].find(text => text.textContent === 'AI ANALYSIS SUMMARY');
  summary.querySelector('tspan').textContent = 'ANALYSIS SUMMARY';
  const body = [...svg.querySelectorAll('text')].find(text => text.textContent.startsWith('Subject:'));
  body.setAttribute('transform','translate(197.16 364.27)');
  const title = [...svg.querySelectorAll('text')].find(text => text.textContent.includes('Preliminary Facial Feature'));
  let fontsSized = false;
  function enlargeText(text, factor) {
    const box = text.getBBox();
    const center = box.x + box.width / 2;
    const spans = [...text.querySelectorAll('tspan')].filter(span => !span.children.length);
    const sizes = spans.map(span => parseFloat(getComputedStyle(span).fontSize));
    spans.forEach((span,index) => {
      span.style.fontSize = sizes[index] * factor + 'px';
      if (span.hasAttribute('x')) span.setAttribute('x', center + (Number(span.getAttribute('x')) - center) * factor);
    });
  }
  const bars = [...svg.querySelectorAll('rect')].filter(rect => ['1178.6','1267.1','1355.6'].includes(rect.getAttribute('x')) && rect.getAttribute('width') === '33');
  const scores = bars.map(() => 18 + Math.floor(Math.random() * 31));
  bars.forEach((bar,index) => { bar.dataset.score = scores[index]; bar.setAttribute('y','344.31'); bar.setAttribute('height','0'); });
  const severity = [...svg.querySelectorAll('rect')].filter(rect => rect.getAttribute('y') === '745.31').map(rect => ({ rect, width: +rect.getAttribute('width') }));
  severity.forEach(({rect}) => rect.setAttribute('width','0'));
  const result = [...svg.querySelectorAll('text')].find(text => text.textContent.includes('Anomaly Detected'));
  if (result) result.setAttribute('visibility','hidden');
  [...svg.querySelectorAll('polyline')].find(line => line.getAttribute('points').startsWith('1101.13 515.26'))?.remove();
  const prefix = svg.id + '-analysis';
  const clip = node('clipPath', { id: prefix+'-face-clip' }, defs);
  node('rect', { x: 534.69, y: 175.31, width: 477, height: 627 }, clip);
  const scanGradient = node('linearGradient', { id: prefix+'-scan', x1:0,y1:0,x2:0,y2:1 }, defs);
  [[0,0],[.5,.08],[1,0]].forEach(([offset,opacity]) => node('stop',{offset,'stop-color':'#ee842b','stop-opacity':opacity},scanGradient));
  const scanLayer = node('g', {'clip-path':`url(#${clip.id})`,'pointer-events':'none'});
  // 在原网格上轻扫一层亮度，放在线框人脸之下。
  find('LEFT').parentElement.before(scanLayer);
  const scanBand = node('rect',{x:534.69,y:100,width:477,height:85,fill:`url(#${scanGradient.id})`},scanLayer);
  const details = node('g', {'clip-path':`url(#${clip.id})`,'pointer-events':'none','data-face-responses':''});
  const responseGroups = {};
  responseGroups.lips = node('g', {'data-face-feature':'lips',opacity:0},details);
  node('path',{d:'M739,591l8,-10 12,5 12,-4 13,5 12,-5 11,10M743,595Q774,610 804,595M754,581l-3,9 7,7M774,582l4,10-5,10M794,583l-5,8 8,7',fill:'none',stroke:'#ffd18f','stroke-width':2.1},responseGroups.lips);
  [747,773,802].forEach((x,index)=>node('circle',{cx:x,cy:584+(index%2)*10,r:2.3,fill:'#ffd18f'},responseGroups.lips));
  responseGroups.eyes = node('g', {'data-face-feature':'eyes',opacity:0},details);
  [698.69,850.69].forEach(x=>{
    node('path',{d:`M${x-25},411Q${x},394 ${x+25},411L${x+24},416Q${x},406 ${x-24},416Z`,fill:'#e8a443',opacity:.25},responseGroups.eyes);
    node('path',{d:`M${x-26},413Q${x},404 ${x+26},413M${x-27},392L${x-9},397 ${x+22},401`,fill:'none',stroke:'#ffd18f','stroke-width':2.3},responseGroups.eyes);
    [-25,25].forEach(offset=>node('circle',{cx:x+offset,cy:413,r:2.5,fill:'#ffd18f'},responseGroups.eyes));
  });
  responseGroups.bags = node('g', {'data-face-feature':'bags',opacity:0},details);
  [698.69,850.69].forEach(x=>{
    node('path',{d:`M${x-32},429Q${x},446 ${x+32},429L${x+25},450 ${x},458 ${x-25},450Z`,fill:'#e8a443',opacity:.16},responseGroups.bags);
    node('path',{d:`M${x-32},432L${x-19},448 ${x},456 ${x+19},448 ${x+32},432M${x-23},455L${x},465 ${x+23},455`,fill:'none',stroke:'#ffd18f','stroke-width':2.1},responseGroups.bags);
    [-19,0,19].forEach(offset=>node('circle',{cx:x+offset,cy:offset===0?456:448,r:2.6,fill:'#ffd18f'},responseGroups.bags));
  });
  // 新发现的疲态使用关键词同色亮红；原面网作为较淡的结构背景。
  Object.values(responseGroups).forEach(group => group.querySelectorAll('[stroke], [fill]').forEach(element => {
    if (element.getAttribute('stroke') && element.getAttribute('stroke') !== 'none') element.setAttribute('stroke', FEATURE_COLOR);
    if (element.getAttribute('fill') && element.getAttribute('fill') !== 'none') element.setAttribute('fill', FEATURE_COLOR);
  }));
  const regionBounds={eyes:[658,385,232,48],bags:[658,425,232,46],lips:[730,568,86,42]};
  const regionBands={};
  Object.entries(regionBounds).forEach(([feature,[x,y,width,height]])=>{
    const regionClip=node('clipPath',{id:prefix+'-'+feature+'-focus'},defs);
    node('rect',{x,y,width,height},regionClip);
    const group=node('g',{'clip-path':`url(#${regionClip.id})`,opacity:0},details);
    const band=node('rect',{x,y,width,height:13,fill:FEATURE_COLOR,opacity:.2},group);
    regionBands[feature]={group,band,y,height};
  });
  let phase='reading', elapsed=0, lastTime=0, clock=0;
  const visited = new Set();
  const responses = new Map();
  function setPhase(value) { phase=value; elapsed=0; svg.dataset.analysisPhase=value; }
  function positionButton(button,x,y,w,h) {
    Object.entries({x,y,width:w,height:h,hidden:''}).forEach(([key,value])=>button.setAttribute(key,String(value)));
    button.classList.add('analysis-generated-button');
    root.append(button);
  }
  positionButton(evaluateButton,1211.19,112,116.82,28.86);
  positionButton(draftButton,674.075,824,168.62,42.09);
  function show(button) {
    button.removeAttribute('hidden');
    onReveal?.();
  }
  const keywords = [...body.querySelectorAll('tspan')].filter(span => !span.children.length);
  const features = [
    ['lips',keywords.filter(span=>span.textContent==='dry, cracked lips')],
    ['eyes',keywords.filter(span=>span.textContent==='unfocused')],
    ['bags',keywords.filter(span=>span.textContent==='severe ' || span.textContent==='dark')]
  ];
  function inspectFeature(feature, spans, time = 0) {
    visited.add(feature);
    responses.set(feature, time);
    spans.forEach(word=>{word.setAttribute('aria-pressed','true');word.classList.add('is-examined')});
    svg.dataset.examinedFeatures=String(visited.size);
  }
  features.forEach(([feature,spans]) => spans.forEach((span,index) => {
    span.classList.add('analysis-keyword');
    span.dataset.analysisFeature=feature;
    span.setAttribute('role','button');
    span.setAttribute('tabindex',index===0?'0':'-1');
    span.setAttribute('aria-label',feature==='bags'?'severe dark circles':span.textContent);
    span.setAttribute('aria-pressed','false');
    const inspect = () => inspectFeature(feature, spans);
    span.addEventListener('click',inspect);
    span.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();if(!event.repeat)inspect()}
    });
  }));
  bindReportButton(evaluateButton,()=>phase==='ready',()=>{
    setPhase('scores');
    evaluateButton.setAttribute('aria-disabled','true');
  });
  bindReportButton(draftButton,()=>phase==='complete',()=>{svg.dataset.draftRequested='true';onDraftReport?.()});
  const ecgClip=node('clipPath',{id:prefix+'-ecg-clip'},defs);
  node('rect',{x:1129.6,y:469.81,width:275,height:100},ecgClip);
  const gradient=node('linearGradient',{id:prefix+'-ecg-tail'},defs);
  [[0,0],[.3,.35],[.65,1],[1,1]].forEach(([offset,opacity])=>node('stop',{offset,'stop-color':'white','stop-opacity':opacity},gradient));
  const mask=node('mask',{id:prefix+'-ecg-mask',maskUnits:'userSpaceOnUse',x:1129.6,y:469.81,width:275,height:100,style:'mask-type:alpha'},defs);
  const windowRect=node('rect',{x:1000,y:469.81,width:88,height:100,fill:`url(#${gradient.id})`},mask);
  const ecgGroup=node('g',{'clip-path':`url(#${ecgClip.id})`,'data-analysis-ecg':'',visibility:'hidden'});
  const ecg=node('path',{fill:'none',stroke:'#c1272d','stroke-width':1.8,'stroke-linejoin':'round',mask:`url(#${mask.id})`},ecgGroup);
  const ecgSweepMs = 3200;
  const ecgSweepWidth = 363;
  let cycle=-1, ecgStart=0;
  function makeEcg() {
    let x=1129.6, d=`M${x},521`;
    while(x<1404.6) {
      const interval=28+Math.random()*31, y=516+Math.random()*10, peak=10+Math.random()*32, trough=7+Math.random()*29;
      d+=` L${x+interval*.32},${y} Q${x+interval*.39},${y-7} ${x+interval*.45},${y}`;
      d+=` L${x+interval*.57},${y} L${x+interval*.61},${y-peak} L${x+interval*.65},${y+trough} Q${x+interval*.7},${y-6} ${x+interval*.84},${y} L${x+interval},${y}`;
      x+=interval;
    }
    ecg.setAttribute('d',d);
  }
  // 为共享顶点生成一份位移，连线和节点一起变形，避免只有几条线轻晃却看不出投影感。
  const vertices=new Map();
  function vertex(x,y) {
    const key=x.toFixed(1)+','+y.toFixed(1);
    if(!vertices.has(key)) vertices.set(key,{x,y,seed:Math.random()*Math.PI*2,speed:1800+Math.random()*2200,dx:0,dy:0});
    return vertices.get(key);
  }
  const net=[find('LEFT'),find('RIGHT')];
  net.forEach(group => { group.style.opacity = '.55'; });
  find('OUTLINE').style.opacity = '.58';
  const movingLines=net.flatMap(group=>[...group.querySelectorAll('line')]).map(line=>({line,a:vertex(+line.getAttribute('x1'),+line.getAttribute('y1')),b:vertex(+line.getAttribute('x2'),+line.getAttribute('y2'))}));
  const movingNodes=net.flatMap(group=>[...group.querySelectorAll('circle')]).map(circle=>{
    const matrix=circle.transform.baseVal.consolidate()?.matrix || new DOMMatrix();
    const base=new DOMPoint(+circle.getAttribute('cx'),+circle.getAttribute('cy')).matrixTransform(matrix);
    return {circle,point:vertex(base.x,base.y),inverse:matrix.inverse()};
  });
  const pupils=[...find('EYES').querySelectorAll('ellipse')].map(eye=>({eye,x:+eye.getAttribute('cx')}));
  const eyeOutlines=[...find('EYES').querySelectorAll('path')];
  const mouthLines=[...find('FACIAL_DETAILS').querySelectorAll('path')].slice(1);
  find('FACIAL_DETAILS').querySelector('path').style.opacity = '.55';
  const progress=feature=>Math.min(1,(responses.get(feature)||0)/1100);
  const motionReduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  svg.dataset.analysisPhase=phase;
  svg.dataset.examinedFeatures='0';
  function paintScores(progress) {
    bars.forEach((bar,index)=>{
      const p=Math.min(1,Math.max(0,progress*1.3-index*.15)), h=117*scores[index]/100*(1-(1-p)**3);
      bar.setAttribute('height',h);bar.setAttribute('y',344.31-h);
    });
  }
  function paintSeverity(progress) {
    const width = progress * 312;
    severity.forEach(({rect,width:full})=>rect.setAttribute('width',String(Math.max(0,Math.min(full,width-(+rect.getAttribute('x')-1111.6))))));
  }
  return {
    snapshot() {
      return {
        features: Object.fromEntries(responses), phase, scores,
        elapsed: ['scores', 'ecg', 'severity'].includes(phase) ? Math.round(elapsed) : 0
      };
    },
    restore(saved) {
      for (const [feature, spans] of features) {
        const time = saved.features?.[feature];
        if (Number.isFinite(time)) inspectFeature(feature, spans, Math.max(0, Math.min(1100, time)));
      }
      scores.forEach((score, index) => {
        const value = saved.scores?.[index];
        if (Number.isInteger(value) && value >= 18 && value < 49) scores[index] = bars[index].dataset.score = value;
      });
      if (!['ready', 'scores', 'ecg', 'severity', 'complete'].includes(saved.phase)) return;
      setPhase(saved.phase);
      elapsed = Math.max(0, Number(saved.elapsed) || 0);
      if (phase === 'ecg') ecgStart = clock - elapsed;
      evaluateButton.removeAttribute('hidden');
      if (phase !== 'ready') evaluateButton.setAttribute('aria-disabled', 'true');
      if (['ecg', 'severity', 'complete'].includes(phase)) {
        paintScores(1);
        ecgGroup.setAttribute('visibility', 'visible');
      }
      if (['severity', 'complete'].includes(phase)) result?.setAttribute('visibility','visible');
      if (phase === 'complete') {
        paintSeverity(1);
        draftButton.removeAttribute('hidden');
      }
    },
    pause(){lastTime=0},
    render(now) {
      const delta=lastTime?Math.min(80,now-lastTime):0;
      lastTime=now; clock+=delta; elapsed+=delta;
      if(!fontsSized){enlargeText(body,1.14);enlargeText(title,1.035);fontsSized=true}
      scanBand.setAttribute('y',String(90+(clock%7200)/7200*795));
      vertices.forEach(point=>{
        const t=clock/point.speed;
        const proximity=Math.max(Math.exp(-Math.pow((point.x-699)/47,2)),Math.exp(-Math.pow((point.x-851)/47,2)));
        const eyeSag=progress('eyes')*4*proximity*Math.exp(-Math.pow((point.y-411)/35,2));
        const bagSag=progress('bags')*6*proximity*Math.exp(-Math.pow((point.y-445)/26,2));
        const lipSag=progress('lips')*6*Math.exp(-Math.pow((point.y-583)/26,2))*Math.exp(-Math.pow((point.x-773)/45,2));
        point.dx=motionReduced.matches?0:(Math.sin(t+point.seed)+Math.sin(t*.43+point.seed*2)*.4)*1.1;
        point.dy=(motionReduced.matches?0:(Math.cos(t*.77+point.seed)+Math.sin(t*.51+point.seed)*.35)*1.0)+eyeSag+bagSag+lipSag;
      });
      movingLines.forEach(({line,a,b})=>{
        line.setAttribute('x1',a.x+a.dx);line.setAttribute('y1',a.y+a.dy);
        line.setAttribute('x2',b.x+b.dx);line.setAttribute('y2',b.y+b.dy);
      });
      movingNodes.forEach(({circle,point,inverse})=>{
        const p=new DOMPoint(point.x+point.dx,point.y+point.dy).matrixTransform(inverse);
        circle.setAttribute('cx',p.x);circle.setAttribute('cy',p.y);
      });
      pupils.forEach(({eye,x},index)=>{
        const tired=progress('eyes');
        [eye,eyeOutlines[index]].forEach(element=>{
          element.style.stroke = visited.has('eyes') ? FEATURE_COLOR : '';
          element.style.opacity = visited.has('eyes') ? '1' : '.55';
        });
        eye.setAttribute('cx',x+(motionReduced.matches?0:Math.sin(clock/1500+index*.7)*(tired?3:1.2)));
        eye.setAttribute('cy',412.96+tired*4);
        eye.setAttribute('ry',14-tired*5);
        eyeOutlines[index].setAttribute('d',`M${x-22},${412.96+tired*3}Q${x},${394+tired*16} ${x+22},${412.96+tired*3}Q${x},${431-tired*7} ${x-22},${412.96+tired*3}Z`);
      });
      const lip=progress('lips');
      mouthLines.forEach(line=>{
        line.style.stroke = visited.has('lips') ? FEATURE_COLOR : '';
        line.style.opacity = visited.has('lips') ? '1' : '.55';
      });
      mouthLines[0].setAttribute('d',`M749.69,${572.96+lip*11}Q772.69,${566.96+lip*13} 795.69,${572.96+lip*11}`);
      mouthLines[1].setAttribute('d',`M748.69,${589.96+lip*6}Q772.69,${597.96+lip*9} 795.69,${589.96+lip*6}`);
      responses.forEach((time,feature)=>{
        const next=Math.min(1100,time+delta);responses.set(feature,next);
        responseGroups[feature].setAttribute('opacity',String(.3+.7*Math.sin(Math.min(1,next/1100)*Math.PI/2)));
        const region=regionBands[feature];
        region.band.setAttribute('y',region.y-13+(region.height+26)*Math.min(1,next/1100));
        region.group.setAttribute('opacity',Math.sin(Math.min(1,next/1100)*Math.PI));
      });
      if(phase==='reading'&&visited.size===3&&[...responses.values()].every(time=>time>=1100)){
        setPhase('ready');show(evaluateButton);
      }
      if(phase==='scores'){
        const progress=Math.min(1,elapsed/1800);
        paintScores(progress);
        if(progress===1){setPhase('ecg');ecgStart=clock;ecgGroup.setAttribute('visibility','visible')}
      }
      if(['ecg','severity','complete'].includes(phase)){
        const ecgTime=clock-ecgStart;
        const nextCycle=Math.floor(ecgTime/ecgSweepMs);
        if(nextCycle!==cycle){cycle=nextCycle;makeEcg()}
        const scanHead = 1129.6 + (ecgTime % ecgSweepMs) / ecgSweepMs * ecgSweepWidth;
        windowRect.setAttribute('x',String(scanHead - 88));
      }
      if (phase === 'ecg' && elapsed >= ecgSweepMs) {
        setPhase('severity');
        result?.setAttribute('visibility','visible');
      }
      if(phase==='severity'){
        paintSeverity(Math.min(1,elapsed/2400));
        if(elapsed>=2400){setPhase('complete');show(draftButton)}
      }
    }
  };
}
