"use strict";
// Manual aportado, tabla 2.4 y ejemplo de las páginas impresas 36–37.
// Los descansos insuficientes incluidos entre bloques forman parte del período acumulado.
(()=>{
const blank=()=>({start:"",end:"",overnight:false,blocks:[]});
const clock=value=>typeof value==="string"&&/^\d{2}:\d{2}$/.test(value)&&Number(value.slice(0,2))<24&&Number(value.slice(3))<60?Number(value.slice(0,2))*60+Number(value.slice(3)):NaN;
const category=(work,rest)=>work<=60&&rest>=work?"corta":work<=120&&rest>=.3*work?"media":null;
function interval(s,b){const start=clock(s?.start),end=clock(s?.end)+(s?.overnight===true?1440:0);let from=clock(b?.start),to=clock(b?.end);if(s?.overnight===true){if(from<start)from+=1440;if(to<start||(to===start&&from>start))to+=1440;if(end-start===1440&&from===start&&to===start)to+=1440;}return{from,to,minutes:Number.isFinite(from)&&Number.isFinite(to)&&to>from?to-from:null};}
function analyze(schedule){
 const problems=[],s=schedule;
 if(!s||typeof s!=="object"||Array.isArray(s))return{problems:["Complete el horario de esta tarea en la pantalla 2."]};
 const start=clock(s.start),endClock=clock(s.end),overnight=s.overnight===true;
 const end=endClock+(overnight?1440:0);
 if(!Number.isFinite(start)||!Number.isFinite(end))problems.push("Indique inicio y fin de la jornada.");
 else if(end<=start||end-start>1440)problems.push("La jornada debe durar más de cero y como máximo 24 horas. Revise el fin al día siguiente.");
 // Solo se consideran tramos dentro de la jornada; se ignora postRecovery de estudios antiguos.
 if(!Array.isArray(s.blocks)||!s.blocks.length)problems.push("Añada los tramos de actividad que cubren la jornada completa.");
 if(problems.length)return{problems};
 if(s.blocks.length>200)return{problems:["El horario admite como máximo 200 tramos por tarea."]};
 const segments=[];
 s.blocks.forEach((b,i)=>{
  if(!b||typeof b!=="object"){problems.push("Tramo "+(i+1)+": datos no válidos.");return}
  const {from,to}=interval(s,b);
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from){problems.push("Tramo "+(i+1)+": revise las horas de inicio y fin.");return}
  if(from<start||to>end)problems.push("Tramo "+(i+1)+": queda fuera de la jornada.");
  if(!["mmc","pausa","otra"].includes(b.type))problems.push("Tramo "+(i+1)+": seleccione Manipulación, Pausa u Otra tarea.");
  if(b.type==="otra"&&!["si","no"].includes(b.recovery))problems.push("Tramo "+(i+1)+": indique si la otra tarea permite recuperación dorsolumbar.");
  segments.push({start:from,end:to,type:b.type,recovery:b.type==="pausa"||(b.type==="otra"&&b.recovery==="si"),notes:typeof b.notes==="string"?b.notes:"",source:i});
 });
 segments.sort((a,b)=>a.start-b.start||a.end-b.end);
 let cursor=start;
 for(const b of segments){if(b.start<cursor)problems.push("Hay tramos solapados; cada minuto debe registrarse una sola vez.");else if(b.start>cursor)problems.push("Hay huecos sin actividad registrada entre los tramos.");cursor=Math.max(cursor,b.end);}
 if(cursor<end)problems.push("Complete los tramos hasta el fin de la jornada.");
 const totalMMC=segments.filter(b=>b.type==="mmc").reduce((a,b)=>a+b.end-b.start,0);
 if(!totalMMC)problems.push("Registre al menos un tramo de manipulación de cargas de la tarea evaluada.");
 if(totalMMC>720)problems.push("La manipulación supera las 12 horas contempladas en las categorías de extensión temporal.");
 if(problems.length)return{problems:[...new Set(problems)]};
 const groups=[];
 const emit=(from,to,rest,cat)=>groups.push({start:from,end:to,minutes:to-from,recoveryMinutes:rest,category:cat});
 let i=segments.findIndex(b=>b.type==="mmc");
 while(i>=0&&i<segments.length){
  const groupStart=segments[i].start;let j=i,closed=false;
  while(j<segments.length){
   if(!segments[j].recovery){j++;continue}
   const workEnd=segments[j].start;let k=j;
   while(k<segments.length&&segments[k].recovery)k++;
   const finishesShift=k===segments.length;
   const rest=segments[k-1].end-workEnd;
   const cat=category(workEnd-groupStart,rest);
   if(cat){emit(groupStart,workEnd,rest,cat);i=segments.findIndex((b,n)=>n>=k&&b.type==="mmc");closed=true;break}
   if(finishesShift){
    emit(groupStart,workEnd,rest,"larga");
    i=-1;closed=true;break;
   }
   // La pausa no permite separar los bloques: el siguiente período conserva groupStart.
   j=k;
  }
  if(!closed){
   const work=end-groupStart;
   emit(groupStart,end,0,"larga");
   i=-1;
  }
 }
 if(problems.length)return{problems:[...new Set(problems)]};
 const rank={corta:0,media:1,larga:2};
 const governing=groups.reduce((a,b)=>!a||rank[b.category]>rank[a.category]||(rank[b.category]===rank[a.category]&&b.minutes>a.minutes)?b:a,null);
 return{problems:[],category:governing.category,minutes:governing.minutes,recoveryMinutes:governing.recoveryMinutes,totalMMC,shiftMinutes:end-start,extension:Math.max(8,Math.ceil(totalMMC/60)),groups,segments,start,end,
  pauseMinutes:segments.filter(b=>b.type==="pausa").reduce((a,b)=>a+b.end-b.start,0),otherMinutes:segments.filter(b=>b.type==="otra").reduce((a,b)=>a+b.end-b.start,0),source:"horario"};
}
globalThis.MMCSchedule={blank,analyze,clock,interval};
})();

