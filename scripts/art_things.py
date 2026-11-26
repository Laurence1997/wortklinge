"""Things for the code-drawn monster looks: buildings, rooms, flags, papers, cards, bottles, signs and vehicles.

Every family draws a base and puts one symbol (GLYPHS) on it, so 机场, 药店, 税务局 share a building shape but read
apart by the sign. Windows, labels and screens carry the eyes, as in the hand-drawn sprites."""
from artlib import blank, put, rect, stamp, outline, eyes, mirror

# 5×5 symbols; 'x' = the glyph colour (given per use), other letters are fixed palette colours.
GLYPHS = {
    'cross': ['.xxx.', '.xxx.', 'xxxxx', '.xxx.', '.xxx.'],
    'plus': ['..x..', '..x..', 'xxxxx', '..x..', '..x..'],
    'xcross': ['x...x', '.x.x.', '..x..', '.x.x.', 'x...x'],
    'euro': ['.xxx.', 'x....', 'xxxx.', 'x....', '.xxx.'],
    'dollar': ['.xxx.', 'x.x..', '.xxx.', '..x.x', '.xxx.'],
    'star': ['..x..', '.xxx.', 'xxxxx', '.xxx.', '.x.x.'],
    'heart': ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'],
    'note': ['..xxx', '..x.x', '..x.x', 'xxx.x', 'xx..x'],
    'book': ['xx.xx', 'xWxWx', 'xWxWx', 'xWxWx', 'xx.xx'],
    'bell': ['..x..', '.xxx.', '.xxx.', 'xxxxx', '..x..'],
    'clock': ['.xxx.', 'xWkWx', 'xWkkx', 'xWWWx', '.xxx.'],
    'crown': ['x.x.x', 'xxxxx', 'xrxux', 'xxxxx', '.....'],
    'fork': ['x.x.c', 'x.x.c', 'xxx.c', '.x.cc', '.x..c'],
    'tooth': ['xxxxx', 'xxxxx', 'xxxxx', 'xx.xx', 'x...x'],
    'paw': ['x.x.x', '.....', '.xxx.', 'xxxxx', '.xxx.'],
    'pill': ['..xxx', '.xxxx', 'xxWW.', 'xWWW.', 'WWW..'],
    'key': ['xx...', 'x.x..', 'xx...', '.xxxx', '...x.'],
    'flame': ['..x..', '.xx..', '.xyx.', 'xyyxx', '.xyx.'],
    'wave': ['.x...', 'x.x.x', '...x.', '.x...', 'x.x.x'],
    'tree': ['.xxx.', 'xxxxx', 'xxxxx', '.xxx.', '..b..'],
    'letter': ['xxxxx', 'xx.xx', 'x.x.x', 'x...x', 'xxxxx'],
    'phone': ['.xxx.', 'xx.xx', '..x..', '.x.x.', '.xxx.'],
    'gear': ['.x.x.', 'xxxxx', '.x.x.', 'xxxxx', '.x.x.'],
    'wrench': ['x.x..', 'xxx..', '.xx..', '..xx.', '...xx'],
    'scissors': ['x...x', '.x.x.', '..x..', 'xx.xx', 'xx.xx'],
    'bread': ['.xxx.', 'xxxxx', 'xnxnx', 'xxxxx', '.....'],
    'sausage': ['.....', 'xxxx.', 'xxxxx', '.xxxx', '.....'],
    'camera': ['.xx..', 'xxxxx', 'xxWxx', 'xWkWx', 'xxxxx'],
    'plane': ['..x..', '.xxx.', 'xxxxx', '..x..', '.xxx.'],
    'train': ['xxxxx', 'xWxWx', 'xxxxx', 'xxxxx', 'k.k.k'],
    'bus': ['xxxxx', 'xWWWx', 'xxxxx', 'xxxxx', '.k.k.'],
    'car': ['.xxx.', 'xWxWx', 'xxxxx', '.k.k.', '.....'],
    'ball': ['.xkx.', 'xkxkx', 'kxkxk', 'xkxkx', '.xkx.'],
    'film': ['xkxkx', 'xxxxx', 'xWxWx', 'xxxxx', 'xkxkx'],
    'mask': ['xx.xx', 'xkxkx', 'xxxxx', 'x.k.x', '.xxx.'],
    'dumbbell': ['x...x', 'x...x', 'xxxxx', 'x...x', 'x...x'],
    'H': ['x...x', 'x...x', 'xxxxx', 'x...x', 'x...x'],
    'P': ['xxxx.', 'x...x', 'xxxx.', 'x....', 'x....'],
    'U': ['x...x', 'x...x', 'x...x', 'x...x', '.xxx.'],
    'S': ['.xxxx', 'x....', '.xxx.', '....x', 'xxxx.'],
    'i': ['..x..', '.....', '.xx..', '..x..', '.xxx.'],
    'para': ['.xxx.', 'x....', '.xxx.', 'x...x', '.xxx.'],  # §
    'cup': ['.....', 'xxxx.', 'xxxxx', 'xxxx.', '.xx..'],
    'beer': ['WWWW.', 'xxxxx', 'xxxxx', 'xxxx.', 'xxxx.'],
    'wine': ['xxxxx', 'xxxxx', '.xxx.', '..x..', '.xxx.'],
    'bed': ['x....', 'xWWxx', 'xxxxx', 'x...x', '.....'],
    'fish': ['.....', '.xxx.', 'xxkxx', '.xxx.', '.....'],
    'meat': ['.xxx.', 'xxWxx', 'xxxxx', '.xx..', '..WW.'],
    'flower': ['.x.x.', 'xxyxx', '.x.x.', '..g..', '..g..'],
    'pen': ['....x', '...xx', '..xx.', '.xx..', 'k....'],
    'eye': ['.....', '.xxx.', 'xxkxx', '.xxx.', '.....'],
    'check': ['....x', '...xx', 'x.xx.', 'xxx..', '.x...'],
    'bolt': ['..xx.', '.xx..', 'xxxx.', '..xx.', '.xx..'],
    'drop': ['..x..', '.xxx.', 'xxxxx', 'xxxxx', '.xxx.'],
    'leaf': ['...xx', '.xxxx', 'xxxx.', 'xxx..', 'x....'],
    'anchor': ['..x..', 'xxxxx', '..x..', 'x.x.x', '.xxx.'],
    'mountain': ['.....', '..x..', '.xxx.', 'xxxxx', 'xxxxx'],
    'sun': ['x.x.x', '.xxx.', 'xxxxx', '.xxx.', 'x.x.x'],
    'moon': ['.xx..', 'xx...', 'xx...', 'xx...', '.xx..'],
    'home': ['..x..', '.xxx.', 'xxxxx', '.xWx.', '.xWx.'],
    'scale': ['..x..', 'xxxxx', 'x.x.x', 'x.x.x', '.xxx.'],
    'cap': ['..x..', 'xxxxx', '.xxx.', '.xxxy', '....y'],
    'tube': ['.x.x.', '.x.x.', '.xyx.', 'xyyyx', '.xxx.'],
    'screen': ['xxxxx', 'xUUUx', 'xxxxx', '..x..', '.xxx.'],
    'cart': ['x....', 'xxxxx', '.xxxx', '.xxx.', '.k.k.'],
    'hanger': ['..x..', '...x.', '.xxx.', 'x...x', 'xxxxx'],
    'bag': ['.x.x.', 'xxxxx', 'xxxxx', 'xxxxx', 'xxxxx'],
    'shield': ['xxxxx', 'xxyxx', 'xyyyx', '.xxx.', '..x..'],
    'arrow': ['..x..', '.xxx.', 'xxxxx', '..x..', '..x..'],
    'exit': ['..x..', '...x.', 'xxxxx', '...x.', '..x..'],
    'baby': ['.xxx.', 'xkxkx', 'xxxxx', '.xrx.', '.....'],
    'person': ['.xxx.', '.xxx.', '..x..', 'xxxxx', '.x.x.'],
    'people': ['x.x.x', 'x.x.x', '.....', 'xxxxx', 'xxxxx'],
    'globe': ['.xxx.', 'xgxxg', 'xggxx', 'xxgxx', '.xxx.'],
    'music': ['.xxxx', '.x..x', '.x..x', 'xx.xx', 'xx.xx'],
    'shirt': ['xx.xx', 'xxxxx', '.xxx.', '.xxx.', '.xxx.'],
    'shoe': ['.....', 'x....', 'xx...', 'xxxxx', 'kkkkk'],
    'pin': ['.xxx.', 'xxWxx', 'xxxxx', '.xxx.', '..x..'],
    'lock': ['.xxx.', '.x.x.', 'xxxxx', 'xxkxx', 'xxxxx'],
    'skull': ['.xxx.', 'xkxkx', 'xxxxx', '.xkx.', '.x.x.'],
    'stethoscope': ['x...x', 'x...x', '.x.x.', '..x..', '..xxx'],
    'paint': ['.xxx.', 'xrxux', 'xxxgx', 'xyxx.', '.xx..'],
    'swim': ['.....', '...x.', '.xxx.', 'x.x.x', '.x.x.'],
    'ticket': ['xxxxx', 'x.x.x', 'xxxxx', 'x.x.x', 'xxxxx'],
    'chart': ['....x', '...xx', '.x.xx', 'xx.xx', 'xxxxx'],
    'ring': ['..y..', '.x.x.', 'x...x', 'x...x', '.xxx.'],
    'bottle': ['..x..', '..x..', '.xxx.', '.xWx.', '.xxx.'],
    'hammer': ['xxxx.', 'xxxx.', '..b..', '..b..', '..b..'],
    'tent': ['..x..', '.xxx.', '.xkx.', 'xxkxx', 'xxkxx'],
    'boat': ['..x..', '..xx.', '..x..', 'xxxxx', '.xxx.'],
    'num1': ['..x..', '.xx..', '..x..', '..x..', '.xxx.'],
    'dice': ['xxxxx', 'xkxxx', 'xxkxx', 'xxxkx', 'xxxxx'],
    'cards': ['xxx..', 'xrxx.', 'xxxxx', '.xxrx', '..xxx'],
    'gun': ['xxxxx', 'xxxxx', 'xx...', 'x....', '.....'],
    'microphone': ['.xx..', '.xx..', '.xx..', '..x..', '.xxx.'],
    'wheel': ['.xxx.', 'xkxkx', 'xxkxx', 'xkxkx', '.xxx.'],
    'snow': ['x.x.x', '.xxx.', 'xxxxx', '.xxx.', 'x.x.x'],
    'cloud': ['.....', '.xx..', 'xxxx.', 'xxxxx', '.....'],
    'tram': ['..x..', 'xxxxx', 'xWxWx', 'xxxxx', 'k...k'],
    'bike': ['..xx.', '.x.x.', 'xxkxx', 'x.x.x', '.x.x.'],
    'face': ['.xxx.', 'xkxkx', 'xxxxx', 'x.x.x', '.xxx.'],
    'hand': ['.x.x.', 'xxxxx', 'xxxxx', 'xxxx.', '.xx..'],
    'fist': ['.....', 'xxxx.', 'xxxxx', 'xxxxx', '.xxx.'],
    'case': ['.xxx.', 'x...x', 'xxxxx', 'xxyxx', 'xxxxx'],
    'flag': ['xrrr.', 'xrrrr', 'xrrr.', 'x....', 'x....'],
    'law': ['xxxxx', '.x.x.', '.x.x.', '.x.x.', 'xxxxx'],
    'tag': ['xxx..', 'xkxx.', 'xxxxx', '.xxxx', '..xxx'],
}


