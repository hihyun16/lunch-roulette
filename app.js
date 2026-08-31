// ==========================================
// 1. 상태 및 상수 정의
// ==========================================
const DEFAULT_MENUS = [
  '김치찌개', '제육볶음', '돈까스', '초밥',
  '짜장면', '햄버거', '쌀국수', '샌드위치',
  '부대찌개', '파스타'
];

// 예쁜 룰렛 조각 색상 테마 (HSL을 활용해 조화롭고 밝은 느낌 연출)
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
let currentRotation = 0; // 라디안 기준
let spinVelocity = 0;
let spinDeceleration = 0.985; // 자연스러운 감속 비율
let confettiActive = false;
let confettiParticles = [];

// Audio Context 객체 (사용자 제스처 후 지연 생성)
let audioCtx = null;

// ==========================================
// 2. DOM 엘리먼트 참조
// ==========================================
const rCanvas = document.getElementById('roulette-canvas');
const rCtx = rCanvas.getContext('2d');
const cCanvas = document.getElementById('confetti-canvas');
const cCtx = cCanvas.getContext('2d');

const spinBtnCenter = document.getElementById('spin-button-center');
const spinBtn = document.getElementById('spin-button');
const menuForm = document.getElementById('menu-form');
const menuInput = document.getElementById('menu-input');
const menuListContainer = document.getElementById('menu-list');
const menuCountBadge = document.getElementById('current-count');
const resetBtn = document.getElementById('reset-button');
const clearBtn = document.getElementById('clear-button');

// 모달 엘리먼트
const resultModal = document.getElementById('result-modal');
const resultMenuName = document.getElementById('result-menu-name');
const modalRetryBtn = document.getElementById('modal-retry-button');
const modalCloseBtn = document.getElementById('modal-close-button');

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

// 룰렛 칸 넘어갈 때 째깍거리는 틱음 합성
function playTickSound() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'triangle'; // 부드러운 타악기 느낌을 주는 삼각파
    osc.frequency.setValueAtTime(600, audioCtx.currentTime); // 고음역대
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

