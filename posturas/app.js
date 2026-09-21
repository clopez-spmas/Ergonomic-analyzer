"use strict";

(function(){
const state={
  screen:0,
  kinovea:null,
  jsonFileName:"",
  videoUrl:null,
  mapping:{},
  selected:new Set(["shoulder_left","shoulder_right","elbow_left","elbow_right","wrist_left","wrist_right"]),
  results:[]
};

const MEASUREMENTS={
  shoulder_left:{label:"Hombro izquierdo",points:["left_elbow","left_shoulder","V_HIP_CENTER"],group:"Hombro"},
  shoulder_right:{label:"Hombro derecho",points:["right_elbow","right_shoulder","V_HIP_CENTER"],group:"Hombro"},
  elbow_left:{label:"Codo izquierdo",points:["left_shoulder","left_elbow","left_wrist"],group:"Codo"},
  elbow_right:{label:"Codo derecho",points:["right_shoulder","right_elbow","right_wrist"],group:"Codo"},
  wrist_left:{label:"Muñeca izquierda",points:["left_elbow","left_wrist","left_index"],group:"Muñeca"},
  wrist_right:{label:"Muñeca derecha",points:["right_elbow","right_wrist","right_index"],group:"Muñeca"}
};

const POINT_NAMES={
  left_shoulder:"Hombro izquierdo",right_shoulder:"Hombro derecho",
  left_elbow:"Codo izquierdo",right_elbow:"Codo derecho",
  left_wrist:"Muñeca izquierda",right_wrist:"Muñeca derecha",
  left_index:"Índice izquierdo",right_index:"Índice derecho",
  left_hip:"Cadera izquierda",right_hip:"Cadera derecha"
};

const screens=[...document.querySelectorAll(".screen")];
const statusEl=document.getElementById("status");
const videoInput=document.getElementById("videoFile");
const jsonInput=document.getElementById("jsonFile");
const videoPreview=document.getElementById("videoPreview");
const mappingContainer=document.getElementById("mappingContainer");

function status(message){statusEl.textContent=message}

function setScreen(index){
  state.screen=Math.max(0,Math.min(screens.length-1,index));
  screens.forEach((s,i)=>s.classList.toggle("active",i===state.screen));
  screens.forEach((s,i)=>{
    const prev=s.querySelector("[data-prev]");
    const next=s.querySelector("[data-next]");
    if(prev) prev.disabled=i===0;
    if(next && i===screens.length-1) next.disabled=false;
  });
  window.scrollTo({top:0,behavior:"smooth"});
  if(state.screen===1) renderMapping();
}

document.querySelectorAll("[data-prev]").forEach(b=>b.addEventListener("click",()=>setScreen(state.screen-1)));
document.querySelectorAll("[data-next]").forEach(b=>b.addEventListener("click",()=>{
  if(state.screen===0){
    if(!state.kinovea){alert("Cargue primero un JSON de Kinovea.");return}
    renderMapping();
  }
  if(state.screen===1 && !validateMapping(false)) return;
  setScreen(state.screen+1);
}));

document.getElementById("homeButton").addEventListener("click",()=>location.href="../");
document.getElementById("newStudyButton").addEventListener("click",resetStudy);
document.getElementById("saveStudyButton").addEventListener("click",saveStudy);
document.getElementById("loadStudyButton").addEventListener("click",()=>document.getElementById("studyFileInput").click());
document.getElementById("studyFileInput").addEventListener("change",loadStudy);

document.querySelectorAll("[data-measure]").forEach(input=>{
  input.addEventListener("change",()=>{
    if(input.checked) state.selected.add(input.dataset.measure);
    else state.selected.delete(input.dataset.measure);
    renderMapping();
  });
});

videoInput.addEventListener("change",()=>{
  const file=videoInput.files&&videoInput.files[0];
  if(!file)return;
  if(state.videoUrl) URL.revokeObjectURL(state.videoUrl);
  state.videoUrl=URL.createObjectURL(file);
  videoPreview.src=state.videoUrl;
  videoPreview.hidden=false;
  document.getElementById("videoInfo").textContent=file.name;
  status("Vídeo cargado. Cargue o mantenga el JSON de Kinovea para continuar.");
});

jsonInput.addEventListener("change",async()=>{
  const file=jsonInput.files&&jsonInput.files[0];
  if(!file)return;
  try{
    const text=await file.text();
    const json=JSON.parse(text);
    state.kinovea=parseKinoveaJSON(json);
    state.jsonFileName=file.name;
    state.mapping={};
    renderSummary();
    renderMapping();
    status("JSON de Kinovea cargado. Revise la asignación de marcadores.");
  }catch(error){
    state.kinovea=null;
    mappingContainer.innerHTML='<div class="placeholder">No se pudo leer el JSON.</div>';
    status("Error: "+error.message);
  }
});

document.getElementById("analyzeButton").addEventListener("click",analyze);

function parseKinoveaJSON(json){
  if(!json||!json.metadata)throw new Error("No existe metadata de Kinovea.");
  if(!json.data)throw new Error("No existe el bloque data del JSON.");
  const timeseries=Array.isArray(json.data.timeseries)?json.data.timeseries:[];
  if(!timeseries.length)throw new Error("No existen timeseries en el JSON.");
  const markers=timeseries.map(s=>s.name).filter(Boolean);
  const frameCount=Math.max(...timeseries.map(s=>Array.isArray(s.time)?s.time.length:0));
  if(!Number.isFinite(frameCount)||frameCount<1)throw new Error("No existen frames temporales válidos.");
  const frames=[];
  for(let i=0;i<frameCount;i++){
    const landmarks={};
    let time=null;
    timeseries.forEach(series=>{
      if(time===null&&Array.isArray(series.time)&&series.time[i]!==undefined) time=Number(series.time[i]);
      let point=null;
      if(series.data&&series.data["0"]&&series.data["0"][i]) point=series.data["0"][i];
      if(!point&&Array.isArray(series.x)&&Array.isArray(series.y)) point=[series.x[i],series.y[i]];
      if(point&&point.length>=2&&Number.isFinite(Number(point[0]))&&Number.isFinite(Number(point[1]))){
        landmarks[String(series.name)]={x:Number(point[0]),y:Number(point[1])};
      }else{
        landmarks[String(series.name)]=null;
      }
    });
    frames.push({index:i,time:Number.isFinite(time)?time:0,landmarks});
  }
  const duration=frames.length?frames[frames.length-1].time:0;
  return {source:json.metadata.producer||"Kinovea",fps:Number(json.metadata.captureFramerate??json.metadata.userFramerate)||null,imageSize:json.metadata.imageSize||{},markers,frameCount:frames.length,duration,frames};
}

function getRequiredPoints(){
  const required=new Set();
  state.selected.forEach(id=>{
    const def=MEASUREMENTS[id];
    if(!def)return;
    def.points.forEach(p=>{
      if(p==="V_HIP_CENTER"){required.add("left_hip");required.add("right_hip")}
      else required.add(p);
    });
  });
  return [...required];
}

function renderSummary(){
  const k=state.kinovea;
  document.getElementById("summaryFile").textContent=state.jsonFileName||"—";
  document.getElementById("summaryMarkers").textContent=k?String(k.markers.length):"—";
  document.getElementById("summaryFrames").textContent=k?String(k.frameCount):"—";
  document.getElementById("summaryDuration").textContent=k?formatNumber(k.duration,3)+" s":"—";
}

function renderMapping(){
  if(!state.kinovea){mappingContainer.innerHTML='<div class="placeholder">Cargue primero un JSON de Kinovea.</div>';return}
  const required=getRequiredPoints();
  const grouped={Hombro:[],Codo:[],Muñeca:[]};
  required.forEach(point=>{
    const group=point.includes("shoulder")||point.includes("hip")?"Hombro":point.includes("elbow")?"Codo":"Muñeca";
    (grouped[group]||(grouped[group]=[])).push(point);
  });
  let html='<p><strong>Marcadores disponibles:</strong> '+escapeHtml(state.kinovea.markers.join(", "))+'</p>';
  Object.entries(grouped).forEach(([group,points])=>{
    if(!points.length)return;
    html+='<div class="mapping-group"><h3>'+escapeHtml(group)+'</h3><div class="mapping-grid">';
    points.forEach(point=>{
      const current=state.mapping[point]||"";
      html+='<div class="mapping-row"><label>'+escapeHtml(POINT_NAMES[point]||point)+'</label><select data-point="'+escapeHtml(point)+'"><option value="">— No asignado —</option>';
      state.kinovea.markers.forEach(marker=>{
        html+='<option value="'+escapeHtml(marker)+'" '+(current===marker?"selected":"")+'>'+escapeHtml(marker)+'</option>';
      });
      html+='</select></div>';
    });
    html+='</div></div>';
  });
  mappingContainer.innerHTML=html;
  mappingContainer.querySelectorAll("select[data-point]").forEach(select=>{
    select.addEventListener("change",()=>{
      const point=select.dataset.point;
      const marker=select.value||null;
      Object.keys(state.mapping).forEach(key=>{if(key!==point&&marker&&state.mapping[key]===marker)state.mapping[key]=null});
      state.mapping[point]=marker;
      renderMapping();
    });
  });
}

function validateMapping(showAlert){
  const required=getRequiredPoints();
  const missing=required.filter(p=>!state.mapping[p]);
  if(missing.length){
    const text=missing.map(p=>POINT_NAMES[p]||p).join(", ");
    if(showAlert)alert("Faltan marcadores para: "+text);
    status("Faltan marcadores anatómicos por asignar.");
    return false;
  }
  return true;
}

function getPoint(frame,anatomical){
  if(anatomical==="V_HIP_CENTER"){
    const left=getPoint(frame,"left_hip"),right=getPoint(frame,"right_hip");
    if(!left||!right)return null;
    return {x:(left.x+right.x)/2,y:(left.y+right.y)/2};
  }
  const marker=state.mapping[anatomical];
  if(!marker||!frame||!frame.landmarks)return null;
  const point=frame.landmarks[marker];
  return point&&Number.isFinite(point.x)&&Number.isFinite(point.y)?point:null;
}

function angleAtPoint(a,b,c){
  if(!a||!b||!c)return null;
  const ba={x:a.x-b.x,y:a.y-b.y};
  const bc={x:c.x-b.x,y:c.y-b.y};
  const la=Math.hypot(ba.x,ba.y),lc=Math.hypot(bc.x,bc.y);
  if(!la||!lc)return null;
  let cosine=(ba.x*bc.x+ba.y*bc.y)/(la*lc);
  cosine=Math.max(-1,Math.min(1,cosine));
  const angle=Math.acos(cosine)*180/Math.PI;
  return Number.isFinite(angle)?angle:null;
}

function calculateMeasurement(frame,definition){
  const points=definition.points.map(p=>getPoint(frame,p));
  return angleAtPoint(points[0],points[1],points[2]);
}

function analyze(){
  if(!state.kinovea){alert("Cargue un JSON de Kinovea.");return}
  if(!validateMapping(true))return;
  const rows=[];
  const stats={};
  state.selected.forEach(id=>stats[id]={label:MEASUREMENTS[id].label,count:0,min:null,max:null,sum:0});
  state.kinovea.frames.forEach(frame=>{
    state.selected.forEach(id=>{
      const value=calculateMeasurement(frame,MEASUREMENTS[id]);
      if(value===null)return;
      const s=stats[id];s.count++;s.sum+=value;s.min=s.min===null?value:Math.min(s.min,value);s.max=s.max===null?value:Math.max(s.max,value);
      rows.push({time:frame.time,frame:frame.index,label:s.label,value});
    });
  });
  state.results=rows;
  renderResults(stats);
  status("Cálculo completado. Se han procesado "+rows.length+" mediciones angulares válidas.");
}

function renderResults(stats){
  const grid=document.getElementById("resultSummary");
  const entries=Object.entries(stats);
  grid.innerHTML=entries.map(([id,s])=>'<div class="result-card"><span>'+escapeHtml(s.label)+'</span><output>Máx. '+(s.count?formatNumber(s.max,1):"—")+'°</output><small>Media: '+(s.count?formatNumber(s.sum/s.count,1):"—")+'° · Frames válidos: '+s.count+'</small></div>').join("");
  const body=document.getElementById("resultsBody");
  body.innerHTML=state.results.map(r=>'<tr><td>'+formatNumber(r.time,3)+'</td><td>'+r.frame+'</td><td>'+escapeHtml(r.label)+'</td><td>'+formatNumber(r.value,2)+'</td></tr>').join("");
}

function formatNumber(value,decimals){return Number(value).toLocaleString("es-ES",{minimumFractionDigits:decimals,maximumFractionDigits:decimals})}
function escapeHtml(value){return String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}

function resetStudy(){
  if(state.videoUrl){URL.revokeObjectURL(state.videoUrl);state.videoUrl=null}
  state.kinovea=null;state.jsonFileName="";state.mapping={};state.results=[];
  state.selected=new Set(["shoulder_left","shoulder_right","elbow_left","elbow_right","wrist_left","wrist_right"]);
  videoInput.value="";jsonInput.value="";videoPreview.removeAttribute("src");videoPreview.hidden=true;
  document.querySelectorAll("[data-measure]").forEach(i=>i.checked=true);
  document.getElementById("videoInfo").textContent="Ningún vídeo seleccionado.";
  renderSummary();renderMapping();document.getElementById("resultSummary").innerHTML="";document.getElementById("resultsBody").innerHTML="";
  setScreen(0);status("Nuevo estudio preparado.");
}

function saveStudy(){
  const study={
    format:"Ergonomic Analyzer Posturas",
    version:1,
    created:new Date().toISOString(),
    jsonFileName:state.jsonFileName,
    selected:[...state.selected],
    mapping:{...state.mapping}
  };
  const blob=new Blob([JSON.stringify(study,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=url;a.download="estudio_posturas.json";a.click();URL.revokeObjectURL(url);
  status("Estudio guardado. Al cargarlo posteriormente deberá volver a seleccionar el JSON de Kinovea y, si se desea, el vídeo.");
}

async function loadStudy(event){
  const file=event.target.files&&event.target.files[0];if(!file)return;
  try{
    const study=JSON.parse(await file.text());
    if(!study||study.format!=="Ergonomic Analyzer Posturas")throw new Error("El archivo no es un estudio de Posturas válido.");
    state.mapping=study.mapping&&typeof study.mapping==="object"?study.mapping:{};
    state.selected=new Set(Array.isArray(study.selected)?study.selected:Object.keys(MEASUREMENTS));
    document.querySelectorAll("[data-measure]").forEach(i=>i.checked=state.selected.has(i.dataset.measure));
    renderMapping();setScreen(state.kinovea?1:0);status("Estudio cargado. Seleccione el JSON de Kinovea correspondiente para recalcular.");
  }catch(error){alert(error.message);status("No se pudo cargar el estudio.")}
  event.target.value="";
}

renderSummary();
renderMapping();
})();