def glyph(g, x, y, name, c='r'):
    rows = GLYPHS[name]
    stamp(g, x, y, [r.replace('x', c) for r in rows])


def sign(g, x, y, name, c='r', bg='W'):
    """A 7×7 sign board (bg) with the symbol in the middle."""
    rect(g, x, y, x + 6, y + 6, bg)
    glyph(g, x + 1, y + 1, name, c)


# ------------------------------------------------------------------- buildings
def building(s):
    g = blank()
    shape = s.get('shape', 'house')
    wall = s.get('wall', 'w')
    roof = s.get('roof', 'r')
    sym = s.get('sign')
    sc = s.get('sc', 'r')
    sb = s.get('sb', 'W')
    if shape == 'house':
        for i in range(6):
            rect(g, 7 - i, 1 + i, 8 + i, 1 + i, roof)
        rect(g, 2, 7, 13, 7, roof)
        rect(g, 3, 8, 12, 14, wall)
        rect(g, 7, 11, 9, 14, 'b')
        eyes(g, 4, 9, 6)
        if sym:
            glyph(g, 5, 2, sym, sc) if False else sign_small(g, 6, 3, sym, sc, roof)
    elif shape == 'shop':
        rect(g, 2, 2, 13, 14, wall)
        sign(g, 4, 2, sym or 'bag', sc, sb) if sym else None
        stripe = s.get('awning', 'r')
        for x in range(1, 15):
            put(g, x, 9, stripe if x % 2 else 'W')
            put(g, x, 10, stripe if x % 2 else 'W')
        rect(g, 3, 11, 7, 13, 'U')
        eyes(g, 3, 11, 3)
        rect(g, 9, 11, 12, 14, 'b')
        rect(g, 2, 14, 13, 14, wall)
        rect(g, 9, 11, 12, 14, 'b')
    elif shape == 'tall':
        rect(g, 3, 1, 12, 14, wall)
        for y in (6, 9):
            for x in (4, 7, 10):
                rect(g, x, y, x + 1, y + 1, 'U')
        eyes(g, 4, 6, 6)
        rect(g, 6, 12, 9, 14, 'b')
        if sym:
            sign(g, 5, 1, sym, sc, sb) if s.get('big') else sign_small(g, 6, 2, sym, sc, sb)
    elif shape == 'hall':  # columns: Rathaus, Museum, Bank, Gericht
        for i in range(4):
            rect(g, 7 - i * 2, 1 + i, 8 + i * 2, 1 + i, roof)
        rect(g, 1, 5, 14, 5, roof)
        for x in (2, 5, 10, 13):
            rect(g, x, 6, x, 12, wall)
        rect(g, 6, 6, 9, 12, wall)
        rect(g, 1, 13, 14, 14, 'c')
        eyes(g, 6, 7, 2)
        rect(g, 7, 10, 8, 12, 'b')
        if sym:
            glyph(g, 6, 0, sym, sc) if s.get('top') else None
        if sym and not s.get('top'):
            small = SMALL.get(sym)
            if small:
                stamp(g, 6, 2, [r.replace('x', sc) for r in small])
    elif shape == 'church':
        rect(g, 6, 3, 9, 14, wall)
        rect(g, 7, 0, 8, 0, 'y')
        put(g, 7, 1, 'y') if False else None
        for i in range(3):
            rect(g, 7 - i, 1 + i, 8 + i, 1 + i, roof)
        put(g, 7, 0, sc if sym else 'y')
        put(g, 8, 0, sc if sym else 'y')
        rect(g, 2, 8, 13, 8, roof)
        rect(g, 3, 7, 12, 7, roof)
        rect(g, 2, 9, 13, 14, wall)
        rect(g, 7, 11, 8, 14, 'b')
        eyes(g, 3, 10, 7)
        rect(g, 7, 4, 8, 5, 'U')
        if sym:
            small = SMALL.get(sym)
            stamp(g, 6, 4, [r.replace('x', sc) for r in small]) if small else None
    elif shape == 'castle':
        rect(g, 2, 3, 5, 14, wall)
        rect(g, 10, 3, 13, 14, wall)
        rect(g, 5, 6, 10, 14, wall)
        for x in (2, 4, 10, 12):
            put(g, x, 2, wall)
        for x in (5, 7, 9):
            put(g, x, 5, wall)
        rect(g, 6, 10, 9, 14, 'b')
        eyes(g, 3, 7, 8)
        put(g, 3, 0, 'k')
        put(g, 3, 1, 'k')
        put(g, 4, 0, roof)
        put(g, 5, 0, roof)
        put(g, 4, 1, roof)
    elif shape == 'factory':
        rect(g, 1, 8, 14, 14, wall)
        for x0 in (1, 6):
            for i in range(4):
                rect(g, x0, 7 - i, x0 + i, 7 - i, roof)
        rect(g, 11, 2, 13, 7, 'S')
        stamp(g, 11, 0, ['.cc', 'c..'])
        for x in (2, 6, 10):
            rect(g, x, 10, x + 1, 11, 'U')
        eyes(g, 2, 10, 4)
        rect(g, 10, 12, 12, 14, 'b')
    elif shape == 'station':
        for x in range(1, 15):
            put(g, x, 4, roof)
        rect(g, 2, 3, 13, 3, roof)
        rect(g, 4, 2, 11, 2, roof)
        rect(g, 2, 5, 13, 14, wall)
        sign(g, 5, 0, sym or 'clock', sc, sb) if sym else None
        rect(g, 3, 9, 5, 14, 'b')
        rect(g, 10, 9, 12, 14, 'b')
        rect(g, 6, 7, 9, 8, 'U')
        eyes(g, 6, 7, 2)
        if not sym:
            stamp(g, 6, 0, ['.WW.', 'WkkW', 'WWkW', '.WW.'])
    elif shape == 'hut':
        for i in range(5):
            rect(g, 7 - i, 4 + i, 8 + i, 4 + i, roof)
        rect(g, 3, 9, 12, 14, wall)
        rect(g, 7, 11, 8, 14, 'b')
        eyes(g, 4, 10, 5)
        if sym:
            sign_small(g, 6, 5, sym, sc, roof)
    elif shape == 'tower':
        rect(g, 5, 2, 10, 14, wall)
        for x in (5, 7, 9):
            put(g, x, 1, wall)
        put(g, 10, 1, wall)
        rect(g, 7, 12, 8, 14, 'b')
        eyes(g, 6, 5, 2)
        if sym:
            sign_small(g, 6, 8, sym, sc, sb)
    elif shape == 'block':  # Plattenbau / office
        rect(g, 1, 3, 14, 14, wall)
        for y in (5, 8, 11):
            for x in (2, 5, 8, 11):
                rect(g, x, y, x + 1, y + 1, 'U')
        eyes(g, 5, 5, 3)
        if sym:
            sign(g, 4, 0, sym, sc, sb)
    elif shape == 'dome':  # mosque, observatory, Dom
        stamp(g, 4, 2, ['...xx...', '.xxxxxx.', 'xxxxxxxx', 'xxxxxxxx'], recolor={'x': roof})
        rect(g, 3, 6, 12, 14, wall)
        rect(g, 7, 10, 8, 14, 'b')
        eyes(g, 4, 8, 6)
        put(g, 7, 1, sc)
        put(g, 8, 1, sc)
        put(g, 7, 0, sc)
        if s.get('minaret'):
            rect(g, 1, 3, 1, 14, wall)
            rect(g, 14, 3, 14, 14, wall)
            put(g, 1, 2, roof)
            put(g, 14, 2, roof)
    return outline(g)


