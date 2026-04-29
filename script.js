const board = document.getElementById("game-board");
const scoreDisplay = document.getElementById("score");
const highScoreDisplay = document.getElementById("high-score");
const speedLabel = document.getElementById("speed-label");
const levelLabel = document.getElementById("level-label");
const bonusTimerDisplay = document.getElementById("bonus-timer");

const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const restartBtn = document.getElementById("restart-btn");

const overlay = document.getElementById("overlay");
const finalScoreEl = document.getElementById("final-score");
const finalHighScoreEl = document.getElementById("final-high-score");
const overlayRestartBtn = document.getElementById("overlay-restart-btn");

const soundToggleBtn = document.getElementById("sound-toggle");
const countdownEl = document.getElementById("countdown");

const boardSize = 20;

// ---------------- High Score (localStorage) ----------------
let highScore = Number(localStorage.getItem("highScore")) || 0;
highScoreDisplay.textContent = highScore;

// ---------------- Sound (localStorage) ----------------
let soundOn = localStorage.getItem("soundOn");
soundOn = soundOn === null ? true : soundOn === "true";
updateSoundButtonText();

let audioCtx = null;
let themeInterval = null;
let currentThemeTimeouts = [];

// ---------------- Game progression ----------------
let level = 1;
let tickMs = 150;
let previousLevel = 1;
levelLabel.textContent = level;
speedLabel.textContent = `${tickMs}ms`;

// ---------------- Game state ----------------
let snake;
let direction;
let pendingDirection;
let regularFood;
let bonusFood;
let bonusFoodExpiresAt = null;
let bonusFoodTimeoutId = null;
let bonusPausedRemainingMs = 0;

let score;
let fruitsEaten;
let growthPending;

let staticObstacleBlocks;
let movingObstacles;

let loopId = null;
let isRunning = false;
let isPaused = false;
let isCountingDown = false;

// ---------------- Init ----------------
resetGameState();
draw();
updateBonusTimerDisplay();

// ---------------- UI Button Handlers ----------------
startBtn.addEventListener("click", () => {
  hideOverlay();

  if (isRunning || isCountingDown) return;

  startCountdown(() => {
    resumeBonusTimerIfNeeded();
    startThemeMusic();
    startGameLoop();
  });
});

pauseBtn.addEventListener("click", () => {
  if (!isRunning || isCountingDown) return;

  if (!isPaused) {
    pauseGameLoop();
  } else {
    resumeGameLoop();
  }
});

restartBtn.addEventListener("click", () => {
  hideOverlay();
  resetGameState();
  draw();

  startCountdown(() => {
    resumeBonusTimerIfNeeded();
    startThemeMusic();
    startGameLoop(true);
  });
});

overlayRestartBtn.addEventListener("click", () => {
  hideOverlay();
  resetGameState();
  draw();

  startCountdown(() => {
    resumeBonusTimerIfNeeded();
    startThemeMusic();
    startGameLoop(true);
  });
});

// ---------------- Sound Toggle ----------------
soundToggleBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  localStorage.setItem("soundOn", soundOn);
  updateSoundButtonText();

  if (soundOn && !audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (!soundOn) {
    stopThemeMusic();
  } else if (isRunning) {
    startThemeMusic();
  }
});

function updateSoundButtonText() {
  soundToggleBtn.textContent = soundOn ? "Sound: ON" : "Sound: OFF";
}

function playEatSound() {
  if (!soundOn) return;

  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
  oscillator.frequency.linearRampToValueAtTime(750, audioCtx.currentTime + 0.08);

  gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.1);
}

function playBonusEatSound() {
  if (!soundOn) return;

  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(650, audioCtx.currentTime);
  oscillator.frequency.linearRampToValueAtTime(1000, audioCtx.currentTime + 0.14);

  gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.14);
}

function playBeep(freq = 500, duration = 0.1) {
  if (!soundOn) return;

  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = "square";
  oscillator.frequency.value = freq;
  gainNode.gain.value = 0.05;

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
}

function playGameOverSound() {
  if (!soundOn) return;

  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.25);

  gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.25);
}

function playTone(freq = 440, duration = 0.18, type = "square", volume = 0.03) {
  if (!soundOn) return;

  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = type;
  oscillator.frequency.value = freq;
  gainNode.gain.value = volume;

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
}

