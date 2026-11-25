import json,re,sys
W=sys.argv[1]
r=json.load(open(f'{W}/ranked2.json'));N=json.load(open(f'{W}/nouns.json'));NX=json.load(open(f'{W}/nouns_extra.json'))
V=json.load(open(f'{W}/verbparts3.json'));G=json.load(open(f'{W}/../game_words.json'))
DROP={'Toto','Strauss','Wiking'}
r=[x for x in r if x['lemma'] not in DROP]
for i,x in enumerate(r): x['rank']=i+1; x['oldrank']=i+1
VFIX={'verarschen':('verarscht','verarschte','hat verarscht'),'kotzen':('kotzt','kotzte','hat gekotzt'),'verpissen':('verpisst','verpisste','hat verpisst'),'bestimmen':('bestimmt','bestimmte','hat bestimmt'),'äußern':('äußert','äußerte','hat geäußert'),'stoßen':('stößt','stieß','hat gestoßen'),'schmeißen':('schmeißt','schmiss','hat geschmissen'),'klarkommen':('kommt klar','kam klar','ist klargekommen'),'rumhängen':('hängt rum','hing rum','hat rumgehangen'),'jobben':('jobbt','jobbte','hat gejobbt'),'ausflippen':('flippt aus','flippte aus','ist ausgeflippt'),'pinkeln':('pinkelt','pinkelte','hat gepinkelt'),'runtergehen':('geht runter','ging runter','ist runtergegangen'),'raufgehen':('geht rauf','ging rauf','ist raufgegangen'),'rüberkommen':('kommt rüber','kam rüber','ist rübergekommen'),'reinschauen':('schaut rein','schaute rein','hat reingeschaut'),'draufhaben':('hat drauf','hatte drauf','hat draufgehabt'),'dranbleiben':('bleibt dran','blieb dran','ist drangeblieben'),'rumsitzen':('sitzt rum','saß rum','hat rumgesessen'),'kaputtgehen':('geht kaputt','ging kaputt','ist kaputtgegangen'),'kaputtmachen':('macht kaputt','machte kaputt','hat kaputtgemacht'),'saubermachen':('macht sauber','machte sauber','hat saubergemacht'),'abwaschen':('wäscht ab','wusch ab','hat abgewaschen'),'bügeln':('bügelt','bügelte','hat gebügelt'),'übergeben':('übergibt','übergab','hat übergeben'),'umgeben':('umgibt','umgab','hat umgeben'),
 'überdenken':('überdenkt','überdachte','hat überdacht'),'überfluten':('überflutet','überflutete','hat überflutet'),
 'überspringen':('überspringt','übersprang','hat übersprungen'),'wiedererkennen':('erkennt wieder','erkannte wieder','hat wiedererkannt'),
 'durchsuchen':('durchsucht','durchsuchte','hat durchsucht'),'weichen':('weicht','wich','ist gewichen'),'ausweichen':('weicht aus','wich aus','ist ausgewichen'),'ertönen':('ertönt','ertönte','hat ertönt'),'scannen':('scannt','scannte','hat gescannt'),
 'hinzufügen':('fügt hinzu','fügte hinzu','hat hinzugefügt'),'vorbeikommen':('kommt vorbei','kam vorbei','ist vorbeigekommen'),
 'herausstellen':('stellt heraus','stellte heraus','hat herausgestellt'),'vorhersagen':('sagt vorher','sagte vorher','hat vorhergesagt'),
 'herausgeben':('gibt heraus','gab heraus','hat herausgegeben'),'abbiegen':('biegt ab','bog ab','ist abgebogen')}
