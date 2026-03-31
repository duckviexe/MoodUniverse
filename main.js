import * as THREE from 'three';

// --- Scene Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.02);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// --- Galaxy Generation ---
let geometry = null;
let material = null;
let points = null;

const parameters = {
  count: 50000,
  size: 0.02,
  radius: 8,
  branches: 5,
  spin: 1,
  randomness: 0.5,
  randomnessPower: 3,
  
  // Dynamic State targets
  targetSpeed: 0.001,
  currentSpeed: 0.001,
  targetSize: 0.02,
  
  colorTransitionAlpha: 1.0,
  currentColorInside: new THREE.Color('#ff6030'),
  targetColorInside: new THREE.Color('#ff6030'),
  currentColorOutside: new THREE.Color('#1b3984'),
  targetColorOutside: new THREE.Color('#1b3984')
};

let emotionMaps = {
  calm: { insideColor: '#00ffff', outsideColor: '#002255', speed: 0.0005, size: 0.015 },
  happy: { insideColor: '#ffcc00', outsideColor: '#ff5500', speed: 0.002, size: 0.025 },
  energetic: { insideColor: '#ff3300', outsideColor: '#ff00aa', speed: 0.005, size: 0.03 },
  sad: { insideColor: '#4444aa', outsideColor: '#111122', speed: 0.0002, size: 0.01 },
  angry: { insideColor: '#ff0000', outsideColor: '#330000', speed: 0.008, size: 0.03 },
  exhausted: { insideColor: '#5f4b8b', outsideColor: '#2d2243', speed: 0.0001, size: 0.015 },
  unmotivated: { insideColor: '#556b2f', outsideColor: '#2b3618', speed: 0.0003, size: 0.012 },
  nostalgic: { insideColor: '#8b4513', outsideColor: '#4d2600', speed: 0.001, size: 0.02 }
};

const customEmotions = JSON.parse(localStorage.getItem('sentientCustomEmotions') || '{}');
emotionMaps = { ...emotionMaps, ...customEmotions };

const createGalaxyMesh = (cIn, cOut) => {
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(parameters.count * 3);
  const colors = new Float32Array(parameters.count * 3);
  const colorIn = new THREE.Color(cIn);
  const colorOut = new THREE.Color(cOut);

  for (let i = 0; i < parameters.count; i++) {
    const i3 = i * 3;
    const radius = Math.random() * parameters.radius;
    const spinAngle = radius * parameters.spin;
    const branchAngle = ((i % parameters.branches) / parameters.branches) * Math.PI * 2;

    const randomX = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius;
    const randomY = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius;
    const randomZ = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius;

    positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
    positions[i3 + 1] = randomY;
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

    const mixedColor = colorIn.clone();
    mixedColor.lerp(colorOut, radius / parameters.radius);

    colors[i3] = mixedColor.r;
    colors[i3 + 1] = mixedColor.g;
    colors[i3 + 2] = mixedColor.b;
  }

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: parameters.size,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    transparent: true,
    opacity: 0.8
  });

  const mesh = new THREE.Points(geom, mat);
  mesh.rotation.x = 0.2;
  mesh.rotation.z = -0.1;
  return { geom, mat, mesh };
};

let bgGalaxies = [];
let isFirstInteraction = true;
let currentCameraLook = new THREE.Vector3(0, 0, 0);

const generateInitialGalaxies = () => {
  const keys = Object.keys(emotionMaps).slice(0, 8);
  keys.forEach((key, index) => {
    const angle = (index / keys.length) * Math.PI * 2;
    const distance = 40;
    const px = Math.cos(angle) * distance;
    const pz = Math.sin(angle) * distance;
    const py = (Math.random() - 0.5) * 15;
    
    const map = emotionMaps[key];
    const result = createGalaxyMesh(map.insideColor, map.outsideColor);
    result.mesh.position.set(px, py, pz);
    scene.add(result.mesh);
    bgGalaxies.push({ key, mesh: result.mesh, geom: result.geom, mat: result.mat });
  });
  
  camera.position.set(0, 30, 80);
  camera.lookAt(0, 0, 0);
  currentCameraLook.set(0, 0, 0);
};

generateInitialGalaxies();

// --- Resize Handler ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// --- UI & Tracking Logic ---
const emotionContainer = document.getElementById('emotion-buttons-container');

