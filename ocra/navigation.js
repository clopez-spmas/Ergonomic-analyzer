(()=>{"use strict";
const screens=[...document.querySelectorAll(".screen")];
const counter=document.getElementById("screenCounter");
const prev=document.getElementById("prevBtn");
const next=document.getElementById("nextBtn");
let current=0;
function render(){
 current=Math.max(0,Math.min(screens.length-1,current));
 screens.forEach((screen,index)=>screen.classList.toggle("active",index===current));
 counter.textContent="Pantalla "+(current+1)+" de "+screens.length;
 prev.disabled=current===0;
 next.disabled=current===screens.length-1;
 window.scrollTo({top:0,behavior:"smooth"});
}
function show(index){current=Number.isFinite(index)?index:0;render()}
function navigate(delta){show(current+delta)}
prev.addEventListener("click",()=>navigate(-1));
next.addEventListener("click",()=>navigate(1));
window.OCRA_Navigation={show,navigate,get current(){return current}};
render();
})();