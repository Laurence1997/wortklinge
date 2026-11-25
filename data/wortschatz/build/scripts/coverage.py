import json,simplemma,sys,collections
from wordfreq import word_frequency
S=sys.argv[1]
f=json.load(open(S+'/work/final.json'))
rank={}
for r in f:
    l=r['lemma'].lower()
    if l not in rank: rank[l]=r['rank']
CONTR=set('im am zum zur vom beim ins ans aufs fürs ums durchs übers unters vors hinters'.split())
INTJ=set('oh hey ok okay äh ähm hm hmm wow ah aha ha haha uh ne nee nen nem n m mhm na ach tja naja jo yeah hi hallo tschüss pst au autsch huch ups igitt'.split())
EXTRA={}
def addx(form,r):
    form=form.lower()
    if form and (form not in EXTRA or EXTRA[form]>r): EXTRA[form]=r
END=['','e','en','er','es','em']
for x in f:
    r=x['rank']
    if x['pos']=='v' and x['vf']:
        p=[t.strip() for t in x['vf'].split('·')]
        if len(p)==3:
            s3=p[0].split()[0]; addx(s3,r); addx(s3[:-1]+'st',r); addx(s3[:-1]+'e',r)
            pr=p[1].split()[0]
            for e in ['','e','st','en','t','est','et']: addx(pr+e,r)
            pp=p[2].split()[-1]
            for e in END: addx(pp+e,r)
    if x['pos']=='adj':
        for e in END: addx(x['lemma']+e,r)
        for c in x['cmp'].replace('am ','').split(','):
            c=c.strip()
            for e in END: addx(c+e,r)
def lr(w):
    w=w.replace('ss','ß') if w not in rank and w.replace('ss','ß') in rank else w
    best=EXTRA.get(w)
    for e in ('e','en','er','es','em','n','s'):
        if w.endswith(e) and len(w)>len(e)+2:
            r=rank.get(w[:-len(e)]) or EXTRA.get(w[:-len(e)])
            if r and (best is None or r<best): best=r
    for c in (w, w.capitalize()):
        for x in (c, simplemma.lemmatize(c,lang='de')):
            r=rank.get(x.lower())
            if r and (best is None or r<best): best=r
    return best
def lemma_of(w):
    for c in (w.capitalize(), w):
        x=simplemma.lemmatize(c,lang='de')
        if x.lower()!=w or c==w: return x.lower()
    return w
def known_part(p,K):
    r=lr(p); return r and r<=K
def compound(w,K):
    for i in range(3,len(w)-2):
        a,b=w[:i],w[i:]
        if not known_part(b,K): continue
        for a2 in (a, a[:-1] if a[-1:] in 'sn' else None, a[:-2] if a[-2:] in ('en','er','es') else None):
            if a2 and len(a2)>=3 and known_part(a2,K): return True
    return False
def foreign(w):
    return word_frequency(w,'en')>3*word_frequency(w,'de') and word_frequency(w,'en')>1e-6
fw=[]
for i,line in enumerate(open(S+'/dl/fw_full.txt')):
    if i>=200000: break
    w,c=line.split()
    if w.isalpha(): fw.append((w,int(c)))
tot=sum(c for _,c in fw)
K=6000
cat=collections.Counter(); miss=collections.Counter()
for w,c in fw:
    r=lr(w)
    if r and r<=K: cat['list']+=c
    elif w in CONTR: cat['contr']+=c
    elif w in INTJ: cat['intj']+=c
    elif foreign(w): cat['foreign/name']+=c
    elif r: cat['rank6001+']+=c; miss[(lemma_of(w),r)]+=c
    elif compound(w,K): cat['compound']+=c
    else: cat['other']+=c; miss[(lemma_of(w),None)]+=c
for k,v in cat.most_common(): print(k, round(100*v/tot,2))
json.dump([[l,r,c] for (l,r),c in miss.most_common(3000)],open(S+'/miss.json','w'),ensure_ascii=False)
acc=0
for n,((l,r),c) in enumerate(miss.most_common(3000),1):
    acc+=c
    if n in (100,250,500,1000,2000,3000): print('add',n,'->',round(100*acc/tot,2))
print(' '.join(f"{l}:{r}:{100*c/tot:.3f}" for (l,r),c in miss.most_common(400)))
