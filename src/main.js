import * as THREE from 'three';
import GUI from 'lil-gui';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ---------- 错误叠加层：把错误直接显示在页面上，避免“空白” ---------- */
(function attachErrorOverlay() {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:0;top:0;max-width:70vw;max-height:60vh;overflow:auto;background:rgba(0,0,0,.75);color:#fff;font:12px/1.4 ui-monospace,monospace;padding:10px;z-index:99999;display:none;';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(box));
  function show(msg){ box.style.display='block'; box.innerText += msg+'\n'; }
  window.addEventListener('error', e => show('[error] ' + e.message));
  window.addEventListener('unhandledrejection', e => show('[promise] ' + (e.reason?.message || e.reason)));
})();
console.log('[boot] main.js loaded');

/* ---------- 场景 / 相机 / 渲染器 ---------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 1000);
camera.position.set(0, 1, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setAnimationLoop(animate);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

/* ---------- 灯光 ---------- */
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 3);
keyLight.position.set(5, 10, 7.5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 500;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffee, 1.5);
fillLight.position.set(-10, 5, 7.5);
fillLight.castShadow = true;
fillLight.shadow.mapSize.set(1024, 1024);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xeeeeff, 2);
rimLight.position.set(0, 10, -10);
scene.add(rimLight);

const bottomLight = new THREE.PointLight(0xffffff, 1, 20);
bottomLight.position.set(0, -3, 0);
bottomLight.castShadow = true;
scene.add(bottomLight);

/* ---------- 控制器 ---------- */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.enableZoom = true;
controls.enablePan = false;

/* ---------- 模型与交互状态 ---------- */
let guitarModel = null;
let autoRotateSpeed = 0.005;

let isDragging = false;
let lastMouseX = 0, lastMouseY = 0;
let movementHistory = [];
let velocity = { x: 0, y: 0, z: 0 };
const minVelocity = 0.0001;

const motionState = { curveIntensity: 0.5, historyLimit: 10, inertia: 0.92 };

/* ---------- 加载模型（相对 main.js 的路径，避免 Pages 子路径 404） ---------- */
const loader = new GLTFLoader();
const modelURL = new URL('../models/guitar.glb', import.meta.url).href;

loader.load(
  modelURL,
  (gltf) => {
    console.log('模型加载成功!');
    guitarModel = gltf.scene;

    guitarModel.position.set(0, 0, 0);
    guitarModel.scale.set(0.5, 0.5, 0.5);
    guitarModel.rotation.set(-Math.PI/4, -Math.PI/4, -Math.PI/4);

    guitarModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          if ('roughness' in child.material)
            child.material.roughness = Math.max(0.3, child.material.roughness);
          if ('metalness' in child.material)
            child.material.metalness = Math.min(0.7, child.material.metalness);
        }
      }
    });

    scene.add(guitarModel);
    addGuitarControls();
  },
  undefined,
  (error) => {
    console.error(error);
    // 占位方块：即使模型失败，也能看到画面并继续调试
    const fallback = new THREE.Mesh(
      new THREE.BoxGeometry(1,1,1),
      new THREE.MeshNormalMaterial()
    );
    guitarModel = fallback;
    scene.add(guitarModel);
    addGuitarControls();
  }
);

/* ---------- 拖拽旋转 + 惯性 ---------- */
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  isDragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  movementHistory = [];
  velocity = { x: 0, y: 0, z: 0 };
});