SMALL = {  # 4×3 tiny symbols for gables and towers
    'cross': ['.x..', 'xxx.', '.x..'],
    'euro': ['xxx.', 'xx..', 'xxx.'],
    'star': ['.x..', 'xxx.', 'x.x.'],
    'scale': ['xxx.', 'x.x.', '.x..'],
    'book': ['xxxx', 'xWxW', 'xxxx'],
    'clock': ['xxx.', 'xkx.', 'xxx.'],
    'heart': ['x.x.', 'xxx.', '.x..'],
    'H': ['x.x.', 'xxx.', 'x.x.'],
    'eagle': ['x.x.', 'xxx.', '.x..'],
    'note': ['.xx.', '.x..', 'xx..'],
    'moon': ['xx..', 'x...', 'xx..'],
    'mask': ['xxx.', 'kxk.', 'xxx.'],
    'flame': ['.x..', 'xyx.', 'xxx.'],
    'tube': ['.x..', '.x..', 'xxx.'],
    'globe': ['xxx.', 'xgx.', 'xxx.'],
}


def sign_small(g, x, y, sym, c, bg):
    rows = SMALL.get(sym)
    if rows:
        stamp(g, x, y, [r.replace('x', c).replace('.', 'W' if bg != 'W' else '.') for r in rows] if False else
              [r.replace('x', c) for r in rows])
    else:
        glyph(g, x - 1, y - 1, sym, c)


