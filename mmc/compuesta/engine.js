"use strict";
// Fuente exclusiva: 2.ERGOepm SLI-CLI (20-1-22)(1).xlsm, 4.Factores -> 5.Resultados.
(()=>{
const num=v=>(typeof v==='number'||typeof v==='string')&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):NaN;
const round=(x,n=2)=>Math.round((x+Number.EPSILON)*10**n)/10**n;
const populations=[{sex:'Hombres',age:'20–45 años',mass:25},{sex:'Hombres',age:'<20 o >45 años',mass:20},{sex:'Mujeres',age:'20–45 años',mass:20},{sex:'Mujeres',age:'<20 o >45 años',mass:15}];
const bands=[{max:1,label:'TOLERABLE',color:'#00ff00',text:'#111'},{max:1.5,label:'BAJO',color:'#ffff00',text:'#111'},{max:2,label:'MODERADO',color:'#ff0000',text:'#111'},{max:3,label:'ALTO',color:'#c00000',text:'#fff'},{max:Infinity,label:'MUY ALTO',color:'#7030a0',text:'#fff'}];
const level=x=>bands.find(b=>x<=b.max);
function fm(f,duration,height=75){
 if(!Number.isFinite(f)||f<0||!Number.isFinite(duration))return NaN;if(f>16||duration>480)return 0;
 // Individual AC15 uses exact .01 table entries. Cumulative K99 uses approximate MATCH.
 const value=round(f),column=(height>=75?1:4)+(duration<=60?0:duration<=120?1:2),t=globalThis.CLIFrequencyTable;
 let i=t.findIndex(r=>r[0]>=value);if(i<0)return 0;if(t[i][0]===value)return t[i][column];
 const a=t[i-1],b=t[i];return a[column]+(b[column]-a[column])*(value-a[0])/(b[0]-a[0]);
}
function organization(d){const timed=globalThis.MMCClockSchedule.resolve(d);if(timed.problems.length)return{problems:timed.problems};const problems=[],blocks=timed.blocks;if(!Array.isArray(blocks)||!blocks.length||blocks.length>81)return{problems:['Registre el horario completo (máximo 81 tramos).']};let shift=0,net=0,push=0,duration=0;
 for(const [i,b]of blocks.entries()){const m=num(b.minutes);if(!['mmc','otra','empuje'].includes(b.type)||!(m>0)){problems.push('Tramo '+(i+1)+': indique actividad y minutos positivos.');continue;}shift+=m;if(b.type==='mmc')net+=m;if(b.type==='empuje')push+=m;duration=Math.max(duration,m);}
 if(!net)problems.push('El horario debe incluir levantamiento manual de cargas.');if(shift>1440)problems.push('La jornada supera 24 horas.');
 // 3. Organizacion!CJ10=MAX(B10:CD10), incluyendo descansos. No se reutiliza la duración VLI.
 return{problems,shift,net,push,duration,category:duration<=60?'corta':duration<=120?'media':'larga'};
}
function production(d){const problems=[],rows=d?.subtasks,workers=num(d?.workers);if(!Array.isArray(rows)||!rows.length||rows.length>10)return{problems:['Registre entre 1 y 10 subtareas.']};if(!Number.isInteger(workers)||workers<1)problems.push('Indique el número total de trabajadores (entero mayor que cero).');let count=0,mass=0,participations=0;const active=[];
 rows.forEach((s,i)=>{if(['name','weight','objects','lifts','frequency','origin','destination','horizontal','asymmetry','grip','hands','people','heavy'].every(k=>String(s[k]??'').trim()===''))return;
 const weight=num(s.weight),objects=num(s.objects),lifts=num(s.lifts),people=num(s.people);
 if(!String(s.name||'').trim())problems.push('Subtarea '+(i+1)+': indique su nombre.');
 if(!(weight>=3)||!Number.isInteger(objects)||objects<1||!Number.isInteger(lifts)||lifts<1)problems.push('Subtarea '+(i+1)+': peso ≥3 kg, objetos y levantamientos por objeto enteros positivos.');
 if(![1,2].includes(people))problems.push('Subtarea '+(i+1)+': indique 1 o 2 personas levantando juntas.');else if(Number.isInteger(workers)&&people>workers)problems.push('Subtarea '+(i+1)+': las personas que levantan juntas superan el total de trabajadores.');
 if(weight>=3&&objects>0&&lifts>0){count+=objects*lifts;mass+=weight*objects*lifts;if([1,2].includes(people))participations+=objects*lifts*people;}
 active.push({...s,index:i,weight,objects,lifts,people});});if(!active.length)problems.push('Complete al menos una subtarea.');
 return{problems,active,count,mass,perWorkerMass:workers>0?mass/workers:null,participations:workers>0?participations/workers:null};
}
function calculate(d){if(!d||typeof d!=='object')return{status:'pending',problems:['Estudio no válido.']};const p=production(d),o=organization(d),problems=[...p.problems,...o.problems],critical=[];
 if(problems.length)return{status:'pending',problems,production:p,organization:o};const subtasks=[];
 for(const s of p.active){const prefix='Subtarea '+(s.index+1)+': ',v=num(s.origin),vf=num(s.destination),h=num(s.horizontal),a=num(s.asymmetry),f=num(s.frequency),hands=num(s.hands);
 if(![v,vf,h,a,f].every(Number.isFinite)||h<0||a<0||f<0)problems.push(prefix+'complete alturas, alcance, asimetría y frecuencia no negativa.');
 if(Number.isFinite(f)&&Math.abs(f*100-Math.round(f*100))>1e-8)problems.push(prefix+'la frecuencia debe tener como máximo dos decimales.');
 if(!['B','R','M'].includes(s.grip)||![1,2].includes(hands)||!['S','N'].includes(s.heavy))problems.push(prefix+'seleccione agarre, manos y tareas adicionales exigentes.');
 if(v<0||v>175||vf<0||vf>175||Math.abs(v-vf)>175||h>63||a>135)critical.push(prefix+'geometría crítica.');
 if(problems.length||critical.length)continue;
 const factors={VM:1-.003*Math.abs(v-75),DM:Math.abs(v-vf)<25?1:.82+4.5/Math.abs(v-vf),HM:h<25?1:25/h,AM:1-.0032*a,CM:{B:1,R:.95,M:.9}[s.grip],FM:fm(f,o.duration,v),hands:hands===2?1:.6,team:s.people===2?.85:1,heavy:s.heavy==='S'?.8:1};
 if(factors.FM<=0){critical.push(prefix+'frecuencia o duración fuera de la tabla aplicable.');continue;}
 const fili=s.weight/(25*factors.VM*factors.DM*factors.HM*factors.AM*factors.CM),individual=fili/factors.FM/factors.hands*(s.people===2?.5/.85:1)/factors.heavy;
 subtasks.push({...s,frequency:f,fili,individual,factors,displacement:Math.abs(v-vf)});
 }
 const expectedFrequency=p.count/num(d.workers)/o.net,totalFrequency=subtasks.reduce((s,t)=>s+t.frequency,0);
 if(!critical.length&&Math.abs(round(totalFrequency)-round(expectedFrequency))>.100000001)problems.push('Las frecuencias de las subtareas no coinciden con la producción y el horario (diferencia máxima admitida: 0,10 lev/min).');
 if(problems.length)return{status:'pending',problems,production:p,organization:o};if(critical.length)return{status:'critical',problems:critical,production:p,organization:o};
 // AY/BG: extract maxima one at a time, preserving first MATCH for ties.
 const sorted=[...subtasks].sort((a,b)=>b.individual-a.individual||a.index-b.index);let cumulative=0,previousFM=1,base=sorted[0].individual;const trace=[];
 sorted.forEach((s,i)=>{cumulative=round(cumulative+s.frequency);const factor=fm(cumulative,o.duration,75);if(factor<=0){critical.push('Frecuencia acumulada crítica.');return;}const contribution=i===0?base:s.fili*(1/factor-1/previousFM);if(i)base+=contribution;trace.push({subtask:s.index,cumulative,factor,contribution});previousFM=factor;});
 if(critical.length)return{status:'critical',problems:critical,production:p,organization:o,subtasks,trace};
 return{status:'valid',problems:[],base,production:p,organization:o,frequency:expectedFrequency,subtasks,trace,groups:populations.map(g=>({...g,index:base*25/g.mass,level:level(base*25/g.mass)}))};
}
function populationResults(r){return populations.map((g,i)=>r.status==='valid'?r.groups[i]:{...g,index:null,level:r.status==='critical'?bands[4]:{label:'NO CALCULABLE',color:'#e2e8f0',text:'#334155'}});}
globalThis.CLIEngine={calculate,production,organization,fm,round,level,populations,populationResults};
})();
