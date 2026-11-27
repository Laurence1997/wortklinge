import json,glob,importlib.util,re,csv,sys
d=json.load(open('trimmed.json'))
rows=[];err=0
for fn in sorted(glob.glob('b/b*.py')):
  spec=importlib.util.spec_from_file_location('m',fn); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
  for k,a in m.A.items():
    v=d[k]; de=[p for i,p in enumerate(v['de']) if i not in a.get('drop',[])]
    if 'de' in a: de=a['de']
    for o,n in a.get('fix',[]):
      de=[x.replace(o,n) for x in de]
    de=[re.sub(r'  +',' ',x) for x in de]
    zh=a['zh']
    if len(zh)!=len(de): print('PARA MISMATCH',k,len(de),len(zh)); err+=1
    text=' '.join(de)
    for g in a['gl']:
      if g[0] not in text: print('GLOSS NOT IN TEXT',k,g[0]); err+=1
    if len(a['qs'])!=3: print('QS',k); err+=1
    for q in a['qs']:
      if len(set(q[2:5]))<3: print('dup option',k,q); err+=1
    title=a.get('title') or v['title']
    rows.append({'id':k,'段':v['seg'],'标题':title,'例句':'｜'.join(de),'例句中文':'｜'.join(zh),'新词':'',
      '注释':json.dumps([{'w':g[0],'de':g[1],'zh':g[2]} for g in a['gl']],ensure_ascii=False),
      '题目':json.dumps([{'q':q[0],'qZh':q[1],'answer':q[2],'wrong':[q[3],q[4]]} for q in a['qs']],ensure_ascii=False),
      '词数':len(text.split()),'来源':f"改编自 Klexikon《{v['title']}》",'网址':f"https://klexikon.zum.de/index.php?oldid={v['rev']}",'修订号':v['rev'],'许可证':'CC BY-SA 4.0',
      '改编说明':a.get('note','只截取开头几段，未改句子；加注释和题目')})
print(len(rows),'rows',err,'errors')
if len(sys.argv)>1:
  rows.sort(key=lambda r:r['id'])
  with open(sys.argv[1],'w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0].keys()),delimiter='\t',lineterminator='\n'); w.writeheader(); w.writerows(rows)
