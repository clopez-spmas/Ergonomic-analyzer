(()=>{"use strict";
const form=document.getElementById("ocraForm"),status=document.getElementById("status"),fileInput=document.getElementById("fileInput");
let dirty=false;
const STORAGE_KEY="ergonomic-analyzer-ocra-draft",fields=[...form.querySelectorAll("input,select,textarea")];

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
const values=()=>{const o={savedAt:new Date().toISOString(),values:{},kinovea:{...kinoveaState,videoUrl:""}};fields.forEach(f=>o.values[f.name]=f.type==="checkbox"?f.checked:f.value);return o};
function apply(o){if(!o||!o.values)throw Error("Formato no válido");fields.forEach(f=>{if(!(f.name in o.values))return;if(f.type==="checkbox")f.checked=!!o.values[f.name];else f.value=o.values[f.name]??""});if(o.kinovea)restoreKinoveaState(o.kinovea);dirty=false;safeCalculate();status.textContent="Estudio cargado correctamente."}
function lookup(table,x){let r=table[0][1];for(const [k,v] of table){if(x>=k)r=v;else break}return r}
const duration=[[0,.50],[121,.65],[181,.75],[241,.85],[301,.925],[361,.95],[421,1],[481,1.5]];
const recTable={0:1,0.5:1.025,1:1.05,1.5:1.086,2:1.12,2.5:1.16,3:1.20,3.5:1.265,4:1.33,4.5:1.40,5:1.48,5.5:1.58,6:1.70,6.5:1.83,7:2,7.5:2.25,8:2.5};
const recAuto={480:[7,6,5,4,3,2,1,0],460:[7,6,5,4,3,2,1],440:[6.5,5.5,4.5,3.5,2.5,1.5,.5],420:[6,5,4,3,2.5,1.5,0],390:[5.5,4.5,3.5,2.5,1.5,.5,0],360:[5,4,3,2,1,0],330:[4.5,3.5,2.5,1.5,.5,0],300:[4,3,2,1,0],270:[3.5,2.5,1.5,.5,0],240:[3,2,1,0],210:[2.5,1.5,.5,0],180:[2,1,0],120:[1,0],0:[0]};
const freqYes=[[0,0],[2.5,0],[7.5,0],[12.5,0],[17.5,0],[20,0],[22.5,.5],[27.5,1],[30,1],[32.5,2],[35,2],[37.5,3],[40,3],[42.5,4],[45,4],[47.5,5],[50,5],[52.5,6],[55,6],[57.5,7],[60,7],[62.5,8],[65,8],[67.5,9],[70,9],[72.5,9]];
const freqNo=[[0,0],[2.5,0],[7.5,0],[12.5,0],[17.5,0],[20,0],[22.5,.5],[27.5,1],[30,2],[32.5,2],[35,2],[37.5,4],[40,4],[42.5,5],[45,5],[47.5,6],[50,6],[52.5,7],[55,7],[57.5,8],[60,8],[62.5,9],[65,9],[67.5,10],[70,10],[72.5,10]];
const force34=[[0,0],[.05,.5],[.10,.5],[.18,1],[.26,1.5],[.33,2],[.37,2.5],[.42,3],[.46,3.5],[.50,4],[.54,4.5],[.58,5],[.63,5.5],[.67,6],[.75,6.5],[.83,7],[.92,7.5],[1,8]];
const force57=[[0,0],[.16,2],[.33,4],[.66,6],[1,8],[1.5,9],[2,10],[2.5,11],[3,12],[3.5,13],[4,14],[4.5,15],[5,16],[5.63,17],[6.25,18],[6.88,19],[7.5,20],[8.13,21],[8.75,22],[9.38,23],[10,24]];
const force810=[[0,0],[.16,3],[.33,6],[.66,9],[1,12],[1.33,13],[1.67,14],[2,15],[2.33,16],[2.67,17],[3,18],[3.33,19],[3.67,20],[4,21],[4.33,22],[4.67,23],[5,24],[5.63,25],[6.25,26],[6.88,27],[7.5,28],[8.13,29],[8.75,30],[9.38,31],[10,32]];
function recoveryHours(eff,count,meal){const row=recAuto[Math.round(eff)];if(!row)return null;const valid=Math.max(0,Math.floor(count)+(meal>=30?1:0));return row[Math.min(valid,row.length-1)]}
function recoveryMultiplier(h){if(!Number.isFinite(h))return null;const x=Math.max(0,Math.min(8,h));const keys=Object.keys(recTable).map(Number);let best=keys[0];for(const k of keys){if(Math.abs(k-x)<Math.abs(best-x))best=k}return recTable[best]}
function freq(actionsPerMin,interruptions){return lookup(interruptions?freqYes:freqNo,actionsPerMin)}
function forceScore(seconds34,seconds57,seconds810,cycle){if(cycle<=0)return 0;return lookup(force34,seconds34/cycle)+lookup(force57,seconds57/cycle)+lookup(force810,seconds810/cycle)}
function stereo(prefix){return (form.elements[prefix+"StereoAlmost"]?.checked||form.elements[prefix+"StereoCycle8"]?.checked)?3:(form.elements[prefix+"StereoHalf"]?.checked||form.elements[prefix+"StereoCycle815"]?.checked||form.elements[prefix+"StereoStatic"]?.checked)?1.5:0}
function classification(x){if(!Number.isFinite(x))return "—";if(x<7.5)return "VERDE · Riesgo aceptable";if(x<=11)return "AMARILLO · Riesgo muy leve";if(x<=14)return "ROJO SUAVE · Riesgo medio leve";if(x<=22.5)return "ROJO · Riesgo medio";return "VIOLETA · Riesgo elevado"}

let kinoveaState={jsonFiles:[],dataSets:[],data:null,mapping:{},range:{mode:"all",start:0,end:0,cycles:1},
 postureManual:{
   duration:0,
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
  return '<tr><td>JSON '+(di+1)+'</td><td>'+escK(ds.fileName)+'</td><td>'+escK(ds.producer||ds.data?.producer||"Kinovea")+'</td><td>'+escK(ds.kinoveaVersion||"—")+'</td><td>'+fmt(ds.data?.duration||0,2)+' s</td><td>'+escK((ds.sha256||"—").slice(0,16)+(ds.sha256?"…":""))+'</td><td>'+(selected.length?selected.map(escK).join("<br>"):"Ninguno")+'</td></tr>';
 }).join("");
 t.innerHTML='<div class="result-table-wrap"><table class="compact-table"><thead><tr><th>Archivo</th><th>JSON</th><th>Origen</th><th>Versión</th><th>Duración</th><th>SHA-256</th><th>Marcadores seleccionados</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="notice"><strong>Trazabilidad:</strong> el estudio guarda dentro de su propio JSON una copia del JSON original de cada archivo Kinovea importado, junto con su nombre, versión, fecha de importación e identificación SHA-256.</div>';
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
function kKinoveaFileId(kind,side){const required=kRequired(kind,side);return (kinoveaState.dataSets||[]).find(ds=>required.every(key=>!!ds.mapping?.[key]))?.id||null}
function kSideHasKinovea(kind,side){return !!kKinoveaFileId(kind,side) && !!kinoveaState.data}
function kSourceLabel(source){return source==="kinovea"?"KINOVEA":"MANUAL"}
function kManualDuration(){
 const p=ensureManualPosture(),r=kRange();
 return r?.duration>0?r.duration:kNum(p.duration,0);
}
function kManualRows(kind,side,threshold){
 const p=ensureManualPosture()[kind][side],duration=kManualDuration();
 const label=side==="right"?"derecha":"izquierda";
 if(duration<=0)return '<tr><td>—</td><td>Manual</td><td colspan="3">Indique la duración del periodo manual analizado.</td></tr>';
 const flex=Math.max(0,p.flex),ext=Math.max(0,p.ext);
 const n1=kind==="shoulder"?"Flexión":kind==="elbow"?"Flexión":"Flexión de muñeca";
 const n2=kind==="shoulder"?"Extensión":kind==="elbow"?"Extensión":"Extensión de muñeca";
 const criterion=kind==="shoulder"?"≥ 80°":"&gt; "+threshold+"°";
 return '<tr><td>'+n1+' '+label+'</td><td>MANUAL</td><td>'+criterion+'</td><td>'+fmt(flex,3)+' s</td><td>'+fmt(flex/duration*100,2)+' %</td></tr>'+
        '<tr><td>'+n2+' '+label+'</td><td>MANUAL</td><td>'+criterion+'</td><td>'+fmt(ext,3)+' s</td><td>'+fmt(ext/duration*100,2)+' %</td></tr>';
}
function kAnalysisRows(kind,threshold){
 const r=kRange(),manual=ensureManualPosture(),rows=[];
 ["right","left"].forEach(side=>{
   const p=manual[kind][side];
   if(p.source==="manual"){
     rows.push(kManualRows(kind,side,threshold));
     return;
   }
   if(!r||!kinoveaState.data||kMissingMarkers(kind,side).length)return;
   const frames=kinoveaState.data.frames;
   let a1=0,a2=0,valid=0,base=null;
   for(let i=0;i<frames.length-1;i++){
     const a=frames[i],b=frames[i+1],dt=Math.max(0,Math.min(b.time,r.end)-Math.max(a.time,r.start));if(dt<=0)continue;
     let va,vb;
     if(kind==="shoulder"){
       va=kSigned(kPoint(a,side+"_hip"),kPoint(a,side+"_shoulder"),kPoint(a,side+"_elbow"),side==="right"?"right":"left");
       vb=kSigned(kPoint(b,side+"_hip"),kPoint(b,side+"_shoulder"),kPoint(b,side+"_elbow"),side==="right"?"right":"left");
     }else if(kind==="elbow"){
       va=kAngle(kPoint(a,side+"_shoulder"),kPoint(a,side+"_elbow"),kPoint(a,side+"_wrist"));
       vb=kAngle(kPoint(b,side+"_shoulder"),kPoint(b,side+"_elbow"),kPoint(b,side+"_wrist"));
     }else{
       va=kSigned(kPoint(a,side+"_elbow"),kPoint(a,side+"_wrist"),kPoint(a,side+"_index"),side==="right"?"right":"left");
       vb=kSigned(kPoint(b,side+"_elbow"),kPoint(b,side+"_wrist"),kPoint(b,side+"_index"),side==="right"?"right":"left");
     }
     if(!Number.isFinite(va)||!Number.isFinite(vb))continue;
     if(base===null)base=va;
     const v=(va+vb)/2-base;
     valid+=dt;
     if(kind==="shoulder"){if(v>=80)a1+=dt;if(v<-20)a2+=dt;}
     else {if(v>threshold)a1+=dt;if(v<-threshold)a2+=dt;}
   }
   if(valid){
     const label=side==="right"?"derecha":"izquierda",total=r.duration||1;
     const n1=kind==="shoulder"?"Flexión":kind==="elbow"?"Flexión":"Flexión de muñeca";
     const n2=kind==="shoulder"?"Extensión":kind==="elbow"?"Extensión":"Extensión de muñeca";
     const criterion=kind==="shoulder"?"≥ 80°":"&gt; "+threshold+"°";
     rows.push('<tr><td>'+n1+' '+label+'</td><td>KINOVEA</td><td>'+criterion+'</td><td>'+fmt(a1,3)+' s</td><td>'+fmt(a1/total*100,2)+' %</td></tr>');
     rows.push('<tr><td>'+n2+' '+label+'</td><td>KINOVEA</td><td>'+criterion+'</td><td>'+fmt(a2,3)+' s</td><td>'+fmt(a2/total*100,2)+' %</td></tr>');
   }
 });
 const duration=kManualDuration();
 return '<div class="notice"><strong>Origen de cada dato:</strong> KINOVEA = calculado automáticamente desde el JSON; MANUAL = introducido por el evaluador. Puede usar KINOVEA para un lado y MANUAL para el otro.</div>'+
   (kind==="shoulder"&&!kinoveaState.data?'<div class="form-grid"><label>Duración del periodo manual analizado (s)<input id="manualPostureDuration" type="number" min="0" step="0.01" value="'+kNum(manual.duration,0)+'"></label></div>':"")+
   '<div class="result-table-wrap"><table class="compact-table"><thead><tr><th>Movimiento</th><th>Origen</th><th>Criterio</th><th>Tiempo</th><th>% del tiempo analizado</th></tr></thead><tbody>'+
   (rows.length?rows.join(""):'<tr><td colspan="5">No hay datos de postura todavía.</td></tr>')+
   '</tbody></table></div>'+
   (duration>0?'<div class="notice">Periodo utilizado: '+fmt(duration,2)+' s.</div>':'');
}
function kManualControls(kind,side,threshold){
 const p=ensureManualPosture()[kind][side],label=side==="right"?"Derecha":"Izquierda";
 const canK=kSideHasKinovea(kind,side);
 return '<fieldset class="manual-posture-box"><legend>'+label+' · origen del dato</legend>'+
   '<label>Fuente<select data-posture-source="'+kind+'" data-posture-side="'+side+'">'+
   '<option value="kinovea" '+(p.source==="kinovea"?"selected":"")+' '+(!canK?"disabled":"")+'>Kinovea'+(!canK?" · no disponible":"")+'</option>'+
   '<option value="manual" '+(p.source==="manual"?"selected":"")+'>Manual</option></select></label>'+
   '<div class="manual-posture-fields" data-manual-fields="'+kind+'-'+side+'" '+(p.source==="manual"?"":"hidden")+'>'+
   '<label>Tiempo en '+(kind==="shoulder"?"flexión":kind==="elbow"?"flexión de codo":"flexión de muñeca")+' (s)<input type="number" min="0" step="0.01" data-manual-posture="'+kind+'" data-manual-side="'+side+'" data-manual-field="flex" value="'+fmt(p.flex,2).replace(",",".")+'"></label>'+
   '<label>Tiempo en '+(kind==="shoulder"?"extensión":kind==="elbow"?"extensión de codo":"extensión de muñeca")+' (s)<input type="number" min="0" step="0.01" data-manual-posture="'+kind+'" data-manual-side="'+side+'" data-manual-field="ext" value="'+fmt(p.ext,2).replace(",",".")+'"></label>'+
   '</div>'+
   '<div class="notice">Este bloque está marcado como MANUAL y no procede de Kinovea.</div></fieldset>';
}
function kPanel(kind,title,defaultThreshold){
 const id=kind==="shoulder"?"ocraShoulderPanel":kind==="elbow"?"ocraElbowPanel":"ocraWristPanel",box=document.getElementById(id);if(!box)return;
 const current=kinoveaState[kind]||{threshold:defaultThreshold};
 const threshold=kind==="wrist"?Math.max(1,current.threshold||defaultThreshold):defaultThreshold;
 ensureManualPosture();
 const missing=kMissingMessage(kind);
 const warning=missing
  ?'<div class="notice">'+missing+' Puede seleccionar MANUAL para el lado que no pueda obtenerse mediante Kinovea.</div>'
  :'<div class="notice">Cada lado puede utilizar una fuente distinta: KINOVEA o MANUAL.</div>';
 box.innerHTML='<strong>Datos de postura</strong>'+warning+
   (kind==="wrist"?'<div class="form-grid"><label>Umbral angular (°)<input id="wristThreshold" type="number" min="1" max="180" value="'+threshold+'"></label></div>':'')+
   '<div class="side-grid">'+kManualControls(kind,"right",threshold)+kManualControls(kind,"left",threshold)+'</div>'+
   '<div id="'+kind+'Result" class="result-holder">'+kAnalysisRows(kind,threshold)+'</div>';
 box.querySelectorAll("[data-posture-source]").forEach(sel=>sel.onchange=()=>{
   const side=sel.dataset.postureSide;const p=ensureManualPosture()[kind][side];p.source=sel.value;p.kinoveaFileId=sel.value==="kinovea"?kKinoveaFileId(kind,side):null;dirty=true;kRenderAnalyses();
 });
 box.querySelectorAll("[data-manual-posture]").forEach(input=>input.onchange=()=>{
   const p=ensureManualPosture()[kind][input.dataset.manualSide];
   p[input.dataset.manualField]=Math.max(0,kNum(input.value,0));dirty=true;kRenderAnalyses();
 });
 const durationInput=document.getElementById("manualPostureDuration");
 if(durationInput)durationInput.onchange=()=>{ensureManualPosture().duration=Math.max(0,kNum(durationInput.value,0));dirty=true;kRenderAnalyses();};
 const thresholdInput=document.getElementById("wristThreshold");
 if(thresholdInput)thresholdInput.oninput=()=>{kinoveaState.wrist={...(kinoveaState.wrist||{}),threshold:Math.max(1,kNum(thresholdInput.value,defaultThreshold))};dirty=true;kRenderAnalyses();};
}
function kRenderAnalyses(){["shoulder","elbow","wrist"].forEach(kind=>kPanel(kind,kind==="shoulder"?"hombro":kind==="elbow"?"codo":"muñeca",kind==="shoulder"?80:60))}
function restoreKinoveaState(saved){
 kinoveaState={...kinoveaState,...saved,videoUrl:""};
 if(saved.range)kinoveaState.range={...{mode:"all",start:0,end:0,cycles:1},...saved.range};
 if(saved.dataSets)kinoveaState.dataSets=saved.dataSets;
 if(saved.shoulder)kinoveaState.shoulder=saved.shoulder;if(saved.elbow)kinoveaState.elbow=saved.elbow;if(saved.wrist)kinoveaState.wrist=saved.wrist;
 if(saved.postureManual)kinoveaState.postureManual={...ensureManualPosture(),...saved.postureManual};
 ensureManualPosture();
 renderKRange();renderKinovea();
}

function renderKinoveaFileList(){
 const el=document.getElementById("kinoveaFileList");if(!el)return;
 const files=kinoveaState.dataSets||[];
 el.innerHTML=files.length
  ? "<strong>JSON cargados: "+files.length+"</strong><ul>"+files.map((x,i)=>"<li><span>"+(i+1)+". "+escK(x.fileName)+"</span> <small>SHA-256: "+escK(x.sha256||"no disponible")+"</small> <button type=\"button\" class=\"toolbar-btn\" data-remove-kinovea=\""+i+"\">Eliminar</button></li>").join("")+"</ul>"
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
 const ds={id:"kinovea_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),fileName:file.name,importedAt:new Date().toISOString(),producer:data.producer,kinoveaVersion:(data.producer||"").match(/Kinovea[.\\s_-]*([0-9.]+)/i)?.[1]||null,sha256:hash,rawJson:raw,data,mapping:{}};
 kinoveaState.dataSets.push(ds);
 kinoveaState.data=kinoveaState.data||data;
 kinoveaState.jsonFiles=kinoveaState.dataSets.map(x=>x.fileName);
 if(kinoveaState.dataSets.length===1)kinoveaState.range={mode:"all",start:0,end:data.duration,cycles:1};
 dirty=true;renderKinovea();renderKRange();renderKinoveaFileList();
 kSetStatus("JSON de Kinovea cargado correctamente. El estudio conservará una copia del JSON original y su huella SHA-256.");
}

function calculate(){
 const official=n("turnoOficial"),eff=n("turnoEfectivoManual")||official,pauses=n("tiempoPausas"),meal=n("pausaComer"),nonRep=n("noRepetitivo"),tntr=Math.max(0,eff-pauses-meal-nonRep);
 document.getElementById("turnoEfectivo").textContent=fmt(eff,1);document.getElementById("tntrPausas").textContent=fmt(pauses,1);document.getElementById("tntrComida").textContent=fmt(meal,1);document.getElementById("tntrNoRep").textContent=fmt(nonRep,1);document.getElementById("tiempoNeto").textContent=fmt(tntr,1);document.getElementById("duracionTNTR").textContent=fmt(tntr,1);
 const autoH=recoveryHours(eff,n("numPausas"),meal),manualRaw=form.elements.horasSinRecManual?.value.trim(),manual=manualRaw===""?null:parseFloat(manualRaw),useH=Number.isFinite(manual)?Math.max(0,Math.min(8,manual)):autoH,rm=recoveryMultiplier(useH);
 document.getElementById("recAutomatico").textContent=autoH===null?"—":fmt(autoH,1);document.getElementById("recMultAutomatico").textContent=autoH===null?"—":fmt(recoveryMultiplier(autoH),3);document.getElementById("horasSinRecuperacion").textContent=useH===null?"—":fmt(useH,1);document.getElementById("recOrigen").textContent=useH===null?"—":(Number.isFinite(manual)?"Manual":"Automático");document.getElementById("multRecuperacion").textContent=rm===null?"—":fmt(rm,3);
 const md=lookup(duration,tntr);document.getElementById("multDuracion").textContent=fmt(md,3);
 const cycles=n("ciclosEfectivos"),obs=n("cicloObservado"),cycle=cycles>0?60*tntr/cycles:0,diff=cycle>0&&obs>0?Math.abs(cycle-obs)/cycle*100:null;
 document.getElementById("cicloNeto").textContent=cycle?fmt(cycle,2):"—";document.getElementById("diferenciaCiclo").textContent=diff===null?"—":fmt(diff,2);document.getElementById("minNoJustificados").textContent=diff===null?"—":fmt(Math.abs(cycle-obs)*cycles/60,2);document.getElementById("alertaCiclo").textContent=diff===null?"—":diff>5?"Revisar: > 5 %":"Concordante: ≤ 5 %";
 const actionCycle=obs||cycle,dxA=n("dxAcciones"),ixA=n("ixAcciones"),dxMin=actionCycle>0?dxA*60/actionCycle:0,ixMin=actionCycle>0?ixA*60/actionCycle:0,dxF=freq(dxMin,form.elements.dxInterrupciones.value==="si"),ixF=freq(ixMin,form.elements.ixInterrupciones.value==="si"),dxF34=actionCycle>0?lookup(force34,n("dxFuerza34")/actionCycle):0,dxF57=actionCycle>0?lookup(force57,n("dxFuerza57")/actionCycle):0,dxF810=actionCycle>0?lookup(force810,n("dxFuerza810")/actionCycle):0,ixF34=actionCycle>0?lookup(force34,n("ixFuerza34")/actionCycle):0,ixF57=actionCycle>0?lookup(force57,n("ixFuerza57")/actionCycle):0,ixF810=actionCycle>0?lookup(force810,n("ixFuerza810")/actionCycle):0,dxForce=forceScore(n("dxFuerza34"),n("dxFuerza57"),n("dxFuerza810"),actionCycle),ixForce=forceScore(n("ixFuerza34"),n("ixFuerza57"),n("ixFuerza810"),actionCycle),dxS=stereo("dx"),ixS=stereo("ix"),a=[...form.querySelectorAll("[data-comp-a]")].filter(x=>x.checked).reduce((s,x)=>s+(parseFloat(x.dataset.compA)||0),0),b=parseFloat(form.elements.complementarioB.value)||0,comp=a+b;
 document.getElementById("dxAccionesMin").textContent=fmt(dxMin,2);document.getElementById("ixAccionesMin").textContent=fmt(ixMin,2);document.getElementById("dxFrecuencia").textContent=fmt(dxF,2);document.getElementById("ixFrecuencia").textContent=fmt(ixF,2);document.getElementById("dxFuerzaScore").textContent=fmt(dxForce,2);document.getElementById("ixFuerzaScore").textContent=fmt(ixForce,2);document.getElementById("dxStereoScore").textContent=fmt(dxS,2);document.getElementById("ixStereoScore").textContent=fmt(ixS,2);document.getElementById("compA").textContent=fmt(a,2);document.getElementById("compB").textContent=fmt(b,2);document.getElementById("compTotal").textContent=fmt(comp,2);document.getElementById("finalFreqActionsDx").textContent=fmt(dxMin,2);document.getElementById("finalFreqActionsIx").textContent=fmt(ixMin,2);document.getElementById("finalForce34Dx").textContent=fmt(dxF34,2);document.getElementById("finalForce57Dx").textContent=fmt(dxF57,2);document.getElementById("finalForce810Dx").textContent=fmt(dxF810,2);document.getElementById("finalForce34Ix").textContent=fmt(ixF34,2);document.getElementById("finalForce57Ix").textContent=fmt(ixF57,2);document.getElementById("finalForce810Ix").textContent=fmt(ixF810,2);document.getElementById("finalStereoDx").textContent=fmt(dxS,2);document.getElementById("finalStereoIx").textContent=fmt(ixS,2);document.getElementById("finalCompADx").innerHTML=[...form.querySelectorAll("[data-comp-a]")].filter(x=>x.checked).map(x=>escK(x.parentElement.textContent.trim())+" · "+fmt(parseFloat(x.dataset.compA)||0,2)).join("<br>")||"Ninguno";document.getElementById("finalCompAIx").innerHTML=document.getElementById("finalCompADx").innerHTML;document.getElementById("finalCompBDx").textContent=fmt(b,2);document.getElementById("finalCompBIx").textContent=fmt(b,2);
 const dxBase=dxF+dxForce+dxS+comp,ixBase=ixF+ixForce+ixS+comp,dxFinal=dxBase*(rm??1)*md,ixFinal=ixBase*(rm??1)*md;
 const set=(id,v,d=2)=>document.getElementById(id).textContent=Number.isFinite(v)?fmt(v,d):"—";
 set("finalFreqDx",dxF);set("finalForceDx",dxForce);set("finalPostureDx",dxS);set("finalCompDx",comp);set("finalBaseDx",dxBase);set("finalRecDx",rm??1,3);set("finalDurDx",md,3);set("resultadoFinalDx",dxFinal);document.getElementById("clasificacionDx").textContent=classification(dxFinal);
 set("finalFreqIx",ixF);set("finalForceIx",ixForce);set("finalPostureIx",ixS);set("finalCompIx",comp);set("finalBaseIx",ixBase);set("finalRecIx",rm??1,3);set("finalDurIx",md,3);set("resultadoFinalIx",ixFinal);document.getElementById("clasificacionIx").textContent=classification(ixFinal);
}
function safeCalculate(){try{calculate();return true}catch(error){console.error("OCRA calculate:",error);status.textContent="Se ha producido un error en el cálculo. La navegación continúa disponible.";return false}}
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


function initCore(){
fields.forEach(f=>{f.addEventListener("input",markDirty);f.addEventListener("change",markDirty)});
document.getElementById("homeBtn").addEventListener("click",()=>{if(confirm("¿Volver al inicio? Si existen cambios sin guardar, guarde el estudio antes de continuar."))location.href="../"});
document.getElementById("saveBtn").addEventListener("click",async()=>{const d=values(),json=JSON.stringify(d,null,2),blob=new Blob([json],{type:"application/json"});try{if(window.showSaveFilePicker){const handle=await window.showSaveFilePicker({suggestedName:"estudio-ocra.json",types:[{description:"Estudio OCRA",accept:{"application/json":[".json"]}}]});const writable=await handle.createWritable();await writable.write(blob);await writable.close();localStorage.setItem(STORAGE_KEY,JSON.stringify(d));dirty=false;status.textContent="Estudio guardado correctamente en la ubicación seleccionada.";}else{const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="estudio-ocra.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);localStorage.setItem(STORAGE_KEY,JSON.stringify(d));dirty=false;status.textContent="Estudio guardado. El navegador ha utilizado su carpeta de descargas predeterminada.";}}catch(error){if(error?.name==="AbortError"){status.textContent="Guardado cancelado. El estudio no se ha modificado.";return}console.error("OCRA save:",error);status.textContent="No se ha podido guardar el estudio.";}});
document.getElementById("loadBtn").addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",async()=>{const file=fileInput.files[0];if(!file)return;try{apply(JSON.parse(await file.text()))}catch(e){status.textContent="No se ha podido cargar el estudio. El archivo no tiene un formato OCRA válido."}fileInput.value=""});
document.getElementById("newBtn").addEventListener("click",()=>{if(!confirm("¿Crear un estudio nuevo? Se perderán los datos no guardados."))return;form.reset();dirty=false;status.textContent="Nuevo estudio iniciado.";window.OCRA_Navigation.show(0);});
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=true}});
try{const draft=localStorage.getItem(STORAGE_KEY);if(draft){apply(JSON.parse(draft))}}catch(e){}

}

function initKinovea(){
addKinoveaFileInput();
bindKinovea();
renderKinovea();
}

function initApp(){
  // La navegación se inicializa primero y no depende del cálculo ni de Kinovea.
  initNavigation();
  try{initCore()}catch(error){console.error("OCRA initCore:",error);status.textContent="El estudio está disponible, pero se ha producido un error al inicializar algunos controles."}
  try{initKinovea()}catch(error){console.error("OCRA initKinovea:",error);kSetStatus("Los controles de Kinovea no se han podido inicializar correctamente.")}
}

initApp();

})();