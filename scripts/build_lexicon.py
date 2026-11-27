#!/usr/bin/env python3
"""6000 词导入 (0.7+0.8): data/wortschatz/*.tsv → src/data/lexicon.ts.

Inputs (all in data/wortschatz/):
  wortschatz.tsv   the 8000-row word list (rank, card, lemma, article, plural, verb forms, examples …)
  beispiele.tsv    extra example sentences by lemma
  szenen-v1.tsv    《6000词进场景-第1版》: segment, scene group, batch, rank (exported from the xlsx)
  grammatik-v1.tsv the 118 grammar words that are taught by grammar play, not as monsters

What it decides (all re-run safe; scene ids depend only on the scene sheet):
  - Regions 1–3 get five fields each, filled by situation (FIELD_PLAN below); regions 4–12 three fields.
  - Groups under 6 words are merged into the group before them (same situation where possible).
  - 文章群怪 words (regions 9–12, 蚀变②) are cut into scenes of 14 until the article texts exist (flag `art`).
  - 蚀变 groups are hung on old field scenes: the scene holding most of their ladder base words, else one of the
    same situation, else any free scene (segment 8 on regions 1–3, segment 11 on regions 1–7, never both).
  - Example sentences get their {blank} marked where the word's form can be found in them.
  - Present tense (CONJ) and Perfekt entries are generated for verbs the hand-written tables lack, only where the
    forms are certain (regular verbs, or a vowel change readable from the 3rd person).

Run: python3 scripts/build_lexicon.py   (writes src/data/lexicon.ts)
"""
import csv
import json
import re
import sys
from collections import OrderedDict, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data' / 'wortschatz'
OUT = ROOT / 'src' / 'data' / 'lexicon.ts'

MIN_GROUP = 6
ARTICLE_CHUNK = 14
FIRST_BATCH = 8

# ---- fields of regions 1–3: situations in order (表达 groups follow their situation) -------------------------
FIELD_PLAN = {
    1: [
        ('echogasse', '回声巷', 'Echogasse', ['日常物品', '住房家具']),
        ('schilderstrasse', '名牌街', 'Schilderstraße', ['问候和自我介绍', '办手续']),
        ('aschehof', '灰烬公寓', 'Aschehof', ['人际情感', '数字']),
        ('r1d', '夜校楼', 'Abendschule', ['基础词', '媒体科技']),
        ('r1e', '职介所', 'Jobbörse', ['作息爱好', '求职职场']),
    ],
    2: [
        ('gemuesegasse', '菜摊街', 'Gemüsegasse', ['吃喝']),
        ('waagegasse', '秤巷', 'Waagegasse', ['购物付钱']),
        ('kornspeicher', '粮仓', 'Kornspeicher', ['日常物品', '住房家具', '数字', '基础词']),
        ('r2d', '集市广场', 'Marktplatz', ['人际情感', '问候和自我介绍']),
        ('r2e', '公所街', 'Amtsgasse', ['作息爱好', '银行保险合同', '办手续', '求职职场', '媒体科技']),
    ],
    3: [
        ('bahnhofstrasse', '站前街', 'Bahnhofstraße', ['交通', '日常物品']),
        ('altstadt', '老城路口', 'Altstadt', ['方向和城里的地方']),
        ('fahrplanhalle', '时刻表大厅', 'Fahrplanhalle', ['时间日期']),
        ('r3d', '河岸', 'Flussufer', ['旅行天气自然', '身体看病', '新闻社会']),
        ('r3e', '候车楼', 'Wartesaal', ['问候和自我介绍', '数字', '基础词']),
    ],
}
FIELD_KEYS = 'abcde'
MAP_REGIONS = [1, 2, 3, 4, 5, 6, 7, 9, 10, 12, 13, 14, 16, 17, 18, 20]
# 121–200 级 (游戏设计 rev 488): B2 regions 13, 14, 16 and 蚀变③ (15) take the 2000 words 6001–8000 (《B2词分区》, one
# segment and situation per word). New words only come in 文章群怪 (article groups), so each of these regions gets
# B2_SCENES article scenes. C1 (17, 18, 20 and 蚀变④ 19) adds no words: their scenes are empty and spawn review and
# challenge monsters from everything learned (src/core/spawn.ts).
B2_SCENES = 28
B2_ERODE_GROUP = 10
C1_SCENES = 28
C1_ERODE_HOSTS = 46
ERODE_SEGS = ((8, (1, 2, 3)), (11, (1, 2, 3, 4, 5, 6, 7)), (15, (4, 5, 6, 7)), (19, (9, 10, 12)))

# Monster families (look and a few quests): by region and situation for nouns, by part of speech otherwise.
NOUN_FAMILY = {
    (1, '日常物品'): 'zahnding', (1, '住房家具'): 'zahnding', (1, '问候和自我介绍'): 'sippe', (1, '人际情感'): 'sippe',
    (2, '吃喝'): 'krume', (2, '购物付钱'): 'muenzling',
    (3, '交通'): 'fahrzeug', (3, '方向和城里的地方'): 'wegweiser', (3, '时间日期'): 'uhrwerk',
}
QUESTION_WORDS = {'wo', 'wer', 'was', 'wie', 'wann', 'warum', 'woher', 'wohin', 'wieso', 'weshalb', 'welcher', 'wozu', 'weswegen'}
NUMBERS = {
    'null': 0, 'eins': 1, 'zwei': 2, 'drei': 3, 'vier': 4, 'fünf': 5, 'sechs': 6, 'sieben': 7, 'acht': 8, 'neun': 9,
    'zehn': 10, 'elf': 11, 'zwölf': 12, 'dreizehn': 13, 'vierzehn': 14, 'fünfzehn': 15, 'sechzehn': 16,
    'siebzehn': 17, 'achtzehn': 18, 'neunzehn': 19, 'zwanzig': 20, 'dreißig': 30, 'vierzig': 40, 'fünfzig': 50,
    'sechzig': 60, 'siebzig': 70, 'achtzig': 80, 'neunzig': 90, 'hundert': 100, 'tausend': 1000,
}
# Fixes to the word list until they are made there (reported to the word-list thread).
CORRECTIONS = {'China': {'冠词': '', '复数': '', '卡片': 'China'}}
ORDINALS = {'erste': '1.', 'zweite': '2.', 'dritte': '3.', 'vierte': '4.', 'fünfte': '5.', 'sechste': '6.', 'siebte': '7.', 'achte': '8.'}


def slug(s):
    s = s.lower().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss').replace('é', 'e')
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', s))


def read_tsv(name):
    with open(DATA / name, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f, delimiter='\t'))


