"use strict";
(()=> {
const $=id=>document.getElementById(id), fields=["peso","horizontal","vertical","desplazamiento","asimetria","frecuencia","duracion","recuperacion","agarre","dosPersonas","unaMano","extension","grupoDuracion","controlDestino","verticalDestino","horizontalDestino","asimetriaDestino"],metas=["empresa","puesto","seccion","fecha"];
let p={application:"MMC Analyzer",version:4,module:"simple",meta:{},tasks:[],simulations:{}},sel="",page=1,dirty=false,handle=null,name="MMC-Simple.json";
const tables={vertical:{0:.77,25:.85,50:.93,75:1,100:.93,125:.85,150:.78},horizontal:{25:1,30:.83,40:.63,50:.5,55:.45,60:.42},desplazamiento:{25:1,30:.97,40:.93,50:.91,70:.88,100:.87,170:.86},asimetria:{0:1,30:.9,60:.81,90:.71,120:.52,135:.57}};
const freq=[0,.1,.2,.5,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],FM={larga:[1,.85,.85,.81,.75,.65,.55,.45,.35,.27,.22,.18,0,0,0,0,0,0,0],media:[1,.95,.95,.92,.88,.84,.79,.72,.6,.5,.42,.35,.3,.26,0,0,0,0,0],corta:[1,1,1,.97,.94,.91,.88,.84,.8,.75,.7,.6,.52,.45,.41,.37,0,0,0]};
const refs=[["Hombres 20–45",25],["Hombres fuera 20–45",20],["Mujeres 20–45",20],["Mujeres fuera 20–45",15]];
// Fuente exclusiva de FM: tabla del Excel LI simple, filas 37–56.
// Interpolación entre filas numéricas según el criterio acordado; sin tabla adicional CLI.
function frequencyMultiplier(input,category,height){
 if((typeof input!=="number"&&typeof input!=="string")||String(input).trim()==="")return undefined;
 const value=Number(input),vertical=Number(height);
 if(!Number.isFinite(value)||value<0||!Number.isFinite(vertical)||vertical<0||!FM[category])return undefined;
 if(value>15)return 0;
 // Tramos explícitos del Excel LI: <0,1; 0,1<=F<0,2; F=0,2.
 // No se interpola a través del salto de la baja frecuencia.
 if(value<.1)return 1;
 if(value<=.2)return FM[category][2];
 const column=FM[category];
 const upper=freq.findIndex(f=>f>=value);
 if(freq[upper]===value)return column[upper];
 const lower=upper-1,ratio=(value-freq[lower])/(freq[upper]-freq[lower]);
 // Conservar la precisión y redondear únicamente en la presentación.
 return column[lower]+ratio*(column[upper]-column[lower]);
}
function frequencyNote(r){
 if(!r.frequency||r.problems)return "";
 const factor=v=>v.toLocaleString("es-ES",{maximumFractionDigits:6});
 const detail=r.positions?.destination?"FM origen: "+factor(r.positions.origin.vals.FM)+"; FM destino: "+factor(r.positions.destination.vals.FM):"FM: "+factor(r.vals.FM);
 return "Frecuencia: "+factor(r.frequency.value)+" lev/min. "+detail+" ("+r.frequency.method+"). Fuente exclusiva: tabla de frecuencia, rotulada «área inferior a 75 cm».";

}
const fmt=v=>Number.isFinite(v)?v.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2}):"—";
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function blank(){return{...Object.fromEntries(fields.map(k=>[k,""])),horario:MMCSchedule.blank()}}function task(){return{id:crypto.randomUUID(),name:"",inputs:blank()}}
function changed(){dirty=true;$("status").textContent="Cambios sin guardar"}function screen(s){["methods","simple"].forEach(k=>$(k).hidden=k!==s);scrollTo(0,0)}
const temporalFields=["duracion","recuperacion","grupoDuracion","extension"];
function nav(n){page=Math.min(5,Math.max(1,n));for(let i=1;i<=5;i++)$("page"+i).hidden=i!==page;$("pageNum").textContent=page;$("prev").disabled=page===1;$("next").disabled=page===5;if(page===2)renderSchedule();if(page===3)inputs();if(page===4)results();if(page===5){selector();sim()}$("simulation").hidden=page!==5||!p.tasks.length;scrollTo(0,0)}
function selector(){if(!p.tasks.some(t=>t.id===sel))sel=p.tasks[0]?.id||"";for(const id of ["taskSelect","scheduleTask","simTask"]){const e=$(id),previous=e.value;e.replaceChildren();p.tasks.forEach((t,i)=>{const o=document.createElement("option");o.value=t.id;o.textContent=(i+1)+". "+(t.name||"Sin nombre");e.append(o)});e.value=id==="simTask"&&p.tasks.some(t=>t.id===previous)?previous:sel}}
function render(){const list=$("taskList");list.replaceChildren();p.tasks.forEach((t,i)=>{const row=document.createElement("div");row.className="task";const label=document.createElement("span");label.textContent="Tarea "+(i+1);const inp=document.createElement("input");inp.value=t.name;inp.maxLength=150;inp.placeholder="Nombre";inp.oninput=()=>{t.name=inp.value;selector();changed()};const schedule=document.createElement("button");schedule.className="secondary";schedule.textContent="Horario";schedule.onclick=()=>{sel=t.id;nav(2)};const edit=document.createElement("button");edit.className="secondary";edit.textContent="Datos";edit.onclick=()=>{sel=t.id;nav(3)};const del=document.createElement("button");del.className="secondary";del.textContent="Eliminar";del.onclick=()=>{if(confirm("¿Eliminar tarea?")){p.tasks.splice(i,1);delete p.simulations[t.id];changed();render()}};row.append(label,inp,schedule,edit,del);list.append(row)});$("taskCount").textContent=p.tasks.length+" / 50";$("addTask").disabled=p.tasks.length>=50;selector()}
function verticalDistance(x){
 const problems=[];for(const [key,label] of [["vertical","inicial"],["verticalDestino","final"]]){const value=x?.[key];if((typeof value!=="string"&&typeof value!=="number")||String(value).trim()===""||!Number.isFinite(Number(value))||Number(value)<0)problems.push("Indique una altura vertical "+label+" válida (cm), mayor o igual que cero.")}
 return{problems,value:problems.length?null:Math.abs(Number(x.verticalDestino)-Number(x.vertical))};
}
function syncGeometry(x){const d=verticalDistance(x);x.desplazamiento=d.value===null?"":String(d.value);return d}
function geometryFeedback(x){const d=verticalDistance(x);return d.value===null?d.problems.join(" "):"Desplazamiento vertical calculado: |altura final − altura inicial| = "+fmt(d.value)+" cm."}
function updateGeometryFeedback(x){const out=$("geometryFeedback");if(out)out.textContent=x?geometryFeedback(x):"Seleccione una tarea para introducir las alturas inicial y final."}
function syncTemporal(x){syncGeometry(x);if(x?.horario&&typeof x.horario==="object")delete x.horario.postRecovery;const d=durationData(x),valid=!d.problems.length;x.duracion=valid?String(d.minutes):"";x.recuperacion=valid?String(d.recoveryMinutes):"";x.grupoDuracion=valid?d.category:"";x.extension=valid?String(d.extension):"";return d}
function inputs(){selector();const t=p.tasks.find(t=>t.id===sel);if(t)syncTemporal(t.inputs);document.querySelectorAll("[data-field]").forEach(e=>{const derived=temporalFields.includes(e.dataset.field);e.disabled=!t||(derived&&e.tagName==="SELECT");e.readOnly=derived;if(derived)e.classList.add("automatic-field");e.value=t?.inputs?.[e.dataset.field]??""});$("destination").hidden=!t||t.inputs.controlDestino!=="si";updateDurationFeedback(t?.inputs);updateGeometryFeedback(t?.inputs)}
function selectedTask(){return p.tasks.find(t=>t.id===sel)}
function scheduleClock(value){const n=((value%1440)+1440)%1440;return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0")+(value>=1440?" (+1 día)":"")}
function scheduleChanged(){const t=selectedTask();if(!t)return;syncTemporal(t.inputs);changed();updateScheduleDurations(t.inputs.horario);renderScheduleSummary();if(!$("simulation").hidden)sim()}
function updateScheduleDurations(s){document.querySelectorAll('[data-simple-duration]').forEach(e=>{const m=MMCSchedule.interval(s,s.blocks[Number(e.dataset.simpleDuration)]).minutes;e.textContent='Duración: '+(m===null?'—':m+' min');});}
function renderSchedule(){
 selector();const t=selectedTask(),s=t?.inputs.horario;
 for(const [id,key] of [["shiftStart","start"],["shiftEnd","end"]]){$(id).disabled=!t;$(id).value=s?.[key]??""}
 $("shiftOvernight").disabled=!t;$("shiftOvernight").checked=s?.overnight===true;$("addScheduleBlock").disabled=!t||(s?.blocks?.length||0)>=200;
 const root=$("scheduleBlocks");root.replaceChildren();$("scheduleCount").textContent=(s?.blocks?.length||0)+" / 200 tramos";
 if(!t){renderScheduleSummary();return}
 if(!s||typeof s!=="object"||Array.isArray(s)||!Array.isArray(s.blocks)){t.inputs.horario=MMCSchedule.blank();renderSchedule();return}
 s.blocks.forEach((block,i)=>{
  if(!block||typeof block!=="object"||Array.isArray(block)){block={start:"",end:"",type:"",recovery:"",notes:""};s.blocks[i]=block;}
  const row=document.createElement("div");row.className="schedule-block";const heading=document.createElement("strong");heading.className="block-heading";heading.textContent="Tramo "+(i+1);row.append(heading);
  const field=(title,key,type)=>{const label=document.createElement("label");label.textContent=title;const input=document.createElement("input");input.type=type;input.value=block[key]??"";input.setAttribute("aria-label",title+" del tramo "+(i+1));if(type==="time")input.step="60";input.oninput=()=>{block[key]=input.value;scheduleChanged()};label.append(input);row.append(label);return label};
  field("Inicio","start","time");field("Fin","end","time");
  const typeLabel=document.createElement("label");typeLabel.textContent="Actividad";const type=document.createElement("select");type.setAttribute("aria-label","Actividad del tramo "+(i+1));for(const [value,label] of [["","Seleccione"],["mmc","Manipulación de cargas"],["pausa","Pausa / descanso"],["otra","Otra tarea sin MMC"]]){const o=document.createElement("option");o.value=value;o.textContent=label;type.append(o)}type.value=block.type??"";typeLabel.append(type);row.append(typeLabel);
  const recLabel=document.createElement("label");recLabel.textContent="¿Permite recuperación dorsolumbar?";const rec=document.createElement("select");rec.setAttribute("aria-label","Recuperación del tramo "+(i+1));for(const [value,label] of [["","Seleccione"],["si","Sí: descanso o trabajo ligero"],["no","No"]]){const o=document.createElement("option");o.value=value;o.textContent=label;rec.append(o)}
  const updateRecovery=()=>{rec.disabled=block.type!=="otra";rec.value=block.type==="pausa"?"si":block.type==="mmc"?"no":block.recovery??""};updateRecovery();rec.oninput=()=>{block.recovery=rec.value;scheduleChanged()};type.oninput=()=>{block.type=type.value;block.recovery="";updateRecovery();scheduleChanged()};recLabel.append(rec);row.append(recLabel);
  const notes=field("Descripción (opcional)","notes","text");notes.className="block-note";notes.querySelector("input").maxLength=200;
  const del=document.createElement("button");del.type="button";del.className="secondary";del.textContent="Eliminar tramo";del.setAttribute("aria-label","Eliminar tramo "+(i+1));del.onclick=()=>{s.blocks.splice(i,1);scheduleChanged();renderSchedule()};const duration=document.createElement("span");duration.className="muted";duration.dataset.simpleDuration=String(i);duration.style.gridColumn="1 / -1";const m=MMCSchedule.interval(s,block).minutes;duration.textContent="Duración: "+(m===null?"—":m+" min");row.append(del,duration);root.append(row);
 });renderScheduleSummary();
}
function renderScheduleSummary(){
 const out=$("scheduleFeedback"),detail=$("scheduleBreakdown");out.replaceChildren();detail.replaceChildren();const t=selectedTask();if(!t){out.textContent="Añada o seleccione una tarea para registrar su horario.";return}
 const d=syncTemporal(t.inputs);
 if(d.problems.length){const box=document.createElement("div");box.className="schedule-problems";const title=document.createElement("strong");title.textContent="Duración no determinada";const list=document.createElement("ul");d.problems.forEach(problem=>{const li=document.createElement("li");li.textContent=problem;list.append(li)});box.append(title,list);out.append(box);return}
 const metrics=document.createElement("div");metrics.className="schedule-metrics";for(const [label,value] of [["Jornada",d.shiftMinutes+" min"],["Manipulación total",d.totalMMC+" min"],["Período determinante",d.minutes+" min"],["Extensión temporal",d.totalMMC<=480?"Hasta 8 h":(d.extension-1)+"–"+d.extension+" h"]]){const card=document.createElement("div");card.className="schedule-metric";const title=document.createElement("span");title.textContent=label;const number=document.createElement("strong");number.textContent=value;card.append(title,number);metrics.append(card)}detail.append(metrics);
 const strip=document.createElement("div");strip.className="schedule-strip";strip.setAttribute("aria-label","Distribución de la jornada");for(const b of d.segments){const span=document.createElement("span");span.className=b.type==="otra"&&b.recovery?"ligera":b.type;span.style.flex=String(b.end-b.start);span.title=scheduleClock(b.start)+"–"+scheduleClock(b.end)+": "+(b.type==="mmc"?"MMC":b.type==="pausa"?"Pausa":b.recovery?"Otra tarea ligera":"Otra tarea sin recuperación");strip.append(span)}detail.append(strip);
 const legend=document.createElement("div");legend.className="schedule-legend";for(const [label,color] of [["MMC","#0078d4"],["Pausa","#2f855a"],["Otra tarea ligera","#8bd5bd"],["Sin recuperación","#a0aec0"]]){const span=document.createElement("span");span.textContent=label;span.style.setProperty("--swatch",color);legend.append(span)}detail.append(legend);
}
function multiplier(key,val){
 if((typeof val!=="number"&&typeof val!=="string")||String(val).trim()==="")return undefined;
 const n=Number(val);if(!Number.isFinite(n)||n<0||!tables[key])return undefined;
 if(key==="horizontal"&&n<20)return undefined;
 const entries=Object.entries(tables[key]).map(([k,v])=>[Number(k),v]).sort((a,b)=>a[0]-b[0]);
 // Extremos con factor cero acordados para interpolar los últimos tramos.
 const endpoints={vertical:175,horizontal:63,desplazamiento:175};
 if(endpoints[key]!==undefined)entries.push([endpoints[key],0]);
 // Conservar los mínimos de aplicación ya existentes.
 if(key==="desplazamiento"&&n<=25)return 1;
 if(key==="horizontal"&&n<=25)return 1;
 const exact=entries.find(([k])=>k===n);if(exact)return exact[1];
 const maxima={vertical:175,horizontal:63,desplazamiento:175,asimetria:135};
 if(n>maxima[key])return 0;
 const lower=entries.filter(([k])=>k<n).at(-1),upper=entries.find(([k])=>k>n);
 // Interpolación lineal entre dos puntos numéricos del Excel LI.
 // V, H y D usan los extremos acordados de 175, 63 y 175 cm; por encima el factor es cero.
 // Sin ambos extremos, no extrapolar ni prolongar el último coeficiente.
 if(!lower||!upper)return undefined;
 return lower[1]+(n-lower[0])/(upper[0]-lower[0])*(upper[1]-lower[1]);
}
// Clasificación automática: horario, tabla 2.4 y ejemplo de las páginas 36–37 del manual aportado.
function durationData(x){return MMCSchedule.analyze(x?.horario)}
function durationNote(r){
 if(!r.duration||r.problems)return "";const d=r.duration;
 return "Duración automática "+d.category+": período determinante "+fmt(d.minutes)+" min; recuperación posterior "+fmt(d.recoveryMinutes)+" min. MMC total: "+fmt(d.totalMMC)+" min en una jornada de "+fmt(d.shiftMinutes)+" min. "+d.groups.map((g,i)=>"Período "+(i+1)+": "+scheduleClock(g.start)+"–"+scheduleClock(g.end)+", "+fmt(g.minutes)+" min + "+fmt(g.recoveryMinutes)+" min de recuperación, "+g.category+".").join(" ");
}
// Fuente exclusiva: Excel LI, Bueno=1 y Malo=0,9.
function couplingMultiplier(quality,height){
 if(!["bueno","malo"].includes(quality))return undefined;
 if((typeof height!=="number"&&typeof height!=="string")||String(height).trim()==="")return undefined;
 const vertical=Number(height);if(!Number.isFinite(vertical)||vertical<0)return undefined;
 return quality==="bueno"?1:.9;
}
function couplingNote(r){
 if(r.problems||!["bueno","malo"].includes(r.coupling))return "";
 return "Agarre "+r.coupling+". CM = "+fmt(r.vals.CM)+".";
}
function geometryNote(r){return r.problems?"":"VM, HM, DM y AM: coeficientes tabulados e interpolación lineal entre puntos numéricos. Extremos acordados para interpolar: VM=0 a V=175 cm, HM=0 a H=63 cm y DM=0 a D=175 cm; por encima de cada límite el factor es cero. Sin dos extremos no se extrapola. Se mantienen los mínimos de aplicación de HM y DM.";}
function calculationNote(r){return[geometryNote(r),durationNote(r),frequencyNote(r),couplingNote(r),positionNote(r)].filter(Boolean).join(" ")}
function updateDurationFeedback(x){
 const out=$("durationFeedback");if(!out)return;
 if(!x){out.textContent="Seleccione una tarea para comprobar la duración.";return}
 const duration=durationData(x);
 out.textContent=duration.problems.length?duration.problems.join(" "):durationNote({duration});
}
function calc(x){
 const distance=verticalDistance(x),duration=durationData(x);x={...x,desplazamiento:distance.value===null?"":String(distance.value),grupoDuracion:duration.category,extension:duration.extension===undefined?"":String(duration.extension)};
 const problems=[...distance.problems];
 for(const k of ["peso","horizontal","asimetria","agarre","unaMano","dosPersonas"])if(x[k]===undefined||x[k]===null||String(x[k]).trim()==="")problems.push("Falta: "+k);
 problems.push(...duration.problems);
 if(x.agarre!==undefined&&x.agarre!==null&&String(x.agarre).trim()!==""&&!["bueno","malo"].includes(x.agarre))problems.push("Calidad del agarre no válida: seleccione Bueno o Malo.");
 if(Number.isFinite(Number(x.horizontal))&&Number(x.horizontal)<20)problems.push("Distancia horizontal en origen inferior al mínimo de 20 cm del manual.");
 if(x.controlDestino==="si"){
  const present=v=>v!==undefined&&v!==null&&String(v).trim()!=="";
  if(present(x.horizontalDestino)&&Number.isFinite(Number(x.horizontalDestino))&&Number(x.horizontalDestino)<20)problems.push("Distancia horizontal en destino inferior al mínimo de 20 cm del manual.");

 }
 if(problems.length)return{problems};
 const vals={VM:multiplier("vertical",x.vertical),HM:multiplier("horizontal",x.horizontal),DM:multiplier("desplazamiento",x.desplazamiento),AM:multiplier("asimetria",x.asimetria)};
 for(const [k,v] of Object.entries(vals))if(v===undefined)problems.push("Valor inválido o sin dos puntos tabulados para interpolar: "+k);else if(v===0)problems.push("Condición crítica: "+k);
 vals.FM=frequencyMultiplier(x.frecuencia,x.grupoDuracion,x.vertical);
 if(vals.FM===undefined)problems.push("No se puede determinar FM: revise frecuencia, altura y categoría de duración.");else if(vals.FM===0)problems.push("Frecuencia crítica en origen");
 vals.CM=couplingMultiplier(x.agarre,x.vertical);if(vals.CM===undefined)problems.push("No se puede determinar CM: revise el tipo de agarre y la altura de origen.");
 vals.M1=x.unaMano==="si"?.6:1;vals.M2=x.dosPersonas==="si"?.85:1;vals.EM={8:1,9:.97,10:.93,11:.89,12:.85}[x.extension];if(vals.EM===undefined)problems.push("Extensión temporal fuera de tabla");
 // Cada posición conserva su geometría completa. DM y los factores comunes se comparten.
 const destinationVals=x.controlDestino==="si"?{...vals}:null;
 if(destinationVals){
  for(const [field,table,factor] of [["verticalDestino","vertical","VM"],["horizontalDestino","horizontal","HM"],["asimetriaDestino","asimetria","AM"]]){
   const input=x[field];
   if(input===undefined||input===null||String(input).trim()===""){problems.push("Falta dato de destino: "+field);continue}
   const value=multiplier(table,input);
   if(value===undefined)problems.push("Valor de destino inválido o sin dos puntos tabulados para interpolar: "+field);
   else if(value===0)problems.push("Condición crítica en destino: "+field);
   destinationVals[factor]=value;
  }
  destinationVals.FM=frequencyMultiplier(x.frecuencia,x.grupoDuracion,x.verticalDestino);
  if(destinationVals.FM===undefined)problems.push("No se puede determinar FM en destino: revise frecuencia y altura de destino.");
  else if(destinationVals.FM===0)problems.push("Frecuencia crítica en destino");
  destinationVals.CM=couplingMultiplier(x.agarre,x.verticalDestino);
  if(destinationVals.CM===undefined)problems.push("No se puede determinar CM en destino: revise el tipo de agarre y la altura de destino.");
 }
 const w=Number(x.peso);if(!Number.isFinite(w)||w<=0)problems.push("Peso inválido");
 if(problems.length)return{problems,vals};
 const effective=w/(x.dosPersonas==="si"?2:1);
 const evaluate=factors=>{
  const product=Object.values(factors).reduce((a,b)=>a*b,1);
  return{vals:factors,product,indices:refs.map(([group,mass])=>({group,mass,recommended:mass*product,index:effective/(mass*product)}))};
 };
 const origin=evaluate(vals),destination=destinationVals?evaluate(destinationVals):null;
 // El menor peso recomendado determina el mayor índice para cada grupo de referencia.
 // En caso de igualdad se conserva origen; ambos resultados permanecen disponibles.
 const governingPosition=destination&&destination.product<origin.product?"destination":"origin";
 const selected=governingPosition==="destination"?destination:origin;
 const frequencyValue=Number(x.frecuencia),frequency={value:frequencyValue,method:frequencyValue<=.2?"tramo de baja frecuencia":freq.includes(frequencyValue)?"valor tabulado":"interpolación entre filas"};
 return{vals:selected.vals,weightTotal:w,weightPerPerson:effective,indices:selected.indices,positions:{origin,destination},governingPosition,duration,frequency,coupling:x.agarre,displacement:distance.value};
}
function positionNote(r){
 if(!r.positions?.destination)return "";
 if(r.positions.origin.product===r.positions.destination.product)return "Control significativo en destino: origen y destino presentan el mismo índice.";
 return "Control significativo en destino: se han evaluado ambas posiciones por separado. El mayor índice corresponde a "+(r.governingPosition==="destination"?"destino":"origen")+".";
}
function factorText(r){
 if(r.problems)return r.problems.join("; ");
 if(r.positions?.destination)return "Origen: "+JSON.stringify(r.positions.origin.vals)+" | Destino: "+JSON.stringify(r.positions.destination.vals)+" | "+calculationNote(r);
 return JSON.stringify(r.vals)+" | "+calculationNote(r);
}
// Documento aportado, apartados 2.1 y 3.2: rangos, colores, grupos y presentación del IL.
const riskBands=[
 {max:1,label:"TOLERABLE",range:"IL ≤ 1",color:"#00ff00",text:"#111111",rank:0,action:"Las personas trabajadoras pueden efectuar la tarea sin peligro."},
 {max:1.5,label:"BAJO",range:"1 < IL ≤ 1,5",color:"#ffff00",text:"#111111",rank:1,action:"Preste especial atención a las condiciones de baja frecuencia/alta carga y a las posturas extremas o estáticas. Incluya todos los factores en el rediseño de tareas o puestos de trabajo y considere los esfuerzos para reducir los valores del IL < 1,0."},
 {max:2,label:"MODERADO",range:"1,5 < IL ≤ 2",color:"#ff0000",text:"#111111",rank:2,action:"Rediseñar las tareas y los puestos de trabajo en función de las prioridades para reducir el IL, seguido de un análisis de los resultados para confirmar la eficacia."},
 {max:3,label:"ALTO",range:"2 < IL ≤ 3",color:"#c00000",text:"#ffffff",rank:3,action:"Los cambios en la tarea para reducir el IL son de alta prioridad."},
 {max:Infinity,label:"MUY ALTO",range:"IL > 3",color:"#7030a0",text:"#ffffff",rank:4,action:"Los cambios en la tarea para reducir el IL son necesarios de inmediato."}
];
const pendingLevel={label:"NO CALCULABLE",color:"#e2e8f0",text:"#334155",rank:-1,action:"Complete o corrija los datos de la tarea para obtener el resultado."};
const populationGroups=[{sex:"Hombres",age:"20–45 años",mass:25},{sex:"Hombres",age:"<20 o >45 años",mass:20},{sex:"Mujeres",age:"20–45 años",mass:20},{sex:"Mujeres",age:"<20 o >45 años",mass:15}];
const fmtIndex=value=>Number.isFinite(value)?value.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2}):"—";
function resultLevel(value){return Number.isFinite(value)&&value>=0?riskBands.find(b=>value<=b.max):pendingLevel}
function populationResults(r){
 const critical=!r.indices&&(r.problems||[]).some(message=>/cr[ií]tica/i.test(message));
 return populationGroups.map((g,i)=>{const value=r.indices?.[i]?.index,level=critical?riskBands[4]:resultLevel(value);return{...g,index:critical?null:Number.isFinite(value)?value:null,indexText:critical?"> 3":fmtIndex(value),level,status:critical?"critical":Number.isFinite(value)?"valid":"pending"}});
}
function riskBadge(level){const badge=document.createElement("span");badge.className="mmc-risk-badge";badge.textContent=level.label;badge.style.backgroundColor=level.color;badge.style.color=level.text;return badge}
function populationTable(rows){
 const table=document.createElement("table");table.className="result-table task-result-table population-table";table.setAttribute("aria-label","Resultados por sexo y edad");
 const head=document.createElement("thead"),top=document.createElement("tr"),sub=document.createElement("tr");
 for(const [text,colSpan,rowSpan] of [["Edad (años)",1,2],["HOMBRES",2,1],["MUJERES",2,1]]){const th=document.createElement("th");th.textContent=text;th.colSpan=colSpan;th.rowSpan=rowSpan;th.scope=colSpan>1?"colgroup":"col";top.append(th)}
 for(const text of ["IR MMC (IL)","NIVEL DE RIESGO","IR MMC (IL)","NIVEL DE RIESGO"]){const th=document.createElement("th");th.textContent=text;th.scope="col";sub.append(th)}head.append(top,sub);table.append(head);
 const body=document.createElement("tbody");
 for(const [age,h,m] of [["20–45",rows[0],rows[2]],["<20 o >45",rows[1],rows[3]]]){const tr=document.createElement("tr"),label=document.createElement("th");label.scope="row";label.textContent=age;tr.append(label);for(const r of [h,m]){const value=document.createElement("td");value.className="population-index";value.textContent=r.indexText;const level=document.createElement("td");level.textContent=r.level.label;level.style.backgroundColor=r.level.color;level.style.color=r.level.text;tr.append(value,level)}body.append(tr)}table.append(body);return table;
}
function taskReport(t,r){
 const rows=populationResults(r),cell='border:1px solid #b9cede;padding:7px;vertical-align:middle;text-align:center;',th='background:#deeaf6;'+cell;
 const head='<tr><th colspan="5" style="'+cell+'background:#759cbf;color:#111;text-align:left">Tarea: '+safe(t.name||"Sin nombre")+'</th></tr><tr><th rowspan="2" style="'+th+'">Edad (años)</th><th colspan="2" style="'+th+'">HOMBRES</th><th colspan="2" style="'+th+'">MUJERES</th></tr><tr>'+["IR MMC (IL)","NIVEL DE RIESGO","IR MMC (IL)","NIVEL DE RIESGO"].map(label=>'<th style="'+th+'">'+label+'</th>').join("")+'</tr>';
 const body=[["20–45",rows[0],rows[2]],["<20 o >45",rows[1],rows[3]]].map(([age,h,m])=>'<tr><th style="'+th+'">'+safe(age)+'</th>'+[h,m].map(v=>'<td style="'+cell+'">'+safe(v.indexText)+'</td><td style="'+cell+'background:'+v.level.color+';color:'+v.level.text+'">'+v.level.label+'</td>').join("")+'</tr>').join("");
 const note=rows[0].status==="critical"?"SITUACIÓN CRÍTICA: se informa IL > 3 y nivel MUY ALTO para los cuatro grupos, conforme al documento aportado. No es un índice numérico calculado.":rows[0].status==="pending"?(r.problems||["Cálculo no disponible"]).join("; "):"Índices mostrados con dos decimales. La clasificación se aplica al valor sin redondear.";
 const plain="Tarea: "+(t.name||"Sin nombre")+"\nEdad (años)\tHOMBRES IL\tNIVEL\tMUJERES IL\tNIVEL\n"+[["20–45",rows[0],rows[2]],["<20 o >45",rows[1],rows[3]]].map(([age,h,m])=>[age,h.indexText,h.level.label,m.indexText,m.level.label].join("\t")).join("\n")+"\n"+note;
 return{html:'<table style="font-family:Arial,sans-serif;font-size:10pt;border-collapse:collapse;width:100%">'+head+body+'<tr><td colspan="5" style="'+cell+'text-align:left">'+safe(note)+'</td></tr></table>',plain};
}
async function copyReport(html,plain,message){try{if(navigator.clipboard?.write&&window.ClipboardItem)await navigator.clipboard.write([new ClipboardItem({"text/html":new Blob([html],{type:"text/html"}),"text/plain":new Blob([plain],{type:"text/plain"})})]);else if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(plain);else throw Error("Copia no disponible");$("status").textContent=message}catch(e){$("status").textContent="No se ha podido copiar. Compruebe los permisos del portapapeles."}}
function copyTask(t,r){const report=taskReport(t,r);return copyReport(report.html,report.plain,"Tabla de "+(t.name||"la tarea")+" copiada para Word")}
function results(){
 const root=$("summary");root.replaceChildren();if(!p.tasks.length){root.textContent="Añada una tarea para obtener resultados por grupo de población.";return}
 const evaluated=p.tasks.map(t=>({task:t,result:calc(t.inputs)}));
 const toolbar=document.createElement("div");toolbar.className="results-toolbar";const search=document.createElement("input");search.type="search";search.placeholder="Buscar tarea por nombre…";search.setAttribute("aria-label","Buscar tarea");const expand=document.createElement("button");expand.textContent="Desplegar todas";expand.className="secondary";const collapse=document.createElement("button");collapse.textContent="Contraer todas";collapse.className="secondary";toolbar.append(search,expand,collapse);root.append(toolbar);
 const container=document.createElement("div");container.className="result-cards";root.append(container);
 evaluated.forEach(({task:t,result:r},i)=>{
  const rows=populationResults(r),status=rows[0].status;
  const card=document.createElement("details");card.className="result-card mmc-task-results";card.dataset.name=(t.name||"").toLowerCase();card.open=i===0;
  const header=document.createElement("summary");const title=document.createElement("strong");title.textContent=(i+1)+". "+(t.name||"Tarea sin nombre");header.append(title);
  const content=document.createElement("div");content.className="result-card-content";
  if(status!=="valid"){const message=document.createElement("div");message.className="mmc-result-message";const text=document.createElement("strong");text.textContent=status==="critical"?"SITUACIÓN CRÍTICA · IL > 3 / MUY ALTO":"RESULTADO NO CALCULABLE";message.append(text);const list=document.createElement("ul");(r.problems||["Revise los datos de entrada."]).forEach(problem=>{const li=document.createElement("li");li.textContent=problem;list.append(li)});message.append(list);if(status==="critical"){const note=document.createElement("p");note.textContent="El documento indica informar > 3 y MUY ALTO en los cuatro grupos cuando existe una condición inaceptable. No se ha calculado un IL numérico.";message.append(note)}content.append(message)}
  const tableHeading=document.createElement("h3");tableHeading.textContent="Resultados para el informe";content.append(tableHeading);const wrap=document.createElement("div");wrap.className="population-table-scroll";wrap.append(populationTable(rows));content.append(wrap);
  const actions=document.createElement("div");actions.className="mmc-result-actions";const copyButton=document.createElement("button");copyButton.textContent="Copiar tabla para Word";copyButton.onclick=()=>copyTask(t,r);const edit=document.createElement("button");edit.className="secondary";edit.textContent="Revisar datos";edit.onclick=()=>{sel=t.id;nav(3)};const schedule=document.createElement("button");schedule.className="secondary";schedule.textContent="Revisar horario";schedule.onclick=()=>{sel=t.id;nav(2)};actions.append(copyButton,edit,schedule);content.append(actions);
  card.append(header,content);container.append(card);
 });
 search.oninput=()=>{const term=search.value.toLowerCase().trim();container.querySelectorAll(".result-card").forEach(c=>c.hidden=!c.dataset.name.includes(term))};expand.onclick=()=>container.querySelectorAll(".result-card:not([hidden])").forEach(c=>c.open=true);collapse.onclick=()=>container.querySelectorAll(".result-card").forEach(c=>c.open=false);
}

