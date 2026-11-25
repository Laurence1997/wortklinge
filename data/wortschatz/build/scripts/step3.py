import json,sys,re,math
S=sys.argv[1]
rows=json.load(open(f'{S}/work/step2.json'))
nouns=json.load(open(f'{S}/work/nouns.json'))
by={}
for r in rows:
    l=r['l']
    if not re.fullmatch(r"[a-zA-ZäöüÄÖÜß\-]+",l) or len(l)<2 and l not in ('a',): continue
    key=l
    if l.islower() and l.capitalize() in nouns and any(x['l']==l.capitalize() for x in rows[:12000] if x['l'][0].isupper()) : key=l.capitalize()
    if key in by:
        b=by[key]; b['fs']+=r['fs']; b['fw']+=r['fw']; b['forms']+=r['forms']
    else: by[key]=dict(r,l=key)
out=sorted(by.values(),key=lambda r:-math.sqrt(max(r['fs'],1e-9)*max(r['fw'],1e-9)))[:10000]
with open(f'{S}/work/cand.tsv','w') as f:
    for i,r in enumerate(out):
        n=nouns.get(r['l'])
        g='/'.join(n['g']) if n else ''; pl=(n['pl'][0] if n and n['pl'] else '')
        f.write(f"{i+1}\t{r['l']}\t{g}\t{pl}\t{','.join(dict.fromkeys(r['forms']))[:40]}\t{r['fs']:.3g}\t{r['fw']:.3g}\n")
print(len(out))
