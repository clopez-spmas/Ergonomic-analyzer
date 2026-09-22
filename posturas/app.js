"use strict";
(function(){
const state={screen:0,kinovea:null,jsonFileName:"",videoUrl:null,mapping:{},identification:{},analysisRange:{mode:"all",start:0,end:0,cycles:1},shoulderAnalysis:{side:"right",direction:"right",start:0,end:0},elbowAnalysis:{view:"profile-right",side:"right",direction:"right",start:0,end:0},dirty:false};

const ANATOMICAL_POINTS=[
["Cabeza y cuello",[["head","Cabeza"],["head_front","Punto anterior de cabeza"],["head_back","Punto posterior de cabeza"],["right_ear","Oreja derecha"],["left_ear","Oreja izquierda"],["neck","Cuello"],["neck_base","Base del cuello / C7"]]],
["Hombros",[["right_shoulder","Hombro derecho"],["left_shoulder","Hombro izquierdo"]]],
["Codos",[["right_elbow","Codo derecho"],["left_elbow","Codo izquierdo"]]],
["Muñecas",[["right_wrist","Muñeca derecha"],["left_wrist","Muñeca izquierda"]]],
["Manos",[["right_index","Índice derecho"],["left_index","Índice izquierdo"]]],
["Tronco y pelvis",[["pelvis","Pelvis"],["right_hip","Cadera derecha"],["left_hip","Cadera izquierda"]]],
["Rodillas",[["right_knee","Rodilla derecha"],["left_knee","Rodilla izquierda"]]],
["Tobillos",[["right_ankle","Tobillo derecho"],["left_ankle","Tobillo izquierdo"]]],
["Pies",[["right_foot","Pie derecho"],["left_foot","Pie izquierdo"]]]
];

const screens=[...document.querySelectorAll(".screen")];
const statusEl=document.getElementById("status");
const videoInput=document.getElementById("videoFile");
const jsonInput=document.getElementById("jsonFile");
const videoPreview=document.getElementById("videoPreview");
const mappingContainer=document.getElementById("mappingContainer");

function status(message){statusEl.textContent=message}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function fmt(v,d=2){return Number(v).toLocaleString("es-ES",{minimumFractionDigits:d,maximumFractionDigits:d})}

function setScreen(index){
 state.screen=Math.max(0,Math.min(screens.length-1,index));
 screens.forEach((s,i)=>s.classList.toggle("active",i===state.screen));
 screens.forEach((s,i)=>{
   const prev=s.querySelector("[data-prev]"),next=s.querySelector("[data-next]");
   if(prev)prev.disabled=i===0;
 });
 if(state.screen===1)renderMapping();
 if(state.screen===2)renderPrepared();
 if(state.screen===3)renderElbow();
 window.scrollTo({top:0,behavior:"smooth"});
}

document.querySelectorAll("[data-prev]").forEach(b=>b.addEventListener("click",()=>setScreen(state.screen-1)));
document.querySelectorAll("[data-next]").forEach(b=>b.addEventListener("click",()=>{
 if(state.screen===0){saveIdentification();setScreen(1);return}
 if(state.screen===1){
   if(!state.kinovea){status("Cargue primero el JSON de Kinovea.");return}
   setScreen(2);return
 }
}));
document.getElementById("prepareButton").addEventListener("click",()=>{renderPrepared();status("Pantalla de análisis de hombro actualizada.");});
const elbowPrepareButton=document.getElementById("elbowPrepareButton");
if(elbowPrepareButton)elbowPrepareButton.addEventListener("click",()=>{renderElbow();status("Pantalla de análisis de codo actualizada.");});
document.getElementById("homeButton").addEventListener("click",()=>location.href="../");
document.getElementById("newStudyButton").addEventListener("click",resetStudy);
document.getElementById("saveStudyButton").addEventListener("click",saveStudy);
document.getElementById("loadStudyButton").addEventListener("click",()=>document.getElementById("studyFileInput").click());
document.getElementById("studyFileInput").addEventListener("change",loadStudy);
bindAnalysisRange();

["company","department","studyDate","area","workstation","task","description"].forEach(id=>{
 const el=document.getElementById(id);el.addEventListener("input",()=>{state.dirty=true;state.identification[id]=el.value});
});
videoInput.addEventListener("change",()=>{
 const file=videoInput.files&&videoInput.files[0];if(!file)return;
 if(state.videoUrl)URL.revokeObjectURL(state.videoUrl);
 state.videoUrl=URL.createObjectURL(file);videoPreview.src=state.videoUrl;videoPreview.hidden=false;
 document.getElementById("videoInfo").textContent=file.name;state.dirty=true;status("Vídeo cargado. Cargue el JSON de Kinovea.");
});
jsonInput.addEventListener("change",async()=>{
 const file=jsonInput.files&&jsonInput.files[0];if(!file)return;
 try{
  const json=JSON.parse(await file.text());
  state.kinovea=parseKinoveaJSON(json);state.jsonFileName=file.name;state.mapping={};state.analysisRange={mode:"all",start:0,end:state.kinovea.duration,cycles:1};state.shoulderAnalysis={side:"right",direction:"right",start:0,end:0};state.elbowAnalysis={view:"profile-right",side:"right",direction:"right",start:0,end:0};state.dirty=true;bindAnalysisRange();
  renderSummary();renderMapping();status("JSON de Kinovea cargado. Revise la asignación de marcadores.");
 }catch(e){state.kinovea=null;renderSummary();renderMapping();status("Error al leer el JSON: "+e.message)}
});

function parseKinoveaJSON(json){
 if(!json||!json.metadata)throw new Error("No existe metadata de Kinovea.");
 if(!json.data)throw new Error("No existe el bloque data.");
 const seriesList=Array.isArray(json.data.timeseries)?json.data.timeseries:[];
 if(!seriesList.length)throw new Error("No existen timeseries.");
 const markers=seriesList.map(s=>String(s.name??"").trim()).filter(Boolean);
 const frameCount=Math.max(...seriesList.map(s=>Array.isArray(s.time)?s.time.length:0));
 if(!Number.isFinite(frameCount)||frameCount<1)throw new Error("No existen datos temporales válidos.");
 const frames=[];
 for(let i=0;i<frameCount;i++){
  let time=null;const landmarks={};
  seriesList.forEach(s=>{
   if(time===null&&Array.isArray(s.time)&&s.time[i]!==undefined)time=Number(s.time[i]);
   let p=null;
   if(s.data&&s.data["0"]&&s.data["0"][i])p=s.data["0"][i];
   if(!p&&Array.isArray(s.x)&&Array.isArray(s.y))p=[s.x[i],s.y[i]];
   const name=String(s.name??"").trim();
   if(!name)return;
   landmarks[name]=p&&p.length>=2&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]))?{x:Number(p[0]),y:Number(p[1])}:null;
  });
  frames.push({index:i,time:Number.isFinite(time)?time:0,landmarks});
 }
 return {
  producer:String(json.metadata.producer??""),
  fps:Number(json.metadata.captureFramerate??json.metadata.userFramerate)||null,
  imageSize:json.metadata.imageSize||{},
  markers:[...new Set(markers)],
  frameCount:frames.length,
  duration:frames.at(-1)?.time||0,
  frames
 };
}

