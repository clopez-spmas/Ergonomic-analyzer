(()=>{"use strict";
const form=document.getElementById("ocraForm"),status=document.getElementById("status"),fileInput=document.getElementById("fileInput");
let dirty=false;
const fields=[...form.querySelectorAll("input,select,textarea")];

function initNavigation(){
 const screens=[...document.querySelectorAll(".screen")];
 const counter=document.getElementById("screenCounter");
 const prev=document.getElementById("prevBtn");
 const next=document.getElementById("nextBtn");
 let current=0;

 function renderNavigation(){
   current=Math.max(0,Math.min(screens.length-1,current));
   screens.forEach((screen,index)=>screen.classList.toggle("active",index===current));
   counter.textContent="Pantalla "+(current+1)+" de "+screens.length;
   prev.disabled=current===0;
   next.disabled=current===screens.length-1;
   window.scrollTo({top:0,behavior:"smooth"});
 }

 function show(index){
   current=Number.isFinite(index)?index:0;
   renderNavigation();
 }

 function navigate(delta){
   show(current+delta);
 }

 prev.addEventListener("click",()=>navigate(-1));
 next.addEventListener("click",()=>navigate(1));

 const controller={show,navigate,get current(){return current}};
 window.OCRA_Navigation=controller;
 renderNavigation();
 return controller;
}
const n=name=>{const v=parseFloat(form.elements[name]?.value);return Number.isFinite(v)?v:0};
const fmt=(v,d=2)=>Number.isFinite(v)?v.toFixed(d).replace(".",","):"—";
const values=()=>{const o={savedAt:new Date().toISOString(),values:{},kinovea:{...kinoveaState,videoUrl:""},recovery:{...recoveryState,pauses:(recoveryState.pauses||[]).map(p=>({...p}))}};fields.forEach(f=>{if(f.type==="checkbox")o.values[f.name]=f.checked;else if(f.type==="radio"){if(f.checked)o.values[f.name]=f.value;else if(!(f.name in o.values))o.values[f.name]="";}else o.values[f.name]=f.value});
["compA","compB"].forEach(name=>{
 const selected=form.querySelector('[name="'+name+'"]:checked');
 o.values[name]=selected?selected.value:"";
});if(typeof simulationState!=="undefined"&&simulationState.initialised){o.simulation={version:1,baseline:simClone(simulationState.baseline||{}),current:simClone(simulationState.current||simReadState())};}return o};
function apply(o){if(!o||!o.values)throw Error("Formato no válido");fields.forEach(f=>{if(!(f.name in o.values))return;if(f.type==="checkbox")f.checked=!!o.values[f.name];else if(f.type==="radio")f.checked=String(o.values[f.name]??"")===String(f.value);else f.value=o.values[f.name]??""});
["compA","compB"].forEach(name=>{
 const value=o.values[name];
 if(value===undefined)return;
 form.querySelectorAll('[name="'+name+'"]').forEach(el=>{el.checked=String(el.value)===String(value)});
});if(o.kinovea)restoreKinoveaState(o.kinovea);if(o.recovery)recoveryState={...recoveryState,...o.recovery,pauses:Array.isArray(o.recovery.pauses)?o.recovery.pauses:[]};dirty=false;recoveryRenderInputs();updatePostureModeUI();updateForceModeUI();kRenderAnalyses();safeCalculate();if(simulationState?.initialised){if(o.simulation?.current||o.simulation?.baseline)simRestoreSaved(o.simulation);else simSetInitialFromStudy();}status.textContent="Estudio cargado correctamente."}
function lookup(table,x){let r=table[0][1];for(const [k,v] of table){if(x>=k)r=v;else break}return r}
const duration=[[0,.50],[121,.65],[181,.75],[241,.85],[301,.925],[361,.95],[421,1],[481,1.5]];
const recTable={0:1,0.5:1.025,1:1.05,1.5:1.086,2:1.12,2.5:1.16,3:1.20,3.5:1.265,4:1.33,4.5:1.40,5:1.48,5.5:1.58,6:1.70,6.5:1.83,7:2,7.5:2.25,8:2.5,9:3};
const recAuto={480:[7,6,5,4,3,2,1,0],460:[7,6,5,4,3,2,1],440:[6.5,5.5,4.5,3.5,2.5,1.5,.5],420:[6,5,4,3,2.5,1.5,0],390:[5.5,4.5,3.5,2.5,1.5,.5,0],360:[5,4,3,2,1,0],330:[4.5,3.5,2.5,1.5,.5,0],300:[4,3,2,1,0],270:[3.5,2.5,1.5,.5,0],240:[3,2,1,0],210:[2.5,1.5,.5,0],180:[2,1,0],120:[1,0],0:[0]};
let recoveryState={method:"schedule",start:"",end:"",minPause:8,pauses:[],mealId:null,lastResult:null};

function recoveryTimeToMinutes(value){
 const m=/^(\\d{1,2}):(\\d{2})$/.exec(String(value||""));
 if(!m)return null;
 const h=Number(m[1]),min=Number(m[2]);
 return Number.isFinite(h)&&Number.isFinite(min)&&h>=0&&h<24&&min>=0&&min<60?h*60+min:null;
}
function recoveryMinutesToTime(total){
 const t=((Math.round(total)%1440)+1440)%1440;
 return String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0");
}
function recoveryNormalise(){
 recoveryState.pauses=Array.isArray(recoveryState.pauses)?recoveryState.pauses:[];
 recoveryState.minPause=8;
 return recoveryState;
}
function recoveryResidualScore(minutes){
 if(minutes<20)return 0;
 if(minutes<=40)return .5;
 if(minutes<80)return 1;
 return null;
}
function calculateRecoverySchedule(state){
 const s=recoveryTimeToMinutes(state.start), rawEnd=recoveryTimeToMinutes(state.end);
 if(s===null||rawEnd===null)return {hours:null,valid:false,reason:"Indique la hora de inicio y finalización del turno."};
 let e=rawEnd;
 if(e<=s)e+=1440;
 const duration=e-s;
 if(duration<=0)return {hours:null,valid:false,reason:"La duración del turno debe ser superior a 0 minutos."};
 const normalised=(state.pauses||[]).map((p,index)=>{
   const ps=recoveryTimeToMinutes(p.start),peRaw=recoveryTimeToMinutes(p.end);
   if(ps===null||peRaw===null)return null;
   let pe=peRaw;
   while(pe<=ps)pe+=1440;
   while(ps<s) { /* no mutation of source */ break; }
   let relS=ps-s,relE=pe-s;
   while(relE<0){relS+=1440;relE+=1440}
   while(relS>duration){relS-=1440;relE-=1440}
   return {id:p.id||("pause_"+index),start:relS,end:relE,duration:Math.max(0,relE-relS),habitual:p.habitual!==false,type:p.type==="meal"?"meal":"pause",label:p.label||""};
 }).filter(Boolean);
 const longMeals=normalised.filter(p=>p.type==="meal"&&p.habitual&&p.duration>=30&&p.start>=0&&p.end<=duration);
 const primaryMeal=longMeals[0]||null;
 const validPauses=normalised.filter(p=>p.habitual&&p.duration>=state.minPause&&p.start>=0&&p.end<=duration);
 const validForBlocks=validPauses.filter(p=>!primaryMeal||p.id!==primaryMeal.id);
 if(primaryMeal){
   validForBlocks.push(...validPauses.filter(p=>p.id===primaryMeal.id));
 }else{
   /* A meal under 30 minutes remains a normal pause and can recover its containing block. */
 }
 const steps=[], recoveredRanges=[];
 let no=0;
 const addBlock=(a,b)=>{
   if(b<=a)return;
   const hit=validForBlocks.some(p=>p.end>a&&p.start<b);
   steps.push({kind:"block",start:a,end:b,recovered:hit,hours:hit?0:1,pauseIds:validForBlocks.filter(p=>p.end>a&&p.start<b).map(p=>p.id)});
   if(hit)recoveredRanges.push([a,b]); else no+=1;
 };
 const addResidual=(a,b)=>{
   if(b<=a)return;
   const value=recoveryResidualScore(b-a);
   steps.push({kind:"residual",start:a,end:b,recovered:value===0,hours:value===null?0:value,pauseIds:[]});
   if(value!==null)no+=value;
 };
 const scanSequence=(from,to)=>{
   let cursor=to;
   while(cursor-60>=from){addBlock(cursor-60,cursor);cursor-=60}
   addResidual(from,cursor);
 };
 if(primaryMeal){
   const preFrom=s,preTo=Math.max(s,Math.min(e,primaryMeal.start-60));
   if(preTo>preFrom)scanSequence(preFrom,preTo);
   const postFrom=Math.min(e,Math.max(s,primaryMeal.end)),postTo=Math.max(postFrom,e-60);
   if(postTo>postFrom)scanSequence(postFrom,postTo);
 }else{
   const to=Math.max(s,e-60);
   if(to>s)scanSequence(s,to);
 }
 return {hours:Math.max(0,no),valid:true,reason:"",duration,meal:primaryMeal,pauses:normalised,steps,recoveredRanges};
}
function recoveryStepLabel(step){
 const a=recoveryMinutesToTime(recoveryTimeToMinutes(recoveryState.start)+step.start);
 const b=recoveryMinutesToTime(recoveryTimeToMinutes(recoveryState.start)+step.end);
 if(step.kind==="block")return a+"–"+b+" · bloque de 60 min";
 return a+"–"+b+" · periodo parcial";
}
function recoveryRenderResult(result){
 const el=document.getElementById("recoveryScheduleResult"),detail=document.getElementById("recoveryScheduleDetail");
 if(!el||!detail)return;
 if(!result.valid){el.textContent="—";detail.innerHTML='<div class="placeholder">'+escK(result.reason)+'</div>';return}
 el.textContent=fmt(result.hours,1)+" h";
 const rows=result.steps.map(step=>{
   const pauseNames=step.pauseIds.map(id=>{const p=(result.pauses||[]).find(x=>x.id===id);return p?"pausa "+(p.label||id):id}).join(", ");
   const state=step.kind==="residual"&&step.hours===0?"Recuperado automáticamente":step.hours===0?"Recuperado":step.hours===.5?"0,5 h sin recuperación":"1 h sin recuperación";
   return "<tr><td>"+recoveryStepLabel(step)+"</td><td>"+(step.kind==="block"?"Sí":"No")+" </td><td>"+(pauseNames||"—")+"</td><td>"+state+"</td></tr>";
 }).join("");
 const meal=result.meal?"Comida válida: "+recoveryMinutesToTime(recoveryTimeToMinutes(recoveryState.start)+result.meal.start)+"–"+recoveryMinutesToTime(recoveryTimeToMinutes(recoveryState.start)+result.meal.end)+" ("+fmt(result.meal.duration,0)+" min).":"No hay comida ≥30 min; cualquier comida corta se trata como pausa.";
 detail.innerHTML='<div class="notice"><strong>'+meal+'</strong> La última hora del turno se considera recuperada por defecto; con comida válida, también se considera recuperada la hora inmediatamente anterior. Las pausas situadas en esos tramos no añaden otra hora de recuperación.</div><div class="result-table-wrap"><table class="compact-table"><thead><tr><th>Periodo</th><th>Bloque 60 min</th><th>Pausa incluida</th><th>Valoración</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function recoverySyncOrganisation(){
 const r=recoveryState.lastResult;
 if(!r?.valid)return;
 const pauses=(r.pauses||[]).filter(p=>p.habitual&&p.duration>=recoveryState.minPause&&(p.type!=="meal"||!r.meal||p.id!==r.meal.id));
 const shortMeals=(r.pauses||[]).filter(p=>p.habitual&&p.type==="meal"&&p.duration>=recoveryState.minPause&&(!r.meal||p.id!==r.meal.id));
 const meal=r.meal;
 const set=(name,value)=>{const el=form.elements[name];if(el)el.value=String(value);};
 set("numPausas",pauses.length+shortMeals.length);
 set("tiempoPausas",Math.round(pauses.reduce((s,p)=>s+p.duration,0)+shortMeals.reduce((s,p)=>s+p.duration,0)));
 set("pausaComer",meal?Math.round(meal.duration):0);
}
function recoveryCalculateAndRender(){
 recoveryNormalise();
 const result=calculateRecoverySchedule(recoveryState);
 recoveryState.lastResult=result;
 recoveryRenderResult(result);
 recoverySyncOrganisation();
 return result;
}
function recoveryRenderInputs(){
 recoveryNormalise();
 recoveryState.minPause=8;
 recoveryState.start=form.elements.horaInicio?.value||"";
 recoveryState.end=form.elements.horaFin?.value||"";
 const tbody=document.getElementById("recoveryPausesBody");if(!tbody)return;
 tbody.innerHTML=(recoveryState.pauses||[]).map((p,i)=>'<tr><td>'+(i+1)+'</td><td><select data-recovery-type="'+i+'"><option value="pause" '+(p.type==="pause"?"selected":"")+'>Pausa habitual</option><option value="meal" '+(p.type==="meal"?"selected":"")+'>Comida</option></select></td><td><input type="time" data-recovery-start="'+i+'" value="'+escK(p.start||"")+'"></td><td><input type="time" data-recovery-end="'+i+'" value="'+escK(p.end||"")+'"></td><td><input type="checkbox" data-recovery-habitual="'+i+'" '+(p.habitual!==false?"checked":"")+'></td><td><button type="button" class="toolbar-btn" data-recovery-remove="'+i+'">Eliminar</button></td></tr>').join("")||'<tr><td colspan="6">No hay pausas añadidas.</td></tr>';
 tbody.querySelectorAll("[data-recovery-type]").forEach(x=>x.onchange=()=>{recoveryState.pauses[Number(x.dataset.recoveryType)].type=x.value;dirty=true;recoveryCalculateAndRender();safeCalculate()});
 tbody.querySelectorAll("[data-recovery-start]").forEach(x=>x.onchange=()=>{recoveryState.pauses[Number(x.dataset.recoveryStart)].start=x.value;dirty=true;recoveryCalculateAndRender();safeCalculate()});
 tbody.querySelectorAll("[data-recovery-end]").forEach(x=>x.onchange=()=>{recoveryState.pauses[Number(x.dataset.recoveryEnd)].end=x.value;dirty=true;recoveryCalculateAndRender();safeCalculate()});
 tbody.querySelectorAll("[data-recovery-habitual]").forEach(x=>x.onchange=()=>{recoveryState.pauses[Number(x.dataset.recoveryHabitual)].habitual=x.checked;dirty=true;recoveryCalculateAndRender();safeCalculate()});
 tbody.querySelectorAll("[data-recovery-remove]").forEach(x=>x.onclick=()=>{recoveryState.pauses.splice(Number(x.dataset.recoveryRemove),1);dirty=true;recoveryRenderInputs();recoveryCalculateAndRender();safeCalculate()});
}
function initForceInputMode(){const el=document.getElementById("fuerzaModo");if(!el)return;el.addEventListener("change",()=>{updateForceModeUI();dirty=true;safeCalculate()});updateForceModeUI()}

function initRecoverySchedule(){
 recoveryNormalise();
 const add=document.getElementById("addRecoveryPauseBtn");
 if(add)add.onclick=()=>{recoveryState.pauses.push({id:"pause_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6),type:"pause",start:"",end:"",habitual:true,label:""});dirty=true;recoveryRenderInputs();recoveryCalculateAndRender();};
 recoveryRenderInputs();
 recoveryCalculateAndRender();
}

const freqYes=[[0,0],[22.5,.5],[27.5,1],[32.5,2],[37.5,3],[42.5,4],[47.5,5],[52.5,6],[57.5,7],[62.5,8],[67.5,9],[72.5,9]];
const freqNo=[[0,0],[22.5,.5],[27.5,1],[32.5,2],[37.5,4],[42.5,5],[47.5,6],[52.5,7],[57.5,8],[62.5,9],[67.5,10],[72.5,10]];
const force34=[[0,0],[.05,.5],[.10,.5],[.18,1],[.26,1.5],[.33,2],[.37,2.5],[.42,3],[.46,3.5],[.50,4],[.54,4.5],[.58,5],[.63,5.5],[.67,6],[.75,6.5],[.83,7],[.92,7.5],[1,8]];
const force57=[[0,0],[.16,2],[.33,4],[.66,6],[1,8],[1.5,9],[2,10],[2.5,11],[3,12],[3.5,13],[4,14],[4.5,15],[5,16],[5.63,17],[6.25,18],[6.88,19],[7.5,20],[8.13,21],[8.75,22],[9.38,23],[10,24]];
const force810=[[0,0],[.16,3],[.33,6],[.66,9],[1,12],[1.33,13],[1.67,14],[2,15],[2.33,16],[2.67,17],[3,18],[3.33,19],[3.67,20],[4,21],[4.33,22],[4.67,23],[5,24],[5.63,25],[6.25,26],[6.88,27],[7.5,28],[8.13,29],[8.75,30],[9.38,31],[10,32]];
function recoveryHours(eff,count,meal){const row=recAuto[Math.round(eff)];if(!row)return null;const valid=Math.max(0,Math.floor(count)+(meal>=30?1:0));return row[Math.min(valid,row.length-1)]}
function recoveryMultiplier(h){if(!Number.isFinite(h))return null;const x=Math.max(0,Math.min(9,h));const keys=Object.keys(recTable).map(Number);let best=keys[0];for(const k of keys){if(Math.abs(k-x)<Math.abs(best-x))best=k}return recTable[best]}
function freq(actionsPerMin,interruptions){
 const x=Number(actionsPerMin);
 if(!Number.isFinite(x)||x<22.5)return 0;
 if(x<27.5)return 0.5;
 if(x<32.5)return 1;
 if(x<37.5)return 2;
 if(x<42.5)return interruptions?3:4;
 if(x<47.5)return interruptions?4:5;
 if(x<52.5)return interruptions?5:6;
 if(x<57.5)return interruptions?6:7;
 if(x<62.5)return interruptions?7:8;
 if(x<67.5)return interruptions?8:9;
 return interruptions?9:10;
}
function forceScore(seconds34,seconds57,seconds810,cycle){if(cycle<=0)return 0;return lookup(force34,seconds34/cycle)+lookup(force57,seconds57/cycle)+lookup(force810,seconds810/cycle)}
function forceInputSeconds(name,cycle){const value=n(name);if(cycle<=0)return 0;const mode=document.getElementById("fuerzaModo")?.value||"segundos";return mode==="porcentaje"?cycle*value/100:value}
function updateForceModeUI(){const mode=document.getElementById("fuerzaModo")?.value||"segundos";const unidad=mode==="porcentaje"?"% del tiempo de ciclo":"segundos/ciclo";document.querySelectorAll(".fuerza-unidad").forEach(el=>{el.textContent=unidad;el.style.display="inline";});document.querySelectorAll('input[name^="dxFuerza"],input[name^="ixFuerza"]').forEach(el=>{el.step="0.1";el.max=mode==="porcentaje"?"100":"";el.placeholder=mode==="porcentaje"?"%":"s";el.title=unidad;});}
function stereo(prefix){return (form.elements[prefix+"StereoAlmost"]?.checked||form.elements[prefix+"StereoCycle8"]?.checked)?3:(form.elements[prefix+"StereoHalf"]?.checked||form.elements[prefix+"StereoCycle815"]?.checked||form.elements[prefix+"StereoStatic"]?.checked)?1.5:0}
function classification(x){if(!Number.isFinite(x))return "—";if(x<7.5)return "VERDE · Riesgo aceptable";if(x<=11)return "AMARILLO · Riesgo muy leve";if(x<=14)return "ROJO SUAVE · Riesgo medio leve";if(x<=22.5)return "ROJO · Riesgo medio";return "VIOLETA · Riesgo elevado"}

let kinoveaState={jsonFiles:[],dataSets:[],data:null,mapping:{},range:{mode:"all",start:0,end:0,cycles:1},
 postureManual:{
   duration:0,
   modes:{shoulder:"segundos",elbow:"segundos",wrist:"segundos"},
   shoulder:{right:{source:"manual",flex:0,ext:0},left:{source:"manual",flex:0,ext:0}},
   elbow:{right:{source:"manual",flex:0,ext:0},left:{source:"manual",flex:0,ext:0}},
   wrist:{right:{source:"manual",flex:0,ext:0},left:{source:"manual",flex:0,ext:0}}
 }};
const KPOINTS=[
 ["right_hip","Cadera derecha"],["left_hip","Cadera izquierda"],
 ["right_shoulder","Hombro derecho"],["left_shoulder","Hombro izquierdo"],
 ["right_elbow","Codo derecho"],["left_elbow","Codo izquierdo"],
 ["right_wrist","Muñeca derecha"],["left_wrist","Muñeca izquierda"],
 ["right_index","Índice derecho"],["left_index","Índice izquierdo"]
];
const kNum=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d};
function kAvailableMarkers(){const out={};for(const ds of kinoveaState.dataSets||[]){for(const [key,marker] of Object.entries(ds.mapping||{})){if(marker)out[key]=marker}}return out}
function kMarkerLabel(key){const item=KPOINTS.find(x=>x[0]===key);return item?item[1]:key}
function kRequired(kind,side){
 if(kind==="shoulder")return side==="left"?["left_hip","left_shoulder","left_elbow"]:["right_hip","right_shoulder","right_elbow"];
 if(kind==="elbow")return side==="left"?["left_shoulder","left_elbow","left_wrist"]:["right_shoulder","right_elbow","right_wrist"];
 return side==="left"?["left_elbow","left_wrist","left_index"]:["right_elbow","right_wrist","right_index"];
}
function kMissingMarkers(kind,side){
 const available=kAvailableMarkers();
 return kRequired(kind,side).filter(x=>!available[x]);
}
function kKinoveaAvailability(kind,side){
 const missing=kMissingMarkers(kind,side);
 if(!kinoveaState.data)return {state:"none",missing};
 if(missing.length)return {state:"partial",missing};
 return {state:"ready",missing:[]};
}
function kMissingMessage(kind){
 const parts=[];
 ["right","left"].forEach(side=>{
   const missing=kMissingMarkers(kind,side);
   if(missing.length)parts.push((side==="right"?"Derecha":"Izquierda")+": faltan "+missing.map(kMarkerLabel).join(", "));
 });
 return parts.length
  ?"No se puede estudiar completamente la postura de "+(kind==="shoulder"?"hombro":kind==="elbow"?"codo":"muñeca")+" en "+parts.join(" · ")+"."
  :"";
}
function parseKinovea(raw){
 const ts=raw?.data?.timeseries||raw?.timeseries||{};
 const names=Object.keys(ts);
 if(!names.length)throw Error("El JSON no contiene data.timeseries de Kinovea.");
 const series=ts;
 const first=series[names[0]]||{};
 const time=Array.isArray(first.time)?first.time:[];
 const frames=time.map((t,i)=>{
   const landmarks={};
   names.forEach(name=>{
     const s=series[name]||{}, d=s.data?.["0"]?.[i], x=Array.isArray(d)?d[0]:s.x?.[i], y=Array.isArray(d)?d[1]:s.y?.[i];
     if(Number.isFinite(Number(x))&&Number.isFinite(Number(y)))landmarks[name]={x:Number(x),y:Number(y)};
   });
   return {index:i,time:Number(t)||0,landmarks};
 });
 const duration=frames.length?Math.max(...frames.map(f=>f.time)):0;
 return {
   producer:raw?.metadata?.producer||raw?.metadata?.Producer||"Kinovea",
   fps:kNum(raw?.metadata?.fps||raw?.metadata?.frameRate,0),
   imageSize:raw?.metadata?.imageSize||null,
   markers:names,frameCount:frames.length,duration,frames
 };
}
function escK(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function kPoint(frame,key){for(const ds of kinoveaState.dataSets||[]){const marker=ds.mapping?.[key];if(marker&&ds.data?.frames?.[frame.index]?.landmarks?.[marker])return ds.data.frames[frame.index].landmarks[marker]}const marker=kinoveaState.mapping?.[key];return marker?frame.landmarks[marker]:null}
function kAngle(a,b,c){
 if(!a||!b||!c)return NaN;
 const u={x:a.x-b.x,y:a.y-b.y},v={x:c.x-b.x,y:c.y-b.y};
 const nu=Math.hypot(u.x,u.y),nv=Math.hypot(v.x,v.y);if(!nu||!nv)return NaN;
 return Math.acos(Math.max(-1,Math.min(1,(u.x*v.x+u.y*v.y)/(nu*nv))))*180/Math.PI;
}
function kSigned(a,b,c,direction){
 if(!a||!b||!c)return NaN;
 const u={x:a.x-b.x,y:a.y-b.y},v={x:c.x-b.x,y:c.y-b.y};
 const nu=Math.hypot(u.x,u.y),nv=Math.hypot(v.x,v.y);if(!nu||!nv)return NaN;
 const raw=Math.atan2(u.x*v.y-u.y*v.x,u.x*v.x+u.y*v.y)*180/Math.PI;
 return raw*(direction==="right"?1:-1);
}
function kRotation(elbow,wrist,index){
 if(!elbow||!wrist||!index)return NaN;
 const a={x:wrist.x-elbow.x,y:wrist.y-elbow.y},b={x:index.x-wrist.x,y:index.y-wrist.y};
 return Math.atan2(a.x*b.y-a.y*b.x,a.x*b.x+a.y*b.y)*180/Math.PI;
}
function kRange(){
 if(!kinoveaState.data)return null;
 const d=kinoveaState.data.duration, r=kinoveaState.range;
 let start=0,end=d;
 if(r.mode==="interval"){start=Math.max(0,Math.min(d,kNum(r.start,0)));end=Math.max(start,Math.min(d,kNum(r.end,d)));}
 if(r.mode==="cycles"){const cycles=Math.max(1,Math.floor(kNum(r.cycles,1)));r.cycles=cycles;}
 return {start,end,duration:Math.max(0,end-start)};
}
function kRangeLabel(){
 const r=kRange();if(!r)return "Cargue el JSON de Kinovea.";
 if(kinoveaState.range.mode==="all")return "Todo el vídeo · "+fmt(r.duration,2)+" s";
 if(kinoveaState.range.mode==="interval")return "Desde "+fmt(r.start,2)+" s hasta "+fmt(r.end,2)+" s · "+fmt(r.duration,2)+" s";
 return "Todo el vídeo · "+fmt(r.duration,2)+" s · "+kinoveaState.range.cycles+" ciclos visibles · media "+fmt(r.duration/kinoveaState.range.cycles,2)+" s/ciclo";
}
function kSetStatus(msg){status.textContent=msg}
function renderKinoveaSelectedTable(){
 const t=document.getElementById("kinoveaDataTable");if(!t)return;
 const sets=kinoveaState.dataSets||[];
 const rows=sets.map((ds,di)=>{
  const selected=KPOINTS.map(([key,label])=>({label,marker:ds.mapping?.[key]})).filter(x=>x.marker).map(x=>x.label+": "+x.marker);
  return '<tr><td>JSON '+(di+1)+'</td><td>'+escK(ds.fileName)+'</td><td>'+escK(ds.producer||ds.data?.producer||"Kinovea")+'</td><td>'+escK(ds.kinoveaVersion||"—")+'</td><td>'+fmt(ds.data?.duration||0,2)+' s</td><td>'+(selected.length?selected.map(escK).join("<br>"):"Ninguno")+'</td></tr>';
 }).join("");
 t.innerHTML='<div class="result-table-wrap"><table class="compact-table"><thead><tr><th>Archivo</th><th>JSON</th><th>Origen</th><th>Versión</th><th>Duración</th><th>Marcadores seleccionados</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="notice"><strong>Trazabilidad:</strong> el estudio conserva los datos originales de los archivos Kinovea importados para mantener la trazabilidad del análisis.</div>';
}
function renderKinovea(){
 const t=document.getElementById("kinoveaDataTable"),m=document.getElementById("kinoveaMapping");
 if(!kinoveaState.data){
  t.innerHTML='<div class="placeholder">Todavía no hay datos importados.</div>';
  m.innerHTML='<strong>Asignación de marcadores</strong><div class="placeholder">Cargue el JSON de Kinovea.</div>';
  return;
 }
 m.innerHTML=(kinoveaState.dataSets||[]).map((ds,di)=>{
  const opts=ds.data.markers.map(x=>'<option value="'+escK(x)+'">'+escK(x)+'</option>').join("");
  return '<div class="calculation-box"><strong>JSON '+(di+1)+': '+escK(ds.fileName)+'</strong><p>Asigne los marcadores de este archivo a los puntos anatómicos. Puede cargar otro JSON del mismo vídeo con otros marcadores.</p><div class="form-grid">'+KPOINTS.map(([key,label])=>'<label>'+label+'<select data-kset="'+di+'" data-kmap="'+key+'"><option value="">No asignado</option>'+opts+'</select></label>').join("")+'</div></div>'
 }).join("")||'<div class="placeholder">Cargue el JSON de Kinovea.</div>';
 m.querySelectorAll("[data-kmap]").forEach(sel=>{
  const di=Number(sel.dataset.kset);
  sel.value=kinoveaState.dataSets[di]?.mapping?.[sel.dataset.kmap]||"";
  sel.onchange=()=>{
   const v=sel.value,ds=kinoveaState.dataSets[di];
   const duplicate=v&&Object.entries(ds.mapping||{}).some(([k,x])=>k!==sel.dataset.kmap&&x===v);
   if(duplicate){sel.value="";kSetStatus("Ese marcador de Kinovea ya está asignado a otro punto anatómico en este JSON.");return}
   ds.mapping[sel.dataset.kmap]=v;
   dirty=true;
   renderKinoveaSelectedTable();
   kRenderAnalyses();
  };
 });
 renderKinoveaSelectedTable();
 kRenderAnalyses();
}
function renderKRange(){
 const mode=document.getElementById("kinoveaRangeMode");if(!mode)return;
 mode.value=kinoveaState.range.mode;
 document.getElementById("kinoveaStart").value=kinoveaState.range.start??0;
 document.getElementById("kinoveaEnd").value=kinoveaState.range.end??(kinoveaState.data?.duration||0);
 document.getElementById("kinoveaCycles").value=kinoveaState.range.cycles||1;
 const interval=kinoveaState.range.mode==="interval",cycles=kinoveaState.range.mode==="cycles";
 const startField=document.getElementById("kinoveaStartField"),endField=document.getElementById("kinoveaEndField"),cyclesField=document.getElementById("kinoveaCyclesField");
 [startField,endField].forEach(el=>{if(!el)return;el.hidden=!interval;el.style.display=interval?"":"none"});
 if(cyclesField){cyclesField.hidden=!cycles;cyclesField.style.display=cycles?"":"none"};
 document.getElementById("kinoveaRangeSummary").textContent=kRangeLabel();
}
function bindKinovea(){
 const mode=document.getElementById("kinoveaRangeMode");if(!mode)return;
 mode.onchange=()=>{kinoveaState.range.mode=mode.value;renderKRange();kRenderAnalyses();};
 ["kinoveaStart","kinoveaEnd","kinoveaCycles"].forEach(id=>document.getElementById(id).oninput=()=>{
   kinoveaState.range.start=kNum(document.getElementById("kinoveaStart").value,0);
   kinoveaState.range.end=kNum(document.getElementById("kinoveaEnd").value,kinoveaState.data?.duration||0);
   kinoveaState.range.cycles=Math.max(1,Math.floor(kNum(document.getElementById("kinoveaCycles").value,1)));
   renderKRange();kRenderAnalyses();dirty=true;
 });
}
function ensureManualPosture(){
 const p=kinoveaState.postureManual||{};
 p.duration=kNum(p.duration,0);
 p.modes={shoulder:p.modes?.shoulder==="porcentaje"?"porcentaje":"segundos",elbow:p.modes?.elbow==="porcentaje"?"porcentaje":"segundos",wrist:p.modes?.wrist==="porcentaje"?"porcentaje":"segundos"};
 ["shoulder","elbow","wrist"].forEach(kind=>{
   p[kind]=p[kind]||{};
   ["right","left"].forEach(side=>{
     const previous=p[kind][side];
     if(!previous || !previous.source){
       const hasKinovea=kSideHasKinovea(kind,side);
       p[kind][side]={source:hasKinovea?"kinovea":"manual",kinoveaFileId:hasKinovea?kKinoveaFileId(kind,side):null,flex:0,ext:0,...(previous||{})};
     }else{
       p[kind][side]={source:previous.source==="kinovea"?"kinovea":"manual",kinoveaFileId:previous.source==="kinovea"?(previous.kinoveaFileId||kKinoveaFileId(kind,side)):null,flex:0,ext:0,...previous};
     }
     p[kind][side].flex=kNum(p[kind][side].flex,0);
     p[kind][side].ext=kNum(p[kind][side].ext,0);
   });
 });
 kinoveaState.postureManual=p;
 return p;
}
function postureStudyMode(){
 return form.elements.postureStudyMode?.value==="kinovea"?"kinovea":"manual";
}
function syncPostureSources(){
 const mode=postureStudyMode(),p=ensureManualPosture();
 ["shoulder","elbow","wrist"].forEach(kind=>{
   ["right","left"].forEach(side=>{
     const row=p[kind][side],canK=kSideHasKinovea(kind,side);
     if(mode==="manual"){
       row.source="manual";
       row.kinoveaFileId=null;
     }else if(canK){
       row.source="kinovea";
       row.kinoveaFileId=kKinoveaFileId(kind,side);
     }else{
       row.source="manual";
       row.kinoveaFileId=null;
     }
   });
 });
 return p;
}
function ensurePostureSourcesAvailable(){
 const p=ensureManualPosture();
 ["shoulder","elbow","wrist"].forEach(kind=>{
   ["right","left"].forEach(side=>{
     const row=p[kind][side];
     if(row.source==="kinovea"&&!kSideHasKinovea(kind,side)){
       row.source="manual";
       row.kinoveaFileId=null;
     }
   });
 });
 return p;
}
function initPostureStudyMode(){
 const el=form.elements.postureStudyMode;
 if(!el)return;
 el.addEventListener("change",()=>{
   syncPostureSources();
   dirty=true;
   kRenderAnalyses();
   safeCalculate();
 });
 if(el.value!=="manual"&&el.value!=="kinovea")el.value="manual";
 syncPostureSources();
}
function kKinoveaFileId(kind,side){const required=kRequired(kind,side);return (kinoveaState.dataSets||[]).find(ds=>required.every(key=>!!ds.mapping?.[key]))?.id||null}
function kSideHasKinovea(kind,side){return !!kKinoveaFileId(kind,side) && !!kinoveaState.data}
function kSourceLabel(source){return source==="kinovea"?"KINOVEA":"MANUAL"}
const postureHandTable=[[0,0],[10,.5],[15,1],[20,1.5],[25,2],[31,2.5],[37,3],[44,3.5],[50,4],[54,4.5],[57,5],[61,5.5],[65,6],[69,6.5],[72,7],[76,7.5],[80,8],[100,8]];
const postureWristTable=[[0,0],[10,.5],[15,1],[20,1.5],[25,2],[31,2.5],[37,3],[44,3.5],[50,4],[54,4.5],[57,5],[61,5.5],[65,6],[69,6.5],[72,7],[76,7.5],[80,8],[100,8]];
const postureElbowTable=[[0,0],[5,0],[10,.5],[15,1],[20,1.5],[25,2],[31,2.5],[37,3],[44,3.5],[50,4],[54,4.5],[57,5],[61,5.5],[65,6],[69,6.5],[72,7],[76,7.5],[80,8],[100,8]];
const postureShoulderTable=[[0,0],[3,.5],[5,1],[8,1.5],[10,2],[12,2.5],[14,3],[16,3.5],[18,4],[20,4.5],[22,5],[24,5.5],[28,6],[31,6.5],[34,7],[37,7.5],[40,8],[43,9],[46,11],[50,12],[54,13],[58,14],[62,15],[66,16],[70,17],[74,18],[78,19],[82,20],[86,21],[90,22],[94,23],[100,24]];
function postureScore(table,pct){return lookup(table,Math.max(0,Math.min(100,pct)))}
function kManualDuration(){const p=ensureManualPosture(),r=kRange();if(postureStudyMode()==="manual"||!r){const tntr=n("turnoEfectivoManual")||n("turnoOficial"),pauses=n("tiempoPausas"),meal=n("pausaComer"),nonRep=n("noRepetitivo"),net=Math.max(0,tntr-pauses-meal-nonRep);return net>0?net*60:p.duration}return r.duration}
function kForcedSeconds(kind,side){
 const p=ensureManualPosture()[kind][side],r=kRange();
 if(p.source==="manual")return postureInputSeconds(p.flex,kManualDuration(),kind);
 if(!r||!kinoveaState.data||kMissingMarkers(kind,side).length)return 0;
 const frames=kinoveaState.data.frames;let total=0,base=null;
 for(let i=0;i<frames.length-1;i++){
  const a=frames[i],b=frames[i+1],dt=Math.max(0,Math.min(b.time,r.end)-Math.max(a.time,r.start));if(dt<=0)continue;
  let va,vb;
  if(kind==="shoulder"){va=kSigned(kPoint(a,side+"_hip"),kPoint(a,side+"_shoulder"),kPoint(a,side+"_elbow"),side==="right"?"right":"left");vb=kSigned(kPoint(b,side+"_hip"),kPoint(b,side+"_shoulder"),kPoint(b,side+"_elbow"),side==="right"?"right":"left")}
  else if(kind==="elbow"){va=kAngle(kPoint(a,side+"_shoulder"),kPoint(a,side+"_elbow"),kPoint(a,side+"_wrist"));vb=kAngle(kPoint(b,side+"_shoulder"),kPoint(b,side+"_elbow"),kPoint(b,side+"_wrist"))}
  else{va=kSigned(kPoint(a,side+"_elbow"),kPoint(a,side+"_wrist"),kPoint(a,side+"_index"),side==="right"?"right":"left");vb=kSigned(kPoint(b,side+"_elbow"),kPoint(b,side+"_wrist"),kPoint(b,side+"_index"),side==="right"?"right":"left")}
  if(!Number.isFinite(va)||!Number.isFinite(vb))continue;
  if(base===null)base=va;
  const v=(va+vb)/2-base;
  if(kind==="shoulder"){if(v>=80||v<-20)total+=dt}else if(Math.abs(v)>60)total+=dt;
 }
 return total;
}
function postureTimeLabel(seconds){
 const value=Math.max(0,Number(seconds)||0);
 if(value<60)return fmt(value,2)+" s";
 const totalMinutes=value/60;
 if(totalMinutes<60)return fmt(totalMinutes,2)+" min";
 const hours=Math.floor(totalMinutes/60),minutes=Math.round(totalMinutes-hours*60);
 if(minutes===60)return (hours+1)+" h";
 return minutes>0?hours+" h "+minutes+" min":hours+" h";
}
function kManualRows(kind,side){
 const p=ensureManualPosture()[kind][side],duration=kManualDuration(),seconds=postureInputSeconds(p.flex,duration,kind),pct=duration>0?seconds/duration*100:0,label=side==="right"?"Derecha":"Izquierda";
 const criterion=kind==="shoulder"?"Flexión ≥80° o abducción ≥80° o extensión >20°":kind==="elbow"?"Flexo-extensión >60° o prono-supinación >60°":"Flexión/extensión >45° o desviación radial >15° / ulnar >20°";
 const table=kind==="shoulder"?postureShoulderTable:kind==="elbow"?postureElbowTable:postureWristTable;
 return '<tr><td>'+label+'</td><td>MANUAL</td><td>'+criterion+'</td><td>'+postureTimeLabel(seconds)+'</td><td>'+fmt(pct,2)+' %</td><td>'+fmt(postureScore(table,pct),2)+'</td></tr>';
}
function kAnalysisRows(kind){
 const r=kRange(),rows=[];
 ["right","left"].forEach(side=>{
  const p=ensureManualPosture()[kind][side],seconds=p.source==="manual"?postureInputSeconds(p.flex,kManualDuration(),kind):kForcedSeconds(kind,side),total=r?.duration||kManualDuration(),pct=total>0?seconds/total*100:0;
  if(p.source==="manual"){rows.push(kManualRows(kind,side));return}
  if(total<=0)return;
  const table=kind==="shoulder"?postureShoulderTable:kind==="elbow"?postureElbowTable:postureWristTable;
  const criterion=kind==="shoulder"?"Flexión ≥80° o abducción ≥80° o extensión >20°":kind==="elbow"?"Flexo-extensión >60° o prono-supinación >60°":"Flexión/extensión >45° o desviación radial >15° / ulnar >20°";
  rows.push('<tr><td>'+(side==="right"?"Derecha":"Izquierda")+'</td><td>KINOVEA</td><td>'+criterion+'</td><td>'+postureTimeLabel(seconds)+'</td><td>'+fmt(pct,2)+' %</td><td>'+fmt(postureScore(table,pct),2)+'</td></tr>');
 });
 return '<div class="notice"><strong>Criterio:</strong> se calcula el porcentaje de tiempo en postura forzada y se asigna la puntuación correspondiente. El valor de cada articulación se obtiene de forma independiente para DX e IX.</div><div class="result-table-wrap"><table class="compact-table"><thead><tr><th>Extremidad</th><th>Origen</th><th>Criterio de postura forzada</th><th>Tiempo</th><th>% tiempo</th><th>Puntuación</th></tr></thead><tbody>'+(rows.length?rows.join(""):'<tr><td colspan="6">No hay datos de postura todavía.</td></tr>')+'</tbody></table></div>';
}
function postureModeForKind(kind){
 const state=ensureManualPosture().modes?.[kind];
 const mode=state==="porcentaje"?"porcentaje":"segundos";
 const el=document.getElementById("postureModo"+kind.charAt(0).toUpperCase()+kind.slice(1));
 if(el&&el.value!==mode)el.value=mode;
 return mode;
}
function postureInputSeconds(input,duration,kind){
 const value=Math.max(0,kNum(input,0));
 return postureModeForKind(kind)==="porcentaje"?duration*value/100:value;
}
function updatePostureModeUI(){
 const p=ensureManualPosture();
 ["shoulder","elbow","wrist"].forEach(kind=>{
   const mode=postureModeForKind(kind),unidad=mode==="porcentaje"?"% del tiempo":"segundos";
   p.modes[kind]=mode;
   const box=document.getElementById(kind==="shoulder"?"ocraShoulderPanel":kind==="elbow"?"ocraElbowPanel":"ocraWristPanel");
   if(!box)return;
   const selector=document.getElementById("postureModo"+kind.charAt(0).toUpperCase()+kind.slice(1));
   if(selector)selector.value=mode;
   box.querySelectorAll(".postura-unidad").forEach(el=>el.textContent=unidad);
   box.querySelectorAll("[data-manual-posture]").forEach(el=>{
     el.step="0.1";
     el.max=mode==="porcentaje"?"100":"";
     el.placeholder=mode==="porcentaje"?"%":"s";
     el.title=unidad;
   });
 });
}
function kManualControls(kind,side,threshold){
 const p=ensureManualPosture()[kind][side],label=side==="right"?"Derecha":"Izquierda",availability=kKinoveaAvailability(kind,side),canK=availability.state==="ready",mode=postureModeForKind(kind),unidad=mode==="porcentaje"?"% del tiempo":"segundos";
 const criterion=kind==="shoulder"?"Flexión ≥80° o abducción ≥80° o extensión >20°":kind==="elbow"?"Flexo-extensión >60° o prono-supinación >60°":"Flexión/extensión >45° o desviación radial >15° / ulnar >20°";
 return '<fieldset class="manual-posture-box"><legend>'+label+' · origen del dato</legend><label>Fuente<select data-posture-source="'+kind+'" data-posture-side="'+side+'"><option value="kinovea" '+(p.source==="kinovea"?"selected":"")+' '+(!canK?"disabled":"")+'>Kinovea'+(availability.state==="none"?" · no disponible":availability.state==="partial"?" · faltan marcadores":"")+'</option><option value="manual" '+(p.source==="manual"?"selected":"") +'>Manual</option></select></label><div class="manual-posture-fields" '+(p.source==="manual"?"":"hidden")+'><label>Tiempo en postura forzada <span class="postura-unidad">'+unidad+'</span><input type="number" min="0" step="0.1" '+(mode==="porcentaje"?'max="100" placeholder="%"':'placeholder="s"')+' title="'+unidad+'" data-manual-posture="'+kind+'" data-manual-side="'+side+'" data-manual-field="flex" value="'+fmt(p.flex,2).replace(",",".")+'"></label></div><div class="notice">'+criterion+'</div>'+'</fieldset>';
}
function initPostureInputMode(){
 const el=document.getElementById("postureModo");if(!el)return;
 el.addEventListener("change",()=>{updatePostureModeUI();dirty=true;kRenderAnalyses();safeCalculate()});
 updatePostureModeUI();
}
function kPostureHelp(kind){
 if(kind==="shoulder")return ' <details class="help-panel"><summary>ⓘ Ayuda: cómo identificar la postura del hombro</summary><div class="help-content"><p><strong>Flexión:</strong> levantar el brazo hacia delante. Ejemplos: alcanzar un objeto alto situado delante, colocar algo en una estantería frontal o levantar una caja delante del cuerpo.</p><p><strong>Abducción:</strong> separar el brazo hacia un lado del cuerpo. Ejemplos: alcanzar un objeto colocado lateralmente, tender ropa o levantar el brazo hacia el lado para coger algo de una estantería.</p><p><strong>Extensión:</strong> llevar el brazo hacia atrás del cuerpo. Ejemplos: alcanzar un objeto situado detrás, llevar la mano hacia un bolsillo trasero o coger algo que queda detrás del cuerpo.</p></div></details>';
 if(kind==="elbow")return ' <details class="help-panel"><summary>ⓘ Ayuda: cómo identificar la postura del codo</summary><div class="help-content"><p><strong>Flexo-extensión:</strong> observar cuánto se abre o se cierra el codo. Ejemplos: trabajar con el brazo muy flexionado al acercar una herramienta al cuerpo, o extender el brazo para alcanzar un objeto.</p><p><strong>Prono-supinación:</strong> observar el giro del antebrazo sobre su eje. Ejemplos: girar una llave, utilizar un destornillador o girar la palma de la mano hacia arriba o hacia abajo.</p></div></details>';
 return ' <details class="help-panel"><summary>ⓘ Ayuda: cómo identificar la postura de la muñeca</summary><div class="help-content"><p><strong>Flexión/extensión:</strong> observar si la muñeca se dobla hacia la palma o hacia el dorso de la mano. Ejemplos: trabajar con la muñeca inclinada al utilizar una herramienta, escribir o manipular objetos.</p><p><strong>Desviación radial:</strong> desplazar la mano hacia el lado del pulgar. Ejemplos: inclinar la mano hacia el pulgar al manejar una herramienta o colocar una pieza.</p><p><strong>Desviación ulnar:</strong> desplazar la mano hacia el lado del meñique. Ejemplos: inclinar la mano hacia el meñique al manipular objetos o utilizar una herramienta.</p></div></details>';
}
function kPanel(kind,title,defaultThreshold){
 const id=kind==="shoulder"?"ocraShoulderPanel":kind==="elbow"?"ocraElbowPanel":"ocraWristPanel",box=document.getElementById(id);if(!box)return;
 const postureState=ensureManualPosture();
 const savedMode=postureState.modes?.[kind]==="porcentaje"?"porcentaje":"segundos";
 ensurePostureSourcesAvailable();
 const missing=kMissingMessage(kind);
 const warning=postureStudyMode()==="manual"
  ?'<div class="notice"><strong>Modo manual:</strong> la postura se estudiará mediante los datos introducidos por el usuario. Los datos de Kinovea no se utilizarán para este cálculo.</div>'
  :!kinoveaState.data
   ?'<div class="notice"><strong>Kinovea:</strong> no hay ningún JSON cargado. Puede introducir los datos MANUALMENTE.</div>'
   :missing
    ?'<div class="notice"><strong>JSON de Kinovea cargado.</strong> '+missing+' El lado que no disponga de todos los marcadores se puede estudiar MANUALMENTE.</div>'
    :'<div class="notice"><strong>Kinovea disponible.</strong> Los datos se utilizan por defecto cuando están disponibles. Puede cambiar cualquier lado a MANUAL si los datos no son adecuados para el análisis.</div>';
 const manualDuration="";
 const modeId="postureModo"+kind.charAt(0).toUpperCase()+kind.slice(1);
 const modeSelector='<div class="form-grid"><label>Unidad para el tiempo manual<select id="'+modeId+'" name="'+modeId+'"><option value="segundos" '+(savedMode==="segundos"?"selected":"")+' >Segundos</option><option value="porcentaje" '+(savedMode==="porcentaje"?"selected":"")+' >% del tiempo</option></select></label></div>';
 box.innerHTML='<strong>Datos de postura</strong>'+warning+modeSelector+manualDuration+'<div class="side-grid">'+kManualControls(kind,"right",defaultThreshold)+kManualControls(kind,"left",defaultThreshold)+'</div><div id="'+kind+'Result" class="result-holder">'+kAnalysisRows(kind)+'</div>'+kPostureHelp(kind);
 const modeEl=document.getElementById(modeId);if(modeEl)modeEl.onchange=()=>{
   const mode=modeEl.value==="porcentaje"?"porcentaje":"segundos";
   ensureManualPosture().modes[kind]=mode;
   updatePostureModeUI();
   dirty=true;
   safeCalculate();
 };
 box.querySelectorAll("[data-posture-source]").forEach(sel=>sel.onchange=()=>{
   const side=sel.dataset.postureSide,p=ensureManualPosture()[kind][side];
   p.source=sel.value;
   p.kinoveaFileId=sel.value==="kinovea"?kKinoveaFileId(kind,side):null;
   const manualBox=sel.closest(".manual-posture-box")?.querySelector(".manual-posture-fields");
   if(manualBox)manualBox.hidden=sel.value!=="manual";
   dirty=true;
   kRenderAnalyses();
   safeCalculate();
 });
 box.querySelectorAll("[data-manual-posture]").forEach(input=>{
 const updateManualPosture=()=>{
   const p=ensureManualPosture()[kind][input.dataset.manualSide];
   p[input.dataset.manualField]=Math.max(0,kNum(input.value,0));
   dirty=true;
   const result=document.getElementById(kind+"Result");
   if(result)result.innerHTML=kAnalysisRows(kind);
   safeCalculate();
 };
 input.oninput=updateManualPosture;
 input.onchange=updateManualPosture;
});

}
function kRenderAnalyses(){["shoulder","elbow","wrist"].forEach(kind=>kPanel(kind,kind==="shoulder"?"hombro":kind==="elbow"?"codo":"muñeca",kind==="shoulder"?80:60))}
function handInputSeconds(name,duration){
 const value=Math.max(0,kNum(document.querySelector('[name="'+name+'"]')?.value,0));
 const mode=document.getElementById("manoModo")?.value||"segundos";
 return mode==="porcentaje"?duration*value/100:value;
}
function updateHandModeUI(){
 const mode=document.getElementById("manoModo")?.value||"segundos";
 const unidad=mode==="porcentaje"?"% del tiempo":"segundos";
 document.querySelectorAll(".mano-unidad").forEach(el=>el.textContent=unidad);
 document.querySelectorAll('input[name="dxManoTiempo"],input[name="ixManoTiempo"]').forEach(el=>{
   el.step="0.1";el.max=mode==="porcentaje"?"100":"";el.placeholder=mode==="porcentaje"?"%":"s";el.title=unidad;
 });
}
function initHandInputMode(){
 const el=document.getElementById("manoModo");if(!el)return;
 el.addEventListener("change",()=>{updateHandModeUI();dirty=true;safeCalculate()});
 updateHandModeUI();
}
function renderHandPosture(){
 ["dx","ix"].forEach(prefix=>{
  const time=document.querySelector('[name="'+prefix+'ManoTiempo"]'),grip=document.querySelector('[name="'+prefix+'ManoAgarre"]'),pct=document.getElementById(prefix+"ManoPct"),score=document.getElementById(prefix+"ManoScore"),duration=kManualDuration(),seconds=handInputSeconds(prefix+"ManoTiempo",duration),p=duration>0?seconds/duration*100:0;
  if(pct)pct.textContent=fmt(p,2)+" %";
  if(score)score.textContent=fmt((grip?.value==="none"||grip?.value==="grip")?0:postureScore(postureHandTable,p),2);
 });
}
function postureScores(){
 const duration=kManualDuration()||0,result={};
 ["right","left"].forEach(side=>{
  const prefix=side==="right"?"dx":"ix",time=document.querySelector('[name="'+prefix+'ManoTiempo"]'),grip=document.querySelector('[name="'+prefix+'ManoAgarre"]'),shoulderBase=postureScore(postureShoulderTable,duration?100*kForcedSeconds("shoulder",side)/duration:0),shoulder=document.querySelector('[name="'+prefix+'HombroCabeza"]')?.checked?shoulderBase*2:shoulderBase,elbow=postureScore(postureElbowTable,duration?100*kForcedSeconds("elbow",side)/duration:0),wrist=postureScore(postureWristTable,duration?100*kForcedSeconds("wrist",side)/duration:0),handSeconds=handInputSeconds(prefix+"ManoTiempo",duration),handPct=duration>0?handSeconds/duration*100:0,hand=(grip?.value==="none"||grip?.value==="grip")?0:postureScore(postureHandTable,handPct),stereoValue=stereo(prefix);
  result[side]={shoulder,elbow,wrist,hand,stereo:stereoValue,base:Math.max(shoulder,elbow,wrist,hand),total:Math.max(shoulder,elbow,wrist,hand)+stereoValue};
 });
 return result;
}
function restoreKinoveaState(saved){
 kinoveaState={...kinoveaState,...saved,videoUrl:""};
 if(saved.range)kinoveaState.range={...{mode:"all",start:0,end:0,cycles:1},...saved.range};
 if(saved.dataSets)kinoveaState.dataSets=saved.dataSets;
 if(saved.shoulder)kinoveaState.shoulder=saved.shoulder;if(saved.elbow)kinoveaState.elbow=saved.elbow;if(saved.wrist)kinoveaState.wrist=saved.wrist;
 if(saved.postureManual)kinoveaState.postureManual={...ensureManualPosture(),...saved.postureManual};
 ensureManualPosture();
 ensurePostureSourcesAvailable();
 renderKRange();renderKinovea();
}

function renderKinoveaFileList(){
 const el=document.getElementById("kinoveaFileList");if(!el)return;
 const files=kinoveaState.dataSets||[];
 el.innerHTML=files.length
  ? "<strong>JSON cargados: "+files.length+"</strong><ul>"+files.map((x,i)=>"<li><span>"+(i+1)+". "+escK(x.fileName)+"</span> <button type=\"button\" class=\"toolbar-btn\" data-remove-kinovea=\""+i+"\">Eliminar</button></li>").join("")+"</ul>"
  : "No hay JSON seleccionados.";
 el.querySelectorAll("[data-remove-kinovea]").forEach(btn=>btn.addEventListener("click",()=>{
   const index=Number(btn.dataset.removeKinovea);
   kinoveaState.dataSets.splice(index,1);
   kinoveaState.jsonFiles=kinoveaState.dataSets.map(x=>x.fileName);
   kinoveaState.data=kinoveaState.dataSets[0]?.data||null;
   if(!kinoveaState.data){
     kinoveaState.range={mode:"all",start:0,end:0,cycles:1};
     kinoveaState.mapping={};
   }else if(kinoveaState.range.end>kinoveaState.data.duration){
     kinoveaState.range.end=kinoveaState.data.duration;
   }
   dirty=true;
   renderKinovea();
   renderKRange();
   renderKinoveaFileList();
   kSetStatus("JSON eliminado. El estudio continúa con los archivos restantes.");
 }));
}
async function sha256Hex(text){
 const bytes=new TextEncoder().encode(text);
 const hash=await crypto.subtle.digest("SHA-256",bytes);
 return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function loadKinoveaJson(file){
 const txt=await file.text();
 const raw=JSON.parse(txt);
 const data=parseKinovea(raw);
 kinoveaState.dataSets=kinoveaState.dataSets||[];
 const hash=await sha256Hex(txt);
 if(kinoveaState.dataSets.some(x=>x.sha256===hash))return;
 const ds={id:"kinovea_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),fileName:file.name,importedAt:new Date().toISOString(),producer:data.producer,kinoveaVersion:(data.producer||"").match(/Kinovea[.\s_-]*([0-9.]+)/i)?.[1]||null,sha256:hash,rawJson:raw,data,mapping:{}};
 kinoveaState.dataSets.push(ds);
 kinoveaState.data=kinoveaState.data||data;
 kinoveaState.jsonFiles=kinoveaState.dataSets.map(x=>x.fileName);
 if(kinoveaState.dataSets.length===1)kinoveaState.range={mode:"all",start:0,end:data.duration,cycles:1};
 ensurePostureSourcesAvailable();
 dirty=true;renderKinovea();renderKRange();renderKinoveaFileList();
 kSetStatus("JSON de Kinovea cargado correctamente. El estudio conservará una copia del JSON original.");
}

function calculate(){
 updateHandModeUI();
 const official=n("turnoOficial"),eff=n("turnoEfectivoManual")||official,pauses=n("tiempoPausas"),meal=n("pausaComer"),nonRep=n("noRepetitivo"),tntr=Math.max(0,eff-pauses-meal-nonRep);
 document.getElementById("turnoEfectivo").textContent=fmt(eff,1);document.getElementById("tntrPausas").textContent=fmt(pauses,1);document.getElementById("tntrComida").textContent=fmt(meal,1);document.getElementById("tntrNoRep").textContent=fmt(nonRep,1);document.getElementById("tiempoNeto").textContent=fmt(tntr,1);document.getElementById("duracionTNTR").textContent=fmt(tntr,1);
 recoveryState.start=form.elements.horaInicio?.value||recoveryState.start||"";
 recoveryState.end=form.elements.horaFin?.value||recoveryState.end||"";
 recoveryState.minPause=8;
 const recoveryResult=recoveryCalculateAndRender(),autoH=recoveryResult.valid?recoveryResult.hours:recoveryHours(eff,n("numPausas"),meal),rm=recoveryMultiplier(autoH);
 document.getElementById("recAutomatico").textContent=fmt(autoH,1)+" h";
 document.getElementById("recMultAutomatico").textContent=fmt(rm,3);
 const md=lookup(duration,tntr),duracionNota=document.getElementById("duracionNota");document.getElementById("multDuracion").textContent=fmt(md,3);if(duracionNota)duracionNota.innerHTML=tntr<60?'<strong>Nota:</strong> el TNTR es inferior a 60 minutos. Se aplica igualmente un multiplicador de duración de <strong>0,50</strong> como valor de cálculo.':"";
 const cycles=n("ciclosEfectivos"),obs=n("cicloObservado"),cycle=cycles>0?60*tntr/cycles:0,diff=cycle>0&&obs>0?Math.abs(cycle-obs)/cycle*100:null;
 document.getElementById("cicloNeto").textContent=cycle?fmt(cycle,2):"—";document.getElementById("criterioCicloNota")&&(document.getElementById("criterioCicloNota").innerHTML=cycles>0?"<strong>Criterio utilizado:</strong> se utiliza el <strong>ciclo calculado</strong> porque se han introducido ciclos efectivos.":"<strong>Criterio utilizado:</strong> no se han introducido ciclos efectivos, por lo que se utiliza el <strong>ciclo observado</strong>.");document.getElementById("diferenciaCiclo").textContent=diff===null?"—":fmt(diff,2);document.getElementById("minNoJustificados").textContent=diff===null?"—":fmt(Math.abs(cycle-obs)*cycles/60,2);document.getElementById("alertaCiclo").textContent=diff===null?"—":diff>5?"Revisar: > 5 %":"Concordante: ≤ 5 %";
 const actionCycle=cycles>0?cycle:obs,dxA=n("dxAcciones"),ixA=n("ixAcciones"),dxMin=actionCycle>0?dxA*60/actionCycle:0,ixMin=actionCycle>0?ixA*60/actionCycle:0,dxF=freq(dxMin,form.elements.dxInterrupciones.value==="si"),ixF=freq(ixMin,form.elements.ixInterrupciones.value==="si"),dxF34s=forceInputSeconds("dxFuerza34",actionCycle),dxF57s=forceInputSeconds("dxFuerza57",actionCycle),dxF810s=forceInputSeconds("dxFuerza810",actionCycle),ixF34s=forceInputSeconds("ixFuerza34",actionCycle),ixF57s=forceInputSeconds("ixFuerza57",actionCycle),ixF810s=forceInputSeconds("ixFuerza810",actionCycle),dxF34=actionCycle>0?lookup(force34,dxF34s/actionCycle):0,dxF57=actionCycle>0?lookup(force57,dxF57s/actionCycle):0,dxF810=actionCycle>0?lookup(force810,dxF810s/actionCycle):0,ixF34=actionCycle>0?lookup(force34,ixF34s/actionCycle):0,ixF57=actionCycle>0?lookup(force57,ixF57s/actionCycle):0,ixF810=actionCycle>0?lookup(force810,ixF810s/actionCycle):0,dxForce=forceScore(dxF34s,dxF57s,dxF810s,actionCycle),ixForce=forceScore(ixF34s,ixF57s,ixF810s,actionCycle),dxS=stereo("dx"),ixS=stereo("ix"),a=parseFloat(form.querySelector('[name="compA"]:checked')?.dataset.compA)||0,b=parseFloat(form.querySelector('[name="compB"]:checked')?.dataset.compB)||0,comp=a+b;
 const setOptional=(id,v,d=2)=>{const el=document.getElementById(id);if(el)el.textContent=fmt(v,d)};setOptional("dxAccionesMin",dxMin);setOptional("ixAccionesMin",ixMin);setOptional("dxFrecuencia",dxF);setOptional("ixFrecuencia",ixF);setOptional("dxFuerzaScore",dxForce);setOptional("ixFuerzaScore",ixForce);setOptional("dxStereoScore",dxS);setOptional("ixStereoScore",ixS);setOptional("compA",a);setOptional("compB",b);setOptional("compTotal",comp);setOptional("finalFreqActionsDx",dxMin);setOptional("finalFreqActionsIx",ixMin);setOptional("finalForce34Dx",dxF34);setOptional("finalForce57Dx",dxF57);setOptional("finalForce810Dx",dxF810);setOptional("finalForce34Ix",ixF34);setOptional("finalForce57Ix",ixF57);setOptional("finalForce810Ix",ixF810);setOptional("finalStereoDx",dxS);setOptional("finalStereoIx",ixS);setOptional("finalCompADx",a);setOptional("finalCompAIx",a);setOptional("finalCompBDx",b);setOptional("finalCompBIx",b);
 const ps=postureScores(),dxPosture=ps.right.total,ixPosture=ps.left.total;
 document.getElementById("finalPostureDx").textContent=fmt(dxPosture,2);document.getElementById("finalPostureIx").textContent=fmt(ixPosture,2);
 document.getElementById("finalShoulderDx")&&(document.getElementById("finalShoulderDx").textContent=fmt(ps.right.shoulder,2));document.getElementById("finalShoulderIx")&&(document.getElementById("finalShoulderIx").textContent=fmt(ps.left.shoulder,2));
 document.getElementById("finalElbowDx")&&(document.getElementById("finalElbowDx").textContent=fmt(ps.right.elbow,2));document.getElementById("finalElbowIx")&&(document.getElementById("finalElbowIx").textContent=fmt(ps.left.elbow,2));
 document.getElementById("finalWristDx")&&(document.getElementById("finalWristDx").textContent=fmt(ps.right.wrist,2));document.getElementById("finalWristIx")&&(document.getElementById("finalWristIx").textContent=fmt(ps.left.wrist,2));
 document.getElementById("finalHandDx")&&(document.getElementById("finalHandDx").textContent=fmt(ps.right.hand,2));document.getElementById("finalHandIx")&&(document.getElementById("finalHandIx").textContent=fmt(ps.left.hand,2));
 const dxBase=dxF+dxForce+dxPosture+comp,ixBase=ixF+ixForce+ixPosture+comp,dxFinal=dxBase*(rm??1)*md,ixFinal=ixBase*(rm??1)*md;
 const set=(id,v,d=2)=>document.getElementById(id).textContent=Number.isFinite(v)?fmt(v,d):"—";
 set("finalFreqDx",dxF);set("finalForceDx",dxForce);set("finalCompDx",comp);set("finalBaseDx",dxBase);set("finalRecDx",rm??1,3);set("finalDurDx",md,3);set("resultadoFinalDx",dxFinal);document.getElementById("clasificacionDx").textContent=classification(dxFinal);
 set("finalFreqIx",ixF);set("finalForceIx",ixForce);set("finalCompIx",comp);set("finalBaseIx",ixBase);set("finalRecIx",rm??1,3);set("finalDurIx",md,3);set("resultadoFinalIx",ixFinal);document.getElementById("clasificacionIx").textContent=classification(ixFinal);
}
function safeCalculate(){try{calculate();renderHandPosture();return true}catch(error){console.error("OCRA calculate:",error);status.textContent="Se ha producido un error en el cálculo. La navegación continúa disponible.";return false}}
function markDirty(){dirty=true;status.textContent="";safeCalculate()}
function addKinoveaFileInput(){
 const container=document.getElementById("kinoveaFileInputs");if(!container)return;
 const count=container.querySelectorAll("input[data-kinovea-file]").length;
 if(count>=12){kSetStatus("Ya se han alcanzado los 12 archivos JSON permitidos.");return}
 const slot=count+1,wrap=document.createElement("label");wrap.setAttribute("data-kinovea-slot",slot);
 wrap.innerHTML="JSON "+slot+'<input type="file" accept=".json,application/json" data-kinovea-file><small>Seleccione un archivo desde cualquier carpeta.</small>';
 container.appendChild(wrap);
 const input=wrap.querySelector("input");
 input.addEventListener("change",async e=>{
   const file=e.target.files?.[0];if(!file)return;
   try{
     await loadKinoveaJson(file);
     renderKinoveaFileList();
   }catch(err){kSetStatus("Error al leer el JSON de Kinovea: "+err.message)}
 });
}
const addKinoveaJsonBtn=document.getElementById("addKinoveaJsonBtn");
if(addKinoveaJsonBtn)addKinoveaJsonBtn.addEventListener("click",addKinoveaFileInput);



let simulationState={baseline:null,current:null,initialised:false};

function simClone(v){return JSON.parse(JSON.stringify(v));}
function simNum(id){const v=Number(document.getElementById(id)?.value);return Number.isFinite(v)?Math.max(0,v):0;}
function simSet(id,value){const el=document.getElementById(id);if(!el)return;if(el.type==="checkbox")el.checked=!!value;else el.value=value??"";}
function simText(id){return document.getElementById(id)?.textContent||"—";}
function simControlIds(){
 return [
  "simTNTR","simRecoveryHours","simCycles","simObservedCycle","simActionsDx","simActionsIx",
  "simInterruptionsDx","simInterruptionsIx","simForceMode","simForceDx34","simForceDx57","simForceDx810",
  "simForceIx34","simForceIx57","simForceIx810",
  "simShoulderAngleDx","simShoulderTimeDx","simShoulderPctInputDx","simShoulderAngleIx","simShoulderTimeIx","simShoulderPctInputIx",
  "simElbowAngleDx","simElbowTimeDx","simElbowPctInputDx","simElbowAngleIx","simElbowTimeIx","simElbowPctInputIx",
  "simWristAngleDx","simWristTimeDx","simWristPctInputDx","simWristAngleIx","simWristTimeIx","simWristPctInputIx",
  "simHeadDx","simHeadIx","simStereoDx","simStereoIx","simStereo3Dx","simStereo3Ix",
  "simGripDx","simGripIx","simGripTimeDx","simGripTimeIx","simCompA","simCompB"
 ];
}
function simReadState(){
 const o={};
 simControlIds().forEach(id=>{
   const el=document.getElementById(id);if(!el)return;
   o[id]=el.type==="checkbox"?!!el.checked:el.value;
 });
 return o;
}
function simWriteState(o){
 simControlIds().forEach(id=>{
   const el=document.getElementById(id),v=o?.[id];if(!el||v===undefined)return;
   if(el.type==="checkbox")el.checked=!!v;else el.value=String(v);
 });
 simRenderChanged();
 simCalculate();
}
function simActualTNTR(){
 const el=document.getElementById("tiempoNeto"),v=Number(String(el?.textContent||"").replace(",","."));return Number.isFinite(v)?v:0;
}
function simActualRecoveryHours(){
 const eff=n("turnoEfectivoManual")||n("turnoOficial"),meal=n("pausaComer");
 const r=recoveryState.lastResult;
 return r?.valid&&Number.isFinite(r.hours)?r.hours:recoveryHours(eff,n("numPausas"),meal);
}
function simPostureTime(kind,side){
 try{return Math.max(0,kForcedSeconds(kind,side));}catch(e){return 0}
}
function simRestoreSaved(saved){
 const current=saved?.current&&typeof saved.current==="object"?saved.current:null;
 const baseline=saved?.baseline&&typeof saved.baseline==="object"?saved.baseline:current;
 if(!current)return simSetInitialFromStudy();
 simulationState={baseline:simClone(baseline||{}),current:simClone(current),initialised:true};
 simWriteState(current);
 simulationState.current=simReadState();
 simRenderChanged();
 simCalculate();
}
function simSetInitialFromStudy(){
 const baseline={};
 simSet("simTNTR",simActualTNTR());
 simSet("simRecoveryHours",simActualRecoveryHours());
 simSet("simCycles",n("ciclosEfectivos"));
 simSet("simObservedCycle",n("cicloObservado"));
 simSet("simActionsDx",n("dxAcciones"));
 simSet("simActionsIx",n("ixAcciones"));
 simSet("simInterruptionsDx",form.elements.dxInterrupciones?.value||"si");
 simSet("simInterruptionsIx",form.elements.ixInterrupciones?.value||"si");
 simSet("simForceMode",document.getElementById("fuerzaModo")?.value||"segundos");
 ["Dx","Ix"].forEach(side=>{
   const p=side.toLowerCase();
   simSet("simForce"+side+"34",n(p+"Fuerza34"));
   simSet("simForce"+side+"57",n(p+"Fuerza57"));
   simSet("simForce"+side+"810",n(p+"Fuerza810"));
   simSet("simGrip"+side,form.elements[p+"ManoAgarre"]?.value||"none");
   simSet("simGripTime"+side,handInputSeconds(p+"ManoTiempo",simActualTNTR()*60));
   simSet("simHead"+side,!!form.elements[p+"HombroCabeza"]?.checked);
   const st=stereo(p);
   simSet("simStereo"+side,st===1.5);
   simSet("simStereo3"+side,st===3);
   ["shoulder","elbow","wrist"].forEach(kind=>{
     const key=kind.charAt(0).toUpperCase()+kind.slice(1), threshold=kind==="shoulder"?80:kind==="elbow"?60:45;
     const t=simPostureTime(kind,p==="dx"?"right":"left");
     simSet("sim"+key+"Time"+side,t);
     simSet("sim"+key+"Angle"+side,t>0?threshold:0);
   });
 });
 simSetInitialComplementaryOptions();
 Object.assign(baseline,simReadState());
 simulationState={baseline:simClone(baseline),current:simClone(baseline),initialised:true};
 simRenderChanged();
 simCalculate();
}
function simSetInitialComplementaryOptions(){
 const a=document.getElementById("simCompA"),b=document.getElementById("simCompB");
 if(!a||!b)return;
 if(!a.options.length){
   const noneA=document.createElement("option");noneA.value="0";noneA.textContent="Ningún factor";noneA.dataset.score="0";a.appendChild(noneA);
   form.querySelectorAll('[name="compA"]').forEach((el,i)=>{
     const o=document.createElement("option");o.value=el.value;o.textContent=el.parentElement.textContent.trim();o.dataset.score=el.dataset.compA||el.value;a.appendChild(o);
   });
 }
 if(!b.options.length){
   const noneB=document.createElement("option");noneB.value="0";noneB.textContent="Ningún factor";noneB.dataset.score="0";b.appendChild(noneB);
   form.querySelectorAll('[name="compB"]').forEach(el=>{
     const o=document.createElement("option");o.value=el.value;o.textContent=el.parentElement.textContent.trim();o.dataset.score=el.dataset.compB||el.value;b.appendChild(o);
   });
 }
 const ca=form.querySelector('[name="compA"]:checked'),cb=form.querySelector('[name="compB"]:checked');
 a.value=ca?.value||"0";b.value=cb?.value||"0";
}
function simAngleActive(kind,angle){
 const a=Number(angle)||0;
 return kind==="shoulder"?a>=80:kind==="elbow"?a>60:a>45;
}
function simPostureSide(side,tntr){
 const prefix=side==="right"?"Dx":"Ix",duration=Math.max(0,tntr)*60,pct=duration>0?100/duration:0;
 const scores={};
 ["shoulder","elbow","wrist"].forEach(kind=>{
   const key=kind.charAt(0).toUpperCase()+kind.slice(1),angle=simNum("sim"+key+"Angle"+prefix),time=Math.min(duration,simNum("sim"+key+"Time"+prefix));
   const active=simAngleActive(kind,angle),actualPct=active?time*pct:0;
   simSetText("sim"+key+"Pct"+prefix,fmt(actualPct,2)+" %");
   const table=kind==="shoulder"?postureShoulderTable:kind==="elbow"?postureElbowTable:postureWristTable;
   scores[kind]=postureScore(table,actualPct);
 });
 const grip=document.getElementById("simGrip"+prefix)?.value||"none";
 const gripTime=Math.min(duration,simNum("simGripTime"+prefix)),gripPct=duration>0?100*gripTime/duration:0;
 scores.hand=(grip==="none"||grip==="grip")?0:postureScore(postureHandTable,gripPct);
 const stereo3=document.getElementById("simStereo3"+prefix)?.checked,stereo15=document.getElementById("simStereo"+prefix)?.checked;
 scores.stereo=stereo3?3:(stereo15?1.5:0);
 const shoulder=document.getElementById("simHead"+prefix)?.checked?scores.shoulder*2:scores.shoulder;
 scores.shoulder=shoulder;
 return {shoulder,elbow:scores.elbow,wrist:scores.wrist,hand:scores.hand,stereo:scores.stereo,total:Math.max(shoulder,scores.elbow,scores.wrist,scores.hand)+scores.stereo};
}
function simSyncPostureField(id){
 const m=id.match(/^sim(Shoulder|Elbow|Wrist)(Time|PctInput)(Dx|Ix)$/);if(!m)return;
 const kind=m[1],mode=m[2],side=m[3],duration=Math.max(0,simNum("simTNTR"))*60;
 const timeId="sim"+kind+"Time"+side,pctId="sim"+kind+"PctInput"+side;
 if(mode==="Time"){
   const seconds=Math.min(duration,simNum(timeId));
   simSet(pctId,duration>0?seconds/duration*100:0);
 }else{
   const pct=Math.min(100,simNum(pctId));
   simSet(timeId,duration*pct/100);
 }
}
function simInitialisePosturePercentages(){
 ["Shoulder","Elbow","Wrist"].forEach(kind=>["Dx","Ix"].forEach(side=>{
   const duration=Math.max(0,simNum("simTNTR"))*60,seconds=Math.min(duration,simNum("sim"+kind+"Time"+side));
   simSet("sim"+kind+"PctInput"+side,duration>0?seconds/duration*100:0);
 }));
}
function simCalculate(){
 if(!simulationState.initialised)return;
 const tntr=Math.max(0,simNum("simTNTR")),cycles=simNum("simCycles"),observed=simNum("simObservedCycle"),cycle=cycles>0?60*tntr/cycles:observed;
 const dxMin=cycle>0?simNum("simActionsDx")*60/cycle:0,ixMin=cycle>0?simNum("simActionsIx")*60/cycle:0;
 const dxF=freq(dxMin,document.getElementById("simInterruptionsDx")?.value==="si"),ixF=freq(ixMin,document.getElementById("simInterruptionsIx")?.value==="si");
 const forceMode=document.getElementById("simForceMode")?.value||"segundos";
 const fSeconds=(id)=>{const v=simNum(id);return forceMode==="porcentaje"&&cycle>0?cycle*v/100:v};
 const dxF34s=fSeconds("simForceDx34"),dxF57s=fSeconds("simForceDx57"),dxF810s=fSeconds("simForceDx810");
 const ixF34s=fSeconds("simForceIx34"),ixF57s=fSeconds("simForceIx57"),ixF810s=fSeconds("simForceIx810");
 const dxForce=forceScore(dxF34s,dxF57s,dxF810s,cycle),ixForce=forceScore(ixF34s,ixF57s,ixF810s,cycle);
 const dxPost=simPostureSide("right",tntr),ixPost=simPostureSide("left",tntr);
 const compA=Number(document.getElementById("simCompA")?.selectedOptions[0]?.dataset.score)||0,compB=Number(document.getElementById("simCompB")?.selectedOptions[0]?.dataset.score)||0,comp=compA+compB;
 const recoveryHours=Math.min(9,Math.max(0,simNum("simRecoveryHours"))),rm=recoveryMultiplier(recoveryHours),md=lookup(duration,tntr);
 const dxBase=dxF+dxForce+dxPost.total+comp,ixBase=ixF+ixForce+ixPost.total+comp,dxFinal=dxBase*rm*md,ixFinal=ixBase*rm*md;
 simSetText("simResultDx",fmt(dxFinal,2));simSetText("simResultIx",fmt(ixFinal,2));simSetText("simClassificationDx",classification(dxFinal));simSetText("simClassificationIx",classification(ixFinal));
 simSetText("simFreqDx",fmt(dxF,2));simSetText("simFreqIx",fmt(ixF,2));
 simSetText("simPostureDx",fmt(dxPost.total,2));simSetText("simPostureIx",fmt(ixPost.total,2));
 simSetText("simForceResultDx",fmt(dxForce,2));simSetText("simForceResultIx",fmt(ixForce,2));
 simSetText("simRecoveryFactor",fmt(rm,3));simSetText("simDurationFactor",fmt(md,3));
 const st=document.getElementById("simStatus");
 if(st)st.innerHTML="<strong>Simulación activa.</strong> Índices calculados sobre una copia temporal. El estudio original no se modifica.";
 simulationState.current=simReadState();
 simRenderChanged();
}
function simSetText(id,value){const el=document.getElementById(id);if(el)el.textContent=value;}
function simRenderChanged(){
 const box=document.getElementById("simChangesList");if(!box||!simulationState.baseline)return;
 const current=simulationState.current||simReadState(),rows=[];
 const labels={
  simTNTR:"TNTR",simRecoveryHours:"Horas sin recuperación",simCycles:"Ciclos efectivos",simObservedCycle:"Ciclo observado",simActionsDx:"Acciones DX",simActionsIx:"Acciones IX",
  simInterruptionsDx:"Interrupciones DX",simInterruptionsIx:"Interrupciones IX",simForceMode:"Unidad de fuerza",
  simForceDx34:"Fuerza DX Borg 3–4",simForceDx57:"Fuerza DX Borg 5–7",simForceDx810:"Fuerza DX Borg 8–10",
  simForceIx34:"Fuerza IX Borg 3–4",simForceIx57:"Fuerza IX Borg 5–7",simForceIx810:"Fuerza IX Borg 8–10",
  simShoulderAngleDx:"Ángulo hombro DX",simShoulderTimeDx:"Tiempo hombro DX",simShoulderPctInputDx:"% hombro DX",simShoulderAngleIx:"Ángulo hombro IX",simShoulderTimeIx:"Tiempo hombro IX",simShoulderPctInputIx:"% hombro IX",
  simElbowAngleDx:"Ángulo codo DX",simElbowTimeDx:"Tiempo codo DX",simElbowPctInputDx:"% codo DX",simElbowAngleIx:"Ángulo codo IX",simElbowTimeIx:"Tiempo codo IX",simElbowPctInputIx:"% codo IX",
  simWristAngleDx:"Ángulo muñeca DX",simWristTimeDx:"Tiempo muñeca DX",simWristPctInputDx:"% muñeca DX",simWristAngleIx:"Ángulo muñeca IX",simWristTimeIx:"Tiempo muñeca IX",simWristPctInputIx:"% muñeca IX",
  simHeadDx:"Manos sobre cabeza DX",simHeadIx:"Manos sobre cabeza IX",simStereoDx:"Estereotipia 1,5 DX",simStereoIx:"Estereotipia 1,5 IX",
  simStereo3Dx:"Estereotipia 3 DX",simStereo3Ix:"Estereotipia 3 IX",simGripDx:"Agarre DX",simGripIx:"Agarre IX",simGripTimeDx:"Tiempo agarre DX",simGripTimeIx:"Tiempo agarre IX",
  simCompA:"Complementarios A",simCompB:"Complementarios B"
 };
 Object.keys(labels).forEach(id=>{
   const a=simulationState.baseline[id],b=current[id];
   if(String(a)!==String(b)){
     const el=document.getElementById(id),format=v=>el?.type==="checkbox"?(v?"Sí":"No"):String(v);
     rows.push("<div><strong>"+labels[id]+"</strong><span>"+escK(format(a))+" → "+escK(format(b))+"</span></div>");
   }
 });
 box.innerHTML=rows.length?rows.join(""):'<div class="placeholder">No se han realizado cambios.</div>';
}
function initSimulation(){
 const root=document.querySelector('[data-screen="16"]');if(!root)return;
 const events=simControlIds().map(id=>document.getElementById(id)).filter(Boolean);
 events.forEach(el=>el.addEventListener("input",e=>{simSyncPostureField(e.target.id);dirty=true;simCalculate();}));
 events.forEach(el=>el.addEventListener("change",e=>{simSyncPostureField(e.target.id);dirty=true;simCalculate();}));
 document.getElementById("simLoadCurrentBtn")?.addEventListener("click",()=>{simSetInitialFromStudy();dirty=true;});
 document.getElementById("simResetBtn")?.addEventListener("click",()=>{if(simulationState.baseline){simWriteState(simulationState.baseline);dirty=true;}});
 document.getElementById("simChangesBtn")?.addEventListener("click",()=>{simRenderChanged();document.getElementById("simChangesList")?.scrollIntoView({behavior:"smooth",block:"center"})});
 simSetInitialComplementaryOptions();
 simSetInitialFromStudy();
 simInitialisePosturePercentages();
 simulationState.baseline=simClone(simReadState());simulationState.current=simClone(simulationState.baseline);simRenderChanged();simCalculate();
}

function initCore(){
initRecoverySchedule();
initForceInputMode();
initHandInputMode();
initPostureStudyMode();
kRenderAnalyses();

fields.forEach(f=>{f.addEventListener("input",markDirty);f.addEventListener("change",markDirty)});
document.getElementById("homeBtn").addEventListener("click",()=>{if(confirm("¿Volver al inicio? Si existen cambios sin guardar, guarde el estudio antes de continuar."))location.href="../"});
document.getElementById("saveBtn").addEventListener("click",async()=>{const d=values(),json=JSON.stringify(d,null,2),blob=new Blob([json],{type:"application/json"});try{if(window.showSaveFilePicker){const handle=await window.showSaveFilePicker({suggestedName:"estudio-ocra.json",types:[{description:"Estudio OCRA",accept:{"application/json":[".json"]}}]});const writable=await handle.createWritable();await writable.write(blob);await writable.close();dirty=false;status.textContent="Estudio guardado correctamente en la ubicación seleccionada.";}else{const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="estudio-ocra.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);dirty=false;status.textContent="Estudio guardado. El navegador ha utilizado su carpeta de descargas predeterminada.";}}catch(error){if(error?.name==="AbortError"){status.textContent="Guardado cancelado. El estudio no se ha modificado.";return}console.error("OCRA save:",error);status.textContent="No se ha podido guardar el estudio.";}});
document.getElementById("loadBtn").addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",async()=>{const file=fileInput.files[0];if(!file)return;try{apply(JSON.parse(await file.text()))}catch(e){status.textContent="No se ha podido cargar el estudio. El archivo no tiene un formato OCRA válido."}fileInput.value=""});
document.getElementById("newBtn").addEventListener("click",()=>{if(!confirm("¿Crear un estudio nuevo? Se perderán los datos no guardados."))return;form.reset();dirty=false;status.textContent="Nuevo estudio iniciado.";window.OCRA_Navigation.show(0);if(simulationState?.initialised)simSetInitialFromStudy();});
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=true}});


}

function initKinovea(){
addKinoveaFileInput();
bindKinovea();
renderKinovea();
}

function ocraRiskInfo(value){
 const v=Number(value);
 if(!Number.isFinite(v))return {range:"—",level:"—",className:"",label:"—"};
 if(v<=7.5)return {range:"≤ 7,5",level:"Verde",className:"green",label:"Aceptable"};
 if(v<=11)return {range:"7,6 – 11",level:"Amarillo",className:"yellow",label:"Borderline / riesgo muy leve"};
 if(v<=14)return {range:"11,1 – 14",level:"Rojo suave",className:"light-red",label:"Riesgo leve"};
 if(v<=22.5)return {range:"14,1 – 22,5",level:"Rojo",className:"red",label:"Riesgo medio"};
 return {range:"> 22,5",level:"Morado",className:"purple",label:"Riesgo alto"};
}
function ocraSetWord(id,value){const el=document.getElementById(id);if(el)el.textContent=value||"—"}
function ocraSetRiskCell(id,value){
 const el=document.getElementById(id);if(!el)return;
 const info=ocraRiskInfo(value);
 el.textContent=Number.isFinite(Number(value))?fmt(Number(value),2):"—";
 el.className=info.className?("risk-result-cell "+info.className):"risk-result-cell";
}
function renderWordTables(){
 const ids={wordRecDx:"finalRecDx",wordRecIx:"finalRecIx",wordFreqDx:"finalFreqDxSub",wordFreqIx:"finalFreqIxSub",wordForceDx:"finalForceDx",wordForceIx:"finalForceIx",wordPostureDx:"finalPostureDx",wordPostureIx:"finalPostureIx",wordCompDx:"finalCompDx",wordCompIx:"finalCompIx",wordBaseDx:"finalBaseDx",wordBaseIx:"finalBaseIx",wordRecFactorDx:"finalRecDx",wordRecFactorIx:"finalRecIx",wordDurDx:"finalDurDx",wordDurIx:"finalDurIx",wordIndexDx:"resultadoFinalDx",wordIndexIx:"resultadoFinalIx"};
 Object.entries(ids).forEach(([target,source])=>{const s=document.getElementById(source);ocraSetWord(target,s?.textContent||"—")});
 const dx=Number(String(document.getElementById("resultadoFinalDx")?.textContent||"").replace(",",".")),ix=Number(String(document.getElementById("resultadoFinalIx")?.textContent||"").replace(",","."));
 const di=ocraRiskInfo(dx),ii=ocraRiskInfo(ix);
 ocraSetWord("wordRiskDx",di.label);ocraSetWord("wordRiskIx",ii.label);
 ocraSetWord("riskRangeDx",di.range);ocraSetWord("riskLevelDx",di.level);
 ocraSetRiskCell("riskCellDx",dx);ocraSetRiskCell("riskCellIx",ix);
}
function copyOCRAWordTables(){
 renderWordTables();
 const area=document.getElementById("wordTablesArea");if(!area)return;
 const html=area.innerHTML,text=area.innerText;
 if(navigator.clipboard?.write&&window.ClipboardItem)navigator.clipboard.write([new ClipboardItem({"text/html":new Blob([html],{type:"text/html"}),"text/plain":new Blob([text],{type:"text/plain"})})]).then(()=>status.textContent="Tablas copiadas. Puedes pegarlas directamente en Word.").catch(()=>ocraLegacyCopy(area));else ocraLegacyCopy(area);
}
function ocraLegacyCopy(area){
 const range=document.createRange();range.selectNodeContents(area);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
 try{document.execCommand("copy");status.textContent="Tablas copiadas. Puedes pegarlas directamente en Word."}catch(e){status.textContent="Selecciona las tablas y copia con Ctrl+C."}
 sel.removeAllRanges();
}
function initWordTables(){
 document.getElementById("copyOCRAResultsBtn")?.addEventListener("click",copyOCRAWordTables);
 document.getElementById("printOCRAResultsBtn")?.addEventListener("click",()=>{renderWordTables();window.print()});
 renderWordTables();
}
function initApp(){
  // La navegación se inicializa primero y no depende del cálculo ni de Kinovea.
  initNavigation();
  try{initCore()}catch(error){console.error("OCRA initCore:",error);status.textContent="El estudio está disponible, pero se ha producido un error al inicializar algunos controles."}
  try{initSimulation()}catch(error){console.error("OCRA initSimulation:",error)}
  try{initWordTables()}catch(error){console.error("OCRA initWordTables:",error)}
  try{initKinovea()}catch(error){console.error("OCRA initKinovea:",error);kSetStatus("Los controles de Kinovea no se han podido inicializar correctamente.")}
}

initApp();

})();