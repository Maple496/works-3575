// src/engine.js —— 引擎：状态与规则（纯逻辑，不碰 DOM）
var Engine = (function () {
  var CELL = 20;                 // 格子边长（px，随 layout 自适应可调）
  var state = {
    cols: 0, rows: 0,
    snake: [],
    dir: 'right',
    pendingDir: 'right',
    food: { x: 0, y: 0 },
    score: 0,
    phase: 'ready'
  };
  var acc = 0;
  var STEP_MS = 140;
  var paused = false;

  function cellFree(x, y) {
    for (var i = 0; i < state.snake.length; i++) {
      if (state.snake[i].x === x && state.snake[i].y === y) return false;
    }
    return true;
  }

  function spawnFood() {
    var free = [];
    for (var x = 0; x < state.cols; x++) {
      for (var y = 0; y < state.rows; y++) {
        if (cellFree(x, y)) free.push({ x: x, y: y });
      }
    }
    if (!free.length) { state.food = { x: -1, y: -1 }; return; }
    state.food = free[Math.floor(Math.random() * free.length)];
  }

  function reset() {
    var cx = Math.floor(state.cols / 2);
    var cy = Math.floor(state.rows / 2);
    state.snake = [
      { x: cx, y: cy },
      { x: Math.max(0, cx - 1), y: cy },
      { x: Math.max(0, cx - 2), y: cy }
    ];
    state.dir = 'right';
    state.pendingDir = 'right';
    state.score = 0;
    state.phase = 'ready';
    paused = false;
    acc = 0;
    spawnFood();
  }

  var DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  var OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

  function turn(dir) {
    if (state.phase === 'over') return;
    if (!DIRS[dir]) return;
    if (dir === OPP[state.dir]) return;
    state.pendingDir = dir;
  }

  function togglePause() {
    if (state.phase !== 'playing' && state.phase !== 'ready') return;
    paused = !paused;
    return paused;
  }

  function setPaused(v) {
    paused = !!v;
    return paused;
  }

  function isPaused() {
    return paused;
  }

  function advance() {
    if (paused) return;
    if (state.phase !== 'playing') return;
    state.dir = state.pendingDir;
    var d = DIRS[state.dir];
    var head = state.snake[0];
    var nx = head.x + d.x;
    var ny = head.y + d.y;
    if (nx < 0 || ny < 0 || nx >= state.cols || ny >= state.rows) {
      state.phase = 'over';
      return;
    }
    // 咬己判定：若不吃食，尾巴会移走，可不视为碰撞
    var ate = (nx === state.food.x && ny === state.food.y);
    for (var i = 0; i < state.snake.length - (ate ? 0 : 1); i++) {
      if (state.snake[i].x === nx && state.snake[i].y === ny) {
        state.phase = 'over';
        return;
      }
    }
    state.snake.unshift({ x: nx, y: ny });
    if (ate) {
      state.score += 1;
      spawnFood();
    } else {
      state.snake.pop();
    }
  }

  function step(ts) {
    if (paused) { step.last = ts; acc = 0; return; }
    if (state.phase !== 'playing') { acc = 0; step.last = ts; return; }
    if (!step.last) step.last = ts;
    var dt = ts - step.last;
    step.last = ts;
    acc += dt;
    while (acc >= STEP_MS && state.phase === 'playing') {
      acc -= STEP_MS;
      advance();
    }
  }

  function clampGrid() {
    var len = state.snake.length;
    for (var i = 0; i < len; i++) {
      var s = state.snake[i];
      s.x = Math.min(Math.max(0, s.x), state.cols - 1);
      s.y = Math.min(Math.max(0, s.y), state.rows - 1);
    }
    state.food.x = Math.min(Math.max(0, state.food.x), state.cols - 1);
    state.food.y = Math.min(Math.max(0, state.food.y), state.rows - 1);
  }

  function layout(w, h) {
    state.cols = Math.max(5, Math.floor(w / CELL));
    state.rows = Math.max(5, Math.floor(h / CELL));
    clampGrid();
  }

  function init(w, h) {
    layout(w, h);
    reset();
  }

  return {
    init: init,
    reset: reset,
    turn: turn,
    step: step,
    layout: layout,
    advance: advance,
    togglePause: togglePause,
    setPaused: setPaused,
    isPaused: isPaused,
    STEP_MS: STEP_MS,
    CELL: CELL,
    state: state
  };
})();
