// Dialog.txt的续写，从原玩家第一条回复之后开始；顺序为搭档、玩家、搭档。
// 附件会在这里最后一句搭档台词完成后自动发送。
export const mailFollowUp = [
  { speaker: 'npc', text: 'You keep an eye on all this for now — I want to step out for a smoke and get some fresh air.' },
  { speaker: 'player', text: "Haven't you quit smoking?" },
  { speaker: 'npc', text: "Oh, come on, this thing... I've already quit for 3 years now — that's about enough." }
];

// Dialog2.txt目前只有这一句搭档台词；打完后发送第二份附件，不虚构玩家回复。
// 后续可按同样的 { speaker: 'npc' | 'player', text } 格式继续补充。
export const secondMailDialogue = [
  { speaker: 'npc', text: 'I have received your analysis report and have applied to the bureau to extract the "victim\'s" phone camera for a preliminary facial analysis.' }
];