function bindAnalysisRange(){
 const mode=document.getElementById("analysisRangeMode"),start=document.getElementById("analysisStart"),end=document.getElementById("analysisEnd"),cycles=document.getElementById("analysisCycles"),sf=document.getElementById("analysisStartField"),ef=document.getElementById("analysisEndField"),cf=document.getElementById("analysisCyclesField"),info=document.getElementById("analysisRangeInfo");
 if(!mode)return;
 mode.value=state.analysisRange.mode||"all";
 start.value=Number.isFinite(state.analysisRange.start)?state.analysisRange.start:0;
 end.value=Number.isFinite(state.analysisRange.end)&&state.analysisRange.end>0?state.analysisRange.end:Number(state.kinovea?.duration||0);
 cycles.value=Number.isFinite(state.analysisRange.cycles)&&state.analysisRange.cycles>0?state.analysisRange.cycles:1;
 const update=()=>{
  const m=mode.value;
  sf.hidden=m!=="interval";ef.hidden=m!=="interval";cf.hidden=m!=="cycles";
  if(m==="all")info.textContent="Todo el vídeo se utilizará en los cálculos.";
  if(m==="interval")info.textContent="Solo se utilizará el intervalo indicado.";
  if(m==="cycles")info.textContent="Se utilizará todo el vídeo y se indicará cuántos ciclos contiene la grabación. El porcentaje se calculará sobre el tiempo analizado y se mostrará también el tiempo medio por ciclo.";
  state.analysisRange={mode:m,start:Number(start.value)||0,end:Number(end.value)||Number(state.kinovea?.duration||0),cycles:Math.max(1,Math.floor(Number(cycles.value)||1))};
  state.dirty=true;
 };
 [mode,start,end,cycles].forEach(el=>el.addEventListener("input",update));
 mode.addEventListener("change",update);
 update();
}
function getAnalysisRange(){
 const k=state.kinovea;if(!k)return null;
 const r=state.analysisRange||{mode:"all",start:0,end:k.duration,cycles:1};
 let start=0,end=k.duration,cycles=1;
 if(r.mode==="interval"){start=Math.max(0,Number(r.start)||0);end=Math.min(k.duration,Number(r.end)||0);cycles=1;}
 if(r.mode==="cycles"){cycles=Math.max(1,Math.floor(Number(r.cycles)||1));}
 if(end<=start)return null;
 return {start,end,duration:end-start,cycles};
}
function analysisScopeLabel(range){
 if(!range)return "";
 if(state.analysisRange.mode==="all")return "Todo el vídeo";
 if(state.analysisRange.mode==="interval")return "Intervalo "+fmt(range.start,3)+"–"+fmt(range.end,3)+" s";
 return "Todo el vídeo · "+range.cycles+" ciclos";
}

