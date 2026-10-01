const $ = (selector) => document.querySelector(selector);
const canvas = $('#glCanvas');
const frame = $('#canvasFrame');
const placeholder = $('#placeholder');
const upload = $('#imageUpload');
const intensity = $('#intensity');
const tempo = $('#tempo');
const sizeSelect = $('#canvasSize');
const presetSelect = $('#screenPreset');
const rotationSelect = $('#rotation');
const selectionMode = $('#selectionMode');
const multiSelect = $('#multiSelect');
const flipHorizontal = $('#flipHorizontal');
const flipVertical = $('#flipVertical');
const selectionBox = $('#selectionBox');
const formatSelect = $('#exportFormat');
const qualitySelect = $('#exportQuality');
const durationSelect = $('#exportDuration');
const exportButton = $('#exportButton');
const exportNote = $('#exportNote');

const effectFamilies = [
  ['pan', 'Pan'], ['zoom', 'Zoom'], ['color', 'Color'], ['wave', 'Wave'], ['orbit', 'Orbit'],
  ['ripple', 'Ripple'], ['drift', 'Drift'], ['pulse', 'Pulse'], ['tilt', 'Tilt'], ['blur', 'Texture'],
];
const styleNames = ['Aurora', 'Breeze', 'Cinematic', 'Dawn', 'Ember', 'Float', 'Glow', 'Horizon', 'Ink', 'Jewel', 'Kinetic', 'Lunar', 'Mist', 'Nova', 'Opal', 'Prism', 'Quiet', 'Radiant', 'Solar', 'Velvet'];
const effects = effectFamilies.flatMap(([type, family]) => styleNames.map((style, variant) => ({
  type, variant, name: `${family} ${style}`, subtitle: `${family.toLowerCase()} motion · variation ${variant + 1}`,
})));


let effect = effects[0];
let playing = true;
let sourceImage = null;
let startTime = performance.now();
let pausedAt = 0;
let exportInProgress = false;
let selections = [[0.25, 0.25, 0.75, 0.75]];
let activeSelection = 0;
let drawingSelection = false;
let selectionStart = null;

const effectGrid = $('#effectGrid');
function renderEffects(query = '') {
  const term = query.trim().toLowerCase();
  effectGrid.innerHTML = effects.map((item, index) => ({ item, index })).filter(({ item }) => !term || `${item.name} ${item.subtitle}`.toLowerCase().includes(term)).map(({ item, index }) => `<button class="effect ${effect === item ? 'selected' : ''}" data-index="${index}" role="radio" aria-checked="${effect === item}"><span class="effect-icon effect-${item.type}"></span><strong>${item.name}</strong><small>${item.subtitle}</small></button>`).join('') || '<p class="no-effects">No animations match your search.</p>';
}
renderEffects();
$('#effectSearch').addEventListener('input', (event) => renderEffects(event.target.value));

