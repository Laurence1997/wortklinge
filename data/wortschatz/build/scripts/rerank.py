import json,math,wordfreq
r=json.load(open('ranked2_orig.json'))
sub={}
for line in open('../dl/de_50k.txt',encoding='utf-8'):
    w,c=line.rsplit(' ',1); sub[w]=int(c)
TOT=sum(sub.values())
def own(l):
    lw=l.lower(); return math.sqrt(max(sub.get(lw,0)/TOT,1e-9)*max(wordfreq.word_frequency(lw,'de'),1e-9))
NEWS=set("""Bundestag Bundesrepublik Bundeswehr Minister Landtag Revolution Kandidat Militär Papst königlich Armee Demokratie Herrschaft Republik Königreich Union Verfassung Kanzlerin Staatsanwalt Senator regieren Bischof Parlament Asylbewerber Migration Gouverneur Kommission Abkommen Grundgesetz Ministerium demokratisch Geheimdienst Marine Wähler Senat Staatsanwaltschaft Abgeordnete Kardinal Allianz Thron Bundeskanzler Beschluss Ausschuss Kolonie Wahlkampf Herrscher Offizier Premierminister Wahlrecht Schlacht Kanzler Vizepräsident strategisch kaiserlich Terrorist marschieren Bündnis Taktik Reform taktisch diplomatisch militärisch revolutionär Weltkrieg Komitee Präsidentin Fraktion Ministerpräsident Bundesregierung Kommandant Föderation Demokrat Demonstrant Regime Kompanie Republikaner Imperium Bundesstaat Erzbischof Legion Kaiser General Soldat Nation Prinz Königin Krone Partei Politiker Präsident Marsch Krieger Rüstung Zar Diplomat Koalition Innenminister Agenda""".split())
adj=sorted((x['adj'] for x in r),reverse=True); floor=adj[2999]
by={x['lemma']:x for x in r}
new=[];boost=0;dem=0
for x in r:
    if x['lemma'] in NEWS: x['adj']*=0.3; x['news']=True; dem+=1
for line in open('../rev/life2.txt',encoding='utf-8'):
    l,p,zh=line.strip().split('|')
    if l in by:
        x=by[l]; x['adj']=max(x['adj'],x['adj']*2,floor); x['life']=True; boost+=1
    else:
        x=dict(lemma=l,pos=p,zh=zh,sc=own(l),src='life',film=False,life=True); x['adj']=max(own(l)*2,floor); r.append(x); by[l]=x; new.append(l)
floor2=adj[3999]
FORMAL=set('erfolgen beabsichtigen ermöglichen erteilen gewähren verfügen erfordern erzielen erlangen errichten erwerben bezeichnen gestatten veranlassen beinhalten bewirken vollziehen anfertigen speisen erläutern begeben verweisen ergreifen erweisen widmen gewährleisten umsetzen beitragen fungieren erachten ersuchen vernehmen erwidern verzehren zuwenden aushändigen'.split())
for x in r:
    if x['lemma'] in FORMAL: x['adj']*=0.4
for line in open('../rev/verb2.txt',encoding='utf-8'):
    l,p,zh=line.strip().split('|')
    if l in by:
        x=by[l]
        if x['adj']<floor: x['adj']=max(x['adj']*2,floor)
    else:
        x=dict(lemma=l,pos=p,zh=zh,sc=own(l),src='life',film=False,life=False); x['adj']=max(own(l)*2,floor); r.append(x); by[l]=x; new.append(l)
for line in open('../rev/adj2.txt',encoding='utf-8'):
    l,p,zh=line.strip().split('|')
    if l in by:
        x=by[l]
        if x['adj']<floor2: x['adj']=max(x['adj']*2,floor2)
    else:
        x=dict(lemma=l,pos=p,zh=zh,sc=own(l),src='life',film=False,life=False); x['adj']=max(own(l)*2,floor2); r.append(x); by[l]=x; new.append(l)
for line in open('../rev/contr.txt',encoding='utf-8'):
    l,p,zh=line.strip().split('|')
    if l not in by:
        x=dict(lemma=l,pos=p,zh=zh,sc=own(l),src='freq',film=False,life=False,adj=own(l)); r.append(x); by[l]=x; new.append(l)
r.sort(key=lambda x:-x['adj'])
old={x['lemma']:x['rank'] for x in json.load(open('ranked2_orig.json'))}
for i,x in enumerate(r): x['rank']=i+1
json.dump(r,open('ranked2.json','w'),ensure_ascii=False)
print('demoted',dem,'boosted',boost,'new',len(new),new)
