'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.xray = (() => {
  let _etf1Data = null;
  let _etf2Data = null;

  function openXraySheet() {
    const html = `
<div class="sheet-title">ETF X-Ray 成分股透視</div>
<div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">輸入任意兩檔台股/美股 ETF，分析成分股重疊度，避免風險過度集中！(顯示全部成分股)</div>
<div style="font-size:11px;color:var(--accent-yellow);margin-bottom:20px;padding:8px;background:rgba(255,204,0,0.1);border-radius:6px;">⚠️ 註：目前為展示用模擬資料。要取得全球完整即時成分股，需在 server.js 中串接如 FMP 等付費資料源。</div>

<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px;">
  <input class="form-input" id="xray-etf1-input" placeholder="代號 (例: 0050)" style="flex:1;font-weight:600;color:var(--brand);text-align:center;" />
  <div style="font-weight:900;color:var(--text-tertiary);">VS</div>
  <input class="form-input" id="xray-etf2-input" placeholder="代號 (例: VTI)" style="flex:1;font-weight:600;color:var(--accent);text-align:center;" />
</div>
<button class="btn btn-primary" id="btn-xray-compare" style="width:100%;margin-bottom:24px;">開始比對</button>

<div id="xray-result-container"></div>
`;
    PRO.sheet.open(html);
    _bindEvents();
  }

  function _bindEvents() {
    document.getElementById('btn-xray-compare').addEventListener('click', async () => {
      const sym1 = document.getElementById('xray-etf1-input').value.trim().toUpperCase();
      const sym2 = document.getElementById('xray-etf2-input').value.trim().toUpperCase();
      
      if (!sym1 || !sym2) return PRO.toast('請輸入兩檔 ETF 代號', 'warning');
      if (sym1 === sym2) return PRO.toast('請輸入兩檔不同的 ETF', 'warning');

      const btn = document.getElementById('btn-xray-compare');
      btn.textContent = '讀取資料中...';
      btn.disabled = true;

      try {
        const res1 = await PRO.api.getEtfHoldings(sym1);
        const res2 = await PRO.api.getEtfHoldings(sym2);
        
        if (res1 && res1.success && res2 && res2.success) {
          _etf1Data = res1;
          _etf2Data = res2;
          _renderResult();
        } else {
          PRO.toast('取得資料失敗，請檢查網路或代號', 'error');
        }
      } catch (err) {
        PRO.toast('讀取異常', 'error');
      }
      
      btn.textContent = '開始比對';
      btn.disabled = false;
    });
  }

  function _renderResult() {
    const container = document.getElementById('xray-result-container');
    const e1 = _etf1Data;
    const e2 = _etf2Data;

    const map1 = {}; e1.holdings.forEach(s => map1[s.id] = s);
    const map2 = {}; e2.holdings.forEach(s => map2[s.id] = s);

    const overlap = [];
    e1.holdings.forEach(s => {
      if (map2[s.id]) overlap.push({ ...s, w1: s.weight, w2: map2[s.id].weight });
    });

    // 依總權重排序
    overlap.sort((a,b) => (b.w1+b.w2) - (a.w1+a.w2));

    let html = `
<div style="background:var(--bg-card);border-radius:12px;padding:16px;margin-bottom:16px;text-align:center;">
  <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">成分股重疊數量</div>
  <div style="font-size:36px;font-weight:900;color:${overlap.length>10?'var(--accent-red)':'var(--brand)'};">${overlap.length}</div>
  <div style="font-size:12px;color:var(--text-tertiary);margin-top:4px;">${overlap.length > 10 ? '高度重疊，留意風險過度集中' : (overlap.length > 0 ? '部分重疊' : '完全沒有重疊，具備絕佳分散性')}</div>
</div>
`;

    if (overlap.length > 0) {
      html += `<div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text-primary);border-bottom:1px solid var(--border);padding-bottom:8px;">🎯 所有共同成分股</div>`;
      overlap.forEach(s => {
        html += `
<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
  <div>
    <div style="font-weight:600;font-size:15px;">${s.name}</div>
    <div style="font-size:11px;color:var(--text-tertiary);">${s.id}</div>
  </div>
  <div style="display:flex;gap:12px;text-align:right;">
    <div><div style="font-size:10px;color:var(--brand);">${e1.symbol}</div><div style="font-size:13px;font-weight:600;">${s.w1}%</div></div>
    <div><div style="font-size:10px;color:var(--accent);">${e2.symbol}</div><div style="font-size:13px;font-weight:600;">${s.w2}%</div></div>
  </div>
</div>`;
      });
    }

    container.innerHTML = html;
  }

  return { openXraySheet };
})();
