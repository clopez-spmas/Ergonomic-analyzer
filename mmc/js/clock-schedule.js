"use strict";
// Conversión y validación de horas. No decide las categorías metodológicas de cada módulo.
(()=>{
const clock=v=>typeof v==='string'&&/^\d{2}:\d{2}$/.test(v)&&Number(v.slice(0,2))<24&&Number(v.slice(3))<60?Number(v.slice(0,2))*60+Number(v.slice(3)):NaN;
const time=n=>{n=((n%1440)+1440)%1440;return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};
const usesHours=d=>d?.timeBased===true||Object.hasOwn(d||{},'end')||(Array.isArray(d?.blocks)&&d.blocks.some(b=>Object.hasOwn(b||{},'start')||Object.hasOwn(b||{},'end')));
function interval(d,b){const start=clock(d?.start),end=clock(d?.end)+(d?.overnight===true?1440:0);let from=clock(b?.start),to=clock(b?.end);if(d?.overnight===true){if(from<start)from+=1440;if(to<start||(to===start&&from>start))to+=1440;if(end-start===1440&&from===start&&to===start)to+=1440;}return{from,to,minutes:Number.isFinite(from)&&Number.isFinite(to)&&to>from?to-from:null};}
function resolve(d){
 const blocks=d?.blocks;if(!usesHours(d))return{problems:[],blocks,legacy:true};
 const problems=[],start=clock(d.start),end=clock(d.end)+(d.overnight===true?1440:0);
 if(!Number.isFinite(start)||!Number.isFinite(end))problems.push('Indique inicio y fin de jornada.');else if(end<=start||end-start>1440)problems.push('La jornada debe durar más de cero y como máximo 24 horas. Revise si el fin corresponde al día siguiente.');
 if(!Array.isArray(blocks)||!blocks.length)problems.push('Añada los tramos que cubren toda la jornada.');
 const segments=[];if(Array.isArray(blocks))blocks.forEach((b,i)=>{const x=interval(d,b);if(x.minutes===null){problems.push('Tramo '+(i+1)+': indique horas de inicio y fin válidas.');return;}if(Number.isFinite(start)&&Number.isFinite(end)&&(x.from<start||x.to>end))problems.push('Tramo '+(i+1)+': queda fuera de la jornada.');segments.push({...b,startMinute:x.from,endMinute:x.to,minutes:x.minutes,source:i});});
 const sorted=segments.sort((a,b)=>a.startMinute-b.startMinute||a.endMinute-b.endMinute);let cursor=start;
 if(Number.isFinite(start)&&Number.isFinite(end))for(const b of sorted){if(b.startMinute<cursor)problems.push('Hay tramos solapados: cada minuto debe registrarse una sola vez.');if(b.startMinute>cursor)problems.push('Hay huecos sin actividad registrada entre los tramos.');cursor=Math.max(cursor,b.endMinute);}
 if(Number.isFinite(end)&&cursor<end)problems.push('Complete los tramos hasta el fin de jornada.');
 return{problems:[...new Set(problems)],blocks:sorted,start,end,shiftMinutes:end-start,legacy:false};
}
function sync(d){if(usesHours(d)&&Array.isArray(d.blocks))for(const b of d.blocks){const m=interval(d,b).minutes;b.minutes=m===null?'':String(m);}return d;}
function upgrade(d){
 if(!d||usesHours(d))return d;
 const start=clock(d.start),blocks=d.blocks;
 if(Array.isArray(blocks)&&blocks.length&&blocks.reduce((sum,b)=>sum+Number(b?.minutes||0),0)<=1440&&Number.isFinite(start)&&blocks.every(b=>String(b?.minutes??'').trim()!==''&&Number.isFinite(Number(b.minutes))&&Number(b.minutes)>0&&Number.isInteger(Number(b.minutes)))){
 let cursor=start;for(const b of blocks){b.start=time(cursor);cursor+=Number(b.minutes);b.end=time(cursor);}d.end=time(cursor);d.overnight=cursor>=1440;d.timeBased=true;return d;
 }
 if(!Array.isArray(blocks)||!blocks.length){d.end='';d.overnight=false;d.timeBased=true;}
 return d;
}
globalThis.MMCClockSchedule={clock,time,usesHours,interval,resolve,sync,upgrade};
})();