def situation_of(group):
    g = re.sub(r'^蚀变·', '', group)
    return g.split('·')[0]


# ---- examples: mark the word's form with {…} -------------------------------------------------------------------
DET = set('''der die das den dem des ein eine einen einem einer eines kein keine keinen keinem keiner keines
mein meine meinen meinem meiner meines dein deine deinen deinem deiner deines sein seine seinen seinem seiner seines
ihr ihre ihren ihrem ihrer ihres unser unsere unseren unserem unserer unseres euer eure euren eurem eurer eures
dieser diese dieses diesen diesem jeder jede jedes jeden jedem welcher welche welches welchen welchem
zwei drei vier fünf sechs sieben acht neun zehn viele einige alle mehrere'''.split())
TOKEN = re.compile(r"[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*")
SEP_PREFIXES = ['ab', 'an', 'auf', 'aus', 'bei', 'ein', 'fest', 'fort', 'her', 'hin', 'los', 'mit', 'nach', 'vor', 'weg', 'weiter',
                'zu', 'zurück', 'zusammen', 'dabei', 'kennen', 'statt', 'teil', 'um', 'durch', 'über', 'wieder', 'herein', 'heraus',
                'hinaus', 'vorbei', 'vorher', 'auseinander', 'entgegen', 'fern', 'frei', 'hoch', 'nieder', 'offen', 'kaputt', 'sauber', 'schief', 'spazieren', 'stehen', 'sitzen', 'liegen', 'bekannt', 'klar', 'voran', 'empor', 'herunter', 'hinunter', 'heran', 'herum', 'umher', 'rüber', 'runter', 'rein', 'raus']


def tokens(s):
    return [(m.start(), m.end(), m.group(0)) for m in TOKEN.finditer(s)]


def verb_forms(inf, three):
    """Contiguous forms of a verb that can stand in a sentence as one token."""
    forms = {inf}
    parts = [p.strip() for p in three.split('·')] if three else []
    sep = None
    if parts:
        er = parts[0].split()
        if len(er) > 1:
            sep = er[-1]
        pp = parts[-1].split()[-1] if parts[-1] else ''
        if pp:
            forms.add(pp)
        if not sep:
            forms.add(er[0])
            if len(parts) > 1 and parts[1]:
                pr = parts[1].split()[0]
                forms |= {pr, pr + 'en', pr + 'n', pr + 'st', pr + 'est', pr + 't', pr + 'e'}
    if sep and inf.startswith(sep):
        forms.add(sep + 'zu' + inf[len(sep):])
    elif not sep:
        stem = inf[:-2] if inf.endswith('en') else inf[:-1]
        # Present forms and the imperative (Leg …, Stell …).
        forms |= {stem, stem + 'e', stem + 'st', stem + 't', stem + 'et', stem + 'est', stem + 'en', inf}
        if parts:
            er0 = parts[0].split()[0]
            if er0.endswith('t'):
                forms.add(er0[:-1] + 'st')
                if er0[:-1] != stem and not er0[:-1].endswith(('ä', 'äu')) and re.search(r'[ie]', er0[:-1]):
                    forms.add(er0[:-1])  # wirft → wirf, gibt → gib (not fährt → fähr)
        for k, row in MANUAL_CONJ.items():
            if inf == k:
                forms |= set(row.split())
    return {f for f in forms if len(f) >= 2}


def adj_forms(de, comp):
    base = {de}
    if comp:
        c = comp.split(',')[0].strip()
        if c:
            base.add(c)
    else:
        base.add(de + 'er' if not de.endswith('e') else de + 'r')
    out = set()
    for b in base:
        stem = b
        out |= {stem, stem + 'e', stem + 'en', stem + 'er', stem + 'es', stem + 'em'}
        if b.endswith('e'):
            out |= {b + 'n', b + 'r', b + 's', b + 'm'}
    return out


def noun_forms(de, pl):
    forms = {de, de + 'n', de + 'en', de + 's', de + 'es', de + 'e'}
    if pl and pl != '-':
        forms |= {pl, pl + 'n'}
    return forms


def mark(sentence, w):
    """Puts {…} round the word's form (with its article for nouns); None when the form isn't in the sentence."""
    if '{' in sentence or '}' in sentence or '|' in sentence:
        return None
    toks = tokens(sentence)
    pos = w['pos']
    if pos == 'n':
        forms = noun_forms(w['de'], w.get('pl'))
        for i, (a, b, t) in enumerate(toks):
            if t in forms:
                start = a
                if i >= 1 and toks[i - 1][2].lower() in DET:
                    start = toks[i - 1][0]
                elif i >= 2 and toks[i - 2][2].lower() in DET and re.fullmatch(r'[a-zäöüß]+(e|en|er|es|em)', toks[i - 1][2]):
                    start = toks[i - 2][0]
                if start != a and not re.fullmatch(r"[A-Za-zÄÖÜäöüß ]+", sentence[start:a]):
                    start = a
                return sentence[:start] + '{' + sentence[start:b] + '}' + sentence[b:]
        return None
    if ' ' in w['de']:
        k = sentence.lower().find(w['de'].lower())
        if k < 0:
            return None
        return sentence[:k] + '{' + sentence[k:k + len(w['de'])] + '}' + sentence[k + len(w['de']):]
    if pos == 'v':
        forms = verb_forms(w['de'], w.get('three', ''))
        # Separable verb split in the sentence (Wir ziehen nächste Woche um): blank the finite part, the particle stays.
        er = (w.get('three') or '').split('·')[0].split()
        if len(er) == 2 and w['de'].startswith(er[1]):
            particle, core = er[1], w['de'][len(er[1]):]
            three = (w.get('three') or '').split('·')
            pret = three[1].split()[0] if len(three) > 1 and three[1].split() else ''
            fin = verb_forms(core, '') | {er[0], core[:-2] if core.endswith('en') else core[:-1]} | ({pret, pret + 'en', pret + 'n', pret + 'st', pret + 't'} if pret else set())
            fin |= {er[0][:-1] + 'st'} if er[0].endswith('t') else set()
            words_ = [t for _, _, t in toks]
            for i, (a, b, t) in enumerate(toks):
                if t in forms:
                    return sentence[:a] + '{' + t + '}' + sentence[b:]
            for i, (a, b, t) in enumerate(toks):
                if (t in fin or (i == 0 and t.lower() in {f.lower() for f in fin})) and particle in words_[i + 1:]:
                    return sentence[:a] + '{' + t + '}' + sentence[b:]
            return None
    elif pos == 'adj' or (pos == 'num' and w['de'].endswith('e')):
        forms = adj_forms(w['de'][:-1] if pos == 'num' else w['de'], w.get('comp', '')) | {w['de']}
    else:
        forms = {w['de']}
    lower = {f.lower() for f in forms}
    for i, (a, b, t) in enumerate(toks):
        if t in forms or (i == 0 and t.lower() in lower) or (pos not in ('n', 'name') and t.lower() == w['de'].lower() and t[0].isupper() and i == 0):
            return sentence[:a] + '{' + t + '}' + sentence[b:]
    return None