# ------------------------------------------------------------------- rooms: a framed view into the room
def room(s):
    g = blank()
    wall = s.get('wall', 'w')
    floor = s.get('floor', 'n')
    rect(g, 1, 2, 14, 9, wall)
    rect(g, 1, 10, 14, 14, floor)
    rect(g, 1, 9, 14, 9, 'N' if floor == 'n' else floor)
    eyes(g, 4, 4, 6) if s.get('eyes', '1') == '1' else None
    item = s.get('item')
    ix, iy = 4, 8
    if item:
        stamp(g, ix, iy, ROOM_ITEMS[item])
    if s.get('pic'):
        rect(g, 10, 3, 12, 5, s['pic'])
    if s.get('win'):
        rect(g, 10, 3, 13, 6, 'U')
    return outline(g)


ROOM_ITEMS = {
    'bed': ['.......', 'W......', 'WWrrrrr', 'rrrrrrr', 'b.....b'],
    'sofa': ['vvvvvvv', 'vVVVVVv', 'vvvvvvv', 'b.....b'],
    'stove': ['....', 'kkkk', 'SSSS', 'SkkS', 'SkkS', 'SSSS'],
    'kitchen': ['........', 'kkkk.cc.', 'ScSSSScc', 'SkkSWWWW', 'SkkSWWWW', 'SSSSWWWW'],
    'tub': ['W.......', 'W.......', 'WWWWWWWW', 'WUUUUUUW', '.WWWWWW.', '.c....c.'],
    'toilet': ['WWW.', 'WWW.', '.WWW', '.WW.', '.WW.'],
    'desk': ['....ss..', '....sU..', 'bbbbbbbb', 'b......b', 'b......b'],
    'board': ['ggggggg', 'gWgWWgg', 'ggggggg', '..b.b..'],
    'crib': ['y.y.y.y', 'yUUUUUy', 'yyyyyyy', 'y.....y'],
    'table': ['..rr...', 'bbbbbbb', '.b...b.', '.b...b.'],
    'shelf': ['bbbbb', 'brugb', 'bbbbb', 'bygrb', 'bbbbb'],
    'chairs': ['b.....b', 'b.....b', 'bbb.bbb', 'b.b.b.b'],
    'mirror': ['.UUU.', 'UUhUU', 'UUUUU', '.UUU.', '..c..'],
    'curtain': ['rrrrrrr', 'rr...rr', 'r.....r', 'r.....r'],
    'cell': ['s.s.s.s', 's.s.s.s', 's.s.s.s', 's.s.s.s', 's.s.s.s'],
    'boxes': ['..NNN', '..NnN', 'NNNNN', 'NnNNn', 'NNNNN'],
    'stairs': ['.....kk', '....kkk', '...kkkk', '..kkkkk', '.kkkkkk'],
    'sauna': ['bbbbbbb', 'b.....b', 'bbbbbbb', '..ss...', '.sccs..'],
    'clothes': ['k.k.k', 'r.u.y', 'r.u.y', 'r.uuy'],
    'plane': ['.......', 'ccccccc', 'cUcUcUc', 'ccccccc'],
    'lockers': ['ssssss', 'sksksk', 'ssssss', 'ssssss', 'ssssss'],
    'reception': ['...y...', 'bbbbbbb', 'bnnnnnb', 'bnnnnnb'],
    'waiting': ['b.b.b.b', 'bbbbbbb', 'u.u.u.u', 'uuuuuuu', 'b.b.b.b'],
    'lab': ['.y..g..', '.y..g..', 'yyy.ggg', 'WWWWWWW', 'W.....W'],
    'court': ['...y...', '.bbbbb.', 'bbbbbbb', 'b.....b'],
}


