'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.dashboard = (() => {
  let _chartLine = null, _chartBar = null, _chartLev = null;
  let _calYear, _calMonth_;
  let _nwMode = 'TWD';
  let _nwRange = 'ytd';
  let _growthRange = '6m';
  let _growthMode = '$';
  let _levRange = '6m';
  let _snapshots = [];

  function init() {
    const now = new Date();
    _calYear = now.getFullYear();
    _calMonth_ = now.getMonth();
    _render();
  }

  function _render() {
    const orderMap = {}; const showMap = {};
    const container = document.getElementById('dashboard-content');
    if (!container) return;

    const s = PRO.state.get();
    const snapshots = (s.netWorthSnapshots || []).sort((a,b) => a.date.localeCompare(b.date));
    _snapshots = snapshots;

    const assets = s.assets || [];
    const liabilities = s.liabilities || [];
    const hide = (s.settings || {}).hideAmounts;

    // 精確計算總資產（含外幣匯率換算 + 貴金屬單位換算，與資產頁保持一致）
    const _rates_dash = (typeof PRO !== 'undefined' && PRO.assets && PRO.assets.getRates) ? PRO.assets.getRates() : {};
    const UNIT_TO_GRAM_DASH = { oz: 31.1035, g: 1, qian: 3.75, tael: 37.5 };
    const totalAssets = assets.reduce((sum, a) => {
      const qty   = parseFloat(a.quantity)  || 0;
      const price = parseFloat(a.price || a.costPrice) || 0;
      const rate  = a.currency === 'TWD' ? 1 : (_rates_dash[a.currency] || 1);
      const isMetal = ['gold','platinum','silver'].includes(a.type);
      let value;
      if (isMetal && price > 0) {
        const unitGram = a.metalUnitToGram || UNIT_TO_GRAM_DASH[a.metalUnit || 'tael'] || 37.5;
        value = qty * unitGram * price;
      } else {
        value = qty * price * rate;
      }
      return sum + (value || 0);
    }, 0);
    const totalLiab = liabilities.reduce((sum, l) => sum + (parseFloat(l.remaining != null ? l.remaining : l.principal) || 0), 0);
    const currentNW = totalAssets - totalLiab; // Always live - don't rely on snapshot value
    const leverage = (totalLiab > 0 && currentNW > 0) ? (totalLiab / currentNW) : 0;

    // YTD calc
    const thisYear = new Date().getFullYear();
    const ytdStart = snapshots.find(snap => snap.date.startsWith(thisYear - 1 + '-12') || snap.date.startsWith(thisYear + '-01'));
    const ytdStartNW = ytdStart ? ytdStart.netWorth : (snapshots.length > 0 ? snapshots[0].netWorth : currentNW);
    const ytdDiff = currentNW - ytdStartNW;
    const ytdPct = ytdStartNW > 0 ? (ytdDiff / ytdStartNW * 100) : 0;

    // Retirement
    const retirement = s.retirementGoal || { targetAmount: 0 };
    const targetAmt = retirement.targetAmount || 0;
    const retirePct = targetAmt > 0 ? Math.min(100, (currentNW / targetAmt) * 100) : 0;
    const gap = Math.max(0, targetAmt - currentNW);

    let html = `
<div style="display:flex;align-items:center;justify-content:space-between;padding:16px;padding-bottom:8px;">
  <div style="font-size:24px;font-weight:800;cursor:pointer;" onclick="if(PRO.leverageExposure) PRO.leverageExposure.open()">儀表板 <span>›</span></div>
  <div style="display:flex;gap:12px;font-size:20px;color:var(--text-secondary);">
    <span class="tappable" onclick="if(PRO.market) PRO.market.open()">🌐</span>
    <span class="tappable" onclick="if(PRO.performance) PRO.performance.open()">📊</span>
    <span class="tappable" onclick="PRO.dashboard._openLayoutSheet()">•••</span>
  </div>
</div>
<div style="padding:0 16px;">`;
      html += _buildAccountHeader(s);

    
    

      if (snapshots.length === 0 && assets.length === 0) {
      html += `
<div class="card fade-in" style="margin-bottom:16px;background:linear-gradient(135deg,rgba(10,132,255,0.2),rgba(52,199,89,0.1));border:1px solid rgba(10,132,255,0.3);">
  <div style="font-size:18px;font-weight:700;margin-bottom:8px;">邁向財務自由的第一步</div>
  <div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">建立專屬於你的淨資產說明書，即時追蹤資產與負債狀態。</div>
  <button style="padding:10px 16px;border-radius:20px;background:var(--accent);color:#fff;font-weight:600;border:none;cursor:pointer;" onclick="PRO.toast('請先至資產頁新增資產')">建立我的淨資產說明書 ›</button>
</div>`;
    }

    // 淨資產卡片
    html += `
<div class="card fade-in" style="margin-bottom:16px;position:relative;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:13px;color:var(--text-secondary);font-weight:600;">淨資產 (NET WORTH)</span>
      <span style="font-size:11px;color:var(--text-tertiary);">ⓘ</span>
    </div>
    <button id="nw-mode-btn" onclick="PRO.dashboard._toggleNwMode()" style="font-size:11px;padding:3px 8px;border-radius:20px;background:rgba(255,255,255,0.1);color:var(--text-secondary);border:none;cursor:pointer;">${_nwMode === 'TWD' ? '⇄ %' : '⇄ TWD'}</button>
  </div>
  <div style="font-size:36px;font-weight:800;margin-bottom:4px;" class="${hide ? 'amount-hidden' : ''}">
    ${hide ? '****' : (_nwMode === 'TWD' ? PRO.fmt.money(currentNW,'TWD',true) : PRO.fmt.pct(0,2))}
  </div>
  <div style="font-size:13px;color:${ytdDiff>=0?'var(--brand)':'var(--accent-red)'};margin-bottom:16px;font-weight:600;">
    今年 ${ytdDiff>=0?'+':''}${PRO.fmt.money(ytdDiff,'TWD')} (${PRO.fmt.pct(ytdPct,2)})
  </div>
  
  <div style="display:flex;gap:6px;margin-bottom:12px;background:rgba(255,255,255,0.05);padding:4px;border-radius:24px;width:fit-content;">
    <button class="range-tab ${_nwRange==='month'?'active':''}" onclick="PRO.dashboard._setNwRange('month')">近月</button>
    <button class="range-tab ${_nwRange==='ytd'?'active':''}" onclick="PRO.dashboard._setNwRange('ytd')">今年</button>
    <button class="range-tab ${_nwRange==='all'?'active':''}" onclick="PRO.dashboard._setNwRange('all')">全部</button>
  </div>
  
  <div style="position:relative;height:180px;width:100%;">
    ${snapshots.length <= 1 ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);border-radius:12px;z-index:10;flex-direction:column;backdrop-filter:blur(2px);"><div style="font-size:24px;margin-bottom:8px;">📊</div><div style="font-size:14px;font-weight:600;">資料不足</div></div>` : ''}
    <canvas id="chart-networth"></canvas>
  </div>
  
  <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
    <div style="text-align:center;">
      <div style="font-size:10px;color:var(--text-tertiary);margin-bottom:4px;">總資產</div>
      <div style="font-size:13px;font-weight:600;color:var(--brand);">${hide ? '****' : PRO.fmt.money(totalAssets,'TWD')}</div>
    </div>
    <div style="text-align:center;padding:0 12px;">
      <div style="font-size:10px;color:var(--text-tertiary);margin-bottom:4px;">投資槓桿</div>
      <div style="font-size:20px;font-weight:700;color:${leverage>2?'var(--accent-red)':(leverage>1?'var(--accent-yellow)':'var(--brand)')};">${leverage.toFixed(2)}x</div>
    </div>
    <div style="text-align:center;">
      <div style="font-size:10px;color:var(--text-tertiary);margin-bottom:4px;">總負債</div>
      <div style="font-size:13px;font-weight:600;color:var(--accent-red);">${hide ? '****' : PRO.fmt.money(totalLiab,'TWD')}</div>
    </div>
  </div>