const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: false });
if (!gl) throw new Error('WebGL is required to render this animation.');
const vertexSource = `attribute vec2 p; varying vec2 uv; void main(){uv=(p+1.0)*.5;gl_Position=vec4(p,0.,1.);}`;
const fragmentSource = `precision highp float; varying vec2 uv; uniform sampler2D image; uniform float time,power,mode,variant,ratio,imageRatio,rotation,selectionActive,selectionCount,flipX,flipY;uniform vec4 selectionA,selectionB,selectionC,selectionD;
vec2 cover(vec2 c){float r=ratio/imageRatio;return r>1.?vec2((c.x-.5)/r+.5,c.y):vec2(c.x,(c.y-.5)*r+.5);}
vec2 rotate(vec2 p,float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c)*(p-.5)+.5;}
float inRect(vec2 p,vec4 r){return step(r.x,p.x)*step(r.y,p.y)*step(p.x,r.z)*step(p.y,r.w);}
void main(){vec2 raw=uv;if(flipX>.5)raw.x=1.-raw.x;if(flipY>.5)raw.y=1.-raw.y;raw=rotate(raw,rotation);vec2 p=raw;float t=time;float v=variant;if(mode<.5){p.x+=sin(t*.7+v)*.045*power*(v==1.?-1.:1.);p.y+=cos(t*.45)*.012*power;}else if(mode<1.5){float z=1.-.12*power*(.5+.5*sin(t*.75+v));p=(p-.5)*z+.5;}else if(mode<2.5){ }else if(mode<3.5){p.x+=sin(p.y*(12.+v*4.)+t*2.)*.028*power;p.y+=sin(p.x*10.+t*1.5)*.02*power;}else if(mode<4.5){p+=vec2(cos(t),sin(t*.8))*.025*power;}else if(mode<5.5){p+=(p-.5)*sin(length(p-.5)*28.-t*4.)*.035*power;}else if(mode<6.5){p+=vec2(sin(t*.8),cos(t*.6))*.025*power;}else if(mode<7.5){float z=1.-.1*power*(.5+.5*sin(t*(1.+v*.5)));p=(p-.5)*z+.5;}else if(mode<8.5){p.x+=(p.y-.5)*sin(t)*.07*power;}float inside=inRect(raw,selectionA);if(selectionCount>1.)inside=max(inside,inRect(raw,selectionB));if(selectionCount>2.)inside=max(inside,inRect(raw,selectionC));if(selectionCount>3.)inside=max(inside,inRect(raw,selectionD));p=mix(raw,p,mix(1.,inside,selectionActive));vec4 c=texture2D(image,cover(p));if(mode>1.5&&mode<2.5)c.rgb+=.14*power*vec3(sin(t+uv.y*4.+v),sin(t*1.3+2.),sin(t*.8+4.));if(mode>8.5&&mode<9.5)c.rgb=mix(c.rgb,vec3(dot(c.rgb,vec3(.299,.587,.114))),.22*power)+sin((uv.x+uv.y+t)*300.)*.025*power;gl_FragColor=c;}`;
function compileShader(type, source) { const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader)); return shader; }
const program = gl.createProgram(); gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource)); gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource)); gl.linkProgram(program); gl.useProgram(program);
const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
const position = gl.getAttribLocation(program, 'p'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture); [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach((key) => gl.texParameteri(gl.TEXTURE_2D, key, gl.LINEAR)); [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((key) => gl.texParameteri(gl.TEXTURE_2D, key, gl.CLAMP_TO_EDGE));
const uniform = (name) => gl.getUniformLocation(program, name);
const modes = { pan: 0, zoom: 1, color: 2, wave: 3, orbit: 4, ripple: 5, drift: 6, pulse: 7, tilt: 8, blur: 9 };
function selectedDimensions() { if (sizeSelect.value === 'original' && sourceImage) return [sourceImage.naturalWidth, sourceImage.naturalHeight]; return sizeSelect.value.split('x').map(Number); }
function resizeCanvas() { const [width, height] = selectedDimensions(); canvas.width = width; canvas.height = height; frame.style.aspectRatio = `${width} / ${height}`; gl.viewport(0, 0, width, height); $('#resolution').textContent = sourceImage ? `${width} × ${height} output` : `${width} × ${height} selected`; }
function elapsed(now) { return playing ? (now - startTime) / 1000 : pausedAt; }
function render(now) { requestAnimationFrame(render); if (!sourceImage) return; gl.uniform1f(uniform('time'), elapsed(now) * (+tempo.value / 8)); gl.uniform1f(uniform('power'), +intensity.value / 100); gl.uniform1f(uniform('mode'), modes[effect.type]); gl.uniform1f(uniform('variant'), effect.variant); gl.uniform1f(uniform('ratio'), canvas.width / canvas.height); gl.uniform1f(uniform('imageRatio'), sourceImage.naturalWidth / sourceImage.naturalHeight); gl.uniform1f(uniform('rotation'), Number(rotationSelect.value) * Math.PI / 180); gl.uniform1f(uniform('selectionActive'), selectionMode.checked ? 1 : 0); gl.uniform1f(uniform('selectionCount'), selections.length); gl.uniform1f(uniform('flipX'), flipHorizontal.checked ? 1 : 0); gl.uniform1f(uniform('flipY'), flipVertical.checked ? 1 : 0); ['selectionA','selectionB','selectionC','selectionD'].forEach((name, index) => gl.uniform4fv(uniform(name), selections[index] || [0.,0.,0.,0.])); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
requestAnimationFrame(render); resizeCanvas();
function setExportNote(message, tone = '') { exportNote.textContent = message; exportNote.className = `export-note ${tone}`; }
const selectionBoxes = [selectionBox];
function setSelectionBoxes() { selections.forEach((selection, index) => { let box = selectionBoxes[index]; if (!box) { box = selectionBox.cloneNode(); box.removeAttribute('id'); frame.append(box); selectionBoxes.push(box); } const [x1,y1,x2,y2] = selection; box.style.left = `${x1*100}%`; box.style.top = `${y1*100}%`; box.style.width = `${(x2-x1)*100}%`; box.style.height = `${(y2-y1)*100}%`; box.classList.toggle('visible', selectionMode.checked); }); selectionBoxes.slice(selections.length).forEach((box) => box.classList.remove('visible')); }
function previewPoint(event) { const box = frame.getBoundingClientRect(); return [Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),Math.max(0,Math.min(1,(event.clientY-box.top)/box.height))]; }
frame.addEventListener('pointerdown', (event) => { if (!selectionMode.checked || !sourceImage) return; drawingSelection = true; selectionStart = previewPoint(event); frame.setPointerCapture(event.pointerId); if (!multiSelect.checked) selections = [[...selectionStart, ...selectionStart]]; else if (selections.length < 4) { selections.push([...selectionStart, ...selectionStart]); activeSelection = selections.length - 1; } else activeSelection = selections.length - 1; selections[activeSelection] = [...selectionStart, ...selectionStart]; setSelectionBoxes(); });
frame.addEventListener('pointermove', (event) => { if (!drawingSelection) return; const [x,y] = previewPoint(event); selections[activeSelection] = [Math.min(selectionStart[0],x),Math.min(selectionStart[1],y),Math.max(selectionStart[0],x),Math.max(selectionStart[1],y)]; setSelectionBoxes(); });
frame.addEventListener('pointerup', () => { drawingSelection = false; });
selectionMode.addEventListener('change', () => { setSelectionBoxes(); setExportNote(selectionMode.checked ? 'Draw on the preview to animate one or more areas.' : 'The full image will animate.', 'success'); });
$('#addSelection').addEventListener('click', () => { selectionMode.checked = true; multiSelect.checked = true; if (selections.length < 4) selections.push([0.25, 0.25, 0.75, 0.75]); activeSelection = selections.length - 1; setSelectionBoxes(); setExportNote('Draw on the preview to set the new animation area.', 'success'); });
$('#clearSelection').addEventListener('click', () => { selections = [[0.25, 0.25, 0.75, 0.75]]; activeSelection = 0; selectionMode.checked = false; setSelectionBoxes(); setExportNote('Selected animation areas cleared.', 'success'); });
sizeSelect.addEventListener('change', () => { presetSelect.value = 'custom'; resizeCanvas(); });
presetSelect.addEventListener('change', () => { const values = { youtube:'1920x1080',short:'1080x1920',instagram:'1080x1080',reel:'1080x1920',tiktok:'1080x1920',x:'1600x900' }; if (values[presetSelect.value]) sizeSelect.value = values[presetSelect.value]; resizeCanvas(); });
upload.addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { sourceImage = new Image(); sourceImage.onload = () => { gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,sourceImage); placeholder.classList.add('hidden'); exportButton.disabled = false; resizeCanvas(); startTime = performance.now(); setExportNote('Ready to render your selected size and quality.', 'success'); }; sourceImage.src = reader.result; }; reader.readAsDataURL(file); });
effectGrid.addEventListener('click', (event) => { const button = event.target.closest('.effect'); if (!button) return; effect = effects[Number(button.dataset.index)]; $('#effectTitle').textContent = effect.name; startTime = performance.now(); renderEffects($('#effectSearch').value); });
intensity.addEventListener('input', () => { $('#intensityValue').textContent = `${intensity.value}%`; }); tempo.addEventListener('input', () => { $('#tempoValue').textContent = `${(+tempo.value/10).toFixed(1)}×`; });
function togglePlayback() { const currentElapsed=elapsed(performance.now()); playing=!playing; if(!playing) pausedAt=currentElapsed; else startTime=performance.now()-pausedAt*1000; const button=$('#playButton'); button.classList.toggle('paused',!playing); button.innerHTML=`<span></span>${playing?'Pause':'Play'}`; button.setAttribute('aria-label',playing?'Pause animation':'Play animation'); }
$('#playButton').addEventListener('click',togglePlayback); document.addEventListener('keydown',(event)=>{if(event.code==='Space'&&event.target.tagName!=='INPUT'&&event.target.tagName!=='SELECT'){event.preventDefault();togglePlayback();}}); $('#resetButton').addEventListener('click',()=>{intensity.value=42;tempo.value=8;sizeSelect.value='1280x720';presetSelect.value='custom';rotationSelect.value='0';selectionMode.checked=false;multiSelect.checked=false;flipHorizontal.checked=false;flipVertical.checked=false;selections=[[0.25,0.25,0.75,0.75]];selectionBoxes.forEach((box)=>box.classList.remove('visible'));intensity.dispatchEvent(new Event('input'));tempo.dispatchEvent(new Event('input'));effect = effects[0]; $('#effectSearch').value = ''; renderEffects(); $('#effectTitle').textContent = effect.name; resizeCanvas();});
function recorderOptions() { const requested=formatSelect.value==='mp4'?['video/mp4;codecs=avc1','video/mp4']:['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm']; const mimeType=requested.find((type)=>MediaRecorder.isTypeSupported(type)); return {mimeType,videoBitsPerSecond:{standard:5_000_000,high:12_000_000,ultra:24_000_000}[qualitySelect.value]}; }
exportButton.addEventListener('click',()=>{if(!sourceImage||exportInProgress)return;if(!canvas.captureStream||!window.MediaRecorder){setExportNote('Video export is not supported in this browser.','error');return;}const options=recorderOptions();if(!options.mimeType){setExportNote(`${formatSelect.value.toUpperCase()} export is not supported here. Try WebM.`,'error');return;}exportInProgress=true;const seconds=Number(durationSelect.value),wasPlaying=playing;if(!playing)togglePlayback();exportButton.disabled=true;exportButton.textContent=`Rendering ${seconds}s video…`;setExportNote(`Recording ${selectedDimensions().join(' × ')} at ${qualitySelect.value} quality.`,'success');const stream=canvas.captureStream(30),chunks=[],recorder=new MediaRecorder(stream,options);recorder.ondataavailable=(event)=>{if(event.data.size)chunks.push(event.data);};recorder.onstop=()=>{const extension=options.mimeType.includes('mp4')?'mp4':'webm',blob=new Blob(chunks,{type:options.mimeType}),link=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:`motion-canvas-${canvas.width}x${canvas.height}.${extension}`});link.click();URL.revokeObjectURL(link.href);stream.getTracks().forEach((track)=>track.stop());exportInProgress=false;exportButton.disabled=false;exportButton.innerHTML='<span>↓</span> Download animation';setExportNote('Your animation download is ready.','success');if(!wasPlaying)togglePlayback();};recorder.start(200);window.setTimeout(()=>recorder.stop(),seconds*1000);});