addEventListener('mousemove', (e) => {
  if (!isDragging || !guitarModel) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;

  movementHistory.push({ x: dx, y: dy });
  if (movementHistory.length > motionState.historyLimit) movementHistory.shift();

  let smoothedX = 0, smoothedY = 0;
  movementHistory.forEach((m, i) => {
    const w = (i + 1) / movementHistory.length;
    smoothedX += m.x * w * motionState.curveIntensity;
    smoothedY += m.y * w * motionState.curveIntensity;
  });

  velocity.x = smoothedY * 0.005;
  velocity.y = smoothedX * 0.005;
  velocity.z = (smoothedX - smoothedY) * 0.002 * motionState.curveIntensity;

  guitarModel.rotation.x += velocity.x;
  guitarModel.rotation.y += velocity.y;
  guitarModel.rotation.z += velocity.z;

  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

addEventListener('mouseup', (e) => { if (e.button === 0) isDragging = false; });
addEventListener('mouseleave', () => { isDragging = false; });

/* ---------- GUI ---------- */
const gui = new GUI();

function addGuitarControls() {
  if (!guitarModel) return;

  const guitarFolder = gui.addFolder('吉他模型');
  guitarFolder.add(guitarModel.position, 'x', -10, 10).name('X 轴');
  guitarFolder.add(guitarModel.position, 'y', -10, 10).name('Y 轴');
  guitarFolder.add(guitarModel.position, 'z', -10, 10).name('Z 轴');

  guitarFolder.add(guitarModel.rotation, 'x', -Math.PI, Math.PI).name('X 旋转');
  guitarFolder.add(guitarModel.rotation, 'y', -Math.PI, Math.PI).name('Y 旋转');
  guitarFolder.add(guitarModel.rotation, 'z', -Math.PI, Math.PI).name('Z 旋转');

  guitarFolder.add(guitarModel.scale, 'x', 0.1, 5).name('X 缩放').listen();
  guitarFolder.add(guitarModel.scale, 'y', 0.1, 5).name('Y 缩放').listen();
  guitarFolder.add(guitarModel.scale, 'z', 0.1, 5).name('Z 缩放').listen();

  const scaleControl = { scale: 1 };
  guitarFolder.add(scaleControl, 'scale', 0.1, 5).name('统一缩放')
    .onChange(v => guitarModel.scale.set(v, v, v));

  const autoState = { autoRotateSpeed };
  guitarFolder.add(autoState, 'autoRotateSpeed', 0, 0.02, 0.001).name('自动旋转速度')
    .onChange(v => autoRotateSpeed = v);
}

const motionFolder = gui.addFolder('运动效果');
motionFolder.add(motionState, 'curveIntensity', 0.1, 2, 0.1).name('曲线强度')
  .onChange(v => motionState.curveIntensity = v);
motionFolder.add(motionState, 'historyLimit', 3, 30, 1).name('平滑度')
  .onChange(v => motionState.historyLimit = v);
motionFolder.add(motionState, 'inertia', 0.85, 0.98, 0.01).name('惯性大小')
  .onChange(v => motionState.inertia = v);

const lightFolder = gui.addFolder('光照');
lightFolder.add(ambientLight, 'intensity', 0, 10).name('环境光强度');

const keyFolder = lightFolder.addFolder('主光源');
keyFolder.add(keyLight, 'intensity', 0, 10).name('强度');
keyFolder.add(keyLight.position, 'x', -20, 20).name('X 位置');
keyFolder.add(keyLight.position, 'y', -20, 20).name('Y 位置');
keyFolder.add(keyLight.position, 'z', -20, 20).name('Z 位置');

const fillFolder = lightFolder.addFolder('填充光');
fillFolder.add(fillLight, 'intensity', 0, 10).name('强度');
fillFolder.add(fillLight.position, 'x', -20, 20).name('X 位置');
fillFolder.add(fillLight.position, 'y', -20, 20).name('Y 位置');
fillFolder.add(fillLight.position, 'z', -20, 20).name('Z 位置');

const rimFolder = lightFolder.addFolder('轮廓光');
rimFolder.add(rimLight, 'intensity', 0, 10).name('强度');
rimFolder.add(rimLight.position, 'x', -20, 20).name('X 位置');
rimFolder.add(rimLight.position, 'y', -20, 20).name('Y 位置');
rimFolder.add(rimLight.position, 'z', -20, 20).name('Z 位置');

const bottomFolder = lightFolder.addFolder('底部补光');
bottomFolder.add(bottomLight, 'intensity', 0, 10).name('强度');
bottomFolder.add(bottomLight, 'distance', 0, 40).name('光照距离');

/* ---------- 动画循环 ---------- */
function animate() {
  controls.update();

  if (!isDragging && guitarModel) {
    if (Math.abs(velocity.x) > minVelocity ||
        Math.abs(velocity.y) > minVelocity ||
        Math.abs(velocity.z) > minVelocity) {
      guitarModel.rotation.x += velocity.x;
      guitarModel.rotation.y += velocity.y;
      guitarModel.rotation.z += velocity.z;

      velocity.x *= motionState.inertia;
      velocity.y *= motionState.inertia;
      velocity.z *= motionState.inertia;

      if (Math.abs(velocity.x) < minVelocity) velocity.x = 0;
      if (Math.abs(velocity.y) < minVelocity) velocity.y = 0;
      if (Math.abs(velocity.z) < minVelocity) velocity.z = 0;
    } else {
      guitarModel.rotation.y += autoRotateSpeed; // 自动旋转
    }
  }

  renderer.render(scene, camera);
}

/* ---------- 自适应 ---------- */
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