function playThemePhrase() {
  if (!soundOn) return;

  const notes = [
    { freq: 523.25, time: 0 },
    { freq: 659.25, time: 220 },
    { freq: 783.99, time: 440 },
    { freq: 659.25, time: 660 },
    { freq: 587.33, time: 880 },
    { freq: 698.46, time: 1100 },
    { freq: 783.99, time: 1320 },
    { freq: 698.46, time: 1540 }
  ];

  currentThemeTimeouts = [];

  notes.forEach((note) => {
    const timeoutId = setTimeout(() => {
      playTone(note.freq, 0.16, "triangle", 0.025);
    }, note.time);

    currentThemeTimeouts.push(timeoutId);
  });
}

function startThemeMusic() {
  if (!soundOn) return;

  stopThemeMusic();
  playThemePhrase();
  themeInterval = setInterval(playThemePhrase, 1900);
}

function stopThemeMusic() {
  if (themeInterval) {
    clearInterval(themeInterval);
    themeInterval = null;
  }

  currentThemeTimeouts.forEach((id) => clearTimeout(id));
  currentThemeTimeouts = [];
}

// ---------------- Countdown ----------------
function startCountdown(callback) {
  isCountingDown = true;
  startBtn.disabled = true;
  pauseBtn.disabled = true;

  let count = 3;
  countdownEl.textContent = count;
  countdownEl.classList.remove("hidden");
  countdownEl.classList.add("show");
  playBeep(400);

  const interval = setInterval(() => {
    count--;

    if (count > 0) {
      countdownEl.textContent = count;
      playBeep(400);
    } else if (count === 0) {
      countdownEl.textContent = "GO!";
      playBeep(800);
    } else {
      clearInterval(interval);
      countdownEl.classList.remove("show");
      countdownEl.classList.add("hidden");

      isCountingDown = false;
      startBtn.disabled = false;

      callback();
    }
  }, 800);
}

// ---------------- Bonus Fruit Timer ----------------
function spawnBonusFood() {
  clearBonusFood(false);

  bonusFood = generateBonusFood();
  bonusFoodExpiresAt = Date.now() + 5000;
  bonusPausedRemainingMs = 0;

  bonusFoodTimeoutId = setTimeout(() => {
    clearBonusFood(true);
  }, 5000);

  updateBonusTimerDisplay();
}

function clearBonusFood(redraw = true) {
  if (bonusFoodTimeoutId) {
    clearTimeout(bonusFoodTimeoutId);
    bonusFoodTimeoutId = null;
  }

  bonusFood = null;
  bonusFoodExpiresAt = null;
  bonusPausedRemainingMs = 0;
  updateBonusTimerDisplay();

  if (redraw) draw();
}

function pauseBonusTimerIfNeeded() {
  if (!bonusFood || !bonusFoodExpiresAt) return;

  bonusPausedRemainingMs = Math.max(0, bonusFoodExpiresAt - Date.now());

  if (bonusFoodTimeoutId) {
    clearTimeout(bonusFoodTimeoutId);
    bonusFoodTimeoutId = null;
  }
}

function resumeBonusTimerIfNeeded() {
  if (!bonusFood || bonusPausedRemainingMs <= 0) return;

  bonusFoodExpiresAt = Date.now() + bonusPausedRemainingMs;

  bonusFoodTimeoutId = setTimeout(() => {
    clearBonusFood(true);
  }, bonusPausedRemainingMs);

  bonusPausedRemainingMs = 0;
}

function updateBonusTimerDisplay() {
  if (!bonusFood || !bonusFoodExpiresAt) {
    bonusTimerDisplay.textContent = "--";
    return;
  }

  const remainingMs = Math.max(0, bonusFoodExpiresAt - Date.now());
  const seconds = (remainingMs / 1000).toFixed(1);
  bonusTimerDisplay.textContent = `${seconds}s`;
}

// ---------------- Keyboard Controls ----------------
document.addEventListener("keydown", (e) => {
  const keyMap = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
  };

  if (!keyMap[e.key]) return;

  e.preventDefault();

  const next = keyMap[e.key];

  if (direction.x === -next.x && direction.y === -next.y) return;

  pendingDirection = next;
});

