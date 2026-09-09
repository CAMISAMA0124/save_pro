
/* ================================================
   screen.js - 標的搜尋
   透過 Yahoo Finance Search API 搜尋全球標的
   ================================================ */
'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.screen = (() => {

  function open() {
    const html = `
<div class="sheet-title">🌊 海外標的搜尋</div>
<div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">
  輸入代號或名稱，瞬間搜尋全球股市與台股標的。
</div>

<div class="card" style="padding:16px;margin-bottom:12px;">
  <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--text-secondary);">關鍵字搜尋</div>
  <input type="text" id="screen-query" class="form-input" placeholder="輸入代號或名稱，例：AAPL, TSLA, 2330.TW" style="margin-bottom:12px;">
  <button class="btn btn-primary" id="btn-screen-go" onclick="PRO.screen._search()" style="width:100%;">🔍 搜尋</button>
</div>

<div id="screen-result"></div>
`;
    PRO.sheet.open(html);
  }

  async function _search() {
    const q = document.getElementById('screen-query')?.value?.trim();
    if (!q) return PRO.toast('請輸入關鍵字', 'warning');

    const btn = document.getElementById('btn-screen-go');
    const resultEl = document.getElementById('screen-result');
    btn.disabled = true;
    btn.textContent = '⏳ 搜尋中...';
    resultEl.innerHTML = '';

    try {
      const res = await fetch(`/api/yf/search?q=${encodeURIComponent(q)}`).then(r => r.json());
      if (res.success && Array.isArray(res.data)) {
        _renderResults(res.data, resultEl);
      } else {
        PRO.toast(`搜尋失敗: ${res.error || '未知錯誤'}`, 'error');
      }
    } catch (e) {
      PRO.toast('網路錯誤', 'error');
    }

    btn.disabled = false;
    btn.textContent = '🔍 搜尋';
  }

  function _renderResults(results, container) {
    if (results.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-secondary);">找不到符合條件的標的</div>`;
      return;
    }

    let html = `<div style="font-size:13px;font-weight:600;margin-bottom:10px;">找到 ${results.length} 筆結果</div>`;

    results.forEach(s => {
      // s.symbol, s.shortname, s.exchange, s.quoteType, s.sector, s.industry
      const inPortfolio = (PRO.state.get().assets || []).some(a => a.id === s.symbol);
      const actionBtn = inPortfolio ? 
        `<span style="font-size:11px;color:var(--text-tertiary);">已持有</span>` :
        `<button onclick="PRO.toast('可至首頁新增此資產', 'info')" style="background:var(--accent);color:#fff;border:none;border-radius:4px;padding:2px 6px;font-size:10px;cursor:pointer;">+ 觀察</button>`;

      html += `
<div class="card" style="padding:12px;margin-bottom:8px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
    <div>
      <span style="font-weight:700;font-size:15px;">${s.symbol}</span>
      <span style="font-size:11px;color:var(--text-secondary);margin-left:6px;">${s.exchange || ''} (${s.quoteType || 'EQUITY'})</span>
    </div>
    ${actionBtn}
  </div>
  <div style="font-size:13px;color:var(--text-secondary);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.longname || s.shortname || ''}</div>
  <div style="display:flex;gap:12px;font-size:11px;color:var(--text-tertiary);">
    ${s.sector ? `<span>${s.sector}</span>` : ''}
    ${s.industry ? `<span>${s.industry}</span>` : ''}
  </div>
</div>`;
    });

    container.innerHTML = html;
  }

  return { open, _search };
})();
