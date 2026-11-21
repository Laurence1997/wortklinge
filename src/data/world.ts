// 0.5 大地图 + 小世界 (游戏设计 › 0.3 之后的改版方向 › 一、地图). Data only: adding an area means adding rows here.
// Each scene sits on a tile of the old 0.4 map (`at`), so saved positions, echoes, packs (same scene = within
// CONFIG.pack.radiusTiles) and the online presence all keep working with tile coordinates.
// Fields keep the 0.4 word pools (zone); a 0.4 field of 10 monsters became 4 scenes × CONFIG.map.slots.
import type { ZoneId } from '../core/types';
import type { NpcId, RegionId } from '../game/map';

export type SceneType = 'camp' | 'field' | 'road' | 'door' | 'hidden';

export interface SceneDef {
  id: string;
  region: RegionId;
  /** Scene number on the route map (1 → 2 → 3 …). */
  no: number;
  zh: string;
  type: SceneType;
  /** Tile on the 0.4 map this scene stands on. */
  at: { x: number; y: number };
  /** Word pool for monsters (fields and hidden scenes). */
  zone?: ZoneId;
  /** Monster slots; defaults to CONFIG.map.slots for fields. */
  slots?: number;
  npcs?: NpcId[];
  bonfire?: boolean;
  door?: boolean;
  gate?: RegionId;
  signs?: string[];
  /** Hidden route: drawn only once this sign's word can be read (归名 stage ≥ 3). */
  hiddenBy?: string;
  /** Hidden scenes: chance multiplier for 残句 (region 1) or rare monsters (region 2). */
  lucky?: number;
  /** 0.6 场景记忆法: the fixed word group (word ids) this field scene's monsters come from. */
  words?: string[];
}

export interface AreaDef {
  region: RegionId;
  zh: string;
  de: string;
  levels: string;
  hub: string;
}

/** 大地图: five big regions and twenty areas are planned; 0.5 moves the two existing ones over. */
export const AREAS: AreaDef[] = [
  { region: 1, zh: '最后的营地', de: 'Glutheim', levels: 'Lv 1–10', hub: 'r1-camp' },
  { region: 2, zh: '面包集市', de: 'Brotmarkt', levels: 'Lv 11–20', hub: 'r2-feuer' },
];

/** Areas not built yet, shown greyed out on the big map. */
export const AREAS_LATER = ['旧城区 · A2', '河港 · A2', '车站 · A2', '图书馆 · B1'];

