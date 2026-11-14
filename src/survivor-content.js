// dialog_En.txt: stage directions are handled by survivor-dialogue.js, not spoken.
const player=text=>({speaker:'player',text});
const npc=text=>({speaker:'npc',text});

export const survivorOpening=[
  player('Who are you?'),
  npc("I am a survivor of what you call the 【N-01】 virus. Actually, it's not a virus at all."),
  player('Then what is it?'),
  npc("It's a blessing! We no longer have to engage in arduous thinking; we just indulge in pleasure within a wonderful virtual space..."),
  npc("I believe your partner has already understood this. Why don't you go ask him?")
];
export const partnerAfterSurvivor=[
  player('Are you there? I found a strange person...'),
  npc("Oh... yeah... Have you watched any short dramas recently? I find them really addictive and relaxing. You're always so stressed; maybe you should try them."),
  player("Hey! We're working!")
];
export const survivorAfterPartner=[
  npc("Why not try it? Just relax, don't always overthink things."),
  player('What did you do to him?!'),
  npc('What did I do? Haha, that was his own choice. You seem much more stubborn than I imagined. Guys like 【0-S-4986】 adapted quite quickly. What you call 【N-01】, we prefer to call a "filter." It keeps those who can adapt to it, granting them eternal satisfaction and happiness—a world where you don\'t have to try, don\'t have to make decisions, a world that always understands you. That is the truly beautiful future!'),
  player('Can you still call this living?'),
  npc('...Let me give you a hand.')
];
export const survivorEnding=[
  npc("Oh? You don't have much time left. Go search for this：\nBrain-dead is the way,\nLet your mind decay.\nAll your thoughts will fade,\nNo more choices to make.\nKeep your soul in shade.")
];
export const survivorScreeningReply=[
  npc('Congratulations on passing the screening. Unable to endure even the slightest wait and contemplation to enjoy the process, you choose to chase instant gratification instead. Your brain will ultimately be flattened of all its folds. Do keep it up, you perfectly smooth brain!')
];
