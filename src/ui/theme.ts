// 明亮画风 (Lucas 11-26 选 1): on a bright daily map the route lines, scene circles, HUD and every panel take the
// region's own main colour; dark red stays for 蚀变 maps, bosses and 零号站台 (body without .bright).

/** Each region's accent, picked from its bright map (src/game/sprites.ts BRIGHT): roofs, tint and light. */
export const REGION_ACCENT: Record<number, string> = {
  1: '#d2691e', // 余烬营地: ember orange of the camp fire and tents
  2: '#c08a1e', // 面包集市: wheat gold
  3: '#b5532c', // 铁轨镇: rust and brick
  4: '#2f6fae', // 租屋城: blue roofs
  5: '#c9507a', // 泉疗镇: flower pink
  6: '#2a86b4', // 雾港: sea blue
  7: '#a8862a', // 印章城: seal gold
  8: '#5f8f35', // 8 区: green
  9: '#cc6526', // 工坊城: evening orange
  10: '#6559c4', // 电波塔: violet
  11: '#2f8c78', // 11 区: teal
  12: '#c04a7c', // 心巷: rose
  // B2 (美术小修 A, 2026-11-26); 15 and 19 are 蚀变 maps and stay dark.
  13: '#3a6fa8', // 议会堡: limestone blue
  14: '#b8860b', // 铸币场: coin gold
  16: '#a8409e', // 面具剧场: magenta evening
  17: '#8a5a2b', // 档案深处: parchment brown
  18: '#4f7d96', // 天平庭: cold marble blue-grey
  20: '#6b7178', // 沉默之心: pale, almost colourless
};

export function accentOf(region: number): string {
  return REGION_ACCENT[region] ?? '#d2691e';
}

/** Called when a map is drawn: turns the bright theme on or off and sets the accent. */
export function applyTheme(bright: boolean, region: number): void {
  document.body.classList.toggle('bright', bright);
  if (bright) document.body.style.setProperty('--accent', accentOf(region));
  else document.body.style.removeProperty('--accent');
}