# ------------------------------------------------------------------- flags
FLAG_W, FLAG_H = 12, 8


def flag(s):
    g = blank()
    x0, y0 = 2, 3
    kind = s.get('kind', 'h3')
    cs = s.get('c', 'rWr')
    if kind == 'h3':
        n = len(cs)
        for i, c in enumerate(cs):
            a = y0 + (FLAG_H * i) // n
            b = y0 + (FLAG_H * (i + 1)) // n - 1
            rect(g, x0, a, x0 + FLAG_W - 1, b, c)
    elif kind == 'v3':
        n = len(cs)
        for i, c in enumerate(cs):
            a = x0 + (FLAG_W * i) // n
            b = x0 + (FLAG_W * (i + 1)) // n - 1
            rect(g, a, y0, b, y0 + FLAG_H - 1, c)
    elif kind == 'nordic':
        bg, cr = cs[0], cs[1]
        rect(g, x0, y0, x0 + FLAG_W - 1, y0 + FLAG_H - 1, bg)
        rect(g, x0, y0 + 3, x0 + FLAG_W - 1, y0 + 4, cr)
        rect(g, x0 + 3, y0, x0 + 4, y0 + FLAG_H - 1, cr)
        if len(cs) > 2:
            rect(g, x0, y0 + 4, x0 + FLAG_W - 1, y0 + 4, cs[2]) if False else None
    elif kind == 'disc':
        bg, dc = cs[0], cs[1]
        rect(g, x0, y0, x0 + FLAG_W - 1, y0 + FLAG_H - 1, bg)
        stamp(g, x0 + 4, y0 + 2, ['.xx.', 'xxxx', 'xxxx', '.xx.'], recolor={'x': dc})
    elif kind == 'swiss':
        rect(g, x0 + 2, y0, x0 + 9, y0 + FLAG_H - 1, cs[0])
        stamp(g, x0 + 4, y0 + 1, ['.WW.', '.WW.', 'WWWW', 'WWWW', '.WW.', '.WW.'])
        return outline(_pole(g, x0 + 2))
    elif kind == 'cross':  # St George etc.
        rect(g, x0, y0, x0 + FLAG_W - 1, y0 + FLAG_H - 1, cs[0])
        rect(g, x0, y0 + 3, x0 + FLAG_W - 1, y0 + 4, cs[1])
        rect(g, x0 + 5, y0, x0 + 6, y0 + FLAG_H - 1, cs[1])
    elif kind == 'saltire':
        rect(g, x0, y0, x0 + FLAG_W - 1, y0 + FLAG_H - 1, cs[0])
        for i in range(FLAG_H):
            put(g, x0 + int(i * 1.5), y0 + i, cs[1])
            put(g, x0 + int(i * 1.5) + 1, y0 + i, cs[1])
            put(g, x0 + FLAG_W - 1 - int(i * 1.5), y0 + i, cs[1])
            put(g, x0 + FLAG_W - 2 - int(i * 1.5), y0 + i, cs[1])
    elif kind == 'canton':  # stripes + star box (USA, Malaysia…)
        for i in range(FLAG_H):
            rect(g, x0, y0 + i, x0 + FLAG_W - 1, y0 + i, cs[0] if i % 2 == 0 else cs[1])
        rect(g, x0, y0, x0 + 5, y0 + 3, cs[2])
        for (dx, dy) in ((1, 1), (3, 1), (2, 2), (4, 2)):
            put(g, x0 + dx, y0 + dy, 'W')
    elif kind == 'uk':
        rect(g, x0, y0, x0 + FLAG_W - 1, y0 + FLAG_H - 1, 'u')
        for i in range(FLAG_H):
            put(g, x0 + int(i * 1.5), y0 + i, 'W')
            put(g, x0 + FLAG_W - 1 - int(i * 1.5), y0 + i, 'W')
        rect(g, x0, y0 + 3, x0 + FLAG_W - 1, y0 + 4, 'W')
        rect(g, x0 + 5, y0, x0 + 6, y0 + FLAG_H - 1, 'W')
        rect(g, x0, y0 + 3, x0 + FLAG_W - 1, y0 + 3, 'r') if False else None
        rect(g, x0 + 5, y0, x0 + 6, y0 + FLAG_H - 1, 'r')
        rect(g, x0, y0 + 3, x0 + FLAG_W - 1, y0 + 4, 'r')
        rect(g, x0 + 5, y0 + 3, x0 + 6, y0 + 4, 'r')
    elif kind == 'star':  # one star on a field (China, Vietnam…) or stars
        rect(g, x0, y0, x0 + FLAG_W - 1, y0 + FLAG_H - 1, cs[0])
        glyph(g, x0 + (1 if s.get('corner') else 4), y0 + (1 if s.get('corner') else 2), 'star', cs[1])
        if s.get('small'):
            for dx, dy in ((7, 1), (8, 3), (8, 5), (7, 6)):
                put(g, x0 + dx, y0 + dy, cs[1])
    elif kind == 'eu':
        rect(g, x0, y0, x0 + FLAG_W - 1, y0 + FLAG_H - 1, 'u')
        for dx, dy in ((5, 1), (7, 2), (8, 4), (7, 6), (5, 7) if False else (5, 6), (3, 6), (2, 4), (3, 2), (6, 1)):
            put(g, x0 + dx, y0 + dy, 'y')
    elif kind == 'tri':  # triangle at the hoist + stripes (Czech, Philippines, Cuba…)
        n = len(cs) - 1
        for i, c in enumerate(cs[1:]):
            a = y0 + (FLAG_H * i) // n
            b = y0 + (FLAG_H * (i + 1)) // n - 1
            rect(g, x0, a, x0 + FLAG_W - 1, b, c)
        for i in range(FLAG_H):
            w = 4 - abs(i - 3.5) + 0.5
            rect(g, x0, y0 + i, x0 + int(w), y0 + i, cs[0])
    elif kind == 'map':  # no single flag (continents, regions): a little globe-map in the flag spot
        rect(g, x0, y0, x0 + FLAG_W - 1, y0 + FLAG_H - 1, 'U')
        stamp(g, x0 + 2, y0 + 1, s.get('shape_', ['.gg.....', 'gggg..g.', '.ggg.ggg', '..g..gg.', '.....g..']).copy()
              if False else ['.gg.....', 'gggg..g.', '.ggg.ggg', '..g..gg.', '.....g..'])
    if s.get('emblem'):
        e = s['emblem']
        glyph(g, x0 + 4, y0 + 2, e, s.get('ec', 'y'))
    if s.get('eyes', '1') == '1':
        ey = y0 + 2
        ex = x0 + 3
        if kind in ('star', 'canton') and not s.get('mideyes'):
            ex, ey = x0 + 6, y0 + 4
        eyes(g, ex, ey, 4)
    return outline(_pole(g, x0))