function renderSummary(){
 const k=state.kinovea;
 document.getElementById("summaryProducer").textContent=k?.producer||"—";
 document.getElementById("summaryFile").textContent=state.jsonFileName||"—";
 document.getElementById("summaryMarkers").textContent=k?String(k.markers.length):"—";
 document.getElementById("summaryFrames").textContent=k?String(k.frameCount):"—";
 document.getElementById("summaryDuration").textContent=k?fmt(k.duration,3)+" s":"—";
 document.getElementById("summaryFps").textContent=k?.fps?fmt(k.fps,3)+" fps":"—";
}

function renderMapping(){
 if(!state.kinovea){mappingContainer.innerHTML='<div class="placeholder">Cargue primero el JSON de Kinovea.</div>';return}
 let html='<div class="mapping-note"><strong>Marcadores encontrados:</strong> '+esc(state.kinovea.markers.join(", "))+'</div>';
 ANATOMICAL_POINTS.forEach(([group,points])=>{
  html+='<div class="mapping-group"><h3>'+esc(group)+'</h3><div class="mapping-grid">';
  points.forEach(([key,label])=>{
   const current=state.mapping[key]||"";
   html+='<div class="mapping-row"><label>'+esc(label)+'</label><select data-point="'+esc(key)+'"><option value="">— no asignado —</option>';
   state.kinovea.markers.forEach(m=>html+='<option value="'+esc(m)+'" '+(current===m?"selected":"")+'>'+esc(m)+'</option>');
   html+='</select></div>';
  });
  html+='</div></div>';
 });
 mappingContainer.innerHTML=html;
 mappingContainer.querySelectorAll("select[data-point]").forEach(select=>select.addEventListener("change",()=>{
   const point=select.dataset.point,marker=select.value||null;
   Object.keys(state.mapping).forEach(k=>{if(k!==point&&marker&&state.mapping[k]===marker)state.mapping[k]=null});
   state.mapping[point]=marker;state.dirty=true;renderMapping();
 }));
}

function saveIdentification(){
 state.identification={
  company:document.getElementById("company").value,department:document.getElementById("department").value,
  studyDate:document.getElementById("studyDate").value,area:document.getElementById("area").value,
  workstation:document.getElementById("workstation").value,task:document.getElementById("task").value,
  description:document.getElementById("description").value
 };
}

function renderPrepared(){
 const k=state.kinovea;
 document.getElementById("preparedStudy").innerHTML=k?'<div class="prepared-grid">'+
 '<div class="prepared-card"><strong>Estudio</strong><span>'+esc(state.identification.task||"Sin tarea indicada")+'</span></div>'+
 '<div class="prepared-card"><strong>JSON</strong><span>'+esc(state.jsonFileName)+'</span></div>'+
 '<div class="prepared-card"><strong>Marcadores asignados</strong><span>'+Object.values(state.mapping).filter(Boolean).length+'</span></div>'+
 '</div>'+
 '<div class="analysis-panel">'+
 '<h3>Configuración del análisis de hombro</h3>'+
 '<p class="analysis-help">Seleccione la vista de la grabación. El programa determina automáticamente qué hombro y qué movimiento debe analizar. La asignación de marcadores de la pantalla anterior se conserva dentro del estudio.</p>'+
 '<div class="analysis-grid">'+
 '<label>Vista del vídeo<select id="shoulderView">'+
 '<option value="profile-right">Perfil derecho</option>'+
 '<option value="profile-left">Perfil izquierdo</option>'+
 '<option value="frontal">Frontal</option>'+
 '</select></label>'+
 '<label id="directionField">La persona mira hacia<select id="viewDirection">'+
 '<option value="right">la derecha de la pantalla</option><option value="left">la izquierda de la pantalla</option>'+
 '</select></label>'+
 '<div class="prepared-card"><strong>Intervalo utilizado</strong><span id="shoulderScope">'+esc(analysisScopeLabel(getAnalysisRange()))+'</span></div>'+
 '</div>'+
 '<div id="requiredMarkers" class="marker-check"></div>'+
 '<div class="analysis-actions"><button type="button" class="nav-primary" id="calculateShoulder">Calcular hombro</button></div>'+
 '<div id="shoulderResult" class="shoulder-result"><div class="placeholder">Seleccione la vista, compruebe los marcadores necesarios y pulse «Calcular hombro».</div></div>'+
 '</div>':
 '<div class="placeholder">Pendiente de cargar el vídeo y el JSON de Kinovea.</div>';
 bindShoulderAnalysis();
}

