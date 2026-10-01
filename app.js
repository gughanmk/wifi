const $ = (selector) => document.querySelector(selector);
const canvas = $('#glCanvas');
const frame = $('#canvasFrame');
const placeholder = $('#placeholder');
const upload = $('#imageUpload');
const intensity = $('#intensity');
const tempo = $('#tempo');
const sizeSelect = $('#canvasSize');
const formatSelect = $('#exportFormat');
const qualitySelect = $('#exportQuality');
const durationSelect = $('#exportDuration');
const exportButton = $('#exportButton');
const exportNote = $('#exportNote');

let effect = 'pan';
let playing = true;
let sourceImage = null;
let startTime = performance.now();
let pausedAt = 0;
let exportInProgress = false;

const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: false });
if (!gl) throw new Error('WebGL is required to render this animation.');

const vertexSource = `attribute vec2 p; varying vec2 uv; void main(){uv=(p+1.0)*.5;gl_Position=vec4(p,0.,1.);}`;
const fragmentSource = `precision highp float; varying vec2 uv; uniform sampler2D image; uniform float time,power,mode,ratio,imageRatio;
vec2 cover(vec2 c){float r=ratio/imageRatio;return r>1.?vec2((c.x-.5)/r+.5,c.y):vec2(c.x,(c.y-.5)*r+.5);}
void main(){vec2 p=uv;float t=time;if(mode<.5){p.x+=sin(t*.7)*.045*power;p.y+=cos(t*.45)*.012*power;}else if(mode<1.5){float z=1.-.09*power*(.5+.5*sin(t*.75));p=(p-.5)*z+.5;}else if(mode>2.5){p.x+=sin(p.y*15.+t*2.)*.025*power;p.y+=sin(p.x*11.+t*1.5)*.018*power;}vec4 c=texture2D(image,cover(p));if(mode>1.5&&mode<2.5)c.rgb+=.12*power*vec3(sin(t+uv.y*4.),sin(t*1.3+2.),sin(t*.8+4.));gl_FragColor=c;}`;

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

const program = gl.createProgram();
gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
gl.linkProgram(program);
gl.useProgram(program);
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
const position = gl.getAttribLocation(program, 'p');
gl.enableVertexAttribArray(position);
gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
[gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach((key) => gl.texParameteri(gl.TEXTURE_2D, key, gl.LINEAR));
[gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((key) => gl.texParameteri(gl.TEXTURE_2D, key, gl.CLAMP_TO_EDGE));
const uniform = (name) => gl.getUniformLocation(program, name);
const modes = { pan: 0, zoom: 1, color: 2, wave: 3 };

function selectedDimensions() {
  if (sizeSelect.value === 'original' && sourceImage) return [sourceImage.naturalWidth, sourceImage.naturalHeight];
  return sizeSelect.value.split('x').map(Number);
}
function resizeCanvas() {
  const [width, height] = selectedDimensions();
  canvas.width = width;
  canvas.height = height;
  frame.style.aspectRatio = `${width} / ${height}`;
  gl.viewport(0, 0, width, height);
  $('#resolution').textContent = sourceImage ? `${width} × ${height} output` : `${width} × ${height} selected`;
}
function elapsed(now) {
  return playing ? (now - startTime) / 1000 : pausedAt;
}
function render(now) {
  requestAnimationFrame(render);
  if (!sourceImage) return;
  const time = elapsed(now) * (+tempo.value / 8);
  gl.uniform1f(uniform('time'), time);
  gl.uniform1f(uniform('power'), +intensity.value / 100);
  gl.uniform1f(uniform('mode'), modes[effect]);
  gl.uniform1f(uniform('ratio'), canvas.width / canvas.height);
  gl.uniform1f(uniform('imageRatio'), sourceImage.naturalWidth / sourceImage.naturalHeight);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
requestAnimationFrame(render);
resizeCanvas();

function setExportNote(message, tone = '') {
  exportNote.textContent = message;
  exportNote.className = `export-note ${tone}`;
}
function updateSize() { resizeCanvas(); }
sizeSelect.addEventListener('change', updateSize);

upload.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    sourceImage = new Image();
    sourceImage.onload = () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceImage);
      placeholder.classList.add('hidden');
      exportButton.disabled = false;
      resizeCanvas();
      startTime = performance.now();
      setExportNote('Ready to render your selected size and quality.', 'success');
    };
    sourceImage.src = reader.result;
  };
  reader.readAsDataURL(file);
});

