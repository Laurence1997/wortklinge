import json,re,sys
known=set(json.load(open('known.json')))
sel=json.load(open('sel.json'))
def load(pid):
  d=json.load(open(f'ex/{pid}.json')); p=list(d['query']['pages'].values())[0]; return p['extract']
out={}
for r,items in sel.items():
  for k,(pid,title,rev,cov) in enumerate(items,1):
    t=load(pid)
    t=re.split(r'\n==+ ?(Weblinks|Siehe auch|Einzelnachweise|Quellen)',t)[0]
    paras=[]
    for blk in re.split(r'\n+',t):
      blk=blk.strip()
      if not blk or blk.startswith('=='): continue
      paras.append(blk)
    keep=[];n=0
    for p in paras:
      w=len(p.split())
      if n>=200 and n+w>400: break
      if n+w>430 and n>=150: break
      keep.append(p); n+=w
    # merge tiny paras
    unk=sorted({x for x in re.findall(r"[A-Za-zÄÖÜäöüß-]+",' '.join(keep)) if x.lower() not in known and not x.lower().strip('-') in known})
    out[f'b1-{int(r):02d}-{k:03d}']=dict(seg=int(r),title=title,rev=rev,pid=pid,de=keep,words=n,unk=unk)
json.dump(out,open('trimmed.json','w'),ensure_ascii=False,indent=0)
import collections; print(collections.Counter(v['words']//50*50 for v in out.values()))
