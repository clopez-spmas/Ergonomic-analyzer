"use strict";
(()=>{
const $=id=>document.getElementById(id);
const screens=[...document.querySelectorAll(".screen:not(.standalone)")];
let dirty=false;
let study={version:2,identification:{},samples:[],criteria:{},results:null,simulation:null};

const CRITERIA=[
 {id:"trunkFlex",section:"Tronco",label:"Flexión / extensión de tronco"},
 {id:"trunkLat",section:"Tronco",label:"Inclinación lateral de tronco"},
 {id:"trunkRot",section:"Tronco",label:"Rotación axial de tronco"},
 {id:"lumbarConvex",section:"Tronco",label:"Postura convexa lumbar sentado",manualOnly:true},
 {id:"headLat",section:"Cabeza/cuello",label:"Lateralización de cabeza"},
 {id:"headRot",section:"Cabeza/cuello",label:"Rotación axial de cabeza"},
 {id:"headFlex",section:"Cabeza/cuello",label:"Flexión / extensión de cabeza-cuello"},
 {id:"kneeR",section:"Rodilla derecha",label:"Flexión de rodilla derecha"},
 {id:"kneeL",section:"Rodilla izquierda",label:"Flexión de rodilla izquierda"},
 {id:"ankleR",section:"Tobillo derecho",label:"Dorsiflexión / flexión plantar tobillo derecho"},
 {id:"ankleL",section:"Tobillo izquierdo",label:"Dorsiflexión / flexión plantar tobillo izquierdo"}
];

function initCriterion(c){
 if(study.criteria[c.id])return;
 study.criteria[c.id]={source:"manual",angle:0,staticSeconds:0,dynamicMovements:0,criticalPercent:0,trunkSupport:false,headSupport:false,posture:"standing",ischialSupport:false,trunkBackInclined:false,lumbarConvex:false,plantarAngle:0,dorsiflexAngle:0,durationLimitMinutes:0,neckFlex:0};
}
CRITERIA.forEach(initCriterion);

const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const fmt=(v,d=2)=>num(v).toLocaleString("es-ES",{minimumFractionDigits:d,maximumFractionDigits:d});
const status=t=>$("status").textContent=t;
function notice(t){$("appDialogText").textContent=t;$("appDialog").showModal()}
$("appDialogOk").onclick=()=>$("appDialog").close();

function syncIdentification(){
 ["company","department","workstation","task","studyDate","taskDuration","description"].forEach(id=>study.identification[id]=$(id)?.value||"");
 dirty=true;
}
function restoreIdentification(){
 ["company","department","workstation","task","studyDate","taskDuration","description"].forEach(id=>{if($(id))$(id).value=study.identification[id]||""});
 if(!$("studyDate").value)$("studyDate").value=new Date().toISOString().slice(0,10);
}
const taskMinutes=()=>Math.max(.0001,num(study.identification.taskDuration||$("taskDuration")?.value,1));
const frequency=c=>num(c.dynamicMovements)/taskMinutes();
const staticActive=c=>num(c.staticSeconds)>4;
const pct=c=>Math.max(0,Math.min(100,num(c.criticalPercent)));
const riskLabel=no=>no?"No aceptable":"Aceptable";
const result=(no,detail,intermediate={})=>({risk:riskLabel(no),no,detail,intermediate});

function evalStatic(id,c){
 const a=num(c.angle),abs=Math.abs(a);
 if(id==="lumbarConvex")return result(!!c.lumbarConvex,c.lumbarConvex?"Existe postura convexa lumbar en posición sentada.":"No existe postura convexa lumbar.",{});
 if(!staticActive(c))return result(false,"No se identifica una postura mantenida durante más de 4 s.",{angle:a,staticSeconds:num(c.staticSeconds)});
 if(id==="trunkFlex"){
  if(a>60)return result(true,"Flexión de tronco >60°.",{angle:a,staticSeconds:num(c.staticSeconds)});
  if(a>=20&&a<=60){
   if(c.trunkSupport)return result(false,"Flexión 20°-60° con soporte completo del tronco.",{angle:a,staticSeconds:num(c.staticSeconds)});
   if(num(c.durationLimitMinutes)>0){
    const no=num(c.staticSeconds)/60>num(c.durationLimitMinutes);
    return result(no,"Flexión 20°-60° sin soporte completo. Comparación con duración máxima aceptable indicada.",{angle:a,staticSeconds:num(c.staticSeconds),durationLimitMinutes:num(c.durationLimitMinutes)});
   }
   return result(false,"Flexión 20°-60° sin soporte: requiere contraste con duración máxima aceptable.",{angle:a,staticSeconds:num(c.staticSeconds)});
  }
  if(a<0)return result(!c.trunkSupport,"Extensión de tronco "+(c.trunkSupport?"con":"sin")+" soporte completo.",{angle:a,staticSeconds:num(c.staticSeconds)});
  return result(false,"Flexión de tronco entre 0° y 20°.",{angle:a,staticSeconds:num(c.staticSeconds)});
 }
 if(id==="trunkLat"||id==="trunkRot")return result(abs>10,(id==="trunkLat"?"Inclinación lateral":"Rotación axial")+" "+fmt(a,1)+"°.",{angle:a,staticSeconds:num(c.staticSeconds)});
 if(id==="headLat")return result(abs>10,"Lateralización de cabeza "+fmt(a,1)+"°.",{angle:a,staticSeconds:num(c.staticSeconds)});
 if(id==="headRot")return result(abs>45,"Rotación axial de cabeza "+fmt(a,1)+"°.",{angle:a,staticSeconds:num(c.staticSeconds)});
 if(id==="headFlex"){
  if(a>85)return result(true,"Inclinación de cabeza >85°.",{angle:a,staticSeconds:num(c.staticSeconds)});
  if(a<0)return result(!c.headSupport,"Extensión de cabeza "+(c.headSupport?"con":"sin")+" soporte completo de cabeza.",{angle:a,staticSeconds:num(c.staticSeconds)});
  if(a<=25)return result(false,"Inclinación de cabeza entre 0° y 25°.",{angle:a,staticSeconds:num(c.staticSeconds)});
  if(c.trunkSupport)return result(false,"Inclinación de cabeza entre 25° y 85° con soporte completo del tronco.",{angle:a,staticSeconds:num(c.staticSeconds)});
  return result(num(c.neckFlex)>25||num(c.neckFlex)<0,"Inclinación 25°-85° sin soporte completo del tronco. Se valora la flexo-extensión de cuello.",{angle:a,neckFlex:num(c.neckFlex),staticSeconds:num(c.staticSeconds)});
 }
 if(id.startsWith("knee")){
  const k=a;
  if(c.posture==="seated"){
   if(k<90)return result(true,"Rodilla sentada <90°.",{angle:k});
   if(k>135)return result(!c.trunkBackInclined,"Rodilla sentada >135°; sólo aceptable con tronco posteriormente inclinado.",{angle:k});
   return result(false,"Rodilla sentada 90°-135°.",{angle:k});
  }
  if(c.ischialSupport)return result(false,"De pie con apoyo isquiotibial.",{angle:k});
  return result(k>=135,"Rodilla de pie en/próxima al límite articular.",{angle:k});
 }
 if(id.startsWith("ankle")){
  const d=num(c.dorsiflexAngle),p=num(c.plantarAngle);
  return result(d>=20||p>=50,"Dorsiflexión "+fmt(d,1)+"° · flexión plantar "+fmt(p,1)+"°.",{dorsiflex:d,plantar:p});
 }
 return result(false,"Aceptable.",{});
}

function evalDynamic(id,c){
 const a=num(c.angle),abs=Math.abs(a),f=frequency(c),p=pct(c);
 if(id==="lumbarConvex")return result(false,"No aplica como criterio dinámico.",{});
 if(id==="trunkFlex"){
  if(a>=1&&a<=20)return result(false,"Flexión de tronco 1°-20°.",{angle:a,frequency:f});
  if(a>=21&&a<=60)return result(f>=2,"Flexión 21°-60° · frecuencia "+fmt(f)+" mov/min.",{angle:a,frequency:f});
  if((a>=61&&a<=90)||a<=0)return result(f>=2||!c.trunkSupport,(a<=0?"Extensión":"Flexión 61°-90°")+" · "+fmt(f)+" mov/min · "+(c.trunkSupport?"con":"sin")+" soporte.",{angle:a,frequency:f});
  return result(false,"Sin condición dinámica crítica.",{angle:a,frequency:f});
 }
 if(id==="trunkLat"||id==="trunkRot"||id==="headLat"||id==="headRot"){
  const limit=id==="headRot"?45:10;
  if(abs<=limit)return result(false,"Dentro del rango angular aceptable.",{angle:a,frequency:f,criticalPercent:p});
  return result(f>=2||(f<2&&p>60),"Fuera del rango · "+fmt(f)+" mov/min · "+fmt(p,1)+"% del tiempo de la tarea.",{angle:a,frequency:f,criticalPercent:p});
 }
 if(id==="headFlex"){
  if(a>=-40&&a<=0)return result(false,"Flexo-extensión dinámica de cabeza/cuello entre -40° y 0°.",{angle:a,frequency:f,criticalPercent:p});
  return result(f>=2||(f<2&&p>60),"Fuera del rango -40° a 0° · "+fmt(f)+" mov/min · "+fmt(p,1)+"% del tiempo.",{angle:a,frequency:f,criticalPercent:p});
 }
 if(id.startsWith("knee")){
  const limit=c.posture==="seated"?40:135;
  return result(a>=limit&&f>=2,"Ángulo "+fmt(a,1)+"° · "+fmt(f)+" mov/min.",{angle:a,frequency:f,limit});
 }
 if(id.startsWith("ankle")){
  const d=num(c.dorsiflexAngle),pl=num(c.plantarAngle);
  return result((d>=20||pl>=50)&&f>=2,"Dorsiflexión "+fmt(d,1)+"° · plantar "+fmt(pl,1)+"° · "+fmt(f)+" mov/min.",{dorsiflex:d,plantar:pl,frequency:f});
 }
 return result(false,"Aceptable.",{frequency:f});
}

function calculate(){
 syncIdentification();
 const detail={};
 CRITERIA.forEach(def=>{const c=study.criteria[def.id];detail[def.id]={static:evalStatic(def.id,c),dynamic:evalDynamic(def.id,c)}});
 const sections={};
 CRITERIA.forEach(def=>{const r=detail[def.id];if(!sections[def.section])sections[def.section]={static:false,dynamic:false};sections[def.section].static||=r.static.no;sections[def.section].dynamic||=r.dynamic.no});
 study.results={detail,sections,calculatedAt:new Date().toISOString()};renderResults();dirty=true;return study.results;
}

function sourceOptions(c){return '<select data-field="source"><option value="manual" '+(c.source==="manual"?"selected":"")+'>Manual</option><option value="kinovea" '+(c.source==="kinovea"?"selected":"")+'>Kinovea</option></select>'}
function criterionCard(def){
 const c=study.criteria[def.id];let html='<article class="criterion-card" data-criterion="'+def.id+'"><div class="criterion-head"><h3>'+def.label+'</h3><label>Fuente '+(def.manualOnly?'<strong>Manual</strong>':sourceOptions(c))+'</label></div>';
 html+='<div class="dual-result-head"><span>ESTÁTICAS</span><span>DINÁMICAS</span></div><div class="analysis-grid">';
 if(def.id!=="lumbarConvex"&&!def.id.startsWith("ankle"))html+='<label>Ángulo representativo (°)<input data-field="angle" type="number" step="0.1" value="'+c.angle+'"></label>';
 html+='<label>Tiempo mantenido acumulado (s)<input data-field="staticSeconds" type="number" min="0" step="0.1" value="'+c.staticSeconds+'"></label><label>N.º movimientos dinámicos<input data-field="dynamicMovements" type="number" min="0" step="1" value="'+c.dynamicMovements+'"></label><label>% tiempo en postura crítica<input data-field="criticalPercent" type="number" min="0" max="100" step="0.1" value="'+c.criticalPercent+'"></label>';
 if(["trunkFlex","headFlex"].includes(def.id))html+='<label class="check-row"><input data-field="trunkSupport" type="checkbox" '+(c.trunkSupport?"checked":"")+'> Soporte completo del tronco</label>';
 if(def.id==="headFlex")html+='<label class="check-row"><input data-field="headSupport" type="checkbox" '+(c.headSupport?"checked":"")+'> Soporte completo de cabeza</label><label>Flexo-extensión de cuello β-α (°)<input data-field="neckFlex" type="number" step="0.1" value="'+c.neckFlex+'"></label>';
 if(def.id==="trunkFlex")html+='<label>Duración máxima aceptable del gráfico (min)<input data-field="durationLimitMinutes" type="number" min="0" step="0.01" value="'+c.durationLimitMinutes+'"><small>Campo provisional mientras integramos la curva exacta del manual.</small></label>';
 if(def.id==="lumbarConvex")html+='<label class="check-row"><input data-field="lumbarConvex" type="checkbox" '+(c.lumbarConvex?"checked":"")+'> Existe postura convexa lumbar</label>';
 if(def.id.startsWith("knee"))html+='<label>Postura<select data-field="posture"><option value="standing" '+(c.posture==="standing"?"selected":"")+'>De pie</option><option value="seated" '+(c.posture==="seated"?"selected":"")+'>Sentado</option><option value="squat" '+(c.posture==="squat"?"selected":"")+'>Cuclillas</option></select></label><label class="check-row"><input data-field="ischialSupport" type="checkbox" '+(c.ischialSupport?"checked":"")+'> Apoyo isquiotibial</label><label class="check-row"><input data-field="trunkBackInclined" type="checkbox" '+(c.trunkBackInclined?"checked":"")+'> Tronco posteriormente inclinado</label>';
 if(def.id.startsWith("ankle"))html+='<label>Dorsiflexión (°)<input data-field="dorsiflexAngle" type="number" min="0" step="0.1" value="'+c.dorsiflexAngle+'"></label><label>Flexión plantar (°)<input data-field="plantarAngle" type="number" min="0" step="0.1" value="'+c.plantarAngle+'"></label>';
 html+='</div><div class="criterion-output" data-output></div></article>';return html;
}
function renderCriteria(){
 $("trunkHost").innerHTML=CRITERIA.filter(x=>x.section==="Tronco").map(criterionCard).join("");
 $("headHost").innerHTML=CRITERIA.filter(x=>x.section==="Cabeza/cuello").map(criterionCard).join("");
 $("lowerHost").innerHTML=CRITERIA.filter(x=>/Rodilla|Tobillo/.test(x.section)).map(criterionCard).join("");
 bindCriterionInputs();renderCriterionOutputs();
}
function bindCriterionInputs(){document.querySelectorAll("[data-criterion]").forEach(card=>{const c=study.criteria[card.dataset.criterion];card.querySelectorAll("[data-field]").forEach(el=>{el.onchange=el.oninput=()=>{c[el.dataset.field]=el.type==="checkbox"?el.checked:el.value;dirty=true;renderCriterionOutputs()}})})}
function renderCriterionOutputs(){document.querySelectorAll("[data-criterion]").forEach(card=>{const id=card.dataset.criterion,c=study.criteria[id],s=evalStatic(id,c),d=evalDynamic(id,c);card.querySelector("[data-output]").innerHTML='<div class="result-pair"><div class="'+(s.no?"risk-no":"risk-ok")+'"><strong>ESTÁTICA · '+s.risk+'</strong><span>'+esc(s.detail)+'</span></div><div class="'+(d.no?"risk-no":"risk-ok")+'"><strong>DINÁMICA · '+d.risk+'</strong><span>'+esc(d.detail)+'</span></div></div>'})}

function renderResults(){
 const r=study.results||calculate();let html='<div class="result-table-wrap"><table class="result-table"><thead><tr><th>Sección corporal</th><th>Estática</th><th>Dinámica</th></tr></thead><tbody>';
 Object.entries(r.sections).forEach(([s,v])=>html+='<tr><td>'+esc(s)+'</td><td class="'+(v.static?"risk-no":"risk-ok")+'">'+riskLabel(v.static)+'</td><td class="'+(v.dynamic?"risk-no":"risk-ok")+'">'+riskLabel(v.dynamic)+'</td></tr>');
 html+='</tbody></table></div><div class="detail-grid">';
 CRITERIA.forEach(def=>{const x=r.detail[def.id];html+='<article class="detail-card"><h3>'+def.label+'</h3><p><strong>Estática:</strong> '+x.static.risk+' · '+esc(x.static.detail)+'</p><p><strong>Dinámica:</strong> '+x.dynamic.risk+' · '+esc(x.dynamic.detail)+'</p></article>'});
 $("resultsHost").innerHTML=html+'</div>';
}

async function parseSampleJson(file){
 const raw=JSON.parse(await file.text()),series=Array.isArray(raw?.data?.timeseries)?raw.data.timeseries:[],markers=[...new Set(series.map(s=>String(s.name||"").trim()).filter(Boolean))],frameCount=Math.max(0,...series.map(s=>Array.isArray(s.time)?s.time.length:0)),frames=[];
 for(let i=0;i<frameCount;i++){let time=null;const landmarks={};series.forEach(s=>{const name=String(s.name||"").trim();if(!name)return;if(time===null&&Array.isArray(s.time))time=num(s.time[i],0);let p=s.data?.["0"]?.[i];if(!p&&Array.isArray(s.x)&&Array.isArray(s.y))p=[s.x[i],s.y[i]];landmarks[name]=Array.isArray(p)&&p.length>=2?{x:num(p[0]),y:num(p[1])}:null});frames.push({time:time??0,landmarks})}
 return {producer:String(raw?.metadata?.producer||""),fps:num(raw?.metadata?.captureFramerate||raw?.metadata?.userFramerate),markers,frames,duration:frames.at(-1)?.time||0};
}
function renderSamples(){
 const h=$("samplesHost");if(!study.samples.length){h.innerHTML='<div class="placeholder">No hay muestras cargadas. Puede realizar toda la evaluación manualmente.</div>';return}
 h.innerHTML=study.samples.map((s,i)=>'<article class="sample-card"><div><strong>Muestra '+(i+1)+' · '+esc(s.view)+'</strong><span>'+esc(s.videoName||"Sin vídeo")+' · '+esc(s.jsonName||"Sin JSON")+'</span><small>'+esc(s.range.mode)+' · '+fmt(s.data?.duration||0,3)+' s · '+(s.data?.markers?.length||0)+' marcadores</small></div><button class="toolbar-btn" data-remove-sample="'+i+'">Eliminar</button><details><summary>Asignación de marcadores</summary><div class="mapping-grid">'+["head","neck","neck_base","pelvis","right_hip","left_hip","right_knee","left_knee","right_ankle","left_ankle","right_foot","left_foot"].map(k=>'<label>'+k+'<select data-map-sample="'+i+'" data-map-key="'+k+'"><option value="">— no asignado —</option>'+(s.data?.markers||[]).map(m=>'<option '+(s.mapping?.[k]===m?"selected":"")+'>'+esc(m)+'</option>').join("")+'</select></label>').join("")+'</div></details></article>').join("");
 h.querySelectorAll("[data-remove-sample]").forEach(b=>b.onclick=()=>{study.samples.splice(num(b.dataset.removeSample),1);dirty=true;renderSamples()});
 h.querySelectorAll("[data-map-sample]").forEach(sel=>sel.onchange=()=>{const s=study.samples[num(sel.dataset.mapSample)];s.mapping=s.mapping||{};s.mapping[sel.dataset.mapKey]=sel.value;dirty=true});
}
$("addSampleButton").onclick=()=>{$("sampleForm").reset();$("sampleDialog").showModal()};
$("saveSampleButton").onclick=async()=>{
 const jf=$("sampleJson").files[0],vf=$("sampleVideo").files[0];let data=null;
 if(jf){try{data=await parseSampleJson(jf)}catch(e){notice("No se pudo leer el JSON de Kinovea.");return}}
 study.samples.push({id:crypto.randomUUID?.()||String(Date.now()),view:$("sampleView").value,videoName:vf?.name||"",jsonName:jf?.name||"",range:{mode:$("sampleRangeMode").value,start:num($("sampleStart").value),end:num($("sampleEnd").value),cycles:Math.max(1,num($("sampleCycles").value,1))},data,mapping:{}});
 dirty=true;$("sampleDialog").close();renderSamples();status("Muestra añadida.");
};

function simClone(o){return JSON.parse(JSON.stringify(o))}
function openSimulation(){study.simulation=study.simulation||{baseline:simClone(study.criteria),current:simClone(study.criteria)};renderSimulation();screens.forEach(s=>s.classList.remove("active"));$("simulationScreen").classList.remove("hidden")}
function renderSimulation(){
 const cur=study.simulation.current;
 $("simulationHost").innerHTML=CRITERIA.map(def=>{const c=cur[def.id],base=study.simulation.baseline[def.id];return '<article class="criterion-card" data-sim="'+def.id+'"><h3>'+def.label+'</h3><div class="analysis-grid"><label>Ángulo (°)<input data-sim-field="angle" type="number" step="0.1" value="'+num(c.angle)+'"></label><label>Tiempo estático (s)<input data-sim-field="staticSeconds" type="number" step="0.1" value="'+num(c.staticSeconds)+'"></label><label>Movimientos<input data-sim-field="dynamicMovements" type="number" step="1" value="'+num(c.dynamicMovements)+'"></label><label>% postura crítica<input data-sim-field="criticalPercent" type="number" step="0.1" value="'+num(c.criticalPercent)+'"></label></div><div class="sim-change">Original: ángulo '+fmt(base.angle,1)+'° · '+fmt(base.staticSeconds,1)+' s · '+fmt(base.dynamicMovements,0)+' mov · '+fmt(base.criticalPercent,1)+'%</div><div data-sim-output></div></article>'}).join("");
 $("simulationHost").querySelectorAll("[data-sim]").forEach(card=>{const id=card.dataset.sim,c=cur[id];card.querySelectorAll("[data-sim-field]").forEach(el=>el.oninput=()=>{c[el.dataset.simField]=el.value;renderSimOutput(card,id,c)});renderSimOutput(card,id,c)});
}
function renderSimOutput(card,id,c){const s=evalStatic(id,c),d=evalDynamic(id,c);card.querySelector("[data-sim-output]").innerHTML='<div class="result-pair"><div class="'+(s.no?"risk-no":"risk-ok")+'">ESTÁTICA · '+s.risk+'</div><div class="'+(d.no?"risk-no":"risk-ok")+'">DINÁMICA · '+d.risk+'</div></div>'}
$("simulationButton").onclick=openSimulation;
$("closeSimulationButton").onclick=()=>{$("simulationScreen").classList.add("hidden");showScreen(5)};
$("saveSimulationButton").onclick=()=>{dirty=true;status("Simulación guardada en el estudio.");$("simulationScreen").classList.add("hidden");showScreen(5)};

function reportTable(title,head,rows){return '<section class="report-copy-block"><div class="report-copy-head"><h3>'+title+'</h3><button class="toolbar-btn copy-report">Copiar tabla</button></div><div class="report-copy-content"><table class="result-table"><thead><tr>'+head.map(x=>'<th>'+x+'</th>').join("")+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join("")+'</tr>').join("")+'</tbody></table></div></section>'}
function renderWordTables(){
 const selected=[...document.querySelectorAll("[data-report]:checked")].map(x=>x.dataset.report),r=study.results||calculate();let out=[];
 if(selected.includes("summary"))out.push(reportTable("Resumen estática / dinámica",["Sección corporal","Estática","Dinámica"],Object.entries(r.sections).map(([s,v])=>[esc(s),riskLabel(v.static),riskLabel(v.dynamic)])));
 if(selected.includes("detail"))out.push(reportTable("Resultados detallados",["Criterio","Estática","Dinámica"],CRITERIA.map(d=>[d.label,r.detail[d.id].static.risk+" · "+esc(r.detail[d.id].static.detail),r.detail[d.id].dynamic.risk+" · "+esc(r.detail[d.id].dynamic.detail)])));
 if(selected.includes("intermediate"))out.push(reportTable("Cálculos intermedios",["Criterio","Ángulo","Tiempo estático","Movimientos","Frecuencia","% postura crítica"],CRITERIA.map(d=>{const c=study.criteria[d.id];return[d.label,fmt(c.angle,1)+"°",fmt(c.staticSeconds,1)+" s",fmt(c.dynamicMovements,0),fmt(frequency(c))+" mov/min",fmt(c.criticalPercent,1)+"%"]})));
 if(selected.includes("simulation")&&study.simulation)out.push(reportTable("Comparativa simulación",["Criterio","Variable","Estudio","Simulación"],CRITERIA.flatMap(d=>["angle","staticSeconds","dynamicMovements","criticalPercent"].map(k=>[d.label,k,study.simulation.baseline[d.id][k]??"",study.simulation.current[d.id][k]??""]))));
 $("wordTablesHost").innerHTML=out.join("")||'<div class="placeholder">Seleccione al menos una tabla.</div>';
 $("wordTablesHost").querySelectorAll(".copy-report").forEach(b=>b.onclick=()=>copyBlock(b));
}
function copyBlock(b){const block=b.closest(".report-copy-block").querySelector(".report-copy-content"),holder=document.createElement("div");holder.contentEditable="true";holder.style.position="fixed";holder.style.left="-9999px";holder.innerHTML='<div style="font-family:Arial;font-size:10pt">'+block.innerHTML+'</div>';document.body.appendChild(holder);const range=document.createRange();range.selectNodeContents(holder);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);document.execCommand("copy");sel.removeAllRanges();holder.remove();status("Tabla copiada.")}
$("wordTablesButton").onclick=()=>{screens.forEach(s=>s.classList.remove("active"));$("wordTablesScreen").classList.remove("hidden");renderWordTables()};
$("generateReportButton").onclick=renderWordTables;
$("closeWordTablesButton").onclick=()=>{$("wordTablesScreen").classList.add("hidden");showScreen(5)};