</div>`;

    // 純金融槓桿走勢卡片
    html += `
<div class="card fade-in" style="margin-bottom:16px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:16px;">📈</span>
      <span style="font-weight:600;font-size:15px;">純金融槓桿走勢</span>
    </div>
    <div style="display:flex;gap:4px;background:rgba(255,255,255,0.05);padding:2px;border-radius:16px;">
      <button class="range-tab-sm ${_levRange==='6m'?'active':''}" onclick="PRO.dashboard._setLevRange('6m')">近半年</button>
      <button class="range-tab-sm ${_levRange==='ytd'?'active':''}" onclick="PRO.dashboard._setLevRange('ytd')">今年</button>
      <button class="range-tab-sm ${_levRange==='all'?'active':''}" onclick="PRO.dashboard._setLevRange('all')">全部</button>
    </div>
  </div>
  <div style="height:150px;position:relative;">
    ${snapshots.length <= 1 ? `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;"><div style="font-size:32px;opacity:0.3;">📊</div><div style="font-weight:600;font-size:14px;color:var(--text-secondary);">尚無足夠數據</div></div>` : `<canvas id="chart-leverage"></canvas>`}
  </div>
</div>`;

    // 月增率
    html += `
<div class="card fade-in" style="margin-bottom:16px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:16px;">📊</span>
      <span style="font-weight:600;font-size:15px;">月增率</span>
      <button onclick="PRO.dashboard._toggleGrowthMode()" style="font-size:10px;padding:2px 6px;border-radius:20px;background:rgba(255,255,255,0.1);color:var(--text-secondary);border:none;cursor:pointer;">${_growthMode==='$'?'⇄%':'⇄$'}</button>
    </div>
    <div style="display:flex;gap:4px;background:rgba(255,255,255,0.05);padding:2px;border-radius:16px;">
      <button class="range-tab-sm ${_growthRange==='6m'?'active':''}" onclick="PRO.dashboard._setGrowthRange('6m')">近6月</button>
      <button class="range-tab-sm ${_growthRange==='ytd'?'active':''}" onclick="PRO.dashboard._setGrowthRange('ytd')">今年</button>
      <button class="range-tab-sm ${_growthRange==='all'?'active':''}" onclick="PRO.dashboard._setGrowthRange('all')">全部</button>
    </div>
  </div>
  <div style="position:relative;height:150px;width:100%;">
    ${snapshots.length <= 1 ? `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;"><div style="font-size:28px;opacity:0.3;">📉</div><div style="font-size:13px;color:var(--text-secondary);">資料不足</div></div>` : ''}
    <canvas id="chart-growth"></canvas>
  </div>
</div>`;

    // 淨資產變動日曆 (容器，後續 _drawCalendar 會填入)
    html += `