function bindShoulderAnalysis(){
 const view=document.getElementById("shoulderView"),direction=document.getElementById("viewDirection"),directionField=document.getElementById("directionField");
 if(!view||!direction)return;
 view.value=state.shoulderAnalysis.view||"profile-right";
 direction.value=state.shoulderAnalysis.direction||"right";
 
 const updateView=()=>{
   const v=view.value;
   directionField.style.display=v==="frontal"?"none":"flex";
   if(v==="profile-right"){
     document.getElementById("requiredMarkers").innerHTML='<strong>Marcadores necesarios · hombro derecho</strong><span>Cadera derecha: <b>'+esc(state.mapping.right_hip||"—")+'</b> · Hombro derecho: <b>'+esc(state.mapping.right_shoulder||"—")+'</b> · Codo derecho: <b>'+esc(state.mapping.right_elbow||"—")+'</b></span>';
   }else if(v==="profile-left"){
     document.getElementById("requiredMarkers").innerHTML='<strong>Marcadores necesarios · hombro izquierdo</strong><span>Cadera izquierda: <b>'+esc(state.mapping.left_hip||"—")+'</b> · Hombro izquierdo: <b>'+esc(state.mapping.left_shoulder||"—")+'</b> · Codo izquierdo: <b>'+esc(state.mapping.left_elbow||"—")+'</b></span>';
   }else{
     document.getElementById("requiredMarkers").innerHTML='<strong>Marcadores necesarios · abducción de ambos hombros</strong><span>Derecho: cadera + hombro + codo = <b>'+esc(state.mapping.right_hip||"—")+'</b> · <b>'+esc(state.mapping.right_shoulder||"—")+'</b> · <b>'+esc(state.mapping.right_elbow||"—")+'</b><br>Izquierdo: cadera + hombro + codo = <b>'+esc(state.mapping.left_hip||"—")+'</b> · <b>'+esc(state.mapping.left_shoulder||"—")+'</b> · <b>'+esc(state.mapping.left_elbow||"—")+'</b></span>';
   }
 };
 view.addEventListener("change",updateView);
 document.getElementById("calculateShoulder").addEventListener("click",()=>{
   const range=getAnalysisRange();
   if(!range){status("Revise el intervalo de análisis indicado en la pantalla de vídeo.");return;}
   state.shoulderAnalysis={view:view.value,direction:direction.value,start:range.start,end:range.end};
   const result=calculateShoulder(view.value,direction.value,range.start,range.end,range.cycles);
   document.getElementById("shoulderResult").innerHTML=result.html;
   status(result.status);
 });
 updateView();
}

function calculateShoulder(view,direction,start,end,cycles=1){
 const k=state.kinovea;
 if(!k)return{status:"Cargue el JSON de Kinovea.",html:'<div class="placeholder">Cargue primero el JSON de Kinovea.</div>'};
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return{status:"El intervalo del ciclo no es válido.",html:'<div class="placeholder">El fin del ciclo debe ser mayor que el inicio.</div>'};
 if(view==="frontal"){
   const right=calculateAbduction("right",start,end);
   const left=calculateAbduction("left",start,end);
   if(!right.ok&&!left.ok)return{status:"Asigne cadera, hombro y codo de al menos un lado para analizar la abducción.",html:'<div class="placeholder">Para el vídeo frontal debe asignar cadera, hombro y codo. Puede analizar un lado o ambos.</div>'};
   return{status:"Análisis frontal de abducción calculado correctamente.",html:buildFrontalResult(right,left,end-start)};
 }
 const side=view==="profile-right"?"right":"left";
 return calculateProfileShoulder(side,direction,start,end,cycles);
}

function calculateProfileShoulder(side,direction,start,end,cycles=1){
 const k=state.kinovea;
 const hipMarker=state.mapping[side+"_hip"],shoulderMarker=state.mapping[side+"_shoulder"],elbowMarker=state.mapping[side+"_elbow"];
 if(!hipMarker||!shoulderMarker||!elbowMarker)return{status:"Asigne cadera, hombro y codo del lado seleccionado.",html:'<div class="placeholder">Para este perfil debe asignar cadera, hombro y codo del lado seleccionado.</div>'};
 const frames=k.frames.filter(f=>f.time>=start&&f.time<=end);
 if(frames.length<2)return{status:"No hay suficientes frames dentro del ciclo seleccionado.",html:'<div class="placeholder">No hay suficientes datos de Kinovea dentro del ciclo seleccionado.</div>'};
 let flex=0,ext=0,valid=0;const samples=[];
 for(let i=0;i<frames.length-1;i++){
   const a=frames[i],b=frames[i+1],pa=getPoint(a,hipMarker),pb=getPoint(a,shoulderMarker),pc=getPoint(a,elbowMarker),qa=getPoint(b,hipMarker),qb=getPoint(b,shoulderMarker),qc=getPoint(b,elbowMarker);
   const dt=Math.max(0,Math.min(b.time,end)-Math.max(a.time,start));if(dt<=0)continue;
   const angleA=signedShoulderAngle(pa,pb,pc,direction),angleB=signedShoulderAngle(qa,qb,qc,direction);
   if(!Number.isFinite(angleA)||!Number.isFinite(angleB))continue;
   valid+=dt;const avg=(angleA+angleB)/2;if(avg>=80)flex+=dt;if(avg<-20)ext+=dt;samples.push(avg);
 }
 if(valid<=0)return{status:"No se han encontrado datos válidos para los tres marcadores en el ciclo.",html:'<div class="placeholder">No hay datos válidos de cadera, hombro y codo durante el ciclo seleccionado.</div>'};
 const cycleDuration=end-start,pct=x=>x/cycleDuration*100,mean=samples.reduce((s,x)=>s+x,0)/samples.length;
 const html='<div class="result-table-wrap"><table class="result-table"><thead><tr><th>Movimiento</th><th>Criterio</th><th>Tiempo</th><th>% del ciclo</th></tr></thead><tbody>'+
 '<tr><td>Flexión de hombro '+(side==="right"?"derecho":"izquierdo")+'</td><td>≥ 80°</td><td>'+fmt(flex,3)+' s</td><td>'+fmt(pct(flex),2)+' %</td></tr>'+
 '<tr><td>Extensión de hombro '+(side==="right"?"derecho":"izquierdo")+'</td><td>&gt; 20° de extensión</td><td>'+fmt(ext,3)+' s</td><td>'+fmt(pct(ext),2)+' %</td></tr>'+
 '</tbody></table></div><div class="analysis-summary"><span>Duración del ciclo: <strong>'+fmt(cycleDuration,3)+' s</strong></span><span>Frames válidos: <strong>'+samples.length+'</strong></span><span>Ángulo medio: <strong>'+fmt(mean,2)+'°</strong></span></div>'+
 '<div class="notice"><strong>Definición:</strong> 0° = brazo colgando respecto al eje del tronco; positivo = flexión; negativo = extensión. '+(state.analysisRange.mode==="cycles"?'La grabación se ha indicado como '+cycles+' ciclos; el tiempo medio por ciclo es '+fmt(cycleDuration/cycles,3)+' s.':'')+'</div>';
 return{status:"Análisis de hombro calculado correctamente.",html};
}