// ---------------- Core Loop ----------------
function startGameLoop(forceRestart = false) {
  if (isRunning && !forceRestart) return;

  if (loopId) clearInterval(loopId);

  isRunning = true;
  isPaused = false;
  pauseBtn.disabled = false;
  pauseBtn.textContent = "Pause";

  loopId = setInterval(() => {
    step();
    draw();
  }, tickMs);
}

function pauseGameLoop() {
  if (loopId) clearInterval(loopId);
  loopId = null;
  isPaused = true;
  pauseBtn.textContent = "Resume";
  stopThemeMusic();
  pauseBonusTimerIfNeeded();
}

function resumeGameLoop() {
  if (!isRunning) return;

  isPaused = false;
  pauseBtn.textContent = "Pause";

  if (soundOn) {
    startThemeMusic();
  }

  resumeBonusTimerIfNeeded();

  loopId = setInterval(() => {
    step();
    draw();
  }, tickMs);
}

function stopGameLoop() {
  if (loopId) clearInterval(loopId);
  loopId = null;
  isRunning = false;
  isPaused = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = "Pause";
}

function restartLoopWithNewSpeed() {
  if (!isRunning) return;

  clearInterval(loopId);
  loopId = setInterval(() => {
    step();
    draw();
  }, tickMs);
}

// ---------------- Collision / Placement Helpers ----------------
function isCellOnSnake(x, y) {
  return snake.some(seg => seg.x === x && seg.y === y);
}

function isCellOnStaticObstacle(x, y) {
  return staticObstacleBlocks.some(block =>
    block.some(cell => cell.x === x && cell.y === y)
  );
}

function isCellOnMovingObstacle(x, y) {
  return movingObstacles.some(ob => ob.x === x && ob.y === y);
}

function anyMovingObstacleHitsSnake() {
  return movingObstacles.some(obstacle =>
    snake.some(segment => segment.x === obstacle.x && segment.y === obstacle.y)
  );
}

function isNearSnakeHead(x, y, buffer = 4) {
  const head = snake[0];
  return (
    Math.abs(x - head.x) <= buffer &&
    Math.abs(y - head.y) <= buffer
  );
}

function isBlockedCell(x, y) {
  return (
    isCellOnSnake(x, y) ||
    isCellOnStaticObstacle(x, y) ||
    isCellOnMovingObstacle(x, y) ||
    (regularFood && regularFood.x === x && regularFood.y === y) ||
    (bonusFood && bonusFood.x === x && bonusFood.y === y)
  );
}

// ---------------- Game Step ----------------
function step() {
  direction = pendingDirection;

  moveMovingObstacles();

  if (anyMovingObstacleHitsSnake()) {
    gameOver();
    return;
  }

  updateBonusTimerDisplay();

  const newHead = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  if (
    newHead.x < 1 || newHead.x > boardSize ||
    newHead.y < 1 || newHead.y > boardSize
  ) {
    gameOver();
    return;
  }

  if (snake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
    gameOver();
    return;
  }

  if (isCellOnStaticObstacle(newHead.x, newHead.y)) {
    gameOver();
    return;
  }

  if (isCellOnMovingObstacle(newHead.x, newHead.y)) {
    gameOver();
    return;
  }

  snake.unshift(newHead);

  const ateRegular = regularFood && newHead.x === regularFood.x && newHead.y === regularFood.y;
  const ateBonus = bonusFood && newHead.x === bonusFood.x && newHead.y === bonusFood.y;

  if (ateRegular) {
    score++;
    fruitsEaten++;
    scoreDisplay.textContent = score;
    flashScore();
    playEatSound();

    if (score > highScore) {
      highScore = score;
      localStorage.setItem("highScore", highScore);
      highScoreDisplay.textContent = highScore;
    }

    updateLevelAndDifficulty();
    regularFood = generateRegularFood();

    if (fruitsEaten % 6 === 0 && !bonusFood) {
      spawnBonusFood();
    }
  } else if (ateBonus) {
    score++;
    scoreDisplay.textContent = score;
    flashScore();
    playBonusEatSound();

    if (score > highScore) {
      highScore = score;
      localStorage.setItem("highScore", highScore);
      highScoreDisplay.textContent = highScore;
    }

    updateLevelAndDifficulty();

    // INSTANT BOOST GROWTH
    const tail = snake[snake.length - 1];
    snake.push({ ...tail });
    snake.push({ ...tail });
    snake.push({ ...tail });

    clearBonusFood(false);
  } else if (growthPending > 0) {
    growthPending--;
  } else {
    snake.pop();
  }

  if (anyMovingObstacleHitsSnake()) {
    gameOver();
    return;
  }
}

