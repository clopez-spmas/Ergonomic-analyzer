(()=>{"use strict";
const form=document.getElementById("ocraForm"),screens=[...document.querySelectorAll(".screen")],counter=document.getElementById("screenCounter"),prev=document.getElementById("prevBtn"),next=document.getElementById("nextBtn"),status=document.getElementById("status"),fileInput=document.getElementById("fileInput"),askClose=document.getElementById("askClose");
let current=0,dirty=false;
const STORAGE_KEY="ergonomic-analyzer-ocra-draft-v1";
const fields=[...form.querySelectorAll("input,select,textarea")];
function number(name){const v=parseFloat(form.elements[name]?.value);return Number.isFinite(v)?v:0}
function data(){const out={version:1,savedAt:new Date().toISOString(),values:{}};fields.forEach(f=>{out.values[f.name]=f.type==="checkbox"?f.checked:f.value});return out}
function apply(obj){if(!obj||!obj.values)throw new Error("invalid");fields.forEach(f=>{if(!(f.name in obj.values))return;if(f.type==="checkbox")f.checked=!!obj.values[f.name];else f.value=obj.values[f.name]??""});dirty=false;calculate();status.textContent="Estudio cargado correctamente."}
function calculate(){const official=number("turnoOficial"),nonRep=number("noRepetitivo"),pausas=number("tiempoPausas"),comer=number("pausaComer"),interrupt=number("interrupciones30");const efectivo=Math.max(0,official-comer-interrupt*30);const neto=Math.max(0,efectivo-nonRep-pausas);document.getElementById("turnoEfectivo").textContent=efectivo.toFixed(1).replace(".",",");document.getElementById("tiempoNeto").textContent=neto.toFixed(1).replace(".",",");const ciclo=number("cicloObservado"),obs=number("observacionRepresentativa");document.getElementById("cicloNeto").textContent=ciclo?ciclo.toFixed(1).replace(".",","):"—";document.getElementById("diferenciaCiclo").textContent=(ciclo&&obs)?((obs-ciclo)/ciclo*100).toFixed(2).replace(".",","):"—";document.getElementById("minNoJustificados").textContent="—"}
function show(i){current=Math.max(0,Math.min(screens.length-1,i));screens.forEach((s,n)=>s.classList.toggle("active",n===current));counter.textContent="Pantalla "+(current+1)+" de "+screens.length;prev.disabled=current===0;next.disabled=current===screens.length-1;window.scrollTo({top:0,behavior:"smooth"});calculate()}
function markDirty(){dirty=true;calculate();status.textContent=""}
fields.forEach(f=>f.addEventListener("input",markDirty));fields.forEach(f=>f.addEventListener("change",markDirty));
prev.addEventListener("click",()=>show(current-1));next.addEventListener("click",()=>show(current+1));
document.getElementById("homeBtn").addEventListener("click",()=>{if(confirm("¿Volver al inicio? Si existen cambios sin guardar, guarde el estudio antes de continuar."))location.href="../"});
document.getElementById("saveBtn").addEventListener("click",()=>{const d=data(),blob=new Blob([JSON.stringify(d,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="estudio-ocra.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);localStorage.setItem(STORAGE_KEY,JSON.stringify(d));dirty=false;status.textContent="Estudio guardado correctamente."});
document.getElementById("loadBtn").addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",async()=>{const file=fileInput.files[0];if(!file)return;try{apply(JSON.parse(await file.text()))}catch(e){status.textContent="No se ha podido cargar el estudio. El archivo no tiene un formato OCRA válido."}fileInput.value=""});
document.getElementById("newBtn").addEventListener("click",()=>{if(!confirm("¿Crear un estudio nuevo? Se perderán los datos no guardados."))return;form.reset();dirty=false;status.textContent="Nuevo estudio iniciado.";show(0)});
askClose.checked=localStorage.getItem("ergonomic-analyzer-ocra-ask-close")!=="false";
askClose.addEventListener("change",()=>localStorage.setItem("ergonomic-analyzer-ocra-ask-close",String(askClose.checked)));
window.addEventListener("beforeunload",e=>{if(askClose.checked&&dirty){e.preventDefault();e.returnValue=true}});
const draft=localStorage.getItem(STORAGE_KEY);if(draft){try{apply(JSON.parse(draft));status.textContent="Hay un borrador guardado localmente en este navegador."}catch(e){}}
show(0);
})();