def _pole(g, x0):
    rect(g, x0 - 1, 2, x0 - 1, 14, 'b')
    put(g, x0 - 1, 1, 'y')
    return g


# ------------------------------------------------------------------- papers
def doc(s):
    g = blank()
    paper = s.get('paper', 'W')
    kind = s.get('kind', 'sheet')
    head = s.get('head')
    sym = s.get('sign')
    sc = s.get('sc', 'r')
    if kind == 'sheet':
        rect(g, 3, 1, 12, 14, paper)
        put(g, 12, 1, '.')
        put(g, 11, 1, 'c')
        put(g, 12, 2, 'c')
        if head:
            rect(g, 4, 2, 11, 3, head)
        eyes(g, 5, 5, 4)
        for y in (8, 10, 12):
            rect(g, 4, y, 11 if y != 12 else 8, y, s.get('line', 'S'))
        if s.get('form'):
            for y in (8, 10, 12):
                rect(g, 4, y, 5, y, 'k')
                rect(g, 7, y, 11, y, 'S')
        if sym:
            glyph(g, 8, 9, sym, sc) if s.get('stamp') != 'low' else glyph(g, 7, 10, sym, sc)
        if s.get('sig'):
            stamp(g, 4, 12, ['.u..u.', 'u.uu.u'])
    elif kind == 'letter':  # envelope
        rect(g, 1, 4, 14, 12, paper)
        for i in range(5):
            put(g, 1 + i, 4 + i, 'c')
            put(g, 14 - i, 4 + i, 'c')
        put(g, 6, 9, 'c')
        put(g, 9, 9, 'c')
        rect(g, 7, 9, 8, 9, 'c')
        eyes(g, 4, 6, 6) if False else None
        if sym:
            glyph(g, 10, 5, sym, sc)
        eyes(g, 4, 9, 6)
    elif kind == 'cert':  # certificate with a seal and ribbon
        rect(g, 2, 2, 13, 12, paper)
        rect(g, 3, 3, 12, 3, head or 'Y')
        eyes(g, 5, 5, 4)
        rect(g, 4, 8, 11, 8, 'S')
        rect(g, 4, 10, 8, 10, 'S')
        stamp(g, 9, 9, ['.rr.', 'rrrr', 'rrrr', '.rr.', 'r..r', 'r..r'])
    elif kind == 'scroll':
        rect(g, 4, 2, 11, 12, paper)
        rect(g, 3, 1, 12, 2, 'N')
        rect(g, 3, 13, 12, 14, 'N')
        eyes(g, 5, 4, 4)
        for y in (8, 10):
            rect(g, 5, y, 10, y, 'n')
        if sym:
            glyph(g, 6, 7, sym, sc)
    elif kind == 'booklet':  # passport, Ausweis-booklet, Heft, Tagebuch
        cover = s.get('cover', 'R')
        rect(g, 3, 1, 12, 14, cover)
        rect(g, 3, 1, 3, 14, dk(cover))
        eyes(g, 5, 4, 4)
        if sym:
            glyph(g, 6, 8, sym, sc)
        if s.get('band'):
            rect(g, 4, 12, 12, 12, s['band'])
    elif kind == 'paper2':  # a stack of papers (Unterlagen, Akte)
        rect(g, 4, 1, 13, 12, 'c')
        rect(g, 2, 3, 11, 14, paper)
        eyes(g, 4, 6, 4)
        for y in (10, 12):
            rect(g, 3, y, 10, y, 'S')
        if s.get('folder'):
            rect(g, 1, 7, 12, 14, s['folder'])
            rect(g, 1, 6, 5, 6, s['folder'])
            eyes(g, 4, 9, 4)
        if sym:
            glyph(g, 8, 8, sym, sc)
    elif kind == 'poster':
        rect(g, 2, 1, 13, 14, paper)
        rect(g, 3, 2, 12, 8, s.get('pic', 'U'))
        if sym:
            glyph(g, 5, 3, sym, sc)
        eyes(g, 5, 10, 4)
        rect(g, 4, 13, 11, 13, s.get('line', 'k'))
    elif kind == 'note':  # sticky note / Zettel
        rect(g, 3, 3, 12, 12, paper)
        rect(g, 3, 3, 12, 4, dk(paper))
        eyes(g, 5, 6, 4)
        rect(g, 5, 10, 10, 10, 'S')
        if sym:
            glyph(g, 8, 8, sym, sc)
    elif kind == 'receipt':
        rect(g, 4, 1, 11, 14, paper)
        for x in range(4, 12, 2):
            put(g, x, 14, '.')
        eyes(g, 5, 3, 4)
        for y in (6, 8, 10):
            rect(g, 5, y, 7, y, 'S')
            rect(g, 9, y, 10, y, 'S')
        rect(g, 5, 12, 10, 12, 'k')
        if sym:
            glyph(g, 6, 6, sym, sc)
    elif kind == 'book':
        cover = s.get('cover', 'u')
        rect(g, 3, 2, 12, 13, cover)
        rect(g, 3, 13, 12, 14, 'W')
        rect(g, 3, 2, 3, 14, dk(cover))
        eyes(g, 5, 4, 4)
        if sym:
            glyph(g, 6, 7, sym, sc)
        if s.get('title'):
            rect(g, 5, 11, 10, 11, s['title'])
    elif kind == 'magazine':
        cover = s.get('cover', 'r')
        rect(g, 3, 1, 12, 14, cover)
        rect(g, 4, 2, 11, 3, 'W')
        rect(g, 4, 5, 11, 12, s.get('pic', 'U'))
        eyes(g, 5, 7, 4)
        if sym:
            glyph(g, 6, 9, sym, sc) if False else None
    elif kind == 'screen':  # an app, an e-mail, a web page, a video: a phone or monitor showing a symbol
        dev = s.get('dev', 'monitor')
        if dev == 'phone':
            rect(g, 4, 1, 11, 14, 'k')
            rect(g, 5, 2, 10, 12, s.get('bg', 'U'))
            put(g, 7, 13, 's')
            put(g, 8, 13, 's')
            if sym:
                glyph(g, 5, 7, sym, sc)
            eyes(g, 5, 3, 4)
        else:
            rect(g, 1, 1, 14, 11, 'k')
            rect(g, 2, 2, 13, 10, s.get('bg', 'U'))
            rect(g, 7, 12, 8, 12, 's')
            rect(g, 5, 13, 10, 13, 's')
            if sym:
                glyph(g, 8, 5, sym, sc)
            eyes(g, 3, 3, 4) if not sym else eyes(g, 2, 3, 3)
    return outline(g)


