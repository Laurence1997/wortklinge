"""People for the code-drawn monster looks: one chibi figure built from layers (hair, hat, clothes, prop).

A recipe is a list of key=value words, e.g. 'sex=f hair=y:long top=W:coat hat=nurse prop=syringe'.
Colours are palette characters (see build_drawn.PAL)."""
from artlib import blank, put, rect, stamp, outline, mirror, H

SKIN = {'1': 'm', '2': 'N', '3': 'n', '4': 'B'}
# darker step of a colour, for arms, folds and shadows
DARK = {'r': 'R', 'R': 'b', 'p': 'r', 'g': 's', 'G': 'g', 'l': 'G', 'y': 'Y', 'Y': 'B', 'w': 'N', 'n': 'B', 'N': 'n',
        'm': 'N', 'b': 'k', 'B': 'b', 's': 'k', 'S': 's', 'c': 'S', 'W': 'c', 'h': 'c', 'u': 's', 'U': 'u', 'v': 'k',
        'V': 'v', 'k': 's'}


def dk(c):
    return DARK.get(c, c)


# ---------------------------------------------------------------- props (right hand at x11, y12; drawn x11..14)
# Each prop: (x, y, rows). Rows use palette letters; '.' transparent.
PROPS = {
    'knife': (12, 8, ['.c', '.c', 'Wc', 'Wc', '.b', '.b']),
    'sword': (12, 4, ['.W', '.W', '.W', 'cW', 'cW', 'cW', 'yyy', '.b', '.b']),
    'wrench': (12, 7, ['S.S', 'SSS', '.S.', '.S.', '.S.', '.S.']),
    'hammer': (12, 7, ['sss', 'sss', '.b.', '.b.', '.b.', '.b.']),
    'brush': (12, 6, ['.r', '.r', '.w', '.n', '.n', '.n', '.n']),
    'pen': (13, 8, ['u', 'u', 'u', 'u', 'k']),
    'book': (12, 9, ['rrr', 'rWr', 'rWr', 'rrr']),
    'redbook': (12, 9, ['RRR', 'RyR', 'RRR', 'RRR']),
    'mic': (12, 7, ['ss', 'ss', '.k', '.k', '.k']),
    'camera': (12, 9, ['.k.', 'kkk', 'kuk', 'kkk']),
    'flag': (12, 4, ['rrr', 'rrr', 'k..', 'k..', 'k..', 'k..', 'k..', 'k..']),
    'cane': (12, 7, ['bb', '.b', '.b', '.b', '.b', '.b', '.b']),
    'wand': (12, 6, ['.y', 'yWy', '.y', '.b', '.b', '.b']),
    'staff': (12, 3, ['.V', 'VUV', '.V', '.b', '.b', '.b', '.b', '.b', '.b', '.b', '.b']),
    'case': (12, 11, ['.k.', 'bbb', 'bbb', 'bbb']),
    'bag': (12, 10, ['.b.', 'b.b', 'BBB', 'BBB']),
    'cup': (12, 10, ['WWc', 'WW.', 'WW.']),
    'beer': (12, 9, ['hhh', 'yyW', 'yyW', 'yy.']),
    'bread': (12, 9, ['.NN', 'NNn', 'NNn', 'nn.']),
    'baguette': (13, 5, ['N', 'N', 'n', 'N', 'N', 'n', 'N']),
    'scissors': (12, 8, ['c.c', '.c.', 'c.c', 'r.r']),
    'needle': (13, 6, ['c', 'c', 'c', 'c', 'u']),
    'broom': (13, 3, ['.b', '.b', '.b', '.b', '.b', '.b', 'yyy', 'yyy', 'Y.Y']),
    'ball': (12, 10, ['WkW', 'kWk', 'WkW']),
    'basketball': (12, 10, ['YYY', 'YkY', 'YYY']),
    'guitar': (12, 4, ['.b', '.b', '.b', '.b', 'NNN', 'NkN', 'NNN', 'NNN']),
    'spear': (13, 1, ['c', 'c', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b']),
    'gun': (12, 10, ['kkk', 'kk.', 'k..']),
    'rifle': (12, 3, ['.k', '.k', '.k', '.k', '.k', 'bk', 'bb', 'bb', '.b']),
    'clip': (12, 8, ['.k.', 'nnn', 'nWn', 'nWn', 'nWn', 'nnn']),
    'phone': (12, 9, ['kk', 'uk', 'uk', 'kk']),
    'key': (12, 7, ['yy', 'yy', '.y', '.y', 'yy', '.y']),
    'letter': (12, 10, ['WWW', 'WrW', 'WWW']),
    'tray': (11, 9, ['cccc', '.k..', '.k..']),
    'torch': (12, 5, ['.r', 'rY', 'yr', 'b.', 'b.', 'b.', 'b.']),
    'candle': (12, 7, ['.y', '.k', 'WW', 'WW', 'WW']),
    'scroll': (12, 8, ['ww', 'wN', 'wN', 'wN', 'ww']),
    'gavel': (11, 7, ['bbbb', 'bbbb', '.b..', '.b..', '.b..']),
    'tooth': (12, 9, ['WWW', 'WWW', 'W.W']),
    'bottle': (12, 6, ['.g', '.g', 'gg', 'gG', 'gg', 'gg']),
    'money': (12, 9, ['.k.', 'yyy', 'yky', 'yyy']),
    'trophy': (11, 8, ['yyyy', 'yyyy', '.yy.', '.YY.', 'YYYY']),
    'shovel': (13, 3, ['b', 'b', 'b', 'b', 'b', 'b', 'b', 'S', 'S']),
    'rake': (12, 3, ['.b', '.b', '.b', '.b', '.b', '.b', '.b', 'sss', 's.s']),
    'rod': (12, 2, ['..u', '.b.', '.b.', 'b..', 'b..', 'b..', 'b..', 'b..', 'b..', 'b..']),
    'axe': (12, 6, ['cc', 'cb', 'cb', '.b', '.b', '.b']),
    'pick': (11, 6, ['sss.', '.b.s', '.b..', '.b..', '.b..', '.b..']),
    'magnifier': (12, 7, ['kk.', 'UUk', 'UUk', 'kk.', '..b', '..b']),
    'syringe': (12, 6, ['.c', '.c', 'UU', 'UU', 'UU', 'kk']),
    'pill': (12, 10, ['rr', 'WW']),
    'baby': (11, 8, ['.mm.', 'mmmm', '.WW.', 'WWWW', 'WWW.']),
    'shield': (1, 8, ['ccc', 'cuc', 'cuc', '.c.']),
    'list': (12, 8, ['WWW', 'WkW', 'WWW', 'WkW', 'WWW']),
    'bouquet': (12, 6, ['rVr', 'yry', '.g.', '.g.', '.g.']),
    'rose': (12, 7, ['r', 'r', 'g', 'g', 'g']),
    'drum': (11, 10, ['WWWW', 'rrrr', 'rWWr', 'rrrr']),
    'violin': (12, 6, ['.b', '.b', 'Bb', 'BBB', 'Bk.', 'BBB']),
    'trumpet': (11, 8, ['y...', 'yyyy', '...y']),
    'baton': (12, 7, ['.W', '.W', '.W', 'b.']),
    'palette': (11, 9, ['nnnn', 'nrun', 'ngyn', '.nn.']),
    'film': (11, 8, ['kkkk', 'kWkW', 'kkkk']),
    'ticket': (11, 10, ['yyyy', 'ykyy']),
    'map': (11, 8, ['wwGw', 'wGww', 'Gwwu']),
    'compass': (12, 8, ['ccc', 'crc', 'ccc']),
    'lamp': (12, 6, ['kk.', 'yyk', 'yyk', 'kk.', '.k.']),
    'net': (12, 3, ['ccc', 'c.c', 'ccc', '.b.', '.b.', '.b.', '.b.', '.b.', '.b.']),
    'bone': (12, 8, ['W.W', '.W.', '.W.', 'W.W']),
    'paw': (12, 9, ['n.n', 'nnn', 'nnn']),
    'leaf': (12, 7, ['.G', 'Gg', 'Gg', 'b.']),
    'stethoscope': (5, 9, ['k....k', 'k....k', '.kkkk.', '...s..']),
    'chalk': (12, 9, ['ss', 'ss', 'ss']),
    'lantern': (12, 7, ['.k.', 'kyk', 'yYy', 'kkk']),
    'bomb': (12, 8, ['..y', '.k.', 'kkk', 'kkk']),
    'cocktail': (11, 7, ['VVVV', '.VV.', '..c.', '.cc.']),
    'coin': (12, 10, ['yy', 'yY']),
    'dice': (12, 9, ['WWW', 'WkW', 'WWW']),
    'cards': (11, 9, ['WWr.', 'WrWW', '.WWr']),
    'puppet': (11, 6, ['b..b', '.bb.', 'b..b', '.yy.', '.rr.']),
    'whip': (11, 6, ['..bb', '.b..', 'b...', 'b...', '.b..', '.b..']),
    'sickle': (11, 6, ['cc..', '...c', '...c', '..c.', '.b..', 'b...']),
    'chain': (12, 7, ['s.', '.s', 's.', '.s', 's.']),
    'hourglass': (12, 8, ['bbb', 'yWy', '.y.', 'yyy', 'bbb']),
    'globe': (12, 8, ['.uu', 'ugu', 'uug', '.b.']),
    'clapper': (11, 8, ['kWkW', 'kkkk', 'kkkk']),
    'skate': (11, 13, ['rrrr', 'k..k']),
    'boxglove': (11, 9, ['.rr', 'rrr', 'rrr', '.WW']),
    'dumbbell': (11, 10, ['k..k', 'kssk', 'k..k']),
    'bucket': (11, 10, ['.ss.', 'uuuu', 'uuuu', '.uu.']),
    'plug': (12, 8, ['k.k', 'WWW', 'WWW', '.k.', '.k.']),
    'laptop': (11, 9, ['ssss', 'sUUs', 'ssss', 'cccc']),
    'handcuff': (11, 9, ['.s.s', 's.s.', '.s.s']),
    'pipe': (12, 8, ['b.', 'b.', 'bbb', '.bb']),
    'sun': (11, 7, ['.y.y', 'yYYy', '.YY.', 'y..y']),
    'cross': (12, 6, ['.y.', 'yyy', '.y.', '.y.']),
    'heart': (11, 8, ['rr.rr', 'rrrrr', '.rrr.', '..r..']),
    'star': (12, 7, ['.y.', 'yyy', '.y.']),
    'note': (12, 6, ['.kk', '.k.', '.k.', 'kk.', 'kk.']),
    'bell': (12, 8, ['.y.', 'yyy', 'yyy', '.b.']),
    'tag': (11, 9, ['yyy.', 'ykyy', 'yyyy']),
    'bus': (10, 9, ['yyyyy', 'yUUUy', 'yyyyy', '.k.k.']),
    'plane': (11, 8, ['..c.', 'cccc', '..c.', '.cc.']),
    'ring': (12, 9, ['.u.', 'y.y', 'yyy']),
    'anchor': (11, 7, ['.yy.', '..y.', 'yyyy', '..y.', 'y.yy', '.yy.']),
    'tube': (12, 6, ['.c.', '.c.', '.c.', 'cGc', 'GGG', '.G.']),
    'mask': (11, 8, ['WWWW', 'kWkW', 'WWWW', '.WW.']),
    'whistle': (12, 8, ['yyy', 'yky', '.y.']),
    'bike': (10, 10, ['.k..k', 'k.kk.k', '.k..k']),
    'chart': (11, 8, ['W..r', 'W.rr', 'Wrrr', 'WWWW']),
    'bolt': (12, 5, ['.yy', 'yy.', 'yyy', '.yy', 'yy.', 'y..']),
    'bow': (12, 5, ['b.', '.b', '.b', '.b', '.b', 'b.']),
    'club': (12, 5, ['.nn', 'nnn', 'nnn', '.n.', '.n.', '.n.']),
    'flower': (12, 6, ['.V.', 'VyV', '.V.', '.g.', '.g.']),
    'wheel': (10, 8, ['..kkk', '.k...k', 'k..k..k', '.k...k', '..kkk']),
}


def prop_flag(colors):
    """A hand flag with up to 3 stripes (top to bottom)."""
    cs = (colors + colors[-1] * 3)[:3]
    return (12, 4, [cs[0] * 3, cs[1] * 3, cs[2] * 3, 'k..', 'k..', 'k..', 'k..', 'k..'])


def person(spec):
    """spec: dict of the recipe words."""
    g = blank()
    sex = spec.get('sex', 'm')
    age = spec.get('age', 'adult')
    skin = SKIN.get(spec.get('skin', '1'), spec.get('skin', 'm'))
    hair_c, _, hair_s = spec.get('hair', 'b:short').partition(':')
    hair_s = hair_s or ('long' if sex == 'f' else 'short')
    top_c, _, top_s = spec.get('top', 'u').partition(':')
    bot_c = spec.get('bot', 's' if sex == 'm' else top_c)
    dress = top_s in ('dress', 'robe', 'gown') or (sex == 'f' and spec.get('skirt') == '1')

    if age == 'baby':
        return baby(spec, skin, hair_c)

    # --- behind the body: cape, wings, long hair back
    if 'cape' in spec:
        c = spec['cape']
        rect(g, 3, 9, 12, 14, c)
    if 'wings' in spec:
        c = spec['wings']
        stamp(g, 0, 6, ['.ccc', 'cccc', 'ccc.', 'cc..', 'c...'], recolor={'c': c})
        stamp(g, 12, 6, mirror(['.ccc', 'cccc', 'ccc.', 'cc..', 'c...']), recolor={'c': c})
    if hair_s in ('long', 'wavy'):
        rect(g, 3, 4, 12, 10 if hair_s == 'long' else 11, hair_c)

    # --- head
    rect(g, 5, 2, 10, 2, hair_c)
    rect(g, 4, 3, 11, 7, skin)
    rect(g, 5, 8, 10, 8, skin)
    rect(g, 4, 3, 11, 3, hair_c)
    put(g, 4, 4, hair_c)
    put(g, 11, 4, hair_c)
    if hair_s == 'bald':
        rect(g, 5, 2, 10, 3, skin)
        put(g, 4, 4, hair_c if hair_c != skin else skin)
        put(g, 11, 4, hair_c if hair_c != skin else skin)
        put(g, 4, 3, skin)
        put(g, 11, 3, skin)
        put(g, 4, 4, hair_c)
        put(g, 11, 4, hair_c)
    elif hair_s == 'bun':
        rect(g, 7, 0, 8, 1, hair_c)
    elif hair_s == 'spiky':
        for x in (5, 7, 9):
            put(g, x, 1, hair_c)
        rect(g, 5, 4, 10, 4, hair_c)
        put(g, 6, 4, skin)
        put(g, 9, 4, skin)
    elif hair_s == 'fringe':
        rect(g, 5, 4, 10, 4, hair_c)
    elif hair_s == 'pony':
        rect(g, 12, 3, 12, 7, hair_c)
        put(g, 13, 4, hair_c)
    elif hair_s == 'pigtails':
        rect(g, 2, 4, 3, 6, hair_c)
        rect(g, 12, 4, 13, 6, hair_c)
    elif hair_s == 'afro':
        rect(g, 3, 1, 12, 3, hair_c)
        rect(g, 3, 4, 3, 6, hair_c)
        rect(g, 12, 4, 12, 6, hair_c)
    elif hair_s == 'mohawk':
        rect(g, 7, 0, 8, 3, hair_c)
        rect(g, 5, 2, 6, 3, skin)
        rect(g, 9, 2, 10, 3, skin)
        rect(g, 4, 3, 4, 4, skin)
        rect(g, 11, 3, 11, 4, skin)
    elif hair_s in ('long', 'wavy'):
        rect(g, 5, 4, 10, 4, hair_c)
        put(g, 6, 4, hair_c)
    elif hair_s == 'side':
        rect(g, 4, 4, 7, 4, hair_c)
    # eyes
    if 'closed' in spec:
        put(g, 6, 6, 'k')
        put(g, 9, 6, 'k')
    else:
        rect(g, 6, 5, 6, 6, 'k')
        rect(g, 9, 5, 9, 6, 'k')
    if spec.get('cheeks', '1' if sex == 'f' else '0') == '1':
        put(g, 5, 7, 'p')
        put(g, 10, 7, 'p')
    mouth = spec.get('mouth', '')
    if mouth == 'smile':
        put(g, 7, 7, 'k')
        put(g, 8, 7, 'k')
    elif mouth == 'open':
        put(g, 7, 7, 'R')
        put(g, 8, 7, 'R')
    elif mouth == 'frown':
        put(g, 7, 8, 'k')
        put(g, 8, 8, 'k')
    elif mouth == 'fang':
        put(g, 7, 7, 'h')
        put(g, 8, 7, 'h')
    # face extras
    beard = spec.get('beard')
    if beard:
        bc = beard if beard not in '1' else hair_c
        rect(g, 4, 7, 4, 8, bc)
        rect(g, 11, 7, 11, 8, bc)
        rect(g, 5, 8, 10, 9, bc)
        rect(g, 6, 7, 9, 7, bc)
    if spec.get('stache'):
        rect(g, 6, 7, 9, 7, spec['stache'] if spec['stache'] != '1' else hair_c)
    if spec.get('glasses'):
        gc = spec['glasses'] if spec['glasses'] not in ('1', 'sun') else 'k'
        for x in (5, 7, 8, 10):
            put(g, x, 5, gc)
        rect(g, 5, 4, 10, 4, gc) if spec.get('glasses') == 'sun' else None
    if spec.get('shades'):
        rect(g, 5, 5, 10, 5, 'k')
        rect(g, 5, 6, 7, 6, 'k')
        rect(g, 8, 6, 10, 6, 'k')
    if spec.get('patch'):
        rect(g, 8, 4, 10, 6, 'k')
        rect(g, 4, 4, 11, 4, 'k') if False else None
    if spec.get('mask'):
        rect(g, 5, 7, 10, 8, spec['mask'])
    if spec.get('bandit'):
        rect(g, 4, 5, 11, 6, 'k')
        put(g, 6, 5, 'h')
        put(g, 9, 5, 'h')
    if spec.get('face') == 'green':
        for y in range(3, 9):
            for x in range(4, 12):
                if g[y][x] == skin:
                    g[y][x] = 'G'
    if spec.get('face') == 'pale':
        for y in range(3, 9):
            for x in range(4, 12):
                if g[y][x] == skin:
                    g[y][x] = 'c'
    if spec.get('face') == 'red':
        for y in range(3, 9):
            for x in range(4, 12):
                if g[y][x] == skin:
                    g[y][x] = 'r'

    # --- body
    by = 9
    tc, ac = top_c, spec.get('arm', top_c)
    rect(g, 5, by, 10, by + 3, tc)
    rect(g, 4, by + 1, 4, by + 2, ac)
    rect(g, 11, by + 1, 11, by + 2, ac)
    put(g, 4, by + 3, skin)
    put(g, 11, by + 3, skin)
    if top_s == 'coat':  # open coat over an inner colour
        inner = spec.get('inner', 'u')
        rect(g, 7, by, 8, by + 3, inner)
    elif top_s == 'suit':
        rect(g, 7, by, 8, by + 1, 'W')
        put(g, 7, by + 1, spec.get('tie', 'r'))
        put(g, 8, by + 1, spec.get('tie', 'r'))
        put(g, 7, by + 2, spec.get('tie', 'r'))
        put(g, 8, by + 2, spec.get('tie', 'r'))
    elif top_s == 'stripe':
        sc = spec.get('stripe', 'W')
        rect(g, 4, by + 1, 11, by + 1, sc)
        rect(g, 5, by + 3, 10, by + 3, sc)
    elif top_s == 'apron':
        rect(g, 6, by + 1, 9, by + 4, spec.get('apron', 'W'))
        put(g, 6, by, spec.get('apron', 'W'))
        put(g, 9, by, spec.get('apron', 'W'))
    elif top_s == 'vest':
        rect(g, 5, by, 6, by + 3, spec.get('vest', 'y'))
        rect(g, 9, by, 10, by + 3, spec.get('vest', 'y'))
    elif top_s == 'armor':
        rect(g, 5, by + 1, 10, by + 1, 'c')
        put(g, 4, by + 1, 'c')
        put(g, 11, by + 1, 'c')
    elif top_s == 'overall':
        rect(g, 6, by + 1, 9, by + 3, spec.get('over', 'u'))
        put(g, 6, by, spec.get('over', 'u'))
        put(g, 9, by, spec.get('over', 'u'))
    elif top_s == 'jersey':
        put(g, 7, by + 1, 'W')
        put(g, 8, by + 1, 'W')
        put(g, 7, by + 2, 'W')
        put(g, 8, by + 2, 'W')
    if 'badge' in spec:
        put(g, 9, by + 1, spec['badge'])
    if 'belt' in spec:
        rect(g, 5, by + 3, 10, by + 3, spec['belt'])
    if 'collar' in spec:
        put(g, 7, by, spec['collar'])
        put(g, 8, by, spec['collar'])
    if 'scarf' in spec:
        rect(g, 5, by, 10, by, spec['scarf'])
        put(g, 9, by + 1, spec['scarf'])
    if 'chest' in spec:  # a symbol on the chest
        sym = spec['chest']
        put(g, 7, by + 1, sym)
        put(g, 8, by + 1, sym)
        put(g, 7, by + 2, sym)
        put(g, 8, by + 2, sym)
    if 'redcross' in spec:
        put(g, 7, by + 1, 'r')
        put(g, 8, by + 1, 'r')
        put(g, 6, by + 1, 'r') if False else None
        put(g, 7, by + 2, 'r')
        put(g, 8, by + 2, 'r')
        put(g, 7, by, 'r') if False else None
    # legs
    if top_s in ('robe', 'gown'):
        rect(g, 4, by + 4, 11, by + 5, tc)
        put(g, 4, by + 3, tc) if top_s == 'gown' else None
        put(g, 11, by + 3, tc) if top_s == 'gown' else None
        put(g, 4, by + 3, skin)
        put(g, 11, by + 3, skin)
    elif dress:
        rect(g, 4, by + 3, 11, by + 4, bot_c if spec.get('bot') else tc)
        put(g, 4, by + 3, skin)
        put(g, 11, by + 3, skin)
        put(g, 6, by + 5, skin)
        put(g, 9, by + 5, skin)
    else:
        rect(g, 5, by + 4, 10, by + 4, bot_c)
        rect(g, 5, by + 5, 6, by + 5, spec.get('shoe', bot_c))
        rect(g, 9, by + 5, 10, by + 5, spec.get('shoe', bot_c))
    if top_s == 'kilt':
        rect(g, 4, by + 4, 11, by + 4, 'r')

    # --- hat
    hat = spec.get('hat')
    if hat:
        hat_c, _, hat_k = hat.partition(':')
        if not hat_k:
            hat_k, hat_c = hat_c, None
        draw_hat(g, hat_k, hat_c, hair_c, skin)
    if spec.get('halo'):
        rect(g, 5, 0, 10, 0, 'y')
    if spec.get('horns'):
        hc = spec['horns'] if spec['horns'] != '1' else 'c'
        put(g, 4, 1, hc)
        put(g, 4, 2, hc)
        put(g, 11, 1, hc)
        put(g, 11, 2, hc)
        put(g, 3, 0, hc)
        put(g, 12, 0, hc)
    if spec.get('ears') == 'pointy':
        put(g, 3, 5, skin)
        put(g, 12, 5, skin)
        put(g, 3, 4, skin)
        put(g, 12, 4, skin)
    if spec.get('earring'):
        put(g, 4, 8, spec['earring'])
        put(g, 11, 8, spec['earring'])

    # --- props
    p = spec.get('prop')
    if p:
        for one in p.split('+'):
            if one.startswith('flag'):
                x, y, rows = prop_flag(one[5:] or 'r')
            else:
                x, y, rows = PROPS[one]
            stamp(g, x, y, rows)
    if spec.get('left'):
        for one in spec['left'].split('+'):
            x, y, rows = PROPS[one]
            if x >= 10:
                rows = mirror(rows)
                x = 15 - x - max(len(r) for r in rows) + 1
            stamp(g, x, y, rows)

    if age == 'kid':
        g = shrink_kid(g)
    elif age == 'old':
        pass
    if spec.get('dark'):
        g = [[('k' if c not in '.' else c) for c in r] for r in g]
    return outline(g)


def draw_hat(g, kind, c, hair_c, skin):
    if kind == 'cap':
        c = c or 'r'
        rect(g, 5, 1, 10, 2, c)
        rect(g, 4, 3, 13, 3, c)
        rect(g, 4, 2, 11, 2, c)
    elif kind == 'police':
        c = c or 'u'
        rect(g, 5, 0, 10, 1, c)
        rect(g, 4, 2, 11, 2, c)
        rect(g, 4, 3, 11, 3, 'k')
        put(g, 7, 1, 'y')
        put(g, 8, 1, 'y')
    elif kind == 'chef':
        rect(g, 5, 0, 10, 2, 'W')
        rect(g, 4, 1, 11, 1, 'W')
        rect(g, 5, 3, 10, 3, 'c')
        rect(g, 4, 3, 4, 3, hair_c)
    elif kind == 'crown':
        c = c or 'y'
        for x in (4, 7, 8, 11):
            put(g, x, 0, c)
        rect(g, 4, 1, 11, 2, c)
        put(g, 7, 1, 'r')
        put(g, 8, 1, 'r')
        put(g, 5, 2, 'u')
        put(g, 10, 2, 'u')
    elif kind == 'tiara':
        rect(g, 5, 2, 10, 2, 'y')
        put(g, 7, 1, 'y')
        put(g, 8, 1, 'u')
    elif kind == 'top':
        c = c or 'k'
        rect(g, 6, 0, 9, 2, c)
        rect(g, 4, 3, 11, 3, c)
        rect(g, 6, 2, 9, 2, 'r' if c == 'k' else 'k')
    elif kind == 'helmet':
        c = c or 'c'
        rect(g, 5, 1, 10, 1, c)
        rect(g, 4, 2, 11, 4, c)
        rect(g, 4, 5, 4, 7, c)
        rect(g, 11, 5, 11, 7, c)
    elif kind == 'knight':
        c = c or 'c'
        rect(g, 4, 1, 11, 8, c)
        rect(g, 5, 5, 10, 5, 'k')
        rect(g, 7, 6, 8, 8, c)
        put(g, 7, 0, 'r')
        put(g, 8, 0, 'r')
    elif kind == 'witch':
        c = c or 'v'
        put(g, 10, 0, c)
        rect(g, 8, 1, 10, 1, c)
        rect(g, 6, 2, 10, 2, c)
        rect(g, 3, 3, 12, 3, c)
        put(g, 7, 2, 'y')
    elif kind == 'wizard':
        c = c or 'u'
        put(g, 7, 0, c)
        put(g, 8, 0, c)
        rect(g, 6, 1, 9, 1, c)
        rect(g, 5, 2, 10, 2, c)
        rect(g, 3, 3, 12, 3, c)
        put(g, 8, 1, 'y')
    elif kind in ('hood', 'scarf', 'veil', 'nun'):
        c = c or ('k' if kind == 'nun' else 's')
        rect(g, 4, 1, 11, 2, c)
        rect(g, 3, 3, 4, 9 if kind != 'scarf' else 8, c)
        rect(g, 11, 3, 12, 9 if kind != 'scarf' else 8, c)
        rect(g, 4, 3, 11, 3, c)
        rect(g, 5, 2, 10, 2, c)
        if kind == 'nun':
            rect(g, 5, 3, 10, 3, 'W')
        if kind == 'veil':
            rect(g, 2, 3, 2, 12, c)
            rect(g, 13, 3, 13, 12, c)
    elif kind == 'nurse':
        rect(g, 5, 1, 10, 2, 'W')
        put(g, 7, 1, 'r')
        put(g, 8, 1, 'r')
    elif kind == 'cowboy':
        c = c or 'B'
        rect(g, 5, 0, 10, 2, c)
        rect(g, 2, 3, 13, 3, c)
        put(g, 7, 0, '.')
        put(g, 8, 0, '.')
        rect(g, 5, 2, 10, 2, 'b')
    elif kind == 'beret':
        c = c or 'k'
        rect(g, 4, 1, 10, 2, c)
        put(g, 8, 0, c)
    elif kind == 'grad':
        rect(g, 3, 1, 12, 1, 'k')
        rect(g, 5, 2, 10, 2, 'k')
        rect(g, 12, 2, 12, 4, 'y')
    elif kind == 'bandana':
        c = c or 'r'
        rect(g, 4, 2, 11, 3, c)
        put(g, 12, 3, c)
        put(g, 13, 4, c)
    elif kind == 'hard':
        c = c or 'y'
        rect(g, 5, 0, 10, 2, c)
        rect(g, 3, 3, 12, 3, c)
        put(g, 7, 0, 'Y')
        put(g, 8, 1, 'Y')
    elif kind == 'turban':
        c = c or 'W'
        rect(g, 4, 0, 11, 3, c)
        put(g, 7, 2, 'r')
        put(g, 8, 2, 'r')
    elif kind == 'mitre':
        rect(g, 7, 0, 8, 0, 'W')
        rect(g, 6, 1, 9, 1, 'W')
        rect(g, 5, 2, 10, 3, 'W')
        put(g, 7, 2, 'y')
        put(g, 8, 2, 'y')
        put(g, 7, 1, 'y')
    elif kind == 'red':  # cardinal skullcap
        rect(g, 6, 1, 9, 2, 'r')
    elif kind == 'phones':
        rect(g, 4, 1, 11, 1, 'k')
        rect(g, 3, 4, 3, 6, 'r')
        rect(g, 12, 4, 12, 6, 'r')
    elif kind == 'pilot':
        c = c or 'b'
        rect(g, 5, 1, 10, 2, c)
        rect(g, 4, 3, 11, 3, c)
        rect(g, 5, 2, 10, 2, 'U')
        put(g, 7, 2, 'k')
        put(g, 8, 2, 'k')
    elif kind == 'captain':
        rect(g, 5, 0, 10, 1, 'W')
        rect(g, 4, 2, 11, 2, 'W')
        rect(g, 4, 3, 11, 3, 'k')
        put(g, 7, 1, 'y')
        put(g, 8, 1, 'y')
    elif kind == 'sailor':
        rect(g, 5, 1, 10, 2, 'W')
        rect(g, 4, 3, 11, 3, 'u')
    elif kind == 'santa':
        rect(g, 5, 1, 10, 2, 'r')
        rect(g, 4, 3, 11, 3, 'W')
        put(g, 11, 1, 'r')
        put(g, 12, 2, 'W')
    elif kind == 'army':
        c = c or 'g'
        rect(g, 5, 1, 10, 1, c)
        rect(g, 4, 2, 11, 3, c)
        put(g, 6, 2, 'G')
        put(g, 9, 1, 'G')
    elif kind == 'beanie':
        c = c or 'r'
        rect(g, 5, 1, 10, 1, c)
        rect(g, 4, 2, 11, 3, c)
        put(g, 7, 0, 'W')
        put(g, 8, 0, 'W')
    elif kind == 'jester':
        rect(g, 4, 2, 11, 3, 'r')
        rect(g, 6, 2, 9, 3, 'y')
        put(g, 3, 1, 'r')
        put(g, 12, 1, 'y')
        put(g, 2, 0, 'y')
        put(g, 13, 0, 'r')
    elif kind == 'feather':
        c = c or 'g'
        rect(g, 4, 2, 11, 3, c)
        put(g, 11, 1, 'r')
        put(g, 12, 0, 'r')
    elif kind == 'flower':
        put(g, 10, 2, 'V')
        put(g, 11, 2, 'y')
        put(g, 10, 3, 'V')
    elif kind == 'helmrace':
        c = c or 'r'
        rect(g, 4, 1, 11, 4, c)
        rect(g, 5, 5, 10, 6, 'U')
        rect(g, 4, 5, 4, 7, c)
        rect(g, 11, 5, 11, 7, c)
    elif kind == 'space':
        rect(g, 3, 1, 12, 9, 'W')
        rect(g, 5, 3, 10, 7, 'U')
        put(g, 6, 5, 'k')
        put(g, 9, 5, 'k')
    elif kind == 'feathers':  # chief headdress
        for x in range(3, 13, 2):
            put(g, x, 1, 'r' if x % 4 == 1 else 'y')
            put(g, x, 0, 'W')
        rect(g, 4, 2, 11, 2, 'y')
    elif kind == 'fez':
        rect(g, 6, 1, 9, 2, 'r')
        put(g, 9, 0, 'k')
    elif kind == 'kippa':
        rect(g, 6, 2, 9, 2, 'u')
    elif kind == 'laurel':
        rect(g, 4, 3, 5, 3, 'g')
        rect(g, 10, 3, 11, 3, 'g')
        rect(g, 6, 2, 9, 2, 'g')
    elif kind == 'pharaoh':
        rect(g, 4, 1, 11, 3, 'y')
        rect(g, 3, 3, 4, 9, 'y')
        rect(g, 11, 3, 12, 9, 'y')
        for y in (2, 4, 6, 8):
            put(g, 3 if y > 3 else 5, y, 'u')
            put(g, 12 if y > 3 else 10, y, 'u')
        put(g, 7, 1, 'r')
        put(g, 8, 1, 'r')


def shrink_kid(g):
    """Child: keep the head, cut two body rows, sit it on row 14."""
    rows = [list(r) for r in g]
    keep = rows[:12] + rows[13:14] + rows[15:16]  # drop row 12 (a body row) and 14 (a leg row)
    # put a 2-row gap on top so the figure stands on row 14
    out = [['.'] * 16 for _ in range(2)] + keep
    return [r[:] for r in out[:16]]


def baby(spec, skin, hair_c):
    g = blank()
    wrap = spec.get('top', 'U').split(':')[0]
    rect(g, 4, 4, 11, 9, skin)
    rect(g, 5, 3, 10, 10, skin)
    put(g, 7, 2, hair_c)
    put(g, 8, 3, hair_c)
    rect(g, 6, 6, 6, 6, 'k')
    rect(g, 9, 6, 9, 6, 'k')
    put(g, 5, 8, 'p')
    put(g, 10, 8, 'p')
    rect(g, 7, 8, 8, 8, spec.get('dummy', 'r'))
    rect(g, 4, 11, 11, 13, wrap)
    rect(g, 5, 14, 10, 14, wrap)
    put(g, 4, 11, skin)
    put(g, 11, 11, skin)
    return outline(g)


def group(specs, kind='duo'):
    """Two or three small people side by side (Eltern, Paar, Band …): full figures, squeezed."""
    figs = [person(dict(s)) for s in specs]
    out = blank()
    # take columns 3..12 of each figure, scaled down by dropping every other column/row
    def small(f):
        rows = [f[y] for y in (0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15)]
        cols = [3, 4, 5, 6, 8, 9, 11, 12]
        return [[r[x] for x in cols] for r in rows]
    if len(figs) == 2:
        offs = [0, 8]
    else:
        offs = [0, 5, 10]
    for f, ox in zip(figs, offs):
        sm = small(f)
        sm = [r[:6] + r[7:] if len(figs) == 3 else r for r in sm]
        for y, r in enumerate(sm):
            for x, ch in enumerate(r):
                if ch != '.':
                    put(out, ox + x, y + 1, ch)
    return out
