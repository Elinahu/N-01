import {createMailConversation} from './mail-dialogue.js';
import {survivorOpening,partnerAfterSurvivor,survivorAfterPartner,survivorEnding,survivorScreeningReply} from './survivor-content.js';
import {initializeStoryCollection} from './story-collection.js';
import {assetUrl} from './assets.js';

export function initializeSurvivorDialogue(svg,{partnerSvg,partnerDialogue,contacts,page,onPreviewOpen,storyArtwork,onScreeningComplete}={}){
  const dialogue=createMailConversation(svg,{
    templates:partnerDialogue.templates,initialDialogue:[],npcName:'SURVIVOR',
    npcAvatar:assetUrl('images/fca-contact-survivor.png'),soundSource:'mail-survivor'
  });
  let stage='not-started',started=false,endingStarted=false,screeningReplied=false;
  let screeningEndAt=0, screeningRemaining=null;
  const collection=initializeStoryCollection(storyArtwork,{page,onReturn:continueAfterStories,onOpen:onPreviewOpen});
  function setStage(value){stage=value;svg.dataset.survivorStage=value;partnerSvg.dataset.survivorStage=value}
  function openPreview(){
    if(collection.isOpen)return;
    dialogue.pause();partnerDialogue.pause();collection.open();
  }
  function continueAfterStories(){
    if(!endingStarted){
      endingStarted=true;setStage('survivor-ending');
      dialogue.startDialogue(survivorEnding,{id:'survivor-ending',onComplete:finishEnding});
    }
    svg.querySelector('[role="log"]').focus({preventScroll:true});
  }
  function showOffline(){
    contacts.setPartnerOffline();
    const status=document.createElementNS('http://www.w3.org/2000/svg','g');
    Object.entries({role:'status','aria-live':'polite',class:'mail-offline-notice','pointer-events':'none','clip-path':partnerSvg.querySelector('[role="log"]').getAttribute('clip-path')}).forEach(([key,value])=>status.setAttribute(key,value));
    const back=document.createElementNS('http://www.w3.org/2000/svg','rect');
    Object.entries({x:474,y:345,width:322,height:42,rx:4,fill:'#090a07','fill-opacity':.85,stroke:'#cbb28a33','stroke-width':1}).forEach(([key,value])=>back.setAttribute(key,value));
    const text=document.createElementNS('http://www.w3.org/2000/svg','text');
    Object.entries({x:635,y:366.25,fill:'#d9cdb7','font-size':13,'font-family':'Consolas, monospace','text-anchor':'middle','dominant-baseline':'middle'}).forEach(([key,value])=>text.setAttribute(key,value));
    text.textContent='The other party is offline';status.append(back,text);partnerSvg.append(status);
  }
  function offline(){showOffline();setStage('await-survivor');contacts.prompt('survivor')}
  function finishOpening(){setStage('await-partner');contacts.prompt('partner')}
  function finishEnding(){setStage('complete')}
  function finishScreening(){setStage('screening-complete')}
  function finishReturn(){
    setStage('story-preview');
    dialogue.appendMedia({title:'Story Collection',detail:'TRANSMISSION // AUTO PLAY',onOpen:openPreview});
    openPreview();
  }
  const completion = {
    'survivor-opening': finishOpening, 'survivor-return': finishReturn,
    'survivor-ending': finishEnding, 'survivor-screening-reply': finishScreening
  };
  function scheduleScreeningEnd(delay){
    screeningRemaining=null;
    screeningEndAt=performance.now()+delay;
    window.setTimeout(()=>onScreeningComplete?.(),delay);
  }
  function select(channel){
    if(stage==='await-partner'&&channel==='partner'){
      if(partnerDialogue.startDialogue(partnerAfterSurvivor,{id:'partner-after-survivor',lastReplyDelay:1000,onComplete:offline})){
        contacts.prompt(null);setStage('partner-exchange');
      }
    }else if(stage==='await-survivor'&&channel==='survivor'){
      contacts.prompt(null);setStage('survivor-return');
      dialogue.startDialogue(survivorAfterPartner,{id:'survivor-return',onComplete:finishReturn});
    }
  }
  return {
    snapshot(){
      return {
        stage, started, endingStarted, screeningReplied,
        screeningRemaining: screeningEndAt ? Math.max(0, Math.round(screeningEndAt - performance.now())) : screeningRemaining,
        active: contacts.activeChannel, added: contacts.added, offline: contacts.partnerOffline,
        dialogue: dialogue.snapshot(), collection: collection.snapshot()
      };
    },
    async restore(saved, partnerSaved){
      partnerDialogue.restore(partnerSaved, { onComplete: partnerSaved?.dialogueId === 'partner-after-survivor' ? offline : undefined });
      if (!saved) return;
      ({started,endingStarted,screeningReplied,screeningRemaining}=saved);
      setStage(saved.stage);
      contacts.restore(saved);
      if (saved.offline) showOffline();
      if (stage === 'await-partner') contacts.prompt('partner');
      if (stage === 'await-survivor') contacts.prompt('survivor');
      dialogue.restore(saved.dialogue,{onComplete:completion[saved.dialogue?.dialogueId],onMedia:openPreview});
      await collection.restore(saved.collection);
    },
    resume(){if(Number.isFinite(screeningRemaining))scheduleScreeningEnd(screeningRemaining)},
    start(){
      if(started)return;started=true;setStage('survivor-opening');
      dialogue.startDialogue(survivorOpening,{id:'survivor-opening',onComplete:finishOpening});
    },
    select,
    screeningInterrupted(){
      if(screeningReplied)return;screeningReplied=true;
      contacts.select('survivor');contacts.prompt(null);setStage('screening-reply');
      dialogue.startDialogue(survivorScreeningReply,{id:'survivor-screening-reply',interrupt:true,onComplete:finishScreening});
      svg.querySelector('[role="log"]').focus({preventScroll:true});
    },
    render(now){
      collection.render(now);
      if(contacts.activeChannel==='survivor'&&!collection.isOpen)dialogue.render(now);
      else dialogue.pause();
      if(screeningReplied&&!screeningEndAt&&svg.dataset.dialogueChapter==='survivor-screening-reply'&&svg.dataset.conversation==='npc-hold'){
        scheduleScreeningEnd(5000);
      }
    },
    pause(){dialogue.pause()},
    get isMediaOpen(){return collection.isOpen}
  };
}