document.querySelectorAll('.effect').forEach((button) => button.addEventListener('click', () => {
  $('.effect.selected').classList.remove('selected');
  $('[aria-checked="true"]').setAttribute('aria-checked', 'false');
  button.classList.add('selected');
  button.setAttribute('aria-checked', 'true');
  effect = button.dataset.effect;
  $('#effectTitle').textContent = button.querySelector('strong').textContent;
  startTime = performance.now();
}));
intensity.addEventListener('input', () => { $('#intensityValue').textContent = `${intensity.value}%`; });
tempo.addEventListener('input', () => { $('#tempoValue').textContent = `${(+tempo.value / 10).toFixed(1)}×`; });

function togglePlayback() {
  const currentElapsed = elapsed(performance.now());
  playing = !playing;
  if (!playing) pausedAt = currentElapsed;
  else startTime = performance.now() - pausedAt * 1000;
  const button = $('#playButton');
  button.classList.toggle('paused', !playing);
  button.innerHTML = `<span></span>${playing ? 'Pause' : 'Play'}`;
  button.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
}
$('#playButton').addEventListener('click', togglePlayback);
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && event.target.tagName !== 'INPUT' && event.target.tagName !== 'SELECT') {
    event.preventDefault();
    togglePlayback();
  }
});
$('#resetButton').addEventListener('click', () => {
  intensity.value = 42; tempo.value = 8; sizeSelect.value = '1280x720';
  intensity.dispatchEvent(new Event('input')); tempo.dispatchEvent(new Event('input'));
  $('[data-effect="pan"]').click(); resizeCanvas();
});

function recorderOptions() {
  const requested = formatSelect.value === 'mp4' ? ['video/mp4;codecs=avc1', 'video/mp4'] : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mimeType = requested.find((type) => MediaRecorder.isTypeSupported(type));
  const bitrates = { standard: 5_000_000, high: 12_000_000, ultra: 24_000_000 };
  return { mimeType, videoBitsPerSecond: bitrates[qualitySelect.value] };
}
exportButton.addEventListener('click', () => {
  if (!sourceImage || exportInProgress) return;
  if (!canvas.captureStream || !window.MediaRecorder) {
    setExportNote('Video export is not supported in this browser.', 'error');
    return;
  }
  const options = recorderOptions();
  if (!options.mimeType) {
    setExportNote(`${formatSelect.value.toUpperCase()} export is not supported here. Try WebM.`, 'error');
    return;
  }
  exportInProgress = true;
  const seconds = Number(durationSelect.value);
  const wasPlaying = playing;
  if (!playing) togglePlayback();
  exportButton.disabled = true;
  exportButton.textContent = `Rendering ${seconds}s video…`;
  setExportNote(`Recording ${selectedDimensions().join(' × ')} at ${qualitySelect.value} quality.`, 'success');
  const stream = canvas.captureStream(30);
  const chunks = [];
  const recorder = new MediaRecorder(stream, options);
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  recorder.onstop = () => {
    const extension = options.mimeType.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type: options.mimeType });
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `motion-canvas-${canvas.width}x${canvas.height}.${extension}` });
    link.click(); URL.revokeObjectURL(link.href);
    stream.getTracks().forEach((track) => track.stop());
    exportInProgress = false; exportButton.disabled = false; exportButton.innerHTML = '<span>↓</span> Download animation';
    setExportNote('Your animation download is ready.', 'success');
    if (!wasPlaying) togglePlayback();
  };
  recorder.start(200);
  window.setTimeout(() => recorder.stop(), seconds * 1000);
});
