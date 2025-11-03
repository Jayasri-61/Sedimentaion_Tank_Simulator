/* script.js
  Shared logic for index, result, diagram, visualize pages.
  - Uses localStorage to pass input and computed design between pages.
  - Renders 2D plan view onto <canvas id="planCanvas">
  - Initializes Three.js in container #threeContainer and updates geometry to match computed dims.
  - Combined PNG download merges 2D canvas + 3D renderer image into single white canvas and downloads.
*/

/* ---------- Utility helpers ---------- */
const $ = id => document.getElementById(id);
const fmt = (n, d = 2) => (isFinite(n) ? Number(n).toLocaleString(undefined, { maximumFractionDigits: d }) : '--');

/* ---------- Design calculations (textbook style) ---------- */
function calcDesignFromInputs(inputs) {
  // inputs: { population, pcd, process, tankType, detention, depth, sor, lbratio }
  const P = Number(inputs.population) || 0;
  const pcd = Number(inputs.pcd) || 150; // Lpcd
  const detention = Number(inputs.detention) || 2.5;
  const depth = Number(inputs.depth) || 3.5;
  const sor_L = Number(inputs.sor) || 20000; // L / m2 / day
  const tankType = inputs.tankType || 'horizontal';
  const lbr = Number(inputs.lbratio) || 4;

  // Flows
  const Q_day_m3 = (P * pcd) / 1000; // m3/day
  const Q_m3_s = Q_day_m3 / 86400;   // m3/s

  // SOR convert
  const SOR_m3_m2_day = sor_L / 1000; // m3/m2/day

  // Plan area by overflow
  const planArea = (SOR_m3_m2_day > 0) ? (Q_day_m3 / SOR_m3_m2_day) : 0; // m2

  // Volumes
  const V_det = Q_m3_s * detention * 3600; // m3 (by detention)
  const V_area = planArea * depth;         // m3 (by area x depth)
  const controllingVolume = Math.max(V_det, V_area);

  // Geometry
  let L = 0, B = 0, Dia = 0;
  if (tankType === 'horizontal') {
    L = Math.sqrt(planArea * lbr) || 0;
    B = planArea / (L || 1) || 0;
  } else {
    Dia = Math.sqrt((4 * planArea) / Math.PI) || 0;
  }

  return {
    P, pcd, Q_day_m3, Q_m3_s, SOR_m3_m2_day: SOR_m3_m2_day,
    planArea, V_det, V_area, controllingVolume, L, B, Dia, depth, detention, tankType, lbr
  };
}

/* ---------- Index page wiring ---------- */
function indexPageInit() {
  const btnCompute = $('btnCompute'), btnReset = $('btnReset'), btnViewDiag = $('btnViewDiagram');

  btnCompute?.addEventListener('click', () => {
    const inputs = {
      population: $('population').value,
      pcd: $('pcd').value,
      process: $('process').value,
      tankType: $('tankType').value,
      detention: $('detention').value,
      depth: $('depth').value,
      sor: $('sor').value,
      lbratio: $('lbratio').value
    };
    // compute design
    const design = calcDesignFromInputs(inputs);
    // store both inputs and design in localStorage
    localStorage.setItem('sts_inputs', JSON.stringify(inputs));
    localStorage.setItem('sts_design', JSON.stringify(design));
    // show results in the right panel and enable view button
    showResultsInline(design);
    $('btnViewDiagram').style.display = 'inline-block';
    $('btnBack').style.display = 'inline-block';
  });

  btnReset?.addEventListener('click', () => {
    if (!confirm('Reset inputs to defaults?')) return;
    $('population').value = 20000;
    $('pcd').value = 150;
    $('process').value = 'Plain Sedimentation (gravity)';
    $('tankType').value = 'horizontal';
    $('detention').value = 2.5;
    $('depth').value = 3.5;
    $('sor').value = 20000;
    $('lbratio').value = 4;
    $('resultsBox').innerHTML = '<div class="muted">No calculation yet. Click <strong>Compute & Show Results</strong>.</div>';
    $('btnViewDiagram').style.display = 'none';
    $('btnBack').style.display = 'none';
    localStorage.removeItem('sts_inputs');
    localStorage.removeItem('sts_design');
  });

  $('btnViewDiagram')?.addEventListener('click', () => {
    // go to result page
    window.location.href = 'result.html';
  });

  // If design already present (returning user), show it
  const existingDesign = JSON.parse(localStorage.getItem('sts_design') || 'null');
  if (existingDesign) {
    showResultsInline(existingDesign);
    $('btnViewDiagram').style.display = 'inline-block';
    $('btnBack').style.display = 'inline-block';
  }
}

