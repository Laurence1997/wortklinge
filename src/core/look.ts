// Character looks (联机第一档): shape first, one accent colour (the hair) in the red-black palette.

export interface Look {
  gender: 0 | 1;
  body: 0 | 1 | 2;
  hair: 0 | 1 | 2 | 3;
  color: 0 | 1 | 2 | 3 | 4 | 5;
}

export const DEFAULT_LOOK: Look = { gender: 0, body: 1, hair: 0, color: 0 };

export const LOOK_OPTIONS: { [K in keyof Look]: { zh: string; options: string[] } } = {
  gender: { zh: '性别', options: ['男', '女'] },
  body: { zh: '体型', options: ['瘦', '中', '壮'] },
  hair: { zh: '发型', options: ['短发', '长发', '刺头', '马尾'] },
  color: { zh: '发色', options: ['黑', '血红', '灰白', '暗金', '铁蓝', '紫'] },
};

export const HAIR_COLORS = ['#2a1a1a', '#c8242f', '#cfc6bc', '#b8892a', '#4f6488', '#74358a'];

export function lookKey(l: Look): string {
  return `${l.gender}${l.body}${l.hair}${l.color}`;
}

export function validLook(x: unknown): Look | null {
  if (!x || typeof x !== 'object') return null;
  const l = x as Record<string, unknown>;
  const ok = (k: keyof Look) => Number.isInteger(l[k]) && (l[k] as number) >= 0 && (l[k] as number) < LOOK_OPTIONS[k].options.length;
  return ok('gender') && ok('body') && ok('hair') && ok('color') ? (l as unknown as Look) : null;
}
