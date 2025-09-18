import * as THREE from 'three';
import GUI from 'lil-gui';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 存储导入的吉他模型
let guitarModel = null;
let autoRotateSpeed = 0.005; // 自动旋转速度（GUI 可调）

// 创建场景
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0); // 浅灰色背景

// 创建相机
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 6;
camera.position.y = 1;

// 创建渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ---------------------- 灯光 ----------------------

// 环境光
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

// 主光源
const keyLight = new THREE.DirectionalLight(0xffffff, 3);
keyLight.position.set(5, 10, 7.5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 500;
scene.add(keyLight);

// 填充光
const fillLight = new THREE.DirectionalLight(0xffffee, 1.5);
fillLight.position.set(-10, 5, 7.5);
fillLight.castShadow = true;
fillLight.shadow.mapSize.width = 1024;
fillLight.shadow.mapSize.height = 1024;
scene.add(fillLight);

// 轮廓光
const rimLight = new THREE.DirectionalLight(0xeeeeff, 2);
rimLight.position.set(0, 10, -10);
rimLight.castShadow = false;
scene.add(rimLight);

// 底部补光
const bottomLight = new THREE.PointLight(0xffffff, 1, 20);
bottomLight.position.set(0, -3, 0);
bottomLight.castShadow = true;
scene.add(bottomLight);

// （可选）接收阴影的地面
// const ground = new THREE.Mesh(
//   new THREE.PlaneGeometry(50, 50),
//   new THREE.MeshStandardMaterial({ color: 0xffffff })
// );
// ground.rotation.x = -Math.PI / 2;
// ground.position.y = -2;
// ground.receiveShadow = true;
// scene.add(ground);

// ---------------------- 模型加载 ----------------------

const loader = new GLTFLoader();
// 使用相对 main.js 的 URL，避免 GitHub Pages 子路径 404
const modelURL = new URL('../models/guitar.glb', import.meta.url).href;

loader.load(
  modelURL,
  (gltf) => {
    console.log('模型加载成功!');
    guitarModel = gltf.scene;

    // 初始姿态
    guitarModel.position.set(0, 0, 0);
    guitarModel.scale.set(0.5, 0.5, 0.5);
    guitarModel.rotation.x = -Math.PI / 4;
    guitarModel.rotation.y = -Math.PI / 4;
    guitarModel.rotation.z = -Math.PI / 4;

    // 阴影 & 材质
    guitarModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          // 防止 roughness/metalness 未定义时报错
          if ('roughness' in child.material) {
            child.material.roughness = Math.max(0.3, child.material.roughness);
          }
          if ('metalness' in child.material) {
            child.material.metalness = Math.min(0.7, child.material.metalness);
          }
        }
      }
    });

    scene.add(guitarModel);
    addGuitarControls(); // 添加控制面板
  },
  undefined,
  (error) => {
    console.error(error);
  }
);

// ---------------------- 交互控制 ----------------------

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false; // 自己实现拖拽旋转
controls.enableZoom = true;
controls.enablePan = false;

// 拖拽+惯性变量
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let movementHistory = [];
let velocity = { x: 0, y: 0, z: 0 }; // 惯性旋转速度
const minVelocity = 0.0001; // 速度阈值

// 用对象保存可调参数，供 GUI 绑定
const motionState = {
  curveIntensity: 0.5,
  historyLimit: 10,
  inertia: 0.92,
};

renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    movementHistory = [];
    velocity = { x: 0, y: 0, z: 0 };
  }
});

window.addEventListener('mousemove', (e) => {
  if (isDragging && guitarModel) {
    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;

    movementHistory.push({ x: deltaX, y: deltaY });
    if (movementHistory.length > motionState.historyLimit) {
      movementHistory.shift();
    }

    // 加权平滑
    let smoothedX = 0;
    let smoothedY = 0;
    movementHistory.forEach((move, index) => {
      const weight = (index + 1) / movementHistory.length;
      smoothedX += move.x * weight * motionState.curveIntensity;
      smoothedY += move.y * weight * motionState.curveIntensity;
    });

    // 计算速度
    velocity.x = smoothedY * 0.005;
    velocity.y = smoothedX * 0.005;
    velocity.z = (smoothedX - smoothedY) * 0.002 * motionState.curveIntensity;

    // 立即应用一帧
    guitarModel.rotation.x += velocity.x;
    guitarModel.rotation.y += velocity.y;
    guitarModel.rotation.z += velocity.z;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    isDragging = false;
  }
});

window.addEventListener('mouseleave', () => {
  isDragging = false;
});