const renderCustomButtons = () => {
  document.querySelectorAll('.btn.custom-added').forEach(b => b.remove());
  
  const addBtn = document.getElementById('btn-add-custom');
  Object.keys(customEmotions).forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'btn custom-added';
    btn.dataset.emotion = key;
    btn.textContent = key.charAt(0).toUpperCase() + key.slice(1);
    
    const c = emotionMaps[key].insideColor;
    btn.addEventListener('mouseenter', () => {
      btn.style.boxShadow = `0 0 20px ${c}80`;
      btn.style.borderColor = c;
    });
    btn.addEventListener('mouseleave', () => {
      if (!btn.classList.contains('active')) {
        btn.style.boxShadow = '';
        btn.style.borderColor = '';
      }
    });

    emotionContainer.insertBefore(btn, addBtn);
  });
};
renderCustomButtons();

let activeAnimations = [];
let activeEmotion = 'unknown';

let trackingLog = JSON.parse(localStorage.getItem('sentientTracking') || '[]');

const trackEmotion = (emotionKey) => {
  trackingLog.push({ emotion: emotionKey, time: Date.now() });
  localStorage.setItem('sentientTracking', JSON.stringify(trackingLog));
};

const setEmotion = (emotionKey) => {
  activeEmotion = emotionKey;
  const settings = emotionMaps[emotionKey];
  if (!settings) return;

  document.querySelectorAll('.emotion-buttons .btn').forEach(b => {
    b.classList.remove('active');
    if (b.classList.contains('custom-added')) {
      b.style.boxShadow = '';
      b.style.borderColor = '';
    }
  });
  
  const targetBtn = document.querySelector(`.btn[data-emotion="${emotionKey}"]`);
  if (targetBtn) {
    targetBtn.classList.add('active');
    if (targetBtn.classList.contains('custom-added')) {
      const c = settings.insideColor;
      targetBtn.style.boxShadow = `0 0 20px ${c}80`;
      targetBtn.style.borderColor = c;
    }
  }

  parameters.targetSpeed = settings.speed;
  parameters.targetColorInside.set(settings.insideColor);
  parameters.targetColorOutside.set(settings.outsideColor);
  parameters.colorTransitionAlpha = 0; 
  
  if (isFirstInteraction) {
    isFirstInteraction = false;
    const targetG = bgGalaxies.find(g => g.key === emotionKey) || bgGalaxies[0];
    
    bgGalaxies.forEach(g => {
      if (g !== targetG) {
        g.geom.dispose();
        g.mat.dispose();
        scene.remove(g.mesh);
      }
    });
    
    points = targetG.mesh;
    geometry = targetG.geom;
    material = targetG.mat;
    
    parameters.targetCameraPos = targetG.mesh.position.clone().add(new THREE.Vector3(0, 3, 10));
    parameters.targetCameraLook = targetG.mesh.position.clone();
    
    parameters.currentColorInside.set(emotionMaps[emotionKey].insideColor);
    parameters.currentColorOutside.set(emotionMaps[emotionKey].outsideColor);
    parameters.currentSpeed = parameters.targetSpeed;
  }

  trackEmotion(emotionKey);
};

// Event Delegation for Emotion Buttons
emotionContainer.addEventListener('click', (e) => {
  const emotion = e.target.dataset.emotion;
  if (emotion) {
    setEmotion(emotion);
  }
});

emotionContainer.addEventListener('dblclick', (e) => {
  const emotion = e.target.dataset.emotion;
  if (emotion) {
    if (customEmotions[emotion]) {
      delete customEmotions[emotion];
      delete emotionMaps[emotion];
      localStorage.setItem('sentientCustomEmotions', JSON.stringify(customEmotions));
    }
    e.target.remove();
    if (e.target.classList.contains('active')) {
      setEmotion('calm');
    }
  }
});

// Initial state
// (Galaxy spawns on first option click)
// --- Welcome Screen Logic ---
const welcomeBtn = document.getElementById('start-btn');
const welcomeScreen = document.getElementById('welcome-screen');
if (welcomeBtn && welcomeScreen) {
  welcomeBtn.addEventListener('click', () => {
    welcomeScreen.classList.add('hidden');
  });
}

// --- Modals and Charts Logic ---