<div class="card fade-in" style="margin-bottom:16px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <div style="display:flex;align-items:center;gap:6px;">
      <span>📅</span>
      <span style="font-weight:600;font-size:15px;">淨資產變動日曆</span>
    </div>
    <div style="display:flex;align-items:center;gap:12px;background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:16px;">
      <button id="cal-prev" style="background:none;border:none;color:var(--text-secondary);font-size:18px;cursor:pointer;padding:0;width:24px;">‹</button>
      <span id="cal-month-label" style="font-size:13px;font-weight:600;width:60px;text-align:center;"></span>
      <button id="cal-next" style="background:none;border:none;color:var(--text-secondary);font-size:18px;cursor:pointer;padding:0;width:24px;">›</button>
    </div>
  </div>
  
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center;font-size:11px;color:var(--text-tertiary);margin-bottom:6px;">
    <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
  </div>
  <div id="cal-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:16px;"></div>
  
  <div style="border-top:1px solid var(--border);padding-top:12px;margin-bottom:16px;">
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">當月加總</div>
    <div id="cal-monthly-total" style="display:flex;justify-content:space-between;font-size:14px;font-weight:600;"></div>
  </div>
  
  <div style="border-top:1px solid var(--border);padding-top:12px;margin-bottom:16px;">
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">每週變動</div>
    <div id="cal-weekly" style="display:flex;flex-direction:column;gap:6px;font-size:12px;"></div>
  </div>
  
  <div id="cal-stats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;text-align:center;border-top:1px solid var(--border);padding-top:12px;"></div>
</div>`;

    // 退休目標進度卡片
    html += `
<div id="card-retirement" class="card fade-in tappable" style="margin-bottom:16px;" onclick="PRO.dashboard._openRetirementSheet()">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span>✈️</span>
      <span style="font-weight:600;font-size:15px;">退休目標進度</span>
    </div>
    <span style="font-size:16px;font-weight:700;color:var(--brand);">${retirePct.toFixed(1)}%</span>
  </div>
  <div class="progress-bar-track" style="margin-bottom:12px;">
    <div class="progress-bar-fill" style="width:${retirePct}%;background:var(--brand);"></div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:12px;">
    <div><span style="color:var(--text-secondary);">目標金額</span><br><span style="font-weight:600;font-size:14px;">${hide?'****':PRO.fmt.money(targetAmt,'TWD')}</span></div>
    <div style="text-align:right;"><span style="color:var(--text-secondary);">尚缺</span><br><span style="font-weight:600;font-size:14px;color:var(--text-secondary);">${hide?'****':PRO.fmt.money(gap,'TWD')}</span></div>
  </div>
</div>`;

    // 複利試算 + 歷史紀錄
    html += `
<div id="card-compound" class="card fade-in tappable" style="margin-bottom:12px;" onclick="if(PRO.compound) PRO.compound.open()">
  <div style="display:flex;align-items:center;">
    <div class="explore-icon" style="background:rgba(255,159,10,0.15);">📈</div>
    <div style="flex:1;"><div style="font-weight:600;font-size:15px;margin-bottom:3px;">複利試算工具</div><div style="font-size:12px;color:var(--text-secondary);">計算資產複利成長預測</div></div>
    <div style="color:var(--text-tertiary);margin-left:8px;">›</div>
  </div>
</div>

<div id="card-history" class="card fade-in tappable" style="margin-bottom:16px;" onclick="PRO.dashboard._openHistorySheet()">
  <div style="display:flex;align-items:center;">
    <div class="explore-icon" style="background:rgba(142,142,147,0.15);">🕐</div>
    <div style="flex:1;"><div style="font-weight:600;font-size:15px;margin-bottom:3px;">歷史紀錄</div><div style="font-size:12px;color:var(--text-secondary);">年度分組的淨資產快照</div></div>
    <div style="color:var(--text-tertiary);margin-left:8px;">›</div>
  </div>
</div>

${_buildClecCard(s)}
  </div>
  <button class="snapshot-btn" onclick="PRO.dashboard._takeSnapshot()">
  🌸 紀錄快照