for k,(a,b,c) in VFIX.items(): V[k]={'p3':a,'pr':b,'pf':c}
ART={'m':'der','f':'die','n':'das'}
# manual nouns: lemma -> (genus or 'pl', plural)
NM={'Bauchschmerzen':('pl','',''),'Halsschmerzen':('pl','',''),'Paprika':('f','Paprikas',''),'Beamte':('m','Beamten','adj'),'Polizeibeamte':('m','Polizeibeamten','adj'),'Bürgeramt':('n','Bürgerämter',''),
 'Handyvertrag':('m','Handyverträge',''),'Kundennummer':('f','Kundennummern',''),'Versichertenkarte':('f','Versichertenkarten',''),
 'Öffnungszeiten':('pl','',''),'Unterlagen':('pl','',''),'Finanzen':('pl','',''),'Zinsen':('pl','',''),'Klamotten':('pl','',''),
 'Kopfschmerzen':('pl','',''),'Dreharbeiten':('pl','',''),'Handschellen':('pl','',''),'Streitkräfte':('pl','',''),
 'Ki':('f','',''),'Deutschland':('n','','topo'),'Erwachsene':('m','Erwachsenen','adj'),'Bekannte':('m','Bekannten','adj'),'Verwandte':('m','Verwandten','adj'),'Jugendliche':('m','Jugendlichen','adj'),'Fremde':('m','Fremden','adj'),'Kranke':('m','Kranken','adj'),'Tote':('m','Toten','adj'),'Verletzte':('m','Verletzten','adj'),'Behinderte':('m','Behinderten','adj'),'Angestellte':('m','Angestellten','adj'),'Deutsche':('m','Deutschen','adj'),'Metro':('f','Metros',''),'Shirt':('n','Shirts',''),'Turbo':('m','Turbos',''),
 'Schweiz':('f','',''),'Türkei':('f','',''),'Ukraine':('f','',''),'Slowakei':('f','',''),'Mongolei':('f','',''),'Donau':('f','',''),
 'Ostsee':('f','',''),'Nordsee':('f','',''),'Atlantik':('m','',''),'Pazifik':('m','',''),'Vatikan':('m','',''),'Iran':('m','',''),'Irak':('m','',''),
 'Philippinen':('pl','',''),'Niederlande':('pl','',''),'Alpen':('pl','',''),'Usa':('pl','',''),'Antarktis':('f','',''),'Arktis':('f','','')}
FIXCASE={'Usa':'USA','Ki':'KI','Sms':'SMS','Gmbh':'GmbH','Cd':'CD','Dvd':'DVD','Wlan':'WLAN','Wg':'WG','Suv':'SUV','Tv':'TV','Pc':'PC','Ok':'OK','Eu':'EU','Dna':'DNA','Fbi':'FBI','Cia':'CIA','Usb':'USB','Pdf':'PDF','Ddr':'DDR','Brd':'BRD','Bmw':'BMW','Ubahn':'U-Bahn','Sbahn':'S-Bahn','Lkw':'LKW','Pkw':'PKW','Ice':'ICE','Atm':'ATM'}
ADJ={'gut':'besser, am besten','viel':'mehr, am meisten','gern':'lieber, am liebsten','hoch':'höher, am höchsten','nah':'näher, am nächsten',
 'groß':'größer, am größten','alt':'älter, am ältesten','jung':'jünger, am jüngsten','kurz':'kürzer, am kürzesten','lang':'länger, am längsten',
 'warm':'wärmer, am wärmsten','kalt':'kälter, am kältesten','stark':'stärker, am stärksten','schwach':'schwächer, am schwächsten',
 'arm':'ärmer, am ärmsten','hart':'härter, am härtesten','klug':'klüger, am klügsten','dumm':'dümmer, am dümmsten','scharf':'schärfer, am schärfsten',
 'oft':'öfter, am öftesten','krank':'kränker, am kränksten','gesund':'gesünder, am gesündesten','bald':'eher, am ehesten','wenig':'weniger, am wenigsten',
 'grob':'gröber, am gröbsten','schmal':'schmaler/schmäler, am schmalsten','nass':'nasser/nässer, am nassesten','dunkel':'dunkler, am dunkelsten',
 'teuer':'teurer, am teuersten','sauer':'saurer, am sauersten','rot':'röter, am rötesten','schwarz':'schwärzer, am schwärzesten','fromm':'frommer/frömmer, am frommsten',
 'heiß':'heißer, am heißesten','süß':'süßer, am süßesten','laut':'lauter, am lautesten','leise':'leiser, am leisesten','spät':'später, am spätesten'}
