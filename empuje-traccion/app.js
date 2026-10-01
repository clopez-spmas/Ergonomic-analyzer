(()=>{"use strict";
const HEIGHTS=[[2.05,40,165,14,91],[2,50.6666,178.33325,22.6666666667,104.6666666667],[1.95,61.33333,191.6666625,31.3333333333,118.3333333333],[1.9,72,205,40,132],[1.85,79,216.3333333333,47,143.6666666667],[1.8,86,227.6666666667,54,155.3333333333],[1.75,93,239,61,167],[1.7,99,248,66.6666666667,177],[1.65,105,257,72.3333333333,187],[1.6,111,266,78,197],[1.55,115.6666,272.9999,83,205],[1.5,120.333,279.9995,88,213],[1.45,125,287,93,221],[1.4,128.33333,291.666662,97,227.3333333333],[1.35,131.6666,296.33324,101,233.6666666667],[1.3,135,301,105,240],[1.25,137,304,107.6666666667,244],[1.2,139,307,110.3333333333,248],[1.15,141,310,113,252],[1.1,142,310.6666666667,114.6666666667,254.3333333333],[1.05,143,311.3333333333,116.3333333333,256.6666666667],[1,144,312,118,259],[.95,144,312,118.6666666667,259.6666666667],[.9,144,312,119.3333333333,260.3333333333],[.85,144,308,120,261],[.8,145.66666,310.999988,119.6666666667,259.6666666667],[.75,147.33333,313.999994,119.3333333333,258.3333333333],[.7,139,299,119,257],[.65,136.6666,293.3331714286,117.3333333333,253.6666666667],[.6,134.3333,287.6665857143,115.6666666667,250.3333333333],[.55,132,282,114,247],[.5,128,274.6666666667,111.6666666667,241.6666666667],[.45,124,267.3333333333,109.3333333333,236.3333333333],[.4,120,260,107,231],[.35,115.3333,250.6666,103.3333333333,224.6666666667],[.3,178,376,99.6666666667,218.3333333333],[.25,106,232,96,212],[.2,null,null,null,null],[.15,null,null,null,null],[.1,null,null,null,null]];
const FI=[[.2,.15],[.3,.1666666667],[.4,.1833333333],[.5,.2],[.6,.21],[.7,.22],[.8,.23],[.9,.24],[1,.25],[1.1,.2533],[1.2,.2566],[1.3,.2599],[1.4,.2632],[1.5,.2665],[1.6,.2698],[1.7,.2731],[1.8,.2764],[1.9,.2797],[2,.283],[2.1,.2863],[2.2,.2896],[2.3,.2929],[2.4,.2962],[2.5,.3],[2.6,.3021428],[2.7,.3042856],[2.8,.3064284],[2.9,.3085712],[3,.310714],[3.1,.3128568],[3.2,.3149996],[3.3,.3171424],[3.4,.3192852],[3.5,.321428],[3.6,.3235708],[3.7,.3257136],[3.8,.3278564],[3.9,.3299992],[4,.33]];
const DIST=[["<5",null,null],[5,.27,.18],[6,.294,.196],[7,.318,.212],[8,.342,.228],[9,.366,.244],[10,.39,.26],[11,.404,.27],[12,.418,.28],[13,.432,.29],[14,.446,.3],[15,.46,.31],[16,.47,.316],[17,.48,.322],[18,.49,.328],[19,.5,.334],[20,.51,.34],[21,.518,.344],[22,.526,.348],[23,.534,.352],[24,.542,.356],[25,.55,.36],[26,.556,.364],[27,.562,.368],[28,.568,.372],[29,.574,.376],[30,.58,.38],[31,.586,.384],[32,.592,.388],[33,.598,.392],[34,.604,.396],[35,.61,.4],[36,.614,.404],[37,.618,.408],[38,.622,.412],[39,.626,.416],[40,.63,.42],[41,.634,.422],[42,.638,.424],[43,.642,.426],[44,.646,.428],[45,.65,.43],[46,.654,.432],[47,.658,.434],[48,.662,.436],[49,.666,.438],[50,.67,.44],[51,.672,.442],[52,.674,.444],[53,.676,.446],[54,.678,.448],[55,.68,.45],[56,.684,.452],[57,.688,.454],[58,.692,.456],[59,.696,.458],[60,.7,.46],[61,.702,.462],[62,.704,.464],[63,.706,.466],[64,.708,.468],[65,.71,.47]];
const FS=[[10,.49],[9,.488],[8,.486],[7,.484],[6,.482],[5,.48],[4,.47],[3,.4642857143],[2.9,.4585714286],[2.8,.4528571429],[2.7,.4471428571],[2.6,.4414285714],[2.5,.4357142857],[2.4,.43],[2.3,.425],[2.2,.42],[2.1,.415],[2,.41],[1.9,.405],[1.8,.4],[1.7,.395],[1.6,.39],[1.5,.385],[1.4,.38],[1.3,.375],[1.2,.37],[1.1,.365],[1,.36],[.9,.348],[.8,.336],[.7,.324],[.6,.312],[.5,.3],[.4,.2733333333],[.3,.2466666667],[.2,.22],[.1,.18],[.075,.16],[.05,.14],[.025,.11],[.02,.1],[1/60,.09],[1/70,.0866666667],[1/80,.0833333333],[1/90,.08],[.01,.0766666667],[1/110,.0733333333],[1/120,.07],[1/130,.0683333333],[1/140,.0666666667],[1/150,.065],[1/160,.0633333333],[1/170,.0616666667],[1/180,.06],[1/190,.0583333333],[.005,.0566666667],[1/210,.055],[1/220,.0533333333],[1/230,.0516666667],[1/240,.05],[.004,.0491666667],[1/260,.0483333333],[1/270,.0475],[1/280,.0466666667],[1/290,.0458333333],[1/300,.045],[1/310,.0441666667],[1/320,.0433333333],[1/330,.0425],[1/340,.0416666667],[1/350,.0408333333],[1/360,.04]];
const FLS_PULL=[[1.4,190,300],[1.35,190,300],[1.3,190,300],[1.25,190,300],[1.2,190,300],[1.15,190,300],[1.1,310,490],[1.05,310,490],[1,310,490],[.95,310,490],[.9,330,520],[.85,330,520],[.8,330,520],[.75,330,520],[.7,330,520],[.65,330,520],[.6,330,520],[.55,330,520],[.5,330,520],[.45,330,520],[.4,330,520],[.35,330,520],[.3,330,520],[.25,330,520],[.2,330,520],[.15,330,520],[.1,330,520]];
const $=id=>document.getElementById(id), q=n=>document.querySelector('input[name="'+n+'"]:checked');
const els={company:$("company"),area:$("area"),job:$("job"),date:$("studyDate"),notes:$("studyNotes"),rows:$("taskRows"),counter:$("taskCounter"),empty:$("emptyTasks"),editor:$("editorCard"),title:$("editorTitle"),name:$("taskName"),desc:$("taskDescription"),peopleWrap:$("peopleWrap"),people:$("peopleCount"),height:$("height"),distance:$("distance"),fi:$("freqInitial"),fs:$("freqSustained"),fsWrap:$("freqSustainedWrap"),m0:$("initial0Measures"),m90:$("initial90Measures"),m90b:$("initial90Block"),ms:$("sustainedMeasures"),msb:$("sustainedBlock"),women:$("womenResults"),men:$("menResults"),resultTables:$("resultTables"),resultMessage:$("resultMessage"),calc:$("calcContent"),calcDetails:$("calcDetails"),warning:$("methodWarning"),simBanner:$("simBanner"),status:$("status"),simChangesBlock:$("simulationChangesBlock"),simChangesList:$("simulationChangesList"),resultsHeading:$("resultsHeading")};
let study={version:1,company:"",area:"",job:"",date:new Date().toISOString().slice(0,10),notes:"",tasks:[]}, editing=null, simBase=null;
const fmt=n=>Number.isFinite(n)?n.toFixed(2).replace(".",","):"—";
const actionText=a=>a==="push"?"Empujar":"Tirar";
const risk=ir=>!Number.isFinite(ir)?{label:"No calculable",cls:"risk-na"}:ir<.85?{label:"Aceptable",cls:"risk-green"}:ir<=1?{label:"Leve",cls:"risk-yellow"}:{label:"Presente",cls:"risk-red"};
const values=id=>[...document.querySelectorAll("#"+id+" input")].map(x=>Number(x.value)).filter(x=>Number.isFinite(x)&&x.value!=="");
const max=a=>a.length?Math.max(...a):null, avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
function setStatus(t){els.status.textContent=t||"";if(t)setTimeout(()=>{if(els.status.textContent===t)els.status.textContent=""},4500)}
function fillSelect(el,items,formatter=v=>String(v)){el.innerHTML=items.map(v=>'<option value="'+v+'">'+formatter(v)+'</option>').join("")}
function initSelects(){
 fillSelect(els.height,HEIGHTS.map(x=>x[0]),v=>String(v).replace(".",",")+" m");
 fillSelect(els.distance,DIST.map(x=>x[0]),v=>v==="<5"?"< 5 m":v+" m");
 fillSelect(els.fi,FI.map(x=>x[0]),v=>String(v).replace(".",",")+" /min");
 fillSelect(els.fs,FS.map(x=>x[0]),v=>{if(v<.1)return "1 cada "+Math.round(1/v)+" min";return String(Number(v.toFixed(3))).replace(".",",")+" /min"});
 els.height.value="1.15";els.distance.value="30";els.fi.value="1.1";els.fs.value="2.9";
}
function buildMeasures(el){el.innerHTML="";for(let i=1;i<=5;i++){const l=document.createElement("label");l.innerHTML='Medición '+i+'<input type="number" min="0" step="0.1" inputmode="decimal">';el.appendChild(l)}}
function syncStudyFromHeader(){study.company=els.company.value.trim();study.area=els.area.value.trim();study.job=els.job.value.trim();study.date=els.date.value;study.notes=els.notes.value.trim()}
function syncHeader(){els.company.value=study.company||"";els.area.value=study.area||"";els.job.value=study.job||"";els.date.value=study.date||"";els.notes.value=study.notes||""}
function radio(name,val){const e=document.querySelector('input[name="'+name+'"][value="'+val+'"]');if(e)e.checked=true}
function getFB(action,pop,h){const row=HEIGHTS.find(x=>x[0]===h);if(!row)return null;const idx=action==="push"?(pop==="women"?1:2):(pop==="women"?3:4);return Number.isFinite(row[idx])?row[idx]:null}
function getFLS(action,pop,h){if(action==="push")return 600;if(h>1.4)return null;const row=FLS_PULL.find(x=>x[0]===h);return row?(pop==="women"?row[1]:row[2]):null}
function getMFInitial(f){const r=FI.find(x=>Math.abs(x[0]-f)<1e-8);return r?r[1]:null}
function getMDSustained(d,pop){const r=DIST.find(x=>x[0]===d);return r?(pop==="women"?r[1]:r[2]):null}
function getMFSustained(f){const r=FS.find(x=>Math.abs(x[0]-f)<1e-8);return r?r[1]:null}
function correctedForce(v,mode,n){if(!Number.isFinite(v))return null;return mode==="multi"?v/Math.max(2,n)/.85:v}
function calcStandard(t,pop){
 const h=Number(t.height), fb=getFB(t.action,pop,h), fls=getFLS(t.action,pop,h), mf0=getMFInitial(Number(t.freqInitial)), md0=pop==="women"?.23:.3;
 const fbr0=fb!=null&&mf0!=null?fb*(1-md0-mf0):null, fl0=fbr0!=null&&fls!=null?Math.min(fbr0,fls):null;
 const raw0=max(t.initial0||[]), raw90=t.has90?max(t.initial90||[]):null, rawS=avg(t.sustained||[]);
 const f0=correctedForce(raw0,t.mode,t.people), f90=correctedForce(raw90,t.mode,t.people), fs=correctedForce(rawS,t.mode,t.people);
 const d=t.distance==="<5"?"<5":Number(t.distance), mdS=d==="<5"?null:getMDSustained(d,pop), mfS=d==="<5"?null:getMFSustained(Number(t.freqSustained));
 const fbrS=d==="<5"?null:(fb!=null&&mdS!=null&&mfS!=null?fb*(1-mdS-mfS):null), flS=fbrS!=null&&fls!=null?Math.min(fbrS,fls):null;
 const ir0=fl0>0&&f0!=null?f0/fl0:null, ir90=fl0>0&&f90!=null?f90/fl0:null, irS=flS>0&&fs!=null?fs/flS:null;
 return {fb,fls,md0,mf0,fbr0,fl0,mdS,mfS,fbrS,flS,force0:f0,force90:f90,forceS:fs,ir0,ir90,irS,invalid:(fl0!=null&&fl0<=0)||(flS!=null&&flS<=0)};
}
function oneHandLimit(action,pop,f){const repetitive=Number(f)>=.2;if(action==="pull")return pop==="women"?(repetitive?75:110):(repetitive?110:160);return pop==="women"?(repetitive?70:100):(repetitive?100:150)}
function calcOneHand(t,pop){
 const l0=oneHandLimit(t.action,pop,t.freqInitial), ls=oneHandLimit(t.action,pop,t.freqSustained);
 const f0=max(t.initial0||[]),f90=t.has90?max(t.initial90||[]):null,fs=avg(t.sustained||[]);
 return {fb:null,fls:null,fl0:l0,flS:t.distance==="<5"?null:ls,force0:f0,force90:f90,forceS:fs,ir0:f0!=null?f0/l0:null,ir90:f90!=null?f90/l0:null,irS:t.distance==="<5"||fs==null?null:fs/ls,oneHand:true};
}
function calculate(t,pop){return t.mode==="onehand"?calcOneHand(t,pop):calcStandard(t,pop)}
function rowsFor(t,r){
 const word=t.action==="push"?"empuje":"tracción", out=[];
 out.push({label:"Fuerza inicial de "+word+" a 0°",ir:r.ir0});
 if(t.has90)out.push({label:"Fuerza inicial de "+word+" a 90°",ir:r.ir90});
 if(t.distance!=="<5")out.push({label:"Fuerza sostenida de "+word+" ("+t.distance+" m)",ir:r.irS});
 return out;
}
function worst(t,pop){const r=calculate(t,pop);const vals=rowsFor(t,r).map(x=>x.ir).filter(Number.isFinite);return vals.length?Math.max(...vals):null}
function resultTable(t,r){
 const rows=rowsFor(t,r).map(x=>{const k=risk(x.ir);return '<tr><td>'+x.label+'</td><td><strong>'+fmt(x.ir)+'</strong></td><td class="risk-cell '+k.cls+'">'+k.label+'</td></tr>'}).join("");
 return '<table class="result-table"><thead><tr><th>FUERZA</th><th>ÍNDICE DE RIESGO</th><th>NIVEL DE RIESGO</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
function calcBlock(pop,r){return '<div class="subcard"><h3>'+pop+'</h3><div class="calc-grid">'+[
 ["FB",r.fb],["md inicial",r.md0],["mf inicial",r.mf0],["FBr inicial",r.fbr0],["FLS",r.fls],["FL inicial",r.fl0],["md sostenida",r.mdS],["mf sostenida",r.mfS],["FBr sostenida",r.fbrS],["FL sostenida",r.flS]
 ].map(x=>'<div><span>'+x[0]+'</span><strong>'+fmt(x[1])+'</strong></div>').join("")+'</div></div>'}
function formTask(){
 return {id:editing&&editing.id?editing.id:(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()),name:els.name.value.trim(),description:els.desc.value.trim(),action:q("action").value,mode:q("mode").value,people:Number(els.people.value)||2,has90:q("has90").value==="yes",height:Number(els.height.value),distance:els.distance.value==="<5"?"<5":Number(els.distance.value),freqInitial:Number(els.fi.value),freqSustained:Number(els.fs.value),initial0:values("initial0Measures"),initial90:q("has90").value==="yes"?values("initial90Measures"):[],sustained:els.distance.value==="<5"?[]:values("sustainedMeasures")};
}
function displayValue(label,v){
 if(Array.isArray(v))return v.length?v.join(", ")+" N":"Sin mediciones";
 if(label==="Acción")return v==="push"?"Empujar":"Tirar";
 if(label==="Forma de realización")return v==="twohands"?"Una persona · dos manos":v==="onehand"?"Una persona · una mano":"Dos o más personas";
 if(label==="Medición a 90°")return v?"Sí":"No";
 if(label==="Distancia")return v==="<5"?"< 5 m":v+" m";
 if(label==="Altura de agarre")return String(v).replace(".",",")+" m";
 if(label.includes("Frecuencia"))return String(v).replace(".",",")+" /min";
 return String(v??"");
}
function renderSimulationChanges(current){
 if(!els.simChangesBlock||!els.simChangesList)return;
 const active=!!simBase;
 els.simChangesBlock.classList.toggle("hidden",!active);
 if(els.resultsHeading)els.resultsHeading.textContent=active?"7. Resultados":"6. Resultados";
 if(!active)return;
 const defs=[
  ["Nombre de la tarea","name"],["Descripción","description"],["Acción","action"],["Forma de realización","mode"],
  ["Número de personas","people"],["Medición a 90°","has90"],["Altura de agarre","height"],["Distancia","distance"],
  ["Frecuencia inicial","freqInitial"],["Frecuencia sostenida","freqSustained"],
  ["Fuerza inicial a 0°","initial0"],["Fuerza inicial a 90°","initial90"],["Fuerza sostenida","sustained"]
 ];
 const rows=[];
 defs.forEach(([label,key])=>{
   const before=simBase[key],after=current[key];
   const sa=Array.isArray(before)?JSON.stringify(before):String(before??""), sb=Array.isArray(after)?JSON.stringify(after):String(after??"");
   if(sa!==sb)rows.push('<div><strong>'+escapeHtml(label)+'</strong><span>'+escapeHtml(displayValue(label,before))+' → '+escapeHtml(displayValue(label,after))+'</span></div>');
 });
 els.simChangesList.innerHTML=rows.length?rows.join(""):'<div class="placeholder">No se han realizado cambios.</div>';
}
function renderResults(){
 const t=formTask(), rw=calculate(t,"women"), rm=calculate(t,"men"); renderSimulationChanges(t);
 const any=[...rowsFor(t,rw),...rowsFor(t,rm)].some(x=>Number.isFinite(x.ir));
 els.resultMessage.classList.toggle("hidden",any);els.resultTables.classList.toggle("hidden",!any);els.calcDetails.classList.toggle("hidden",!any);
 if(any){els.women.innerHTML=resultTable(t,rw);els.men.innerHTML=resultTable(t,rm);els.calc.innerHTML=t.mode==="onehand"?'<div class="notice">Evaluación con límites específicos para empuje/tracción con una mano.</div>':calcBlock("Mujeres",rw)+calcBlock("Hombres",rm)}
 let warning="";
 if(t.action==="pull"&&t.height>1.4&&t.mode!=="onehand")warning="El método no permite calcular alturas de agarre superiores a 1,40 m para tirar.";
 if((rw.invalid||rm.invalid)&&t.mode!=="onehand")warning+=(warning?" ":"")+"La combinación de distancia/frecuencia genera un límite de fuerza no válido. Revise los datos introducidos.";
 els.warning.textContent=warning;els.warning.classList.toggle("hidden",!warning);
 if(simBase&&any)renderSimulationCompare(t);
}
function compareTable(base,sim,pop){
 const a=calculate(base,pop),b=calculate(sim,pop), ar=rowsFor(base,a),br=rowsFor(sim,b);
 const key=s=>s.includes("90°")?"initial90":s.includes("sostenida")?"sustained":"initial0";
 const all=[...ar,...br].filter((x,i,z)=>z.findIndex(y=>key(y.label)===key(x.label))===i);
 let rows=all.map(x=>{const kx=key(x.label),old=ar.find(y=>key(y.label)===kx),neu=br.find(y=>key(y.label)===kx),ir=neu?neu.ir:null,k=risk(ir);return '<tr><td>'+x.label+'</td><td>'+fmt(old?old.ir:null)+'</td><td><strong>'+fmt(ir)+'</strong></td><td class="risk-cell '+k.cls+'">'+k.label+'</td></tr>'}).join("");
 return '<table class="result-table"><thead><tr><th>Condición</th><th>Estudio</th><th>Simulación</th><th>Nivel simulado</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
function renderSimulationCompare(t){
 els.women.innerHTML='<div class="sim-banner">Comparación estudio / simulación</div>'+compareTable(simBase,t,"women");
 els.men.innerHTML='<div class="sim-banner">Comparación estudio / simulación</div>'+compareTable(simBase,t,"men");
}
function updateVisibility(){
 const multi=q("mode").value==="multi",has90=q("has90").value==="yes",short=els.distance.value==="<5";
 els.peopleWrap.classList.toggle("hidden",!multi);els.m90b.classList.toggle("hidden",!has90);els.msb.classList.toggle("hidden",short);els.fsWrap.classList.toggle("hidden",short);
 renderResults();
}
function setMeasures(id,arr){const inputs=document.querySelectorAll("#"+id+" input");inputs.forEach((x,i)=>x.value=arr&&arr[i]!=null?arr[i]:"")}
function openEditor(task=null,simulate=false){
 editing=task?JSON.parse(JSON.stringify(task)):null;simBase=simulate&&task?JSON.parse(JSON.stringify(task)):null;
 const t=task||{name:"",description:"",action:"push",mode:"twohands",people:2,has90:false,height:1.15,distance:30,freqInitial:1.1,freqSustained:2.9,initial0:[],initial90:[],sustained:[]};
 els.title.textContent=simulate?"Simulación · "+t.name:(task?"Editar tarea":"Nueva tarea");$("saveTaskBtn").textContent=simulate?"Calcular simulación":"Guardar tarea";els.name.value=t.name||"";els.desc.value=t.description||"";radio("action",t.action);radio("mode",t.mode);radio("has90",t.has90?"yes":"no");els.people.value=t.people||2;els.height.value=String(t.height);els.distance.value=String(t.distance);els.fi.value=String(t.freqInitial);els.fs.value=String(t.freqSustained);setMeasures("initial0Measures",t.initial0);setMeasures("initial90Measures",t.initial90);setMeasures("sustainedMeasures",t.sustained);
 els.simBanner.classList.toggle("hidden",!simulate);els.simBanner.textContent=simulate?"SIMULACIÓN: los cambios no modifican la tarea original.":"";els.editor.classList.remove("hidden");updateVisibility();els.editor.scrollIntoView({behavior:"smooth"});
}
function closeEditor(){els.editor.classList.add("hidden");editing=null;simBase=null;$("saveTaskBtn").textContent="Guardar tarea";if(els.simChangesBlock)els.simChangesBlock.classList.add("hidden");if(els.resultsHeading)els.resultsHeading.textContent="6. Resultados"}
function renderTasks(){
 els.rows.innerHTML="";study.tasks.forEach((t,i)=>{const iw=worst(t,"women"),im=worst(t,"men"),kw=risk(iw),km=risk(im),tr=document.createElement("tr");tr.innerHTML='<td>'+(i+1)+'</td><td><strong>'+escapeHtml(t.name)+'</strong></td><td>'+actionText(t.action)+'</td><td class="risk-cell '+kw.cls+'">IR '+fmt(iw)+' · '+kw.label+'</td><td class="risk-cell '+km.cls+'">IR '+fmt(im)+' · '+km.label+'</td><td><div class="task-actions"><button class="et-btn" data-edit="'+t.id+'">Editar</button><button class="et-btn" data-sim="'+t.id+'">Simular</button><button class="et-btn" data-dup="'+t.id+'">Duplicar</button><button class="et-btn danger" data-del="'+t.id+'">Eliminar</button></div></td>';els.rows.appendChild(tr)});
 els.counter.textContent="Tareas del puesto: "+study.tasks.length+" / 50";els.empty.classList.toggle("hidden",study.tasks.length>0);$("addTaskBtn").disabled=study.tasks.length>=50;
}
function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function saveTask(){
 const t=formTask();if(!t.name){alert("Indique un nombre para la tarea.");els.name.focus();return}
 if(!t.initial0.length){alert("Introduzca al menos una medición de fuerza inicial a 0°.");return}
 if(t.has90&&!t.initial90.length){alert("La tarea indica que aplica 90°. Introduzca al menos una medición a 90°.");return}
 if(t.distance!=="<5"&&!t.sustained.length){alert("Para distancias de 5 m o más introduzca al menos una medición de fuerza sostenida.");return}
 if(simBase){setStatus("Simulación calculada. La tarea original no se ha modificado.");return}
 const idx=study.tasks.findIndex(x=>x.id===t.id);if(idx>=0)study.tasks[idx]=t;else{if(study.tasks.length>=50)return;study.tasks.push(t)}renderTasks();closeEditor();setStatus("Tarea guardada.");
}
function download(){
 syncStudyFromHeader();const blob=new Blob([JSON.stringify(study,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=((study.company||"estudio")+"_"+(study.job||"puesto")).replace(/[^a-z0-9áéíóúñ_-]+/gi,"_")+"_empuje_traccion.json";a.click();URL.revokeObjectURL(a.href);setStatus("Estudio guardado.");
}
function load(file){const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.tasks))throw 0;study=d;study.tasks=study.tasks.slice(0,50);syncHeader();renderTasks();closeEditor();setStatus("Estudio cargado.")}catch(e){alert("El archivo no contiene un estudio válido de Empuje y Tracción.")}};r.readAsText(file)}
function newStudy(){if(study.tasks.length&&!confirm("¿Crear un estudio nuevo? Se perderán los cambios no guardados."))return;study={version:1,company:"",area:"",job:"",date:new Date().toISOString().slice(0,10),notes:"",tasks:[]};syncHeader();renderTasks();closeEditor();setStatus("Nuevo estudio preparado.")}
function copyTaskResults(){
 const t=formTask(),rw=calculate(t,"women"),rm=calculate(t,"men");
 const make=(title,r)=>{const rows=rowsFor(t,r).map(x=>{const k=risk(x.ir),bg=k.cls==="risk-green"?"#c6efce":k.cls==="risk-yellow"?"#fff2cc":k.cls==="risk-red"?"#ea9999":"#edf2f7";return '<tr><td style="border:1px solid #759CBF;padding:6px">'+x.label+'</td><td style="border:1px solid #759CBF;padding:6px;text-align:center"><b>'+fmt(x.ir)+'</b></td><td style="border:1px solid #759CBF;padding:6px;text-align:center;background:'+bg+'">&nbsp;</td></tr>'}).join("");return '<h3>'+title+'</h3><table style="border-collapse:collapse;width:100%"><tr><th style="border:1px solid #759CBF;padding:6px">FUERZA</th><th style="border:1px solid #759CBF;padding:6px">ÍNDICE DE RIESGO</th><th style="border:1px solid #759CBF;padding:6px">NIVEL DE RIESGO</th></tr>'+rows+'</table>'};
 const html='<div style="font-family:Arial;font-size:10pt">'+make("MUJERES",rw)+'<br>'+make("HOMBRES",rm)+'</div>';
 if(![...rowsFor(t,rw),...rowsFor(t,rm)].some(x=>Number.isFinite(x.ir))){alert("No hay resultados calculados para copiar.");return}
 const item=new ClipboardItem({"text/html":new Blob([html],{type:"text/html"}),"text/plain":new Blob([document.createRange().createContextualFragment(html).textContent],{type:"text/plain"})});navigator.clipboard.write([item]).then(()=>setStatus("Resultados de la tarea copiados. Puede pegarlos en Word.")).catch(()=>alert("No se pudo copiar automáticamente."));
}
function copySummary(){
 syncStudyFromHeader();if(!study.tasks.length){alert("No hay tareas para copiar.");return}
 const rows=study.tasks.map((t,i)=>{const w=worst(t,"women"),m=worst(t,"men"),kw=risk(w),km=risk(m);const bg=k=>k.cls==="risk-green"?"#c6efce":k.cls==="risk-yellow"?"#fff2cc":k.cls==="risk-red"?"#ea9999":"#edf2f7";return '<tr><td>'+(i+1)+'</td><td>'+escapeHtml(t.name)+'</td><td>'+actionText(t.action)+'</td><td style="background:'+bg(kw)+'"><b>IR '+fmt(w)+' · '+kw.label+'</b></td><td style="background:'+bg(km)+'"><b>IR '+fmt(m)+' · '+km.label+'</b></td></tr>'}).join("");
 const body=rows.replace(/<td( style="background:([^"]+)")?>/g,(m,a,b)=>'<td style="border:1px solid #759CBF;padding:6px;'+(b?'background:'+b+';':'')+'">');
 const html='<div style="font-family:Arial;font-size:10pt"><table style="border-collapse:collapse;width:100%"><tr><th style="border:1px solid #759CBF;padding:6px">Nº</th><th style="border:1px solid #759CBF;padding:6px">Tarea</th><th style="border:1px solid #759CBF;padding:6px">Acción</th><th style="border:1px solid #759CBF;padding:6px">Mujeres</th><th style="border:1px solid #759CBF;padding:6px">Hombres</th></tr>'+body.replace(/IR ([^·<]+) · [^<]+/g,'IR $1')+'</table></div>';
 const item=new ClipboardItem({"text/html":new Blob([html],{type:"text/html"}),"text/plain":new Blob([document.createRange().createContextualFragment(html).textContent],{type:"text/plain"})});navigator.clipboard.write([item]).then(()=>setStatus("Resumen copiado. Puede pegarlo en Word.")).catch(()=>alert("No se pudo copiar automáticamente."));
}
function bind(){
 ["company","area","job","studyDate","studyNotes"].forEach(id=>$(id).addEventListener("input",syncStudyFromHeader));
 document.querySelectorAll('input[name="mode"],input[name="has90"],input[name="action"]').forEach(x=>x.addEventListener("change",updateVisibility));
 [els.height,els.distance,els.fi,els.fs,els.people].forEach(x=>x.addEventListener("change",updateVisibility));
 document.querySelectorAll("#initial0Measures input,#initial90Measures input,#sustainedMeasures input").forEach(x=>x.addEventListener("input",renderResults));
 $("addTaskBtn").onclick=()=>openEditor();$("closeEditorBtn").onclick=closeEditor;$("cancelTaskBtn").onclick=closeEditor;$("saveTaskBtn").onclick=saveTask;$("copyTaskBtn").onclick=copyTaskResults;$("saveStudyBtn").onclick=download;$("newStudyBtn").onclick=newStudy;$("copySummaryBtn").onclick=copySummary;
 $("loadStudyInput").onchange=e=>{if(e.target.files[0])load(e.target.files[0]);e.target.value=""};
 els.rows.onclick=e=>{const b=e.target.closest("button");if(!b)return;const id=b.dataset.edit||b.dataset.sim||b.dataset.dup||b.dataset.del,t=study.tasks.find(x=>x.id===id);if(!t)return;if(b.dataset.edit)openEditor(t);else if(b.dataset.sim)openEditor(t,true);else if(b.dataset.dup){if(study.tasks.length>=50)return;const c=JSON.parse(JSON.stringify(t));c.id=crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random();c.name=t.name+" (copia)";study.tasks.push(c);renderTasks()}else if(b.dataset.del&&confirm("¿Eliminar la tarea '"+t.name+"'?")){study.tasks=study.tasks.filter(x=>x.id!==id);renderTasks()}};
}
initSelects();buildMeasures(els.m0);buildMeasures(els.m90);buildMeasures(els.ms);study.date=new Date().toISOString().slice(0,10);syncHeader();bind();renderTasks();
})();