// --- Full-screen Logic ---
const btnFullscreen = document.getElementById('btn-fullscreen');
if (btnFullscreen) {
  btnFullscreen.addEventListener('click', () => {
    const uiLayer = document.querySelector('.ui-layer');
    const sideMenu = document.querySelector('.side-menu');
    
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      uiLayer.style.display = 'none';
      sideMenu.style.display = 'none';
      btnFullscreen.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3H5m18-3v3h-3m0 18v-3h3M3 21v-3h3"></path></svg>';
    } else {
      document.exitFullscreen();
    }
  });
  
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      document.querySelector('.ui-layer').style.display = 'flex';
      document.querySelector('.side-menu').style.display = 'flex';
      btnFullscreen.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
    }
  });
}

const chartsModal = document.getElementById('charts-modal');
const addEmotionModal = document.getElementById('add-emotion-modal');
let chartPeriod = 'week'; // 'week' or 'month'

document.getElementById('btn-charts').addEventListener('click', () => {
  chartsModal.classList.remove('hidden');
  renderChart();
});
document.getElementById('close-charts').addEventListener('click', () => chartsModal.classList.add('hidden'));

document.getElementById('btn-add-custom').addEventListener('click', () => {
  addEmotionModal.classList.remove('hidden');
});
document.getElementById('close-add-emotion').addEventListener('click', () => addEmotionModal.classList.add('hidden'));

const renderChart = () => {
  const container = document.getElementById('chart-container');
  container.innerHTML = '';
  
  const now = Date.now();
  const cutoff = now - (chartPeriod === 'week' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000);
  
  const counts = {};
  let maxCount = 0;
  
  trackingLog.forEach(entry => {
    if (entry.time >= cutoff) {
      counts[entry.emotion] = (counts[entry.emotion] || 0) + 1;
      if (counts[entry.emotion] > maxCount) maxCount = counts[entry.emotion];
    }
  });

  if (maxCount === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary); width: 100%; text-align:center; align-self:center;">No data for this period.</p>';
    return;
  }

  Object.keys(counts).forEach(emotion => {
    const wrapper = document.createElement('div');
    wrapper.className = 'bar-wrapper';
    
    // Bar
    const bar = document.createElement('div');
    bar.className = 'bar';
    const heightPercent = Math.max((counts[emotion] / maxCount) * 100, 5);
    
    const baseColor = emotionMaps[emotion] ? emotionMaps[emotion].insideColor : '#ffffff';
    bar.style.background = `linear-gradient(to top, transparent, ${baseColor})`;
    
    setTimeout(() => {
      bar.style.height = `${heightPercent}%`;
    }, 50);

    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = emotion;

    wrapper.appendChild(bar);
    wrapper.appendChild(label);
    container.appendChild(wrapper);
  });
};

document.getElementById('toggle-chart-time').addEventListener('click', (e) => {
  chartPeriod = chartPeriod === 'week' ? 'month' : 'week';
  e.target.textContent = `Period: Last ${chartPeriod === 'week' ? '7' : '30'} Days`;
  renderChart();
});

// --- Custom Emotion Logic ---
document.getElementById('submit-custom-emotion').addEventListener('click', () => {
  const nameInput = document.getElementById('custom-emotion-name');
  const descInput = document.getElementById('custom-emotion-desc');
  const errContainer = document.getElementById('custom-emotion-error');
  
  const rawName = nameInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (!rawName) {
    errContainer.textContent = "Please enter a valid single-word name.";
    return;
  }
  
  if (emotionMaps[rawName]) {
    errContainer.textContent = "This emotion already exists.";
    return;
  }
  
  const hInside = Math.random();
  const c = new THREE.Color();
  c.setHSL(hInside, 0.8, 0.5);
  const inside = '#' + c.getHexString();
  c.setHSL(hInside, 0.9, 0.2);
  const outside = '#' + c.getHexString();
  
  const newMap = {
    insideColor: inside,
    outsideColor: outside,
    speed: 0.001 + Math.random() * 0.004,
    size: 0.01 + Math.random() * 0.015,
    desc: descInput.value.trim()
  };
  
  customEmotions[rawName] = newMap;
  emotionMaps[rawName] = newMap;
  
  localStorage.setItem('sentientCustomEmotions', JSON.stringify(customEmotions));
  
  renderCustomButtons();
  
  nameInput.value = '';
  descInput.value = '';
  errContainer.textContent = '';
  addEmotionModal.classList.add('hidden');
  
  setEmotion(rawName);
});