async function saveStudy(){
 syncIdentification();study.results=calculate();
 const json=JSON.stringify(study,null,2),name=((study.identification.company||"estudio")+"_"+(study.identification.task||"posturas")).replace(/[^a-z0-9_-]+/gi,"_")+"_posturas_forzadas.json";
 try{
  if(window.showSaveFilePicker){const h=await showSaveFilePicker({suggestedName:name,types:[{description:"Estudio Posturas Forzadas",accept:{"application/json":[".json"]}}]});const w=await h.createWritable();await w.write(json);await w.close()}
  else{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([json],{type:"application/json"}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
  dirty=false;status("Estudio guardado.");
 }catch(e){if(e?.name!=="AbortError")notice("No se pudo guardar el estudio.")}
}
async function loadStudy(file){try{const o=JSON.parse(await file.text());study=o;study.criteria=study.criteria||{};CRITERIA.forEach(initCriterion);restoreIdentification();renderSamples();renderCriteria();study.results&&renderResults();dirty=false;status("Estudio cargado.")}catch(e){notice("El archivo no contiene un estudio válido.")}}
function newStudy(){study={version:2,identification:{},samples:[],criteria:{},results:null,simulation:null};CRITERIA.forEach(initCriterion);restoreIdentification();renderSamples();renderCriteria();$("resultsHost").innerHTML="";dirty=false;showScreen(0);status("Nuevo estudio.")}
$("saveStudyButton").onclick=saveStudy;$("loadStudyButton").onclick=()=>$("studyFileInput").click();$("studyFileInput").onchange=e=>{if(e.target.files[0])loadStudy(e.target.files[0]);e.target.value=""};$("newStudyButton").onclick=newStudy;
$("homeButton").onclick=()=>location.href="../";$("recalculateButton").onclick=calculate;

function showScreen(i){screens.forEach((s,n)=>s.classList.toggle("active",n===i));window.scrollTo({top:0,behavior:"smooth"});if(i===5)calculate()}
document.querySelectorAll("[data-next]").forEach(b=>b.onclick=()=>showScreen(Math.min(5,screens.findIndex(s=>s.classList.contains("active"))+1)));
document.querySelectorAll("[data-prev]").forEach(b=>b.onclick=()=>showScreen(Math.max(0,screens.findIndex(s=>s.classList.contains("active"))-1)));
["company","department","workstation","task","studyDate","taskDuration","description"].forEach(id=>$(id)?.addEventListener("input",syncIdentification));
document.querySelectorAll("[data-report]").forEach(x=>x.onchange=renderWordTables);
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=true}});
restoreIdentification();renderSamples();renderCriteria();dirty=false;
})();