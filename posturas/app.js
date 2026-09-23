"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const screens = [...document.querySelectorAll(".screen")];

  const state = {
    screen: 0,
    identification: {},
    videoUrl: "",
    jsonFileName: "",
    kinovea: null,
    mapping: {},
    range: { mode: "all", start: 0, end: 0, cycles: 1 },
    shoulder: { view: "profile-right", direction: "right" },
    elbow: { view: "profile-right", direction: "right" },
    wrist: { view: "profile-right", direction: "right", threshold: 60 }, inputMode: "kinovea", manualDuration: 60, manual: { shoulder:{}, elbow:{}, wrist:{} }
  };

  const POINTS = [
    ["Cabeza y cuello", [["head","Cabeza"],["head_front","Punto anterior de cabeza"],["head_back","Punto posterior de cabeza"],["right_ear","Oreja derecha"],["left_ear","Oreja izquierda"],["neck","Cuello"],["neck_base","Base del cuello / C7"]]],
    ["Hombros", [["right_shoulder","Hombro derecho"],["left_shoulder","Hombro izquierdo"]]],
    ["Codos", [["right_elbow","Codo derecho"],["left_elbow","Codo izquierdo"]]],
    ["Muñecas", [["right_wrist","Muñeca derecha"],["left_wrist","Muñeca izquierda"]]],
    ["Manos", [["right_index","Índice derecho"],["left_index","Índice izquierdo"]]],
    ["Tronco y pelvis", [["pelvis","Pelvis"],["right_hip","Cadera derecha"],["left_hip","Cadera izquierda"]]],
    ["Rodillas", [["right_knee","Rodilla derecha"],["left_knee","Rodilla izquierda"]]],
    ["Tobillos", [["right_ankle","Tobillo derecho"],["left_ankle","Tobillo izquierdo"]]],
    ["Pies", [["right_foot","Pie derecho"],["left_foot","Pie izquierdo"]]]
  ];

  const status = message => $("status").textContent = message;
  const esc = value => String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const num = (value, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const fmt = (value, digits=2) => Number(value || 0).toLocaleString("es-ES",{minimumFractionDigits:digits,maximumFractionDigits:digits});

  function showScreen(index) {
    state.screen = Math.max(0, Math.min(screens.length - 1, index));
    screens.forEach((screen,i) => screen.classList.toggle("active", i === state.screen));
    if (state.screen === 1) renderTracking();
    if (state.screen === 2) renderKinoveaData();
    if (state.screen === 3) renderShoulder();
    if (state.screen === 4) renderElbow();
    if (state.screen === 5) renderWrist();
    updateInputModeUI();
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function saveIdentification() {
    ["company","department","studyDate","area","workstation","task","description"].forEach(id => {
      state.identification[id] = $(id)?.value || "";
    });
  }

  function currentRange() {
    if (!state.kinovea) return null;
    const duration = state.kinovea.duration;
    let start = 0, end = duration, cycles = 1;
    if (state.range.mode === "interval") {
      start = Math.max(0, Math.min(duration, num(state.range.start)));
      end = Math.max(0, Math.min(duration, num(state.range.end)));
    }
    if (state.range.mode === "cycles") cycles = Math.max(1, Math.floor(num(state.range.cycles,1)));
    if (end <= start) return null;
    return {start,end,duration:end-start,cycles};
  }

  function rangeLabel() {
    const r = currentRange();
    if (!r) return "Intervalo no válido";
    if (state.range.mode === "interval") return "Desde " + fmt(r.start,3) + " s hasta " + fmt(r.end,3) + " s";
    if (state.range.mode === "cycles") return "Todo el vídeo · " + r.cycles + " ciclos";
    return "Todo el vídeo";
  }

  function updateRange() {
    const mode = $("analysisRangeMode");
    if (!mode) return;
    state.range.mode = mode.value;
    state.range.start = num($("analysisStart").value);
    state.range.end = num($("analysisEnd").value, state.kinovea?.duration || 0);
    state.range.cycles = Math.max(1, Math.floor(num($("analysisCycles").value,1)));
    $("analysisStartField").hidden = state.range.mode !== "interval";
    $("analysisEndField").hidden = state.range.mode !== "interval";
    $("analysisCyclesField").hidden = state.range.mode !== "cycles";
    $("analysisRangeInfo").textContent =
      state.range.mode === "all" ? "Todo el vídeo se utilizará en los cálculos." :
      state.range.mode === "interval" ? "Solo se utilizará el intervalo indicado." :
      "Se analizará todo el vídeo y se indicará el número de ciclos que contiene.";
    ["shoulderScope","elbowScope","wristScope"].forEach(id => { if ($(id)) $(id).textContent = rangeLabel(); });
  }

  function bindRange() {
    ["analysisRangeMode","analysisStart","analysisEnd","analysisCycles"].forEach(id => {
      const element = $(id);
      if (element) element.oninput = updateRange;
      if (element) element.onchange = updateRange;
    });
    if ($("analysisRangeMode")) $("analysisRangeMode").value = state.range.mode;
    if ($("analysisStart")) $("analysisStart").value = state.range.start;
    if ($("analysisEnd")) $("analysisEnd").value = state.range.end || state.kinovea?.duration || 0;
    if ($("analysisCycles")) $("analysisCycles").value = state.range.cycles;
    updateRange();
  }

  function parseKinovea(json) {
    if (!json?.metadata) throw new Error("No existe metadata de Kinovea.");
    const series = Array.isArray(json.data?.timeseries) ? json.data.timeseries : [];
    if (!series.length) throw new Error("No existen timeseries de Kinovea.");
    const frames = [];
    const frameCount = Math.max(...series.map(s => Array.isArray(s.time) ? s.time.length : 0));
    if (!Number.isFinite(frameCount) || frameCount < 2) throw new Error("No existen suficientes frames.");
    for (let i=0;i<frameCount;i++) {
      let time = null;
      const landmarks = {};
      series.forEach(s => {
        const name = String(s.name ?? "").trim();
        if (!name) return;
        if (time === null && Array.isArray(s.time) && s.time[i] !== undefined) time = num(s.time[i]);
        let p = s.data?.["0"]?.[i];
        if (!p && Array.isArray(s.x) && Array.isArray(s.y)) p = [s.x[i],s.y[i]];
        landmarks[name] = Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))
          ? {x:Number(p[0]),y:Number(p[1])} : null;
      });
      frames.push({index:i,time:time ?? (i>0 ? frames[i-1].time : 0),landmarks});
    }
    const markers = [...new Set(series.map(s => String(s.name ?? "").trim()).filter(Boolean))];
    return {
      producer:String(json.metadata.producer ?? ""),
      fps:num(json.metadata.captureFramerate || json.metadata.userFramerate,null),
      imageSize:json.metadata.imageSize || {},
      markers, frames, frameCount:frames.length,
      duration:frames.at(-1)?.time || 0
    };
  }

  function renderSummary() {
    const k = state.kinovea;
    $("summaryProducer").textContent = k?.producer || "—";
    $("summaryFile").textContent = state.jsonFileName || "—";
    $("summaryMarkers").textContent = k ? k.markers.length : "—";
    $("summaryFrames").textContent = k ? k.frameCount : "—";
    $("summaryDuration").textContent = k ? fmt(k.duration,3)+" s" : "—";
    $("summaryFps").textContent = k?.fps ? fmt(k.fps,3)+" fps" : "—";
  }

  function renderMapping() {
    const box = $("mappingContainer");
    if (!state.kinovea) { box.innerHTML = '<div class="placeholder">Cargue primero el JSON de Kinovea.</div>'; return; }
    let html = '<div class="mapping-note"><strong>Marcadores encontrados:</strong> '+esc(state.kinovea.markers.join(", "))+'</div>';
    POINTS.forEach(([group,points]) => {
      html += '<div class="mapping-group"><h3>'+esc(group)+'</h3><div class="mapping-grid">';
      points.forEach(([key,label]) => {
        html += '<div class="mapping-row"><label>'+esc(label)+'</label><select data-point="'+key+'"><option value="">— no asignado —</option>';
        state.kinovea.markers.forEach(marker => html += '<option value="'+esc(marker)+'" '+(state.mapping[key]===marker?"selected":"")+'>'+esc(marker)+'</option>');
        html += '</select></div>';
      });
      html += '</div></div>';
    });
    box.innerHTML = html;
    box.querySelectorAll("[data-point]").forEach(select => select.onchange = () => {
      const key = select.dataset.point;
      const previous = state.mapping[key];
      if (select.value && Object.keys(state.mapping).some(k => k !== key && state.mapping[k] === select.value)) {
        select.value = previous || "";
        status("Ese marcador ya está asignado a otro punto anatómico.");
        return;
      }
      if (select.value) state.mapping[key] = select.value; else delete state.mapping[key];
    });
  }

  function renderTracking() {
    renderSummary();
    renderMapping();
    bindRange();
  }

  function renderKinoveaData() {
    const box = $("kinoveaDataPanel");
    if (!state.kinovea) { box.innerHTML = '<div class="placeholder">Cargue primero el JSON de Kinovea.</div>'; return; }
    const k = state.kinovea;
    let html = '<div class="data-summary-grid">';
    [["Productor",k.producer||"—"],["Frames",k.frameCount],["Duración",fmt(k.duration,3)+" s"],["Frecuencia",k.fps?fmt(k.fps,3)+" fps":"—"],["Imagen",(k.imageSize.width||"—")+" × "+(k.imageSize.height||"—")],["Marcadores",k.markers.length]]
      .forEach(([a,b]) => html += '<div class="prepared-card"><strong>'+a+'</strong><span>'+esc(b)+'</span></div>');
    html += '</div><div class="data-block"><h3>Marcadores y puntos válidos</h3><div class="result-table-wrap"><table class="result-table"><thead><tr><th>Marcador</th><th>Puntos válidos</th><th>Primer tiempo</th><th>Último tiempo</th></tr></thead><tbody>';
    k.markers.forEach(marker => {
      const valid = k.frames.filter(f => f.landmarks[marker]).map(f => f.time);
      html += '<tr><td>'+esc(marker)+'</td><td>'+valid.length+'</td><td>'+(valid.length?fmt(valid[0],3)+" s":"—")+'</td><td>'+(valid.length?fmt(valid.at(-1),3)+" s":"—")+'</td></tr>';
    });
    html += '</tbody></table></div></div>';
    const shown = k.frames.slice(0,20);
    html += '<div class="data-block"><h3>Datos importados · primeros 20 frames</h3><p class="analysis-help">X/Y son las coordenadas recibidas desde Kinovea.</p><div class="result-table-wrap"><table class="result-table"><thead><tr><th>Frame</th><th>Tiempo</th>';
    k.markers.slice(0,12).forEach(m => html += '<th>'+esc(m)+'</th>');
    html += '</tr></thead><tbody>';
    shown.forEach(frame => {
      html += '<tr><td>'+frame.index+'</td><td>'+fmt(frame.time,3)+' s</td>';
      k.markers.slice(0,12).forEach(m => { const p=frame.landmarks[m]; html += '<td>'+(p?fmt(p.x,1)+" / "+fmt(p.y,1):"—")+'</td>'; });
      html += '</tr>';
    });
    html += '</tbody></table></div></div><div class="notice"><strong>Estos son los datos que utilizarán los análisis.</strong> La asignación anatómica se realiza sobre estos mismos marcadores.</div>';
    box.innerHTML = html;
  }

  function point(frame,key) { return frame?.landmarks?.[state.mapping[key]] || null; }
  function angle(a,b,c) {
    if (!a || !b || !c) return NaN;
    const ax=a.x-b.x, ay=a.y-b.y, cx=c.x-b.x, cy=c.y-b.y;
    const na=Math.hypot(ax,ay), nc=Math.hypot(cx,cy);
    if (!na || !nc) return NaN;
    return Math.acos(Math.max(-1,Math.min(1,(ax*cx+ay*cy)/(na*nc))))*180/Math.PI;
  }
  function signedShoulder(a,b,c,direction) {
    const raw=angle(a,b,c); if (!Number.isFinite(raw)) return NaN;
    const t={x:a.x-b.x,y:a.y-b.y}, arm={x:c.x-b.x,y:c.y-b.y};
    const cross=t.x*arm.y-t.y*arm.x;
    return raw*(direction==="right" ? (cross<0?1:-1) : (cross>0?1:-1));
  }
  function signedWrist(elbow,wrist,index,direction) {
    const raw=angle(elbow,wrist,index); if (!Number.isFinite(raw)) return NaN;
    const a={x:elbow.x-wrist.x,y:elbow.y-wrist.y}, b={x:index.x-wrist.x,y:index.y-wrist.y};
    const cross=a.x*b.y-a.y*b.x;
    return raw*(direction==="right" ? (cross<0?1:-1) : (cross>0?1:-1));
  }
  function rotation(elbow,wrist,index) {
    if (!elbow || !wrist || !index) return NaN;
    const a={x:wrist.x-elbow.x,y:wrist.y-elbow.y}, b={x:index.x-wrist.x,y:index.y-wrist.y};
    const na=Math.hypot(a.x,a.y),nb=Math.hypot(b.x,b.y);
    if (!na || !nb) return NaN;
    return Math.atan2(a.x*b.y-a.y*b.x,a.x*b.x+a.y*b.y)*180/Math.PI;
  }

  function intervals(callback) {
    const r=currentRange();
    if (!r) return null;
    const frames=state.kinovea.frames.filter(f => f.time >= r.start && f.time <= r.end);
    let valid=0, total=0;
    for (let i=0;i<frames.length-1;i++) {
      const a=frames[i],b=frames[i+1];
      const dt=Math.max(0,Math.min(b.time,r.end)-Math.max(a.time,r.start));
      if (dt <= 0) continue;
      const value=callback(a,b);
      if (Number.isFinite(value)) { valid+=dt; total+=dt; callback.__acc?.(value,dt); }
    }
    return {r,frames,valid,total};
  }

  function resultTable(rows) {
    return '<div class="result-table-wrap"><table class="result-table"><thead><tr><th>Movimiento</th><th>Criterio</th><th>Tiempo</th><th>% del tiempo analizado</th></tr></thead><tbody>'+rows.join("")+'</tbody></table></div>';
  }

  function updateInputModeUI(){const manual=$("inputMode")?.value==="manual";state.inputMode=manual?"manual":"kinovea";if($("manualDurationField"))$("manualDurationField").hidden=!manual;if($("manualModeNotice"))$("manualModeNotice").hidden=!manual;if($("kinoveaInputFields"))$("kinoveaInputFields").hidden=manual;if($("mappingSection"))$("mappingSection").hidden=manual;if(manual)state.manualDuration=Math.max(.001,num($("manualDuration")?.value,60));}
  function mf(id,label,value=0){return '<label>'+label+'<input type="number" id="'+id+'" min="0" step="0.1" value="'+esc(value)+'"></label>';}
  function mv(id){return Math.max(0,num($(id)?.value,0));}
  function mr(name,threshold,angle,time,duration){const used=angle>=threshold?time:0;return '<tr><td>'+esc(name)+'</td><td>'+threshold+'° · introducido '+fmt(angle,1)+'°</td><td>'+fmt(used,3)+' s</td><td>'+fmt(duration?used/duration*100:0,2)+' %</td></tr>';}
  function manualPanel(type){const duration=Math.max(.001,num($("manualDuration")?.value,state.manualDuration||60));state.manualDuration=duration;const view=state[type].view||"profile-right", side=view==="profile-left"?"left":"right", box=$(type==="shoulder"?"preparedStudy":type==="elbow"?"elbowStudy":"wristStudy"), d=state.manual[type][side]||{};let title=type==="shoulder"?"hombro":type==="elbow"?"codo":"muñeca",th=type==="shoulder"?80:type==="elbow"?60:(state.wrist.threshold||60);let html='<div class="manual-entry"><h3>Entrada manual · '+title+'</h3><p class="analysis-help">Introduzca ángulo y tiempo de exposición. El porcentaje se calcula automáticamente respecto al tiempo total de análisis ('+fmt(duration,3)+' s).</p><div class="analysis-grid">'+mf(type+'View','Vista',view)+'</div>';
    if(view==="frontal"){["right","left"].forEach(s=>{const x=state.manual[type][s]||{};if(type==="shoulder")html+='<div class="manual-card"><h4>Hombro '+(s==="right"?"derecho":"izquierdo")+'</h4><div class="analysis-grid">'+mf('mS'+s+'A','Ángulo de abducción (°)',x.angle)+mf('mS'+s+'T','Tiempo de abducción (s)',x.time)+'</div></div>';if(type==="elbow")html+='<div class="manual-card"><h4>Codo '+(s==="right"?"derecho":"izquierdo")+'</h4><div class="analysis-grid">'+mf('mE'+s+'PA','Ángulo de pronación (°)',x.pronAngle)+mf('mE'+s+'PT','Tiempo de pronación (s)',x.pronTime)+mf('mE'+s+'SA','Ángulo de supinación (°)',x.supAngle)+mf('mE'+s+'ST','Tiempo de supinación (s)',x.supTime)+'</div></div>';if(type==="wrist")html+='<div class="manual-card"><h4>Muñeca '+(s==="right"?"derecha":"izquierda")+'</h4><div class="analysis-grid">'+mf('mW'+s+'RA','Ángulo radial (°)',x.radialAngle)+mf('mW'+s+'RT','Tiempo radial (s)',x.radialTime)+mf('mW'+s+'CA','Ángulo cubital (°)',x.cubitalAngle)+mf('mW'+s+'CT','Tiempo cubital (s)',x.cubitalTime)+'</div></div>';});}
    else {const p=type[0].toUpperCase()+type.slice(1)+side;if(type==="shoulder")html+='<div class="manual-card"><h4>Hombro '+(side==="right"?"derecho":"izquierdo")+'</h4><div class="analysis-grid">'+mf('m'+p+'FA','Ángulo de flexión (°)',d.flexAngle)+mf('m'+p+'FT','Tiempo de flexión (s)',d.flexTime)+mf('m'+p+'EA','Ángulo de extensión (°)',d.extAngle)+mf('m'+p+'ET','Tiempo de extensión (s)',d.extTime)+'</div></div>';if(type==="elbow")html+='<div class="manual-card"><h4>Codo '+(side==="right"?"derecho":"izquierdo")+'</h4><div class="analysis-grid">'+mf('m'+p+'FA','Ángulo de flexión (°)',d.flexAngle)+mf('m'+p+'FT','Tiempo de flexión (s)',d.flexTime)+mf('m'+p+'EA','Ángulo de extensión (°)',d.extAngle)+mf('m'+p+'ET','Tiempo de extensión (s)',d.extTime)+'</div></div>';if(type==="wrist")html+='<div class="manual-card"><h4>Muñeca '+(side==="right"?"derecha":"izquierda")+'</h4><div class="analysis-grid">'+mf('m'+p+'FA','Ángulo de flexión (°)',d.flexAngle)+mf('m'+p+'FT','Tiempo de flexión (s)',d.flexTime)+mf('m'+p+'EA','Ángulo de extensión (°)',d.extAngle)+mf('m'+p+'ET','Tiempo de extensión (s)',d.extTime)+'</div></div>';}
    html+='<button type="button" class="nav-primary" id="manualCalc">Calcular '+title+'</button><div id="manualResult" class="shoulder-result"><div class="placeholder">Introduzca los datos y calcule.</div></div></div>';box.innerHTML=html;const v=$(type+'View');v.outerHTML='<label>Vista<select id="'+type+'View"><option value="profile-right">Perfil derecho</option><option value="profile-left">Perfil izquierdo</option><option value="frontal">Frontal</option></select></label>';;$(type+'View').value=view;$(type+'View').onchange=()=>{state[type].view=$(type+'View').value;manualPanel(type);};$("manualCalc").onclick=()=>{state[type].view=$(type+'View').value;$("manualResult").innerHTML=manualCalculate(type);};}
  function manualCalculate(type){const duration=Math.max(.001,num($("manualDuration")?.value,state.manualDuration||60)),view=state[type].view||"profile-right",th=type==="shoulder"?80:type==="elbow"?60:(state.wrist.threshold||60),rows=[];if(view==="frontal"){["right","left"].forEach(s=>{const x=state.manual[type][s]||{};if(type==="shoulder")rows.push(mr('Abducción '+(s==="right"?"derecha":"izquierda"),80,mv('mS'+s+'A'),mv('mS'+s+'T'),duration));if(type==="elbow")rows.push(mr('Pronación '+(s==="right"?"derecha":"izquierda"),60,mv('mE'+s+'PA'),mv('mE'+s+'PT'),duration),mr('Supinación '+(s==="right"?"derecha":"izquierda"),60,mv('mE'+s+'SA'),mv('mE'+s+'ST'),duration));if(type==="wrist")rows.push(mr('Desviación radial '+(s==="right"?"derecha":"izquierda"),th,mv('mW'+s+'RA'),mv('mW'+s+'RT'),duration),mr('Desviación cubital '+(s==="right"?"derecha":"izquierda"),th,mv('mW'+s+'CA'),mv('mW'+s+'CT'),duration));});}else{const s=view==="profile-left"?"left":"right",p=type[0].toUpperCase()+type.slice(1)+s,d=state.manual[type][s]||{};const vals=type==="shoulder"?[['Flexión',80,'FA','FT'],['Extensión',20,'EA','ET']]:type==="elbow"?[['Flexión',60,'FA','FT'],['Extensión',60,'EA','ET']]:[['Flexión de muñeca',th,'FA','FT'],['Extensión de muñeca',th,'EA','ET']];vals.forEach(a=>rows.push(mr(a[0]+' '+(s==="right"?"derecha":"izquierda"),a[1],mv('m'+p+a[2]),mv('m'+p+a[3]),duration)));}return resultTable(rows)+'<div class="analysis-summary"><span>Origen: <strong>Manual</strong></span><span>Tiempo total: <strong>'+fmt(duration,3)+' s</strong></span></div>';}
  function renderShoulder() {
    const box=$("preparedStudy");
    if (!state.kinovea) { box.innerHTML='<div class="placeholder">Cargue primero el JSON de Kinovea.</div>'; return; }
    box.innerHTML = '<div class="analysis-panel"><h3>Configuración del análisis de hombro</h3><div class="analysis-grid"><label>Vista<select id="shoulderView"><option value="profile-right">Perfil derecho</option><option value="profile-left">Perfil izquierdo</option><option value="frontal">Frontal</option></select></label><label id="shoulderDirectionField">La persona mira hacia<select id="shoulderDirection"><option value="right">la derecha</option><option value="left">la izquierda</option></select></label><div class="prepared-card"><strong>Intervalo</strong><span id="shoulderScope">'+esc(rangeLabel())+'</span></div></div><div id="shoulderMarkers" class="marker-check"></div><button type="button" class="nav-primary" id="calculateShoulder">Calcular hombro</button><div id="shoulderResult" class="shoulder-result"><div class="placeholder">Seleccione la vista y calcule.</div></div></div>';
    const view=$("shoulderView"),dir=$("shoulderDirection"),field=$("shoulderDirectionField");
    view.value=state.shoulder.view; dir.value=state.shoulder.direction;
    const update=()=>{
      field.hidden=view.value==="frontal";
      const text=view.value==="frontal"
        ? "Frontal: cadera + hombro + codo de cada lado asignado."
        : "Perfil: cadera + hombro + codo del lado seleccionado.";
      $("shoulderMarkers").innerHTML='<strong>Marcadores necesarios</strong><span>'+text+'</span>';
    };
    view.onchange=update; update();
    $("calculateShoulder").onclick=()=>{
      state.shoulder={view:view.value,direction:dir.value};
      $("shoulderResult").innerHTML=calculateShoulder();
    };
  }

  function calculateShoulder() {
    const r=currentRange(); if (!r) return '<div class="placeholder">El intervalo de análisis no es válido.</div>';
    if (state.shoulder.view==="frontal") {
      const rows=[];
      ["right","left"].forEach(side=>{
        let abd=0,valid=0;
        for(let i=0;i<state.kinovea.frames.length-1;i++){
          const a=state.kinovea.frames[i],b=state.kinovea.frames[i+1],dt=Math.max(0,Math.min(b.time,r.end)-Math.max(a.time,r.start));
          if(dt<=0)continue;
          const aa=angle(point(a,side+"_hip"),point(a,side+"_shoulder"),point(a,side+"_elbow")),ab=angle(point(b,side+"_hip"),point(b,side+"_shoulder"),point(b,side+"_elbow"));
          if(!Number.isFinite(aa)||!Number.isFinite(ab))continue;
          valid+=dt;if((aa+ab)/2>=80)abd+=dt;
        }
        if(valid>0)rows.push('<tr><td>Abducción '+(side==="right"?"derecha":"izquierda")+'</td><td>≥ 80°</td><td>'+fmt(abd,3)+' s</td><td>'+fmt(abd/r.duration*100,2)+' %</td></tr>');
      });
      return rows.length?resultTable(rows)+summary(r):'<div class="placeholder">No hay datos válidos para abducción.</div>';
    }
    const side=state.shoulder.view==="profile-left"?"left":"right";
    let flex=0,ext=0,valid=0;
    for(let i=0;i<state.kinovea.frames.length-1;i++){
      const a=state.kinovea.frames[i],b=state.kinovea.frames[i+1],dt=Math.max(0,Math.min(b.time,r.end)-Math.max(a.time,r.start));
      if(dt<=0)continue;
      const aa=signedShoulder(point(a,side+"_hip"),point(a,side+"_shoulder"),point(a,side+"_elbow"),state.shoulder.direction),ab=signedShoulder(point(b,side+"_hip"),point(b,side+"_shoulder"),point(b,side+"_elbow"),state.shoulder.direction);
      if(!Number.isFinite(aa)||!Number.isFinite(ab))continue;
      valid+=dt;const v=(aa+ab)/2;if(v>=80)flex+=dt;if(v<-20)ext+=dt;
    }
    if(!valid)return '<div class="placeholder">No hay datos válidos para el lado seleccionado.</div>';
    return resultTable([
      '<tr><td>Flexión '+(side==="right"?"derecha":"izquierda")+'</td><td>≥ 80°</td><td>'+fmt(flex,3)+' s</td><td>'+fmt(flex/r.duration*100,2)+' %</td></tr>',
      '<tr><td>Extensión '+(side==="right"?"derecha":"izquierda")+'</td><td>&gt; 20°</td><td>'+fmt(ext,3)+' s</td><td>'+fmt(ext/r.duration*100,2)+' %</td></tr>'
    ])+summary(r);
  }

  function renderElbow() {
    const box=$("elbowStudy");
    if(!state.kinovea){box.innerHTML='<div class="placeholder">Cargue primero el JSON de Kinovea.</div>';return;}
    box.innerHTML='<div class="analysis-panel"><h3>Configuración del análisis de codo</h3><div class="analysis-grid"><label>Vista<select id="elbowView"><option value="profile-right">Perfil derecho</option><option value="profile-left">Perfil izquierdo</option><option value="frontal">Frontal</option></select></label><label id="elbowDirectionField">La persona mira hacia<select id="elbowDirection"><option value="right">la derecha</option><option value="left">la izquierda</option></select></label><div class="prepared-card"><strong>Intervalo</strong><span id="elbowScope">'+esc(rangeLabel())+'</span></div></div><div id="elbowMarkers" class="marker-check"></div><button type="button" class="nav-primary" id="calculateElbow">Calcular codo</button><div id="elbowResult" class="shoulder-result"><div class="placeholder">Seleccione la vista y calcule.</div></div></div>';
    const view=$("elbowView"),dir=$("elbowDirection"),field=$("elbowDirectionField");
    view.value=state.elbow.view;dir.value=state.elbow.direction;
    const update=()=>{
      field.hidden=view.value==="frontal";
      $("elbowMarkers").innerHTML=view.value==="frontal"
        ? "<strong>Marcadores necesarios</strong><span>Codo + muñeca + índice para pronación/supinación.</span>"
        : "<strong>Marcadores necesarios</strong><span>Hombro + codo + muñeca para flexión/extensión.</span>";
    };
    view.onchange=update;update();
    $("calculateElbow").onclick=()=>{state.elbow={view:view.value,direction:dir.value};$("elbowResult").innerHTML=calculateElbow();};
  }

  function calculateElbow() {
    const r=currentRange();if(!r)return '<div class="placeholder">El intervalo de análisis no es válido.</div>';
    if(state.elbow.view==="frontal"){
      const rows=[];
      ["right","left"].forEach(side=>{
        let pron=0,sup=0,valid=0;
        for(let i=0;i<state.kinovea.frames.length-1;i++){
          const a=state.kinovea.frames[i],b=state.kinovea.frames[i+1],dt=Math.max(0,Math.min(b.time,r.end)-Math.max(a.time,r.start));if(dt<=0)continue;
          const aa=rotation(point(a,side+"_elbow"),point(a,side+"_wrist"),point(a,side+"_index")),ab=rotation(point(b,side+"_elbow"),point(b,side+"_wrist"),point(b,side+"_index"));if(!Number.isFinite(aa)||!Number.isFinite(ab))continue;
          if(!state.elbow.base)state.elbow.base={};if(!Number.isFinite(state.elbow.base[side]))state.elbow.base[side]=aa;
          const v=(aa+ab)/2-state.elbow.base[side];valid+=dt;if(v>60)pron+=dt;if(v<-60)sup+=dt;
        }
        if(valid)rows.push('<tr><td>Pronación '+(side==="right"?"derecha":"izquierda")+'</td><td>&gt; 60°</td><td>'+fmt(pron,3)+' s</td><td>'+fmt(pron/r.duration*100,2)+' %</td></tr><tr><td>Supinación '+(side==="right"?"derecha":"izquierda")+'</td><td>&gt; 60°</td><td>'+fmt(sup,3)+' s</td><td>'+fmt(sup/r.duration*100,2)+' %</td></tr>');
      });
      return rows.length?resultTable(rows)+summary(r):'<div class="placeholder">No hay datos válidos para pronación/supinación.</div>';
    }
    const side=state.elbow.view==="profile-left"?"left":"right";
    let flex=0,ext=0,valid=0;
    for(let i=0;i<state.kinovea.frames.length-1;i++){
      const a=state.kinovea.frames[i],b=state.kinovea.frames[i+1],dt=Math.max(0,Math.min(b.time,r.end)-Math.max(a.time,r.start));if(dt<=0)continue;
      const aa=angle(point(a,side+"_shoulder"),point(a,side+"_elbow"),point(a,side+"_wrist")),ab=angle(point(b,side+"_shoulder"),point(b,side+"_elbow"),point(b,side+"_wrist"));if(!Number.isFinite(aa)||!Number.isFinite(ab))continue;
      if(!state.elbow.base)state.elbow.base={};if(!Number.isFinite(state.elbow.base[side]))state.elbow.base[side]=aa;
      const v=(aa+ab)/2-state.elbow.base[side];valid+=dt;if(v>60)flex+=dt;if(v<-60)ext+=dt;
    }
    if(!valid)return '<div class="placeholder">No hay datos válidos para el lado seleccionado.</div>';
    return resultTable([
      '<tr><td>Flexión '+(side==="right"?"derecha":"izquierda")+'</td><td>&gt; 60°</td><td>'+fmt(flex,3)+' s</td><td>'+fmt(flex/r.duration*100,2)+' %</td></tr>',
      '<tr><td>Extensión '+(side==="right"?"derecha":"izquierda")+'</td><td>&gt; 60°</td><td>'+fmt(ext,3)+' s</td><td>'+fmt(ext/r.duration*100,2)+' %</td></tr>'
    ])+summary(r);
  }

  function renderWrist() {
    const box=$("wristStudy");
    if(!state.kinovea){box.innerHTML='<div class="placeholder">Cargue primero el JSON de Kinovea.</div>';return;}
    box.innerHTML='<div class="analysis-panel"><h3>Configuración del análisis de muñeca</h3><div class="analysis-grid"><label>Vista<select id="wristView"><option value="profile-right">Perfil derecho</option><option value="profile-left">Perfil izquierdo</option><option value="frontal">Frontal</option></select></label><label id="wristDirectionField">La persona mira hacia<select id="wristDirection"><option value="right">la derecha</option><option value="left">la izquierda</option></select></label><label>Umbral angular (°)<input type="number" id="wristThreshold" min="1" max="180" step="1" value="'+state.wrist.threshold+'"></label><div class="prepared-card"><strong>Intervalo</strong><span id="wristScope">'+esc(rangeLabel())+'</span></div></div><div id="wristMarkers" class="marker-check"></div><button type="button" class="nav-primary" id="calculateWrist">Calcular muñeca</button><div id="wristResult" class="shoulder-result"><div class="placeholder">Seleccione la vista y calcule.</div></div></div>';
    const view=$("wristView"),dir=$("wristDirection"),field=$("wristDirectionField");
    view.value=state.wrist.view;dir.value=state.wrist.direction;
    const update=()=>{field.hidden=view.value==="frontal";$("wristMarkers").innerHTML='<strong>Marcadores necesarios</strong><span>Codo + muñeca + índice.</span>';};
    view.onchange=update;update();
    $("calculateWrist").onclick=()=>{state.wrist={view:view.value,direction:dir.value,threshold:Math.max(1,num($("wristThreshold").value,60))};$("wristResult").innerHTML=calculateWrist();};
  }

  function calculateWrist() {
    const r=currentRange();if(!r)return '<div class="placeholder">El intervalo de análisis no es válido.</div>';
    const th=state.wrist.threshold;
    if(state.wrist.view==="frontal"){
      const rows=[];
      ["right","left"].forEach(side=>{
        let radial=0,cubital=0,valid=0,base=null;
        for(let i=0;i<state.kinovea.frames.length-1;i++){
          const a=state.kinovea.frames[i],b=state.kinovea.frames[i+1],dt=Math.max(0,Math.min(b.time,r.end)-Math.max(a.time,r.start));if(dt<=0)continue;
          const aa=rotation(point(a,side+"_elbow"),point(a,side+"_wrist"),point(a,side+"_index")),ab=rotation(point(b,side+"_elbow"),point(b,side+"_wrist"),point(b,side+"_index"));if(!Number.isFinite(aa)||!Number.isFinite(ab))continue;
          if(base===null)base=aa;const v=(aa+ab)/2-base;valid+=dt;if(v>th)radial+=dt;if(v<-th)cubital+=dt;
        }
        if(valid)rows.push('<tr><td>Desviación radial '+(side==="right"?"derecha":"izquierda")+'</td><td>&gt; '+th+'°</td><td>'+fmt(radial,3)+' s</td><td>'+fmt(radial/r.duration*100,2)+' %</td></tr><tr><td>Desviación cubital '+(side==="right"?"derecha":"izquierda")+'</td><td>&gt; '+th+'°</td><td>'+fmt(cubital,3)+' s</td><td>'+fmt(cubital/r.duration*100,2)+' %</td></tr>');
      });
      return rows.length?resultTable(rows)+summary(r):'<div class="placeholder">No hay datos válidos para muñeca frontal.</div>';
    }
    const side=state.wrist.view==="profile-left"?"left":"right";
    let flex=0,ext=0,valid=0,base=null;
    for(let i=0;i<state.kinovea.frames.length-1;i++){
      const a=state.kinovea.frames[i],b=state.kinovea.frames[i+1],dt=Math.max(0,Math.min(b.time,r.end)-Math.max(a.time,r.start));if(dt<=0)continue;
      const aa=signedWrist(point(a,side+"_elbow"),point(a,side+"_wrist"),point(a,side+"_index"),state.wrist.direction),ab=signedWrist(point(b,side+"_elbow"),point(b,side+"_wrist"),point(b,side+"_index"),state.wrist.direction);if(!Number.isFinite(aa)||!Number.isFinite(ab))continue;
      if(base===null)base=aa;const v=(aa+ab)/2-base;valid+=dt;if(v>th)flex+=dt;if(v<-th)ext+=dt;
    }
    if(!valid)return '<div class="placeholder">No hay datos válidos para el lado seleccionado.</div>';
    return resultTable([
      '<tr><td>Flexión de muñeca '+(side==="right"?"derecha":"izquierda")+'</td><td>&gt; '+th+'°</td><td>'+fmt(flex,3)+' s</td><td>'+fmt(flex/r.duration*100,2)+' %</td></tr>',
      '<tr><td>Extensión de muñeca '+(side==="right"?"derecha":"izquierda")+'</td><td>&gt; '+th+'°</td><td>'+fmt(ext,3)+' s</td><td>'+fmt(ext/r.duration*100,2)+' %</td></tr>'
    ])+summary(r);
  }

  function summary(r) {
    return '<div class="analysis-summary"><span>Referencia: <strong>0° natural</strong></span><span>Tiempo analizado: <strong>'+fmt(r.duration,3)+' s</strong></span>'+ (state.range.mode==="cycles" ? '<span>Tiempo medio por ciclo: <strong>'+fmt(r.duration/r.cycles,3)+' s</strong></span>' : '') +'</div>';
  }

  function loadJson(file) {
    return file.text().then(text => {
      const parsed=parseKinovea(JSON.parse(text));
      state.kinovea=parsed;
      state.jsonFileName=file.name;
      state.mapping={};
      state.range={mode:"all",start:0,end:parsed.duration,cycles:1};
      state.shoulder={view:"profile-right",direction:"right"};
      state.elbow={view:"profile-right",direction:"right"};
      state.wrist={view:"profile-right",direction:"right",threshold:60};
      renderSummary();bindRange();renderMapping();
      status("JSON de Kinovea cargado. Revise los datos importados y asigne los marcadores.");
    });
  }

  function newStudy() {
    if(state.videoUrl) URL.revokeObjectURL(state.videoUrl);
    state.screen=0;state.identification={};state.videoUrl="";state.jsonFileName="";state.kinovea=null;state.mapping={};state.range={mode:"all",start:0,end:0,cycles:1};state.shoulder={view:"profile-right",direction:"right"};state.elbow={view:"profile-right",direction:"right"};state.wrist={view:"profile-right",direction:"right",threshold:60};
    ["company","department","studyDate","area","workstation","task","description"].forEach(id=>$(id).value="");
    $("videoFile").value="";$("jsonFile").value="";$("videoPreview").hidden=true;$("videoPreview").removeAttribute("src");$("videoInfo").textContent="Ningún vídeo seleccionado.";
    renderSummary();renderMapping();bindRange();showScreen(0);status("Nuevo estudio preparado.");
  }

  function saveStudy() {
    saveIdentification();
    const data = {
      format:"Ergonomic Analyzer Posturas",
      identification:{...state.identification},
      jsonFileName:state.jsonFileName,
      range:{...state.range},
      mapping:{...state.mapping},
      shoulder:{...state.shoulder},
      elbow:{...state.elbow},
      wrist:{...state.wrist}
    };
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="estudio_posturas.json";a.click();URL.revokeObjectURL(url);
    status("Estudio guardado.");
  }

  function loadStudy(event) {
    const file=event.target.files?.[0];if(!file)return;
    file.text().then(text=>{
      const data=JSON.parse(text);
      if(data?.format!=="Ergonomic Analyzer Posturas") throw new Error("El archivo no es un estudio de Posturas válido.");
      state.identification=data.identification||{};
      ["company","department","studyDate","area","workstation","task","description"].forEach(id=>$(id).value=state.identification[id]||"");
      state.jsonFileName=data.jsonFileName||"";
      state.range=data.range||data.analysisRange||state.range;
      state.mapping=data.mapping||{};
      state.shoulder=data.shoulder||data.shoulderAnalysis||state.shoulder;
      state.elbow=data.elbow||data.elbowAnalysis||state.elbow;
      state.wrist=data.wrist||data.wristAnalysis||state.wrist; state.inputMode=data.inputMode||"kinovea"; state.manualDuration=num(data.manualDuration,60); state.manual=data.manual||{shoulder:{},elbow:{},wrist:{}};
      bindRange();renderSummary();renderMapping();showScreen(0);
      status("Estudio cargado. Seleccione de nuevo el JSON de Kinovea para analizarlo.");
    }).catch(error=>status("No se pudo cargar el estudio: "+error.message))
      .finally(()=>event.target.value="");
  }

  document.querySelectorAll("[data-prev]").forEach(button => button.onclick=()=>showScreen(state.screen-1));
  document.querySelectorAll("[data-next]").forEach(button => button.onclick=()=>{
    if(state.screen===0){saveIdentification();showScreen(1);return;}
    if(state.screen===1){if(state.inputMode==="kinovea"&&!state.kinovea){status("Cargue primero el JSON de Kinovea o seleccione Entrada manual.");return;}showScreen(2);return;}
    if(state.screen<screens.length-1)showScreen(state.screen+1);
  });
  $("homeButton").onclick=()=>location.href="../";
  $("newStudyButton").onclick=newStudy;
  $("saveStudyButton").onclick=saveStudy;
  $("loadStudyButton").onclick=()=>$("studyFileInput").click();
  $("studyFileInput").onchange=loadStudy; $("inputMode").onchange=()=>{state.inputMode=$("inputMode").value;updateInputModeUI();showScreen(state.screen);}; $("manualDuration").oninput=()=>state.manualDuration=Math.max(.001,num($("manualDuration").value,60));
  $("videoFile").onchange=event=>{
    const file=event.target.files?.[0];if(!file)return;
    if(state.videoUrl)URL.revokeObjectURL(state.videoUrl);
    state.videoUrl=URL.createObjectURL(file);$("videoPreview").src=state.videoUrl;$("videoPreview").hidden=false;$("videoInfo").textContent=file.name;
    status("Vídeo cargado. Cargue el JSON de Kinovea.");
  };
  $("jsonFile").onchange=event=>{
    const file=event.target.files?.[0];if(!file)return;
    loadJson(file).catch(error=>{state.kinovea=null;renderSummary();renderMapping();status("Error al leer el JSON de Kinovea: "+error.message);});
  };

  bindRange();
  renderSummary();
  renderMapping();
  showScreen(0);
})();