// --- Active Animations & Notes Logic ---
let notesData = JSON.parse(localStorage.getItem('sentientNotes') || '[]');
let foldersData = JSON.parse(localStorage.getItem('sentientFolders') || '[]');
let currentFolderId = null;

const saveNotes = () => localStorage.setItem('sentientNotes', JSON.stringify(notesData));
const saveFolders = () => localStorage.setItem('sentientFolders', JSON.stringify(foldersData));
const getEmotionColor = (key) => emotionMaps[key] ? emotionMaps[key].insideColor : '#ffffff';

const btnWrite = document.getElementById('btn-write');
if (btnWrite) {
  btnWrite.addEventListener('click', () => document.getElementById('write-modal').classList.remove('hidden'));
  document.getElementById('close-write').addEventListener('click', () => document.getElementById('write-modal').classList.add('hidden'));
}

const submitNoteBtn = document.getElementById('submit-note');
if (submitNoteBtn) {
  submitNoteBtn.addEventListener('click', () => {
    const titleInput = document.getElementById('note-title');
    const bodyInput = document.getElementById('note-body');
    if (!bodyInput.value.trim()) return;
    
    const newNote = {
      id: 'note_' + Date.now(),
      title: titleInput.value.trim() || 'unknown',
      body: bodyInput.value.trim(),
      emotion: activeEmotion,
      folderId: currentFolderId,
      timestamp: new Date().toLocaleString()
    };
    notesData.unshift(newNote);
    saveNotes();
    
    titleInput.value = '';
    bodyInput.value = '';
    document.getElementById('write-modal').classList.add('hidden');
    
    animateShootingStar(newNote.emotion);
    if (!document.getElementById('notes-modal').classList.contains('hidden')) renderNotes();
  });
}

const animateShootingStar = (emotionKey) => {
  const geom = new THREE.SphereGeometry(0.3, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: getEmotionColor(emotionKey), transparent: true, opacity: 1 });
  const star = new THREE.Mesh(geom, mat);
  star.position.set(20, -15, 40); 
  scene.add(star);
  
  activeAnimations.push({
    mesh: star, progress: 0, speed: 0.005 + Math.random() * 0.005,
    startX: star.position.x, startY: star.position.y, startZ: star.position.z,
    targetX: (Math.random() - 0.5) * 10, targetY: (Math.random() - 0.5) * 10, targetZ: (Math.random() - 0.5) * 10
  });
};

const btnNotes = document.getElementById('btn-notes');
if (btnNotes) {
  btnNotes.addEventListener('click', () => {
    document.getElementById('notes-modal').classList.remove('hidden');
    renderFolders();
    renderNotes();
  });
  document.getElementById('close-notes').addEventListener('click', () => document.getElementById('notes-modal').classList.add('hidden'));
}

const btnNewFolder = document.getElementById('btn-new-folder');
if (btnNewFolder) {
  btnNewFolder.addEventListener('click', () => {
    const name = prompt('Folder name:');
    if (name && name.trim()) {
      foldersData.push({ id: 'folder_' + Date.now(), name: name.trim() });
      saveFolders();
      renderFolders();
    }
  });
}

const handleDrop = (e, targetFolderId) => {
  e.preventDefault();
  const noteId = e.dataTransfer.getData('text/plain');
  const note = notesData.find(n => n.id === noteId);
  if (note && note.folderId !== targetFolderId) {
    note.folderId = targetFolderId;
    saveNotes();
    renderNotes();
  }
};

const renderFolders = () => {
  const fc = document.getElementById('folders-container');
  if (!fc) return;
  fc.innerHTML = '';
  
  const createFolderEl = (id, text) => {
    const el = document.createElement('div');
    el.className = 'folder-item' + (currentFolderId === id ? ' active' : '');
    el.textContent = text;
    el.addEventListener('click', () => { currentFolderId = id; renderFolders(); renderNotes(); });
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => { el.classList.remove('drag-over'); handleDrop(e, id); });
    return el;
  };

  fc.appendChild(createFolderEl(null, '📁 All Notes'));
  foldersData.forEach(f => fc.appendChild(createFolderEl(f.id, '📁 ' + f.name)));
};