# ---- verbs: present tense and Perfekt ---------------------------------------------------------------------------
MANUAL_CONJ = {
    'können': 'kann kannst kann können könnt können', 'müssen': 'muss musst muss müssen müsst müssen',
    'dürfen': 'darf darfst darf dürfen dürft dürfen', 'sollen': 'soll sollst soll sollen sollt sollen',
    'wollen': 'will willst will wollen wollt wollen', 'mögen': 'mag magst mag mögen mögt mögen',
    'wissen': 'weiß weißt weiß wissen wisst wissen', 'werden': 'werde wirst wird werden werdet werden',
    'tun': 'tue tust tut tun tut tun', 'sein': 'bin bist ist sind seid sind', 'haben': 'habe hast hat haben habt haben',
    'nehmen': 'nehme nimmst nimmt nehmen nehmt nehmen', 'geben': 'gebe gibst gibt geben gebt geben',
    'treten': 'trete trittst tritt treten tretet treten', 'halten': 'halte hältst hält halten haltet halten',
    'raten': 'rate rätst rät raten ratet raten', 'laden': 'lade lädst lädt laden ladet laden',
    'braten': 'brate brätst brät braten bratet braten', 'gelten': 'gelte giltst gilt gelten geltet gelten',
    'lesen': 'lese liest liest lesen lest lesen', 'essen': 'esse isst isst essen esst essen',
    'vergessen': 'vergesse vergisst vergisst vergessen vergesst vergessen', 'messen': 'messe misst misst messen messt messen',
    'fressen': 'fresse frisst frisst fressen fresst fressen', 'stoßen': 'stoße stößt stößt stoßen stoßt stoßen',
    'lassen': 'lasse lässt lässt lassen lasst lassen', 'wachsen': 'wachse wächst wächst wachsen wachst wachsen',
    'waschen': 'wasche wäschst wäscht waschen wascht waschen', 'schmelzen': 'schmelze schmilzt schmilzt schmelzen schmelzt schmelzen',
    'heißen': 'heiße heißt heißt heißen heißt heißen', 'sitzen': 'sitze sitzt sitzt sitzen sitzt sitzen',
    'blasen': 'blase bläst bläst blasen blast blasen', 'erschrecken': 'erschrecke erschrickst erschrickt erschrecken erschreckt erschrecken',
}
INSEP = ('be', 'ge', 'er', 'ver', 'zer', 'ent', 'emp', 'miss', 'hinter', 'wider')


def regular_present(inf):
    """ich du er wir ihr sie of a regular verb, or None if the infinitive has an unusual shape."""
    if inf.endswith('eln'):
        st = inf[:-1]
        return [inf[:-3] + 'le', st + 'st', st + 't', inf, st + 't', inf]
    if inf.endswith('ern'):
        st = inf[:-1]
        return [st + 'e', st + 'st', st + 't', inf, st + 't', inf]
    if not inf.endswith('en'):
        return None
    st = inf[:-2]
    e = 'e' if re.search(r'(t|d|[^aeiouäöülrh]m|[^aeiouäöülrhm]n|chn|ffn|gn|dm)$', st) else ''
    du = st + ('t' if re.search(r'(s|ß|z|x)$', st) else e + 'st')
    return [st + 'e', du, st + e + 't', inf, st + e + 't', inf]


def make_conj(inf, three):
    """Present tense row ('ich … sie' and flags) where it is certain, else None."""
    parts = [p.strip() for p in three.split('·')] if three else []
    if not parts:
        return None
    er = parts[0].split()
    particle = er[1] if len(er) > 1 else ''
    if len(er) > 2:
        return None
    core = inf[len(particle):] if particle and inf.startswith(particle) else inf
    if particle and core == inf:
        return None
    base = None
    for k, row in MANUAL_CONJ.items():
        if core == k or (core.endswith(k) and core[:-len(k)] in INSEP + ('an', 'auf', 'aus', 'mit', 'ein', 'zu', 'ab', 'vor', 'nach', 'über', 'unter', 'zurück', 'weg', 'fest', 'her', 'hin', 'um', 'durch')):
            pre = core[:-len(k)]
            base = [pre + f for f in row.split()]
            strong = True
            break
    if base is None:
        reg = regular_present(core)
        if not reg:
            return None
        if er[0] == reg[2]:
            base, strong = reg, False
        else:
            e3 = er[0]
            st = core[:-2] if core.endswith('en') else None
            if not st or not e3.endswith('t') or re.search(r'(t|d)$', st):
                return None
            stem3 = e3[:-1]
            du = stem3 + ('t' if re.search(r'(s|ß|z|x)$', stem3) else 'st')
            base, strong = [reg[0], du, e3, reg[3], reg[4], reg[5]], True
    if particle:
        base = [f + ' ' + particle for f in base]
    past = parts[-1].split()
    pp = past[-1] if past else ''
    past_strong = bool(pp) and not pp.endswith('t')
    flags = ('s' if strong else '') + ('p' if past_strong and not strong else '')
    return ' '.join(f.replace(' ', '_') for f in base) + ('|' + flags if flags else '')


AUX_FORMS = {'haben': {'habe', 'hast', 'hat', 'haben', 'habt'}, 'sein': {'bin', 'bist', 'ist', 'sind', 'seid'}}


def make_perfekt(inf, three, sentences):
    parts = [p.strip() for p in three.split('·')] if three else []
    if len(parts) < 3:
        return None
    last = parts[-1].split()
    if len(last) != 2 or last[0] not in ('hat', 'ist'):
        return None
    aux = 'haben' if last[0] == 'hat' else 'sein'
    pp = last[1]
    sep = len(parts[0].split()) > 1
    if sep or inf.startswith(INSEP) or inf.endswith('ieren'):
        kind = 'pre'
    elif pp == 'ge' + inf[:-2] + 't' or pp == 'ge' + inf[:-2] + 'et':
        kind = 'reg'
    else:
        kind = 'irr'
    for de, zh in sentences:
        toks = tokens(de)
        words = [t for _, _, t in toks]
        if pp not in words:
            continue
        ai = next((i for i, (_, _, t) in enumerate(toks) if t.lower() in AUX_FORMS[aux]), None)
        pi = words.index(pp)
        if ai is None or ai >= pi:
            continue
        a0, a1, at = toks[ai]
        p0, p1, _ = toks[pi]
        ex = de[:a0] + '{' + at + '}' + de[a1:p0] + '[' + pp + ']' + de[p1:]
        return f'{aux}|{pp}|{kind}|{ex}|{zh}'
    return None