export const SCENES: SceneDef[] = [
  // ---- Region 1 · 最后的营地 ----
  // 0.6 场景记忆法: every field scene owns a fixed group of ~10 words (one topic); its monsters come from that group.
  { id: 'r1-camp', region: 1, no: 1, zh: '余烬营地', type: 'camp', at: { x: 13, y: 26 }, npcs: ['hilde', 'examiner', 'mira'], bonfire: true, signs: ['feuer'] },
  { id: 'r1-e1', region: 1, no: 2, zh: '回声巷口 · 厨房桌', type: 'field', zone: 'echogasse', at: { x: 23, y: 24 }, signs: ['strasse'], words: ['brot', 'tee', 'tasse', 'wasser', 'kaffee', 'flasche', 'glas', 'stuhl', 'tisch'] },
  { id: 'r1-e2', region: 1, no: 3, zh: '回声巷 · 卧室', type: 'field', zone: 'echogasse', at: { x: 25, y: 16 }, words: ['bett', 'lampe', 'tuer', 'fenster', 'schluessel', 'decke', 'feuer', 'uhr'] },
  { id: 'r1-e3', region: 1, no: 4, zh: '回声巷 · 衣帽架', type: 'field', zone: 'echogasse', at: { x: 26, y: 33 }, words: ['tasche', 'buch', 'stift', 'papier', 'handy', 'jacke', 'schuh', 'brille'] },
  { id: 'r1-e5', region: 1, no: 5, zh: '回声巷 · 晾衣绳', type: 'field', zone: 'echogasse', at: { x: 33, y: 17 }, words: ['hallo', 'guten-morgen', 'guten-tag', 'guten-abend', 'gute-nacht', 'tschuess', 'auf-wiedersehen', 'bis-bald', 'bis-morgen', 'herzlich-willkommen'] },
  { id: 'r1-e6', region: 1, no: 6, zh: '回声巷 · 楼道口', type: 'field', zone: 'echogasse', at: { x: 32, y: 30 }, words: ['danke', 'bitte', 'vielen-dank', 'entschuldigung', 'gern', 'freut-mich', 'kein-problem'] },
  { id: 'r1-e7', region: 1, no: 7, zh: '回声巷 · 屋顶', type: 'field', zone: 'echogasse', at: { x: 36, y: 11 }, words: ['ja', 'nein', 'wie-bitte', 'wie-geht-s', 'alles-klar', 'ich-weiss-nicht', 'noch-einmal-bitte'] },
  { id: 'r1-e4', region: 1, no: 8, zh: '回声巷尽头 · 搬家箱', type: 'field', zone: 'echogasse', at: { x: 34, y: 24 }, words: ['koffer', 'karte', 'foto', 'zeitung', 'computer', 'zimmer', 'haus', 'wohnung', 'strasse'] },
  { id: 'r1-x', region: 1, no: 9, zh: '十字路口', type: 'road', at: { x: 41, y: 24 }, signs: ['name', 'familie'] },
  { id: 'r1-s1', region: 1, no: 10, zh: '名牌街口 · 登记处', type: 'field', zone: 'schilderstrasse', at: { x: 46, y: 17 }, words: ['name', 'vorname', 'familienname', 'adresse', 'telefonnummer', 'e-mail', 'alter', 'formular', 'ausweis', 'pass'] },
  { id: 'r1-s2', region: 1, no: 11, zh: '名牌街 · 钟楼下', type: 'field', zone: 'schilderstrasse', at: { x: 50, y: 10 }, words: ['wer', 'was', 'wo', 'woher', 'wie', 'wie-viel', 'heissen', 'sein', 'haben', 'kommen'] },
  { id: 'r1-s5', region: 1, no: 12, zh: '名牌街 · 号码墙', type: 'field', zone: 'schilderstrasse', at: { x: 52, y: 16 }, words: ['null-num', 'eins-num', 'zwei-num', 'drei-num', 'vier-num', 'fuenf-num', 'sechs-num', 'sieben-num', 'acht-num', 'neun-num', 'zehn-num', 'elf-num', 'zwoelf-num'] },
  { id: 'r1-s3', region: 1, no: 13, zh: '名牌街 · 旧邮局', type: 'field', zone: 'schilderstrasse', at: { x: 58, y: 16 }, words: ['deutschland', 'china', 'oesterreich', 'schweiz', 'tuerkei', 'italien', 'spanien', 'frankreich', 'japan', 'land', 'stadt'] },
  { id: 'r1-s6', region: 1, no: 14, zh: '名牌街 · 夜校', type: 'field', zone: 'schilderstrasse', at: { x: 58, y: 9 }, words: ['sprache', 'deutsch', 'chinesisch', 'englisch', 'kurs', 'schule', 'wort', 'satz', 'frage', 'antwort'] },
  { id: 'r1-s7', region: 1, no: 15, zh: '名牌街 · 职业介绍所', type: 'field', zone: 'schilderstrasse', at: { x: 42, y: 4 }, words: ['beruf', 'arbeit', 'student', 'studentin', 'lehrer', 'lehrerin', 'arzt', 'aerztin', 'koch', 'koechin', 'ingenieur'] },
  { id: 'r1-s8', region: 1, no: 16, zh: '名牌街 · 门铃', type: 'field', zone: 'schilderstrasse', at: { x: 54, y: 4 }, words: ['freund', 'freundin', 'mann', 'frau', 'kind', 'herr', 'nachbar', 'nachbarin'] },
  { id: 'r1-s9', region: 1, no: 17, zh: '名牌街 · 布告栏', type: 'field', zone: 'schilderstrasse', at: { x: 61, y: 3 }, words: ['wohnen', 'arbeiten', 'machen', 'gehen', 'sprechen', 'lernen', 'verstehen'] },
  { id: 'r1-s4', region: 1, no: 18, zh: '名牌街尽头 · 抄写室', type: 'field', zone: 'schilderstrasse', at: { x: 64, y: 9 }, words: ['buchstabieren', 'fragen', 'antworten', 'schreiben', 'lesen', 'hoeren', 'sagen'] },
  { id: 'r1-a1', region: 1, no: 19, zh: '灰烬公寓 · 门厅', type: 'field', zone: 'aschehof', at: { x: 46, y: 33 }, words: ['dreizehn-num', 'vierzehn-num', 'fuenfzehn-num', 'sechzehn-num', 'siebzehn-num', 'achtzehn-num', 'neunzehn-num', 'zwanzig-num', 'einundzwanzig-num'] },
  { id: 'r1-a2', region: 1, no: 20, zh: '灰烬公寓 · 楼梯间', type: 'field', zone: 'aschehof', at: { x: 50, y: 40 }, words: ['familie', 'vater', 'mutter', 'eltern', 'sohn', 'tochter', 'bruder', 'schwester', 'geschwister'] },
  { id: 'r1-a5', region: 1, no: 21, zh: '灰烬公寓 · 信箱', type: 'field', zone: 'aschehof', at: { x: 42, y: 42 }, words: ['gross', 'klein', 'alt', 'jung', 'neu', 'schoen', 'verheiratet', 'ledig'] },
  { id: 'r1-a6', region: 1, no: 22, zh: '灰烬公寓 · 二楼', type: 'field', zone: 'aschehof', at: { x: 54, y: 27 }, words: ['opa', 'oma', 'grossvater', 'grossmutter', 'baby', 'onkel', 'tante', 'junge', 'maedchen', 'leute'] },
  { id: 'r1-a3', region: 1, no: 23, zh: '灰烬公寓 · 天井', type: 'field', zone: 'aschehof', at: { x: 58, y: 34 }, words: ['dreissig-num', 'vierzig-num', 'fuenfzig-num', 'hundert-num', 'jahr', 'monat', 'woche', 'tag'] },
  { id: 'r1-a7', region: 1, no: 24, zh: '灰烬公寓 · 病床', type: 'field', zone: 'aschehof', at: { x: 56, y: 41 }, words: ['muede', 'krank', 'nett', 'toll', 'auch', 'sehr', 'nicht'] },
  { id: 'r1-a4', region: 1, no: 25, zh: '灰烬公寓 · 顶楼', type: 'field', zone: 'aschehof', at: { x: 64, y: 41 }, words: ['hund', 'katze', 'geburtstag', 'heute', 'morgen', 'hier'] },
  { id: 'r1-door', region: 1, no: 26, zh: '邻居家门', type: 'door', at: { x: 68, y: 24 }, door: true },
  { id: 'r1-hide', region: 1, no: 27, zh: '灯下暗巷', type: 'hidden', zone: 'echogasse', slots: 2, at: { x: 22, y: 40 }, hiddenBy: 'strasse', lucky: 3 },

  // ---- Region 2 · 面包集市 ----
  { id: 'r2-feuer', region: 2, no: 1, zh: '集市篝火', type: 'camp', at: { x: 13, y: 24 }, npcs: ['hilde', 'examiner'], bonfire: true, gate: 1 },
  { id: 'r2-stand', region: 2, no: 2, zh: '集市摊位', type: 'camp', at: { x: 13, y: 17 }, npcs: ['mira', 'greta'] },
  { id: 'r2-baeck', region: 2, no: 3, zh: '康拉德面包房', type: 'camp', at: { x: 6, y: 28 }, npcs: ['konrad'], signs: ['baeckerei'] },
  { id: 'r2-x', region: 2, no: 4, zh: '集市口', type: 'road', at: { x: 22, y: 24 }, signs: ['markt', 'preis'] },
  { id: 'r2-g1', region: 2, no: 5, zh: '菜摊街口 · 水果摊', type: 'field', zone: 'gemuesegasse', at: { x: 28, y: 16 }, words: ['apfel', 'banane', 'orange', 'birne', 'zitrone', 'erdbeere', 'traube', 'kirsche', 'obst'] },
  { id: 'r2-g5', region: 2, no: 6, zh: '菜摊街 · 奶酪铺', type: 'field', zone: 'gemuesegasse', at: { x: 28, y: 9 }, words: ['ei', 'kaese', 'broetchen', 'kuchen', 'mehl', 'butter', 'milch', 'joghurt', 'sahne', 'brezel'] },
  { id: 'r2-g2', region: 2, no: 7, zh: '菜摊街 · 萝卜摊', type: 'field', zone: 'gemuesegasse', at: { x: 34, y: 7 }, words: ['kartoffel', 'tomate', 'gemuese', 'salat', 'zwiebel', 'gurke', 'karotte', 'paprika', 'knoblauch', 'pilz'] },
  { id: 'r2-g6', region: 2, no: 8, zh: '菜摊街 · 肉案', type: 'field', zone: 'gemuesegasse', at: { x: 39, y: 3 }, words: ['fisch', 'fleisch', 'wurst', 'haehnchen', 'schinken', 'steak', 'reis', 'nudel', 'suppe'] },
  { id: 'r2-g3', region: 2, no: 9, zh: '菜摊街 · 水井', type: 'field', zone: 'gemuesegasse', at: { x: 42, y: 14 }, words: ['saft', 'bier', 'wein', 'cola', 'limonade', 'mineralwasser', 'kakao', 'eis', 'schokolade'] },
  { id: 'r2-g7', region: 2, no: 10, zh: '菜摊街 · 香料摊', type: 'field', zone: 'gemuesegasse', at: { x: 45, y: 20 }, words: ['zucker', 'salz', 'oel', 'pfeffer', 'marmelade', 'honig', 'muesli', 'suess', 'sauer', 'salzig', 'scharf', 'bitter'] },
  { id: 'r2-g4', region: 2, no: 11, zh: '菜摊街尽头 · 试吃桌', type: 'field', zone: 'gemuesegasse', at: { x: 47, y: 4 }, words: ['frisch', 'lecker', 'heiss', 'kalt', 'warm', 'hungrig', 'durstig', 'satt', 'gesund', 'reif'] },
  { id: 'r2-w1', region: 2, no: 12, zh: '秤巷口 · 钱庄', type: 'field', zone: 'waagegasse', at: { x: 28, y: 33 }, words: ['euro', 'cent', 'geld', 'muenze', 'kleingeld', 'portemonnaie', 'kreditkarte', 'rechnung', 'quittung', 'kasse'] },
  { id: 'r2-w5', region: 2, no: 13, zh: '秤巷 · 价目牌', type: 'field', zone: 'waagegasse', at: { x: 28, y: 25 }, words: ['preis', 'angebot', 'sonderangebot', 'rabatt', 'billig', 'teuer', 'guenstig', 'kostenlos', 'viel', 'wenig', 'genug', 'zusammen'] },
  { id: 'r2-w2', region: 2, no: 14, zh: '秤巷 · 砝码铺', type: 'field', zone: 'waagegasse', at: { x: 34, y: 41 }, words: ['kilo', 'gramm', 'pfund', 'liter', 'waage', 'stueck', 'packung', 'dose', 'tuete', 'becher'] },
  { id: 'r2-w6', region: 2, no: 15, zh: '秤巷 · 算盘', type: 'field', zone: 'waagegasse', at: { x: 38, y: 27 }, words: ['sechzig-num', 'siebzig-num', 'achtzig-num', 'neunzig-num', 'fuenfundzwanzig-num', 'zweiunddreissig-num', 'fuenfundvierzig-num', 'neunundneunzig-num', 'zweihundert-num', 'fuenfhundert-num', 'tausend-num'] },
  { id: 'r2-w3', region: 2, no: 16, zh: '秤巷 · 账房', type: 'field', zone: 'waagegasse', at: { x: 42, y: 34 }, words: ['markt', 'supermarkt', 'geschaeft', 'laden', 'baeckerei', 'metzgerei', 'kiosk', 'oeffnungszeit', 'geoeffnet', 'geschlossen'] },
  { id: 'r2-w7', region: 2, no: 17, zh: '秤巷 · 柜台', type: 'field', zone: 'waagegasse', at: { x: 28, y: 40 }, words: ['kunde', 'verkaeufer', 'verkaeuferin', 'korb', 'liste', 'paket', 'einkauf', 'groesse', 'truhe'] },
  { id: 'r2-w8', region: 2, no: 18, zh: '秤巷 · 讨价还价', type: 'field', zone: 'waagegasse', at: { x: 48, y: 35 }, words: ['was-kostet-das', 'ich-nehme-das', 'das-ist-zu-teuer', 'geht-das-billiger', 'das-macht-fuenf-euro', 'bar-oder-mit-karte', 'noch-etwas', 'das-ist-alles'] },
  { id: 'r2-w4', region: 2, no: 19, zh: '秤巷尽头 · 收银台', type: 'field', zone: 'waagegasse', at: { x: 47, y: 42 }, words: ['zahlen-bitte', 'stimmt-so', 'haben-sie-brot', 'ich-haette-gern-ein-kilo-aepfel', 'wo-ist-die-kasse', 'kann-ich-mit-karte-zahlen', 'gibt-es-einen-rabatt'] },
  { id: 'r2-kx', region: 2, no: 20, zh: '粮仓口', type: 'road', at: { x: 51, y: 22 }, signs: ['korn'] },
  { id: 'r2-k1', region: 2, no: 21, zh: '粮仓 · 麻袋堆', type: 'field', zone: 'kornspeicher', at: { x: 56, y: 14 }, words: ['essen', 'trinken', 'nehmen', 'kaufen', 'kosten', 'brauchen', 'geben', 'bezahlen'] },
  { id: 'r2-k5', region: 2, no: 22, zh: '粮仓 · 碗柜', type: 'field', zone: 'kornspeicher', at: { x: 65, y: 13 }, words: ['teller', 'gabel', 'messer', 'loeffel', 'schuessel', 'kanne', 'serviette', 'geschirr'] },
  { id: 'r2-k2', region: 2, no: 23, zh: '粮仓 · 风车下', type: 'field', zone: 'kornspeicher', at: { x: 61, y: 7 }, words: ['fruehstueck', 'mittagessen', 'abendessen', 'hunger', 'durst', 'sack', 'korn'] },
  { id: 'r2-k3', region: 2, no: 24, zh: '粮仓 · 磨坊', type: 'field', zone: 'kornspeicher', at: { x: 56, y: 31 }, words: ['kochen', 'sehen', 'suchen', 'finden', 'helfen', 'bestellen', 'schmecken', 'moegen'] },
  { id: 'r2-k6', region: 2, no: 25, zh: '粮仓 · 灶房', type: 'field', zone: 'kornspeicher', at: { x: 63, y: 19 }, words: ['topf', 'pfanne', 'kuehlschrank', 'kueche', 'herd', 'ofen', 'mikrowelle', 'brett', 'gewuerz', 'rezept'] },
  { id: 'r2-k7', region: 2, no: 26, zh: '粮仓 · 伙房', type: 'field', zone: 'kornspeicher', at: { x: 68, y: 34 }, words: ['speisekarte', 'kellner', 'kellnerin', 'restaurant', 'vorspeise', 'hauptgericht', 'nachtisch', 'pizza', 'getraenk'] },
  { id: 'r2-k4', region: 2, no: 27, zh: '粮仓 · 地窖口', type: 'field', zone: 'kornspeicher', at: { x: 61, y: 40 }, words: ['schneiden', 'waschen', 'tragen', 'vergessen', 'backen', 'probieren', 'zaehlen', 'braten', 'wiegen', 'fruehstuecken', 'mischen'] },
  { id: 'r2-door', region: 2, no: 28, zh: '秤房', type: 'door', at: { x: 68, y: 24 }, door: true },
  { id: 'r2-hide', region: 2, no: 29, zh: '粮仓阁楼', type: 'hidden', zone: 'kornspeicher', slots: 2, at: { x: 69, y: 4 }, hiddenBy: 'korn', lucky: 3 },
];

