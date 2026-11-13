/**
 * 复古思维导图 · 自适应布局引擎
 * 不依赖 JSON 中的固定 gaps：按节点实测尺寸比例推算间距
 * 连线颜色/线宽/虚线/透明度均可在 JSON 中配置
 */
(function (global) {
  'use strict';

  // ---------- 间距比例（相对节点实测尺寸，非像素硬编码） ----------
  // 布局时由 measure 结果 × 比例 clamp 得出实际像素间距
  var GAP_RATIO = {
    leaf:        0.38,   // 同级叶子垂直间距 ≈ 叶子高 × 此值
    deepV:       0.28,   // 深层级垂直间距
    branchLeaf:  0.42,   // 分支 ↔ 叶子间距 ≈ 平均宽 × 此值
    deepH:       0.28,   // 深层级水平间距
    branchRow:   0.55,   // down 模式列间距 ≈ 列宽 × 此值
    branchCol:   0.48,   // radial/right 分支块间距 ≈ 分支高 × 此值
    centerBranch:0.36,   // 中心 ↔ 分支 ≈ 中心直径 × 此值
    pad:         0.32,   // 画布内边距 ≈ 中心直径 × 此值
    insightGap:  0.45    // 洞察条间距 ≈ 洞察高 × 此值
  };

  // 比例推算后的像素上下限，防止极端内容导致间距过密/过疏
  var GAP_CLAMP = {
    leaf:         { min: 8,  max: 22 },
    deepV:        { min: 5,  max: 16 },
    branchLeaf:   { min: 16, max: 48 },
    deepH:        { min: 10, max: 32 },
    branchRow:    { min: 24, max: 64 },
    branchCol:    { min: 18, max: 48 },
    centerBranch: { min: 32, max: 80 },
    pad:          { min: 32, max: 72 },
    insightGap:   { min: 10, max: 28 }
  };

  // 无节点可测时的兜底（首次 applyConfig 前）
  var FALLBACK_GAPS = {
    leaf: 12, deepV: 8, branchLeaf: 28, deepH: 18,
    branchRow: 42, branchCol: 30, centerBranch: 55, pad: 48, insightGap: 16
  };

  var DEFAULT_LINE = {
    center:  { width: 2.2, dash: '7 6', opacity: 0.55 },
    branch:  { width: 1.5, dash: '5 4', opacity: 0.45 },
    level2:  { width: 1.2, dash: '4 4', opacity: 0.35 },
    deep:    { width: 1.0, dash: '3 3', opacity: 0.25 }
  };

  var svgNS = 'http://www.w3.org/2000/svg';

  // ---------- 工具 ----------
  function merge(a, b) {
    var o = {};
    var k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = a[k];
    if (b) for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) o[k] = b[k];
    return o;
  }

  function deepMerge(base, over) {
    var out = merge({}, base);
    if (!over) return out;
    for (var k in over) {
      if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) &&
          base[k] && typeof base[k] === 'object') {
        out[k] = merge(base[k], over[k]);
      } else {
        out[k] = over[k];
      }
    }
    return out;
  }

  function uidFactory() {
    var n = 0;
    return function () { return 'n' + (++n); };
  }

  // ---------- MindMap 类 ----------
  function MindMap(opts) {
    this.stage = typeof opts.stage === 'string'
      ? document.getElementById(opts.stage)
      : opts.stage;
    this.titleEl = opts.titleEl ? document.getElementById(opts.titleEl) : null;
    this.subtitleEl = opts.subtitleEl ? document.getElementById(opts.subtitleEl) : null;
    this.selectEl = opts.selectEl ? document.getElementById(opts.selectEl) : null;

    this.svg = null;
    this.centerEl = null;
    this.edgeList = [];
    this.currentData = null;
    this.breathRAF = null;
    this.uid = uidFactory();
    this.gaps = merge({}, FALLBACK_GAPS);
    this.lineStyle = DEFAULT_LINE;
    this.SW = 0;
    this.SH = 0;
    this.CX = 0;
    this.CY = 0;

    // ---- 缩放 / 平移状态 ----
    this.zoom = 1;
    this.ZOOM_MIN = 0.2;
    this.ZOOM_MAX = 3;
    this.viewport = opts.viewport ? (typeof opts.viewport === 'string'
      ? document.getElementById(opts.viewport) : opts.viewport) : null;
    this.zoomBox = this.stage ? this.stage.parentElement : null;
    this.zoomPctEl = opts.zoomPct ? document.getElementById(opts.zoomPct) : null;
    this._pinch = null;
    this._pan = null;
    this._drag = null;
    this._initZoom();
  }

  // ---- 公开 API ----
  MindMap.prototype.load = function (nameOrData) {
    var self = this;
    this.clear();

    if (nameOrData && typeof nameOrData === 'object') {
      this.currentData = nameOrData;
      this.render(nameOrData);
      requestAnimationFrame(function () { if (self._mobile()) self.autoFit(); });
      return Promise.resolve(nameOrData);
    }

    var name = nameOrData || 'think';
    var url = name.indexOf('.json') >= 0 ? name : name + '.json';

    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        self.currentData = data;
        self.render(data);
        requestAnimationFrame(function () { if (self._mobile()) self.autoFit(); });
        return data;
      })
      .catch(function (err) {
        self.showError('无法加载: ' + url + ' (' + (err && err.message || err) + ')');
        throw err;
      });
  };

  MindMap.prototype.clear = function () {
    while (this.stage.firstChild) this.stage.removeChild(this.stage.firstChild);
    this.stopBreath();
    this.edgeList = [];
    this.svg = null;
    this.centerEl = null;
    this.uid = uidFactory();
  };

  MindMap.prototype.showError = function (msg) {
    this.stage.innerHTML =
      '<div style="padding:60px;text-align:center;color:#a0522d;font-size:1.2rem;">⚠️ ' +
      msg + '</div>';
  };

  // ============================================================
  // 缩放 / 平移
  // 画布通过 .stage 的 transform: scale() 缩放；外层 .stage-zoom 负责撑开滚动范围。
  // 缩放以“光标/触点中心”为锚点：先按旧缩放换算锚点的画布坐标，
  // 再用新缩放重算滚动位置，使该点在视口中保持不动。
  // ============================================================

  MindMap.prototype._mobile = function () {
    return window.matchMedia('(max-width: 900px)').matches;
  };

  MindMap.prototype._initZoom = function () {
    var self = this;
    if (!this.viewport || !this.zoomBox) return;
    this.viewport.addEventListener('wheel', function (e) { self._onWheel(e); }, { passive: false });
    this.viewport.addEventListener('touchstart', function (e) { self._onTouchStart(e); }, { passive: false });
    this.viewport.addEventListener('touchmove', function (e) { self._onTouchMove(e); }, { passive: false });
    this.viewport.addEventListener('touchend', function (e) { self._onTouchEnd(e); }, false);
    this.viewport.addEventListener('touchcancel', function (e) { self._onTouchEnd(e); }, false);
    this.viewport.addEventListener('mousedown', function (e) { self._onMouseDown(e); }, false);
    window.addEventListener('mousemove', function (e) { self._onMouseMove(e); }, false);
    window.addEventListener('mouseup', function (e) { self._onMouseUp(e); }, false);
  };

  MindMap.prototype._updateZoomLabel = function () {
    if (this.zoomPctEl) this.zoomPctEl.textContent = Math.round(this.zoom * 100) + '%';
  };

  /** 依据当前缩放重算滚动容器尺寸与变换；布局变化后调用 */
  MindMap.prototype.applyZoomWrapper = function () {
    if (!this.stage) return;
    this.stage.style.transform = 'scale(' + this.zoom + ')';
    this._updateZoomLabel();
    if (!this.zoomBox) return;
    this.zoomBox.style.width = Math.ceil(this.SW * this.zoom) + 'px';
    this.zoomBox.style.height = Math.ceil(this.SH * this.zoom) + 'px';
  };

  MindMap.prototype.setZoom = function (z, anchorX, anchorY) {
    if (z < this.ZOOM_MIN) z = this.ZOOM_MIN;
    if (z > this.ZOOM_MAX) z = this.ZOOM_MAX;
    var old = this.zoom;
    if (Math.abs(z - old) < 0.0001) return;

    var hasAnchor = (anchorX != null && anchorY != null && this.viewport);
    var sx = 0, sy = 0, rect = null;
    if (hasAnchor) {
      rect = this.viewport.getBoundingClientRect();
      sx = (this.viewport.scrollLeft + (anchorX - rect.left)) / old;
      sy = (this.viewport.scrollTop + (anchorY - rect.top)) / old;
    }

    this.zoom = z;
    this.applyZoomWrapper();

    if (hasAnchor) {
      this._clampScroll(
        sx * z - (anchorX - rect.left),
        sy * z - (anchorY - rect.top)
      );
    }
  };

  MindMap.prototype.zoomBy = function (factor, anchorX, anchorY) {
    this.setZoom(this.zoom * factor, anchorX, anchorY);
  };

  MindMap.prototype.resetZoom = function () {
    if (!this.viewport) { this.setZoom(1); return; }
    this.setZoom(1, this.viewport.clientWidth / 2, this.viewport.clientHeight / 2);
  };

  /** 小屏（≤900px）打开时缩放到适合视口宽度 */
  MindMap.prototype.autoFit = function () {
    if (!this.viewport || this.SW <= 0) return;
    var vw = this.viewport.clientWidth;
    if (vw <= 0) return;
    var target = Math.min(1, vw / this.SW);
    this.setZoom(target, vw / 2, this.viewport.clientHeight / 2);
  };

  MindMap.prototype._clampScroll = function (l, t) {
    this.viewport.scrollLeft = Math.max(0, Math.min(l, this.viewport.scrollWidth - this.viewport.clientWidth));
    this.viewport.scrollTop = Math.max(0, Math.min(t, this.viewport.scrollHeight - this.viewport.clientHeight));
  };

  MindMap.prototype._panBy = function (dx, dy) {
    this._clampScroll(this.viewport.scrollLeft - dx, this.viewport.scrollTop - dy);
  };

  // ---- 滚轮缩放（以光标为中心）----
  MindMap.prototype._onWheel = function (e) {
    e.preventDefault();
    var dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;                       // 行 → 像素
    else if (e.deltaMode === 2) dy *= this.viewport.clientHeight; // 页 → 像素
    var factor = Math.pow(1.1, -dy / 100);
    var rect = this.viewport.getBoundingClientRect();
    this.zoomBy(factor, e.clientX - rect.left, e.clientY - rect.top);
  };

  // ---- 触摸：单指拖动平移 / 双指捏合缩放 ----
  MindMap.prototype._pinchState = function (e) {
    var t0 = e.touches[0], t1 = e.touches[1];
    var dx = t1.clientX - t0.clientX, dy = t1.clientY - t0.clientY;
    return {
      dist: Math.sqrt(dx * dx + dy * dy),
      cx: (t0.clientX + t1.clientX) / 2,
      cy: (t0.clientY + t1.clientY) / 2
    };
  };

  MindMap.prototype._onTouchStart = function (e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      this._pinch = this._pinchState(e);
      this._pan = null;
    } else if (e.touches.length === 1) {
      this._pan = {
        x: e.touches[0].clientX, y: e.touches[0].clientY,
        sl: this.viewport.scrollLeft, st: this.viewport.scrollTop
      };
      this._pinch = null;
    }
  };

  MindMap.prototype._onTouchMove = function (e) {
    e.preventDefault();
    if (this._pinch && e.touches.length >= 2) {
      var p = this._pinch;
      var t0 = e.touches[0], t1 = e.touches[1];
      var dx = t1.clientX - t0.clientX, dy = t1.clientY - t0.clientY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var cx = (t0.clientX + t1.clientX) / 2;
      var cy = (t0.clientY + t1.clientY) / 2;
      if (p.dist > 0) {
        var rect = this.viewport.getBoundingClientRect();
        // 以上一次触点中心为锚点缩放，保持手指下的内容不漂移
        this.zoomBy(dist / p.dist, p.cx - rect.left, p.cy - rect.top);
      }
      // 双指整体位移 → 平移
      this._panBy(cx - p.cx, cy - p.cy);
      p.dist = dist; p.cx = cx; p.cy = cy;
    } else if (this._pan && e.touches.length === 1) {
      var t = e.touches[0];
      this._clampScroll(
        this._pan.sl - (t.clientX - this._pan.x),
        this._pan.st - (t.clientY - this._pan.y)
      );
    }
  };

  MindMap.prototype._onTouchEnd = function (e) {
    this._pinch = null;
    if (e.touches.length === 1) {
      this._pan = {
        x: e.touches[0].clientX, y: e.touches[0].clientY,
        sl: this.viewport.scrollLeft, st: this.viewport.scrollTop
      };
    } else if (!e.touches.length) {
      this._pan = null;
    }
  };

  // ---- 鼠标拖动平移 ----
  MindMap.prototype._onMouseDown = function (e) {
    if (e.button !== 0) return;
    this._drag = {
      x: e.clientX, y: e.clientY,
      sl: this.viewport.scrollLeft, st: this.viewport.scrollTop,
      moved: false
    };
    e.preventDefault();
  };

  MindMap.prototype._onMouseMove = function (e) {
    if (!this._drag) return;
    var d = this._drag;
    var dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    d.moved = true;
    this._clampScroll(d.sl - dx, d.st - dy);
  };

  MindMap.prototype._onMouseUp = function () {
    this._drag = null;
  };

  MindMap.prototype.render = function (data) {
    var self = this;
    this.applyConfig(data);
    this.buildDOM(data);

    // 双 rAF：保证浏览器完成测量布局；先按实测尺寸推算 gaps 再排布
    requestAnimationFrame(function () {
      self.computeGaps(data);
      self.layout(data);
      self.fitStage();
      requestAnimationFrame(function () {
        self.drawLines(data);
        self.startBreath();
        self.bindCenterHover();
      });
    });
  };

  MindMap.prototype.applyConfig = function (data) {
    var m = data.meta || {};
    // gaps 不读 JSON，仅在 DOM 构建后由 computeGaps 根据实测尺寸推算
    this.gaps = merge({}, FALLBACK_GAPS);
    this.lineStyle = deepMerge(DEFAULT_LINE, m.lineStyle || {});
  };

  /** 将 value 限制在 [min, max] 并四舍五入 */
  function clampGap(value, key) {
    var c = GAP_CLAMP[key] || { min: 4, max: 80 };
    var v = Math.round(value);
    if (v < c.min) return c.min;
    if (v > c.max) return c.max;
    return v;
  }

  /** 一组节点的平均宽高（忽略零尺寸） */
  MindMap.prototype.avgSize = function (nodeList) {
    var n = 0, sw = 0, sh = 0;
    for (var i = 0; i < nodeList.length; i++) {
      var m = this.measure(nodeList[i]);
      if (m.w > 0 && m.h > 0) {
        sw += m.w;
        sh += m.h;
        n++;
      }
    }
    if (!n) return { w: 120, h: 36 };
    return { w: sw / n, h: sh / n };
  };

  /**
   * 根据已构建 DOM 的实测尺寸推算间距
   * 间距 = 相关节点尺寸 × 比例，再 clamp —— 内容越大间距略松，越小略紧
   */
  MindMap.prototype.computeGaps = function (data) {
    var m = data.meta || {};
    var centerSz = (m.center && m.center.size) || 150;

    var leaves = this.stage.querySelectorAll('.leaf:not(.insight)');
    var branches = this.stage.querySelectorAll('.branch');
    var insights = this.stage.querySelectorAll('.insight');
    var deepLeaves = this.stage.querySelectorAll('.leaf.lv2, .leaf.lv3, .leaf.lv4');

    var leafAvg = this.avgSize(leaves);
    var branchAvg = this.avgSize(branches);
    var deepAvg = deepLeaves.length ? this.avgSize(deepLeaves) : leafAvg;
    var insightAvg = insights.length ? this.avgSize(insights) : { w: 200, h: 28 };

    // 水平参考：分支与叶子宽度的均值；垂直参考：叶子/分支高度
    var hRef = (branchAvg.w + leafAvg.w) / 2;
    var colRef = Math.max(branchAvg.w, leafAvg.w);

    this.gaps = {
      leaf:         clampGap(leafAvg.h * GAP_RATIO.leaf, 'leaf'),
      deepV:        clampGap(deepAvg.h * GAP_RATIO.deepV, 'deepV'),
      branchLeaf:   clampGap(hRef * GAP_RATIO.branchLeaf, 'branchLeaf'),
      deepH:        clampGap(deepAvg.w * GAP_RATIO.deepH, 'deepH'),
      branchRow:    clampGap(colRef * GAP_RATIO.branchRow, 'branchRow'),
      branchCol:    clampGap(branchAvg.h * GAP_RATIO.branchCol, 'branchCol'),
      centerBranch: clampGap(centerSz * GAP_RATIO.centerBranch, 'centerBranch'),
      pad:          clampGap(centerSz * GAP_RATIO.pad, 'pad'),
      insightGap:   clampGap(insightAvg.h * GAP_RATIO.insightGap, 'insightGap')
    };
    return this.gaps;
  };

  MindMap.prototype.relayout = function () {
    if (!this.currentData) return;
    this.computeGaps(this.currentData);
    this.layout(this.currentData);
    this.fitStage();
    var self = this;
    requestAnimationFrame(function () { self.drawLines(self.currentData); });
  };

  // ---- DOM 构建 ----
  MindMap.prototype.createLeafTree = function (item, groupId, color, level) {
    level = level || 1;
    var el = document.createElement('div');
    el.className = 'node leaf';
    if (level >= 2) el.classList.add('lv' + Math.min(level, 4));
    el.setAttribute('data-group', groupId);
    el.setAttribute('data-level', String(level));
    el.style.borderLeftColor = color;
    el.id = this.uid();
    if (item.bg) {
      el.style.backgroundColor = item.bg;
      el.classList.add('has-bg');
    }
    el.innerHTML =
      '<span class="l-emoji">' + (item.emoji || '') + '</span>' +
      '<span class="l-text">' + (item.text || '') + '</span>';
    this.stage.appendChild(el);

    if (item.children && item.children.length) {
      var childEls = [];
      for (var i = 0; i < item.children.length; i++) {
        childEls.push(this.createLeafTree(item.children[i], groupId, color, level + 1));
      }
      // 叶子级连线可用 item.line 覆盖
      this.edgeList.push({
        parent: el,
        children: childEls,
        color: (item.line && item.line.color) || color,
        line: item.line || null
      });
    }
    return el;
  };

  MindMap.prototype.buildDOM = function (data) {
    var m = data.meta || {};
    var self = this;

    // 初始画布：仅作测量容器，最终由 fitStage 决定
    var minW = m.stageWidth || 800;
    var minH = m.stageHeight || 600;
    this.SW = minW;
    this.SH = minH;
    this.stage.style.width = minW + 'px';
    this.stage.style.height = minH + 'px';

    var pageTitle = (m.title || '思维导图') + (m.subtitle ? ' · ' + m.subtitle : '');
    document.title = pageTitle;
    if (this.titleEl) {
      this.titleEl.textContent = (m.centerIcon || '') + ' ' + (m.title || '');
    }
    if (this.subtitleEl) {
      this.subtitleEl.textContent = m.subtitle ? ('┃ ' + m.subtitle + ' ┃') : '';
    }

    // 装饰贴纸
    (data.stickers || []).forEach(function (s) {
      var el = document.createElement('div');
      el.className = 'sticker';
      el.textContent = s.emoji || '';
      var st = [];
      if (s.top != null) st.push('top:' + s.top + 'px');
      if (s.bottom != null) st.push('bottom:' + s.bottom + 'px');
      if (s.left != null) st.push('left:' + s.left + 'px');
      if (s.right != null) st.push('right:' + s.right + 'px');
      if (s.rotate != null) st.push('transform:rotate(' + s.rotate + 'deg)');
      if (st.length) el.style.cssText = st.join(';');
      self.stage.appendChild(el);
    });

    // 中心
    var sz = (m.center && m.center.size) || 150;
    this.centerEl = document.createElement('div');
    this.centerEl.className = 'node center-node';
    this.centerEl.style.width = sz + 'px';
    this.centerEl.style.height = sz + 'px';
    this.centerEl.innerHTML =
      '<span class="c-icon">' + (m.centerIcon || '') + '</span>' +
      '<span class="c-label">' + (m.centerLabel || '') + '</span>';
    this.stage.appendChild(this.centerEl);

    // 分支 + 叶子
    (data.groups || []).forEach(function (g) {
      var br = document.createElement('div');
      br.className = 'node branch';
      br.setAttribute('data-group', g.id);
      br.id = self.uid();
      br.style.borderLeftColor = g.color || '#8b5e3c';
      if (g.bg) {
        br.style.backgroundColor = g.bg;
        br.classList.add('has-bg');
      }
      br.innerHTML =
        '<span class="b-icon">' + (g.icon || '') + '</span>' +
        '<span class="b-title">' + (g.title || '') + '</span>' +
        '<span class="b-sub">' + (g.sub || '') + '</span>';
      self.stage.appendChild(br);

      var topLeaves = [];
      (g.leaves || []).forEach(function (lf) {
        topLeaves.push(self.createLeafTree(lf, g.id, g.color || '#8b5e3c', 1));
      });
      self.edgeList.push({
        parent: br,
        children: topLeaves,
        color: (g.line && g.line.color) || g.color || '#8b5e3c',
        line: g.line || null
      });
    });

    // 洞察
    (data.insights || []).forEach(function (ins, i) {
      var el = document.createElement('div');
      el.className = 'node leaf insight';
      el.setAttribute('data-insight', String(i));
      el.innerHTML =
        '<span class="l-emoji">' + (ins.emoji || '') + '</span>' +
        '<span class="l-text">' + (ins.text || '') + '</span>';
      self.stage.appendChild(el);
    });

    // SVG 层
    this.svg = document.createElementNS(svgNS, 'svg');
    this.svg.id = 'lines-svg';
    this.svg.setAttribute('viewBox', '0 0 ' + this.SW + ' ' + this.SH);
    this.stage.insertBefore(this.svg, this.stage.firstChild);
  };

  // ---- 测量 / 放置 ----
  MindMap.prototype.measure = function (el) {
    // 节点已在 DOM 中；若尚未定位，offset 仍可用
    var w = el.offsetWidth || 100;
    var h = el.offsetHeight || 28;
    // 若宽高为 0（display 等），临时测量
    if (!w || !h) {
      var prev = el.style.cssText;
      el.style.cssText = 'visibility:hidden;position:absolute;left:0;top:0;';
      w = el.offsetWidth || 100;
      h = el.offsetHeight || 28;
      el.style.cssText = prev;
    }
    return { w: w, h: h };
  };

  MindMap.prototype.place = function (el, l, t) {
    el.style.left = Math.round(l) + 'px';
    el.style.top = Math.round(t) + 'px';
  };

  MindMap.prototype.elCenter = function (el) {
    var l = parseFloat(el.style.left) || 0;
    var t = parseFloat(el.style.top) || 0;
    return {
      x: l + (el.offsetWidth || 0) / 2,
      y: t + (el.offsetHeight || 0) / 2
    };
  };

  MindMap.prototype.resolveMode = function (data) {
    var m = (data.meta && data.meta.layoutMode) || 'radial';
    if (m !== 'radial' && m !== 'down' && m !== 'right') m = 'radial';
    return m;
  };

  MindMap.prototype.assignSide = function (group, index) {
    if (group.side === 'L' || group.side === 'R') return group.side;
    return index % 2 === 0 ? 'L' : 'R';
  };

  MindMap.prototype.findEdge = function (el) {
    for (var i = 0; i < this.edgeList.length; i++) {
      if (this.edgeList[i].parent === el) return this.edgeList[i];
    }
    return null;
  };

  MindMap.prototype.getBranchEdges = function () {
    return this.edgeList.filter(function (e) {
      return e.parent.classList.contains('branch');
    });
  };

  MindMap.prototype.getBranchEdge = function (groupId) {
    var be = this.getBranchEdges();
    for (var k = 0; k < be.length; k++) {
      if (be[k].parent.getAttribute('data-group') === groupId) return be[k];
    }
    return null;
  };

  // ---- 子树尺寸（自适应核心） ----
  /**
   * 子树高度
   * left/right: max(自身, 子树堆叠高)
   * down: 自身 + gap + 子树堆叠高
   */
  MindMap.prototype.subtreeHeight = function (el, level, direction) {
    level = level || 1;
    direction = direction || 'right';
    var m = this.measure(el);
    var edge = this.findEdge(el);
    if (!edge || !edge.children.length) return m.h;

    var vGap = level <= 1 ? this.gaps.leaf : this.gaps.deepV;
    var total = 0;
    for (var i = 0; i < edge.children.length; i++) {
      total += this.subtreeHeight(edge.children[i], level + 1, direction);
      if (i < edge.children.length - 1) total += vGap;
    }
    if (direction === 'down') return m.h + vGap + total;
    return Math.max(m.h, total);
  };

  /**
   * 子树宽度
   * left/right: 自身 + gap + 最宽子列
   * down: max(自身, 最宽子节点)
   */
  MindMap.prototype.subtreeWidth = function (el, level, direction) {
    level = level || 1;
    direction = direction || 'right';
    var m = this.measure(el);
    var edge = this.findEdge(el);
    if (!edge || !edge.children.length) return m.w;

    var hGap = level <= 1 ? this.gaps.branchLeaf : this.gaps.deepH;
    var maxChild = 0;
    for (var i = 0; i < edge.children.length; i++) {
      var w = this.subtreeWidth(edge.children[i], level + 1, direction);
      if (w > maxChild) maxChild = w;
    }
    if (direction === 'down') return Math.max(m.w, maxChild);
    return m.w + hGap + maxChild;
  };

  /** down 模式：一列最大宽度 */
  MindMap.prototype.columnWidth = function (el) {
    var m = this.measure(el);
    var maxW = m.w;
    var edge = this.findEdge(el);
    if (edge) {
      for (var i = 0; i < edge.children.length; i++) {
        var w = this.columnWidth(edge.children[i]);
        if (w > maxW) maxW = w;
      }
    }
    return maxW;
  };

  // ---- 递归放置叶子树 ----
  MindMap.prototype.layoutLeafTree = function (leafEl, cx, cy, direction, level) {
    level = level || 1;
    var m = this.measure(leafEl);
    this.place(leafEl, cx - m.w / 2, cy - m.h / 2);

    var edge = this.findEdge(leafEl);
    if (!edge || !edge.children.length) return;

    var children = edge.children;
    var vGap = level <= 1 ? this.gaps.leaf : this.gaps.deepV;
    var hGap = level <= 1 ? this.gaps.branchLeaf : this.gaps.deepH;
    var self = this;
    var heights = children.map(function (c) {
      return self.subtreeHeight(c, level + 1, direction);
    });
    var totalH = heights.reduce(function (s, z) { return s + z; }, 0) +
      (children.length - 1) * vGap;

    var pc = this.elCenter(leafEl);
    var pw = leafEl.offsetWidth || 0;
    var ph = leafEl.offsetHeight || 0;

    if (direction === 'down') {
      var curY = pc.y + ph / 2 + vGap;
      for (var i = 0; i < children.length; i++) {
        var cm = this.measure(children[i]);
        this.layoutLeafTree(children[i], cx, curY + cm.h / 2, 'down', level + 1);
        curY += heights[i] + vGap;
      }
    } else {
      var childEdgeX = direction === 'left'
        ? pc.x - pw / 2 - hGap
        : pc.x + pw / 2 + hGap;
      var curY2 = cy - totalH / 2;
      for (var j = 0; j < children.length; j++) {
        var cm2 = this.measure(children[j]);
        var childCX = direction === 'left'
          ? childEdgeX - cm2.w / 2
          : childEdgeX + cm2.w / 2;
        var childCY = curY2 + heights[j] / 2;
        this.layoutLeafTree(children[j], childCX, childCY, direction, level + 1);
        curY2 += heights[j] + vGap;
      }
    }
  };

  // ---- 布局分发 ----
  MindMap.prototype.layout = function (data) {
    var mode = this.resolveMode(data);
    if (mode === 'down') return this.layoutDown(data);
    if (mode === 'right') return this.layoutRight(data);
    return this.layoutRadial(data);
  };

  // ---- 放射布局：左右自适应，中心居中 ----
  MindMap.prototype.layoutRadial = function (data) {
    var self = this;
    var gaps = this.gaps;
    var sz = (data.meta.center && data.meta.center.size) || 150;
    var groups = data.groups || [];

    // 1) 计算每个分支块尺寸
    var branchInfo = [];
    groups.forEach(function (def, idx) {
      var bEdge = self.getBranchEdge(def.id);
      if (!bEdge) return;
      var bm = self.measure(bEdge.parent);
      var leaves = bEdge.children;
      var side = self.assignSide(def, idx);
      var leafHeights = leaves.map(function (lf) {
        return self.subtreeHeight(lf, 1, side === 'L' ? 'left' : 'right');
      });
      var leavesTotal = leafHeights.reduce(function (s, z) { return s + z; }, 0);
      if (leaves.length > 1) leavesTotal += (leaves.length - 1) * gaps.leaf;

      // 叶子向外延伸的宽度
      var leafWidths = leaves.map(function (lf) {
        return self.subtreeWidth(lf, 1, side === 'L' ? 'left' : 'right');
      });
      var maxLeafW = leafWidths.length
        ? Math.max.apply(null, leafWidths)
        : 0;

      var blockH = Math.max(bm.h + gaps.leaf * 2, leavesTotal);
      branchInfo.push({
        def: def, bEdge: bEdge, bm: bm,
        leafHeights: leafHeights, leavesTotal: leavesTotal,
        blockH: blockH, side: side, maxLeafW: maxLeafW
      });
    });

    var lefts = branchInfo.filter(function (b) { return b.side === 'L'; });
    var rights = branchInfo.filter(function (b) { return b.side === 'R'; });

    function sideExtent(branches) {
      if (!branches.length) return { h: 0, w: 0 };
      var h = branches.reduce(function (s, b) { return s + b.blockH; }, 0) +
        (branches.length - 1) * gaps.branchCol;
      var w = 0;
      for (var i = 0; i < branches.length; i++) {
        var bi = branches[i];
        // 分支自身 + 间距 + 叶子子树
        var ext = bi.bm.w + gaps.branchLeaf + bi.maxLeafW;
        if (ext > w) w = ext;
      }
      return { h: h, w: w };
    }

    var L = sideExtent(lefts);
    var R = sideExtent(rights);

    // 2) 根据内容推算画布与中心
    var contentW = L.w + gaps.centerBranch + sz + gaps.centerBranch + R.w;
    var contentH = Math.max(L.h, R.h, sz);
    var pad = gaps.pad;

    // 洞察高度预留
    var insights = this.stage.querySelectorAll('.insight');
    var insightH = 0;
    if (insights.length) {
      var ih = 0;
      for (var ii = 0; ii < insights.length; ii++) {
        ih += this.measure(insights[ii]).h;
        if (ii < insights.length - 1) ih += gaps.insightGap;
      }
      insightH = ih + pad;
    }

    this.SW = Math.ceil(contentW + pad * 2);
    this.SH = Math.ceil(contentH + pad * 2 + insightH + 20);
    // 尊重 JSON 中的最小尺寸
    if (data.meta.stageWidth) this.SW = Math.max(this.SW, data.meta.stageWidth);
    if (data.meta.stageHeight) this.SH = Math.max(this.SH, data.meta.stageHeight);

    this.stage.style.width = this.SW + 'px';
    this.stage.style.height = this.SH + 'px';

    // 中心 X：左侧重 + 中心半径；Y：内容垂直居中（洞察在底部）
    this.CX = pad + L.w + gaps.centerBranch + sz / 2;
    this.CY = pad + contentH / 2;

    // 3) 放置两侧
    function layoutSide(branches, side) {
      if (!branches.length) return;
      var totalBlock = branches.reduce(function (s, b) { return s + b.blockH; }, 0) +
        (branches.length - 1) * gaps.branchCol;
      var top = self.CY - totalBlock / 2;
      for (var i = 0; i < branches.length; i++) {
        var bi = branches[i];
        var branchCY = top + bi.blockH / 2;
        var branchX = side === 'L'
          ? self.CX - sz / 2 - gaps.centerBranch - bi.bm.w / 2
          : self.CX + sz / 2 + gaps.centerBranch + bi.bm.w / 2;

        self.place(bi.bEdge.parent, branchX - bi.bm.w / 2, branchCY - bi.bm.h / 2);

        var curY = branchCY - bi.leavesTotal / 2;
        var dir = side === 'L' ? 'left' : 'right';
        for (var j = 0; j < bi.bEdge.children.length; j++) {
          var leaf = bi.bEdge.children[j];
          var lm = self.measure(leaf);
          var lcx = dir === 'left'
            ? branchX - bi.bm.w / 2 - gaps.branchLeaf - lm.w / 2
            : branchX + bi.bm.w / 2 + gaps.branchLeaf + lm.w / 2;
          self.layoutLeafTree(leaf, lcx, curY + bi.leafHeights[j] / 2, dir, 1);
          curY += bi.leafHeights[j] + gaps.leaf;
        }
        top += bi.blockH + gaps.branchCol;
      }
    }

    layoutSide(lefts, 'L');
    layoutSide(rights, 'R');
    this.place(this.centerEl, this.CX - sz / 2, this.CY - sz / 2);

    // 洞察放底部居中
    var insightY = this.SH - pad - insightH + gaps.insightGap;
    // 重新量洞察高度定位
    var iy = this.SH - pad;
    for (var k = insights.length - 1; k >= 0; k--) {
      var im = this.measure(insights[k]);
      iy -= im.h;
      this.place(insights[k], this.CX - im.w / 2, iy);
      iy -= gaps.insightGap;
    }

    if (this.svg) this.svg.setAttribute('viewBox', '0 0 ' + this.SW + ' ' + this.SH);
  };

  // ---- 纵向布局：中心在上，分支横向自适应 ----
  MindMap.prototype.layoutDown = function (data) {
    var self = this;
    var gaps = this.gaps;
    var sz = (data.meta.center && data.meta.center.size) || 150;
    var groups = data.groups || [];

    var ordered = [];
    groups.forEach(function (def) {
      var bEdge = self.getBranchEdge(def.id);
      if (bEdge) ordered.push({ def: def, edge: bEdge, bm: self.measure(bEdge.parent) });
    });

    // 每列宽度 = max(分支宽, 叶子列宽)
    var colWidths = ordered.map(function (bi) {
      var lvs = bi.edge.children;
      var maxLeafW = 0;
      for (var i = 0; i < lvs.length; i++) {
        var w = self.columnWidth(lvs[i]);
        if (w > maxLeafW) maxLeafW = w;
      }
      return Math.max(bi.bm.w, maxLeafW);
    });

    // 每列高度（分支 + 叶子向下）
    var colHeights = ordered.map(function (bi) {
      var lvs = bi.edge.children;
      if (!lvs.length) return bi.bm.h;
      var h = 0;
      for (var i = 0; i < lvs.length; i++) {
        h += self.subtreeHeight(lvs[i], 1, 'down');
        if (i < lvs.length - 1) h += gaps.leaf;
      }
      return bi.bm.h + gaps.branchLeaf + h;
    });

    var totalW = colWidths.reduce(function (s, z) { return s + z; }, 0) +
      Math.max(0, ordered.length - 1) * gaps.branchRow;
    var maxColH = colHeights.length ? Math.max.apply(null, colHeights) : 0;

    var insights = this.stage.querySelectorAll('.insight');
    var insightH = 0;
    if (insights.length) {
      for (var ii = 0; ii < insights.length; ii++) {
        insightH += this.measure(insights[ii]).h;
        if (ii < insights.length - 1) insightH += gaps.insightGap;
      }
      insightH += gaps.pad;
    }

    var pad = gaps.pad;
    var contentH = sz + gaps.centerBranch + maxColH;
    this.SW = Math.ceil(Math.max(totalW, sz) + pad * 2);
    this.SH = Math.ceil(contentH + pad * 2 + insightH);
    if (data.meta.stageWidth) this.SW = Math.max(this.SW, data.meta.stageWidth);
    if (data.meta.stageHeight) this.SH = Math.max(this.SH, data.meta.stageHeight);

    this.stage.style.width = this.SW + 'px';
    this.stage.style.height = this.SH + 'px';

    this.CX = this.SW / 2;
    this.CY = pad + sz / 2;

    var branchY = this.CY + sz / 2 + gaps.centerBranch;
    var curX = this.CX - totalW / 2;

    for (var i = 0; i < ordered.length; i++) {
      var bi = ordered[i];
      var colW = colWidths[i];
      var branchCX = curX + colW / 2;
      this.place(bi.edge.parent, branchCX - bi.bm.w / 2, branchY - bi.bm.h / 2);

      var leaves = bi.edge.children;
      if (leaves.length) {
        var heights = leaves.map(function (lf) {
          return self.subtreeHeight(lf, 1, 'down');
        });
        var leafStartY = branchY + bi.bm.h / 2 + gaps.branchLeaf;
        for (var j = 0; j < leaves.length; j++) {
          var lm = this.measure(leaves[j]);
          this.layoutLeafTree(leaves[j], branchCX, leafStartY + lm.h / 2, 'down', 1);
          leafStartY += heights[j] + gaps.leaf;
        }
      }
      curX += colW + gaps.branchRow;
    }

    this.place(this.centerEl, this.CX - sz / 2, this.CY - sz / 2);

    // 洞察底部
    var iy = this.SH - pad;
    for (var k = insights.length - 1; k >= 0; k--) {
      var im = this.measure(insights[k]);
      iy -= im.h;
      this.place(insights[k], this.CX - im.w / 2, iy);
      iy -= gaps.insightGap;
    }

    if (this.svg) this.svg.setAttribute('viewBox', '0 0 ' + this.SW + ' ' + this.SH);
  };

  // ---- 横向布局：中心在左，分支纵向自适应 ----
  MindMap.prototype.layoutRight = function (data) {
    var self = this;
    var gaps = this.gaps;
    var sz = (data.meta.center && data.meta.center.size) || 150;
    var groups = data.groups || [];

    var ordered = [];
    groups.forEach(function (def) {
      var bEdge = self.getBranchEdge(def.id);
      if (bEdge) ordered.push({ def: def, edge: bEdge, bm: self.measure(bEdge.parent) });
    });

    var blockHeights = ordered.map(function (bi) {
      var lvs = bi.edge.children;
      if (!lvs.length) return bi.bm.h;
      var lh = lvs.map(function (lf) { return self.subtreeHeight(lf, 1, 'right'); });
      var lTotal = lh.reduce(function (s, z) { return s + z; }, 0) +
        (lvs.length - 1) * gaps.leaf;
      return Math.max(bi.bm.h, lTotal);
    });

    // 每分支向外延伸宽度
    var branchExtents = ordered.map(function (bi) {
      var lvs = bi.edge.children;
      var maxLeafW = 0;
      for (var i = 0; i < lvs.length; i++) {
        var w = self.subtreeWidth(lvs[i], 1, 'right');
        if (w > maxLeafW) maxLeafW = w;
      }
      return bi.bm.w + gaps.branchLeaf + maxLeafW;
    });

    var totalH = blockHeights.reduce(function (s, z) { return s + z; }, 0) +
      Math.max(0, ordered.length - 1) * gaps.branchCol;
    var maxExt = branchExtents.length ? Math.max.apply(null, branchExtents) : 0;

    var insights = this.stage.querySelectorAll('.insight');
    var insightBlockW = 0;
    var insightBlockH = 0;
    for (var ii = 0; ii < insights.length; ii++) {
      var im0 = this.measure(insights[ii]);
      if (im0.w > insightBlockW) insightBlockW = im0.w;
      insightBlockH += im0.h;
      if (ii < insights.length - 1) insightBlockH += gaps.insightGap;
    }

    var pad = gaps.pad;
    this.SW = Math.ceil(sz + gaps.centerBranch + maxExt + pad * 2 +
      (insightBlockW ? insightBlockW + pad : 0));
    this.SH = Math.ceil(Math.max(totalH, sz, insightBlockH) + pad * 2);
    if (data.meta.stageWidth) this.SW = Math.max(this.SW, data.meta.stageWidth);
    if (data.meta.stageHeight) this.SH = Math.max(this.SH, data.meta.stageHeight);

    this.stage.style.width = this.SW + 'px';
    this.stage.style.height = this.SH + 'px';

    this.CX = pad + sz / 2;
    this.CY = this.SH / 2;

    var curY = this.CY - totalH / 2;
    for (var i = 0; i < ordered.length; i++) {
      var bi = ordered[i];
      var myBlockH = blockHeights[i];
      var branchCY = curY + myBlockH / 2;
      var branchX = this.CX + sz / 2 + gaps.centerBranch + bi.bm.w / 2;
      this.place(bi.edge.parent, branchX - bi.bm.w / 2, branchCY - bi.bm.h / 2);

      var leaves = bi.edge.children;
      if (leaves.length) {
        var heights = leaves.map(function (lf) {
          return self.subtreeHeight(lf, 1, 'right');
        });
        var leavesTotalH = heights.reduce(function (s, z) { return s + z; }, 0) +
          (leaves.length - 1) * gaps.leaf;
        var leafEdgeX = branchX + bi.bm.w / 2 + gaps.branchLeaf;
        var leafCurY = branchCY - leavesTotalH / 2;
        for (var j = 0; j < leaves.length; j++) {
          var lm = this.measure(leaves[j]);
          // leafEdgeX 是叶子左缘，中心 = 左缘 + 半宽
          this.layoutLeafTree(leaves[j], leafEdgeX + lm.w / 2, leafCurY + heights[j] / 2, 'right', 1);
          leafCurY += heights[j] + gaps.leaf;
        }
      }
      curY += myBlockH + gaps.branchCol;
    }

    this.place(this.centerEl, this.CX - sz / 2, this.CY - sz / 2);

    // 洞察放右上角
    var iy = pad;
    for (var k = 0; k < insights.length; k++) {
      var im = this.measure(insights[k]);
      this.place(insights[k], this.SW - pad - im.w, iy);
      iy += im.h + gaps.insightGap;
    }

    if (this.svg) this.svg.setAttribute('viewBox', '0 0 ' + this.SW + ' ' + this.SH);
  };

  // ---- 画布自适应：根据节点包围盒扩展/平移 ----
  MindMap.prototype.fitStage = function () {
    var nodes = this.stage.querySelectorAll('.node');
    if (!nodes.length) return;

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var l = parseFloat(el.style.left) || 0;
      var t = parseFloat(el.style.top) || 0;
      var w = el.offsetWidth || 0;
      var h = el.offsetHeight || 0;
      if (l < minX) minX = l;
      if (t < minY) minY = t;
      if (l + w > maxX) maxX = l + w;
      if (t + h > maxY) maxY = t + h;
    }

    var pad = this.gaps.pad;
    var shiftX = minX < pad ? Math.ceil(pad - minX) : 0;
    var shiftY = minY < pad ? Math.ceil(pad - minY) : 0;

    if (shiftX || shiftY) {
      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j];
        this.place(
          n,
          (parseFloat(n.style.left) || 0) + shiftX,
          (parseFloat(n.style.top) || 0) + shiftY
        );
      }
      this.CX += shiftX;
      this.CY += shiftY;
      maxX += shiftX;
      maxY += shiftY;
    }

    var newW = Math.ceil(Math.max(this.SW, maxX + pad));
    var newH = Math.ceil(Math.max(this.SH, maxY + pad));

    if (newW !== this.SW || newH !== this.SH || shiftX || shiftY) {
      this.SW = newW;
      this.SH = newH;
      this.stage.style.width = this.SW + 'px';
      this.stage.style.height = this.SH + 'px';
      if (this.svg) this.svg.setAttribute('viewBox', '0 0 ' + this.SW + ' ' + this.SH);
    }
    this.applyZoomWrapper();
  };

  // ---- 连线样式解析 ----
  /**
   * 优先级：节点 edge.line > group.line > meta.lineStyle[level] > 默认
   * color 优先 edge.color（已含 group 色）
   */
  MindMap.prototype.resolveLineStyle = function (level, edge) {
    var ls = this.lineStyle;
    var base;
    if (level <= 0) base = ls.center;
    else if (level === 1) base = ls.branch;
    else if (level === 2) base = ls.level2;
    else base = ls.deep;

    var style = merge({
      width: base.width,
      dash: base.dash,
      opacity: base.opacity,
      color: null
    }, base);

    if (edge && edge.line) {
      style = merge(style, edge.line);
    }
    if (edge && edge.color && !style.color) {
      style.color = edge.color;
    }
    return style;
  };

  // ---- SVG 连线 ----
  MindMap.prototype.drawLines = function (data) {
    if (!this.svg || !this.centerEl) return;
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);

    var self = this;
    var mode = this.resolveMode(data);
    var cPos = this.elCenter(this.centerEl);
    var centerW = this.centerEl.offsetWidth || 0;
    var centerH = this.centerEl.offsetHeight || 0;
    var cLeft = cPos.x - centerW / 2;
    var cRight = cPos.x + centerW / 2;
    var cBottom = cPos.y + centerH / 2;
    var cRadius = centerW / 2; // 中心圆半径（假设宽高相等）

    /**
     * 画贝塞尔连线
     * style.fan === true 时：从中心向外发散，控制点沿径向展开
     */
    function curve(from, to, style) {
      var dx = to.x - from.x, dy = to.y - from.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 2) return;
      var d;
      if (style && style.fan) {
        // 发散曲线：起点沿径向延伸，终点垂直接入
        var t1 = 0.38, t2 = 0.62;
        var c1x = from.x + dx * t1;
        var c1y = from.y + dy * t1;
        // 第二控制点偏向目标 X，保持垂直抵达感
        var c2x = from.x + dx * t2 + (to.x - from.x) * 0.12;
        var c2y = to.y - Math.abs(dy) * 0.28;
        d = 'M' + from.x + ',' + from.y +
          ' C' + c1x + ',' + c1y + ' ' + c2x + ',' + c2y + ' ' + to.x + ',' + to.y;
      } else {
        var midX = (from.x + to.x) / 2;
        var midY = (from.y + to.y) / 2;
        if (Math.abs(dx) > Math.abs(dy)) {
          d = 'M' + from.x + ',' + from.y +
            ' C' + midX + ',' + from.y + ' ' + midX + ',' + to.y + ' ' + to.x + ',' + to.y;
        } else {
          d = 'M' + from.x + ',' + from.y +
            ' C' + from.x + ',' + midY + ' ' + to.x + ',' + midY + ' ' + to.x + ',' + to.y;
        }
      }
      var p = document.createElementNS(svgNS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('stroke', style.color || '#c4a87c');
      p.setAttribute('stroke-width', String(style.width != null ? style.width : 2));
      p.setAttribute('fill', 'none');
      if (style.dash && style.dash !== 'none' && style.dash !== 'solid') {
        p.setAttribute('stroke-dasharray', style.dash);
      }
      p.setAttribute('opacity', String(style.opacity != null ? style.opacity : 0.5));
      p.setAttribute('stroke-linecap', style.linecap || 'round');
      if (style.linejoin) p.setAttribute('stroke-linejoin', style.linejoin);
      self.svg.appendChild(p);
    }

    // 中心 → 分支
    var branchEdges = this.getBranchEdges();
    var groups = data.groups || [];
    for (var i = 0; i < groups.length; i++) {
      var def = groups[i];
      var bEdge = this.getBranchEdge(def.id);
      if (!bEdge) continue;

      var bPos = this.elCenter(bEdge.parent);
      var bw = bEdge.parent.offsetWidth || 0;
      var bh = bEdge.parent.offsetHeight || 0;
      var from, to;

      if (mode === 'down') {
        // 发散感：起点沿中心圆底弧分布，分支越靠两侧角度越大
        var bTopY = bPos.y - bh / 2;
        var rawDx = bPos.x - cPos.x;
        var rawDy = bTopY - cPos.y;
        var maxSpread = 0.87; // ≈50° 倾角，防止起点滑出底部范围
        var rawAngle = Math.atan2(rawDx, rawDy);
        var angle = Math.max(-maxSpread, Math.min(maxSpread, rawAngle));
        from = {
          x: cPos.x + Math.sin(angle) * cRadius,
          y: cPos.y + Math.cos(angle) * cRadius
        };
        to = { x: bPos.x, y: bTopY };
      } else if (mode === 'right') {
        from = { x: cRight, y: cPos.y };
        to = { x: bPos.x - bw / 2, y: bPos.y };
      } else {
        var side = this.assignSide(def, i);
        if (side === 'L') {
          from = { x: cLeft, y: cPos.y };
          to = { x: bPos.x + bw / 2, y: bPos.y };
        } else {
          from = { x: cRight, y: cPos.y };
          to = { x: bPos.x - bw / 2, y: bPos.y };
        }
      }

      // center 级默认用 lineStyle.center，颜色取 group；down 模式启用发散曲线
      var centerBase = merge(this.lineStyle.center, def.line || {});
      centerBase.color = (def.line && def.line.color) || def.color || centerBase.color || '#c4a87c';
      if (mode === 'down') centerBase.fan = true;
      curve(from, to, centerBase);
    }

    // 递归：父 → 子
    function drawEdge(edge, level, direction) {
      level = level || 1;
      var style = self.resolveLineStyle(level, edge);

      edge.children.forEach(function (child) {
        var pPos = self.elCenter(edge.parent);
        var chPos = self.elCenter(child);
        var pw = edge.parent.offsetWidth || 0;
        var ph = edge.parent.offsetHeight || 0;
        var cw = child.offsetWidth || 0;
        var ch = child.offsetHeight || 0;
        var from2, to2;

        if (direction === 'down') {
          from2 = { x: pPos.x, y: pPos.y + ph / 2 };
          to2 = { x: chPos.x, y: chPos.y - ch / 2 };
        } else if (direction === 'left') {
          from2 = { x: pPos.x - pw / 2, y: pPos.y };
          to2 = { x: chPos.x + cw / 2, y: chPos.y };
        } else {
          from2 = { x: pPos.x + pw / 2, y: pPos.y };
          to2 = { x: chPos.x - cw / 2, y: chPos.y };
        }
        curve(from2, to2, style);

        var sub = self.findEdge(child);
        if (sub) drawEdge(sub, level + 1, direction);
      });
    }

    if (mode === 'radial') {
      branchEdges.forEach(function (e) {
        var gId = e.parent.getAttribute('data-group');
        var gDef = null, gIdx = 0;
        for (var gi = 0; gi < groups.length; gi++) {
          if (groups[gi].id === gId) { gDef = groups[gi]; gIdx = gi; break; }
        }
        var s = gDef ? self.assignSide(gDef, gIdx) : 'R';
        drawEdge(e, 1, s === 'L' ? 'left' : 'right');
      });
    } else {
      var dir = mode === 'down' ? 'down' : 'right';
      branchEdges.forEach(function (e) { drawEdge(e, 1, dir); });
    }
  };

  // ---- 呼吸动画 ----
  MindMap.prototype.startBreath = function () {
    if (this.breathRAF) return;
    var self = this;
    var phase = 0;
    (function tick() {
      phase += 0.015;
      if (self.centerEl) {
        self.centerEl.style.transform = 'scale(' + (1 + Math.sin(phase) * 0.028) + ')';
      }
      self.breathRAF = requestAnimationFrame(tick);
    })();
  };

  MindMap.prototype.stopBreath = function () {
    if (this.breathRAF) {
      cancelAnimationFrame(this.breathRAF);
      this.breathRAF = null;
    }
  };

  MindMap.prototype.bindCenterHover = function () {
    var self = this;
    if (!this.centerEl) return;
    this.centerEl.addEventListener('mouseenter', function () {
      self.stopBreath();
      self.centerEl.style.transform = 'scale(1.08)';
    });
    this.centerEl.addEventListener('mouseleave', function () {
      self.centerEl.style.transform = 'scale(1)';
      self.startBreath();
    });
  };

  // ---- 启动辅助 ----
  MindMap.prototype.bootFromURL = function (fallback) {
    var params = new URLSearchParams(location.search);
    var theme = params.get('data') || fallback || 'think';
    if (this.selectEl) this.selectEl.value = theme;
    return this.load(theme);
  };

  MindMap.prototype.connectSSE = function () {
    var self = this;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

    (function connect() {
      var es = new EventSource('/sse');
      es.addEventListener('message', function (e) {
        try {
          var msg = JSON.parse(e.data);
          if (msg.type === 'data-changed' && msg.data) {
            // 若推送带 file，且与当前主题不符则忽略
            if (msg.file) {
              var cur = new URLSearchParams(location.search).get('data') || 'think';
              var base = msg.file.replace(/\.json$/, '');
              if (base !== cur && msg.file !== cur) return;
            }
            self.currentData = msg.data;
            self.clear();
            self.render(msg.data);
          }
        } catch (_) { /* ignore */ }
      });
      es.onerror = function () {
        es.close();
        setTimeout(connect, 5000);
      };
    })();
  };

  // ---------- 页面入口 ----------
  function boot() {
    var mm = new MindMap({
      stage: 'stage',
      titleEl: 'main-title',
      subtitleEl: 'main-subtitle',
      viewport: 'stage-wrap',
      zoomPct: 'zoom-pct'
    });

    global.mindmap = mm;

    global.switchTheme = function (name) {
      var url = new URL(location.href);
      url.searchParams.set('data', name);
      history.replaceState(null, '', url);
      mm.load(name);
    };

    // 缩放按钮：以视口中心为锚点
    function centerAnchor() {
      return [mm.viewport.clientWidth / 2, mm.viewport.clientHeight / 2];
    }
    var zin = document.getElementById('zoom-in');
    var zout = document.getElementById('zoom-out');
    var zreset = document.getElementById('zoom-reset');
    if (zin) zin.addEventListener('click', function () {
      var a = centerAnchor(); mm.zoomBy(1.2, a[0], a[1]);
    });
    if (zout) zout.addEventListener('click', function () {
      var a = centerAnchor(); mm.zoomBy(1 / 1.2, a[0], a[1]);
    });
    if (zreset) zreset.addEventListener('click', function () { mm.resetZoom(); });

    mm.bootFromURL('think');
    mm.connectSSE();

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { mm.relayout(); }, 150);
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // DOM 可能已就绪
    if (document.getElementById('stage')) boot();
    else document.addEventListener('DOMContentLoaded', boot);
  } else {
    window.addEventListener('load', boot);
  }

  global.MindMap = MindMap;
})(typeof window !== 'undefined' ? window : this);