# Added to wortschatz.tsv after 《进场景第 1 版》 was cut (word-list thread, 8f3664c).
ADDED_AFTER_SHEET = {'morgen'}


# ---- build ------------------------------------------------------------------------------------------------------
def main():
    words_tsv = {r['排名']: r for r in read_tsv('wortschatz.tsv')}
    # 反身动词 (Lucas 2026-11-27): 'sich ~' / '(sich) ~' / 'sich ~ lassen', the reflexive's case when it is the
    # dative (sich etwas merken) and the usual preposition. The word id and the typed answer stay the bare verb.
    reflexive = {r['原形'].strip(): r for r in read_tsv('reflexiv.tsv')}
    # Lowest Goethe-Zertifikat list (A1/A2/B1) the lemma is on, '' = none (scripts/goethe_levels.py).
    goethe = {r['原形'].strip(): r['Goethe'].strip() for r in read_tsv('goethe-stufe.tsv')}
    # The scene sheet was cut from an older rank order; find each word by its lemma (closest rank wins),
    # so inserted words (morgen, 2026-11-25) don't shift everything after them.
    rows_by_lemma = defaultdict(list)
    for r in words_tsv.values():
        rows_by_lemma[r['原形'].strip()].append(r)
    used_ranks = set()

    def row_for(x):
        cands = rows_by_lemma.get(x['原形'].strip())
        if not cands:
            return words_tsv[str(x['排名'])]
        return min(cands, key=lambda r: (r['排名'] in used_ranks, abs(int(r['排名']) - int(x['排名']))))
    extra = defaultdict(list)
    for r in read_tsv('beispiele.tsv'):
        if r['例句']:
            extra[r['原形']].append((r['例句'].strip(), r['例句中文'].strip()))
    # 14482 proofread examples for the first 6000 words (例句 thread, merged 2026-11-25): 2 per word, 3 in regions 1–3,
    # one per verb preposition and per common sense. Duplicates of the sentences above are skipped later.
    for r in sorted(read_tsv('beispiele-6000.tsv'), key=lambda r: int(r['序号'] or 0)):
        if r['例句'].strip():
            extra[r['原形'].strip()].append((r['例句'].strip(), r['例句中文'].strip()))
    # 介词空 (0.8.6): one or two sentences with the 动介搭配 for the 13 pairing verbs whose examples lacked it.
    # Its braces are dropped: mark() puts its own (it skips sentences that already have them).
    for r in read_tsv('beispiele-praep-nachtrag.tsv'):
        if r['例句'].strip():
            extra[r['原形'].strip()].append((re.sub(r'[{}]', '', r['例句'].strip()), r['例句中文'].strip()))
    # B2 grammar sentences (proofreading thread); the 语法 column is reference only.
    if (DATA / 'beispiele-grammatik-b2.tsv').exists():
        for r in read_tsv('beispiele-grammatik-b2.tsv'):
            if r['例句'].strip():
                extra[r['原形'].strip()].append((re.sub(r'[{}]', '', r['例句'].strip()), r['例句中文'].strip()))
    # Nachtrag 2026-11-27 (Lucas «按推荐»): one sentence for each B2 word that had none, a second one for the
    # top-3000 words with fewer than two, and one per missing sense of common polysemous words. Tatoeba or 自写.
    if (DATA / 'beispiele-nachtrag-2026-11-27.tsv').exists():
        for r in read_tsv('beispiele-nachtrag-2026-11-27.tsv'):
            if r['例句'].strip():
                extra[r['原形'].strip()].append((re.sub(r'[{}]', '', r['例句'].strip()), r['例句中文'].strip()))
    scenes_tsv = read_tsv('szenen-v1.tsv')
    grammar = read_tsv('grammatik-v1.tsv')

    # Groups by segment, in sheet order.
    segs = OrderedDict()
    for r in scenes_tsv:
        seg = int(r['段'])
        segs.setdefault(seg, OrderedDict()).setdefault(r['场景'], []).append(r)

    def cut_articles(groups):
        out = OrderedDict()
        for name, rows in groups.items():
            if name.startswith('文章群怪'):
                for k in range(0, len(rows), ARTICLE_CHUNK):
                    chunk = rows[k:k + ARTICLE_CHUNK]
                    for j, x in enumerate(chunk):
                        x['批次'] = '第1批' if j < FIRST_BATCH else '第2批'
                        x['_art'] = True
                    out[f'文章群怪·{k // ARTICLE_CHUNK + 1}'] = chunk
            else:
                out[name] = rows
        return out

    def merge_tiny(groups):
        out = OrderedDict()
        for name, rows in groups.items():
            if len(rows) < MIN_GROUP and out:
                sit = situation_of(name)
                target = next((k for k in reversed(out) if situation_of(k) == sit and len(out[k]) + len(rows) <= 18), None)
                target = target or next((k for k in reversed(out) if len(out[k]) + len(rows) <= 18), None) or next(reversed(out))
                for x in rows:
                    x['批次'] = '第2批'
                out[target] = out[target] + rows
            else:
                out[name] = list(rows)
        # A tiny first group: fold the next one in.
        return out

    for seg in segs:
        segs[seg] = merge_tiny(cut_articles(segs[seg]))

    # B2 (13–16): words grouped by situation in list order, cut into article scenes (map regions) or 蚀变 groups.
    # 文章群怪 (121+): the new words of each B2 article (artikel-b2*.tsv, proofreading thread), by segment.
    article_words = defaultdict(list)
    for name in ('artikel-b2.tsv', 'artikel-b2-original.tsv'):
        if (DATA / name).exists():
            for r in sorted(read_tsv(name), key=lambda r: r['id']):
                article_words[int(r['段'])].append([w.strip() for w in r['新词'].split(',') if w.strip()])
    b2 = defaultdict(list)
    for r in read_tsv('b2-v1.tsv'):
        r['先后'] = '后'
        b2[int(r['段'])].append(r)
    for seg, rows in sorted(b2.items()):
        by_sit = OrderedDict()
        for x in sorted(rows, key=lambda x: int(x['排名'])):
            by_sit.setdefault(x['情境'] or '通用', []).append(x)
        groups = OrderedDict()

        def put(name, chunk):
            for j, x in enumerate(chunk):
                x['批次'] = '第1批' if j < FIRST_BATCH else '第2批'
                x['_art'] = True
                x['场景'] = name
            groups[name] = chunk
        if seg == 15:
            # 蚀变③: groups of about ten per situation, hung on old scenes of the same situation.
            # 文章群怪: inside a situation, an article's words stay next to each other (one group, or two neighbours).
            art_rank = {l: (i, j) for i, ls in enumerate(article_words.get(seg, [])) for j, l in enumerate(ls)}
            for sit, xs in by_sit.items():
                xs = sorted(xs, key=lambda x: art_rank.get(x['原形'].strip(), (10 ** 6, 0)))
                n = max(1, round(len(xs) / B2_ERODE_GROUP))
                for k in range(n):
                    put(f'{sit}·{k + 1}', xs[k * len(xs) // n:(k + 1) * len(xs) // n])
        else:
            # New region: B2_SCENES even scenes. 文章群怪 (121+): the new words of one article stay next to each other
            # (one scene, or two neighbours of one field), so the article's pack can gather them; the words of no
            # article follow, sorted by situation.
            by_lemma = {x['原形'].strip(): x for v in by_sit.values() for x in v}
            xs, taken = [], set()
            for lemmas in article_words.get(seg, []):
                for l in lemmas:
                    if l in by_lemma and l not in taken:
                        taken.add(l)
                        xs.append(by_lemma[l])
            xs += [x for v in by_sit.values() for x in v if x['原形'].strip() not in taken]
            n = B2_SCENES
            count = defaultdict(int)
            for k in range(n):
                chunk = xs[k * len(xs) // n:(k + 1) * len(xs) // n]
                sit = chunk[0]['情境'] or '通用'
                count[sit] += 1
                put(f'{sit}·{count[sit]}', chunk)
        segs[seg] = groups
    # C1 (17–20): empty scenes; 蚀变④ hosts carry no new words either.
    for seg in (17, 18, 20):
        segs[seg] = OrderedDict((f'回顾·{k + 1}', []) for k in range(C1_SCENES))
    segs[19] = OrderedDict((f'回潮·{k + 1}', []) for k in range(C1_ERODE_HOSTS))

    # ---- fields and scene ids of map regions ----
    scene_list = []  # dicts: id, region, field, zone, name, group, rows, situation
    fields_out = {}
    for region in MAP_REGIONS:
        groups = segs[region]
        names = list(groups)
        if region in FIELD_PLAN:
            plan = FIELD_PLAN[region]
            assigned = [[] for _ in plan]
            # Lucas 2026-11-25: 4–5 fields of about 8 scenes each. A field takes the groups of its situations until
            # it is full; the rest go to the emptiest field.
            cap = -(-len(names) // len(plan))
            for name in names:
                sit = situation_of(name)
                fi = next((i for i, f in enumerate(plan) if sit in f[3] and len(assigned[i]) < cap), None)
                if fi is None:
                    fi = min(range(len(plan)), key=lambda i: len(assigned[i]))
                assigned[fi].append(name)
            fields_out[region] = [(f[0], f[1], f[2]) for f in plan]
        else:
            n = len(names)
            nf = 3
            cuts = [round(n * k / nf) for k in range(nf + 1)]
            assigned = [names[cuts[k]:cuts[k + 1]] for k in range(nf)]
            fields_out[region] = [(f'r{region}{FIELD_KEYS[k]}', None, None) for k in range(nf)]
        for fi, gnames in enumerate(assigned):
            zone = fields_out[region][fi][0]
            for si, g in enumerate(gnames):
                scene_list.append({
                    'id': f'r{region}-{FIELD_KEYS[fi]}{si + 1}', 'region': region, 'field': fi, 'zone': zone,
                    'group': g, 'rows': groups[g], 'situation': situation_of(g),
                })

    # ---- words ----
    seen = {'truhe'}  # the 宝箱怪's own word (src/data/words.ts); the list's Truhe becomes truhe-2
    by_lemma = {}
    words = []

    def card_word(rank, x, region, zone, scene, lvl, erode=None):
        src = row_for(x)
        used_ranks.add(src['排名'])
        rank = src['排名']
        r = dict(src)
        r.update(CORRECTIONS.get(r['原形'].strip(), {}))
        de = r['原形'].strip()
        cat = r['词性']
        art = r['冠词'].strip()
        if '/' in art:
            art = art.split('/')[0]
        pos = {'名词': 'n', '动词': 'v', '形容词': 'adj', '数词': 'num'}.get(cat, 'phr')
        # German inside the Chinese ('拉；搬家（umziehen）', '美国（die USA）') would give the answer away.
        zh = re.sub(r'[（(][^）)]*[A-Za-zÄÖÜäöüß][^）)]*[）)]', '', r['中文']).strip() or r['中文'].strip()
        w = {'de': de, 'zh': zh, 'rank': int(rank), 'order': {'先': 1, '中': 2, '后': 3}.get(r['先后'], 2)}
        # 怪物美术: the monster's kind (类别) and, where the art packs have the very thing, its own look (专属造型).
        w['cat'] = {'食物': 'food', '物品': 'item', '动物': 'animal', '人物': 'person', '地点': 'place'}.get(r.get('类别', '').strip(), '')
        look = re.match(r'(farm|town|dungeon|battle)#(\d+)', r.get('专属造型', '').strip())
        if look:
            w['look'] = look.group(1)[0] + look.group(2)
        if pos == 'n' and (not art or '地名' in r['标签']):
            pos = 'name'
        if pos == 'phr' and de.lower() in QUESTION_WORDS:
            pos = 'q'
        if pos == 'num':
            if de in NUMBERS:
                w['digit'] = str(NUMBERS[de])
            elif de in ORDINALS:
                w['digit'] = ORDINALS[de]
            else:
                pos = 'phr'
        if pos == 'name' and art:
            w['art'] = art
        if pos == 'n':
            w['art'] = art
            pl = r['复数'].strip()
            if '只有复数' in r['标签'] or '(Pl.)' in r['卡片']:
                w['plOnly'] = True
            elif pl:
                w['pl'] = pl
            else:
                w['pl'] = '-'
        if pos == 'v':
            w['three'] = r['动词三形'].strip()
        if pos == 'adj':
            w['comp'] = r['比较级(仅不规则)'].strip()
        w['pos'] = pos
        base_id = slug(de) + ('-num' if pos == 'num' else '')
        wid = base_id
        while wid in seen:
            wid += '-2'
        seen.add(wid)
        w['id'] = wid
        w['region'] = region
        w['zone'] = zone
        w['scene'] = scene
        w['lvl'] = lvl
        if erode:
            w['erode'] = erode
        if x.get('批次') == '第2批':
            w['batch'] = 2
        if x.get('_art'):
            w['art_pool'] = True
        if x.get('语体') and x['语体'] not in ('中性', ''):
            w['reg'] = x['语体']
        m = re.search(r'梯子：(.+?) 的进阶说法', x.get('备注') or '')
        if m:
            w['_ladder'] = m.group(1).strip()
        sit = r['情境'] or x.get('情境') or situation_of(x['场景'])
        w['situation'] = sit
        fam = NOUN_FAMILY.get((region, sit)) if pos in ('n', 'name') else None
        w['family'] = fam or {'n': 'kram', 'name': 'schild', 'v': 'nachhall', 'adj': 'echo', 'phr': 'echo', 'num': 'zahlwurm', 'q': 'schild'}[pos]
        sents = []
        if r['例句'].strip():
            sents.append((r['例句'].strip(), r['例句中文'].strip()))
        for s in extra.get(de, []):
            if s[0] not in [t[0] for t in sents]:
                sents.append(s)
        w['_sents'] = sents
        w['goethe'] = goethe.get(de, '')
        rf = reflexive.get(de) if pos == 'v' else None
        if rf:
            form = rf['形式'].strip()
            w['refl'] = (form if '~' in form else form + ' ~') + ('|Dat' if rf['格'].strip() == 'Dat' else '')
            w['prep'] = rf['搭配'].strip()
        by_lemma.setdefault(de, wid)
        words.append(w)
        return w

    def levels(lo, hi, k, n, i, m):
        return round(lo + (hi - lo) * ((k + (i / (m - 1) if m > 1 else 0)) / n))

    # Map regions: levels climb over fields in order, scenes in order.
    for region in MAP_REGIONS:
        lo, hi = (region - 1) * 10 + 1, region * 10
        sc = [s for s in scene_list if s['region'] == region]
        for k, s in enumerate(sc):
            ids = []
            for i, x in enumerate(s['rows']):
                w = card_word(x['排名'], x, region, s['zone'], s['id'], levels(lo, hi, k, len(sc), i, len(s['rows'])))
                ids.append(w['id'])
            s['words'] = ids
    words_by_id = {w['id']: w for w in words}

    # 常用短句 (Lucas 2026-11-25: keep useful short sentences like „Ich schaue mich nur um.“, drop plain greetings):
    # each goes to the scene of its region and situation that has the fewest words.
    for x in read_tsv('saetze-v1.tsv'):
        region = int(x['段'])
        cands = [s for s in scene_list if s['region'] == region and s['situation'] == x['情境']] or [s for s in scene_list if s['region'] == region]
        s = min(cands, key=lambda c: len(c['words']))
        lvl = max(words_by_id[i]['lvl'] for i in s['words'])
        w = {'id': x['id'], 'de': x['德语'], 'zh': x['中文'], 'pos': x['词性'], 'family': 'echo', 'lvl': lvl, 'zone': s['zone'], 'scene': s['id'],
             'region': region, 'order': 1, 'rank': 0, 'situation': x['情境'], '_sents': []}
        if len(s['words']) >= FIRST_BATCH:
            w['batch'] = 2
        assert w['id'] not in seen, w['id']
        seen.add(w['id'])
        words.append(w)
        words_by_id[w['id']] = w
        s['words'].append(w['id'])

    # Words added to the list after the scene sheet was cut (the sheet leaves out function words on purpose,
    # so only these): next to the word ranked just before them, in a scene of the same situation with the fewest words.
    scene_by_id = {s['id']: s for s in scene_list}
    rank_scene = {w['rank']: w['scene'] for w in words if w.get('rank')}
    sheet_lemmas = {x['原形'].strip() for g in segs.values() for rows in g.values() for x in rows}
    for rk in range(1, 6001):
        r = words_tsv.get(str(rk))
        if not r or r['原形'].strip() not in ADDED_AFTER_SHEET or r['原形'].strip() in sheet_lemmas or str(rk) in used_ranks:
            continue
        prev = next((rank_scene[q] for q in range(rk - 1, 0, -1) if q in rank_scene), scene_list[0]['id'])
        region = scene_by_id[prev]['region']
        sit = r['情境']
        cands = [s for s in scene_list if s['region'] == region and s['situation'] == sit]
        if not cands:
            same = [s for s in scene_list if s['situation'] == sit]
            cands = [s for s in same if s['region'] == min(t['region'] for t in same)] if same else [scene_by_id[prev]]
        region = cands[0]['region']
        s = min(cands, key=lambda c: len(c['words']))
        lvl = max(words_by_id[i]['lvl'] for i in s['words'])
        x = {'原形': r['原形'], '排名': rk, '场景': s['group'], '语体': r['语体'], '批次': '第2批' if len(s['words']) >= FIRST_BATCH else '第1批'}
        w = card_word(rk, x, region, s['zone'], s['id'], lvl)
        words_by_id[w['id']] = w
        s['words'].append(w['id'])
        print('added from list:', r['原形'], '->', s['id'], file=sys.stderr)

    # 推后 (Lucas 2026-11-27): words the scene sheet put in A1 although no Goethe list up to B1 has them (Friedhof's
    # neighbours Ewigkeit, Seele, Kerl ...) move to a B1 scene (regions 9–12) of the same situation with the fewest
    # words. Diary blank words stay where their page is. Ids stay the same, so saves keep their progress.
    b1_scenes = [s for s in scene_list if 9 <= s['region'] <= 12 and s['region'] in MAP_REGIONS and s['words']]
    for r in read_tsv('verschoben.tsv'):
        wid = by_lemma.get(r['原形'].strip())
        w = words_by_id.get(wid)
        if not w or w['region'] > 3:
            continue
        old = scene_by_id[w['scene']]
        old['words'].remove(wid)
        cands = [s for s in b1_scenes if s['situation'] == w['situation']] or b1_scenes
        s = min(cands, key=lambda c: len(c['words']))
        w.update(region=s['region'], zone=s['zone'], scene=s['id'], lvl=max(words_by_id[i]['lvl'] for i in s['words']))
        w.pop('batch', None)
        if len(s['words']) >= FIRST_BATCH:
            w['batch'] = 2
        s['words'].append(wid)
        print('moved to B1:', w['de'], old['id'], '->', s['id'], w['lvl'], file=sys.stderr)

    # 蚀变: host scenes.
    host_of_word = {}
    for s in scene_list:
        for wid in s['words']:
            host_of_word[wid] = s['id']
    taken = {}
    eroded_out = []
    for seg, regions in ERODE_SEGS:
        lo, hi = (seg - 1) * 10 + 1, seg * 10
        hosts = [s for s in scene_list if s['region'] in regions]
        names = list(segs[seg])
        rr = 0
        for k, g in enumerate(names):
            rows = segs[seg][g]
            sit = situation_of(g)
            ladders = [by_lemma.get(re.search(r'梯子：(.+?) 的进阶说法', x.get('备注') or '').group(1).strip()) for x in rows if re.search(r'梯子：(.+?) 的进阶说法', x.get('备注') or '')]
            free = [s for s in hosts if s['id'] not in taken]
            score = defaultdict(int)
            for b in ladders:
                if b and host_of_word.get(b):
                    score[host_of_word[b]] += 1
            best = max(free, key=lambda s: (score[s['id']], s['situation'] == sit, -abs(s['region'] - (regions[rr % len(regions)]))), default=None)
            if best is None:
                print('no host for', seg, g, file=sys.stderr)
                continue
            if score[best['id']] == 0 and best['situation'] != sit:
                # Spread unmatched groups over the regions in turn.
                pick = [s for s in free if s['region'] == regions[rr % len(regions)]]
                best = pick[0] if pick else best
            rr += 1
            taken[best['id']] = seg
            ids = []
            for i, x in enumerate(rows):
                w = card_word(x['排名'], x, seg, best['zone'], best['id'], levels(lo, hi, k, len(names), i, len(rows)), erode=seg)
                ids.append(w['id'])
            eroded_out.append({'scene': best['id'], 'seg': seg, 'group': g, 'words': ids})

    # Ladder `after`: the word this one is the advanced form of.
    for w in words:
        if '_ladder' in w:
            b = by_lemma.get(w['_ladder'])
            if b and b != w['id']:
                w['after'] = b

    # ---- examples, verbs ----
    ex = {}
    conj = {}
    perf = {}
    unmarked = 0
    for w in words:
        lines = []
        for de, zh in w['_sents']:
            m = mark(de, w)
            if m:
                lines.append(f'{m}|{zh}')
        if any(not l.endswith('|') for l in lines):
            lines = [l for l in lines if not l.endswith('|')]
        if lines:
            ex[w['id']] = lines
        else:
            unmarked += 1
        if w['_sents']:
            w['ex'] = w['_sents'][0][0] + '|' + w['_sents'][0][1]
        if w['pos'] == 'v':
            c = make_conj(w['de'], w.get('three', ''))
            if c:
                conj[w['de']] = c
            p = make_perfekt(w['de'], w.get('three', ''), w['_sents'])
            if p:
                perf[w['de']] = p

    # Perfekt sentences written for verbs whose list examples have none (data/wortschatz/perfekt-v1.tsv, regions 1–3).
    # The list's three forms give aux and participle, except where they are wrong (PERFEKT_FIX).
    PERFEKT_FIX = {'schaffen': 'hat geschafft', 'auffallen': 'ist aufgefallen', 'bewegen': 'hat bewegt', 'verwenden': 'hat verwendet'}
    verbs = {w['de']: w for w in words if w['pos'] == 'v'}
    for r in read_tsv('perfekt-v1.tsv'):
        w = verbs.get(r['原形'])
        if not w or w['de'] in perf:
            continue
        three = w.get('three', '')
        if w['de'] in PERFEKT_FIX:
            three = ' · '.join([*(x.strip() for x in three.split('·')[:-1]), PERFEKT_FIX[w['de']]])
        p = make_perfekt(w['de'], three, [(r['例句'], r['中文'])])
        if p:
            perf[w['de']] = p
        else:
            print('  perfekt-v1: no match for', w['de'], three)

    # ---- scene names ----
    def short_zh(zh):
        z = re.sub(r'（.*?）|\(.*?\)', '', zh).split('；')[0].split('，')[0].strip()
        return z[:6]

    wmap = {w['id']: w for w in words}
    for s in scene_list:
        if not s['words']:
            s['name'] = s['group']
            continue
        lead = next((wmap[i] for i in s['words'] if wmap[i]['pos'] in ('n',)), wmap[s['words'][0]])
        if s['group'].startswith('文章群怪') or wmap[s['words'][0]].get('art_pool'):
            s['name'] = f'残页 · {short_zh(lead["zh"])}'
        elif '表达' in s['group']:
            s['name'] = f'{s["situation"]} · 说法'
        else:
            s['name'] = f'{s["situation"]} · {short_zh(lead["zh"])}'

    # Hand-written names for regions 1–3 (游戏设计: 场景名可改，主题不改), one per diary page. Each name goes to the
    # scene that holds most of its page's blank words, so a re-sorted scene sheet keeps names with their pages.
    cands = []
    for r in read_tsv('szenen-namen-v1.tsv'):
        ids = set(r['日记填空词'].split())
        for sc in scene_list:
            if sc['region'] == int(r['区']) and sc['words']:
                n = len(ids & set(sc['words']))
                if n >= 2:
                    cands.append((n, r['场景名'], sc['id']))
    cands.sort(key=lambda c: -c[0])
    named, name_taken = set(), set()
    by_id = {sc['id']: sc for sc in scene_list}
    for n, name, sid in cands:
        if name in named or sid in name_taken:
            continue
        by_id[sid]['name'] = name
        named.add(name)
        name_taken.add(sid)

    # ---- write ----
    def row(w):
        f = [w['id'], w['de'], w.get('art', ''), '+' if w.get('plOnly') else w.get('pl', ''), w['zh'], w['pos'], w['family'],
             str(w['lvl']), w['zone'], w['scene'], str(w['region']), str(w.get('erode', '')), str(w.get('batch', '')),
             w.get('after', ''), w.get('digit', ''), str(w['order']), str(w['rank']), w.get('reg', ''), '1' if w.get('art_pool') else '',
             w.get('ex', ''), w.get('situation', ''), w.get('cat', ''), w.get('look', ''),
             w.get('refl', ''), w.get('prep', ''), w.get('goethe', '')]
        for v in f:
            assert '\t' not in v, v
        return '\t'.join(v.replace('\t', ' ') for v in f)

    out = []
    out.append('// GENERATED by scripts/build_lexicon.py from data/wortschatz/ (6000 词表 + 《6000词进场景-第1版》). Do not edit by hand:')
    out.append('// change the TSV files or the script and run it again. Sentences: see each row of wortschatz.tsv / beispiele.tsv for its source.')
    out.append('/* eslint-disable */')
    out.append('')
    out.append('/** Fields of each map region: [zone id, 中文, Deutsch] (regions 4–12 take their names from zones.ts). */')
    out.append('export const LEX_FIELDS: Record<number, Array<[string, string, string]>> = ' + json.dumps({r: [[a, b or '', c or ''] for a, b, c in f] for r, f in fields_out.items()}, ensure_ascii=False) + ';')
    out.append('')
    out.append('/** Field scenes in route order per field: [scene id, region, field index, name, situation, word ids]. */')
    out.append('export const LEX_SCENES: Array<[string, number, number, string, string, string[]]> = [')
    for s in scene_list:
        out.append('  ' + json.dumps([s['id'], s['region'], s['field'], s['name'], s['situation'], s['words']], ensure_ascii=False) + ',')
    out.append('];')
    out.append('')
    out.append('/** 蚀变 groups: [host scene id, segment, word ids]. */')
    out.append('export const LEX_ERODED: Array<[string, 8 | 11 | 15 | 19, string[]]> = [')
    for e in eroded_out:
        out.append('  ' + json.dumps([e['scene'], e['seg'], e['words']], ensure_ascii=False) + ',')
    out.append('];')
    out.append('')
    out.append('/** Words, one tab-separated row each: id de art pl(+ = plural only) zh pos family lvl zone scene region erode batch after digit 先后 rank 语体 article-pool example(de|zh) situation cat look. */')
    out.append('export const LEX_ROWS: string = ' + json.dumps('\n'.join(row(w) for w in words), ensure_ascii=False) + ';')
    out.append('')
    out.append('/** Example sentences with the blank marked (same format as examples1.ts). */')
    out.append('export const LEX_EX: Record<string, string[]> = ' + json.dumps(ex, ensure_ascii=False, separators=(',', ':')) + ';')
    out.append('')
    out.append("/** Present tense of verbs the hand-written table lacks: 'ich du er wir ihr sie|flags' (_ = space, s = strong, p = strong past). */")
    out.append('export const LEX_CONJ: Record<string, string> = ' + json.dumps(conj, ensure_ascii=False, separators=(',', ':')) + ';')
    out.append('')
    out.append("/** Perfekt of verbs the hand-written table lacks: 'aux|pp|kind|sentence with {aux} and [pp]|中文'. */")
    out.append('export const LEX_PERFEKT: Record<string, string> = ' + json.dumps(perf, ensure_ascii=False, separators=(',', ':')) + ';')
    out.append('')
    out.append('/** Grammar words (taught by grammar play, not as monsters): [de, 词性, 中文]. */')
    out.append('export const LEX_GRAMMAR: Array<[string, string, string]> = ' + json.dumps([[g['原形'], g['词性'], g['中文']] for g in grammar], ensure_ascii=False) + ';')
    # 词族秘境 (游戏设计 四): 同根 / 近义 / 形近 from relations.tsv (word-list thread), as in-game word ids.
    rel_path = DATA / 'relations.tsv'
    rel = {}
    if rel_path.exists():
        by_rank = {}
        by_de = {}
        for w in words:
            if w.get('rank'):
                by_rank.setdefault(str(w['rank']), w['id'])
            by_de.setdefault(w['de'], w['id'])
        for r in read_tsv('relations.tsv'):
            wid = by_rank.get(r['排名']) or by_de.get(r['原形'])
            if not wid:
                continue
            cols = []
            for c in ('同根', '近义', '形近'):
                ids = []
                for lem in (r.get(c) or '').split('|'):
                    o = by_de.get(lem.strip())
                    if o and o != wid and o not in ids:
                        ids.append(o)
                cols.append(ids)
            if any(cols):
                rel[wid] = cols
    out.append('')
    out.append('/** 词族秘境: [同根, 近义, 形近] as word ids (relations.tsv). */')
    out.append('export const LEX_REL: Record<string, [string[], string[], string[]]> = ' + json.dumps(rel, ensure_ascii=False, separators=(',', ':')) + ';')
    OUT.write_text('\n'.join(out) + '\n', encoding='utf-8')

    # 听段 (34 级): hoeren-6000.tsv from the proofreading thread, matched to a word by 排名 (then by lemma).
    by_rank = {w['rank']: w['id'] for w in words if w.get('rank')}
    by_lemma = {}
    for w in words:
        by_lemma.setdefault(w['de'], w['id'])
    passages, missed = [], 0
    if (DATA / 'hoeren-6000.tsv').exists():
        for i, r in enumerate(read_tsv('hoeren-6000.tsv')):
            wid = by_rank.get(int(r['排名'])) if (r.get('排名') or '').isdigit() else None
            wid = wid or by_lemma.get(r['原形'].strip())
            lines = [x.strip() for x in r['例句'].split('｜') if x.strip()]
            if not wid or not lines or not r['答案'].strip() or not r['错项1'].strip() or not r['错项2'].strip():
                missed += 1
                continue
            passages.append({'id': f'h{i + 1}', 'wordId': wid, 'lines': lines, 'zh': r['例句中文'].strip(), 'q': r['问题'].strip(), 'qZh': r['问题中文'].strip(),
                             'answer': r['答案'].strip(), 'wrong': [r['错项1'].strip(), r['错项2'].strip()]})
    POUT = ROOT / 'src' / 'data' / 'passages-gen.ts'
    POUT.write_text('// GENERATED by scripts/build_lexicon.py from data/wortschatz/hoeren-6000.tsv. Do not edit by hand.\n/* eslint-disable */\n'
                    'import type { Passage } from \'./passages\';\n\nexport const PASSAGE_ROWS: Passage[] = '
                    + json.dumps(passages, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(f'passages {len(passages)} (unmatched {missed})')

    # Report.
    print(f'words {len(words)}, scenes {len(scene_list)}, eroded groups {len(eroded_out)}, examples {len(ex)} (no marked sentence: {unmarked}), conj {len(conj)}, perfekt {len(perf)}')
    for region in MAP_REGIONS:
        sc = [s for s in scene_list if s['region'] == region]
        per = defaultdict(int)
        for s in sc:
            per[s['field']] += 1
        sizes = [len(s['words']) for s in sc]
        print(f'  region {region}: {len(sc)} scenes, fields {dict(per)}, words {sum(sizes)} ({min(sizes, default=0)}–{max(sizes, default=0)} per scene), eroded hosts {sum(1 for s in sc if s["id"] in taken)}')


if __name__ == '__main__':
    main()
