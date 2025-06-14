(function () {
  // 防止重複執行
  if (window.__soopDanmaku) return;
  window.__soopDanmaku = 1;

  const LS_KEY = 'danmakuSettings';

  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY)) || {};
    } catch (e) {
      return {};
    }
  };

  const save = () => {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ enabled, opacity, maxHeight, fontSize, bold, shadow, duration, limit, filterDup })
    );
  };

  // 插入樣式
  const style = document.createElement('style');
  style.textContent = `
    .danmaku {
      position: fixed;
      left: 100vw;
      white-space: nowrap;
      color: white;
      text-shadow: 1px 1px 3px black;
      animation: fly linear forwards;
      z-index: 999999;
      pointer-events: none;
    }
    @keyframes fly {
      from { transform: translateX(0); }
      to { transform: translateX(-110vw); }
    }
    #dm-toggle-btn {
      position: fixed;
      bottom: 52px;
      left: 12px;
      width: 28px;
      height: 28px;
      background: #333;
      border-radius: 50%;
      cursor: pointer;
      z-index: 100001;
      display: flex;
      justify-content: center;
      align-items: center;
      color: white;
      font-size: 16px;
    }
    #dm-panel {
      position: fixed;
      bottom: 88px;
      left: 10px;
      background: rgba(0,0,0,0.85);
      padding: 10px;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      z-index: 100000;
      display: none;
      width: 220px;
    }
    #dm-panel label {
      display: block;
      margin-top: 8px;
    }
    #dm-panel input[type=range] {
      width: 100%;
    }
    #dm-panel input[type=checkbox] {
      margin-right: 6px;
    }
  `;
  document.head.appendChild(style);

  // 建立按鈕與控制面板
  const btn = document.createElement('div');
  btn.id = 'dm-toggle-btn';
  btn.textContent = '⚙️';
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'dm-panel';
  panel.innerHTML = `
    <label><input type="checkbox" id="dm-enable"> 啟用彈幕</label>
    <label>透明度 <span id="dm-opacity-val"></span></label>
    <input id="dm-opacity" type="range" min="0.1" max="1" step="0.05">
    <label>最大高度% <span id="dm-maxheight-val"></span></label>
    <input id="dm-maxheight" type="range" min="10" max="100" step="5">
    <label>字體大小 <span id="dm-fontsize-val"></span></label>
    <input id="dm-fontsize" type="range" min="12" max="60" step="1">
    <label><input type="checkbox" id="dm-bold"> 粗體</label>
    <label><input type="checkbox" id="dm-shadow"> 陰影</label>
    <label>持續時間 <span id="dm-duration-val"></span></label>
    <input id="dm-duration" type="range" min="5" max="30" step="1">
    <label>過濾字數上限 <span id="dm-limit-val"></span></label>
    <input id="dm-limit" type="range" min="10" max="100" step="1">
    <label><input type="checkbox" id="dm-filterdup"> 快速排除重複</label>
  `;
  document.body.appendChild(panel);

  btn.onclick = () => {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  };

  const q = id => document.getElementById(id);
  const cfg = Object.assign({
    enabled: true,
    opacity: 0.75,
    maxHeight: 25,
    fontSize: 24,
    bold: false,
    shadow: true,
    duration: 10,
    limit: 32,
    filterDup: true,
  }, load());

  let {
    enabled, opacity, maxHeight, fontSize,
    bold, shadow, duration, limit, filterDup
  } = cfg;

  let lastMsgs = [], trackEndTime = [], lastEmit = 0;

  const sync = () => {
    q('dm-enable').checked = enabled;
    q('dm-opacity').value = opacity;
    q('dm-opacity-val').textContent = opacity;
    q('dm-maxheight').value = maxHeight;
    q('dm-maxheight-val').textContent = maxHeight + '%';
    q('dm-fontsize').value = fontSize;
    q('dm-fontsize-val').textContent = fontSize + 'px';
    q('dm-bold').checked = bold;
    q('dm-shadow').checked = shadow;
    q('dm-duration').value = duration;
    q('dm-duration-val').textContent = duration + 's';
    q('dm-limit').value = limit;
    q('dm-limit-val').textContent = limit;
    q('dm-filterdup').checked = filterDup;
  };

  function getTrackCount() {
    return Math.floor(window.innerHeight * (maxHeight / 100) / fontSize);
  }

  function getAvailableTrack(now) {
    const count = getTrackCount();
    for (let i = 0; i < count; i++) {
      if (!trackEndTime[i] || trackEndTime[i] <= now) return i;
    }
    return -1;
  }

  function markTrackBusy(i, now) {
    trackEndTime[i] = now + duration * 1000;
  }

  // 主邏輯：掃描頁面中的目標元素，製作彈幕
  setInterval(() => {
  if (!enabled) return;
  const now = Date.now();
  const count = getTrackCount();
  const maxPerSecond = Math.min(count * 2, 30);
  const interval = 1000 / maxPerSecond;
  if (now - lastEmit < interval) return;
  lastEmit = now;

  // 改用穩定的選擇器抓聊天訊息
  const messages = Array.from(document.querySelectorAll('[data-sentry-component="ChatUserMsg"]'));

  for (const msg of messages) {
    const contentSpan = msg.querySelector('span[lang="zh"] > span');
    const txt = contentSpan?.innerText?.trim();
    if (!txt) continue;
    if (filterDup && lastMsgs.includes(txt)) continue;
    if (txt.length > limit) continue;

    const track = getAvailableTrack(now);
    if (track === -1) continue;

    // console.log('[彈幕] 捕捉到訊息:', txt); // ✅ DEBUG 印出

    if (filterDup) lastMsgs.push(txt);
    markTrackBusy(track, now);

    const dm = document.createElement('div');
    dm.className = 'danmaku';
    dm.textContent = txt;
    dm.style.top = (track * fontSize) + 'px';
    dm.style.opacity = opacity;
    dm.style.fontSize = fontSize + 'px';
    dm.style.fontWeight = bold ? 'bold' : 'normal';
    dm.style.animationDuration = duration + 's';
    if (!shadow) dm.style.textShadow = 'none';

    document.body.appendChild(dm);
    setTimeout(() => dm.remove(), duration * 1000);

    if (lastMsgs.length > 100) lastMsgs = lastMsgs.slice(-50);
    break;
  }
}, 100);

  // 設定控制面板事件綁定
  q('dm-enable').oninput = e => { enabled = e.target.checked; save(); };
  q('dm-opacity').oninput = e => { opacity = parseFloat(e.target.value); q('dm-opacity-val').textContent = opacity; save(); };
  q('dm-maxheight').oninput = e => { maxHeight = parseInt(e.target.value); q('dm-maxheight-val').textContent = maxHeight + '%'; save(); };
  q('dm-fontsize').oninput = e => { fontSize = parseInt(e.target.value); q('dm-fontsize-val').textContent = fontSize + 'px'; save(); };
  q('dm-bold').oninput = e => { bold = e.target.checked; save(); };
  q('dm-shadow').oninput = e => { shadow = e.target.checked; save(); };
  q('dm-duration').oninput = e => { duration = parseInt(e.target.value); q('dm-duration-val').textContent = duration + 's'; save(); };
  q('dm-limit').oninput = e => { limit = parseInt(e.target.value); q('dm-limit-val').textContent = limit; save(); };
  q('dm-filterdup').oninput = e => { filterDup = e.target.checked; save(); };

  // 初始化
  sync();
  alert('✅ Soop 彈幕已啟動（精準抓訊息）');
})();
