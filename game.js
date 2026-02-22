(function () {
  "use strict";

  var GRID_SIZE = 20;
  var TILE_COUNT = 20;
  var LEVELS = {
    easy: 420,
    medium: 280,
    hard: 190
  };
  var DEFAULT_LEVEL = "medium";

  var canvas = document.getElementById("board");
  var ctx = canvas.getContext("2d");
  var scoreEl = document.getElementById("score");
  var highScoreEl = document.getElementById("highScore");
  var statusEl = document.getElementById("status");
  var startBtn = document.getElementById("startBtn");
  var levelSelect = document.getElementById("levelSelect");

  var snake;
  var direction;
  var nextDirection;
  var food;
  var score;
  var highScore;
  var timerId;
  var isRunning;
  var currentLevel;
  var deathParticles;
  var rainAnimationId;
  var lastRainSpawnAt;
  var audioContext;
  var activeSoundNodes;
  var musicTimerId;
  var musicNoteIndex = 0;
  var musicPlaying = false;
  var botSnake;
  var botDirection;
  var botActive;
  var touchStartX = 0;
  var touchStartY = 0;
  var touchMoved = false;
  var bgsong = [
    // Intro
    659.25, 659.25, 0, 659.25, 0, 523.25, 659.25, 0, 783.99, 0, 0, 0, 392.00, 0, 0, 0,
    // Part 1
    523.25, 0, 0, 392.00, 0, 0, 329.63, 0, 0, 440.00, 0, 493.88, 0, 466.16, 440.00, 0,
    392.00, 659.25, 783.99, 880.00, 0, 698.46, 783.99, 0, 659.25, 0, 523.25, 587.33, 493.88, 0, 0, 0,
    // Part 1 repeat
    523.25, 0, 0, 392.00, 0, 0, 329.63, 0, 0, 440.00, 0, 493.88, 0, 466.16, 440.00, 0,
    392.00, 659.25, 783.99, 880.00, 0, 698.46, 783.99, 0, 659.25, 0, 523.25, 587.33, 493.88, 0, 0, 0,
    // Part 2
    0, 0, 783.99, 739.99, 698.46, 622.25, 0, 659.25, 0, 415.30, 440.00, 523.25, 0, 440.00, 523.25, 587.33,
    0, 0, 783.99, 739.99, 698.46, 622.25, 0, 659.25, 0, 1046.50, 0, 1046.50, 1046.50, 0, 0, 0,
    // Part 2 repeat 2nd half
    0, 0, 783.99, 739.99, 698.46, 622.25, 0, 659.25, 0, 415.30, 440.00, 523.25, 0, 440.00, 523.25, 587.33,
    0, 0, 622.25, 0, 0, 587.33, 0, 0, 523.25, 0, 0, 0, 0, 0, 0, 0
  ];

  function readHighScore() {
    try {
      var raw = localStorage.getItem("snake-high-score");
      var value = Number(raw || 0);
      return Number.isFinite(value) ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function writeHighScore(value) {
    try {
      localStorage.setItem("snake-high-score", String(value));
    } catch (err) {
      // Ignore storage issues.
    }
  }

  function resetGame() {
    snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    scoreEl.textContent = String(score);
    deathParticles = [];
    botSnake = [];
    botDirection = { x: 1, y: 0 };
    botActive = false;
    placeFood();
    draw();
  }

  function placeFood() {
    var candidate;
    do {
      candidate = {
        x: Math.floor(Math.random() * TILE_COUNT),
        y: Math.floor(Math.random() * TILE_COUNT)
      };
    } while (isOnAnySnake(candidate.x, candidate.y));

    food = candidate;
  }

  function isOnPlayerSnake(x, y) {
    for (var i = 0; i < snake.length; i += 1) {
      if (snake[i].x === x && snake[i].y === y) {
        return true;
      }
    }
    return false;
  }

  function isOnBotSnake(x, y) {
    if (!botActive) return false;
    for (var i = 0; i < botSnake.length; i += 1) {
      if (botSnake[i].x === x && botSnake[i].y === y) {
        return true;
      }
    }
    return false;
  }

  function isOnAnySnake(x, y) {
    return isOnPlayerSnake(x, y) || isOnBotSnake(x, y);
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function startGame() {
    var tickMs = LEVELS[currentLevel] || LEVELS[DEFAULT_LEVEL];

    stopDeathRain();
    stopGameOverSound();
    ensureAudioReady();

    if (timerId) {
      clearInterval(timerId);
    }

    resetGame();
    isRunning = true;
    startMusic();
    setStatus("Game running (" + getLevelLabel(currentLevel) + ")");
    timerId = setInterval(tick, tickMs);
  }

  function updateGameSpeed() {
    if (timerId) clearInterval(timerId);

    // Base speed from current difficulty level
    var baseTickMs = LEVELS[currentLevel] || LEVELS[DEFAULT_LEVEL];

    // Decrease delay (increase speed) by 10% for every 5 apples.
    var speedUps = Math.floor(score / 5);
    var newTickMs = baseTickMs;

    var speedCheckbox = document.getElementById("speedCheck");
    if (speedCheckbox && speedCheckbox.checked) {
      newTickMs = baseTickMs * Math.pow(0.9, speedUps);
    }

    // Prevent parsing errors or going infinitely fast
    if (newTickMs < 30) newTickMs = 30;

    timerId = setInterval(tick, newTickMs);
  }

  function stopGame(message) {
    isRunning = false;
    stopMusic();
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    setStatus(message);
  }

  function tick() {
    direction = nextDirection;

    var head = snake[0];
    var newHead = {
      x: head.x + direction.x,
      y: head.y + direction.y
    };

    if (
      newHead.x < 0 ||
      newHead.x >= TILE_COUNT ||
      newHead.y < 0 ||
      newHead.y >= TILE_COUNT ||
      isOnAnySnake(newHead.x, newHead.y)
    ) {
      stopGame("Game over. Press Start / Restart.");
      startDeathRain();
      playGameOverSound();
      return;
    }

    snake.unshift(newHead);

    if (newHead.x === food.x && newHead.y === food.y) {
      score += 1;
      scoreEl.textContent = String(score);
      playEatSound();
      if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = String(highScore);
        writeHighScore(highScore);
      }

      // Every 5 points increase speed immediately
      if (score > 0 && score % 5 === 0) {
        updateGameSpeed();
      }

      placeFood();
    } else {
      snake.pop();
    }

    if (score >= 5 && !botActive) {
      var botCheckbox = document.getElementById("botCheck");
      if (botCheckbox && botCheckbox.checked) {
        spawnBot();
      }
    } else if (botActive) {
      botDirection = getBotDirection();
      var botHead = botSnake[0];
      var newBotHead = {
        x: botHead.x + botDirection.x,
        y: botHead.y + botDirection.y
      };

      if (
        newBotHead.x < 0 ||
        newBotHead.x >= TILE_COUNT ||
        newBotHead.y < 0 ||
        newBotHead.y >= TILE_COUNT ||
        isOnAnySnake(newBotHead.x, newBotHead.y)
      ) {
        botActive = false; // Crash!
      } else {
        botSnake.unshift(newBotHead);
        if (newBotHead.x === food.x && newBotHead.y === food.y) {
          placeFood(); // Bot ate food, respawn it. No player points.
        } else {
          botSnake.pop();
        }
      }
    }

    draw();
  }

  function isOccupiedForBot(x, y) {
    if (x < 0 || x >= TILE_COUNT || y < 0 || y >= TILE_COUNT) return true;
    return isOnAnySnake(x, y);
  }

  function getBotDirection() {
    if (!botSnake.length) return botDirection;
    var head = botSnake[0];
    var possibleMoves = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ];

    var bestMove = botDirection;
    var minDistance = Infinity;
    var canMove = false;

    var validMoves = possibleMoves.filter(function (m) {
      if (m.dx === -botDirection.x && m.dy === -botDirection.y) return false;
      return !isOccupiedForBot(head.x + m.dx, head.y + m.dy);
    });

    for (var i = 0; i < validMoves.length; i++) {
      var m = validMoves[i];
      var nx = head.x + m.dx;
      var ny = head.y + m.dy;
      var dist = Math.abs(nx - food.x) + Math.abs(ny - food.y);

      if (dist < minDistance) {
        minDistance = dist;
        bestMove = { x: m.dx, y: m.dy };
        canMove = true;
      }
    }

    if (!canMove && validMoves.length > 0) {
      bestMove = { x: validMoves[0].dx, y: validMoves[0].dy };
    } else if (!canMove) {
      bestMove = botDirection;
    }

    return bestMove;
  }

  function spawnBot() {
    var spawnX = TILE_COUNT - 3;
    var spawnY = 2;
    botSnake = [
      { x: spawnX, y: spawnY },
      { x: spawnX, y: spawnY - 1 },
      { x: spawnX, y: spawnY - 2 }
    ];
    botDirection = { x: 0, y: 1 };
    botActive = true;
  }

  function drawGrid() {
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--grid").trim() || "#dce5f0";
    ctx.lineWidth = 1;

    for (var i = 1; i < TILE_COUNT; i += 1) {
      var p = i * GRID_SIZE + 0.5;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(canvas.width, p);
      ctx.stroke();
    }
  }

  function drawCell(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * GRID_SIZE + 1, y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawGrid();

    drawCell(food.x, food.y, getCssVar("--food", "#e63946"));

    if (botActive) {
      for (var i = botSnake.length - 1; i >= 0; i -= 1) {
        drawCell(botSnake[i].x, botSnake[i].y, "#f59e0b");
      }
      drawCell(botSnake[0].x, botSnake[0].y, "#d97706");
    }

    for (var i = snake.length - 1; i >= 0; i -= 1) {
      drawCell(snake[i].x, snake[i].y, getCssVar("--snake", "#8b5cf6"));
    }

    drawCell(snake[0].x, snake[0].y, getCssVar("--snake-head", "#6d28d9"));
  }

  function createDeathParticle() {
    return {
      x: Math.random() * (canvas.width - 10) + 5,
      y: -10 - Math.random() * 30,
      speed: 70 + Math.random() * 170,
      size: 10 + Math.random() * 8,
      symbol: Math.random() < 0.72 ? "💩" : "."
    };
  }

  function updateDeathRain(deltaMs) {
    var i;

    for (i = 0; i < deathParticles.length; i += 1) {
      deathParticles[i].y += (deathParticles[i].speed * deltaMs) / 1000;
    }

    deathParticles = deathParticles.filter(function (item) {
      return item.y < canvas.height + 20;
    });
  }

  function drawDeathRain() {
    var i;
    for (i = 0; i < deathParticles.length; i += 1) {
      ctx.font = "bold " + deathParticles[i].size + "px sans-serif";
      ctx.fillText(deathParticles[i].symbol, deathParticles[i].x, deathParticles[i].y);
    }
  }

  function rainFrame(timestamp) {
    var deltaMs = 16;

    if (!lastRainSpawnAt) {
      lastRainSpawnAt = timestamp;
    }
    if (rainFrame.lastTimestamp) {
      deltaMs = Math.min(50, timestamp - rainFrame.lastTimestamp);
    }
    rainFrame.lastTimestamp = timestamp;

    while (timestamp - lastRainSpawnAt >= 70) {
      deathParticles.push(createDeathParticle());
      if (Math.random() < 0.4) {
        deathParticles.push(createDeathParticle());
      }
      lastRainSpawnAt += 70;
    }

    updateDeathRain(deltaMs);
    draw();
    drawDeathRain();

    rainAnimationId = requestAnimationFrame(rainFrame);
  }

  function startDeathRain() {
    stopDeathRain();
    deathParticles = [];
    lastRainSpawnAt = 0;
    rainFrame.lastTimestamp = 0;
    rainAnimationId = requestAnimationFrame(rainFrame);
  }

  function stopDeathRain() {
    if (rainAnimationId) {
      cancelAnimationFrame(rainAnimationId);
      rainAnimationId = null;
    }
  }

  function getAudioContext() {
    var ContextClass;
    if (audioContext) {
      return audioContext;
    }

    ContextClass = window.AudioContext || window.webkitAudioContext;
    if (!ContextClass) {
      return null;
    }

    audioContext = new ContextClass();
    return audioContext;
  }

  function ensureAudioReady() {
    var ctx = getAudioContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }
  }

  function stopGameOverSound() {
    var i;
    for (i = 0; i < activeSoundNodes.length; i += 1) {
      try {
        activeSoundNodes[i].stop();
      } catch (err) {
        // Ignore nodes that are already stopped.
      }
      try {
        activeSoundNodes[i].disconnect();
      } catch (err2) {
        // Ignore disconnect errors.
      }
    }
    activeSoundNodes = [];
  }

  function scheduleSadTone(ctx, options) {
    var oscillator = ctx.createOscillator();
    var gain = ctx.createGain();
    oscillator.type = options.type || "triangle";
    oscillator.frequency.setValueAtTime(options.from, options.start);
    if (options.to) {
      oscillator.frequency.linearRampToValueAtTime(options.to, options.start + options.duration);
    }

    gain.gain.setValueAtTime(0.0001, options.start);
    gain.gain.exponentialRampToValueAtTime(options.volume, options.start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, options.start + options.duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(options.start);
    oscillator.stop(options.start + options.duration + 0.03);
    activeSoundNodes.push(oscillator);
  }

  function playGameOverSound() {
    var ctx = getAudioContext();
    var t;
    if (!ctx) {
      return;
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    stopGameOverSound();
    t = ctx.currentTime + 0.02;

    // Long "pew" falling tone.
    scheduleSadTone(ctx, { start: t, duration: 1.2, from: 520, to: 140, volume: 0.085, type: "sawtooth" });

    // Longer "tyu-tyu-tyu" sequence.
    scheduleSadTone(ctx, { start: t + 1.35, duration: 0.2, from: 320, to: 270, volume: 0.06, type: "triangle" });
    scheduleSadTone(ctx, { start: t + 1.62, duration: 0.2, from: 290, to: 240, volume: 0.056, type: "triangle" });
    scheduleSadTone(ctx, { start: t + 1.89, duration: 0.2, from: 260, to: 210, volume: 0.052, type: "triangle" });
    scheduleSadTone(ctx, { start: t + 2.16, duration: 0.24, from: 230, to: 180, volume: 0.048, type: "triangle" });
    scheduleSadTone(ctx, { start: t + 2.48, duration: 0.3, from: 200, to: 150, volume: 0.044, type: "triangle" });
  }

  function playEatSound() {
    var ctx = getAudioContext();
    var t;
    var oscillator;
    var gain;

    if (!ctx) {
      return;
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    t = ctx.currentTime + 0.005;
    oscillator = ctx.createOscillator();
    gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(640, t);
    oscillator.frequency.exponentialRampToValueAtTime(920, t + 0.06);
    oscillator.frequency.exponentialRampToValueAtTime(760, t + 0.11);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(t);
    oscillator.stop(t + 0.13);
    activeSoundNodes.push(oscillator);
  }

  function playMusicNote() {
    if (!isRunning || !musicPlaying) return;
    var ctx = getAudioContext();
    if (!ctx) return;

    var freq = bgsong[musicNoteIndex];
    musicNoteIndex = (musicNoteIndex + 1) % bgsong.length;

    if (freq > 0) {
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      var t = ctx.currentTime + 0.01;
      var oscillator = ctx.createOscillator();
      var gain = ctx.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.04, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(t);
      oscillator.stop(t + 0.13);
    }
  }

  function startMusic() {
    if (!musicPlaying) {
      musicPlaying = true;
      musicNoteIndex = 0;
      if (musicTimerId) clearInterval(musicTimerId);
      musicTimerId = setInterval(playMusicNote, 130);
    }
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicTimerId) {
      clearInterval(musicTimerId);
      musicTimerId = null;
    }
  }

  function getCssVar(name, fallback) {
    var value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function handleDirectionInput(dx, dy) {
    if (!isRunning) {
      return;
    }

    // Use pending direction to avoid control glitches when multiple keys are pressed quickly.
    if (nextDirection.x === -dx && nextDirection.y === -dy) {
      return;
    }

    nextDirection = { x: dx, y: dy };
  }

  function onKeyDown(event) {
    ensureAudioReady();

    var key = event.key;
    var code = event.code;
    var keyCode = event.keyCode;

    if (
      key === "ArrowUp" ||
      key === "w" ||
      key === "W" ||
      code === "ArrowUp" ||
      code === "KeyW" ||
      keyCode === 38 ||
      keyCode === 87
    ) {
      event.preventDefault();
      handleDirectionInput(0, -1);
      return;
    }

    if (
      key === "ArrowDown" ||
      key === "s" ||
      key === "S" ||
      code === "ArrowDown" ||
      code === "KeyS" ||
      keyCode === 40 ||
      keyCode === 83
    ) {
      event.preventDefault();
      handleDirectionInput(0, 1);
      return;
    }

    if (
      key === "ArrowLeft" ||
      key === "a" ||
      key === "A" ||
      code === "ArrowLeft" ||
      code === "KeyA" ||
      keyCode === 37 ||
      keyCode === 65
    ) {
      event.preventDefault();
      handleDirectionInput(-1, 0);
      return;
    }

    if (
      key === "ArrowRight" ||
      key === "d" ||
      key === "D" ||
      code === "ArrowRight" ||
      code === "KeyD" ||
      keyCode === 39 ||
      keyCode === 68
    ) {
      event.preventDefault();
      handleDirectionInput(1, 0);
    }
  }

  function onTouchStart(event) {
    if (!isRunning || !event.touches || !event.touches.length) return;
    ensureAudioReady();

    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    touchMoved = false;
  }

  function onTouchMove(event) {
    if (!isRunning || !event.touches || !event.touches.length) return;

    // Prevent default scrolling on canvas ONLY if we are actively dragging
    event.preventDefault();

    var currentX = event.touches[0].clientX;
    var currentY = event.touches[0].clientY;

    var diffX = currentX - touchStartX;
    var diffY = currentY - touchStartY;

    // Threshold for swipe detection (e.g. 30px)
    if (Math.abs(diffX) < 30 && Math.abs(diffY) < 30) {
      return;
    }

    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Horizontal swipe
      if (diffX > 0) {
        handleDirectionInput(1, 0); // Right
      } else {
        handleDirectionInput(-1, 0); // Left
      }
    } else {
      // Vertical swipe
      if (diffY > 0) {
        handleDirectionInput(0, 1); // Down
      } else {
        handleDirectionInput(0, -1); // Up
      }
    }

    // Reset touch start to allow continuous swiping without lifting finger
    touchStartX = currentX;
    touchStartY = currentY;
    touchMoved = true;
  }

  function getLevelLabel(level) {
    if (level === "easy") {
      return "Easy";
    }
    if (level === "hard") {
      return "Hard";
    }
    return "Medium";
  }

  function onLevelChange() {
    currentLevel = levelSelect.value;
    if (!isRunning) {
      setStatus("Selected level: " + getLevelLabel(currentLevel) + ". Press Start to play.");
    }
  }

  function init() {
    highScore = readHighScore();
    highScoreEl.textContent = String(highScore);
    currentLevel = levelSelect.value || DEFAULT_LEVEL;
    deathParticles = [];
    rainAnimationId = null;
    lastRainSpawnAt = 0;
    audioContext = null;
    activeSoundNodes = [];
    musicNoteIndex = 0;
    musicPlaying = false;

    startBtn.addEventListener("click", startGame);
    levelSelect.addEventListener("change", onLevelChange);
    window.addEventListener("keydown", onKeyDown, { passive: false });

    // Mobile touch events
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });

    // Prevent default touch actions on canvas (like scrolling) using CSS
    canvas.style.touchAction = "none";

    resetGame();
    stopGame("Selected level: " + getLevelLabel(currentLevel) + ". Press Start to play.");
  }

  init();
})();
