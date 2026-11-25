// 说服段 (游戏设计 「任务」CRPG 要素, Lucas 2026-11-25, replaces 言灵检定): when the story needs an NPC talked round,
// a short AI talk in the duel engine (3–6 rounds). The AI plays the NPC and judges whether you convinced it; only then
// you pass. Officials and landlords want Sie, peers du: the wrong one is pointed out at once and that round doesn't
// count. Failing costs nothing and can be retried; from the second try the NPC lets slip what it cares about. From 83
// it is spoken (typing stays as the way back); from 171 it needs an argument (claim, reasons, example, rebuttal,
// conclusion). AI unavailable → the task falls back to fighting through.
// Inside the 「AI 对话」 entry it is a mode with these scenes (暂定 list; the story's own persuasion scenes use the same engine).

export const PERSUADE = { from: 21, rounds: 6, argueFrom: 171 };

export interface PersuadeScene {
  id: string;
  title: string;
  npc: string;
  /** For the model: who the NPC is and what you want (Chinese). */
  scene: string;
  /** What it really cares about (revealed from the 2nd try). */
  cares: string;
  formal: boolean;
  /** What the player sees before starting (Chinese). */
  intro: string;
}

export const PERSUADE_SCENES: PersuadeScene[] = [
  { id: 'heizung', title: '房东：暖气坏了', npc: 'Herr Brandl（房东）', formal: true, scene: '人物是房东 Herr Brandl，冬天玩家家里的暖气坏了一周，玩家要说服他这周就找人来修，而不是等下个月。', cares: '他怕维修工太贵，也怕租客以后天天打电话；如果玩家愿意配合时间、说明情况紧急（家里冷、会生病、房子会受潮），他会答应。', intro: '暖气坏了一周，房东说下个月再修。说服他这周就找人来（对房东用 Sie）。' },
  { id: 'frist', title: '市政厅：材料晚交了', npc: 'Frau Weber（书记员）', formal: true, scene: '人物是市政厅书记员 Frau Weber，玩家的住址登记材料晚交了两天，她说要重新预约。玩家要说服她今天就收下。', cares: '她在意规定和公平：如果玩家说明原因（生病、有证明）、道歉、并且材料齐全，她可以破例。', intro: '登记材料晚交了两天，书记员要你重新预约。说服她今天就收下（用 Sie）。' },
  { id: 'kueche', title: '合租：厨房太乱', npc: 'Jonas（室友）', formal: false, scene: '人物是合租室友 Jonas，他总不洗碗。玩家要说服他一起排一个打扫计划。', cares: '他其实很忙、怕被说教；如果玩家不指责他、提议轮流并且给他选时间，他会同意。', intro: '室友总不洗碗。说服他和你一起排打扫计划（对室友用 du）。' },
  { id: 'schicht', title: '同事：换班', npc: 'Mia（同事）', formal: false, scene: '人物是同事 Mia，玩家下周六要参加朋友婚礼，想和她换班。', cares: '她周六晚上本来有空，但上次换班对方没还；如果玩家说清楚哪天还、甚至主动多帮一点，她会答应。', intro: '下周六你要去婚礼，想和同事换班。说服她（对同事用 du）。' },
  { id: 'nachbar', title: '邻居：深夜太吵', npc: 'Herr Kaya（邻居）', formal: true, scene: '人物是楼上邻居 Herr Kaya，他每晚 23 点后还在放音乐。玩家要说服他晚上 22 点后小声一点。', cares: '他是夜班工人，只有晚上能放松；如果玩家礼貌、说明自己早上要上班，并提出折中（比如戴耳机或周末可以晚一点），他会同意。', intro: '楼上邻居每晚 23 点后还在放音乐。礼貌地说服他晚上小声一点（用 Sie）。' },
];
