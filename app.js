const canvas = document.getElementById('glCanvas');
const placeholder = document.getElementById('placeholder');
const upload = document.getElementById('imageUpload');
const intensity = document.getElementById('intensity');
const tempo = document.getElementById('tempo');
const title = document.getElementById('effectTitle');
const playButton = document.getElementById('playButton');
const resolution = document.getElementById('resolution');
let effect = 'pan', playing = true, image = null, start = performance.now();

const gl = canvas.getContext('webgl', { premultipliedAlpha: false });
if (!gl) alert('WebGL is unavailable in this browser.');
const vertex = `attribute vec2 p; varying vec2 uv; void main(){uv=(p+1.0)*.5;gl_Position=vec4(p,0.,1.);}`;
const fragment = `precision highp float; varying vec2 uv; uniform sampler2D image; uniform float time, power, mode, ratio, imageRatio;
vec2 cover(vec2 c){float r=ratio/imageRatio;return r>1.?vec2((c.x-.5)/r+.5,c.y):vec2(c.x,(c.y-.5)*r+.5);}
void main(){vec2 p=uv;float t=time; if(mode<.5){p.x+=sin(t*.7)*.045*power;p.y+=cos(t*.45)*.012*power;} else if(mode<1.5){float z=1.-.09*power*(.5+.5*sin(t*.75));p=(p-.5)*z+.5;} else if(mode>2.5){p.x+=sin(p.y*15.+t*2.)*.025*power;p.y+=sin(p.x*11.+t*1.5)*.018*power;}vec4 c=texture2D(image,cover(p));if(mode>1.5&&mode<2.5){c.rgb+=.12*power*vec3(sin(t+uv.y*4.),sin(t*1.3+2.),sin(t*.8+4.));}gl_FragColor=c;}`;
function shader(type, source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);return s}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);gl.useProgram(program);
const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
const uni=n=>gl.getUniformLocation(program,n);const modeMap={pan:0,zoom:1,color:2,wave:3};
function resize(){const box=canvas.parentElement.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);canvas.width=box.width*dpr;canvas.height=box.height*dpr;gl.viewport(0,0,canvas.width,canvas.height)}new ResizeObserver(resize).observe(canvas.parentElement);
function draw(now){requestAnimationFrame(draw);if(!image)return;const speed=+tempo.value/8, time=playing?(now-start)/1000*speed:0;gl.uniform1f(uni('time'),time);gl.uniform1f(uni('power'),+intensity.value/100);gl.uniform1f(uni('mode'),modeMap[effect]);gl.uniform1f(uni('ratio'),canvas.width/canvas.height);gl.uniform1f(uni('imageRatio'),image.width/image.height);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}requestAnimationFrame(draw);
upload.addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{image=new Image();image.onload=()=>{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);placeholder.classList.add('hidden');resolution.textContent=`${image.width} × ${image.height}`;start=performance.now()};image.src=reader.result};reader.readAsDataURL(file)});
document.querySelectorAll('.effect').forEach(button=>button.addEventListener('click',()=>{document.querySelector('.effect.selected').classList.remove('selected');document.querySelector('[aria-checked="true"]').setAttribute('aria-checked','false');button.classList.add('selected');button.setAttribute('aria-checked','true');effect=button.dataset.effect;title.textContent=button.querySelector('strong').textContent;start=performance.now()}));
intensity.addEventListener('input',()=>document.getElementById('intensityValue').textContent=`${intensity.value}%`);tempo.addEventListener('input',()=>document.getElementById('tempoValue').textContent=`${(+tempo.value/10).toFixed(1)}×`);
function toggle(){playing=!playing;playButton.classList.toggle('paused',!playing);playButton.innerHTML=`<span></span>${playing?'Pause':'Play'}`;playButton.setAttribute('aria-label',playing?'Pause animation':'Play animation');if(playing)start=performance.now()}playButton.addEventListener('click',toggle);document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target.tagName!=='INPUT'){e.preventDefault();toggle()}});document.getElementById('resetButton').addEventListener('click',()=>{intensity.value=42;tempo.value=8;intensity.dispatchEvent(new Event('input'));tempo.dispatchEvent(new Event('input'));document.querySelector('[data-effect="pan"]').click()});