</button>
<div style="height:20px;"></div>
</div>`;

    container.innerHTML = html;

    // 月份切換事件綁定
    document.getElementById('cal-prev')?.addEventListener('click', () => {
      _calMonth_--; if (_calMonth_ < 0) { _calMonth_ = 11; _calYear--; }
      _drawCalendar();
    });
    document.getElementById('cal-next')?.addEventListener('click', () => {
      _calMonth_++; if (_calMonth_ > 11) { _calMonth_ = 0; _calYear++; }
      _drawCalendar();
    });

    _drawNetWorthChart(snapshots);
    _drawGrowthChart(snapshots);

    _drawLevChart(snapshots);
    _drawCalendar();

    
    // -- Dashboard Layout Customization (DOM Reordering) --
    const layout = (s.settings || {}).dashboardLayout;
    if (layout) {
      // The cards are inside the second child of container (the padding div)
      const paddingDiv = container.children[1];
      if (paddingDiv) {
        paddingDiv.style.display = 'flex';
        paddingDiv.style.flexDirection = 'column';
        
        Array.from(paddingDiv.children).forEach(el => {
          if (el.classList.contains('dashboard-header') || el.textContent.includes('建立專屬你的淨資產')) {
            el.style.order = -2;
          } else {
            el.style.order = -1; // Default for unmanaged cards
          }
        });

        const cards = paddingDiv.querySelectorAll('.card');
        const identifyCard = (el) => {
          if (el.querySelector('#chart-networth') || el.querySelector('#nw-mode-btn')) return 'networth';
          if (el.querySelector('#chart-leverage')) return 'leverage';
          if (el.querySelector('#chart-growth')) return 'growth';
          if (el.querySelector('#cal-grid')) return 'calendar';
          if (el.textContent.includes('CLEC')) return 'clec';
          if (el.id === 'card-retirement') return 'retirement';
          if (el.id === 'card-compound') return 'compound';
          if (el.id === 'card-history') return 'history';
          return null;
        };

        const cardMap = {};
        cards.forEach(c => {
          const id = identifyCard(c);
          if (id) cardMap[id] = c;
        });

        layout.forEach((item, idx) => {
          if (cardMap[item.id]) {
            cardMap[item.id].style.order = idx;
            cardMap[item.id].style.display = item.show ? 'block' : 'none';
          }
        });
      }
    }
  }



  function _setNwRange(r) { _nwRange = r; PRO.dashboard.render(); }
  function _toggleNwMode() { _nwMode = _nwMode === 'TWD' ? 'pct' : 'TWD'; PRO.dashboard.render(); }
  function _setGrowthRange(r) { _growthRange = r; PRO.dashboard.render(); }
  function _setLevRange(r) { _levRange = r; PRO.dashboard.render(); }
  function _toggleGrowthMode() { _growthMode = _growthMode === '$' ? '%' : '$'; PRO.dashboard.render(); }

  function _drawNetWorthChart(snapshots) {
    const ctx = document.getElementById('chart-networth')?.getContext('2d');
    if (!ctx || !window.Chart) return;
    if (_chartLine) _chartLine.destroy();
    
    let data = snapshots;
    if (_nwRange === 'month') data = snapshots.slice(-30);
    else if (_nwRange === 'ytd') {
      const thisYear = new Date().getFullYear();
      data = snapshots.filter(s => s.date.startsWith(thisYear.toString()));
    }
    
    const labels = data.map(s => s.date.substring(5));
    let values, tickCb;
    if (_nwMode === 'pct') {
      const base = data[0] ? data[0].netWorth : 0;
      values = data.map(s => base > 0 ? ((s.netWorth - base) / base * 100) : 0);
      tickCb = v => v.toFixed(0) + '%';
    } else {
      values = data.map(s => s.netWorth);
      tickCb = v => v >= 10000 ? (v / 10000).toFixed(0) + '萬' : v;
    }
    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(10, 132, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(10, 132, 255, 0.0)');

    _chartLine = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: '#0a84ff',
          backgroundColor: gradient,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.1
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: { 
            position: 'right', 
            border: { display: false }, 
            grid: { color: 'rgba(255,255,255,0.05)' }, 
            ticks: { color: '#8e8e93', callback: tickCb } 
          }
        },
        interaction: { intersect: false, mode: 'index' }
      }
    });
  }

  function _drawGrowthChart(snapshots) {
    const ctx = document.getElementById('chart-growth')?.getContext('2d');
    if (!ctx || !window.Chart) return;
    if (_chartBar) _chartBar.destroy();

    const months = {};
    snapshots.forEach(s => { months[s.date.substring(0, 7)] = s.netWorth; });
    const mKeys = Object.keys(months).sort();
    let labels = [], values = [], colors = [];

    for (let i = 1; i < mKeys.length; i++) {
      const prev = months[mKeys[i-1]];
      const curr = months[mKeys[i]];
      const diff = curr - prev;
      const pct = prev > 0 ? (diff / prev * 100) : 0;
      labels.push(mKeys[i].substring(5));
      values.push(_growthMode === '$' ? diff : pct);
      colors.push(diff >= 0 ? '#34c759' : '#ff3b30');
    }

    if (_growthRange === '6m') { labels = labels.slice(-6); values = values.slice(-6); colors = colors.slice(-6); }
    else if (_growthRange === 'ytd') {
      const thisYear = new Date().getFullYear().toString();
      const filtered = labels.map((l, i) => l.startsWith(thisYear) ? i : -1).filter(i => i >= 0);
      if (filtered.length > 0) {
        labels = labels.slice(filtered[0]); values = values.slice(filtered[0]); colors = colors.slice(filtered[0]);
      }
    }

    _chartBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors, borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: { position: 'right', border: { display: false }, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8e8e93', callback: v => _growthMode === '$' ? (Math.abs(v)>=10000?(v/10000).toFixed(0)+'萬':v) : v.toFixed(1)+'%' } }
        }
      }
    });
  }
  function _drawLevChart(snapshots) {
    const ctx = document.getElementById('chart-leverage')?.getContext('2d');
    if (!ctx || !window.Chart) return;
    if (_chartLev) _chartLev.destroy();
    
    let data = snapshots.filter(s => s.leverage !== undefined);
    if (data.length === 0) return; // No lev data

    if (_levRange === '6m') data = data.slice(-180);
    else if (_levRange === 'ytd') data = data.filter(s => s.date.startsWith(new Date().getFullYear().toString()));

    const labels = data.map(s => s.date.substring(5));
    const values = data.map(s => s.leverage);
    
    _chartLev = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values, borderColor: '#ff9f0a', borderWidth: 2, pointRadius: 0, tension: 0.3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: { position: 'right', border: { display: false }, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8e8e93', callback: v=>v.toFixed(2)+'x' } }
        }
      }
    });
  }

  function _drawCalendar() {
    const lbl = document.getElementById('cal-month-label');
    const grid = document.getElementById('cal-grid');
    if (!lbl || !grid) return;
    
    lbl.textContent = `${_calYear}年${_calMonth_ + 1}月`;
    const firstDay = new Date(_calYear, _calMonth_, 1).getDay();
    const daysInMonth = new Date(_calYear, _calMonth_ + 1, 0).getDate();
    
    const snapshotMap = {};
    _snapshots.forEach(s => { snapshotMap[s.date] = s.netWorth; });
    
    let html = '';
    for (let i = 0; i < firstDay; i++) {
      html += `<div class="cal-cell-empty"></div>`;
    }
    
    let upDays = 0, totalDays = 0, sumDiff = 0, maxDiff = -Infinity, minDiff = Infinity;
    const weeklyData = [];
    let currentWeekStart = 1, currentWeekDiff = 0, currentWeekHasData = false;

    const formatCompact = (num) => {
      const abs = Math.abs(num);
      if (abs >= 10000) return (abs / 10000).toFixed(1) + 'W';
      if (abs >= 1000) return (abs / 1000).toFixed(1) + 'k';
      return Math.round(abs).toString();
    };

    let firstNw = null, lastNw = null;
    const today = new Date();
    const isThisMonth = (today.getFullYear() === _calYear && today.getMonth() === _calMonth_);
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${_calYear}-${String(_calMonth_+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const nw = snapshotMap[dateStr];
      const prevStr = new Date(_calYear, _calMonth_, d-1).toISOString().slice(0,10);
      const prevNw = snapshotMap[prevStr] || nw;
      
      let content = `<div style="font-size:12px;font-weight:500;color:var(--text-tertiary);">${d}</div>`;
      let cellCls = 'cal-cell-empty';
      let style = '';

      if (isThisMonth && d === today.getDate()) cellCls += ' today';
      
      if (nw !== undefined && prevNw !== undefined) {
        if (firstNw === null) firstNw = prevNw;
        lastNw = nw;
        
        const diff = nw - prevNw;
        const pct = prevNw > 0 ? (diff / prevNw * 100) : 0;
        
        totalDays++;
        sumDiff += diff;
        if (diff > 0) upDays++;
        if (diff > maxDiff) maxDiff = diff;
        if (diff < minDiff) minDiff = diff;

        currentWeekDiff += diff;
        currentWeekHasData = true;

        let color = 'var(--text-secondary)', bg = 'rgba(255,255,255,0.08)', prefix = '';
        if (diff > 0) { color = '#34c759'; bg = 'rgba(52,199,89,0.15)'; prefix = '+'; }
        else if (diff < 0) { color = '#ff3b30'; bg = 'rgba(255,59,48,0.15)'; }
        
        content = `
          <div style="font-size:12px;font-weight:600;color:var(--text-primary);">${d}</div>
          <div style="font-size:9px;color:${color};font-weight:600;">${prefix}${pct.toFixed(1)}%</div>
          <div style="font-size:9px;color:${color};">${prefix}${formatCompact(diff)}</div>
        `;
        cellCls = 'cal-cell';
        style = `background:${bg};`;
        if (isThisMonth && d === today.getDate()) style += 'border:1px solid rgba(10,132,255,0.5);';
      }
      
      html += `<div class="${cellCls}" style="${style}">${content}</div>`;
      
      const dayOfWeek = new Date(_calYear, _calMonth_, d).getDay();
      if (dayOfWeek === 6 || d === daysInMonth) {
        if (currentWeekHasData) {
          const color = currentWeekDiff >= 0 ? 'var(--brand)' : 'var(--accent-red)';
          const pfx = currentWeekDiff >= 0 ? '+' : '';
          weeklyData.push(`
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="color:var(--text-secondary);flex:1;">${_calMonth_+1}/${currentWeekStart} - ${_calMonth_+1}/${d}</span>
              <span style="color:${color};font-weight:600;width:70px;text-align:right;">${pfx}${formatCompact(currentWeekDiff)}</span>
            </div>
          `);
        }
        currentWeekStart = d + 1;
        currentWeekDiff = 0;
        currentWeekHasData = false;
      }
    }
    
    grid.innerHTML = html;
    
    // Monthly total
    const mt = document.getElementById('cal-monthly-total');
    if (mt && firstNw !== null && lastNw !== null) {
      const diff = lastNw - firstNw;
      const pct = firstNw > 0 ? (diff / firstNw * 100) : 0;
      const pfx = diff >= 0 ? '+' : '';
      mt.innerHTML = `
        <span style="color:${diff>=0?'var(--brand)':'var(--accent-red)'};">${pfx}${pct.toFixed(2)}%</span>
        <span style="color:${diff>=0?'var(--brand)':'var(--accent-red)'};">${pfx}${PRO.fmt.money(diff,'TWD')}</span>
      `;
    } else if (mt) {
      mt.innerHTML = '<span style="color:var(--text-tertiary);">無數據</span>';
    }

    // Weekly
    const wk = document.getElementById('cal-weekly');
    if (wk) wk.innerHTML = weeklyData.length > 0 ? weeklyData.join('') : '<div style="color:var(--text-tertiary);">無數據</div>';

    // Stats
    const st = document.getElementById('cal-stats');
    if (st) {
      const avg = totalDays > 0 ? sumDiff / totalDays : 0;
      st.innerHTML = `
        <div><div style="font-size:10px;color:var(--text-tertiary);">上漲日數</div><div style="font-size:13px;font-weight:700;color:var(--brand);margin-top:4px;">${upDays}/${totalDays}</div></div>
        <div><div style="font-size:10px;color:var(--text-tertiary);">平均日增</div><div style="font-size:12px;font-weight:600;color:${avg>=0?'var(--brand)':'var(--accent-red)'};margin-top:4px;">${avg>=0?'+':''}${formatCompact(avg)}</div></div>
        <div><div style="font-size:10px;color:var(--text-tertiary);">最佳日</div><div style="font-size:12px;font-weight:600;color:var(--brand);margin-top:4px;">${maxDiff!==-Infinity?'+'+formatCompact(maxDiff):'-'}</div></div>
        <div><div style="font-size:10px;color:var(--text-tertiary);">最差日</div><div style="font-size:12px;font-weight:600;color:var(--accent-red);margin-top:4px;">${minDiff!==Infinity?formatCompact(minDiff):'-'}</div></div>
      `;
    }
  }

  function _openRetirementSheet() {
    const s = PRO.state.get();
    const current = s.retirementGoal?.targetAmount || 0;
    const html = `