function showResultsInline(design) {
  // render short results into resultsBox on index page
  if (!design) return;
  const lines = [];
  lines.push(`<strong>Population:</strong> ${design.P.toLocaleString()} persons`);
  lines.push(`<strong>Daily water (Q):</strong> ${fmt(design.Q_day_m3,2)} m³/day (${fmt(design.Q_m3_s,6)} m³/s)`);
  lines.push(`<strong>Plan area (A):</strong> ${fmt(design.planArea,2)} m²`);
  lines.push(`<strong>Depth (D):</strong> ${fmt(design.depth,2)} m`);
  lines.push(`<strong>V_det:</strong> ${fmt(design.V_det,2)} m³  |  <strong>V_area:</strong> ${fmt(design.V_area,2)} m³`);
  if (design.tankType === 'horizontal') {
    lines.push(`<strong>Dims (L×B×D):</strong> ${fmt(design.L,2)} m × ${fmt(design.B,2)} m × ${fmt(design.depth,2)} m`);
  } else {
    lines.push(`<strong>Dims (Ø×D):</strong> Ø = ${fmt(design.Dia,2)} m × ${fmt(design.depth,2)} m`);
  }
  $('resultsBox').innerHTML = lines.join('<br>');
}

/* ---------- Result page wiring ---------- */
function resultPageInit() {
  const design = JSON.parse(localStorage.getItem('sts_design') || 'null');
  if (!design) {
    alert('No design found. Please enter inputs first.');
    window.location.href = 'home.html';
    return;
  }
  // Fill results area
  const lines = [];
  lines.push(`<p><strong>Total Daily Water Requirement:</strong> ${fmt(design.Q_day_m3,2)} m³/day (${(design.P * design.pcd).toLocaleString()} L/day)</p>`);
  lines.push(`<p><strong>Flow Rate (Q):</strong> ${fmt(design.Q_m3_s,6)} m³/s</p>`);
  lines.push(`<p><strong>Plan area required (A):</strong> ${fmt(design.planArea,2)} m²</p>`);
  lines.push(`<p><strong>Depth (D):</strong> ${fmt(design.depth,2)} m</p>`);
  lines.push(`<p><strong>Volume by detention (V_det):</strong> ${fmt(design.V_det,2)} m³</p>`);
  lines.push(`<p><strong>Volume by area×depth (V_area):</strong> ${fmt(design.V_area,2)} m³</p>`);
  lines.push(`<p><strong>Controlling volume (use):</strong> ${fmt(design.controllingVolume,2)} m³</p>`);
  if (design.tankType === 'horizontal') {
    lines.push(`<p><strong>Rectangular dims (L × B × D):</strong> ${fmt(design.L,2)} m × ${fmt(design.B,2)} m × ${fmt(design.depth,2)} m (L:B=${design.lbr}:1)</p>`);
  } else {
    lines.push(`<p><strong>Circular dims (Ø × D):</strong> Ø = ${fmt(design.Dia,2)} m × ${fmt(design.depth,2)} m</p>`);
  }
  $('results') && ($('results').innerHTML = lines.join(''));

  // buttons
  $('btnDiagram')?.addEventListener('click', () => { window.location.href = 'diagram.html'; });
  $('btnBackToInput')?.addEventListener('click', () => { window.location.href = 'home.html'; });
}

/* ---------- Diagram page: 2D drawing + 3D Three.js ---------- */
let threeRenderer, threeScene, threeCamera, threeMesh, threeContainer, animateId;

function diagramPageInit() {
  const design = JSON.parse(localStorage.getItem('sts_design') || 'null');
  if (!design) {
    alert('No design found. Please compute first.');
    window.location.href = 'home.html';
    return;
  }

  // draw 2D plan
  drawPlan(design);

  // init 3D
  initThree(design);

  // fill measurement text
  updateMeasurementsBox(design);

  // download button
  $('btnDownload')?.addEventListener('click', async () => {
    await downloadCombinedPNG();
  });

  $('btnBack')?.addEventListener('click', () => {
    // stop animation
    stopThree();
    window.location.href = 'result.html';
  });

  $('btnOpen3D')?.addEventListener('click', () => {
    // open full 3D page
    window.location.href = 'visualize.html';
  });
}