// ---------------------- GUI ----------------------

const gui = new GUI();

function addGuitarControls() {
  if (!guitarModel) return;

  const guitarFolder = gui.addFolder('吉他模型');

  // 位置
  guitarFolder.add(guitarModel.position, 'x', -10, 10).name('X 轴');
  guitarFolder.add(guitarModel.position, 'y', -10, 10).name('Y 轴');
  guitarFolder.add(guitarModel.position, 'z', -10, 10).name('Z 轴');

  // 旋转
  guitarFolder.add(guitarModel.rotation, 'x', -Math.PI, Math.PI).name('X 旋转');
  guitarFolder.add(guitarModel.rotation, 'y', -Math.PI, Math.PI).name('Y 旋转');
  guitarFolder.add(guitarModel.rotation, 'z', -Math.PI, Math.PI).name('Z 旋转');

  // 缩放
  guitarFolder.add(guitarModel.scale, 'x', 0.1, 5).name('X 缩放').listen();
  guitarFolder.add(guitarModel.scale, 'y', 0.1, 5).name('Y 缩放').listen();
  guitarFolder.add(guitarModel.scale, 'z', 0.1, 5).name('Z 缩放').listen();

  const scaleControl = { scale: 1 };
  guitarFolder
    .add(scaleControl, 'scale', 0.1, 5)
    .name('统一缩放')
    .onChange((value) => {
      guitarModel.scale.set(value, value, value);
    });

  // 自动旋转速度控制
  const autoState = { autoRotateSpeed };
  guitarFolder
    .add(autoState, 'autoRotateSpeed', 0, 0.02, 0.001)
    .name('自动旋转速度')
    .onChange((value) => {
      autoRotateSpeed = value;
    });
}

// 运动效果
const motionFolder = gui.addFolder('运动效果');
motionFolder
  .add(motionState, 'curveIntensity', 0.1, 2, 0.1)
  .name('曲线强度')
  .onChange((v) => {
    motionState.curveIntensity = v;
  });

motionFolder
  .add(motionState, 'historyLimit', 3, 30, 1)
  .name('平滑度')
  .onChange((v) => {
    motionState.historyLimit = v;
  });

motionFolder
  .add(motionState, 'inertia', 0.85, 0.98, 0.01)
  .name('惯性大小')
  .onChange((v) => {
    motionState.inertia = v;
  });

// 光照
const lightFolder = gui.addFolder('光照');
lightFolder.add(ambientLight, 'intensity', 0, 45).name('环境光强度');

const keyLightFolder = lightFolder.addFolder('主光源');
keyLightFolder.add(keyLight, 'intensity', 0, 30).name('强度');
keyLightFolder.add(keyLight.position, 'x', -20, 20).name('X 位置');
keyLightFolder.add(keyLight.position, 'y', -20, 20).name('Y 位置');
keyLightFolder.add(keyLight.position, 'z', -20, 20).name('Z 位置');

const fillLightFolder = lightFolder.addFolder('填充光');
fillLightFolder.add(fillLight, 'intensity', 0, 115).name('强度');
fillLightFolder.add(fillLight.position, 'x', -20, 20).name('X 位置');
fillLightFolder.add(fillLight.position, 'y', -20, 20).name('Y 位置');
fillLightFolder.add(fillLight.position, 'z', -20, 20).name('Z 位置');

const rimLightFolder = lightFolder.addFolder('轮廓光');
rimLightFolder.add(rimLight, 'intensity', 0, 10).name('强度');
rimLightFolder.add(rimLight.position, 'x', -20, 20).name('X 位置');
rimLightFolder.add(rimLight.position, 'y', -20, 20).name('Y 位置');
rimLightFolder.add(rimLight.position, 'z', -20, 20).name('Z 位置');

const bottomLightFolder = lightFolder.addFolder('底部补光');
bottomLightFolder.add(bottomLight, 'intensity', 0, 111).name('强度');
bottomLightFolder.add(bottomLight, 'distance', 0, 40).name('光照距离');

// ---------------------- 动画循环 ----------------------

function animate() {
  controls.update();

  if (!isDragging && guitarModel) {
    // 惯性旋转
    if (
      Math.abs(velocity.x) > minVelocity ||
      Math.abs(velocity.y) > minVelocity ||
      Math.abs(velocity.z) > minVelocity
    ) {
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
      // 自动旋转（使用可调速度）
      guitarModel.rotation.y += autoRotateSpeed;
    }
  }

  renderer.render(scene, camera);
}

// ---------------------- 视口自适应 ----------------------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