TOPO=lambda pos:'Toponym' in pos or 'Eigenname' in pos
def noun(x):
  w=x['lemma'];d=N.get(w) or NX.get(w);m=NM.get(w)
  if m:
    g,pl,kind=m
    if g=='pl': return dict(art='die',pl='',gen='',disp=f'die {FIXCASE.get(w,w)} (Pl.)',plonly=True,topo=w in('Philippinen','Niederlande','Alpen','Usa'),irr=False)
    if kind=='adj':
      if w.endswith('beamte'): return dict(art='der',pl=pl,gen='',disp=f'der {w}, die {pl} (ein {w}r)',plonly=False,topo=False,irr=False,adjn=True)
      return dict(art='der/die',pl=pl,gen='',disp=f'der/die {w}, die {pl} (ein {w}r / eine {w})',plonly=False,topo=False,irr=False,adjn=True)
    topo=(not pl and w not in('Ki',)) or kind=='topo'
    if kind=='topo': return dict(art='',pl='',gen='',disp=w,plonly=False,topo=True,irr=False)
    dw=FIXCASE.get(w,w); return dict(art=ART[g],pl=pl,gen='',disp=f'{ART[g]} {dw}'+(f', die {pl}' if pl else ''),plonly=False,topo=topo,irr=False)
  if not d: return dict(art='',pl='',gen='',disp=FIXCASE.get(w,w),plonly=False,topo=False,irr=False,miss=True)
  g=[a for a in d['g'] if a in ART]; pls=d['pl']; gens=d.get('gen',[])
  topo=TOPO(d.get('pos',''))and not g
  dw=FIXCASE.get(w,w)
  if not g:
    if pls and not topo: return dict(art='die',pl='',gen='',disp=f'die {dw} (Pl.)',plonly=True,topo=False,irr=False)
    return dict(art='',pl='',gen='',disp=dw,plonly=False,topo=True,irr=False)
  arts='/'.join(dict.fromkeys(ART[a] for a in g))
  pl=pls[0] if pls else ''
  gen='';irr=False
  if g[0] in 'mn' and gens:
    reg={w+'s',w+'es',w,w+"'"}
    if gens[0] not in reg:
      gen=gens[0];irr=True
  disp=f'{arts} {dw}'+(f', des {gen}' if gen else '')+(f', die {pl}' if pl else (', kein Pl.' if not topo else ''))
  return dict(art=arts,pl=pl,gen=gen,disp=disp,plonly=False,topo=topo,irr=irr)
SEPP=('ab','an','auf','aus','bei','ein','fest','her','hin','los','mit','nach','vor','weg','zu','zurück','zusammen','weiter','vorbei','herum','hinaus','heraus','herein','hinein','dar','fern','frei','hoch','kennen','statt','teil','um','durch','über','unter','wieder','nieder','bereit','fertig','zurecht','empor','entgegen','fort','gegenüber','her','voran','voraus')
def verb(x):
  w=x['lemma'];d=V.get(w)
  if not d: return dict(vf='',disp=w,sep=False,irr=False,aux='')
  p3,pr,pf=d['p3'],d['pr'],d['pf']
  sep=' ' in p3 and p3.split()[-1].isalpha() and len(p3.split())==2 and not p3.startswith('sich')
  part=pf.split(' ',1)[1] if ' ' in pf else pf
  aux=pf.split()[0]
  irr= not part.endswith('t') or not pr.endswith('te') and not pr.endswith('te '+p3.split()[-1]) and ' ' not in pr or (' ' in pr and not pr.split()[0].endswith('te'))
  if w in ('wissen','denken','bringen','kennen','nennen','rennen','brennen','senden','wenden','mögen','können','müssen','dürfen','sollen','wollen','haben','sein','werden','tun'): irr=True
  vf=f'{p3} · {pr} · {pf}'
  return dict(vf=vf,disp=f'{w} ({p3}, {pr}, {pf})',sep=sep,irr=irr,aux=aux)
# game overlap
def norm(s): return re.sub(r'^(der|die|das|sich)\s+','',s.strip().lower())
gm={}
for g in G:
  gm.setdefault(norm(g['de']),g)
  gm.setdefault(g['id'].replace('-',' '),g)
