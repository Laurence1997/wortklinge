import json,sys,os,csv
from openpyxl import Workbook
from openpyxl.styles import Font,PatternFill,Alignment
from openpyxl.utils import get_column_letter
W,OUT=sys.argv[1],sys.argv[2]
rows=json.load(open(f'{W}/final.json'));rem2=json.load(open(f'{W}/removed2.json'))
cand={}
for l in open(f'{W}/cand.tsv',encoding='utf-8'):
  p=l.rstrip('\n').split('\t');cand[p[0]]=p
RS={'name':'人名','en':'英语词','vulgar':'粗话','colloq':'口语缩写/方言','abbr':'缩写','junk':'字幕杂词','contr':'缩合形式（如 gibts）'}
rem=[]
import glob
for f in sorted(glob.glob(f'{W}/../rev/b0*.txt')):
  for l in open(f,encoding='utf-8'):
    p=l.strip().split('|')
    if len(p)>=3 and p[1]=='x' and p[0].isdigit() and int(p[0])<=7000 and p[2] in RS:
      c=cand.get(p[0]);rem.append((int(p[0]),c[1] if c else '',RS[p[2]],''))
rem.sort()
POS={'n':'名词','v':'动词','adj':'形容词','adv':'副词','prep':'介词','konj':'连词','pron':'代词','art':'冠词','num':'数词','int':'感叹词','part':'小品词'}
H=['排名','卡片','原形','冠词','复数','属格(仅不规则)','动词三形','比较级(仅不规则)','词性','中文','标签','游戏里已有','例句','例句中文','例句出处','来源','备注','词族','近义词组']
import re as _re
_verbs={o['lemma'] for o in rows if o['pos']=='v'}
_PRE=sorted(['ab','an','auf','aus','bei','ein','fest','her','hin','los','mit','nach','vor','weg','zu','zurück','zusammen','weiter','vorbei','herum','hinaus','heraus','herein','hinein','fern','frei','hoch','statt','teil','um','durch','über','unter','wieder','fort','heim','dar','be','ver','er','ent','zer','ge','miss','emp','hinter','wider','voll','herunter','hinunter','herauf','hinauf','rüber','raus','rein','runter','entgegen','voran','voraus','dazu','dabei','davon'],key=len,reverse=True)
def _root(v):
  for p in _PRE:
    if v.startswith(p) and len(v)-len(p)>=4 and v[len(p):] in _verbs: return v[len(p):]
  return ''
FAM={}
for o in rows:
  if o['pos']=='v':
    b=_root(o['lemma'])
    if b: FAM[o['lemma']]=b; FAM.setdefault(b,b)
def _key(z):
  z=_re.sub(r'（.*?）|\(.*?\)','',z); return _re.split(r'[；;，,/]',z)[0].strip()
from collections import defaultdict as _dd
_g=_dd(list)
for o in rows:
  if o['rank']<=6000: _g[(o['pos'],_key(o['zh']))].append(o['lemma'])
SYN={}
for (p,k),L in _g.items():
  if k and len(L)>1:
    for l in L: SYN[l]=k+'：'+'/'.join(L[:6])
BSP={}
for r in csv.DictReader(open('/home/user/wortklinge/data/wortschatz/beispiele.tsv',encoding='utf-8'),delimiter='\t'): BSP[r['原形']]=r
def rowv(o):
  b=BSP.get(o['lemma']) or BSP.get(o['lemma'].lower()) or {}
  return [o['rank'],o['disp'],o['lemma'],o['art'],o['pl'],o['gen'],o['vf'],o['cmp'],POS.get(o['pos'],o['pos']),o['zh'],'、'.join(o['tags']),'是' if o['game'] else '',b.get('例句',''),b.get('例句中文',''),b.get('例句出处',''),o['src'],o['note'],FAM.get(o['lemma'],''),SYN.get(o['lemma'],'')]