// ---------------- Difficulty Ramp ----------------
function updateLevelAndDifficulty() {
  level = Math.floor(score / 5) + 1;
  levelLabel.textContent = level;

  const newTickMs = Math.max(70, 150 - (level - 1) * 10);

  if (newTickMs !== tickMs) {
    tickMs = newTickMs;
    speedLabel.textContent = `${tickMs}ms`;
    restartLoopWithNewSpeed();
  } else {
    speedLabel.textContent = `${tickMs}ms`;
  }

  if (level > previousLevel) {
    applyLevelChanges(level);
    previousLevel = level;
  }
}

function applyLevelChanges(currentLevel) {
  if (currentLevel === 2) {
    generateStaticObstacleBlock(3);
    generateStaticObstacleBlock(3);
  }

  if (currentLevel === 3) {
    generateMovingObstacle();
  }

  if (currentLevel === 4) {
    generateMovingObstacle();
  }
}

// ---------------- Static Obstacles ----------------
function generateStaticObstacleBlock(length = 3) {
  let block = null;
  let attempts = 0;

  while (!block && attempts < 300) {
    attempts++;

    const horizontal = Math.random() < 0.5;
    const startX = Math.floor(Math.random() * boardSize) + 1;
    const startY = Math.floor(Math.random() * boardSize) + 1;

    const candidate = [];

    for (let i = 0; i < length; i++) {
      const x = horizontal ? startX + i : startX;
      const y = horizontal ? startY : startY + i;

      if (x < 1 || x > boardSize || y < 1 || y > boardSize) {
        candidate.length = 0;
        break;
      }

      candidate.push({ x, y });
    }

    if (candidate.length !== length) continue;

    const overlaps = candidate.some(cell =>
      isBlockedCell(cell.x, cell.y) || isNearSnakeHead(cell.x, cell.y, 4)
    );

    if (!overlaps) {
      block = candidate;
    }
  }

  if (block) {
    staticObstacleBlocks.push(block);
  }
}

// ---------------- Moving Obstacles ----------------
function generateMovingObstacle() {
  let newObstacle = null;
  let attempts = 0;

  while (!newObstacle && attempts < 300) {
    attempts++;

    const candidate = {
      x: Math.floor(Math.random() * boardSize) + 1,
      y: Math.floor(Math.random() * boardSize) + 1,
      dx: Math.random() < 0.5 ? 1 : 0,
      dy: 0
    };

    if (candidate.dx === 0) {
      candidate.dy = Math.random() < 0.5 ? 1 : -1;
    } else {
      candidate.dx = Math.random() < 0.5 ? 1 : -1;
    }

    const unsafe =
      isBlockedCell(candidate.x, candidate.y) ||
      isNearSnakeHead(candidate.x, candidate.y, 5);

    if (!unsafe) {
      newObstacle = candidate;
    }
  }

  if (newObstacle) {
    movingObstacles.push(newObstacle);
  }
}

function moveMovingObstacles() {
  if (movingObstacles.length === 0) return;

  movingObstacles.forEach((obstacle, index) => {
    let nextX = obstacle.x + obstacle.dx;
    let nextY = obstacle.y + obstacle.dy;

    const hitWall =
      nextX < 1 || nextX > boardSize ||
      nextY < 1 || nextY > boardSize;

    const hitStatic = isCellOnStaticObstacle(nextX, nextY);

    const hitOtherMoving = movingObstacles.some((other, otherIndex) => {
      if (index === otherIndex) return false;
      return other.x === nextX && other.y === nextY;
    });

    if (hitWall || hitStatic || hitOtherMoving) {
      obstacle.dx *= -1;
      obstacle.dy *= -1;

      nextX = obstacle.x + obstacle.dx;
      nextY = obstacle.y + obstacle.dy;
    }

    if (
      nextX >= 1 && nextX <= boardSize &&
      nextY >= 1 && nextY <= boardSize &&
      !isCellOnStaticObstacle(nextX, nextY)
    ) {
      obstacle.x = nextX;
      obstacle.y = nextY;
    }
  });
}

