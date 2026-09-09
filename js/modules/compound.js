'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.compound = (() => {
  let _chart = null;

  function open() {
    const s = PRO.state.get();
    const assets = s.assets || [];
    const liabilities = s.liabilities || [];
    const totalAssets = assets.reduce((sum, a) => {
      const price = a.price || a.costPrice || 0;
      const qty = a.quantity || 1;
      return sum + (parseFloat(price) * parseFloat(qty) || 0);
    }, 0);
    const totalLiab = liabilities.reduce((sum, l) => sum + (parseFloat(l.remainingPrincipal) || 0), 0);
    const netWorth = Math.max(0, totalAssets - totalLiab);

    const html = _buildHtml(netWorth);
    PRO.sheet.open(html, () => {
      if (_chart) { _chart.destroy(); _chart = null; }
    });
    setTimeout(() => _init(netWorth), 50);
  }

  function _buildHtml(netWorth) {
    return `<div style="padding:20px 20px 80px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
    <div style="font-size:20px;font-weight:700;">複利試算</div>
    <button onclick="PRO.sheet.close()" style="background:none;border:none;color:var(--accent);font-size:17px;cursor:pointer;">完成</button>
  </div>

  <!-- 預測結果 -->
  <div style="background:var(--bg-card);border-radius:16px;padding:20px;text-align:center;margin-bottom:16px;">
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;"><span id="cpd-years">20</span> 年後總資產預估</div>
    <div id="cpd-result" style="font-size:36px;font-weight:900;color:#ff453a;">$0</div>
    <div id="cpd-breakdown" style="font-size:12px;color:var(--text-secondary);margin-top:6px;"></div>
  </div>

  <!-- 成長曲線 -->
  <div style="background:var(--bg-card);border-radius:16px;padding:16px;margin-bottom:16px;">
    <div style="font-size:14px;font-weight:600;margin-bottom:12px;">📈 資產成長曲線 (TWD)</div>
    <div style="height:180px;"><canvas id="cpd-chart"></canvas></div>
  </div>

  <!-- 參數 -->
  <div style="background:var(--bg-card);border-radius:16px;padding:16px;">
    <!-- 初始本金 -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <div style="font-size:14px;">初始本金 (TWD)</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span id="cpd-principal-val" style="font-size:16px;font-weight:600;">$0</span>
        <button onclick="PRO.compound._usePrincipal(${Math.round(netWorth)})" style="font-size:11px;padding:3px 8px;border-radius:20px;background:rgba(10,132,255,0.15);color:var(--accent);border:none;cursor:pointer;">✏️ 淨資產</button>
      </div>
    </div>
    <input type="range" id="cpd-principal" min="0" max="${Math.max(30000000, Math.round(netWorth)*2)}" step="50000" value="0" oninput="PRO.compound._update()">
    <div style="height:1px;background:var(--border);margin:12px 0;"></div>
    <!-- 年化報酬率 -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <div style="font-size:14px;">年化報酬率 (%)</div>
      <span id="cpd-rate-val" style="font-size:16px;font-weight:600;">6</span>
    </div>
    <input type="range" id="cpd-rate" min="1" max="30" step="0.5" value="6" oninput="PRO.compound._update()"
      style="background:linear-gradient(to right, var(--brand) 0%, var(--brand) 17%, rgba(255,255,255,0.15) 17%)">
    <div style="height:1px;background:var(--border);margin:12px 0;"></div>
    <!-- 每月投入 -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <div style="font-size:14px;">每月投入 (TWD)</div>
      <span id="cpd-monthly-val" style="font-size:16px;font-weight:600;">$10,000</span>
    </div>
    <input type="range" id="cpd-monthly" min="0" max="200000" step="1000" value="10000" oninput="PRO.compound._update()"
      style="background:linear-gradient(to right, var(--accent) 0%, var(--accent) 5%, rgba(255,255,255,0.15) 5%)">
    <div style="height:1px;background:var(--border);margin:12px 0;"></div>
    <!-- 投資年限 -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <div style="font-size:14px;">投資年限 (年)</div>
      <span id="cpd-years2" style="font-size:16px;font-weight:600;">20</span>
    </div>
    <input type="range" id="cpd-tenure" min="1" max="40" step="1" value="20" oninput="PRO.compound._update()"
      style="background:linear-gradient(to right, var(--accent-yellow) 0%, var(--accent-yellow) 48%, rgba(255,255,255,0.15) 48%)">
  </div>
</div>`;
  }

  function _init(netWorth) {
    const el = document.getElementById('cpd-principal');
    if (!el) return;
    _update();
  }

  function _update() {
    const principal = parseFloat(document.getElementById('cpd-principal')?.value) || 0;
    const rate = parseFloat(document.getElementById('cpd-rate')?.value) || 6;
    const monthly = parseFloat(document.getElementById('cpd-monthly')?.value) || 0;
    const years = parseInt(document.getElementById('cpd-tenure')?.value) || 20;

    // 更新標籤
    document.getElementById('cpd-principal-val').textContent = PRO.fmt.money(principal, 'TWD');
    document.getElementById('cpd-rate-val').textContent = rate;
    document.getElementById('cpd-monthly-val').textContent = PRO.fmt.money(monthly, 'TWD');
    const y1 = document.getElementById('cpd-years'); if(y1) y1.textContent = years;
    const y2 = document.getElementById('cpd-years2'); if(y2) y2.textContent = years;

    // 計算
    const r = rate / 100 / 12;
    const n = years * 12;
    let finalVal;
    if (r === 0) {
      finalVal = principal + monthly * n;
    } else {
      finalVal = principal * Math.pow(1 + r, n) + monthly * (Math.pow(1 + r, n) - 1) / r;
    }
    const totalContrib = principal + monthly * n;
    const interest = finalVal - totalContrib;

    document.getElementById('cpd-result').textContent = PRO.fmt.money(Math.round(finalVal), 'TWD');
    document.getElementById('cpd-breakdown').textContent = `總投入: ${PRO.fmt.money(Math.round(totalContrib), 'TWD')} ‧ 複利獲利: ${PRO.fmt.money(Math.round(interest), 'TWD')}`;

    // 畫圖
    const ctx = document.getElementById('cpd-chart')?.getContext('2d');
    if (!ctx || !window.Chart) return;
    if (_chart) _chart.destroy();

    const pts = [];
    const lbls = [];
    for (let y = 0; y <= years; y++) {
      const nn = y * 12;
      let v;
      if (r === 0) {
        v = principal + monthly * nn;
      } else {
        v = principal * Math.pow(1 + r, nn) + monthly * (Math.pow(1 + r, nn) - 1) / r;
      }
      pts.push(Math.round(v));
      lbls.push(y === 0 ? '第0年' : (y % 5 === 0 ? `第${y}年` : ''));
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 180);
    gradient.addColorStop(0, 'rgba(255,69,58,0.5)');
    gradient.addColorStop(1, 'rgba(255,69,58,0.0)');

    _chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: lbls,
        datasets: [{ data: pts, borderColor: '#ff453a', backgroundColor: gradient, fill: true, borderWidth: 2, pointRadius: 0, tension: 0.4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#8e8e93', font: { size: 10 } }, grid: { display: false } },
          y: { display: false }
        }
      }
    });
  }

  function _usePrincipal(nw) {
    const el = document.getElementById('cpd-principal');
    if (!el) return;
    el.value = Math.round(nw);
    _update();
  }

  return { open, _update, _usePrincipal };
})();
