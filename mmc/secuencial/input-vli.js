"use strict";
(()=>{
const round=(v,n=2)=>Math.round((v+Number.EPSILON)*10**n)/10**n;
const number=v=>(typeof v==='string'||typeof v==='number')&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):NaN;
const integer=v=>Number.isInteger(number(v))&&number(v)>0;
const populations=[{sex:'Hombres',age:'20–45 años',mass:25},{sex:'Hombres',age:'<20 o >45 años',mass:20},{sex:'Mujeres',age:'20–45 años',mass:20},{sex:'Mujeres',age:'<20 o >45 años',mass:15}];
const bands=[{max:1,label:'TOLERABLE',color:'#00ff00',text:'#111'},{max:1.5,label:'BAJO',color:'#ffff00',text:'#111'},{max:2,label:'MODERADO',color:'#ff0000',text:'#fff'},{max:3,label:'ALTO',color:'#c00000',text:'#fff'},{max:Infinity,label:'MUY ALTO',color:'#7030a0',text:'#fff'}];
function level(v){return bands.find(b=>v<=b.max)}
function fm(frequency,category){
 const f=round(frequency),c={corta:1,media:2,larga:3}[category],table=globalThis.ILSFrequencyTables.vli.map(r=>[r[0],r[4],r[5],r[6]]);
 if(!Number.isFinite(f)||f<0||!c)return NaN;if(f>16)return 0;
 const high=table.findIndex(row=>row[0]>=f);if(high<0)return 0;
 if(table[high][0]===f)return table[high][c];
 const a=table[high-1],b=table[high];return a[c]+(b[c]-a[c])*(f-a[0])/(b[0]-a[0]);
}
function production(input){
 const problems=[],rows=input.loads||[];if(!Array.isArray(rows)||!rows.length||rows.length>27)return{problems:['Registre entre 1 y 27 filas de cargas.']};
 const active=[];rows.forEach((r,i)=>{const empty=['weight','objects','lifts','people'].every(k=>String(r?.[k]??'').trim()==='');if(empty)return;const weight=number(r?.weight),objects=number(r?.objects),lifts=number(r?.lifts),people=String(r?.people??'').trim()===''?1:number(r.people);if(!Number.isInteger(people)||people<1){problems.push('Carga '+(i+1)+': las personas que levantan juntas deben ser un entero ≥ 1 (vacío = 1).');return}if(!(weight>=3)||!Number.isInteger(objects)||objects<0||!Number.isInteger(lifts)||lifts<1){problems.push('Carga '+(i+1)+': peso ≥ 3 kg, número de objetos entero ≥ 0 y levantamientos por objeto entero ≥ 1.');return}if(objects>0)active.push({weight,objects,lifts,people,count:objects*lifts})});
 if(!active.length)problems.push('Registre al menos una carga con objetos manipulados.');if(problems.length)return{problems};
 const count=active.reduce((s,r)=>s+r.count,0),mass=active.reduce((s,r)=>s+r.weight*r.count,0),min=Math.min(...active.map(r=>r.weight)),max=Math.max(...active.map(r=>r.weight));
 let ranges;if(active.length>5){const delta=(max-min)/5;ranges=Array.from({length:5},(_,i)=>{const from=i===0?round(min,1):null;return{from,to:null}});ranges[0].from=round(min,1);ranges.forEach((r,i)=>{if(i)r.from=ranges[i-1].to;r.to=round(r.from+delta,1)})}else ranges=Array.from({length:5},(_,i)=>({from:(active[i]?.weight??25)-.5,to:(active[i]?.weight??25)+.5}));
 const groups=ranges.map((r,i)=>({...r,id:i,count:0,mass:0,mean:0,raw:[]}));
 for(const r of active){const idx=groups.findIndex((g,i)=>r.weight>=g.from&&(r.weight<g.to||(i===4&&r.weight<=g.to)));if(idx<0){problems.push('La simplificación del método deja el peso '+r.weight+' kg fuera de las categorías redondeadas. Revise los datos antes de evaluar.');continue}const g=groups[idx];g.count+=r.count;g.mass+=r.weight*r.count;g.raw.push(r)}
 groups.forEach(g=>{g.mean=g.count?round(g.mass/g.count,1):0;g.share=g.count/count;const people=[...new Set(g.raw.map(r=>r.people))];g.people=people[0]||1;g.effectiveWeight=g.mean/g.people;if(people.length>1)problems.push('C'+(g.id+1)+': contiene cargas con distinto número de personas que levantan juntas. El método aplica un único número por categoría; separe estas condiciones en tareas independientes.');});
 const workers=number(input.workers),workerProblems=[];
 if(integer(input.workers)&&active.some(r=>r.people>workers))workerProblems.push('El número total de trabajadores debe ser igual o mayor que las personas que levantan juntas cada carga. Revise ambos campos.');
 const validWorkers=integer(input.workers)&&!workerProblems.length,participations=active.reduce((sum,r)=>sum+r.count*r.people,0);
 return{problems,workerProblems,active,groups,count,mass,participations,liftsPerWorker:validWorkers?count/workers:null,perWorkerMass:validWorkers?mass/workers:null,perWorkerLifts:validWorkers?participations/workers:null};
}
function organization(input){
 const timed=globalThis.MMCClockSchedule.resolve(input);if(timed.problems.length)return{problems:timed.problems};
 const blocks=timed.blocks,problems=[];if(!Array.isArray(blocks)||!blocks.length||blocks.length>200)return{problems:['Registre el horario completo, con un máximo de 200 tramos.']};
 const seq=[];blocks.forEach((b,i)=>{const minutes=number(b?.minutes);if(!(minutes>0)||minutes>1440||!['mmc','otra','empuje'].includes(b?.type)){problems.push('Tramo '+(i+1)+': indique actividad y minutos positivos.');return}if(seq.at(-1)?.type===b.type)seq.at(-1).minutes+=minutes;else seq.push({type:b.type,minutes})});
 if(problems.length)return{problems};const shift=seq.reduce((s,b)=>s+b.minutes,0),net=seq.filter(b=>b.type==='mmc').reduce((s,b)=>s+b.minutes,0),push=seq.filter(b=>b.type==='empuje').reduce((s,b)=>s+b.minutes,0);
 if(!(net>0))problems.push('El horario debe incluir manipulación manual de cargas.');if(shift>1440)problems.push('La jornada supera 24 horas.');if(net>720)problems.push('La manipulación supera las 12 horas contempladas en la tabla.');if(seq.filter(b=>b.type==='mmc').length>20||seq.filter(b=>b.type==='empuje').length>20)problems.push('El método admite hasta 20 bloques de levantamiento y 20 de empuje/tracción.');
 if(problems.length)return{problems};
 const work=seq.map((b,i)=>({b,i})).filter(x=>x.b.type!=='otra');let accumulated=0,previousFlag=0;const flags=[],periods=[];
 work.forEach(({b,i},j)=>{const minutes=b.minutes+(previousFlag===1?accumulated:0),rest=j===work.length-1?500:(seq[i+1]?.type==='otra'?seq[i+1].minutes:0);const flag=minutes<=60&&rest/minutes>=1?0:minutes>60&&minutes<=120&&rest/minutes>=.3?-1:minutes>120?-2:1;accumulated=minutes;previousFlag=flag;flags.push(flag);periods.push({minutes,rest,terminal:j===work.length-1,flag})});
 const shortTramo=seq.some((b,i)=>b.minutes<5&&!(i===0&&b.type==='otra'));
 const category=shortTramo?'sin seleccionar':flags.every(f=>f!==-1&&f!==-2)?'corta':flags.some(f=>f===-2)?'larga':'media';
 return{problems,category,frequencyCategory:shortTramo?'corta':category,durationValue:shortTramo?0:({corta:60,media:120,larga:180}[category]),shift,net,push,periods,shortTramo,extension:net<481?1:net<541?.97:net<601?.93:net<661?.89:.85};
}
const heightLimits=[10,20,30,40,50,60,70,80,90,100,110,125,130,140,150,160,170,175];
function heights(text){const values=Array.isArray(text)?text:typeof text==='string'?text.split(/[;,\s]+/).filter(Boolean):[];const ns=values.map(number);if(!ns.length||ns.some(n=>!Number.isFinite(n)))return{problems:['Indique las alturas en centímetros, separadas por punto y coma.']};const critical=ns.some(n=>n<0||n>175),bins=[...new Set(ns.filter(n=>n>=0&&n<=175).map(n=>heightLimits.findIndex(limit=>n<=limit)))];return{problems:[],critical,poor:bins.filter(i=>i<5||i>11).length,good:bins.filter(i=>i>=5&&i<=11).length,values:ns,bins};}
function geometryRows(input,p){
 if(Array.isArray(input.geometryRows))return input.geometryRows;
 const rows=[];
 for(const g of (p.groups||[]).filter(g=>g.count)){
  const x=input.geometry?.[g.id]||{};
  for(const [side,prefix]of [['origin','origin'],['destination','destination']]){
   const parsed=heights(x[side]);
   for(const kind of ['Poor','Good']){
    const values=(parsed.values||[]).filter(v=>kind==='Poor'?(v<=50||v>125):(v>50&&v<=125));
    const distances=input.horizontal?.[prefix+kind]||[];
    if(values.length)for(const distance of distances.length?distances:[''])rows.push({category:String(g.id),origin:side==='origin'?values.join('; '):'',destination:side==='destination'?values.join('; '):'',hOrigin:side==='origin'?String(distance):'',hDestination:side==='destination'?String(distance):''});
   }
  }
 }
 return rows;
}
function rowGeometry(input,p){
 const rows=geometryRows(input,p),problems=[],critical=[],categories=[];
 rows.forEach((r,i)=>{if(!p.groups.some(g=>g.count&&String(g.id)===String(r.category)))problems.push('Fila '+(i+1)+': seleccione una categoría de peso activa.');if(!String(r.origin||'').trim()&&!String(r.destination||'').trim())problems.push('Fila '+(i+1)+': indique al menos una altura de origen o destino.');});
 for(const g of (p.groups||[]).filter(g=>g.count)){
  const selected=rows.filter(r=>String(r.category)===String(g.id)),h={originPoor:[],originGood:[],destinationPoor:[],destinationGood:[]},values={origin:[],destination:[]};
  for(const r of selected)for(const side of ['origin','destination']){
   if(!String(r[side]||'').trim())continue;
   const v=heights(r[side]),key=side==='origin'?'hOrigin':'hDestination',distance=String(r[key]??'');
   if(v.problems.length)problems.push('C'+(g.id+1)+': alturas de '+(side==='origin'?'origen':'destino')+' no válidas.');
   values[side].push(...(v.values||[]));
   if(!['0','1','2','3'].includes(distance))problems.push('C'+(g.id+1)+': seleccione el alcance horizontal de '+(side==='origin'?'origen':'destino')+'.');
   else for(const kind of ['poor','good'])if(v[kind]>0)h[side+(kind==='poor'?'Poor':'Good')].push(Number(distance));
   if(distance==='3')critical.push('C'+(g.id+1)+': distancia horizontal superior a 63 cm.');
  }
  for(const key of Object.keys(h))h[key]=[...new Set(h[key])];
  const origin=heights(values.origin),destination=heights(values.destination),asymmetry=input.geometry?.[g.id]?.asymmetry;
  if(origin.problems.length||destination.problems.length)problems.push('Categoría C'+(g.id+1)+': complete las alturas de origen y destino.');
  if(origin.critical||destination.critical)critical.push('C'+(g.id+1)+': altura fuera de 0–175 cm.');
  if(!['si','no','critica'].includes(asymmetry))problems.push('C'+(g.id+1)+': indique la asimetría.');
  if(asymmetry==='critica')critical.push('C'+(g.id+1)+': asimetría superior a 135°.');
  categories.push({g,origin,destination,asymmetry,h});
 }
 return {problems,critical,categories};
}
function geometries(input,p){
 if(Array.isArray(input.geometryRows))return rowGeometry(input,p);
 const problems=[],critical=[],horizontal=input.horizontal||{},categories=[];
 const h={};for(const k of ['originPoor','originGood','destinationPoor','destinationGood']){const a=horizontal[k];h[k]=Array.isArray(a)?[...new Set(a)]:[];if(h[k].some(x=>![0,1,2,3].includes(x)))problems.push('Distancia horizontal no válida.');if(h[k].includes(3))critical.push('Distancia horizontal superior a 63 cm.');}
 p.groups.filter(g=>g.count>0).forEach(g=>{const x=input.geometry?.[g.id]||{},origin=heights(x.origin),destination=heights(x.destination);if(origin.problems.length||destination.problems.length){problems.push('Categoría C'+(g.id+1)+': complete las alturas de origen y destino.');return}if(origin.critical||destination.critical)critical.push('C'+(g.id+1)+': altura fuera de 0–175 cm.');if(!['si','no','critica'].includes(x.asymmetry))problems.push('C'+(g.id+1)+': indique la asimetría.');if(x.asymmetry==='critica')critical.push('C'+(g.id+1)+': asimetría superior a 135°.');
 for(const [name,layout]of [['origin',origin],['destination',destination]])for(const kind of ['Poor','Good'])if(layout[kind.toLowerCase()]>0&&!h[name+kind].length)problems.push('C'+(g.id+1)+': seleccione distancias horizontales para '+(name==='origin'?'origen':'destino')+' en la zona '+(kind==='Poor'?'0–50 / 126–175 cm':'51–125 cm')+'.');
 categories.push({g,origin,destination,asymmetry:x.asymmetry});});
 return{problems,critical,categories,h};
}
function percentile(values,p){const a=[...values].sort((x,y)=>x-y),pos=(a.length-1)*p,lo=Math.floor(pos),hi=Math.ceil(pos);return a[lo]+(a[hi]-a[lo])*(pos-lo)}
function aggregate(subtasks,category,extension){
 const thresholds=[.8333,.6666,.5,.3333,.1666,0].map(p=>percentile(subtasks.map(t=>t.fili),p));
 const buckets=thresholds.map((threshold,i)=>{const xs=subtasks.filter(t=>t.fili>=threshold&&(i===0||t.fili<thresholds[i-1]));const max=xs.length?Math.max(...xs.map(t=>t.fili)):0,average=xs.length?xs.reduce((s,t)=>s+t.fili,0)/xs.length:0,frequency=round(xs.reduce((s,t)=>s+t.frequency,0));return{i,threshold,max,average,frequency,fm:fm(frequency,category),members:xs.length}});
 if(buckets.some(b=>b.fm<=0))return{critical:['Frecuencia crítica en una categoría FILI.'],buckets};
 const sortedValues=buckets.map(b=>b.max/b.fm).sort((a,b)=>b-a);
 const sorted=sortedValues.map(value=>buckets.find(b=>b.max/b.fm===value));let cumulative=0,previousFM=1,result=0;const trace=[];
 for(let i=0;i<sorted.length;i++){const b=sorted[i];cumulative=round(cumulative+b.frequency);const factor=fm(cumulative,category);if(factor<=0)return{critical:['Frecuencia acumulada crítica.'],buckets};const contribution=i===0?b.max/factor:b.average*(1/factor-1/previousFM);result+=contribution;trace.push({...b,cumulative,factor,contribution});previousFM=factor}
 return{base:result/extension,buckets,trace,critical:[]};
}
function calculate(input){
 const problems=[];if(!input||typeof input!=='object')return{status:'pending',problems:['Datos de la tarea no válidos.']};if(!integer(input.workers))problems.push('Indique un número entero de trabajadores mayor que cero.');if(input.mode&&input.mode!=='individual'||input.oneHand===true)problems.push('El archivo contiene una modalidad sin distribución por carga o levantamientos con una mano pendientes de validar; no se emite un ILV.');
 const p=production(input),o=organization(input);problems.push(...p.problems,...(p.workerProblems||[]),...o.problems);if(problems.length)return{status:'pending',problems};
 const geo=geometries(input,p);problems.push(...geo.problems);if(problems.length)return{status:'pending',problems,production:p,organization:o};if(geo.critical.length)return{status:'critical',problems:geo.critical,production:p,organization:o};
 const frequency=p.liftsPerWorker/o.net,subtasks=[];
 for(const c of geo.categories){const h=c.h||geo.h,total=c.origin.poor+c.origin.good+c.destination.poor+c.destination.good;
 for(const [kind,heightFactor,area] of [['poor',.78,0],['good',1,75]]){const count=c.origin[kind]+c.destination[kind];if(!count)continue;const hs=[0,1,2].map(i=>(h['origin'+(kind==='poor'?'Poor':'Good')].includes(i)?1:0)+(h['destination'+(kind==='poor'?'Poor':'Good')].includes(i)?1:0)),hTotal=hs.reduce((s,x)=>s+x,0);hs.forEach((h,i)=>{const share=count/total*h/hTotal;if(!share)return;const rawFrequency=c.g.count/number(input.workers)/o.net*share,subFrequency=round(rawFrequency),fili=c.g.effectiveWeight/(25*heightFactor*[.71,.56,.4][i]*(c.asymmetry==='si'?.81:1)*.9);subtasks.push({category:c.g.id,weight:c.g.effectiveWeight,objectWeight:c.g.mean,people:c.g.people,area,horizontal:[35,45,63][i],share,frequency:subFrequency,rawFrequency,fili})})}}
 if(!subtasks.length)return{status:'pending',problems:['Complete las geometrías de las categorías activas.']};
 const result=aggregate(subtasks,o.frequencyCategory,o.extension);if(result.critical.length)return{status:'critical',problems:result.critical,production:p,organization:o,subtasks,frequency};
 return{status:'valid',problems:[],base:result.base,production:p,organization:o,frequency,subtasks,buckets:result.buckets,trace:result.trace,groups:populations.map(g=>({...g,index:result.base*25/g.mass,level:level(result.base*25/g.mass)}))};
}
function populationResults(result){return populations.map((g,i)=>result.status==='valid'?result.groups[i]:{...g,index:null,level:result.status==='critical'?bands[4]:{label:'NO CALCULABLE',color:'#e2e8f0',text:'#334155'}})}
globalThis.ILSVariableInput={calculate,production,organization,geometries,geometryRows,heights,fm,aggregate,percentile,round,populationResults,populations,level};
})();