function drawPlan(d) {
  const canvas = $('planCanvas');
  const ctx = canvas.getContext('2d');
  // white print-ready background
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = '#0b61a6'; ctx.lineWidth = 2; ctx.font='14px Arial'; ctx.fillStyle='#0b61a6';

  // margin/pad
  const pad = 40, maxW = canvas.width - pad*2, maxH = canvas.height - pad*2;

  if (d.tankType === 'horizontal') {
    const L = d.L || 10, B = d.B || 3;
    const scale = Math.min(maxW / Math.max(L,1), maxH / Math.max(B,1));
    const w = L * scale, h = B * scale;
    const x0 = (canvas.width - w)/2, y0 = (canvas.height - h)/2;
    // rectangle (plan)
    ctx.strokeRect(x0, y0, w, h);
    ctx.fillText('Plan view', x0 + w/2 - 30, y0 - 12);
    // labels
    ctx.fillText('Influent', x0 - 6, y0 + h/2 - 6);
    ctx.fillText('Effluent', x0 + w - 50, y0 + h/2 - 6);
    // dimension lines
    drawDim2D(ctx, x0, y0 + h + 18, x0 + w, y0 + h + 18, `${fmt(L,2)} m`);
    drawDim2D(ctx, x0 - 18, y0 + h, x0 - 18, y0, `${fmt(B,2)} m`, true);
  } else {
    // circular plan
    const Dia = d.Dia || 10;
    const scale = Math.min(maxW / (Dia*1.2), maxH / (Dia*1.2));
    const r = (Dia/2) * scale;
    const cx = canvas.width/2, cy = canvas.height/2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
    ctx.fillText('Plan view', cx - 28, cy - r - 12);
    drawDim2D(ctx, cx - r, cy + r + 18, cx + r, cy + r + 18, `Ø ${fmt(Dia,2)} m`);
  }
}

/* 2D dimension helper */
function drawDim2D(ctx,x1,y1,x2,y2,label,vertical=false){
  ctx.strokeStyle='#0b61a6'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  if(!vertical){
    ctx.beginPath(); ctx.moveTo(x1,y1-6); ctx.lineTo(x1,y1+6); ctx.moveTo(x2,y2-6); ctx.lineTo(x2,y2+6); ctx.stroke();
    ctx.fillStyle='#0b61a6'; ctx.font='12px Arial'; ctx.fillText(label, (x1+x2)/2 - ctx.measureText(label).width/2, y1 - 8);
  } else {
    ctx.beginPath(); ctx.moveTo(x1-6,y1); ctx.lineTo(x1+6,y1); ctx.moveTo(x2-6,y2); ctx.lineTo(x2+6,y2); ctx.stroke();
    ctx.save(); ctx.translate(x1 - 14, (y1+y2)/2); ctx.rotate(-Math.PI/2); ctx.fillStyle='#0b61a6'; ctx.font='12px Arial'; ctx.fillText(label, -ctx.measureText(label).width/2, -2); ctx.restore();
  }
}