ZN={'echogasse':'1区','':''}
BASIC_EXTRA={'hallo','tschüss','danke','bitte','ja','nein','entschuldigung','guten','morgen','abend','tag','nacht','okay','auf','wiedersehen','willkommen','gern','genau','vielleicht','sorry'}
REM={}
for w in 'Majestät Hoheit Herrin Fräulein Telegramm Kassette Kutsche Graf Gräfin Fürst Baron Herzog Thron Rüstung Bube Bursche Hauptmann Oberst Indianer'.split(): REM[w]='过时/历史用语'
for w in 'Paris London Madrid Tokio Hongkong Amsterdam Barcelona Istanbul Stockholm Jerusalem'.split(): REM[w]='外国地名（德语写法和原文一样，没有学习价值）'
for w in 'oh hey hi ah wow hm ha äh au ähm hmm hä bravo uh nö ey amen haha mhm bla aua och hopp hurra ups herrgott puh pardon oje jaja psst juhu peng boah ahh huch merci bumm uff ooh autsch jep adieu hahaha herrje halleluja ohh pfui hui'.split(): REM[w]='感叹词/拟声词（字幕里多，学习价值低）'
REM['jawohl']='过时/军队用语'; REM['Weber']='人名（姓）'
_seen=set();_r=[]
for x in r:
  k=(FIXCASE.get(x['lemma'],x['lemma']).lower(),x['pos'])
  if k in _seen: continue
  _seen.add(k);_r.append(x)
r=_r
removed=[x for x in r if x['lemma'] in REM]
r=[x for x in r if x['lemma'] not in REM]
for i,x in enumerate(r): x['rank']=i+1
json.dump([dict(lemma=x['lemma'],zh=x['zh'],oldrank=x.get('oldrank'),reason=REM[x['lemma']]) for x in removed],open(f'{W}/removed2.json','w'),ensure_ascii=False)
rows=[]
for x in r:
  w=x['lemma'];p=x['pos'];o=dict(rank=x['rank'],lemma=FIXCASE.get(w,w),pos=p,zh=x['zh'],tags=[],art='',pl='',gen='',vf='',cmp='',disp=w,note='')
  if p=='n':
    nd=noun(x);o.update(art=nd['art'],pl=nd['pl'],gen=nd['gen'],disp=nd['disp'])
    if nd.get('topo') and w not in ('Aids','Latein','Franken'):o['tags'].append('地名')
    if nd['irr'] and nd['gen']:o['tags'].append('弱变化')
    if nd['plonly']:o['tags'].append('只有复数')
    if nd.get('adjn'):o['tags'].append('形容词变化')
    if nd.get('miss'):o['note']='词性/复数待补'
  elif p=='v':
    vd=verb(x);o.update(vf=vd['vf'],disp=vd['disp'])
    if vd['irr']:o['tags'].append('不规则')
    if vd['sep']:o['tags'].append('可分')
    if vd['aux']=='ist':o['tags'].append('sein')
    o['note']='变位自动生成，待校' if not vd['irr'] else ''
  elif p in('adj','adv') and w in ADJ:
    o['cmp']=ADJ[w];o['disp']=f'{w} ({ADJ[w]})';o['tags'].append('比较级不规则')
  if x['rank']<=100 or w.lower() in BASIC_EXTRA or p in('num','art','pron') and x['rank']<=1500: o['tags'].insert(0,'基础')
  if w in ('na','ach','tja','naja','aha','nee','halt','doch','mal','eben','ja','igitt'): o['tags'].append('语气词')
  if x.get('life'):o['tags'].append('生活')
  if x.get('film'):o['tags'].append('影视')
  if x.get('slang'):o['tags'].append('粗口·只需听懂')
  g=gm.get(norm(w))
  o['game']=(g['zone'] if g else '');o['game_id']=(g['id'] if g else '')
  o['src']='生活词表' if x['src']=='life' else '词频'
  rows.append(o)
json.dump(rows,open(f'{W}/final.json','w'),ensure_ascii=False)
top=[o for o in rows if o['rank']<=6000]
print(len(rows),'game hits top6000',sum(1 for o in top if o['game']),'all',sum(1 for o in rows if o['game']))
used={o['game_id'] for o in rows if o['game_id']}
miss=[g for g in G if g['id'] not in used]
print('game words not in list',len(miss));print([(g['de'],g['pos']) for g in miss][:400])
import collections;print(collections.Counter(t for o in top for t in o['tags']))
for w in ['Haus','Student','Name','Herz','Herr','Eltern','Euro','Beamte','fahren','machen','festhalten','gut','Schweiz','hallo','Deutschland','Café','Junge','Gedanke','Buchstabe','Glaube']:
  o=next((o for o in rows if o['lemma']==w),None);print(o and (o['rank'],o['disp'],o['tags'],o['game']))