wb=Workbook()
hf=Font(bold=True,color='FFFFFF');fill=PatternFill('solid',fgColor='7A1F1F')
def sheet(ws,head,data,widths):
  ws.append(head)
  for c in ws[1]: c.font=hf;c.fill=fill;c.alignment=Alignment(vertical='center')
  for d in data: ws.append(d)
  ws.freeze_panes='C2' if head is H else 'A2';ws.auto_filter.ref=ws.dimensions
  for i,w in enumerate(widths,1): ws.column_dimensions[get_column_letter(i)].width=w
WD=[6,42,18,8,16,14,34,22,7,26,18,9,40,30,12,8,16,12,30]
top=[o for o in rows if o['rank']<=6000];res=[o for o in rows if 6000<o['rank']<=8000]
ws=wb.active;ws.title='前6000（游戏用）';sheet(ws,H,[rowv(o) for o in top],WD)
sheet(wb.create_sheet('6001-8000（备用）'),H,[rowv(o) for o in res],WD)
sheet(wb.create_sheet('已删除'),['原排名','词','删除原因','中文'],[(x['oldrank'],x['lemma'],x['reason'],x['zh']) for x in rem2]+[(a,b,c,d) for a,b,c,d in rem],[8,22,40,20])
info=[('说明',''),('排序','字幕词频（FrequencyWords / OpenSubtitles 2018）和 wordfreq（多语料）几何平均；影视味重的词降权；「在德国生活」常用词表提权。'),
('前 6000','以后进游戏的词；6001–8000 留给 121 级以后的文章模式。'),
('卡片','名词：冠词 + 单数 + 复数；只有不规则（弱变化等）才写属格。动词：三单现在时 · 过去式 · 完成时。形容词：只有不规则才写比较级。'),
('标签','基础=最常用打招呼/功能词；生活=德国生活场景；影视=字幕里偏多、日常少；不规则/可分/sein=动词；弱变化=名词属格不规则；地名。'),
('待校','动词变化和名词复数是自动从开源词典生成的，个别会错。'),('例句','大部分来自 Tatoeba 母语者句子（CC BY 2.0 FR，出处列有编号和作者）；前 3000 词缺中文的已自译；找不到合适句子的词是自写（标「自写」）。之后统一过 LanguageTool + DeepSeek 校对。'),
('词族/近义词组','自动生成的候选：词族=同一个基础动词加前缀（anmachen/ausmachen → machen）；近义词组=词性相同、第一个中文释义相同。分场景时同组的词不放进同一个场景（Lucas 定）。会有误分组，可直接改。'),('修改方法','直接在表里改、删行、加行都行（新加的词排名留空或填数字）。改完把 xlsx 发回来，脚本会导回仓库。不要改列名。'),
('',''),('数据来源和许可',''),
('FrequencyWords','hermitdave/FrequencyWords，OpenSubtitles 2018 德语，CC BY-SA 4.0'),
('wordfreq','rspeer/wordfreq 数据，CC BY-SA 4.0'),
('german-nouns','gambolputty/german-nouns（来自 Wiktionary），CC BY-SA 4.0'),
('german-verbs','german-verbs / german-verbs-dict（来自 german-pos-dict），Apache-2.0 / CC BY-SA'),
('Tatoeba','tatoeba.org 例句，CC BY 2.0 FR，保留句子编号和作者'),('本表','以上派生，按 CC BY-SA 4.0 发布。中文释义为自写。')]
ws=wb.create_sheet('说明和来源')
for a,b in info: ws.append([a,b])
ws.column_dimensions['A'].width=18;ws.column_dimensions['B'].width=110
for c in ws['A']: c.font=Font(bold=True)
os.makedirs(OUT,exist_ok=True)
wb.save(f'{OUT}/德语常用词-8000.xlsx')
with open(f'{OUT}/德语助手-前6000.txt','w',encoding='utf-8') as f: f.write('\n'.join(o['lemma'] for o in top)+'\n')
with open(f'{OUT}/德语助手-6001-8000.txt','w',encoding='utf-8') as f: f.write('\n'.join(o['lemma'] for o in res)+'\n')
print(len(top),len(res),len(rem2)+len(rem))
