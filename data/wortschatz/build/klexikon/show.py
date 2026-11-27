import json,sys
d=json.load(open('trimmed.json'))
for k in sys.argv[1:]:
  v=d[k];print('##',k,v['title'],v['words'])
  for i,p in enumerate(v['de']): print(f'[{i}]',p)
  print('UNK:',', '.join(v['unk']))