def dk(c):
    from art_people import dk as _dk
    return _dk(c)


# ------------------------------------------------------------------- cards (ID, bank card, ticket)
def card(s):
    g = blank()
    body = s.get('c', 'u')
    rect(g, 1, 4, 14, 12, body)
    kind = s.get('kind', 'id')
    if kind == 'id':
        rect(g, 2, 6, 5, 10, 'm')
        rect(g, 2, 6, 5, 6, s.get('hair', 'b'))
        put(g, 3, 8, 'k')
        put(g, 4, 8, 'k')
        rect(g, 2, 10, 5, 10, 's')
        rect(g, 7, 9, 13, 9, 'W')
        rect(g, 7, 11, 11, 11, 'W')
        eyes(g, 8, 5, 3)
    elif kind == 'bank':
        rect(g, 1, 6, 14, 7, 'k')
        rect(g, 2, 9, 4, 10, 'y')
        eyes(g, 7, 9, 4)
    elif kind == 'sim':
        rect(g, 4, 3, 11, 13, body)
        rect(g, 1, 4, 3, 12, '.')
        rect(g, 12, 4, 14, 12, '.')
        put(g, 11, 3, '.')
        put(g, 10, 3, '.')
        rect(g, 6, 9, 9, 12, 'y')
        eyes(g, 5, 5, 4)
    elif kind == 'ticket':
        for y in (4, 12):
            for x in range(1, 15, 2):
                put(g, x, y, '.')
        rect(g, 10, 5, 10, 11, 'W')
        eyes(g, 3, 6, 4)
    if s.get('sign'):
        glyph(g, 9 if kind != 'ticket' else 11, 6 if kind != 'ticket' else 6, s['sign'], s.get('sc', 'y')) if kind != 'ticket' else glyph(g, 10, 6, s['sign'], s.get('sc', 'y'))
    if s.get('stripe'):
        rect(g, 1, 11, 14, 11, s['stripe'])
    return outline(g)