/* ---------- Three.js 3D initialization and update ---------- */
function initThree(d) {
  stopThree(); // ensure previous renderer stopped

  threeContainer = $('threeContainer');
  // create renderer
  threeRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  threeRenderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
  threeContainer.innerHTML = ''; // clear
  threeContainer.appendChild(threeRenderer.domElement);

  // scene & camera
  threeScene = new THREE.Scene();
  threeCamera = new THREE.PerspectiveCamera(50, threeContainer.clientWidth / threeContainer.clientHeight, 0.1, 2000);
  threeCamera.position.set(0, d.depth * 4, d.L ? Math.max(d.L, d.B) * 1.6 : (d.Dia || 10) * 1.6);
  threeCamera.lookAt(0,0,0);

  // lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
  hemi.position.set(0, 200, 0); threeScene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(50,50,50); threeScene.add(dir);

  // axes grid (subtle)
  const grid = new THREE.GridHelper(500, 10, 0x222222, 0x222222); grid.material.opacity = 0.08; grid.material.transparent = true; threeScene.add(grid);

  // geometry (box or cylinder) scaled to convenient units for visualization
  let mesh;
  if (d.tankType === 'horizontal') {
    // use L (length along X), B (breadth along Z), depth H along Y
    const L = d.L || 10, B = d.B || 4, H = d.depth || 3;
    // scale the model to manageable visualization dimensions
    const scale = 1; // we keep 1:1 meters => viewer sized by camera
    const geom = new THREE.BoxGeometry(L*scale, H*scale, B*scale);
    const mat = new THREE.MeshPhongMaterial({ color: 0x00b7ff, opacity:0.18, transparent:true, side:THREE.DoubleSide });
    const wire = new THREE.MeshBasicMaterial({ color: 0x00b7ff, wireframe:true });
    mesh = new THREE.Mesh(geom, mat);
    const wireMesh = new THREE.Mesh(geom, wire);
    const group = new THREE.Group(); group.add(mesh); group.add(wireMesh);
    threeScene.add(group);
    threeMesh = group;
  } else {
    // cylinder
    const Dia = d.Dia || 8;
    const H = d.depth || 3;
    const geom = new THREE.CylinderGeometry(Dia/2, Dia/2, H, 48, 1, false);
    const mat = new THREE.MeshPhongMaterial({ color:0x00b7ff, opacity:0.18, transparent:true, side:THREE.DoubleSide });
    const wire = new THREE.MeshBasicMaterial({ color: 0x00b7ff, wireframe:true });
    const meshC = new THREE.Mesh(geom, mat);
    const wireC = new THREE.Mesh(geom, wire);
    const group = new THREE.Group(); group.add(meshC); group.add(wireC);
    threeScene.add(group);
    threeMesh = group;
  }

  // center the mesh at origin
  threeMesh.position.set(0, 0, 0);

  // animate rotation
  function animate() {
    animateId = requestAnimationFrame(animate);
    threeMesh.rotation.y += 0.006;
    threeMesh.rotation.x += 0.001;
    threeRenderer.render(threeScene, threeCamera);
  }
  animate();
}

/* Stop three animation and dispose */
function stopThree() {
  if (animateId) cancelAnimationFrame(animateId);
  if (threeRenderer) {
    try {
      threeRenderer.forceContextLoss();
      threeRenderer.domElement = null;
      threeRenderer.context = null;
      threeRenderer = null;
    } catch (e) { /* ignore */ }
  }
}

/* ---------- measurements text ---------- */
function updateMeasurementsBox(d) {
  const box = $('measurements');
  const parts = [];
  parts.push(`<strong>Plan area:</strong> ${fmt(d.planArea,2)} m²`);
  if (d.tankType === 'horizontal') parts.push(`<strong>Dimensions:</strong> L = ${fmt(d.L,2)} m | B = ${fmt(d.B,2)} m | D = ${fmt(d.depth,2)} m`);
  else parts.push(`<strong>Dimensions:</strong> Ø = ${fmt(d.Dia,2)} m | D = ${fmt(d.depth,2)} m`);
  parts.push(`<strong>Volume (area×depth):</strong> ${fmt(d.V_area,2)} m³`);
  box.innerHTML = parts.join(' &nbsp; | &nbsp; ');
}

/* ---------- Combined PNG download (plan canvas + current 3D renderer image) ---------- */
async function downloadCombinedPNG() {
  const design = JSON.parse(localStorage.getItem('sts_design') || 'null');
  if (!design) return alert('No design available.');

  // 1) get 2D plan image data
  const planCanvas = $('planCanvas');
  // ensure plan is up-to-date
  drawPlan(design);
  const planDataURL = planCanvas.toDataURL('image/png');

  // 2) get 3D renderer image: use threeRenderer.domElement.toDataURL()
  // Wait a frame to ensure renderer available
  await new Promise(r => setTimeout(r, 80));
  let threeDataURL = null;
  if (threeRenderer && threeRenderer.domElement) {
    try { threeDataURL = threeRenderer.domElement.toDataURL('image/png'); }
    catch (e) {
      // Some browsers block toDataURL with preserveDrawingBuffer:false; but we set preserveDrawingBuffer true on init
      console.warn('Unable to capture 3D canvas:', e);
    }
  }

  // 3) create output PNG canvas and composite: white background, header, left plan, right 3D, measurements text
  const planImg = await loadImg(planDataURL);
  const threeImg = threeDataURL ? await loadImg(threeDataURL) : null;

  // Compute output size
  const pad = 40;
  const contentW = planImg.width + (threeImg ? threeImg.width + pad : 0);
  const headerH = 72;
  const outW = contentW + pad*2;
  const outH = Math.max(planImg.height, (threeImg?threeImg.height:0)) + headerH + pad*2 + 80;

  const out = document.createElement('canvas'); out.width = outW; out.height = outH;
  const ctx = out.getContext('2d');

  // White background for print-ready
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,outW,outH);

  // Header text
  ctx.fillStyle = '#073347'; ctx.font = 'bold 20px Arial'; ctx.fillText('Sedimentation Tank — Plan & 3D Diagram', pad, 34);
  ctx.font = '13px Arial'; ctx.fillStyle='#073347';
  ctx.fillText(`Volume (controlling): ${fmt(design.controllingVolume,2)} m³`, pad, 54);

  // Draw plan image at left
  const leftX = pad; const topY = headerH;
  ctx.drawImage(planImg, leftX, topY);

  // Draw 3D image at right (if exists)
  if (threeImg) {
    const rightX = leftX + planImg.width + pad;
    ctx.drawImage(threeImg, rightX, topY);
  }

  // Measurements text below
  ctx.fillStyle = '#073347'; ctx.font = 'bold 13px Arial';
  const measText = (design.tankType === 'horizontal')
    ? `L = ${fmt(design.L,2)} m   |   B = ${fmt(design.B,2)} m   |   D = ${fmt(design.depth,2)} m`
    : `Ø = ${fmt(design.Dia,2)} m   |   D = ${fmt(design.depth,2)} m`;
  ctx.fillText(measText, pad, topY + Math.max(planImg.height, (threeImg?threeImg.height:0)) + 28);

  // Download
  const a = document.createElement('a'); a.href = out.toDataURL('image/png'); a.download = 'sedimentation_tank_diagram.png'; a.click();
}

