import * as THREE from 'three';
import GUI from 'lil-gui';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 存储导入的吉他模型
let guitarModel = null;
let autoRotateSpeed = 0.005; // 自动旋转速度

// 创建场景
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0); // 浅灰色背景

// 创建相机
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 6;
camera.position.y = 1;

// 创建渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
renderer.shadowMap.enabled = true;
// 提高阴影质量
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// 添加多个光源为吉他打光

// 环境光 - 基础照明，避免完全黑暗的区域
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

// 主光源 - 模拟主光源，从左上方照射
const keyLight = new THREE.DirectionalLight(0xffffff, 3);
keyLight.position.set(5, 10, 7.5);
keyLight.castShadow = true;
// 调整阴影属性
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 500;
scene.add(keyLight);

// 填充光 - 减轻主光源产生的阴影
const fillLight = new THREE.DirectionalLight(0xffffee, 1.5);
fillLight.position.set(-10, 5, 7.5);
fillLight.castShadow = true;
fillLight.shadow.mapSize.width = 1024;
fillLight.shadow.mapSize.height = 1024;
scene.add(fillLight);

// 轮廓光 - 从后方照射，突出物体轮廓
const rimLight = new THREE.DirectionalLight(0xeeeeff, 2);
rimLight.position.set(0, 10, -10);
rimLight.castShadow = false; // 轮廓光通常不产生强阴影
scene.add(rimLight);

// 底部补光 - 照亮底部区域
const bottomLight = new THREE.PointLight(0xffffff, 1, 20);
bottomLight.position.set(0, -3, 0);
bottomLight.castShadow = true;
scene.add(bottomLight);

// 加载吉他模型（用与 main.js 相对的 URL，避免 GitHub Pages 子路径 404）
const loader = new GLTFLoader();
const modelURL = new URL('../models/guitar.glb', import.meta.url).href;

loader.load(
  modelURL,
  (gltf) => {
    console.log('模型加载成功!');
    guitarModel = gltf.scene;

    // 设置模型初始位置、缩放和旋转
    guitarModel.position.set(0, 0, 0);
    guitarModel.scale.set(0.5, 0.5, 0.5);
    guitarModel.rotation.x = (Math.PI / 4) * -1;
    guitarModel.rotation.y = (Math.PI / 4) * -1;
    guitarModel.rotation.z = (Math.PI / 4) * -1;

    // 允许模型投射和接收阴影
    guitarModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // 为模型添加适当的材质属性，增强光照效果（先判断属性是否存在）
        if (child.material) {
          if ('roughness' in child.material && typeof child.material.roughness === 'number') {
            child.material.roughness = Math.max(0.3, child.material.roughness);
          }
          if ('metalness' in child.material && typeof child.material.metalness === 'number') {
            child.material.metalness = Math.min(0.7, child.material.metalness);
          }
        }
      }
    });

    scene.add(guitarModel);
    addGuitarControls(); // 添加控制滑块
  },
  undefined,
  (error) => {
    console.error('模型加载失败：', error);
  }
);

// 轨道控制器 - 禁用默认旋转，保留缩放
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.enableZoom = true;
controls.enablePan = false;

// 曲线与惯性运动相关变量
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let movementHistory = [];
let historyLimit = 10;    // 原来是 const，这里改为 let，GUI 才能修改
let curveIntensity = 0.5; // 仍然保留与原逻辑一致的变量

// 惯性相关变量
let velocity = { x: 0, y: 0, z: 0 }; // 旋转速度
let inertia = 0.92; // 惯性系数 (0.9-0.98之间效果较好)
let minVelocity = 0.0001; // 最小速度阈值，低于此值则停止

// 鼠标按下
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    movementHistory = [];
    velocity = { x: 0, y: 0, z: 0 }; // 重置速度
  }
});

// 鼠标移动
window.addEventListener('mousemove', (e) => {
  if (isDragging && guitarModel) {
    // 计算鼠标移动差值
    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;

    // 记录移动轨迹
    movementHistory.push({ x: deltaX, y: deltaY });
    if (movementHistory.length > historyLimit) {
      movementHistory.shift();
    }

    // 计算平滑后的移动量
    let smoothedX = 0;
    let smoothedY = 0;

    movementHistory.forEach((move, index) => {
      const weight = (index + 1) / movementHistory.length;
      smoothedX += move.x * weight * curveIntensity;
      smoothedY += move.y * weight * curveIntensity;
    });

    // 更新速度（用于后续惯性运动）
    velocity.x = smoothedY * 0.005; // X旋转速度
    velocity.y = smoothedX * 0.005; // Y旋转速度
    velocity.z = (smoothedX - smoothedY) * 0.002 * curveIntensity; // Z旋转速度

    // 应用当前帧旋转
    guitarModel.rotation.x += velocity.x;
    guitarModel.rotation.y += velocity.y;
    guitarModel.rotation.z += velocity.z;

    // 更新鼠标位置
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }
});

