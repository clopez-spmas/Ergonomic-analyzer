(()=>{"use strict";
const form=document.getElementById("ocraForm"),screens=[...document.querySelectorAll(".screen")],counter=document.getElementById("screenCounter"),prev=document.getElementById("prevBtn"),next=document.getElementById("nextBtn"),status=document.getElementById("status"),fileInput=document.getElementById("fileInput");
let current=0,dirty=false;
const STORAGE_KEY="ergonomic-analyzer-ocra-draft",fields=[...form.querySelectorAll("input,select,textarea")];
const n=name=>{const v=parseFloat(form.elements[name]?.value);return Number.isFinite(v)?v:0};
const fmt=(v,d=2)=>Number.isFinite(v)?v.toFixed(d).replace(".",","):"—";
const values=()=>{const o={savedAt:new Date().toISOString(),values:{},kinovea:kinoveaState};fields.forEach(f=>o.values[f.name]=f.type==="checkbox"?f.checked:f.value);return o};
function apply(o){if(!o||!o.values)throw Error("Formato no válido");fields.forEach(f=>{if(!(f.name in o.values))return;if(f.type==="checkbox")f.checked=!!o.values[f.name];else f.value=o.values[f.name]??""});if(o.kinovea)restoreKinoveaState(o.kinovea);dirty=false;calculate();status.textContent="Estudio cargado correctamente."}
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

let kinoveaState={jsonFileName:"",videoUrl:"",data:null,mapping:{},range:{mode:"all",start:0,end:0,cycles:1}};
const KPOINTS=[
 ["right_hip","Cadera derecha"],["left_hip","Cadera izquierda"],
 ["right_shoulder","Hombro derecho"],["left_shoulder","Hombro izquierdo"],
 ["right_elbow","Codo derecho"],["left_elbow","Codo izquierdo"],
 ["right_wrist","Muñeca derecha"],["left_wrist","Muñeca izquierda"],
 ["right_index","Índice derecho"],["left_index","Índice izquierdo"]
];
const kNum=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d};
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
function kPoint(frame,key){const marker=kinoveaState.mapping[key];return marker?frame.landmarks[marker]:null}
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
function renderKinovea(){
 const s=document.getElementById("kinoveaSummary"),t=document.getElementById("kinoveaDataTable"),m=document.getElementById("kinoveaMapping");
 if(!kinoveaState.data){s.innerHTML='<div class="placeholder">Cargue el JSON de Kinovea.</div>';t.innerHTML='<div class="placeholder">Todavía no hay datos importados.</div>';m.innerHTML='<strong>Asignación de marcadores</strong><div class="placeholder">Cargue el JSON de Kinovea.</div>';return}
 const d=kinoveaState.data;
 s.innerHTML='<strong>Datos importados</strong><div class="result-grid"><div><span>Productor</span><output>'+escK(d.producer)+'</output></div><div><span>Marcadores</span><output>'+d.markers.length+'</output></div><div><span>Frames</span><output>'+d.frameCount+'</output></div><div><span>Duración</span><output>'+fmt(d.duration,2)+' s</output></div><div><span>FPS</span><output>'+fmt(d.fps,3)+'</output></div></div>';
 const opts=d.markers.map(x=>'<option value="'+escK(x)+'">'+escK(x)+'</option>').join("");
 m.innerHTML='<strong>Asignación de marcadores</strong><p>Asigne cada marcador de Kinovea a un punto anatómico. Un marcador no puede asignarse a dos puntos.</p><div class="form-grid">'+KPOINTS.map(([key,label])=>'<label>'+label+'<select data-kmap="'+key+'"><option value="">No asignado</option>'+opts+'</select></label>').join("")+'</div>';
 m.querySelectorAll("[data-kmap]").forEach(sel=>{sel.value=kinoveaState.mapping[sel.dataset.kmap]||"";sel.onchange=()=>{const v=sel.value;const duplicate=v&&Object.entries(kinoveaState.mapping).some(([k,x])=>k!==sel.dataset.kmap&&x===v);if(duplicate){sel.value="";kSetStatus("Ese marcador de Kinovea ya está asignado a otro punto anatómico.");return}kinoveaState.mapping[sel.dataset.kmap]=v;dirty=true;kRenderAnalyses();}});
 const rows=d.frames.slice(0,12).map(f=>'<tr><td>'+f.index+'</td><td>'+fmt(f.time,3)+'</td><td>'+Object.keys(f.landmarks).length+'</td></tr>').join("");
 t.innerHTML='<strong>Muestra de datos por frame</strong><div class="result-table-wrap"><table class="compact-table"><thead><tr><th>Frame</th><th>Tiempo (s)</th><th>Marcadores válidos</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
 kRenderAnalyses();
}
function renderKRange(){
 const mode=document.getElementById("kinoveaRangeMode");if(!mode)return;
 mode.value=kinoveaState.range.mode;
 document.getElementById("kinoveaStart").value=kinoveaState.range.start??0;
 document.getElementById("kinoveaEnd").value=kinoveaState.range.end??(kinoveaState.data?.duration||0);
 document.getElementById("kinoveaCycles").value=kinoveaState.range.cycles||1;
 const interval=kinoveaState.range.mode==="interval",cycles=kinoveaState.range.mode==="cycles";
 document.getElementById("kinoveaStartField").hidden=!interval;document.getElementById("kinoveaEndField").hidden=!interval;document.getElementById("kinoveaCyclesField").hidden=!cycles;
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
function kAnalysisRows(kind,view,direction,threshold){
 const r=kRange();if(!r)return '<div class="placeholder">Cargue el JSON de Kinovea.</div>';
 const frames=kinoveaState.data.frames;let rows=[];
 const sides=view==="frontal"?["right","left"]:[view==="profile-left"?"left":"right"];
 sides.forEach(side=>{
  let a1=0,a2=0,valid=0,base=null;
  for(let i=0;i<frames.length-1;i++){
   const a=frames[i],b=frames[i+1],dt=Math.max(0,Math.min(b.time,r.end)-Math.max(a.time,r.start));if(dt<=0)continue;
   let va,vb;
   if(kind==="shoulder") va=view==="frontal"?kAngle(kPoint(a,side+"_hip"),kPoint(a,side+"_shoulder"),kPoint(a,side+"_elbow")):kSigned(kPoint(a,side+"_hip"),kPoint(a,side+"_shoulder"),kPoint(a,side+"_elbow"),direction);
   if(kind==="shoulder") vb=view==="frontal"?kAngle(kPoint(b,side+"_hip"),kPoint(b,side+"_shoulder"),kPoint(b,side+"_elbow")):kSigned(kPoint(b,side+"_hip"),kPoint(b,side+"_shoulder"),kPoint(b,side+"_elbow"),direction);
   if(kind==="elbow") va=view==="frontal"?kRotation(kPoint(a,side+"_elbow"),kPoint(a,side+"_wrist"),kPoint(a,side+"_index")):kAngle(kPoint(a,side+"_shoulder"),kPoint(a,side+"_elbow"),kPoint(a,side+"_wrist"));
   if(kind==="elbow") vb=view==="frontal"?kRotation(kPoint(b,side+"_elbow"),kPoint(b,side+"_wrist"),kPoint(b,side+"_index")):kAngle(kPoint(b,side+"_shoulder"),kPoint(b,side+"_elbow"),kPoint(b,side+"_wrist"));
   if(kind==="wrist") va=view==="frontal"?kRotation(kPoint(a,side+"_elbow"),kPoint(a,side+"_wrist"),kPoint(a,side+"_index")):kSigned(kPoint(a,side+"_elbow"),kPoint(a,side+"_wrist"),kPoint(a,side+"_index"),direction);
   if(kind==="wrist") vb=view==="frontal"?kRotation(kPoint(b,side+"_elbow"),kPoint(b,side+"_wrist"),kPoint(b,side+"_index")):kSigned(kPoint(b,side+"_elbow"),kPoint(b,side+"_wrist"),kPoint(b,side+"_index"),direction);
   if(!Number.isFinite(va)||!Number.isFinite(vb))continue;
   if(base===null)base=va;
   const v=kind==="shoulder"&&view==="frontal"?((va+vb)/2):( (va+vb)/2-base );
   valid+=dt;
   if(kind==="shoulder"&&view==="frontal"){if(v>=80)a1+=dt}
   else {if(v>threshold)a1+=dt;if(v<-threshold)a2+=dt}
  }
  if(valid){const label=side==="right"?"derecha":"izquierda",total=r.duration||1; if(kind==="shoulder"&&view==="frontal")rows.push('<tr><td>Abducción '+label+'</td><td>≥ 80°</td><td>'+fmt(a1,3)+' s</td><td>'+fmt(a1/total*100,2)+' %</td></tr>'); else if(kind==="elbow"&&view==="frontal")rows.push('<tr><td>Pronación '+label+'</td><td>&gt; 60°</td><td>'+fmt(a1,3)+' s</td><td>'+fmt(a1/total*100,2)+' %</td></tr><tr><td>Supinación '+label+'</td><td>&gt; 60°</td><td>'+fmt(a2,3)+' s</td><td>'+fmt(a2/total*100,2)+' %</td></tr>'); else if(kind==="wrist"&&view==="frontal")rows.push('<tr><td>Desviación radial '+label+'</td><td>&gt; '+threshold+'°</td><td>'+fmt(a1,3)+' s</td><td>'+fmt(a1/total*100,2)+' %</td></tr><tr><td>Desviación cubital '+label+'</td><td>&gt; '+threshold+'°</td><td>'+fmt(a2,3)+' s</td><td>'+fmt(a2/total*100,2)+' %</td></tr>'); else {const n1=kind==="shoulder"?"Flexión":kind==="elbow"?"Flexión":"Flexión de muñeca",n2=kind==="shoulder"?"Extensión":kind==="elbow"?"Extensión":"Extensión de muñeca",th=kind==="shoulder"?80:threshold;rows.push('<tr><td>'+n1+' '+label+'</td><td>'+ (kind==="shoulder"?"≥ 80°":"&gt; "+th+"°")+'</td><td>'+fmt(a1,3)+' s</td><td>'+fmt(a1/total*100,2)+' %</td></tr><tr><td>'+n2+' '+label+'</td><td>'+ (kind==="shoulder"?"&gt; 20°":"&gt; "+th+"°")+'</td><td>'+fmt(a2,3)+' s</td><td>'+fmt(a2/total*100,2)+' %</td></tr>');}}
 });
 return rows.length?'<div class="result-table-wrap"><table class="compact-table"><thead><tr><th>Movimiento</th><th>Criterio</th><th>Tiempo</th><th>% del tiempo analizado</th></tr></thead><tbody>'+rows.join("")+'</tbody></table></div><div class="notice">Tiempo analizado: '+fmt(r.duration,2)+' s'+(kinoveaState.range.mode==="cycles"?" · "+kinoveaState.range.cycles+" ciclos · media "+fmt(r.duration/kinoveaState.range.cycles,2)+" s/ciclo":"")+'</div>':'<div class="placeholder">No hay datos válidos con los marcadores asignados.</div>';
}
function kPanel(kind,title,defaultThreshold){
 const id=kind==="shoulder"?"ocraShoulderPanel":kind==="elbow"?"ocraElbowPanel":"ocraWristPanel",box=document.getElementById(id);if(!box)return;
 const current=kinoveaState[kind]||{view:"profile-right",direction:"right",threshold:defaultThreshold};
 box.innerHTML='<strong>Configuración</strong><div class="form-grid"><label>Vista<select id="'+kind+'View"><option value="profile-right">Perfil derecho</option><option value="profile-left">Perfil izquierdo</option><option value="frontal">Frontal</option></select></label><label id="'+kind+'DirectionField">La persona mira hacia<select id="'+kind+'Direction"><option value="right">la derecha</option><option value="left">la izquierda</option></select></label>'+(kind==="wrist"?'<label>Umbral angular (°)<input id="wristThreshold" type="number" min="1" max="180" value="'+(current.threshold||defaultThreshold)+'"></label>':'')+'</div><div id="'+kind+'MarkerInfo" class="notice"></div><button type="button" class="nav-primary" id="calculate'+kind+'">Calcular '+title.toLowerCase()+'</button><div id="'+kind+'Result" class="result-holder"><div class="placeholder">Configure la vista y calcule.</div></div>';
 const view=document.getElementById(kind+"View"),dir=document.getElementById(kind+"Direction"),field=document.getElementById(kind+"DirectionField");
 view.value=current.view;dir.value=current.direction;
 const update=()=>{field.hidden=view.value==="frontal";document.getElementById(kind+"MarkerInfo").textContent=kind==="shoulder"?(view.value==="frontal"?"Frontal: cadera + hombro + codo.":"Perfil: cadera + hombro + codo."):(kind==="elbow"?(view.value==="frontal"?"Frontal: codo + muñeca + índice.":"Perfil: hombro + codo + muñeca."):"Codo + muñeca + índice.");};
 view.onchange=update;update();
 document.getElementById("calculate"+kind).onclick=()=>{kinoveaState[kind]={view:view.value,direction:dir.value,threshold:kind==="shoulder"?80:kind==="elbow"?60:Math.max(1,kNum(document.getElementById("wristThreshold").value,60))};document.getElementById(kind+"Result").innerHTML=kAnalysisRows(kind,view.value,dir.value,kinoveaState[kind].threshold);dirty=true;};
}
function kRenderAnalyses(){if(kinoveaState.data){kPanel("shoulder","hombro",80);kPanel("elbow","codo",60);kPanel("wrist","muñeca",60)}}
function restoreKinoveaState(saved){
 kinoveaState={...kinoveaState,...saved,videoUrl:""};
 if(saved.range)kinoveaState.range={...{mode:"all",start:0,end:0,cycles:1},...saved.range};
 if(saved.shoulder)kinoveaState.shoulder=saved.shoulder;if(saved.elbow)kinoveaState.elbow=saved.elbow;if(saved.wrist)kinoveaState.wrist=saved.wrist;
 renderKRange();renderKinovea();
}
function loadKinoveaJson(file){
 return file.text().then(txt=>{const raw=JSON.parse(txt),data=parseKinovea(raw);kinoveaState.data=data;kinoveaState.jsonFileName=file.name;kinoveaState.mapping={};kinoveaState.range={mode:"all",start:0,end:data.duration,cycles:1};renderKinovea();renderKRange();bindKinovea();kSetStatus("JSON de Kinovea cargado correctamente.");});
}

function calculate(){
 const official=n("turnoOficial"),eff=n("turnoEfectivoManual")||official,pauses=n("tiempoPausas"),meal=n("pausaComer"),nonRep=n("noRepetitivo"),tntr=Math.max(0,eff-pauses-meal-nonRep);
 document.getElementById("turnoEfectivo").textContent=fmt(eff,1);document.getElementById("tntrPausas").textContent=fmt(pauses,1);document.getElementById("tntrComida").textContent=fmt(meal,1);document.getElementById("tntrNoRep").textContent=fmt(nonRep,1);document.getElementById("tiempoNeto").textContent=fmt(tntr,1);document.getElementById("duracionTNTR").textContent=fmt(tntr,1);
 const autoH=recoveryHours(eff,n("numPausas"),meal),manualRaw=form.elements.horasSinRecManual?.value.trim(),manual=manualRaw===""?null:parseFloat(manualRaw),useH=Number.isFinite(manual)?Math.max(0,Math.min(8,manual)):autoH,rm=recoveryMultiplier(useH);
 document.getElementById("recAutomatico").textContent=autoH===null?"—":fmt(autoH,1);document.getElementById("recMultAutomatico").textContent=autoH===null?"—":fmt(recoveryMultiplier(autoH),3);document.getElementById("horasSinRecuperacion").textContent=useH===null?"—":fmt(useH,1);document.getElementById("recOrigen").textContent=useH===null?"—":(Number.isFinite(manual)?"Manual":"Automático");document.getElementById("multRecuperacion").textContent=rm===null?"—":fmt(rm,3);
 const md=lookup(duration,tntr);document.getElementById("multDuracion").textContent=fmt(md,3);
 const cycles=n("ciclosEfectivos"),obs=n("cicloObservado"),cycle=cycles>0?60*tntr/cycles:0,diff=cycle>0&&obs>0?Math.abs(cycle-obs)/cycle*100:null;
 document.getElementById("cicloNeto").textContent=cycle?fmt(cycle,2):"—";document.getElementById("diferenciaCiclo").textContent=diff===null?"—":fmt(diff,2);document.getElementById("minNoJustificados").textContent=diff===null?"—":fmt(Math.abs(cycle-obs)*cycles/60,2);document.getElementById("alertaCiclo").textContent=diff===null?"—":diff>5?"Revisar: > 5 %":"Concordante: ≤ 5 %";
 const actionCycle=obs||cycle,dxA=n("dxAcciones"),ixA=n("ixAcciones"),dxMin=actionCycle>0?dxA*60/actionCycle:0,ixMin=actionCycle>0?ixA*60/actionCycle:0,dxF=freq(dxMin,form.elements.dxInterrupciones.value==="si"),ixF=freq(ixMin,form.elements.ixInterrupciones.value==="si"),dxForce=forceScore(n("dxFuerza34"),n("dxFuerza57"),n("dxFuerza810"),actionCycle),ixForce=forceScore(n("ixFuerza34"),n("ixFuerza57"),n("ixFuerza810"),actionCycle),dxS=stereo("dx"),ixS=stereo("ix"),a=[...form.querySelectorAll("[data-comp-a]")].filter(x=>x.checked).reduce((s,x)=>s+(parseFloat(x.dataset.compA)||0),0),b=parseFloat(form.elements.complementarioB.value)||0,comp=a+b;
 document.getElementById("dxAccionesMin").textContent=fmt(dxMin,2);document.getElementById("ixAccionesMin").textContent=fmt(ixMin,2);document.getElementById("dxFrecuencia").textContent=fmt(dxF,2);document.getElementById("ixFrecuencia").textContent=fmt(ixF,2);document.getElementById("dxFuerzaScore").textContent=fmt(dxForce,2);document.getElementById("ixFuerzaScore").textContent=fmt(ixForce,2);document.getElementById("dxStereoScore").textContent=fmt(dxS,2);document.getElementById("ixStereoScore").textContent=fmt(ixS,2);document.getElementById("compA").textContent=fmt(a,2);document.getElementById("compB").textContent=fmt(b,2);document.getElementById("compTotal").textContent=fmt(comp,2);
 const dxBase=dxF+dxForce+dxS+comp,ixBase=ixF+ixForce+ixS+comp,dxFinal=dxBase*(rm??1)*md,ixFinal=ixBase*(rm??1)*md;
 const set=(id,v,d=2)=>document.getElementById(id).textContent=Number.isFinite(v)?fmt(v,d):"—";
 set("finalFreqDx",dxF);set("finalForceDx",dxForce);set("finalPostureDx",dxS);set("finalCompDx",comp);set("finalBaseDx",dxBase);set("finalRecDx",rm??1,3);set("finalDurDx",md,3);set("resultadoFinalDx",dxFinal);document.getElementById("clasificacionDx").textContent=classification(dxFinal);
 set("finalFreqIx",ixF);set("finalForceIx",ixForce);set("finalPostureIx",ixS);set("finalCompIx",comp);set("finalBaseIx",ixBase);set("finalRecIx",rm??1,3);set("finalDurIx",md,3);set("resultadoFinalIx",ixFinal);document.getElementById("clasificacionIx").textContent=classification(ixFinal);
}
function show(i){kRenderAnalyses();current=Math.max(0,Math.min(screens.length-1,i));screens.forEach((s,k)=>s.classList.toggle("active",k===current));counter.textContent="Pantalla "+(current+1)+" de "+screens.length;prev.disabled=current===0;next.disabled=current===screens.length-1;window.scrollTo({top:0,behavior:"smooth"});calculate()}
function markDirty(){dirty=true;status.textContent="";calculate()}
fields.forEach(f=>{f.addEventListener("input",markDirty);f.addEventListener("change",markDirty)});prev.addEventListener("click",()=>show(current-1));next.addEventListener("click",()=>show(current+1));
document.getElementById("homeBtn").addEventListener("click",()=>{if(confirm("¿Volver al inicio? Si existen cambios sin guardar, guarde el estudio antes de continuar."))location.href="../"});
document.getElementById("saveBtn").addEventListener("click",()=>{const d=values(),blob=new Blob([JSON.stringify(d,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="estudio-ocra.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);localStorage.setItem(STORAGE_KEY,JSON.stringify(d));dirty=false;status.textContent="Estudio guardado correctamente."});
document.getElementById("loadBtn").addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",async()=>{const file=fileInput.files[0];if(!file)return;try{apply(JSON.parse(await file.text()))}catch(e){status.textContent="No se ha podido cargar el estudio. El archivo no tiene un formato OCRA válido."}fileInput.value=""});
document.getElementById("newBtn").addEventListener("click",()=>{if(!confirm("¿Crear un estudio nuevo? Se perderán los datos no guardados."))return;form.reset();dirty=false;status.textContent="Nuevo estudio iniciado.";show(0)});
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=true}});
try{const draft=localStorage.getItem(STORAGE_KEY);if(draft){apply(JSON.parse(draft));status.textContent="Hay un borrador guardado localmente en este navegador."}}catch(e){}

const kvVideo=document.getElementById("kinoveaVideo"),kvJson=document.getElementById("kinoveaJson");
if(kvVideo)kvVideo.addEventListener("change",e=>{const f=e.target.files?.[0];if(!f)return;if(kinoveaState.videoUrl)URL.revokeObjectURL(kinoveaState.videoUrl);kinoveaState.videoUrl=URL.createObjectURL(f);document.getElementById("kinoveaVideoInfo").textContent=f.name;dirty=true;kSetStatus("Vídeo cargado. Cargue el JSON de Kinovea.")});
if(kvJson)kvJson.addEventListener("change",e=>{const f=e.target.files?.[0];if(!f)return;loadKinoveaJson(f).catch(err=>kSetStatus("Error al leer el JSON de Kinovea: "+err.message)).finally(()=>e.target.value="")});
bindKinovea();renderKinovea();

show(0);
})();