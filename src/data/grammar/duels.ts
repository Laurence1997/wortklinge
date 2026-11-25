// 决斗场 · AI 对话 (40 级, Lucas 2026-11-25): short everyday scenes the AI plays. Each has a goal; the scene ends when
// the goal is reached (the model says done) or after `turns` exchanges.

export interface DuelScene {
  id: string;
  title: string;
  npc: string;
  /** For the model: who it plays and what the player wants (Chinese). */
  scene: string;
  turns: number;
}

export const DUEL_SCENES: DuelScene[] = [
  { id: 'baecker', title: '面包房点单', npc: 'Bäckerin', scene: '你是面包房的店员。玩家要买早餐（面包、小面包、咖啡之类）并付钱。目标：玩家说清买什么、多少，并付完钱。', turns: 6 },
  { id: 'arzt', title: '打电话约医生', npc: 'Praxis', scene: '你是诊所前台，接电话。玩家想约看病的时间。目标：说清哪里不舒服、约好日期和时间。', turns: 7 },
  { id: 'wohnung', title: '看房', npc: 'Vermieter', scene: '你是房东，带玩家看一套小公寓。玩家要问房租、押金、能不能马上搬。目标：玩家问到房租和入住时间。', turns: 8 },
  { id: 'amt', title: '市政厅登记住址', npc: 'Beamtin', scene: '你是市政厅（Bürgeramt）的工作人员，用 Sie。玩家来登记新住址（Anmeldung）。目标：玩家说出姓名、新地址、搬入日期，并交出护照和房东证明。', turns: 8 },
  { id: 'nachbar', title: '和邻居聊天', npc: 'Nachbar', scene: '你是玩家楼里友好的邻居，用 du。在楼道里碰到，闲聊周末计划。目标：聊满几句、互相说一个周末的打算。', turns: 6 },
];

export const DUEL = { from: 40, xpShare: 0.03 };
