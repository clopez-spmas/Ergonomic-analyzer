(()=>{"use strict";
const form=document.getElementById("ocraForm");
const screens=[...document.querySelectorAll(".screen")];
const counter=document.getElementById("screenCounter");
const prev=document.getElementById("prevBtn");
const next=document.getElementById("nextBtn");
const status=document.getElementById("status");
const fileInput=document.getElementById("fileInput");
let current=0,dirty=false;
const STORAGE_KEY="ergonomic-analyzer-ocra-draft-v2";
const fields=[...form.querySelectorAll("input,select,textarea")];

function number(name){
  const v=parseFloat(form.elements[name]?.value);
  return Number.isFinite(v)?v:0;
}
function fmt(v,d=2){
  return Number.isFinite(v)?v.toFixed(d).replace(".",","):"—";
}
function data(){
  const out={version:2,savedAt:new Date().toISOString(),values:{}};
  fields.forEach(f=>{out.values[f.name]=f.type==="checkbox"?f.checked:f.value});
  return out;
}
function apply(obj){
  if(!obj||!obj.values)throw new Error("invalid");
  fields.forEach(f=>{
    if(!(f.name in obj.values))return;
    if(f.type==="checkbox")f.checked=!!obj.values[f.name];
    else f.value=obj.values[f.name]??"";
  });
  dirty=false;
  calculate();
  status.textContent="Estudio cargado correctamente.";
}

const durationTable=[
  [60,120,0.50],[121,180,0.65],[181,240,0.75],[241,300,0.85],
  [301,360,0.925],[361,420,0.95],[421,480,1.00]
];

function durationMultiplier(n){
  if(n>480)return 1.50;
  for(const [min,max,m] of durationTable)if(n>=min&&n<=max)return m;
  return null;
}

const recoveryTable={
  480:[7,6,5,4,3,2,1,0],
  460:[7,6,5,4,3,2,1],
  440:[6.5,5.5,4.5,3.5,2.5,1.5,0.5],
  420:[6,5,4,3,2.5,1.5,0],
  390:[5.5,4.5,3.5,2.5,1.5,0.5],
  360:[5,4,3,2,1,0],
  330:[4.5,3.5,2.5,1.5,0.5,0],
  300:[4,3,2,1,0],
  270:[3.5,2.5,1.5,0.5],
  240:[3,2,1,0],
  210:[2.5,1.5,0.5],
  180:[2,1,0],
  120:[1,0],
  0:[0]
};

const recoveryMultiplierTable=[
  [0,1.00],[1,1.05],[2,1.12],[3,1.20],[4,1.33],
  [5,1.48],[6,1.70],[7,2.00],[8,2.50]
];

function recoveryMultiplier(hours){
  if(!Number.isFinite(hours))return 1;
  const clamped=Math.max(0,Math.min(8,hours));
  const exact=recoveryMultiplierTable.find(([h])=>h===clamped);
  if(exact)return exact[1];
  const lower=recoveryMultiplierTable.filter(([h])=>h<clamped).pop();
  const upper=recoveryMultiplierTable.find(([h])=>h>clamped);
  if(!lower)return upper?upper[1]:1;
  if(!upper)return lower[1];
  const [h1,m1]=lower,[h2,m2]=upper;
  return m1+(m2-m1)*(clamped-h1)/(h2-h1);
}

function automaticRecoveryHours(turnoEfectivo,numPausas,comida){
  const rounded=Math.round(turnoEfectivo);
  const row=recoveryTable[rounded];
  if(!row)return null;
  const effectiveInterruptions=Math.max(0,Math.floor(numPausas)+(comida>=30?1:0));
  const index=Math.min(effectiveInterruptions,row.length-1);
  return row[index];
}

function calculate(){
  const official=number("turnoOficial");
  const manualEffective=number("turnoEfectivoManual");
  const effective=manualEffective>0?manualEffective:official;
  const nonRep=number("noRepetitivo");
  const pauses=number("tiempoPausas");
  const meal=number("pausaComer");
  const numPausas=number("numPausas");

  const neto=Math.max(0,effective-pauses-meal-nonRep);
  document.getElementById("turnoEfectivo").textContent=fmt(effective,1);
  document.getElementById("tiempoNeto").textContent=fmt(neto,1);
  document.getElementById("tiempoExposicion").textContent=fmt(neto,1);

  const mode=form.elements.modoRecuperacion?.value||"automatico";
  let hours;
  if(mode==="manual"){
    hours=Math.max(0,Math.min(8,number("horasSinRecManual")));
  }else{
    hours=automaticRecoveryHours(effective,numPausas,meal);
  }

  const hoursOutput=document.getElementById("horasSinRecuperacion");
  const recOutput=document.getElementById("multRecuperacion");
  if(hours===null){
    hoursOutput.textContent="—";
    recOutput.textContent="—";
  }else{
    hoursOutput.textContent=fmt(hours,2);
    recOutput.textContent=fmt(recoveryMultiplier(hours),2);
  }

  const md=durationMultiplier(neto);
  document.getElementById("multDuracion").textContent=md===null?"—":fmt(md,3);

  const cycles=number("ciclosEfectivos");
  const cycleObserved=number("cicloObservado");
  const tnc=cycles>0?60*neto/cycles:0;
  document.getElementById("cicloNeto").textContent=tnc>0?fmt(tnc,1):"—";

  let diff=null;
  if(tnc>0&&cycleObserved>0)diff=Math.abs(tnc-cycleObserved)/tnc*100;
  document.getElementById("diferenciaCiclo").textContent=diff===null?"—":fmt(diff,2);
  document.getElementById("minNoJustificados").textContent=diff===null?"—":fmt(Math.abs(tnc-cycleObserved)*cycles/60,1);

  const alert=document.getElementById("alertaCiclo");
  if(diff===null)alert.textContent="—";
  else if(diff>5)alert.textContent="Revisar: > 5 %";
  else alert.textContent="Concordante: ≤ 5 %";

  const base=0;
  const mr=hours===null?1:recoveryMultiplier(hours);
  const final=md===null?0:base*mr*md;
  document.getElementById("sumaFactores").textContent=fmt(base);
  document.getElementById("resultadoConRecuperacion").textContent=fmt(base*mr);
  document.getElementById("resultadoFinal").textContent=fmt(final);
}

function show(i){
  current=Math.max(0,Math.min(screens.length-1,i));
  screens.forEach((s,n)=>s.classList.toggle("active",n===current));
  counter.textContent="Pantalla "+(current+1)+" de "+screens.length;
  prev.disabled=current===0;
  next.disabled=current===screens.length-1;
  window.scrollTo({top:0,behavior:"smooth"});
  calculate();
}

function markDirty(){
  dirty=true;
  calculate();
  status.textContent="";
}

fields.forEach(f=>f.addEventListener("input",markDirty));
fields.forEach(f=>f.addEventListener("change",markDirty));
prev.addEventListener("click",()=>show(current-1));
next.addEventListener("click",()=>show(current+1));

document.getElementById("homeBtn").addEventListener("click",()=>{
  if(confirm("¿Volver al inicio? Si existen cambios sin guardar, guarde el estudio antes de continuar."))location.href="../";
});

document.getElementById("saveBtn").addEventListener("click",()=>{
  const d=data();
  const blob=new Blob([JSON.stringify(d,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="estudio-ocra.json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  localStorage.setItem(STORAGE_KEY,JSON.stringify(d));
  dirty=false;
  status.textContent="Estudio guardado correctamente.";
});

document.getElementById("loadBtn").addEventListener("click",()=>fileInput.click());

fileInput.addEventListener("change",async()=>{
  const file=fileInput.files[0];
  if(!file)return;
  try{apply(JSON.parse(await file.text()));}
  catch(e){status.textContent="No se ha podido cargar el estudio. El archivo no tiene un formato OCRA válido."}
  fileInput.value="";
});

document.getElementById("newBtn").addEventListener("click",()=>{
  if(!confirm("¿Crear un estudio nuevo? Se perderán los datos no guardados."))return;
  form.reset();
  dirty=false;
  status.textContent="Nuevo estudio iniciado.";
  show(0);
});

window.addEventListener("beforeunload",e=>{
  if(dirty){
    e.preventDefault();
    e.returnValue=true;
  }
});

const draft=localStorage.getItem(STORAGE_KEY);
if(draft){
  try{
    apply(JSON.parse(draft));
    status.textContent="Hay un borrador guardado localmente en este navegador.";
  }catch(e){}
}
show(0);
})();