function calculateAbduction(side,start,end){
 const k=state.kinovea,hipMarker=state.mapping[side+"_hip"],shoulderMarker=state.mapping[side+"_shoulder"],elbowMarker=state.mapping[side+"_elbow"];
 if(!hipMarker||!shoulderMarker||!elbowMarker)return{ok:false};
 const frames=k.frames.filter(f=>f.time>=start&&f.time<=end);if(frames.length<2)return{ok:false};
 let abd=0,valid=0;const samples=[];
 for(let i=0;i<frames.length-1;i++){
   const a=frames[i],b=frames[i+1],pa=getPoint(a,hipMarker),pb=getPoint(a,shoulderMarker),pc=getPoint(a,elbowMarker),qa=getPoint(b,hipMarker),qb=getPoint(b,shoulderMarker),qc=getPoint(b,elbowMarker);
   const dt=Math.max(0,Math.min(b.time,end)-Math.max(a.time,start));if(dt<=0)continue;
   const angleA=abductionAngle(pa,pb,pc,side),angleB=abductionAngle(qa,qb,qc,side);
   if(!Number.isFinite(angleA)||!Number.isFinite(angleB))continue;
   valid+=dt;const avg=(angleA+angleB)/2;if(avg>=80)abd+=dt;samples.push(avg);
 }
 if(valid<=0)return{ok:false};
 return{ok:true,time:abd,pct:abd/(end-start)*100,valid,mean:samples.reduce((s,x)=>s+x,0)/samples.length,frames:samples.length};
}

function abductionAngle(hip,shoulder,elbow,side){
 if(!hip||!shoulder||!elbow)return NaN;
 const tx=hip.x-shoulder.x,ty=hip.y-shoulder.y,ax=elbow.x-shoulder.x,ay=elbow.y-shoulder.y;
 const nt=Math.hypot(tx,ty),na=Math.hypot(ax,ay);if(nt===0||na===0)return NaN;
 const dot=(tx*ax+ty*ay)/(nt*na);
 return Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI;
}

function buildFrontalResult(right,left,cycleDuration){
 const row=(label,r)=>r.ok?'<tr><td>Abducción hombro '+label+'</td><td>≥ 80°</td><td>'+fmt(r.time,3)+' s</td><td>'+fmt(r.pct,2)+' %</td></tr>':'<tr><td>Abducción hombro '+label+'</td><td>≥ 80°</td><td>—</td><td>—</td></tr>';
 const valid=[right,left].filter(r=>r.ok);
 const html='<div class="result-table-wrap"><table class="result-table"><thead><tr><th>Movimiento</th><th>Criterio</th><th>Tiempo</th><th>% del ciclo</th></tr></thead><tbody>'+row("derecho",right)+row("izquierdo",left)+'</tbody></table></div>'+
 '<div class="analysis-summary"><span>Duración del ciclo: <strong>'+fmt(cycleDuration,3)+' s</strong></span><span>Lados con datos válidos: <strong>'+valid.length+'</strong></span></div>'+
 '<div class="notice"><strong>Definición frontal:</strong> 0° = brazo junto al tronco; se contabiliza abducción cuando el ángulo del brazo respecto al eje del tronco es ≥80°. Se utilizan cadera, hombro y codo de cada lado.</div>';
 return html;
}

