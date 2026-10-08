// src/main.js —— 入口：创建画布、装配 Engine/UI，唯一 Work.register 容器合同
// 职责：画布生命周期、RAF 主循环驱动、监听注册与销毁

var canvas = null;
var g = null;                 // 画布 2D 上下文，固定命名 g（非 ctx）
var rafId = 0;                // RAF 句柄：Work.register 闭包可见，destroy 可清
var boundHandlers = [];       // 已绑定监听 {target,type,fn}，destroy 逐一解绑

// 每帧回调：推进引擎状态并渲染
function onFrame(ts) {
  rafId = 0;
  Engine.step(ts);
  UI.render(g, Engine.state);
  rafId = requestAnimationFrame(onFrame);
}

// 挂载：ctx 为平台容器对象（bounds/stage/onBounds）
function mount(ctx) {
  canvas = document.createElement('canvas');
  var b = ctx.bounds;
  canvas.width = b.w;
  canvas.height = b.h;
  canvas.style.position = 'absolute';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.touchAction = 'none';
  ctx.stage.appendChild(canvas);
  g = canvas.getContext('2d');

  // 尺寸跟随：注册时平台立即补发一次当前值
  ctx.onBounds(function (nb) {
    canvas.width = nb.w;
    canvas.height = nb.h;
    Engine.layout(nb.w, nb.h);
    UI.layout(nb.w, nb.h);
  });

  Engine.init(b.w, b.h);
  UI.init(ctx.stage, canvas, Engine.state, {
    onSwipe: function (dir) { Engine.turn(dir); },   // 触屏滑动转向
    onRestart: function () { Engine.reset(); }        // 结束后点按重开
  });

  // 键盘仅作快捷方式（主要操作为触屏滑动 + 虚拟方向键）
  var keyFn = function (e) {
    var map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (map[e.key]) { Engine.turn(map[e.key]); e.preventDefault(); }
  };
  window.addEventListener('keydown', keyFn);
  boundHandlers.push({ target: window, type: 'keydown', fn: keyFn });

  rafId = requestAnimationFrame(onFrame);
}

// 卸载：停帧、解绑、移除节点，保证零残留
function destroy() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  boundHandlers.forEach(function (h) {
    h.target.removeEventListener(h.type, h.fn);
  });
  boundHandlers = [];
  UI.destroy();
  if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  canvas = null;
  g = null;
}

Work.register({
  name: 'snake',
  mount: mount,
  destroy: destroy
});

