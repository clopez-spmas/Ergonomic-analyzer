"use strict";
(function(){
const state={screen:0,kinovea:null,jsonFileName:"",videoUrl:null,mapping:{},identification:{},dirty:false};

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
  state.kinovea=parseKinoveaJSON(json);state.jsonFileName=file.name;state.mapping={};state.dirty=true;
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
 '</div>':'<div class="placeholder">Pendiente de cargar el vídeo y el JSON de Kinovea.</div>';
}

function resetStudy(){
 if(state.videoUrl)URL.revokeObjectURL(state.videoUrl);
 state.screen=0;state.kinovea=null;state.jsonFileName="";state.videoUrl=null;state.mapping={};state.identification={};state.dirty=false;
 ["company","department","studyDate","area","workstation","task","description"].forEach(id=>document.getElementById(id).value="");
 videoInput.value="";jsonInput.value="";videoPreview.removeAttribute("src");videoPreview.hidden=true;
 document.getElementById("videoInfo").textContent="Ningún vídeo seleccionado.";
 renderSummary();renderMapping();renderPrepared();setScreen(0);status("Nuevo estudio preparado.");
}

function saveStudy(){
 saveIdentification();
 const study={format:"Ergonomic Analyzer Posturas",version:2,created:new Date().toISOString(),identification:{...state.identification},jsonFileName:state.jsonFileName,mapping:{...state.mapping}};
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
  state.jsonFileName=study.jsonFileName||"";state.dirty=false;
  renderSummary();renderMapping();renderPrepared();setScreen(0);status("Estudio cargado. Seleccione de nuevo el JSON de Kinovea para trabajar con sus datos.");
 }catch(e){status("No se pudo cargar el estudio: "+e.message)}
 event.target.value="";
}

renderSummary();renderMapping();renderPrepared();
})();