function renderElbow(){
 const k=state.kinovea;
 const box=document.getElementById("elbowStudy");
 if(!box)return;
 if(!k){box.innerHTML='<div class="placeholder">Pendiente de cargar el vídeo y el JSON de Kinovea.</div>';return;}
 box.innerHTML='<div class="analysis-panel"><h3>Configuración del análisis de codo</h3>'+
 '<p class="analysis-help">0° = postura natural de referencia. En perfil se mide flexión/extensión con hombro, codo y muñeca. En frontal se mide pronación/supinación con codo, muñeca e índice.</p>'+
 '<div class="analysis-grid">'+
 '<label>Vista del vídeo<select id="elbowView"><option value="profile-right">Perfil derecho</option><option value="profile-left">Perfil izquierdo</option><option value="frontal">Frontal</option></select></label>'+
 '<label id="elbowDirectionField">La persona mira hacia<select id="elbowDirection"><option value="right">la derecha de la pantalla</option><option value="left">la izquierda de la pantalla</option></select></label>'+
 '<div class="prepared-card"><strong>Intervalo utilizado</strong><span>'+esc(analysisScopeLabel(getAnalysisRange()))+'</span></div>'+
 '</div><div id="elbowMarkers" class="marker-check"></div>'+
 '<div class="analysis-actions"><button type="button" class="nav-primary" id="calculateElbow">Calcular codo</button></div>'+
 '<div id="elbowResult" class="shoulder-result"><div class="placeholder">Seleccione la vista y pulse «Calcular codo».</div></div></div>';
 bindElbowAnalysis();
}
function bindElbowAnalysis(){
 const view=document.getElementById("elbowView"),direction=document.getElementById("elbowDirection"),field=document.getElementById("elbowDirectionField");
 if(!view)return;
 view.value=state.elbowAnalysis.view||"profile-right";direction.value=state.elbowAnalysis.direction||"right";
  const update=()=>{
  field.style.display=view.value==="frontal"?"none":"flex";
  if(view.value==="frontal"){
   document.getElementById("elbowMarkers").innerHTML='<strong>Marcadores necesarios · pronación/supinación</strong><span>Derecho: codo + muñeca + índice = <b>'+esc(state.mapping.right_elbow||"—")+'</b> · <b>'+esc(state.mapping.right_wrist||"—")+'</b> · <b>'+esc(state.mapping.right_index||"—")+'</b><br>Izquierdo: codo + muñeca + índice = <b>'+esc(state.mapping.left_elbow||"—")+'</b> · <b>'+esc(state.mapping.left_wrist||"—")+'</b> · <b>'+esc(state.mapping.left_index||"—")+'</b></span>';
  }else{
   const s=view.value==="profile-right"?"right":"left";
   document.getElementById("elbowMarkers").innerHTML='<strong>Marcadores necesarios · flexión/extensión '+(s==="right"?"derecha":"izquierda")+'</strong><span>Hombro + codo + muñeca = <b>'+esc(state.mapping[s+"_shoulder"]||"—")+'</b> · <b>'+esc(state.mapping[s+"_elbow"]||"—")+'</b> · <b>'+esc(state.mapping[s+"_wrist"]||"—")+'</b></span>';
  }
 };
 view.addEventListener("change",update);
 document.getElementById("calculateElbow").addEventListener("click",()=>{
  const range=getAnalysisRange();
  if(!range){status("Revise el intervalo de análisis indicado en la pantalla de vídeo.");return;}
  state.elbowAnalysis={view:view.value,side:view.value==="profile-left"?"left":"right",direction:direction.value,start:range.start,end:range.end};
  const r=calculateElbow(view.value,direction.value,range.start,range.end,range.cycles);
  document.getElementById("elbowResult").innerHTML=r.html;status(r.status);
 });
 update();
}
function calculateElbow(view,direction,start,end,cycles=1){
 if(!state.kinovea)return{status:"Cargue el JSON de Kinovea.",html:'<div class="placeholder">Cargue primero el JSON de Kinovea.</div>'};
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return{status:"El intervalo del ciclo no es válido.",html:'<div class="placeholder">El fin del ciclo debe ser mayor que el inicio.</div>'};
 if(view==="frontal")return calculatePronationSupination(start,end,cycles);
 const side=view==="profile-right"?"right":"left";
 return calculateElbowFlexExt(side,direction,start,end,cycles);
}
function calculateElbowFlexExt(side,direction,start,end,cycles=1){
 const hm=state.mapping[side+"_shoulder"],em=state.mapping[side+"_elbow"],wm=state.mapping[side+"_wrist"];
 if(!hm||!em||!wm)return{status:"Asigne hombro, codo y muñeca del lado seleccionado.",html:'<div class="placeholder">Para este perfil debe asignar hombro, codo y muñeca del lado seleccionado.</div>'};
 const frames=state.kinovea.frames.filter(f=>f.time>=start&&f.time<=end); if(frames.length<2)return{status:"No hay suficientes frames dentro del ciclo.",html:'<div class="placeholder">No hay suficientes datos de Kinovea dentro del ciclo seleccionado.</div>'};
 let base=null,flex=0,ext=0,valid=0;const samples=[];
 for(let i=0;i<frames.length-1;i++){
  const a=frames[i],b=frames[i+1],pa=getPoint(a,hm),pb=getPoint(a,em),pc=getPoint(a,wm),qa=getPoint(b,hm),qb=getPoint(b,em),qc=getPoint(b,wm);
  const dt=Math.max(0,Math.min(b.time,end)-Math.max(a.time,start)); if(dt<=0)continue;
  const aa=elbowJointAngle(pa,pb,pc,direction),ab=elbowJointAngle(qa,qb,qc,direction); if(!Number.isFinite(aa)||!Number.isFinite(ab))continue;
  if(base===null)base=aa;
  const rel=(aa+ab)/2-base;
  valid+=dt; if(rel>60)flex+=dt; if(rel<-60)ext+=dt; samples.push(rel);
 }
 if(valid<=0||base===null)return{status:"No se han encontrado datos válidos para los tres marcadores.",html:'<div class="placeholder">No hay datos válidos durante el ciclo.</div>'};
 const cycle=end-start,p=x=>x/cycle*100,mean=samples.reduce((s,x)=>s+x,0)/samples.length;
 return{status:"Análisis de flexión/extensión de codo calculado correctamente.",html:'<div class="result-table-wrap"><table class="result-table"><thead><tr><th>Movimiento</th><th>Criterio</th><th>Tiempo</th><th>% del ciclo</th></tr></thead><tbody><tr><td>Flexión de codo '+(side==="right"?"derecho":"izquierdo")+'</td><td>&gt; 60°</td><td>'+fmt(flex,3)+' s</td><td>'+fmt(p(flex),2)+' %</td></tr><tr><td>Extensión de codo '+(side==="right"?"derecho":"izquierdo")+'</td><td>&gt; 60°</td><td>'+fmt(ext,3)+' s</td><td>'+fmt(p(ext),2)+' %</td></tr></tbody></table></div><div class="analysis-summary"><span>0° natural: <strong>'+fmt(base,2)+'° geométricos</strong></span><span>Frames válidos: <strong>'+samples.length+'</strong></span><span>Desviación media: <strong>'+fmt(mean,2)+'°</strong></span></div><div class="notice"><strong>Referencia:</strong> 0° se fija en el primer ángulo válido del ciclo, considerado postura natural de referencia; positivo = flexión y negativo = extensión.</div>'};
}
function calculatePronationSupination(start,end,cycles=1){
 const sides=["right","left"].filter(s=>state.mapping[s+"_elbow"]&&state.mapping[s+"_wrist"]&&state.mapping[s+"_index"]);
 if(!sides.length)return{status:"Asigne codo, muñeca e índice de al menos un lado.",html:'<div class="placeholder">Para el vídeo frontal debe asignar codo, muñeca e índice de al menos un lado.</div>'};
 const results=sides.map(s=>calculatePronationSide(s,start,end)).filter(Boolean); if(!results.length)return{status:"No hay datos válidos para pronación/supinación.",html:'<div class="placeholder">No hay datos válidos durante el ciclo.</div>'};
 const rows=results.map(r=>'<tr><td>Pronación '+(r.side==="right"?"derecha":"izquierda")+'</td><td>&gt; 60°</td><td>'+fmt(r.pron,3)+' s</td><td>'+fmt(r.pron/(end-start)*100,2)+' %</td></tr><tr><td>Supinación '+(r.side==="right"?"derecha":"izquierda")+'</td><td>&gt; 60°</td><td>'+fmt(r.sup,3)+' s</td><td>'+fmt(r.sup/(end-start)*100,2)+' %</td></tr>').join("");
 return{status:"Análisis de pronación/supinación calculado correctamente.",html:'<div class="result-table-wrap"><table class="result-table"><thead><tr><th>Movimiento</th><th>Criterio</th><th>Tiempo</th><th>% del ciclo</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="analysis-summary"><span>Referencia: <strong>0° natural</strong></span><span>Lados válidos: <strong>'+results.length+'</strong></span></div><div class="notice"><strong>Referencia:</strong> la postura natural del primer frame válido del ciclo se toma como 0°. La rotación relativa positiva se clasifica como pronación y la negativa como supinación según la orientación frontal de la mano.</div>'};
}
function calculatePronationSide(side,start,end){
 const em=state.mapping[side+"_elbow"],wm=state.mapping[side+"_wrist"],im=state.mapping[side+"_index"],frames=state.kinovea.frames.filter(f=>f.time>=start&&f.time<=end);
 let base=null,pron=0,sup=0,valid=0; if(frames.length<2)return null;
 for(let i=0;i<frames.length-1;i++){
  const a=frames[i],b=frames[i+1],dt=Math.max(0,Math.min(b.time,end)-Math.max(a.time,start));if(dt<=0)continue;
  const aa=handRotationAngle(getPoint(a,em),getPoint(a,wm),getPoint(a,im)),ab=handRotationAngle(getPoint(b,em),getPoint(b,wm),getPoint(b,im));if(!Number.isFinite(aa)||!Number.isFinite(ab))continue;
  if(base===null)base=aa;const rel=(aa+ab)/2-base;valid+=dt;if(rel>60)pron+=dt;if(rel<-60)sup+=dt;
 }
 return base===null||valid<=0?null:{side,pron,sup,base,valid};
}
function elbowJointAngle(shoulder,elbow,wrist,direction){
 if(!shoulder||!elbow||!wrist)return NaN;
 const ax=shoulder.x-elbow.x,ay=shoulder.y-elbow.y,bx=wrist.x-elbow.x,by=wrist.y-elbow.y;
 const na=Math.hypot(ax,ay),nb=Math.hypot(bx,by);if(!na||!nb)return NaN;
 const raw=Math.acos(Math.max(-1,Math.min(1,(ax*bx+ay*by)/(na*nb))))*180/Math.PI;
 return raw;
}
function handRotationAngle(elbow,wrist,index){
 if(!elbow||!wrist||!index)return NaN;
 const fx=wrist.x-elbow.x,fy=wrist.y-elbow.y,hx=index.x-wrist.x,hy=index.y-wrist.y;
 const nf=Math.hypot(fx,fy),nh=Math.hypot(hx,hy);if(!nf||!nh)return NaN;
 return Math.atan2(fx*hy-fy*hx,fx*hx+fy*hy)*180/Math.PI;
}
function getPoint(frame,marker){return frame?.landmarks?.[marker]||null}
function signedShoulderAngle(hip,shoulder,elbow,direction){
 if(!hip||!shoulder||!elbow)return NaN;
 const dxT=hip.x-shoulder.x,dyT=hip.y-shoulder.y,dxA=elbow.x-shoulder.x,dyA=elbow.y-shoulder.y;
 const nt=Math.hypot(dxT,dyT),na=Math.hypot(dxA,dyA);if(nt===0||na===0)return NaN;
 const dot=(dxT*dxA+dyT*dyA)/(nt*na),unsigned=Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI,cross=dxT*dyA-dyT*dxA;
 const sign=direction==="right"?(cross<0?1:-1):(cross>0?1:-1);
 return unsigned*sign;
}