<div style="padding:24px 20px 80px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <div style="font-size:22px;font-weight:700;">設定退休目標</div>
    <button onclick="PRO.sheet.close()" style="background:none;border:none;color:var(--text-tertiary);font-size:20px;cursor:pointer;">✕</button>
  </div>
  <div style="font-size:13px;color:var(--text-secondary);margin-bottom:24px;">設定你的財務自由目標金額 (TWD)</div>
  <input id="retirement-input" type="number" value="${current || ''}" placeholder="例如：10000000"
    style="width:100%;padding:16px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--text-primary);font-size:18px;box-sizing:border-box;">
  <button onclick="PRO.dashboard._saveRetirement()" style="width:100%;margin-top:24px;padding:16px;border-radius:12px;background:var(--brand);color:#000;font-size:16px;font-weight:600;border:none;cursor:pointer;">儲存目標</button>
</div>`;
    PRO.sheet.open(html);
  }

  function _saveRetirement() {
    const val = parseFloat(document.getElementById('retirement-input').value) || 0;
    try {
      const raw = localStorage.getItem('jizhangpro_v1');
      const state = raw ? JSON.parse(raw) : {};
      state.retirementGoal = { targetAmount: val };
      localStorage.setItem('jizhangpro_v1', JSON.stringify(state));
      PRO.sheet.close();
      _render();
      PRO.toast('✅ 目標已設定！');
    } catch(e) {}
  }

  function _openHistorySheet() {
    const byYear = {};
    _snapshots.forEach(s => {
      const y = s.date.slice(0, 4);
      if (!byYear[y]) byYear[y] = [];
      byYear[y].push(s);
    });
    const years = Object.keys(byYear).sort().reverse();
    let html = `<div style="padding:24px 20px 80px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
        <div style="font-size:24px;font-weight:800;">歷史紀錄</div>
        <button onclick="PRO.sheet.close()" style="background:none;border:none;color:var(--text-tertiary);font-size:24px;cursor:pointer;">✕</button>
      </div>`;
    years.forEach(y => {
      const arr = byYear[y];
      const lastNW = arr[arr.length-1].netWorth;
      html += `<div class="tappable" style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:var(--bg-card);border-radius:12px;margin-bottom:8px;border:1px solid var(--border);" onclick="PRO.toast('年份詳情即將推出')">
        <span style="font-size:17px;font-weight:600;">${y}年</span>
        <span style="color:var(--brand);font-weight:600;">${PRO.fmt.money(lastNW,'TWD')} ›</span>
      </div>`;
    });
    if (years.length === 0) {
      html += `<div style="text-align:center;padding:40px;color:var(--text-secondary);">尚無歷史紀錄</div>`;
    }
    html += `</div>`;
    PRO.sheet.open(html);
  }

  function _takeSnapshot() {
    if (!PRO.state || !PRO.state.takeSnapshot) return;
    const s = PRO.state.get();
    const assets = s.assets || [];
    const liabilities = s.liabilities || [];
    const UNIT_TO_GRAM = { oz: 31.1035, g: 1, qian: 3.75, tael: 37.5 };
    const METAL_TYPES = ['gold','platinum','silver'];

    // Compute totalAssets with metal support
    let totalA = 0;
    assets.forEach(a => {
      const qty = parseFloat(a.quantity) || 0;
      const price = parseFloat(a.price || a.costPrice) || 0;
      const isMetal = METAL_TYPES.includes(a.type);
      let val;
      if (isMetal && price > 0) {
        const ug = a.metalUnitToGram || UNIT_TO_GRAM[a.metalUnit || 'tael'] || 37.5;
        val = qty * ug * price;
      } else {
        val = qty * price;
      }
      totalA += val;
    });

    const totalL = liabilities.reduce((sum, l) => sum + (parseFloat(l.remaining != null ? l.remaining : l.principal) || 0), 0);
    const netWorth = totalA - totalL;
    const leverage = totalL > 0 && netWorth > 0 ? totalL / netWorth : 0;

    PRO.state.takeSnapshot({ netWorth, totalAssets: totalA, totalLiabilities: totalL, leverage });
    PRO.toast('🌸 紀錄快照成功！');
    _render();
  }
  function _buildClecCard(s) {
    const strategy = s.clecStrategy;
    if (!strategy || !strategy.enabled) return '';

    const targets = strategy.targets || { cash: 25, leverage: 25, equity: 25, crypto: 25 };
    const assets = s.assets || [];

    // Compute current allocations (same logic as rebalance.js _buildMain)
    let cash = 0, equity = 0, crypto = 0;
    assets.forEach(a => {
      const v = parseFloat(a.price || a.costPrice || 0) * parseFloat(a.quantity || 1) || 0;
      if (a.type === 'cash') cash += v;
      else if (a.type === 'crypto') crypto += v;
      else equity += v;
    });
    const liabilities = s.liabilities || [];
    const leverage = liabilities.reduce((sum, l) => sum + (parseFloat(l.remaining != null ? l.remaining : l.principal) || 0), 0);
    const gross = cash + equity + crypto + leverage;

    const actual = gross > 0 ? {
      cash:     Math.round(cash     / gross * 100),
      leverage: Math.round(leverage / gross * 100),
      equity:   Math.round(equity   / gross * 100),
      crypto:   Math.round(crypto   / gross * 100)
    } : { cash: 0, leverage: 0, equity: 0, crypto: 0 };

    const cats = [
      { key: 'cash',     label: 'C 現金',  color: '#34c759', icon: '💵' },
      { key: 'leverage', label: 'L 槓桿',  color: '#ff453a', icon: '⚡' },
      { key: 'equity',   label: 'E 股權',  color: '#0a84ff', icon: '📈' },
      { key: 'crypto',   label: 'C 加密',  color: '#bf5af2', icon: '🪙' }
    ];

    const rows = cats.map(c => {
      const t = targets[c.key] || 0;
      const a = actual[c.key] || 0;
      const diff = a - t;
      const diffLabel = diff > 0 ? `+${diff}%` : (diff < 0 ? `${diff}%` : '✓');
      const diffColor = Math.abs(diff) > 10 ? 'var(--accent-red)' : (Math.abs(diff) > 5 ? 'var(--accent-yellow)' : 'var(--brand)');
      const barActual = Math.min(a, 100);
      const barTarget = Math.min(t, 100);
      return `