// 당첨 시 빰빰빰~ 하는 축하 팡파르 멜로디 합성
function playWinSound() {
  if (!audioCtx) return;
  
  const now = audioCtx.currentTime;
  
  // 도-미-솔-도 아르페지오 멜로디 구성
  const notes = [
    { note: 523.25, time: 0 },    // C5 (도)
    { note: 659.25, time: 0.12 },  // E5 (미)
    { note: 783.99, time: 0.24 },  // G5 (솔)
    { note: 1046.50, time: 0.36 }  // C6 (높은 도, 길게)
  ];
  
  notes.forEach((item, index) => {
    try {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine'; // 맑은 사인파
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
  cCanvas.width = window.innerWidth;
  cCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeConfettiCanvas);
resizeConfettiCanvas();

class ConfettiParticle {
  constructor() {
    this.x = Math.random() * cCanvas.width;
    this.y = Math.random() * -cCanvas.height - 20; // 화면 위쪽에서 시작
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
    
    // 점차 페이드아웃 효과 (화면 하단 근처)
    if (this.y > cCanvas.height * 0.7) {
      this.opacity -= 0.02;
    }
  }

  draw() {
    cCtx.save();
    cCtx.translate(this.x, this.y);
    cCtx.rotate((this.rotation * Math.PI) / 180);
    cCtx.globalAlpha = Math.max(0, this.opacity);
    cCtx.fillStyle = this.color;
    
    // 사각형 오색 종이
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
  if (!confettiActive) return;
  cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
  
  // 파티클 업데이트 및 렌더링
  confettiParticles.forEach((p, index) => {
    p.update();
    p.draw();
    
    // 화면 밖으로 완전히 사라지거나 투명도가 0이 되면 배열에서 제거
    if (p.y > cCanvas.height || p.opacity <= 0) {
      confettiParticles[index] = new ConfettiParticle(); // 무한 흩날림 효과를 위해 재생성
    }
  });
  
  requestAnimationFrame(animateConfetti);
}

function stopConfetti() {
  confettiActive = false;
  cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
}

// ==========================================
// 5. 룰렛 렌더링 및 물리엔진
// ==========================================
function drawRoulette() {
  const size = rCanvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const radius = cx - 15;
  
  rCtx.clearRect(0, 0, size, size);
  
  const numSlices = menus.length;
  
  if (numSlices === 0) {
    // 메뉴가 비어있는 상태일 때 빈 디자인 렌더링
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
  // 현재의 회전각 적용
  rCtx.translate(cx, cy);
  rCtx.rotate(currentRotation);
  rCtx.translate(-cx, -cy);
  
  // 1. 각 조각 그리기
  for (let i = 0; i < numSlices; i++) {
    const startAngle = i * sliceAngle;
    const endAngle = startAngle + sliceAngle;
    
    rCtx.beginPath();
    rCtx.moveTo(cx, cy);
    rCtx.arc(cx, cy, radius, startAngle, endAngle);
    rCtx.closePath();
    
    // 색상 선택 (WHEEL_COLORS에서 순환 선택)
    rCtx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
    rCtx.fill();
    
    // 구분선 그리기 (미세한 투명 흰색선)
    rCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    rCtx.lineWidth = 2;
    rCtx.stroke();
  }

  // 2. 각 조각 내부의 텍스트 그리기
  for (let i = 0; i < numSlices; i++) {
    const startAngle = i * sliceAngle;
    const endAngle = startAngle + sliceAngle;
    const textAngle = startAngle + sliceAngle / 2;
    
    rCtx.save();
    rCtx.translate(cx, cy);
    rCtx.rotate(textAngle);
    
    // 텍스트 정렬 및 스타일
    rCtx.textAlign = 'right';
    rCtx.textBaseline = 'middle';
    
    // 메뉴 이름이 길면 폰트 사이즈 조정
    const menuText = menus[i];
    let fontSize = 16;
    if (numSlices > 12) fontSize = 12;
    else if (numSlices > 8) fontSize = 14;
    
    rCtx.font = `900 ${fontSize}px var(--font-family)`;
    
    // 텍스트 가독성을 위한 바깥 그림자 (Shadow) 효과
    rCtx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    rCtx.shadowBlur = 4;
    rCtx.shadowOffsetX = 1;
    rCtx.shadowOffsetY = 1;
    rCtx.fillStyle = '#ffffff';
    
    // 텍스트 위치 설정 (외곽 반지름 근처에서 중앙 안쪽으로)
    rCtx.fillText(menuText, radius - 30, 0);
    rCtx.restore();
  }
  
  rCtx.restore();
  
  // 3. 룰렛 외부 금속 느낌의 링 테두리 그리기 (고정 원)
  rCtx.save();
  rCtx.beginPath();
  rCtx.arc(cx, cy, radius, 0, 2 * Math.PI);
  
  // 그라데이션 광택링
  const strokeGrad = rCtx.createLinearGradient(0, 0, size, size);
  strokeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  strokeGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
  strokeGrad.addColorStop(1, 'rgba(138, 43, 226, 0.3)');
  
  rCtx.strokeStyle = strokeGrad;
  rCtx.lineWidth = 10;
  rCtx.stroke();
  rCtx.restore();
}

// 물리 기반 스핀 애니메이션 루프
let lastTickAngle = -1;
function spinLoop() {
  if (!isSpinning) return;
  
  // 회전각 업데이트 및 2*PI 범위로 정규화하여 정밀도 오차 방지
  currentRotation = (currentRotation + spinVelocity) % (2 * Math.PI);
  spinVelocity *= spinDeceleration; // 마찰력에 의한 감속
  
  // 한 칸 넘어갈 때 째깍(Tick)거리는 사운드 효과 계산
  const numSlices = menus.length;
  const sliceAngle = (2 * Math.PI) / numSlices;
  
  // 12시 바늘(1.5 * Math.PI)이 지목하는 룰렛 상의 상대 각도 계산
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
  
  // 속도가 일정 임계값 이하가 되면 정지
  if (spinVelocity < 0.0015) {
    isSpinning = false;
    spinVelocity = 0;
    
    // 최종 결과 계산 (현재 바늘이 지목하는 인덱스로 확정)
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
  stopConfetti(); // 이전 꽃가루 클리어
  
  isSpinning = true;
  rCanvas.classList.add('spin-active');
  
  // 시작 속도를 무작위로 주어 결과를 예측 불가하게 함 (보통 0.25 ~ 0.45 라디안/프레임)
  spinVelocity = Math.random() * 0.2 + 0.3;
  
  // 비활성화 제어
  setControlsEnabled(false);
  
  spinLoop();
}

function setControlsEnabled(enabled) {
  spinBtn.disabled = !enabled;
  spinBtnCenter.disabled = !enabled;
  resetBtn.disabled = !enabled;
  clearBtn.disabled = !enabled;
  
  // 추가 폼 비활성화
  const formElements = menuForm.elements;
  for (let i = 0; i < formElements.length; i++) {
    formElements[i].disabled = !enabled;
  }
}

// ==========================================
// 6. 결과 처리 및 모달 제어
// ==========================================
function showWinner(winningIndex) {
  rCanvas.classList.remove('spin-active');
  
  // 당첨 멜로디 재생
  playWinSound();
  
  // 당첨된 메뉴 텍스트 반영
  const winnerText = menus[winningIndex];
  resultMenuName.textContent = winnerText;
  
  // 꽃가루 뿜뿌!
  startConfetti();
  
  // 팝업 모달창 오픈
  setTimeout(() => {
    resultModal.classList.remove('hidden');
  }, 350);
}

function closeModal() {
  resultModal.classList.add('hidden');
  stopConfetti();
  setControlsEnabled(true);
}

// ==========================================
// 7. 메뉴 데이터 관리 로직
// ==========================================
function loadMenus() {
  const stored = localStorage.getItem('lunch-roulette-menus');
  if (stored) {
    try {
      menus = JSON.parse(stored);
      // 배열이 아니거나 비어있으면 기본 메뉴로 복구
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
  localStorage.setItem('lunch-roulette-menus', JSON.stringify(menus));
}

function updateUI() {
  // 1. 카운트 갱신
  menuCountBadge.textContent = menus.length;
  
  // 2. 리스트 컨테이너 리빌딩
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
  
  // Lucide 아이콘 새로 그리기 (로딩 실패 대비 안전 장치 추가)
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    try {
      lucide.createIcons();
    } catch (e) {
      console.warn('Lucide icons failed to render:', e);
    }
  }
  
  // 3. 룰렛 캔버스 갱신
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
  // 1. 이벤트 리스너 추가
  spinBtn.addEventListener('click', startSpin);
  spinBtnCenter.addEventListener('click', startSpin);
  
  menuForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = menuInput.value;
    addMenu(val);
    menuInput.value = '';
    menuInput.focus();
  });
  
  resetBtn.addEventListener('click', resetToDefault);
  clearBtn.addEventListener('click', clearAllMenus);
  
  modalCloseBtn.addEventListener('click', closeModal);
  modalRetryBtn.addEventListener('click', () => {
    closeModal();
    // 숏컷으로 다음 룰렛 스핀 시작 (동작 유연성을 위한 시간 지연 제공)
    setTimeout(startSpin, 400);
  });
  
  // 스페이스바 조작 접근성 지원
  window.addEventListener('keydown', (e) => {
    // 인풋 포커스 상태일 때는 스페이스바 스핀 작동을 제한
    if (document.activeElement === menuInput) return;
    
    if (e.code === 'Space') {
      e.preventDefault(); // 스크롤 바운싱 방지
      if (!isSpinning) {
        if (!resultModal.classList.contains('hidden')) {
          closeModal();
        } else {
          startSpin();
        }
      }
    }
  });

  // 2. 초기 룰렛 데이터 로드 및 렌더링
  loadMenus();
}

// readyState를 확인하여 안전하게 초기화 실행 (Vite 모듈 환경 호환성 확보)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
