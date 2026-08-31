// ==========================================
// 1. 상태 및 상수 정의
// ==========================================
const DEFAULT_MENUS = [
  '김치찌개', '제육볶음', '돈까스', '초밥',
  '짜장면', '햄버거', '쌀국수', '샌드위치',
  '부대찌개', '파스타'
];

const WHEEL_COLORS = [
  'hsl(280, 75%, 60%)',  // 퍼플
  'hsl(330, 80%, 60%)',  // 핑크
  'hsl(15, 85%, 60%)',   // 오렌지
  'hsl(45, 90%, 55%)',   // 옐로우
  'hsl(165, 75%, 50%)',  // 민트
  'hsl(195, 80%, 55%)',  // 스카이
  'hsl(220, 75%, 60%)',  // 블루
  'hsl(260, 70%, 65%)',  // 연보라
  'hsl(345, 80%, 62%)',  // 로즈
  'hsl(140, 65%, 50%)'   // 그린
];

let menus = [];
let isSpinning = false;
let currentRotation = 0;
let spinVelocity = 0;
let spinDeceleration = 0.985;
let confettiActive = false;
let confettiParticles = [];
let audioCtx = null;

// DOM 엘리먼트 전역 레퍼런스 (init 단계에서 안전하게 할당)
let rCanvas, rCtx, cCanvas, cCtx;
let spinBtnCenter, spinBtn, menuForm, menuInput, menuListContainer, menuCountBadge, resetBtn, clearBtn;
let resultModal, resultMenuName, modalRetryBtn, modalCloseBtn;

// ==========================================
// 2. Storage Helper (보안 예외 차단용)
// ==========================================
function safeLocalStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('LocalStorage access is restricted by browser security policies. Falling back to memory storage.', e);
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('Failed to write to LocalStorage due to security policies.', e);
  }
}

// ==========================================
// 3. Audio Synth (Web Audio API)
// ==========================================
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playTickSound() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);

    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  } catch (e) {
    console.warn('Audio Context Error:', e);
  }
}

function playWinSound() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const notes = [
    { note: 523.25, time: 0 },
    { note: 659.25, time: 0.12 },
    { note: 783.99, time: 0.24 },
    { note: 1046.50, time: 0.36 }
  ];
  
  notes.forEach((item, index) => {
    try {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(item.note, now + item.time);
      
      const duration = index === notes.length - 1 ? 0.6 : 0.15;
      gainNode.gain.setValueAtTime(0.12, now + item.time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + item.time + duration);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start(now + item.time);
      osc.stop(now + item.time + duration);
    } catch (e) {
      console.warn('Audio Win Sound Error:', e);
    }
  });
}

// ==========================================
// 4. Confetti (꽃가루) 애니메이션
// ==========================================
function resizeConfettiCanvas() {
  if (cCanvas) {
    cCanvas.width = window.innerWidth;
    cCanvas.height = window.innerHeight;
  }
}

class ConfettiParticle {
  constructor() {
    this.x = Math.random() * (cCanvas ? cCanvas.width : 500);
    this.y = Math.random() * -(cCanvas ? cCanvas.height : 500) - 20;
    this.size = Math.random() * 8 + 6;
    this.color = WHEEL_COLORS[Math.floor(Math.random() * WHEEL_COLORS.length)];
    this.speedX = Math.random() * 4 - 2;
    this.speedY = Math.random() * 5 + 4;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 10 - 5;
    this.opacity = 1;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.rotation += this.rotationSpeed;
    if (cCanvas && this.y > cCanvas.height * 0.7) {
      this.opacity -= 0.02;
    }
  }

  draw() {
    if (!cCtx) return;
    cCtx.save();
    cCtx.translate(this.x, this.y);
    cCtx.rotate((this.rotation * Math.PI) / 180);
    cCtx.globalAlpha = Math.max(0, this.opacity);
    cCtx.fillStyle = this.color;
    cCtx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    cCtx.restore();
  }
}

function startConfetti() {
  confettiActive = true;
  confettiParticles = [];
  for (let i = 0; i < 120; i++) {
    confettiParticles.push(new ConfettiParticle());
  }
  animateConfetti();
}

function animateConfetti() {
  if (!confettiActive || !cCtx || !cCanvas) return;
  cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
  
  confettiParticles.forEach((p, index) => {
    p.update();
    p.draw();
    if (p.y > cCanvas.height || p.opacity <= 0) {
      confettiParticles[index] = new ConfettiParticle();
    }
  });
  
  requestAnimationFrame(animateConfetti);
}

function stopConfetti() {
  confettiActive = false;
  if (cCtx && cCanvas) {
    cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
  }
}

