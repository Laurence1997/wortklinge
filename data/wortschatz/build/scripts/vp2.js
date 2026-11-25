const GV=require('german-verbs'); const D=require('german-verbs-dict/dist/verbs.json');
const parts=require(process.argv[2]); const out=JSON.parse(require('fs').readFileSync(process.argv[3]));
const PART=['heraus','hinaus','herum','aufrecht','weiter','zurück','vorbei','voran','sicher','runter','raus','rein','fern','fort','hoch','teil','mit','vor','los','rum','ran','hin','her','auf','ein','an'];
const SEINB=new Set(['kommen','gehen','laufen','fahren','fallen','werden','frieren']);
function conj(v,aux){return [GV.getConjugation(D,v,'PRASENS',3,'S').join(' '),GV.getConjugation(D,v,'PRATERITUM',3,'S').join(' '),GV.getConjugation(D,v,'PERFEKT',3,'S',aux).join(' ')];}
for (const v of Object.keys(out)) if(!out[v]){
  let done=false;
  for (const p of PART){ if(v.startsWith(p)&&v.length>p.length+3){ const b=v.slice(p.length); try{ const aux=SEINB.has(b)?'SEIN':'HABEN'; const [p3,pr,pf]=conj(b,aux); const pp=pf.split(' '); out[v]={p3:p3+' '+p,pr:pr+' '+p,pf:pp[0]+' '+p+pp[1]}; done=true; break;}catch(e){} } }
  if(!done){ try{ const [p3,pr,pf]=conj(v,'HABEN'); out[v]={p3,pr,pf}; done=true;}catch(e){} }
  if(!done){ let st=v.replace(/(e?n)$/,''); const e=/[td]$|[^aeiouhlr][mn]$/.test(st)?'e':''; const insep=/^(be|ge|er|ver|zer|ent|emp|miss)/.test(v)||/ieren$/.test(v); out[v]={p3:st+e+'t',pr:st+e+'te',pf:'hat '+(insep?'':'ge')+st+e+'t',guess:true}; }
}
console.log(JSON.stringify(out));