<div style="margin-bottom:14px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
    <div style="font-size:13px;font-weight:600;">${c.icon} ${c.label}</div>
    <div style="display:flex;gap:10px;align-items:center;font-size:12px;">
      <span style="color:var(--text-secondary);">目標 ${t}%</span>
      <span style="font-weight:700;">${a}%</span>
      <span style="font-weight:700;color:${diffColor};min-width:36px;text-align:right;">${diffLabel}</span>
    </div>
  </div>
  <div style="position:relative;width:100%;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;">
    <div style="position:absolute;left:0;top:0;height:100%;width:${barActual}%;background:${c.color};border-radius:3px;opacity:0.5;transition:width 0.4s;"></div>
    <div style="position:absolute;left:${barTarget}%;top:-3px;width:2px;height:12px;background:${c.color};border-radius:1px;"></div>
  </div>
</div>`;
    }).join('');

    // Overall health score: penalise each category proportionally to deviation
    const totalDev = cats.reduce((sum, c) => sum + Math.abs((actual[c.key] || 0) - (targets[c.key] || 0)), 0);
    const score = Math.max(0, 100 - totalDev);
    const scoreColor = score >= 80 ? 'var(--brand)' : (score >= 60 ? 'var(--accent-yellow)' : 'var(--accent-red)');
    const scoreLabel = score >= 80 ? '配置健康' : (score >= 60 ? '稍有偏離' : '需要再平衡');

    return `
