"""Small pixel kit for the code-drawn monster looks (专属造型, 2026-11-26).

A sprite is a 16×16 grid of palette characters (see build_drawn.PAL); '.' is transparent. Everything here works on
plain lists of lists of characters, so a compositor can stack layers (body, hair, hat, prop, sign …) and finish with
outline() and eyes(), which give the same look as the hand-drawn sprites in data/monster-art/sprites.txt."""

W = H = 16


def blank():
    return [['.'] * W for _ in range(H)]


def grid(rows):
    """Rows of text → grid (short rows are padded with '.')."""
    g = blank()
    for y, r in enumerate(rows[:H]):
        for x, ch in enumerate(r[:W]):
            g[y][x] = ch
    return g


def text(g):
    return [''.join(r) for r in g]


def put(g, x, y, c):
    if 0 <= x < W and 0 <= y < H and c != ' ':
        g[y][x] = c


def rect(g, x0, y0, x1, y1, c):
    """Filled rectangle, corners inclusive."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(g, x, y, c)


def stamp(g, x0, y0, rows, keep_dot=False, recolor=None):
    """Paste a small drawing; '.' and ' ' are transparent unless keep_dot. recolor maps characters."""
    for dy, r in enumerate(rows):
        for dx, ch in enumerate(r):
            if ch == ' ' or (ch == '.' and not keep_dot):
                continue
            if recolor:
                ch = recolor.get(ch, ch)
            put(g, x0 + dx, y0 + dy, ch)


def mirror(rows):
    return [r[::-1] for r in rows]


def outline(g, c='o'):
    """Wrap every coloured shape in a 1-px outline (4-neighbourhood), like the hand-drawn sprites."""
    add = []
    for y in range(H):
        for x in range(W):
            if g[y][x] != '.':
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and g[ny][nx] not in '.o':
                    add.append((x, y))
                    break
    for x, y in add:
        g[y][x] = c
    return g


def eyes(g, x, y, gap=4):
    """Two 2×2 cartoon eyes (white with a dark pupil, pupil low and inside) at (x, y) and (x+gap, y)."""
    for ex, pupil_dx in ((x, 1), (x + gap, 1)):
        put(g, ex, y, 'h')
        put(g, ex + 1, y, 'h')
        put(g, ex, y + 1, 'h')
        put(g, ex + pupil_dx, y + 1, 'k')
    return g


def fill_bbox(g):
    xs = [x for y in range(H) for x in range(W) if g[y][x] != '.']
    ys = [y for y in range(H) for x in range(W) if g[y][x] != '.']
    return (min(xs), min(ys), max(xs), max(ys)) if xs else (0, 0, 0, 0)


def shift(g, dx, dy):
    out = blank()
    for y in range(H):
        for x in range(W):
            if g[y][x] != '.':
                put(out, x + dx, y + dy, g[y][x])
    return out


def center(g):
    """Centre the drawing in rows 1..14 and horizontally (outline room on every side)."""
    x0, y0, x1, y1 = fill_bbox(g)
    dx = (W - (x1 - x0 + 1)) // 2 - x0
    h = y1 - y0 + 1
    dy = 1 + (14 - h) // 2 - y0 if h <= 14 else 14 - y1
    return shift(g, dx, dy)