// ==========================================
// 5. 룰렛 렌더링 및 물리엔진
// ==========================================
function drawRoulette() {
  if (!rCanvas || !rCtx) return;
  
  const size = rCanvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const radius = cx - 15;
  
  rCtx.clearRect(0, 0, size, size);
  
  const numSlices = menus.length;
  
  if (numSlices === 0) {
    rCtx.save();
    rCtx.beginPath();
    rCtx.arc(cx, cy, radius, 0, 2 * Math.PI);
    rCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    rCtx.fill();
    rCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    rCtx.lineWidth = 4;
    rCtx.stroke();
    
    rCtx.fillStyle = '#9d94b8';
    rCtx.font = 'bold 16px var(--font-family)';
    rCtx.textAlign = 'center';
    rCtx.fillText('메뉴를 추가해 주세요!', cx, cy + 5);
    rCtx.restore();
    return;
  }
  
  const sliceAngle = (2 * Math.PI) / numSlices;
  
  rCtx.save();
  rCtx.translate(cx, cy);
  rCtx.rotate(currentRotation);
  rCtx.translate(-cx, -cy);
  
  for (let i = 0; i < numSlices; i++) {
    const startAngle = i * sliceAngle;
    const endAngle = startAngle + sliceAngle;
    
    rCtx.beginPath();
    rCtx.moveTo(cx, cy);
    rCtx.arc(cx, cy, radius, startAngle, endAngle);
    rCtx.closePath();
    rCtx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
    rCtx.fill();
    
    rCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    rCtx.lineWidth = 2;
    rCtx.stroke();
  }

  for (let i = 0; i < numSlices; i++) {
    const startAngle = i * sliceAngle;
    const textAngle = startAngle + sliceAngle / 2;
    
    rCtx.save();
    rCtx.translate(cx, cy);
    rCtx.rotate(textAngle);
    
    rCtx.textAlign = 'right';
    rCtx.textBaseline = 'middle';
    
    const menuText = menus[i];
    let fontSize = 16;
    if (numSlices > 12) fontSize = 12;
    else if (numSlices > 8) fontSize = 14;
    
    rCtx.font = `900 ${fontSize}px var(--font-family)`;
    rCtx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    rCtx.shadowBlur = 4;
    rCtx.shadowOffsetX = 1;
    rCtx.shadowOffsetY = 1;
    rCtx.fillStyle = '#ffffff';
    
    rCtx.fillText(menuText, radius - 30, 0);
    rCtx.restore();
  }
  
  rCtx.restore();
  
  rCtx.save();
  rCtx.beginPath();
  rCtx.arc(cx, cy, radius, 0, 2 * Math.PI);
  
  const strokeGrad = rCtx.createLinearGradient(0, 0, size, size);
  strokeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  strokeGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
  strokeGrad.addColorStop(1, 'rgba(138, 43, 226, 0.3)');
  
  rCtx.strokeStyle = strokeGrad;
  rCtx.lineWidth = 10;
  rCtx.stroke();
  rCtx.restore();
}

let lastTickAngle = -1;
function spinLoop() {
  if (!isSpinning) return;
  
  currentRotation = (currentRotation + spinVelocity) % (2 * Math.PI);
  spinVelocity *= spinDeceleration;
  
  const numSlices = menus.length;
  const sliceAngle = (2 * Math.PI) / numSlices;
  
  let targetAngle = (1.5 * Math.PI - currentRotation) % (2 * Math.PI);
  if (targetAngle < 0) {
    targetAngle += 2 * Math.PI;
  }
  const currentTickSliceIndex = Math.floor(targetAngle / sliceAngle) % numSlices;
  
  if (currentTickSliceIndex !== lastTickAngle) {
    if (lastTickAngle !== -1) {
      playTickSound();
    }
    lastTickAngle = currentTickSliceIndex;
  }
  
  drawRoulette();
  
  if (spinVelocity < 0.0015) {
    isSpinning = false;
    spinVelocity = 0;
    showWinner(currentTickSliceIndex);
  } else {
    requestAnimationFrame(spinLoop);
  }
}

function startSpin() {
  if (isSpinning) return;
  if (menus.length < 2) {
    alert('룰렛을 돌리려면 메뉴가 최소 2개 이상 필요합니다!');
    return;
  }
  
  initAudio();
  stopConfetti();
  
  isSpinning = true;
  if (rCanvas) rCanvas.classList.add('spin-active');
  
  spinVelocity = Math.random() * 0.2 + 0.3;
  setControlsEnabled(false);
  spinLoop();
}

function setControlsEnabled(enabled) {
  if (spinBtn) spinBtn.disabled = !enabled;
  if (spinBtnCenter) spinBtnCenter.disabled = !enabled;
  if (resetBtn) resetBtn.disabled = !enabled;
  if (clearBtn) clearBtn.disabled = !enabled;
  
  if (menuForm) {
    const formElements = menuForm.elements;
    for (let i = 0; i < formElements.length; i++) {
      formElements[i].disabled = !enabled;
    }
  }
}

// ==========================================
// 6. 결과 처리 및 모달 제어
// ==========================================
function showWinner(winningIndex) {
  if (rCanvas) rCanvas.classList.remove('spin-active');
  
  playWinSound();
  
  const winnerText = menus[winningIndex];
  if (resultMenuName) resultMenuName.textContent = winnerText;
  
  startConfetti();
  
  setTimeout(() => {
    if (resultModal) resultModal.classList.remove('hidden');
  }, 350);
}

