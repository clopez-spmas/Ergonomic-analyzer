"use strict";
(function(){
const state={screen:0,kinovea:null,jsonFileName:"",videoUrl:null,mapping:{},identification:{},shoulderAnalysis:{side:"right",direction:"right",start:0,end:0},dirty:false};

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
document.getElementById("prepareButton").addEventListener("click",()=>{renderPrepared();status("Preparación completada. A la espera de definir los datos específicos de cada postura.");});
document.getElementById("homeButton").addEventListener("click",()=>location.href="../");
document.getElementById("newStudyButton").addEventListener("click",resetStudy);
document.getElementById("saveStudyButton").addEventListener("click",saveStudy);
document.getElementById("loadStudyButton").addEventListener("click",()=>document.getElementById("studyFileInput").click());
document.getElementById("studyFileInput").addEventListener("change",loadStudy);

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
  state.kinovea=parseKinoveaJSON(json);state.jsonFileName=file.name;state.mapping={};state.shoulderAnalysis={side:"right",direction:"right",start:0,end:0};state.dirty=true;
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
 '<h3>Análisis de hombro · vídeo de perfil</h3>'+
 '<p class="analysis-help">Se utilizan únicamente tres marcadores de Kinovea del mismo lado: cadera, hombro y codo. El ángulo 0° corresponde al brazo colgando alineado con el tronco; la flexión se expresa en positivo y la extensión en negativo.</p>'+
 '<div class="analysis-grid">'+
 '<label>Lado analizado<select id="shoulderSide"><option value="right">Derecho</option><option value="left">Izquierdo</option></select></label>'+
 '<label>La persona mira hacia<select id="viewDirection"><option value="right">la derecha de la pantalla</option><option value="left">la izquierda de la pantalla</option></select></label>'+
 '<label>Inicio del ciclo (s)<input id="cycleStart" type="number" min="0" step="0.001" value="0"></label>'+
 '<label>Fin del ciclo (s)<input id="cycleEnd" type="number" min="0" step="0.001" value="'+Number(k.duration).toFixed(3)+'"></label>'+
 '</div>'+
 '<div class="marker-check"><strong>Marcadores necesarios</strong><span>Cadera: <b id="shoulderHipMarker">—</b> · Hombro: <b id="shoulderMarker">—</b> · Codo: <b id="shoulderElbowMarker">—</b></span></div>'+
 '<div class="analysis-actions"><button type="button" class="nav-primary" id="calculateShoulder">Calcular hombro</button></div>'+
 '<div id="shoulderResult" class="shoulder-result"><div class="placeholder">Seleccione los tres marcadores y pulse «Calcular hombro».</div></div>'+
 '</div>':
 '<div class="placeholder">Pendiente de cargar el vídeo y el JSON de Kinovea.</div>';
 bindShoulderAnalysis();
}
function bindShoulderAnalysis(){
 const side=document.getElementById("shoulderSide"),direction=document.getElementById("viewDirection"),start=document.getElementById("cycleStart"),end=document.getElementById("cycleEnd");
 if(!side||!direction||!start||!end)return;
 const updateMarkers=()=>{
   const prefix=side.value;
   document.getElementById("shoulderHipMarker").textContent=state.mapping[prefix+"_hip"]||"—";
   document.getElementById("shoulderMarker").textContent=state.mapping[prefix+"_shoulder"]||"—";
   document.getElementById("shoulderElbowMarker").textContent=state.mapping[prefix+"_elbow"]||"—";
 };
 side.addEventListener("change",updateMarkers);
 document.getElementById("calculateShoulder").addEventListener("click",()=>{
   state.shoulderAnalysis={side:side.value,direction:direction.value,start:Number(start.value),end:Number(end.value)}; const result=calculateShoulder(side.value,direction.value,Number(start.value),Number(end.value));
   document.getElementById("shoulderResult").innerHTML=result.html;
   status(result.status);
 });
 updateMarkers();
}
function calculateShoulder(side,direction,start,end){
 const k=state.kinovea;
 const hipMarker=state.mapping[side+"_hip"],shoulderMarker=state.mapping[side+"_shoulder"],elbowMarker=state.mapping[side+"_elbow"];
 if(!k)return{status:"Cargue el JSON de Kinovea.",html:'<div class="placeholder">Cargue primero el JSON de Kinovea.</div>'};
 if(!hipMarker||!shoulderMarker||!elbowMarker)return{status:"Asigne cadera, hombro y codo del mismo lado.",html:'<div class="placeholder">Para calcular el hombro debe asignar cadera, hombro y codo del mismo lado.</div>'};
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return{status:"El intervalo del ciclo no es válido.",html:'<div class="placeholder">El fin del ciclo debe ser mayor que el inicio.</div>'};
 const frames=k.frames.filter(f=>f.time>=start&&f.time<=end);
 if(frames.length<2)return{status:"No hay suficientes frames dentro del ciclo seleccionado.",html:'<div class="placeholder">No hay suficientes datos de Kinovea dentro del ciclo seleccionado.</div>'};
 let flex=0,ext=0,valid=0;
 const samples=[];
 for(let i=0;i<frames.length-1;i++){
   const a=frames[i],b=frames[i+1];
   const pa=getPoint(a,hipMarker),pb=getPoint(a,shoulderMarker),pc=getPoint(a,elbowMarker);
   const qa=getPoint(b,hipMarker),qb=getPoint(b,shoulderMarker),qc=getPoint(b,elbowMarker);
   const dt=Math.max(0,Math.min(b.time,end)-Math.max(a.time,start));
   if(dt<=0)continue;
   const angleA=signedShoulderAngle(pa,pb,pc,direction);
   const angleB=signedShoulderAngle(qa,qb,qc,direction);
   if(!Number.isFinite(angleA)||!Number.isFinite(angleB))continue;
   valid+=dt;
   const avg=(angleA+angleB)/2;
   if(avg>=80)flex+=dt;
   if(avg<-20)ext+=dt;
   samples.push(avg);
 }
 const cycleDuration=end-start;
 if(valid<=0)return{status:"No se han encontrado datos válidos para los tres marcadores en el ciclo.",html:'<div class="placeholder">No hay datos válidos de cadera, hombro y codo durante el ciclo seleccionado.</div>'};
 const pct=x=>x/cycleDuration*100;
 const mean=samples.reduce((s,x)=>s+x,0)/samples.length;
 const html='<div class="result-table-wrap"><table class="result-table"><thead><tr><th>Movimiento</th><th>Criterio</th><th>Tiempo</th><th>% del ciclo</th></tr></thead><tbody>'+
 '<tr><td>Flexión de hombro</td><td>≥ 80°</td><td>'+fmt(flex,3)+' s</td><td>'+fmt(pct(flex),2)+' %</td></tr>'+
 '<tr><td>Extensión de hombro</td><td>&lt; −20°</td><td>'+fmt(ext,3)+' s</td><td>'+fmt(pct(ext),2)+' %</td></tr>'+
 '</tbody></table></div>'+
 '<div class="analysis-summary"><span>Duración del ciclo: <strong>'+fmt(cycleDuration,3)+' s</strong></span><span>Frames válidos: <strong>'+samples.length+'</strong></span><span>Ángulo medio: <strong>'+fmt(mean,2)+'°</strong></span></div>'+
 '<div class="notice"><strong>Definición aplicada:</strong> 0° = brazo colgando respecto al eje del tronco; positivo = flexión; negativo = extensión. Solo se han utilizado los tres marcadores seleccionados.</div>';
 return{status:"Análisis de hombro calculado correctamente.",html};
}
function getPoint(frame,marker){return frame?.landmarks?.[marker]||null}
function signedShoulderAngle(hip,shoulder,elbow,direction){
 if(!hip||!shoulder||!elbow)return NaN;
 const dxT=hip.x-shoulder.x,dyT=hip.y-shoulder.y;
 const dxA=elbow.x-shoulder.x,dyA=elbow.y-shoulder.y;
 const nt=Math.hypot(dxT,dyT),na=Math.hypot(dxA,dyA);
 if(nt===0||na===0)return NaN;
 const dot=(dxT*dxA+dyT*dyA)/(nt*na);
 const unsigned=Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI;
 const cross=dxT*dyA-dyT*dxA;
 const sign=direction==="right"?(cross<0?1:-1):(cross>0?1:-1);
 return unsigned*sign;
}

function resetStudy(){
 if(state.videoUrl)URL.revokeObjectURL(state.videoUrl);
 state.screen=0;state.kinovea=null;state.jsonFileName="";state.videoUrl=null;state.mapping={};state.identification={};state.shoulderAnalysis={side:"right",direction:"right",start:0,end:0};state.dirty=false;
 ["company","department","studyDate","area","workstation","task","description"].forEach(id=>document.getElementById(id).value="");
 videoInput.value="";jsonInput.value="";videoPreview.removeAttribute("src");videoPreview.hidden=true;
 document.getElementById("videoInfo").textContent="Ningún vídeo seleccionado.";
 renderSummary();renderMapping();renderPrepared();setScreen(0);status("Nuevo estudio preparado.");
}

function saveStudy(){
 saveIdentification();
 const study={format:"Ergonomic Analyzer Posturas",version:2,created:new Date().toISOString(),identification:{...state.identification},jsonFileName:state.jsonFileName,mapping:{...state.mapping},shoulderAnalysis:{...state.shoulderAnalysis}};
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
  state.jsonFileName=study.jsonFileName||"";state.shoulderAnalysis=study.shoulderAnalysis&&typeof study.shoulderAnalysis==="object"?{...state.shoulderAnalysis,...study.shoulderAnalysis}:state.shoulderAnalysis;state.dirty=false;
  renderSummary();renderMapping();renderPrepared();setScreen(0);status("Estudio cargado. Seleccione de nuevo el JSON de Kinovea para trabajar con sus datos.");
 }catch(e){status("No se pudo cargar el estudio: "+e.message)}
 event.target.value="";
}

renderSummary();renderMapping();renderPrepared();
})();