// 鼠标释放
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    isDragging = false;
  }
});

window.addEventListener('mouseleave', () => {
  isDragging = false;
});

// GUI控制
const gui = new GUI();

// 吉他控制
function addGuitarControls() {
  if (!guitarModel) return;

  const guitarFolder = gui.addFolder('吉他模型');

  // 位置控制
  guitarFolder.add(guitarModel.position, 'x', -10, 10).name('X 轴');
  guitarFolder.add(guitarModel.position, 'y', -10, 10).name('Y 轴');
  guitarFolder.add(guitarModel.position, 'z', -10, 10).name('Z 轴');

  // 旋转控制
  guitarFolder.add(guitarModel.rotation, 'x', -Math.PI, Math.PI).name('X 旋转');
  guitarFolder.add(guitarModel.rotation, 'y', -Math.PI, Math.PI).name('Y 旋转');
  guitarFolder.add(guitarModel.rotation, 'z', -Math.PI, Math.PI).name('Z 旋转');

  // 缩放控制
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

  // 添加自动旋转速度控制
  const autoState = { autoRotateSpeed };
  guitarFolder
    .add(autoState, 'autoRotateSpeed', 0, 0.02, 0.001)
    .name('自动旋转速度')
    .onChange((value) => {
      autoRotateSpeed = value;
    });
}

// 运动效果控制（把 number 用对象包装给 lil-gui 绑定）
const motionState = { curveIntensity, historyLimit, inertia };

const motionFolder = gui.addFolder('运动效果');
motionFolder
  .add(motionState, 'curveIntensity', 0.1, 2, 0.1)
  .name('曲线强度')
  .onChange((value) => {
    curveIntensity = value;
  });

motionFolder
  .add(motionState, 'historyLimit', 3, 30, 1)
  .name('平滑度')
  .onChange((value) => {
    historyLimit = value;
  });

motionFolder
  .add(motionState, 'inertia', 0.85, 0.98, 0.01)
  .name('惯性大小')
  .onChange((value) => {
    inertia = value;
  });

// 光照控制
const lightFolder = gui.addFolder('光照');
lightFolder.add(ambientLight, 'intensity', 0, 45).name('环境光强度');

// 主光源控制
const keyLightFolder = lightFolder.addFolder('主光源');
keyLightFolder.add(keyLight, 'intensity', 0, 30).name('强度');
keyLightFolder.add(keyLight.position, 'x', -20, 20).name('X 位置');
keyLightFolder.add(keyLight.position, 'y', -20, 20).name('Y 位置');
keyLightFolder.add(keyLight.position, 'z', -20, 20).name('Z 位置');

// 填充光控制
const fillLightFolder = lightFolder.addFolder('填充光');
fillLightFolder.add(fillLight, 'intensity', 0, 115).name('强度');
fillLightFolder.add(fillLight.position, 'x', -20, 20).name('X 位置');
fillLightFolder.add(fillLight.position, 'y', -20, 20).name('Y 位置');
fillLightFolder.add(fillLight.position, 'z', -20, 20).name('Z 位置');

// 轮廓光控制
const rimLightFolder = lightFolder.addFolder('轮廓光');
rimLightFolder.add(rimLight, 'intensity', 0, 10).name('强度');
rimLightFolder.add(rimLight.position, 'x', -20, 20).name('X 位置');
rimLightFolder.add(rimLight.position, 'y', -20, 20).name('Y 位置');
rimLightFolder.add(rimLight.position, 'z', -20, 20).name('Z 位置');

// 底部补光控制
const bottomLightFolder = lightFolder.addFolder('底部补光');
bottomLightFolder.add(bottomLight, 'intensity', 0, 111).name('强度');
bottomLightFolder.add(bottomLight, 'distance', 0, 40).name('光照距离');

// 动画循环 - 处理惯性运动和自动旋转
function animate() {
  controls.update();

  // 当不拖动且有速度时，应用惯性运动
  if (!isDragging && guitarModel) {
    if (
      Math.abs(velocity.x) > minVelocity ||
      Math.abs(velocity.y) > minVelocity ||
      Math.abs(velocity.z) > minVelocity
    ) {
      // 应用当前速度
      guitarModel.rotation.x += velocity.x;
      guitarModel.rotation.y += velocity.y;
      guitarModel.rotation.z += velocity.z;

      // 速度衰减（惯性）
      velocity.x *= inertia;
      velocity.y *= inertia;
      velocity.z *= inertia;

      // 当速度低于阈值时停止
      if (Math.abs(velocity.x) < minVelocity) velocity.x = 0;
      if (Math.abs(velocity.y) < minVelocity) velocity.y = 0;
      if (Math.abs(velocity.z) < minVelocity) velocity.z = 0;
    } else {
      // 当没有惯性运动时，应用自动旋转（使用 GUI 设置的速度）
      guitarModel.rotation.y += autoRotateSpeed;
    }
  }

  renderer.render(scene, camera);
}

// 窗口大小调整
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
