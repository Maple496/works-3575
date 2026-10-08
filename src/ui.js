// src/ui.js —— 界面：渲染与覆盖层、触屏手势与虚拟方向键
// 职责：render 绘制画面；init 建 stage 内 absolute 覆盖层并绑手势；destroy 清理

var UI = (function () {
  var stageEl = null, canvasEl = null, actions = null;
  var scoreEl = null, hintEl = null, overEl = null;
  var overScoreEl = null;
  var padEl = null;              // 虚拟方向键容器
  var padBtns = [];              // [dir, el] 列表，layout 时重排
  var uiHandlers = [];           // 已绑定监听，destroy 逐一解绑
  var swipe = { down: false, x: 0, y: 0, fired: false };
  var SWIPE_T = 24;              // 滑动触发阈值（px）
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function bind(target, type, fn) {
    target.addEventListener(type, fn);
    uiHandlers.push({ target: target, type: type, fn: fn });
  }

  function makeOverlay(style) {
    var el = document.createElement('div');
    el.style.position = 'absolute';
    for (var k in style) { el.style[k] = style[k]; }
    return el;
  }

  function fireSwipe(dir) {
    if (actions && typeof actions.onSwipe === 'function') actions.onSwipe(dir);
  }

  // 触屏滑动手势：pointerdown 记起点，pointermove 达阈值即触发 onSwipe
  function setupSwipe() {
    function pos(e) {
      var r = stageEl.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    bind(stageEl, 'pointerdown', function (e) {
      var p = pos(e);
      swipe.down = true; swipe.fired = false;
      swipe.x = p.x; swipe.y = p.y;
    });
    bind(stageEl, 'pointermove', function (e) {
      if (!swipe.down || swipe.fired) return;
      var p = pos(e);
      var dx = p.x - swipe.x, dy = p.y - swipe.y;
      if (Math.abs(dx) < SWIPE_T && Math.abs(dy) < SWIPE_T) return;
      swipe.fired = true;
      if (Math.abs(dx) > Math.abs(dy)) fireSwipe(dx > 0 ? 'right' : 'left');
      else fireSwipe(dy > 0 ? 'down' : 'up');
    });
    bind(stageEl, 'pointerup', function () {
      swipe.down = false;
      if (!swipe.fired && actions && typeof actions.onRestart === 'function') {
        actions.onRestart();          // 点按：开始/重开
      }
    });
    bind(stageEl, 'pointerleave', function () { swipe.down = false; });
  }

  // 屏幕虚拟方向键（stage 内 absolute 网格布局），点按触发 onSwipe
  function buildPad() {
    padEl = makeOverlay({
      left: '0px', bottom: '8px', width: '150px', height: '150px',
      display: 'grid',
      gridTemplateColumns: '50px 50px 50px',
      gridTemplateRows: '50px 50px 50px',
      pointerEvents: 'auto'
    });
    var defs = [
      { dir: 'up', cell: '2 / 1' },
      { dir: 'left', cell: '1 / 2' },
      { dir: 'down', cell: '2 / 3' },
      { dir: 'right', cell: '3 / 2' }
    ];
    defs.forEach(function (d) {
      var b = document.createElement('div');
      b.style.gridColumn = d.cell.split(' ')[1];
      b.style.gridRow = d.cell.split(' ')[0];
      b.style.display = 'flex';
      b.style.alignItems = 'center';
      b.style.justifyContent = 'center';
      b.style.background = 'rgba(255,255,255,0.15)';
      b.style.borderRadius = '8px';
      b.style.color = '#fff';
      b.style.fontSize = '20px';
      b.style.userSelect = 'none';
      b.style.touchAction = 'none';
      b.textContent = { up: '▲', down: '▼', left: '◀', right: '▶' }[d.dir];
      bind(b, 'pointerdown', function (e) {
        e.stopPropagation();
        fireSwipe(d.dir);
      });
      padBtns.push({ dir: d.dir, el: b });
      padEl.appendChild(b);
    });
    stageEl.appendChild(padEl);
  }

  // 计分板 + 「点击/触摸开始」引导层 + 结束弹层（含分数与重开按钮）
  function buildOverlays() {
    scoreEl = makeOverlay({
      top: '6px', left: '8px', color: '#fff',
      font: 'bold 16px sans-serif',
      pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.6)'
    });
    scoreEl.textContent = '得分 0';
    stageEl.appendChild(scoreEl);

    hintEl = makeOverlay({
      left: '0', top: '40%', width: '100%', textAlign: 'center',
      color: '#fff', font: 'bold 20px sans-serif',
      textShadow: '0 1px 3px rgba(0,0,0,0.8)',
      pointerEvents: 'none'
    });
    hintEl.textContent = '点击 / 触摸开始，滑动或方向键移动';
    stageEl.appendChild(hintEl);

    overEl = makeOverlay({
      left: '50%', top: '50%', width: '200px', height: '110px',
      marginLeft: '-100px', marginTop: '-55px',
      background: 'rgba(0,0,0,0.75)', borderRadius: '10px',
      color: '#fff', textAlign: 'center',
      font: '16px sans-serif', display: 'none',
      pointerEvents: 'auto'
    });
    var title = document.createElement('div');
    title.textContent = '游戏结束';
    title.style.marginTop = '16px';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '18px';
    overEl.appendChild(title);

    overScoreEl = document.createElement('div');
    overScoreEl.textContent = '得分 0';
    overScoreEl.style.marginTop = '6px';
    overEl.appendChild(overScoreEl);

    var btn = document.createElement('div');
    btn.textContent = '再来一局';
    btn.style.margin = '10px auto 0';
    btn.style.width = '120px';
    btn.style.padding = '6px 0';
    btn.style.background = '#2d8';
    btn.style.borderRadius = '6px';
    btn.style.fontWeight = 'bold';
    btn.style.cursor = 'pointer';
    bind(btn, 'pointerdown', function (e) {
      e.stopPropagation();
      if (actions && typeof actions.onRestart === 'function') actions.onRestart();
    });
    overEl.appendChild(btn);
    stageEl.appendChild(overEl);
  }

  // 初始化：建层、绑手势、显示引导
  function init(stage, canvas, stateRef, actionMap) {
    stageEl = stage;
    canvasEl = canvas;
    actions = actionMap;
    buildOverlays();
    buildPad();
    setupSwipe();
    hintEl.style.display = 'block';
    overEl.style.display = 'none';
    scoreEl.textContent = '得分 0';
  }

  // 尺寸变化：重排虚拟方向键与覆盖层位置
  function layout(w, h) {
    if (!stageEl) return;
    stageEl.style.width = w + 'px';
    stageEl.style.height = h + 'px';
    var ps = Math.max(120, Math.min(150, Math.floor(w / 4)));
    var gap = 8;
    if (padEl) {
      padEl.style.width = ps + 'px';
      padEl.style.height = ps + 'px';
      padEl.style.left = gap + 'px';
      padEl.style.bottom = gap + 'px';
      padEl.style.gridTemplateColumns = (ps / 3) + 'px ' + (ps / 3) + 'px ' + (ps / 3) + 'px';
      padEl.style.gridTemplateRows = (ps / 3) + 'px ' + (ps / 3) + 'px ' + (ps / 3) + 'px';
    }
    if (hintEl) hintEl.style.top = Math.floor(h * 0.4) + 'px';
    if (overEl) {
      overEl.style.left = Math.floor(w / 2) + 'px';
      overEl.style.top = Math.floor(h / 2) + 'px';
    }
  }

  // 每帧渲染：背景网格、食物、蛇身（头亮色）、根据 phase 切换覆盖层显隐
  function render(g, state) {
    var w = canvasEl.width, h = canvasEl.height;
    var cols = state.cols, rows = state.rows;
    var cell = Math.floor(Math.min(w / cols, h / rows));
    var ox = Math.floor((w - cell * cols) / 2);
    var oy = Math.floor((h - cell * rows) / 2);

    g.fillStyle = '#101820';
    g.fillRect(0, 0, w, h);

    // 网格
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.lineWidth = 1;
    g.beginPath();
    for (var c = 0; c <= cols; c++) {
      g.moveTo(ox + c * cell + 0.5, oy);
      g.lineTo(ox + c * cell + 0.5, oy + rows * cell);
    }
    for (var r = 0; r <= rows; r++) {
      g.moveTo(ox, oy + r * cell + 0.5);
      g.lineTo(ox + cols * cell, oy + r * cell + 0.5);
    }
    g.stroke();

    function cellRect(x, y) {
      return [ox + x * cell + 1, oy + y * cell + 1, cell - 2, cell - 2];
    }

    // 食物
    if (state.food) {
      g.fillStyle = '#e5533d';
      g.fillRect.apply(g, cellRect(state.food.x, state.food.y));
    }

    // 蛇身（头亮色）
    if (state.snake && state.snake.length) {
      for (var i = state.snake.length - 1; i >= 0; i--) {
        g.fillStyle = i === 0 ? '#7CFC00' : '#3fa34d';
        g.fillRect.apply(g, cellRect(state.snake[i].x, state.snake[i].y));
      }
    }

    // 计分板与覆盖层
    if (scoreEl) scoreEl.textContent = '得分 ' + (state.score || 0);
    var phase = state.phase;
    if (hintEl) hintEl.style.display = phase === 'ready' ? 'block' : 'none';
    if (overEl) {
      if (phase === 'over') {
        if (overScoreEl) overScoreEl.textContent = '得分 ' + (state.score || 0);
        overEl.style.display = 'block';
      } else {
        overEl.style.display = 'none';
      }
    }
    if (padEl) padEl.style.display = phase === 'playing' ? 'grid' : 'none';
  }

  function destroy() {
    uiHandlers.forEach(function (h) {
      h.target.removeEventListener(h.type, h.fn);
    });
    uiHandlers = [];
    [scoreEl, hintEl, overEl, padEl].forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    scoreEl = hintEl = overEl = overScoreEl = padEl = null;
    padBtns = [];
    stageEl = canvasEl = null;
    actions = null;
  }

  return { init: init, layout: layout, render: render, destroy: destroy };
})();