/** Paths between scenes (both ways). */
export const LINKS: Array<[string, string]> = [
  ['r1-camp', 'r1-e1'], ['r1-e1', 'r1-e2'], ['r1-e1', 'r1-e3'], ['r1-e2', 'r1-e5'], ['r1-e5', 'r1-e7'], ['r1-e5', 'r1-e4'],
  ['r1-e3', 'r1-e6'], ['r1-e6', 'r1-e4'], ['r1-e4', 'r1-x'], ['r1-e3', 'r1-hide'],
  ['r1-x', 'r1-s1'], ['r1-s1', 'r1-s2'], ['r1-s1', 'r1-s5'], ['r1-s5', 'r1-s3'], ['r1-s2', 'r1-s7'], ['r1-s7', 'r1-s8'],
  ['r1-s2', 'r1-s8'], ['r1-s8', 'r1-s9'], ['r1-s3', 'r1-s6'], ['r1-s6', 'r1-s4'], ['r1-s9', 'r1-s4'],
  ['r1-x', 'r1-a1'], ['r1-a1', 'r1-a2'], ['r1-a2', 'r1-a5'], ['r1-a1', 'r1-a6'], ['r1-a6', 'r1-a3'], ['r1-a2', 'r1-a7'],
  ['r1-a7', 'r1-a3'], ['r1-a3', 'r1-a4'], ['r1-a7', 'r1-a4'],
  ['r1-x', 'r1-door'],
  ['r2-feuer', 'r2-stand'], ['r2-feuer', 'r2-baeck'], ['r2-feuer', 'r2-x'],
  ['r2-x', 'r2-g1'], ['r2-g1', 'r2-g5'], ['r2-g5', 'r2-g2'], ['r2-g2', 'r2-g6'], ['r2-g6', 'r2-g4'], ['r2-g1', 'r2-g3'],
  ['r2-g3', 'r2-g7'], ['r2-g3', 'r2-g4'],
  ['r2-x', 'r2-w1'], ['r2-w1', 'r2-w5'], ['r2-w1', 'r2-w6'], ['r2-w1', 'r2-w2'], ['r2-w2', 'r2-w7'], ['r2-w6', 'r2-w3'],
  ['r2-w3', 'r2-w8'], ['r2-w8', 'r2-w4'], ['r2-w2', 'r2-w4'],
  ['r2-x', 'r2-kx'], ['r2-kx', 'r2-k1'], ['r2-k1', 'r2-k5'], ['r2-k1', 'r2-k2'], ['r2-k5', 'r2-k6'], ['r2-kx', 'r2-k3'],
  ['r2-k3', 'r2-k7'], ['r2-k7', 'r2-k4'], ['r2-k3', 'r2-k4'],
  ['r2-k2', 'r2-door'], ['r2-k6', 'r2-door'], ['r2-k4', 'r2-door'], ['r2-k2', 'r2-hide'],
];