function resetStudy(){
 if(state.videoUrl)URL.revokeObjectURL(state.videoUrl);
 state.screen=0;state.kinovea=null;state.jsonFileName="";state.videoUrl=null;state.mapping={};state.identification={};state.analysisRange={mode:"all",start:0,end:0,cycles:1};state.shoulderAnalysis={side:"right",direction:"right",start:0,end:0};state.elbowAnalysis={view:"profile-right",side:"right",direction:"right",start:0,end:0};state.dirty=false;
 ["company","department","studyDate","area","workstation","task","description"].forEach(id=>document.getElementById(id).value="");
 videoInput.value="";jsonInput.value="";videoPreview.removeAttribute("src");videoPreview.hidden=true;
 document.getElementById("videoInfo").textContent="Ningún vídeo seleccionado.";
 renderSummary();renderMapping();bindAnalysisRange();renderPrepared();setScreen(0);status("Nuevo estudio preparado.");
}

function saveStudy(){
 saveIdentification();
 const study={format:"Ergonomic Analyzer Posturas",version:2,created:new Date().toISOString(),identification:{...state.identification},jsonFileName:state.jsonFileName,analysisRange:{...state.analysisRange},mapping:{...state.mapping},shoulderAnalysis:{...state.shoulderAnalysis},elbowAnalysis:{...state.elbowAnalysis}};
 const blob=new Blob([JSON.stringify(study,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="estudio_posturas.json";a.click();URL.revokeObjectURL(url);state.dirty=false;status("Estudio guardado.");
}

async function loadStudy(event){
 const file=event.target.files&&event.target.files[0];if(!file)return;
 try{
  const study=JSON.parse(await file.text());
  if(!study||study.format!=="Ergonomic Analyzer Posturas")throw new Error("El archivo no es un estudio de Posturas válido.");
  state.identification=study.identification&&typeof study.identification==="object"?study.identification:{};
  ["company","department","studyDate","area","workstation","task","description"].forEach(id=>document.getElementById(id).value=state.identification[id]||"");
  state.mapping=study.mapping&&typeof study.mapping==="object"?study.mapping:{};
  state.jsonFileName=study.jsonFileName||"";state.analysisRange=study.analysisRange&&typeof study.analysisRange==="object"?{...state.analysisRange,...study.analysisRange}:state.analysisRange;state.elbowAnalysis=study.elbowAnalysis&&typeof study.elbowAnalysis==="object"?{...state.elbowAnalysis,...study.elbowAnalysis}:state.elbowAnalysis;state.shoulderAnalysis=study.shoulderAnalysis&&typeof study.shoulderAnalysis==="object"?{...state.shoulderAnalysis,...study.shoulderAnalysis}:state.shoulderAnalysis;state.dirty=false;
  renderSummary();renderMapping();renderPrepared();setScreen(0);status("Estudio cargado. Seleccione de nuevo el JSON de Kinovea para trabajar con sus datos.");
 }catch(e){status("No se pudo cargar el estudio: "+e.message)}
 event.target.value="";
}

renderSummary();renderMapping();bindAnalysisRange();renderPrepared();
})();