<div class="card fade-in" style="margin-bottom:16px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:16px;">⚖️</span>
      <span style="font-weight:700;font-size:15px;">CLEC 再平衡</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;font-weight:900;color:${scoreColor};">${score}</span>
      <div>
        <div style="font-size:10px;color:var(--text-tertiary);">健康分</div>
        <div style="font-size:11px;font-weight:600;color:${scoreColor};">${scoreLabel}</div>
      </div>
      <button onclick="if(PRO.rebalance) PRO.rebalance.openRebalanceSheet()" style="background:none;border:1px solid var(--border);border-radius:8px;color:var(--accent);font-size:12px;padding:4px 10px;cursor:pointer;">調整</button>
    </div>
  </div>
  ${rows}
</div>`;
  }



  
  const _DEFAULT_LAYOUT = [
    { id: 'networth',   name: '淨資產 (NET WORTH)',      show: true },
    { id: 'leverage',   name: '純金融槓桿走勢',           show: true },
    { id: 'growth',     name: '日增率',                  show: true },
    { id: 'calendar',   name: '淨資產變動表 (行事曆)',    show: true },
    { id: 'clec',       name: '⚖️ CLEC 再平衡',          show: true },
    { id: 'retirement', name: '✈️ 退休目標進度',          show: true },
    { id: 'compound',   name: '📈 複利試算工具',          show: true },
    { id: 'history',    name: '🕐 歷史紀錄',             show: true }
  ];

  function _getLayout() {
    const s = PRO.state.get();
    const saved = (s.settings || {}).dashboardLayout;
    if (!saved || !Array.isArray(saved)) return _DEFAULT_LAYOUT.map(x => Object.assign({}, x));
    // Merge: keep saved order/show, add any new cards from default not yet in saved
    const result = saved.map(item => Object.assign({}, item));
    _DEFAULT_LAYOUT.forEach(def => {
      if (!result.find(r => r.id === def.id)) {
        result.push(Object.assign({}, def));
      }
    });
    return result;
  }
  function _openLayoutSheet() {
    const s = PRO.state.get();
    let layout = _getLayout();

    
    let html = `
      <div class="sheet-title">儀表板自訂</div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">拖曳排序卡片位置，或點擊眼睛圖示隱藏/顯示卡片。</div>
      <div id="layout-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px;">
    `;
    
    layout.forEach((item, i) => {
      html += `
        <div class="card" style="display:flex;align-items:center;padding:12px;gap:12px;cursor:grab;" draggable="true" ondragstart="PRO.dashboard._dragStart(event, ${i})" ondragover="PRO.dashboard._dragOver(event)" ondrop="PRO.dashboard._drop(event, ${i})">
          <div style="color:var(--text-tertiary);cursor:grab;">≡</div>
          <div style="flex:1;font-size:14px;font-weight:600;opacity:${item.show ? '1' : '0.4'};">${item.name}</div>
          <button onclick="PRO.dashboard._toggleLayoutItem(${i})" style="background:none;border:none;color:var(--text-secondary);font-size:18px;">
            ${item.show ? '👁️' : '🚫'}
          </button>
        </div>
      `;
    });
    
    html += `
      </div>
      <button class="btn btn-secondary" onclick="PRO.sheet.close()" style="width:100%;">完成</button>
    `;
    PRO.sheet.open(html);
  }

  let dragIdx = -1;
  function _dragStart(e, i) { dragIdx = i; e.dataTransfer.effectAllowed = 'move'; }
  function _dragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
  function _drop(e, i) {
    e.preventDefault();
    if (dragIdx === -1 || dragIdx === i) return;
    const s = PRO.state.get();
    let layout = _getLayout();

    const item = layout.splice(dragIdx, 1)[0];
    layout.splice(i, 0, item);
    PRO.state.patch({ settings: { dashboardLayout: layout } });
    _openLayoutSheet();
    _render();
  }
  
  function _toggleLayoutItem(i) {
    const s = PRO.state.get();
    let layout = _getLayout();

    layout[i].show = !layout[i].show;
    PRO.state.patch({ settings: { dashboardLayout: layout } });
    _openLayoutSheet();
    _render();
  }

  
  function _openAccountSwitcher() {
    const accs = PRO.state.getAccounts();
    const activeAcc = PRO.state.getActiveAccount();
    
    let html = `
      <div class="sheet-title">帳戶切換與管理</div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">您可以在此建立多個獨立的記帳空間，資料將會完全分開儲存。</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px;">
    `;
    
    accs.forEach(a => {
      const isActive = a.id === activeAcc.id;
      html += `
        <div class="card" style="padding:12px;border:1px solid ${isActive ? 'var(--brand)' : 'var(--border)'};background:${isActive ? 'rgba(52,199,89,0.05)' : 'var(--bg-card)'};">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="flex:1;">
              <input type="text" class="form-input" style="background:transparent;border:none;padding:0;font-size:16px;font-weight:700;color:${isActive ? 'var(--brand)' : 'var(--text-primary)'};margin-bottom:4px;" value="${a.name}" onblur="PRO.state.updateAccountName('${a.id}', this.value)" placeholder="帳戶名稱">
              <div style="font-size:11px;color:var(--text-tertiary);">${isActive ? '目前使用中' : '點擊切換'}</div>
            </div>
            ${isActive ? `<div style="font-size:12px;font-weight:600;color:var(--brand);padding:4px 8px;background:rgba(52,199,89,0.1);border-radius:12px;">使用中</div>` : `<button class="btn btn-secondary" onclick="PRO.state.switchAccount('${a.id}')">切換</button>`}
            ${!isActive ? `<button onclick="if(confirm('確定要刪除此帳戶嗎？資料將無法恢復！')) PRO.state.deleteAccount('${a.id}'); PRO.dashboard._openAccountSwitcher();" style="background:none;border:none;color:var(--accent-red);font-size:16px;margin-left:12px;cursor:pointer;">🗑️</button>` : ''}
          </div>
        </div>
      `;
    });
    
    html += `
      </div>
      <div style="display:flex;gap:12px;">
        <button class="btn btn-secondary" onclick="const n = prompt('輸入新帳戶名稱:'); if(n) { PRO.state.createAccount(n); PRO.dashboard._openAccountSwitcher(); }" style="flex:1;">+ 新增帳戶</button>
        <button class="btn btn-primary" onclick="PRO.sheet.close(); PRO.dashboard.render();" style="flex:1;">完成</button>
      </div>
    `;
    
    PRO.sheet.open(html);
  }

  function _buildAccountHeader(s) {
    const acc = PRO.state.getActiveAccount();
    return `
      <div class="card tappable dashboard-header" style="margin: 0 0 16px 0; padding:16px; display:flex; align-items:center; justify-content:space-between; background:linear-gradient(135deg,rgba(255,255,255,0.02),rgba(255,255,255,0.05));" onclick="PRO.dashboard._openAccountSwitcher()">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:40px;height:40px;background:rgba(10,132,255,0.1);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">💼</div>
          <div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
              <span style="font-size:16px;font-weight:700;">${acc.name}</span>
              <span style="font-size:9px;font-weight:800;color:#000;background:var(--brand-yellow);padding:2px 4px;border-radius:4px;">PRO</span>
            </div>
            <div style="font-size:11px;color:var(--text-tertiary);">帳戶總覽 · 點擊切換帳戶</div>
          </div>
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--text-primary);background:rgba(255,255,255,0.1);padding:6px 10px;border-radius:20px;display:flex;align-items:center;gap:4px;">
          切換 <span style="font-size:14px;">⇄</span>
        </div>
      </div>
    `;
  }

  return { init, _openAccountSwitcher, _openLayoutSheet, _dragStart, _dragOver, _drop, _toggleLayoutItem, render: _render, _setNwRange, _setGrowthRange, _setLevRange, _toggleGrowthMode, _toggleNwMode, _openRetirementSheet, _saveRetirement, _openHistorySheet, _takeSnapshot };
})();