export const SCENE_BY_ID: Record<string, SceneDef> = Object.fromEntries(SCENES.map((s) => [s.id, s]));

export function scenesOf(region: RegionId): SceneDef[] {
  return SCENES.filter((s) => s.region === region);
}

export function neighbours(id: string): string[] {
  return LINKS.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
}

/** The scene closest to a pixel position (old saves, echoes, arrivals through doors). */
export function nearestScene(region: RegionId, px: number, py: number, ok: (s: SceneDef) => boolean = () => true): SceneDef {
  let best = scenesOf(region)[0];
  let bd = Infinity;
  for (const s of scenesOf(region)) {
    if (!ok(s)) continue;
    const d = Math.hypot(s.at.x * 16 + 8 - px, s.at.y * 16 + 8 - py);
    if (d < bd) (bd = d), (best = s);
  }
  return best;
}

/** Shortest path (scene ids, start excluded) over the scenes `ok` allows. */
export function routeTo(from: string, to: string, ok: (s: SceneDef) => boolean = () => true): string[] | null {
  if (from === to) return [];
  const prev = new Map<string, string>([[from, '']]);
  const q = [from];
  for (let i = 0; i < q.length; i++) {
    for (const n of neighbours(q[i])) {
      if (prev.has(n) || !ok(SCENE_BY_ID[n])) continue;
      prev.set(n, q[i]);
      if (n === to) {
        const path = [n];
        for (let c = q[i]; c !== from; c = prev.get(c)!) path.unshift(c);
        return path;
      }
      q.push(n);
    }
  }
  return null;
}