function closeModal() {
  if (resultModal) resultModal.classList.add('hidden');
  stopConfetti();
  setControlsEnabled(true);
}

// ==========================================
// 7. 메뉴 데이터 관리 로직
// ==========================================
function loadMenus() {
  const stored = safeLocalStorageGet('lunch-roulette-menus');
  if (stored) {
    try {
      menus = JSON.parse(stored);
      if (!Array.isArray(menus) || menus.length === 0) {
        menus = [...DEFAULT_MENUS];
        saveMenus();
      }
    } catch (e) {
      menus = [...DEFAULT_MENUS];
    }
  } else {
    menus = [...DEFAULT_MENUS];
    saveMenus();
  }
  updateUI();
}

function saveMenus() {
  safeLocalStorageSet('lunch-roulette-menus', JSON.stringify(menus));
}

function updateUI() {
  if (menuCountBadge) {
    menuCountBadge.textContent = menus.length;
  }
  
  if (menuListContainer) {
    menuListContainer.innerHTML = '';
    menus.forEach((menu, index) => {
      const chip = document.createElement('div');
      chip.className = 'menu-chip';
      
      const span = document.createElement('span');
      span.textContent = menu;
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove-menu';
      removeBtn.setAttribute('aria-label', `${menu} 삭제`);
      removeBtn.innerHTML = '<i data-lucide="x"></i>';
      removeBtn.addEventListener('click', () => removeMenu(index));
      
      chip.appendChild(span);
      chip.appendChild(removeBtn);
      menuListContainer.appendChild(chip);
    });
  }
  
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    try {
      lucide.createIcons();
    } catch (e) {
      console.warn('Lucide icons failed to render:', e);
    }
  }
  
  drawRoulette();
}

function addMenu(name) {
  const cleanName = name.trim();
  if (!cleanName) return;
  
  if (menus.includes(cleanName)) {
    alert('이미 추가된 메뉴입니다!');
    return;
  }
  
  menus.push(cleanName);
  saveMenus();
  updateUI();
}

function removeMenu(index) {
  if (isSpinning) return;
  menus.splice(index, 1);
  saveMenus();
  updateUI();
}

function resetToDefault() {
  if (confirm('메뉴 리스트를 기본 메뉴 10개로 초기화하시겠습니까?')) {
    menus = [...DEFAULT_MENUS];
    saveMenus();
    updateUI();
  }
}

function clearAllMenus() {
  if (confirm('정말로 모든 메뉴를 삭제하시겠습니까?')) {
    menus = [];
    saveMenus();
    updateUI();
  }
}

// ==========================================
// 8. 이벤트 바인딩 및 초기화
// ==========================================
function init() {
  // DOM 요소 안전 바인딩 (HTML 로드 완료 후 매핑)
  rCanvas = document.getElementById('roulette-canvas');
  rCtx = rCanvas ? rCanvas.getContext('2d') : null;
  cCanvas = document.getElementById('confetti-canvas');
  cCtx = cCanvas ? cCanvas.getContext('2d') : null;

  spinBtnCenter = document.getElementById('spin-button-center');
  spinBtn = document.getElementById('spin-button');
  menuForm = document.getElementById('menu-form');
  menuInput = document.getElementById('menu-input');
  menuListContainer = document.getElementById('menu-list');
  menuCountBadge = document.getElementById('current-count');
  resetBtn = document.getElementById('reset-button');
  clearBtn = document.getElementById('clear-button');

  resultModal = document.getElementById('result-modal');
  resultMenuName = document.getElementById('result-menu-name');
  modalRetryBtn = document.getElementById('modal-retry-button');
  modalCloseBtn = document.getElementById('modal-close-button');

  // 꽃가루 캔버스 리사이즈
  window.addEventListener('resize', resizeConfettiCanvas);
  resizeConfettiCanvas();

  // 이벤트 리스너 안전 바인딩
  if (spinBtn) spinBtn.addEventListener('click', startSpin);
  if (spinBtnCenter) spinBtnCenter.addEventListener('click', startSpin);
  
  if (menuForm) {
    menuForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (menuInput) {
        const val = menuInput.value;
        addMenu(val);
        menuInput.value = '';
        menuInput.focus();
      }
    });
  }
  
  if (resetBtn) resetBtn.addEventListener('click', resetToDefault);
  if (clearBtn) clearBtn.addEventListener('click', clearAllMenus);
  
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modalRetryBtn) {
    modalRetryBtn.addEventListener('click', () => {
      closeModal();
      setTimeout(startSpin, 400);
    });
  }
  
  window.addEventListener('keydown', (e) => {
    if (menuInput && document.activeElement === menuInput) return;
    
    if (e.code === 'Space') {
      e.preventDefault();
      if (!isSpinning) {
        if (resultModal && !resultModal.classList.contains('hidden')) {
          closeModal();
        } else {
          startSpin();
        }
      }
    }
  });

  // 데이터 로드
  loadMenus();
}

// readyState를 확인하여 안전하게 초기화 실행 (Vite 모듈 환경 호환성 확보)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
