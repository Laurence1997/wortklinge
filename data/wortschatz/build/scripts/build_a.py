import json,sys,glob,math,collections,wordfreq,re
S=sys.argv[1]
nouns=json.load(open(f'{S}/work/nouns.json'))
cand={}
for line in open(f'{S}/work/cand.tsv',encoding='utf-8'):
    rk,l,g,pl,forms,fs,fw=line.rstrip('\n').split('\t')
    cand[rk]={'l':l,'fs':float(fs),'fw':float(fw)}
sub={}
for line in open(f'{S}/dl/de_50k.txt',encoding='utf-8'):
    w,c=line.rsplit(' ',1); sub[w]=int(c)
TOT=sum(sub.values())
def score(fs,fw): return math.sqrt(max(fs,1e-9)*max(fw,1e-9))
def own_score(lemma):
    lw=lemma.lower()
    return score(sub.get(lw,0)/TOT, wordfreq.word_frequency(lw,'de'))
entries={}; order=[]
def add(lemma,pos,zh,sc,src,film=False):
    if pos=='n': lemma=lemma[0].upper()+lemma[1:]
    elif not any(c.isupper() for c in lemma[1:]) and lemma not in ('Sie',): lemma=lemma[0].lower()+lemma[1:] if pos!='n' else lemma
    key=lemma
    if key in entries:
        e=entries[key]
        if sc>e['sc']: e['sc']=sc
        return e
    e={'lemma':lemma,'pos':pos,'zh':zh,'sc':sc,'src':src,'film':film,'life':False}
    entries[key]=e; order.append(key); return e
for f in sorted(glob.glob(f'{S}/rev/b0*.txt')):
    for line in open(f,encoding='utf-8'):
        line=line.strip()
        if not line: continue
        p=line.split('|')
        rk,pos=p[0],p[1]
        if pos=='x': continue
        film=pos.endswith('!'); pos=pos.rstrip('!')
        zh=p[2]; over=p[3] if len(p)>3 else None
        base=rk.rstrip('b')
        c=cand[base]
        lemma=over or c['l']
        if rk.endswith('b'): sc=own_score(lemma)
        else: sc=score(c['fs'],c['fw'])
        add(lemma,pos,zh,sc,'freq',film)
# life list
s_sorted=sorted(e['sc'] for e in entries.values())[::-1]
floor=s_sorted[4500]
life_new=0
for line in open(f'{S}/rev/life.txt',encoding='utf-8'):
    lemma,pos,zh=line.strip().split('|')
    key=lemma if pos=='n' else lemma
    if key in entries:
        e=entries[key]; e['sc']=max(e['sc']*3, floor); e['life']=True
    else:
        e=add(lemma,pos,zh,max(own_score(lemma)*3,floor),'life'); e['life']=True; life_new+=1
for e in entries.values():
    e['adj']=e['sc']*(0.35 if e['film'] else 1)
L=sorted(entries.values(),key=lambda e:-e['adj'])
for i,e in enumerate(L): e['rank']=i+1
json.dump(L,open(f'{S}/work/ranked.json','w'),ensure_ascii=False)
print(len(L),'life new',life_new)
print(collections.Counter(e['pos'] for e in L[:6000]))
print([e['lemma'] for e in L[:60]])
print([e['lemma'] for e in L[5990:6010]])