function detail(t,r){const d=$("detail");d.replaceChildren();const h=document.createElement("h2");h.textContent="Detalle: "+(t.name||"Tarea");d.append(h);if(r.problems){const v=document.createElement("p");v.textContent=r.problems.join("; ");d.append(v);return}const a=document.createElement("p");a.textContent="Peso total "+fmt(r.weightTotal)+" kg · Peso por persona "+fmt(r.weightPerPerson)+" kg";d.append(a);const b=document.createElement("p");b.textContent=Object.entries(r.vals).map(([k,v])=>k+"="+v).join(" | ");d.append(b);r.indices.forEach(i=>{const q=document.createElement("p");q.textContent=i.group+": peso recomendado "+fmt(i.recommended)+" kg · índice "+fmt(i.index);d.append(q)})}
async function save(as){try{p.tasks.forEach(t=>syncTemporal(t.inputs));Object.values(p.simulations).forEach(x=>{if(x&&typeof x==="object"&&!Array.isArray(x))syncTemporal(x)});if(!as&&handle){const w=await handle.createWritable();await w.write(JSON.stringify(p,null,2));await w.close()}else if(window.showSaveFilePicker){handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:"JSON",accept:{"application/json":[".json"]}}]});name=handle.name;const w=await handle.createWritable();await w.write(JSON.stringify(p,null,2));await w.close()}else{let n=prompt("Nombre del archivo",name);if(!n)return;name=n.endsWith(".json")?n:n+".json";const u=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:"application/json"})),a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)}dirty=false;$("status").textContent="Guardado solicitado"}catch(e){if(e.name!=="AbortError")$("status").textContent=e.message}}
async function load(f){if(!f)return;try{const q=JSON.parse(await f.text());if(q.application!=="MMC Analyzer"||q.module!=="simple"||!Array.isArray(q.tasks)||q.tasks.length>50)throw Error("Proyecto incompatible");if(dirty&&!confirm("¿Descartar cambios?"))return;p={application:"MMC Analyzer",module:"simple",version:4,meta:q.meta||{},tasks:q.tasks.map(t=>({id:String(t.id),name:String(t.name||""),inputs:{...blank(),...t.inputs,horario:t.inputs?.horario||MMCSchedule.blank()}})),simulations:q.simulations||{}};metas.forEach(k=>document.querySelector('[data-meta="'+k+'"]').value=p.meta[k]||"");p.tasks.forEach(t=>syncTemporal(t.inputs));Object.values(p.simulations).forEach(x=>{if(x&&typeof x==="object"&&!Array.isArray(x))syncTemporal(x)});dirty=false;handle=null;name=f.name;render();nav(1);$("status").textContent="Proyecto cargado"+(p.tasks.some(t=>verticalDistance(t.inputs).problems.length)?". Complete o revise las alturas inicial y final; no se deduce la altura final de un desplazamiento antiguo.":"")+(p.tasks.some(t=>durationData(t.inputs).problems.length)?". Complete o revise el horario de cada tarea.":"")}catch(e){$("status").textContent=e.message}}
const simLabels={peso:"Peso (kg)",horizontal:"Distancia horizontal (cm)",vertical:"Altura vertical inicial (cm)",verticalDestino:"Altura vertical final (cm)",asimetria:"Asimetría (°)",frecuencia:"Frecuencia (levantamientos/min)",agarre:"Calidad del agarre",unaMano:"Manipulación con una mano",dosPersonas:"Manipulación entre dos personas",controlDestino:"Control significativo en destino",horizontalDestino:"Distancia horizontal destino (cm)",asimetriaDestino:"Asimetría destino (°)"};
const simOptions={agarre:[["","Sin indicar"],["bueno","Bueno"],["malo","Malo"]],unaMano:[["","Sin indicar"],["no","No"],["si","Sí"]],dosPersonas:[["","Sin indicar"],["no","No"],["si","Sí"]],controlDestino:[["no","No"],["si","Sí"]]};
const simTask=()=>p.tasks.find(t=>t.id===$("simTask").value);
function simulationInput(t){return p.simulations[t.id]||structuredClone(t.inputs)}
function displaySimValue(key,value){return simOptions[key]?.find(x=>x[0]===value)?.[1]||(value===undefined||value===""?"—":String(value))}
function simulationChanges(t,x){const changes=[];for(const key of Object.keys(simLabels)){if(key.endsWith("Destino")&&key!=="controlDestino"&&key!=="verticalDestino"&&x.controlDestino!=="si"&&t.inputs.controlDestino!=="si")continue;if(String(t.inputs[key]??"")!==String(x[key]??""))changes.push([simLabels[key],displaySimValue(key,t.inputs[key]),displaySimValue(key,x[key])])}if(JSON.stringify(t.inputs.horario)!==JSON.stringify(x.horario))changes.push(["Horario de la tarea",scheduleDescription(t.inputs.horario),scheduleDescription(x.horario)]);return changes}
function scheduleDescription(s){if(!s)return "Sin horario";return (s.start||"—")+"–"+(s.end||"—")+(s.overnight?" (+1 día)":"")+"; "+(s.blocks||[]).map(b=>(b.start||"—")+"–"+(b.end||"—")+" "+({mmc:"MMC",pausa:"Pausa",otra:b.recovery==="si"?"Otra tarea ligera":"Otra tarea sin recuperación"}[b.type]||"Sin actividad")).join("; ")}
function simulationComparison(t,x){const original=populationResults(calc(t.inputs)),simulated=populationResults(calc(x));return original.map((base,i)=>{const next=simulated[i],numeric=base.status==="valid"&&next.status==="valid";return{base,next,delta:numeric?next.index-base.index:null,reduction:numeric&&base.index>0?100*(base.index-next.index)/base.index:null}})}
function simulationReport(t,x){
 const rows=simulationComparison(t,x),changes=simulationChanges(t,x),headers=["Grupo de población","IL original","Riesgo original","IL simulado","Riesgo simulado","Variación del IL","Reducción (%)"],cell='border:1px solid #b9cede;padding:8px;text-align:center;';
 const values=row=>[row.base.sex+" · "+row.base.age,row.base.indexText,row.base.level.label,row.next.indexText,row.next.level.label,row.delta===null?"—":(row.delta>0?"+":"")+fmtIndex(row.delta),row.reduction===null?"—":fmtIndex(row.reduction)+" %"];
 const table='<table class="result-table sim-comparison" style="border-collapse:collapse;width:100%"><thead><tr>'+headers.map(h=>'<th scope="col" style="'+cell+'background:#deeaf6">'+safe(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+values(row).map((v,i)=>'<'+(i===0?'th scope="row"':'td')+' style="'+cell+(i===2?'background:'+row.base.level.color+';color:'+row.base.level.text:i===4?'background:'+row.next.level.color+';color:'+row.next.level.text:'')+'">'+safe(v)+'</'+(i===0?'th':'td')+'>').join('')+'</tr>').join('')+'</tbody></table>';
 const notes=[];for(const [label,input] of [["Original",t.inputs],["Simulado",x]]){const r=calc(input);if(r.problems)notes.push(label+": "+r.problems.join('; '))}notes.push('Variación = IL simulado − IL original. Una reducción positiva indica una disminución del índice. Los porcentajes se calculan sin redondear. En situaciones críticas, > 3 es una indicación de categoría, no un índice calculado; no se calcula la variación.');
 const changeHtml=changes.length?'<ul>'+changes.map(c=>'<li><strong>'+safe(c[0])+'</strong>: '+safe(c[1])+' → '+safe(c[2])+'</li>').join('')+'</ul>':'<p>No se ha modificado ninguna condición.</p>';
 return{table,changeHtml,notes,html:'<div style="font-family:Arial,sans-serif;font-size:10pt"><h2>Simulación: '+safe(t.name||"Tarea sin nombre")+'</h2>'+table+notes.map(n=>'<p>'+safe(n)+'</p>').join('')+'<h3>Resumen de cambios simulados</h3>'+changeHtml+'</div>',plain:'Simulación: '+(t.name||"Tarea sin nombre")+'\n'+headers.join('\t')+'\n'+rows.map(r=>values(r).join('\t')).join('\n')+'\n'+notes.join('\n')+'\nResumen de cambios simulados\n'+(changes.length?changes.map(c=>c[0]+': '+c[1]+' → '+c[2]).join('\n'):'No se ha modificado ninguna condición.')};
}
function simField(key,x){const label=simLabels[key],options=simOptions[key];return '<label>'+label+(options?'<select aria-label="Simulación: '+label+'" data-sim-field="'+key+'">'+options.map(([value,text])=>'<option value="'+value+'"'+(x[key]===value?' selected':'')+'>'+text+'</option>').join('')+'</select>':'<input aria-label="Simulación: '+label+'" data-sim-field="'+key+'" type="number" min="0" step="any" value="'+safe(x[key]??'')+'">')+'</label>'}
function sim(){
 const t=simTask();$("simEmpty").hidden=!!t;$("simulation").hidden=!t;if(!t)return;
 const x=simulationInput(t);syncTemporal(x);
 $("simInputs").innerHTML=Object.keys(simLabels).filter(k=>!k.endsWith("Destino")||k==="controlDestino"||k==="verticalDestino"||x.controlDestino==="si").map(k=>simField(k,x)).join('');
 $("simInputs").querySelectorAll('[data-sim-field]').forEach(input=>{input.oninput=()=>{x[input.dataset.simField]=input.value;p.simulations[t.id]=x;changed();showSim(t,x);if(input.dataset.simField==="controlDestino")sim()}});
 renderSimSchedule(t,x);showSim(t,x);
}
function renderSimSchedule(t,x){
 const s=x.horario||(x.horario=MMCSchedule.blank()),root=$("simSchedule");
 const time=(key,label)=>'<label>'+label+'<input aria-label="Simulación: '+label+'" type="time" data-sim-shift="'+key+'" value="'+safe(s[key]||'')+'"></label>';
 root.innerHTML='<div class="fields three">'+time('start','Inicio de jornada')+time('end','Fin de jornada')+'<label class="check-field"><input type="checkbox" data-sim-shift="overnight"'+(s.overnight?' checked':'')+'>El fin corresponde al día siguiente</label></div><div class="schedule-blocks">'+s.blocks.map((b,i)=>'<div class="sim-schedule-block"><strong>Tramo '+(i+1)+'</strong><span class="muted" style="grid-column:1/-1" data-simple-sim-duration="'+i+'">Duración: '+(MMCSchedule.interval(s,b).minutes===null?'—':MMCSchedule.interval(s,b).minutes+' min')+'</span>'+['start','end'].map(k=>'<label>'+(k==='start'?'Inicio':'Fin')+'<input aria-label="Simulación: '+(k==='start'?'Inicio':'Fin')+' del tramo '+(i+1)+'" type="time" data-sim-block="'+i+'" data-key="'+k+'" value="'+safe(b[k]||'')+'"></label>').join('')+'<label>Actividad<select aria-label="Simulación: Actividad del tramo '+(i+1)+'" data-sim-block="'+i+'" data-key="type">'+[['','Seleccione'],['mmc','Manipulación de cargas'],['pausa','Pausa / descanso'],['otra','Otra tarea sin MMC']].map(([v,l])=>'<option value="'+v+'"'+(b.type===v?' selected':'')+'>'+l+'</option>').join('')+'</select></label><label>Recuperación dorsolumbar<select aria-label="Simulación: Recuperación del tramo '+(i+1)+'" data-sim-block="'+i+'" data-key="recovery"'+(b.type!=='otra'?' disabled':'')+'>'+[['','Seleccione'],['si','Sí: trabajo ligero'],['no','No']].map(([v,l])=>'<option value="'+v+'"'+(b.recovery===v?' selected':'')+'>'+l+'</option>').join('')+'</select></label><button class="secondary" data-sim-delete="'+i+'" aria-label="Simulación: Eliminar tramo '+(i+1)+'">Eliminar tramo</button></div>').join('')+'</div><button id="addSimBlock" class="secondary"'+(s.blocks.length>=200?' disabled':'')+'>+ Añadir tramo simulado</button><div id="simDuration" class="notice sim-duration"></div>';
 const update=()=>{syncTemporal(x);p.simulations[t.id]=x;changed();showSim(t,x)};
 root.querySelectorAll('[data-sim-shift]').forEach(e=>e.oninput=()=>{s[e.dataset.simShift]=e.type==='checkbox'?e.checked:e.value;update()});
 root.querySelectorAll('[data-sim-block]').forEach(e=>e.oninput=()=>{const b=s.blocks[Number(e.dataset.simBlock)];b[e.dataset.key]=e.value;if(e.dataset.key==='type')b.recovery='';update();if(e.dataset.key==='type')renderSimSchedule(t,x)});
 root.querySelectorAll('[data-sim-delete]').forEach(e=>e.onclick=()=>{s.blocks.splice(Number(e.dataset.simDelete),1);update();renderSimSchedule(t,x)});
 $("addSimBlock").onclick=()=>{if(s.blocks.length>=200)return;s.blocks.push({start:s.blocks.at(-1)?.end||s.start,end:s.end,type:'',recovery:'',notes:''});update();renderSimSchedule(t,x)};
 showSimDuration(x);
}
function showSimDuration(x){document.querySelectorAll('[data-simple-sim-duration]').forEach(e=>{const m=MMCSchedule.interval(x.horario,x.horario.blocks[Number(e.dataset.simpleSimDuration)]).minutes;e.textContent='Duración: '+(m===null?'—':m+' min');});const d=syncTemporal(x);$("simDuration").textContent=d.problems.length?d.problems.join(' '):'Duración simulada: '+d.category.toUpperCase()+' · Período determinante: '+fmt(d.minutes)+' min · Recuperación: '+fmt(d.recoveryMinutes)+' min · MMC total: '+fmt(d.totalMMC)+' min.'}
function showSim(t,x){syncGeometry(x);if($("simGeometry"))$("simGeometry").textContent=geometryFeedback(x);const report=simulationReport(t,x);$("simResults").innerHTML='<h2>Comparación de resultados</h2><div class="population-table-scroll">'+report.table+'</div>'+report.notes.map(n=>'<p class="muted">'+safe(n)+'</p>').join('');$("simChanges").innerHTML=report.changeHtml;showSimDuration(x)}
function copySimulation(){const reports=p.tasks.filter(t=>p.simulations[t.id]).map(t=>simulationReport(t,p.simulations[t.id]));if(!reports.length){$("status").textContent="No hay cambios simulados para copiar";return}return copyReport(reports.map(r=>r.html).join('<p></p>'),reports.map(r=>r.plain).join('\n\n'),"Comparaciones simuladas copiadas para Word")}
function copy(type){
 if(type==="sim")return copySimulation();
 if(type==="general"){const reports=p.tasks.map(t=>taskReport(t,calc(t.inputs)));if(!reports.length){$("status").textContent="No hay tareas para copiar";return}return copyReport(reports.map(r=>r.html).join('<p></p>'),reports.map(r=>r.plain).join("\n\n"),"Resultados por población copiados para Word")}
 let rows=type==="intermediate"?[["Tarea","Factores"],...p.tasks.map(t=>[t.name,factorText(calc(t.inputs))])]:[["Tarea","Simulación"],...p.tasks.map(t=>[t.name,p.simulations[t.id]?JSON.stringify(p.simulations[t.id]):"Sin simulación"])];
 const markup='<table style="font-family:Arial;font-size:10pt;border-collapse:collapse">'+rows.map(row=>"<tr>"+row.map(cell=>'<td style="border:1px solid #ccc;padding:4px">'+safe(cell)+"</td>").join("")+"</tr>").join("")+"</table>";return copyReport(markup,rows.map(row=>row.join("\t")).join("\n"),"Tabla copiada");
}
document.querySelectorAll("[data-method]").forEach(b=>b.onclick=()=>b.dataset.method==="simple"?(screen("simple"),nav(1)):$("methodNote").textContent="Módulo en preparación");
$("home").onclick=()=>{if(dirty&&!confirm("Hay cambios sin guardar. ¿Salir?"))return;screen("methods")};$("prev").onclick=()=>nav(page-1);$("next").onclick=()=>nav(page+1);
$("addTask").onclick=()=>{if(p.tasks.length>=50)return;const t=task();p.tasks.push(t);sel=t.id;changed();render()};$("taskSelect").onchange=e=>{sel=e.target.value;inputs()};
$("scheduleTask").onchange=e=>{sel=e.target.value;renderSchedule()};
for(const [id,key] of [["shiftStart","start"],["shiftEnd","end"]])$(id).oninput=()=>{const t=selectedTask();if(t){t.inputs.horario[key]=$(id).value;scheduleChanged()}};
$("shiftOvernight").onchange=()=>{const t=selectedTask();if(t){t.inputs.horario.overnight=$("shiftOvernight").checked;scheduleChanged()}};
$("addScheduleBlock").onclick=()=>{const t=selectedTask();if(!t)return;const s=t.inputs.horario;if(s.blocks.length>=200)return;s.blocks.push({id:crypto.randomUUID(),start:s.blocks.at(-1)?.end||s.start,end:s.end,type:"",recovery:"",notes:""});scheduleChanged();renderSchedule()};
document.querySelectorAll("[data-field]").forEach(e=>e.addEventListener("input",()=>{const t=p.tasks.find(t=>t.id===sel);if(t&&!temporalFields.includes(e.dataset.field)){t.inputs[e.dataset.field]=e.value;if(e.dataset.field==="controlDestino")$("destination").hidden=e.value!=="si";syncGeometry(t.inputs);updateGeometryFeedback(t.inputs);updateDurationFeedback(t.inputs);changed()}}));
document.querySelectorAll("[data-meta]").forEach(e=>e.addEventListener("input",()=>{p.meta[e.dataset.meta]=e.value;changed()}));
$("save").onclick=()=>save(false);$("load").onchange=e=>{load(e.target.files[0]);e.target.value=""};
$("openSimulation").onclick=()=>nav(5);
$("backResults").onclick=()=>nav(4);
$("recalcSim").onclick=()=>{const t=simTask();if(t)showSim(t,simulationInput(t))};
$("copySimReport").onclick=()=>{const t=simTask();if(t){const r=simulationReport(t,simulationInput(t));copyReport(r.html,r.plain,"Comparación de la tarea copiada para Word")}};
$("simTask").onchange=sim;$("resetSim").onclick=()=>{const t=simTask();if(t){delete p.simulations[t.id];changed();sim()}};
$("copyGeneral").onclick=()=>copy("general");$("copyIntermediate").onclick=()=>copy("intermediate");$("copySim").onclick=()=>copy("sim");
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=""}});render();nav(1);screen("methods");
})();