const renderNotes = () => {
  const nc = document.getElementById('notes-list-container');
  if (!nc) return;
  nc.innerHTML = '';
  const visible = notesData.filter(n => currentFolderId === null || n.folderId === currentFolderId);
  
  if (visible.length === 0) {
    nc.innerHTML = '<div style="color:var(--text-secondary);text-align:center;padding:20px;">No notes found here.</div>';
    return;
  }
  
  visible.forEach(n => {
    const el = document.createElement('div');
    el.className = 'note-item';
    el.draggable = true;
    el.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', n.id));
    el.innerHTML = `
      <div class="note-header">
        <div>
          <h3 class="note-title">${n.title}</h3>
          <span class="note-emotion-label" style="border-color:${getEmotionColor(n.emotion)}; color:${getEmotionColor(n.emotion)}">${n.emotion}</span>
        </div>
        <div class="note-meta">${n.timestamp}</div>
      </div>
      <div class="note-body">${n.body}</div>
    `;
    nc.appendChild(el);
  });
};

// --- Animation Loop ---
const clock = new THREE.Clock();

const tick = () => {
  // const elapsedTime = clock.getElapsedTime();

  // Interpolate Speed
  parameters.currentSpeed += (parameters.targetSpeed - parameters.currentSpeed) * 0.02;
  
  if (isFirstInteraction) {
    const elapsed = clock.getElapsedTime();
    bgGalaxies.forEach(g => {
      g.mesh.rotation.y -= parameters.currentSpeed;
      g.mesh.rotation.x += 0.0005;
    });
    camera.position.x = Math.sin(elapsed * 0.1) * 80;
    camera.position.z = Math.cos(elapsed * 0.1) * 80;
    camera.lookAt(0, 0, 0);
  } else if (points) {
    points.rotation.y -= parameters.currentSpeed;
  }

  if (!isFirstInteraction && parameters.targetCameraPos) {
    camera.position.lerp(parameters.targetCameraPos, 0.03);
    currentCameraLook.lerp(parameters.targetCameraLook, 0.03);
    camera.lookAt(currentCameraLook);
  }

  // Interpolate Colors
  if (parameters.colorTransitionAlpha < 1.0) {
    parameters.colorTransitionAlpha += 0.01;
    if (parameters.colorTransitionAlpha > 1.0) parameters.colorTransitionAlpha = 1.0;

    parameters.currentColorInside.lerp(parameters.targetColorInside, 0.05);
    parameters.currentColorOutside.lerp(parameters.targetColorOutside, 0.05);

    // Update colors in buffer
    if (geometry && geometry.attributes.color) {
      const colors = geometry.attributes.color.array;
      const positions = geometry.attributes.position.array;
      
      for (let i = 0; i < parameters.count; i++) {
        const i3 = i * 3;
        
        const x = positions[i3];
        const y = positions[i3+1];
        const z = positions[i3+2];
        const radius = Math.sqrt(x*x + y*y + z*z);

        const mixedColor = parameters.currentColorInside.clone();
        mixedColor.lerp(parameters.currentColorOutside, radius / parameters.radius);

        colors[i3] = mixedColor.r;
        colors[i3 + 1] = mixedColor.g;
        colors[i3 + 2] = mixedColor.b;
      }
      geometry.attributes.color.needsUpdate = true;
    }
  }
  for (let i = activeAnimations.length - 1; i >= 0; i--) {
    const anim = activeAnimations[i];
    anim.progress += anim.speed;
    if (anim.progress >= 1) {
      scene.remove(anim.mesh);
      anim.mesh.geometry.dispose();
      anim.mesh.material.dispose();
      activeAnimations.splice(i, 1);
    } else {
      const ease = anim.progress < 0.5 ? 2 * anim.progress * anim.progress : 1 - Math.pow(-2 * anim.progress + 2, 2) / 2;
      anim.mesh.position.x = anim.startX + (anim.targetX - anim.startX) * ease;
      anim.mesh.position.y = anim.startY + (anim.targetY - anim.startY) * ease;
      anim.mesh.position.z = anim.startZ + (anim.targetZ - anim.startZ) * ease;
      anim.mesh.scale.setScalar(1 - ease);
    }
  }

  // Render
  renderer.render(scene, camera);

  // Request next frame
  window.requestAnimationFrame(tick);
};

tick();