/* helper to load image from dataURL */
function loadImg(dataURL){
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = e => rej(e);
    img.src = dataURL;
  });
}

/* ---------- Visualize page init (full 3D) ---------- */
function visualizePageInit() {
  const design = JSON.parse(localStorage.getItem('sts_design') || 'null');
  if (!design) { alert('No design found'); window.location.href = 'home.html'; return; }

  // create full 3D renderer in #full3D or #threeContainer fallback
  const container = $('full3D') || $('threeContainer') || document.body;
  // if #full3D exists (visualize.html)
  if ($('full3D')) {
    // init renderer similar to diagram page but larger
    stopThree();

    threeRenderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
    threeRenderer.setSize(container.clientWidth, 600);
    container.innerHTML=''; container.appendChild(threeRenderer.domElement);

    threeScene = new THREE.Scene();
    threeCamera = new THREE.PerspectiveCamera(55, container.clientWidth / 600, 0.1, 5000);
    threeCamera.position.set(0, design.depth * 4, Math.max(design.L || design.Dia || 10, design.B || 10) * 2);
    threeCamera.lookAt(0,0,0);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9); threeScene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(100,100,100); threeScene.add(dir);
    const grid = new THREE.GridHelper(2000, 20, 0xcccccc, 0xcccccc); grid.material.opacity = 0.08; grid.material.transparent = true; threeScene.add(grid);

    // geometry
    let group;
    if (design.tankType === 'horizontal') {
      const geom = new THREE.BoxGeometry(design.L, design.depth, design.B);
      const mat = new THREE.MeshPhongMaterial({ color:0x00b7ff, opacity:0.25, transparent:true });
      const wire = new THREE.MeshBasicMaterial({ color:0x00b7ff, wireframe:true });
      const m = new THREE.Mesh(geom, mat); const w = new THREE.Mesh(geom, wire);
      group = new THREE.Group(); group.add(m); group.add(w);
    } else {
      const geom = new THREE.CylinderGeometry(design.Dia/2, design.Dia/2, design.depth, 64);
      const mat = new THREE.MeshPhongMaterial({ color:0x00b7ff, opacity:0.25, transparent:true });
      const wire = new THREE.MeshBasicMaterial({ color:0x00b7ff, wireframe:true });
      const m = new THREE.Mesh(geom, mat); const w = new THREE.Mesh(geom, wire);
      group = new THREE.Group(); group.add(m); group.add(w);
    }
    threeScene.add(group); threeMesh = group;

    // animate
    function anim(){
      animateId = requestAnimationFrame(anim);
      threeMesh.rotation.y += 0.008;
      threeRenderer.render(threeScene, threeCamera);
    }
    anim();
  }
}

/* ---------- Page initializer: detect which page and init ---------- */
window.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.endsWith('/') || path.endsWith('home.html')) {
    indexPageInit();
  } else if (path.endsWith('result.html')) {
    resultPageInit();
  } else if (path.endsWith('diagram.html')) {
    diagramPageInit();
  } else if (path.endsWith('visualize.html')) {
    visualizePageInit();
  }
});