# ------------------------------------------------------------------- bottles and drinks
def bottle(s):
    g = blank()
    glass = s.get('glass', 'g')
    kind = s.get('kind', 'wine')
    label = s.get('label', 'W')
    if kind == 'wine':
        rect(g, 7, 0, 8, 0, s.get('cork', 'n'))
        rect(g, 7, 1, 8, 4, glass)
        rect(g, 6, 5, 9, 5, glass)
        rect(g, 5, 6, 10, 14, glass)
        rect(g, 5, 9, 10, 12, label)
    elif kind == 'flat':  # schnapps flask / whisky
        rect(g, 7, 1, 8, 1, s.get('cork', 'k'))
        rect(g, 7, 2, 8, 4, glass)
        rect(g, 4, 5, 11, 14, glass)
        rect(g, 4, 9, 11, 12, label)
    elif kind == 'can':
        rect(g, 5, 2, 10, 2, 'c')
        rect(g, 4, 3, 11, 14, glass)
        rect(g, 4, 9, 11, 12, label)
    elif kind == 'jar':
        rect(g, 4, 2, 11, 3, s.get('lid', 'r'))
        rect(g, 3, 4, 12, 14, glass)
        rect(g, 4, 9, 11, 12, label)
    elif kind == 'tube':  # Senf, Creme, Zahnpasta-like
        rect(g, 6, 1, 9, 2, s.get('lid', 'W'))
        rect(g, 5, 3, 10, 13, glass)
        rect(g, 4, 14, 11, 14, glass)
        rect(g, 5, 9, 10, 12, label)
    elif kind == 'spray':
        rect(g, 6, 1, 8, 2, 'k')
        put(g, 9, 1, 'k')
        rect(g, 5, 3, 10, 14, glass)
        rect(g, 5, 9, 10, 12, label)
    elif kind == 'glass':  # a drink in a glass (cocktail, Sekt, Schnaps)
        shape = s.get('shape', 'cocktail')
        if shape == 'cocktail':
            rect(g, 2, 3, 13, 3, 'W')
            for i in range(5):
                rect(g, 3 + i, 4 + i, 12 - i, 4 + i, glass)
            rect(g, 7, 9, 8, 13, 'W')
            rect(g, 5, 14, 10, 14, 'W')
            put(g, 12, 2, s.get('deco', 'y'))
            put(g, 13, 1, s.get('deco', 'y'))
        elif shape == 'flute':
            rect(g, 6, 1, 9, 9, glass)
            rect(g, 7, 10, 8, 13, 'W')
            rect(g, 5, 14, 10, 14, 'W')
            put(g, 7, 3, 'W')
            put(g, 8, 6, 'W')
        elif shape == 'shot':
            rect(g, 5, 6, 10, 14, 'W')
            rect(g, 6, 8, 9, 13, glass)
        elif shape == 'tumbler':
            rect(g, 3, 5, 12, 14, 'W')
            rect(g, 4, 8, 11, 13, glass)
            rect(g, 5, 7, 7, 9, 'U')
        elif shape == 'mug':
            rect(g, 3, 4, 10, 14, 'W')
            rect(g, 4, 5, 9, 13, glass)
            rect(g, 11, 6, 12, 11, 'W')
        elif shape == 'cup':
            rect(g, 3, 7, 11, 13, 'W')
            rect(g, 4, 7, 10, 8, glass)
            rect(g, 12, 8, 13, 11, 'W')
            rect(g, 2, 14, 12, 14, 'c')
            stamp(g, 5, 3, ['.c.c', 'c.c.', '.c.c'])
        eyes(g, 5, 9 if shape not in ('flute', 'shot') else 4, 4 if shape not in ('flute', 'shot') else 3) if shape not in ('cocktail', 'cup') else eyes(g, 5, 5 if shape == 'cocktail' else 10, 4)
        return outline(g)
    sym = s.get('sign')
    if sym:
        glyph(g, 6 if kind != 'jar' else 6, 9 if kind in ('wine', 'can') else 9, sym, s.get('sc', 'r')) if False else None
    eyes(g, 5 if kind in ('wine', 'tube', 'spray') else 5, 6 if kind != 'jar' else 5, 4 if kind != 'jar' else 4)
    if sym:
        glyph(g, 6, 9 if kind != 'jar' else 9, sym, s.get('sc', 'r')) if False else None
        rows = SMALL.get(sym)
        if rows:
            stamp(g, 6, 10 if kind != 'jar' else 10, [r.replace('x', s.get('sc', 'r')) for r in rows])
    return outline(g)


# ------------------------------------------------------------------- road signs / boards
def board(s):
    """A sign on a post (Haltestelle, Ausgang, Grenze …)."""
    g = blank()
    shape = s.get('shape', 'square')
    c = s.get('c', 'u')
    if shape == 'square':
        rect(g, 3, 1, 12, 9, c)
    elif shape == 'round':
        stamp(g, 3, 0, ['..xxxxxx..', '.xxxxxxxx.', 'xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxxxxxxx', '.xxxxxxxx.',
                        '..xxxxxx..'], recolor={'x': c})
    elif shape == 'wide':
        rect(g, 1, 2, 14, 8, c)
    rect(g, 7, 10, 8, 14, 's')
    if s.get('sign'):
        glyph(g, 6 if shape != 'wide' else 9, 3 if shape != 'round' else 2, s['sign'], s.get('sc', 'W'))
    eyes(g, 4 if shape != 'wide' else 2, 3 if shape != 'round' else 2, 5 if shape == 'square' else 4) if s.get('sign') is None else None
    if s.get('sign') and shape == 'wide':
        eyes(g, 2, 3, 4)
    return outline(g)
