import csv,json,math,sys
from openpyxl import Workbook
from openpyxl.styles import Font,PatternFill
from openpyxl.utils import get_column_letter
S=sys.argv[1];OUT=sys.argv[2]
rows=list(csv.DictReader(open('/mnt/project-files/wortklinge-data/verben-mit-praeposition.csv',encoding='utf-8-sig')))
ann=[l.rstrip('\n').split('|') for l in open(f'{S}/vp/ann.txt',encoding='utf-8')]
fin=json.load(open(f'{S}/work/final.json'));rk={o['lemma']:o['rank'] for o in fin}
INF={'geht':'gehen','fehlt':'fehlen','liegt':'liegen','mangelt':'mangeln','handelt':'handeln'}
LV={'A1':0,'A2':1,'B1':2,'B2':3,'C1':4,'C2':5}
KZ={'A':'Akk.','D':'Dat.','G':'Gen.','N':'Nom.'}
out=[]
for r,a in zip(rows,ann):
  i,fix,zh,ex,exzh=a
  if fix=='drop': continue
  v=r['verb'].replace('|','');inf=INF.get(v,v)
  refl=r['reflexiv'] or ('sich' if fix=='reflexiv' else '')
  k=r['kasus'];note=''
  if '待校对' in k: k=fix;note='格已校正（原表待校对）'
  weak=fix=='weak'
  z=r['zusatz'].strip()
  obj='jdn./etw. ' if z.startswith('+ A') or z.startswith('+A') else ('jdm. ' if z.startswith('+ D') else '')
  if inf in ('gehen','fehlen','liegen','mangeln') and refl=='es': pat=f"es {r['verb'].split('|')[-1]} {r['praeposition']} + {KZ[k]}"
  elif v=='handelt' and refl=='es': pat=f"es handelt sich {r['praeposition']} + {KZ[k]}"
  elif v=='handelt': pat=f"(Buch/Film) handelt {r['praeposition']} + {KZ[k]}"
  else: pat=f"{(refl+' ') if refl and refl!='es' else ''}{obj}{inf} {r['praeposition']} + {KZ[k]}"
  rank=rk.get(inf) or rk.get(inf.capitalize())
  score=LV[r['level']]*2+(math.log10(rank) if rank else 4.5)+(3 if weak else 0)
  out.append(dict(prep=r['praeposition'],k=KZ[k],pat=pat,verb=inf,refl='是' if refl=='sich' else '',zh=zh,ex=ex,exzh=exzh,lvl=r['level'],rank=rank or '',score=score,
    note=('不算固定搭配（介词是普通用法），排在后面' if weak else note)))
# prep order: by number of useful entries weighted
from collections import defaultdict
g=defaultdict(list)
for o in out: g[o['prep']].append(o)
pw={p:sum(max(0,8-o['score']) for o in L) for p,L in g.items()}
order=sorted(g,key=lambda p:-pw[p])
wb=Workbook();ws=wb.active;ws.title='动介搭配（按介词分组）'
H=['介词顺序','介词','格','组内顺序','搭配','中文','例句','例句中文','反身(双锁)','动词词频排名','原表等级','备注']
ws.append(H)
hf=Font(bold=True,color='FFFFFF');fill=PatternFill('solid',fgColor='7A1F1F')
for c in ws[1]:c.font=hf;c.fill=fill
summ=[]
for pi,p in enumerate(order,1):
  L=sorted(g[p],key=lambda o:o['score'])
  summ.append((pi,p,len(L),sum(1 for o in L if o['lvl'] in('A1','A2','B1') and 'weak' not in o['note'] and not o['note'].startswith('不算')),', '.join(o['verb'] for o in L[:6])))
  for j,o in enumerate(L,1):
    ws.append([pi,p,o['k'],j,o['pat'],o['zh'],o['ex'],o['exzh'],o['refl'],o['rank'],o['lvl'],o['note']])
ws.freeze_panes='F2';ws.auto_filter.ref=ws.dimensions
for i,w in enumerate([8,8,6,8,34,24,52,30,10,12,8,26],1):ws.column_dimensions[get_column_letter(i)].width=w
w2=wb.create_sheet('介词汇总');w2.append(['建议楼层顺序','介词','搭配数','A1–B1 常用数','最常用的几个'])
for c in w2[1]:c.font=hf;c.fill=fill
for s in summ:w2.append(list(s))
for i,w in enumerate([12,8,8,12,70],1):w2.column_dimensions[get_column_letter(i)].width=w
w3=wb.create_sheet('说明')
for a,b in [('来源','/mnt/project-files/wortklinge-data/verben-mit-praeposition.csv（311 条）'),('改动','去掉 1 条重复（auswirken 不带 sich）；校正 25 条「A/D 待校对」的格；sich aussprechen gegen 补上 sich。'),
 ('排序','先按介词分组，组的顺序按常用搭配多少排（可当介词秘境楼层顺序）；组内按「原表等级 + 动词词频」排，最实用的在前。'),
 ('反身(双锁)','动词带 sich 又带介词的，标「是」，可给镜像怪/双锁精英用。'),('例句','例句是自写的，未校对，之后统一走 LanguageTool + DeepSeek 校对。'),
 ('不算固定搭配','如 fahren mit（坐车）、fließen durch，介词只是普通用法，标出来放在组末尾，建议秘境里不用。')]:
  w3.append([a,b])
w3.column_dimensions['A'].width=14;w3.column_dimensions['B'].width=110
wb.save(f'{OUT}/动介搭配.xlsx')
json.dump(out,open(f'{S}/vp/vp.json','w'),ensure_ascii=False)
print(len(out));[print(s) for s in summ]