// ---------------- Draw ----------------
function draw() {
  board.innerHTML = "";

  snake.forEach((segment, index) => {
    const div = document.createElement("div");
    div.style.gridColumnStart = segment.x;
    div.style.gridRowStart = segment.y;
    div.classList.add("snake");

    if (index === 0) {
      div.classList.add("snake-head");
    }

    board.appendChild(div);
  });

  if (regularFood) {
    const foodDiv = document.createElement("div");
    foodDiv.style.gridColumnStart = regularFood.x;
    foodDiv.style.gridRowStart = regularFood.y;
    foodDiv.classList.add("food");
    board.appendChild(foodDiv);
  }

  if (bonusFood) {
    const bonusDiv = document.createElement("div");
    bonusDiv.style.gridColumnStart = bonusFood.x;
    bonusDiv.style.gridRowStart = bonusFood.y;
    bonusDiv.classList.add("food", "bonus-food");
    board.appendChild(bonusDiv);
  }

  staticObstacleBlocks.forEach((block) => {
    block.forEach((cell) => {
      const obstacleDiv = document.createElement("div");
      obstacleDiv.style.gridColumnStart = cell.x;
      obstacleDiv.style.gridRowStart = cell.y;
      obstacleDiv.classList.add("obstacle");
      board.appendChild(obstacleDiv);
    });
  });

  movingObstacles.forEach((obstacle) => {
    const movingDiv = document.createElement("div");
    movingDiv.style.gridColumnStart = obstacle.x;
    movingDiv.style.gridRowStart = obstacle.y;
    movingDiv.classList.add("obstacle", "moving-obstacle");
    board.appendChild(movingDiv);
  });
}

// ---------------- UI Effects ----------------
function flashScore() {
  scoreDisplay.classList.add("flash");

  setTimeout(() => {
    scoreDisplay.classList.remove("flash");
  }, 200);
}

// ---------------- Food Generation ----------------
function generateRegularFood() {
  let pos;
  let valid = false;
  let attempts = 0;

  while (!valid && attempts < 300) {
    attempts++;

    pos = {
      x: Math.floor(Math.random() * boardSize) + 1,
      y: Math.floor(Math.random() * boardSize) + 1,
    };

    if (!isBlockedCell(pos.x, pos.y) && !isNearSnakeHead(pos.x, pos.y, 2)) {
      valid = true;
    }
  }

  return pos || { x: 3, y: 3 };
}

function generateBonusFood() {
  let pos;
  let valid = false;
  let attempts = 0;

  while (!valid && attempts < 300) {
    attempts++;

    pos = {
      x: Math.floor(Math.random() * boardSize) + 1,
      y: Math.floor(Math.random() * boardSize) + 1,
    };

    if (!isBlockedCell(pos.x, pos.y) && !isNearSnakeHead(pos.x, pos.y, 3)) {
      valid = true;
    }
  }

  return pos || { x: 17, y: 17 };
}

// ---------------- Reset / Game Over ----------------
function resetGameState() {
  stopThemeMusic();
  clearBonusFood(false);

  snake = [{ x: 10, y: 10 }];
  direction = { x: 1, y: 0 };
  pendingDirection = { x: 1, y: 0 };

  staticObstacleBlocks = [];
  movingObstacles = [];

  score = 0;
  fruitsEaten = 0;
  growthPending = 0;
  level = 1;
  previousLevel = 1;
  tickMs = 150;

  regularFood = null;
  bonusFood = null;
  regularFood = generateRegularFood();

  scoreDisplay.textContent = score;
  levelLabel.textContent = level;
  speedLabel.textContent = `${tickMs}ms`;
  bonusTimerDisplay.textContent = "--";

  stopGameLoop();
}

function gameOver() {
  stopThemeMusic();
  playGameOverSound();
  stopGameLoop();
  clearBonusFood(false);
  showOverlay();
}

function showOverlay() {
  finalScoreEl.textContent = score;
  finalHighScoreEl.textContent = highScore;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}