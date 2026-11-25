import simplemma, wordfreq, collections, json, sys, math
S=sys.argv[1]
nouns=json.load(open(f'{S}/work/nouns.json'))
sub=collections.Counter()
for line in open(f'{S}/dl/de_50k.txt',encoding='utf-8'):
    w,c=line.rsplit(' ',1); sub[w]=int(c)
tot_sub=sum(sub.values())
KEEP={'bitte','danke','hallo','tschüss','ja','nein','okay','mal','ich','nichts','ach','na','ganz','morgen','weg','heute','gestern','sorry','hey','oh','genau','klar','super','toll','also'}
cache={}
PROT={'sein','haben','werden','können','müssen','wollen','sollen','dürfen','mögen','wissen','geben','gehen','kommen','sagen','tun','lassen','sehen'}
def lem(w):
    if w in cache: return cache[w]
    if w in KEEP: r=w
    else:
        lv=simplemma.lemmatize(w,lang='de').lower()
        ln=simplemma.lemmatize(w.capitalize(),lang='de')
        r=lv
        if ln in nouns and 'adjektivische' not in nouns[ln]['pos'] and ln.lower()!=lv and lv not in PROT:
            s=ln.lower()
            if (w==s or sub.get(s,0)>=sub.get(w,0)) and sub.get(s,0)>2*sub.get(lv,0):
                r=ln
    cache[w]=r; return r
lsub=collections.Counter(); forms=collections.defaultdict(list)
for w,c in sub.items():
    l=lem(w); lsub[l]+=c; forms[l].append((w,c))
lwf=collections.Counter()
for w in wordfreq.top_n_list('de',80000):
    lwf[lem(w)]+=wordfreq.word_frequency(w,'de')
rows=[]
for l in set(lsub)|set(lwf):
    fs=lsub[l]/tot_sub; fw=lwf[l]
    if fs==0 and fw==0: continue
    rows.append({'l':l,'fs':fs,'fw':fw,'sc':math.sqrt(max(fs,1e-9)*max(fw,1e-9)),
                 'known':simplemma.is_known(l,'de') or l in nouns,'forms':[f for f,_ in sorted(forms[l],key=lambda x:-x[1])[:4]]})
rows.sort(key=lambda x:-x['sc'])
json.dump(rows[:12000],open(f'{S}/work/step2.json','w'),ensure_ascii=False)
for i,r in enumerate(rows[:12000]):
    pass
print(len(rows))
