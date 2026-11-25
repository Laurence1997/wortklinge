import json
from collections import defaultdict
def lev1(a,b):
  if a==b: return False
  la,lb=len(a),len(b)
  if abs(la-lb)>1: return False
  if la==lb:
    d=[i for i in range(la) if a[i]!=b[i]]
    if len(d)==1: return True
    if len(d)==2 and d[1]==d[0]+1 and a[d[0]]==b[d[1]] and a[d[1]]==b[d[0]]: return True  # swap ie/ei
    return False
  if la>lb: a,b=b,a
  i=0
  while i<len(a) and a[i]==b[i]: i+=1
  return a[i:]==b[i+1:]
UM=str.maketrans('äöü','aou')
def xing(rows,FAM):
  top=[o for o in rows if o['rank']<=6000 and len(o['lemma'])>=4]
  L=[(o['lemma'],o['lemma'].lower()) for o in top]
  by=defaultdict(list)
  for w,l in L: by[len(l)].append((w,l))
  res=defaultdict(list)
  for w,l in L:
    for n in (len(l)-1,len(l),len(l)+1):
      for w2,l2 in by.get(n,[]):
        if w2<=w: continue
        um=(l!=l2 and l.translate(UM)==l2.translate(UM))
        if not (um or lev1(l,l2)): continue
        if not um and l[0]!=l2[0]: continue          # rhymes like mein/dein are easy to tell apart
        if not um and min(len(l),len(l2))<5: continue
        s,t=sorted((l,l2),key=len)
        if len(s)<len(t) and (t.startswith(s) or t.endswith(s)): continue   # Freund/Freunde, Tag/Etag
        if l[:-2]==l2[:-2] and {l[-2:],l2[-2:]}=={'er','en'}: continue   # Forscher/forschen
        if FAM.get(w) and FAM.get(w)==FAM.get(w2): continue
        res[w].append(w2); res[w2].append(w)
  return {k:'/'.join(v[:5]) for k,v in res.items()}
