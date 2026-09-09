'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.mirror = (() => {
  let _chart = null;

  function open() {
    const s = PRO.state.get();
    const mirror = s.mirrorUniverse || { enabled: false, trackSymbol: '0050', entries: [] };
    const html = _buildHtml(s, mirror);
    PRO.sheet.open(html, () => {
      if (_chart) { _chart.destroy(); _chart = null; }
    });
    setTimeout(() => _init(s, mirror), 50);
  }

  function _buildHtml(s, mirror) {
    const entries = mirror.entries || [];
    const totalShares = entries.reduce((sum, e) => sum + (e.shares || 0), 0);
    const currentPrice = 102.85; // TODO: API
    const totalValue = totalShares * currentPrice;
    const totalInvested = entries.reduce((sum, e) => sum + (e.invested || 0), 0);
    const hasStarted = entries.length > 0;

    return `
<div style="padding:0 0 80px;">
  <!-- Sheet Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);">
    <div style="font-size:18px;font-weight:700;">鏡像時空</div>
    <button onclick="PRO.sheet.close()" style="background:none;border:none;color:var(--text-tertiary);font-size:20px;cursor:pointer;">···</button>
  </div>

  <!-- 主要數值卡片 -->
  <div style="background:var(--bg-card);margin:16px;border-radius:16px;padding:20px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <div style="width:36px;height:36px;border-radius:50%;background:rgba(191,90,242,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;">✨</div>
      <div>
        <div style="font-size:14px;font-weight:600;">鏡像時空總資產</div>
        <div style="font-size:11px;color:var(--text-secondary);">以 ${mirror.trackSymbol || '0050'} 元大台灣 50 模擬</div>
      </div>
    </div>
    ${hasStarted ? `
      <div style="font-size:36px;font-weight:800;margin-bottom:4px;">${PRO.fmt.money(totalValue, 'TWD')}</div>
      <div style="font-size:13px;color:var(--brand);">↗ $0 (0.00%)</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
        <div><div style="font-size:10px;color:var(--text-tertiary);">持有股數</div><div style="font-size:14px;font-weight:700;color:var(--accent);">${totalShares.toFixed(2)}</div></div>
        <div><div style="font-size:10px;color:var(--text-tertiary);">0050 現價</div><div style="font-size:14px;font-weight:700;color:var(--brand);">$102.85</div></div>
        <div><div style="font-size:10px;color:var(--text-tertiary);">累計投入</div><div style="font-size:14px;font-weight:700;color:var(--accent-yellow);">$${totalInvested.toLocaleString()}</div></div>
        <div><div style="font-size:10px;color:var(--text-tertiary);">交易次數</div><div style="font-size:14px;font-weight:700;">${entries.length}</div></div>
      </div>` : `
      <div style="text-align:center;padding:20px 0;">
        <div style="font-size:24px;font-weight:700;color:var(--text-tertiary);">尚未建倉</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:8px;margin-bottom:20px;">點擊「開始」以當前淨資產 買入 0050</div>
        <button onclick="PRO.mirror._start()" style="padding:12px 32px;border-radius:20px;background:rgba(191,90,242,0.2);border:1px solid rgba(191,90,242,0.4);color:var(--accent-purple);font-size:15px;font-weight:600;cursor:pointer;">▶ 開始</button>
      </div>`}
  </div>

  <!-- 走勢對比圖 -->
  <div style="background:var(--bg-card);margin:0 16px 16px;border-radius:16px;padding:16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-weight:600;">📈 走勢對比</span>
        <span style="font-size:11px;padding:2px 6px;border-radius:12px;background:rgba(255,255,255,0.1);color:var(--text-secondary);">⇄%</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;font-size:11px;color:var(--text-secondary);">
        <span><span style="color:#bf5af2;">●</span> 鏡像時空</span>
        <span><span style="color:var(--brand);">●</span> 實際淨資產</span>
      </div>
    </div>
    <div style="height:120px;display:flex;align-items:center;justify-content:center;">
      <div style="text-align:center;">
        <div style="font-size:24px;opacity:0.2;">📈</div>
        <div style="font-size:12px;color:var(--text-secondary);">資料累積中，每次開啟 App 會自動紀錄</div>
      </div>
    </div>
  </div>

  <!-- 交易紀錄 -->
  ${hasStarted ? `
  <div style="padding:0 16px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <span style="font-weight:600;font-size:15px;">交易紀錄</span>
      <span style="font-size:12px;color:var(--text-secondary);">共 ${entries.length} 筆</span>
    </div>
    ${entries.slice().reverse().map(e => `
    <div style="background:var(--bg-card);border-radius:12px;padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:12px;">
      <div style="width:36px;height:36px;border-radius:50%;background:${e.type === 'initial' ? 'rgba(191,90,242,0.2)' : 'rgba(52,199,89,0.2)'};display:flex;align-items:center;justify-content:center;font-size:16px;">${e.type === 'initial' ? '★' : '↑'}</div>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:14px;">${e.type === 'initial' ? '初始建倉' : '買入'} ${mirror.trackSymbol || '0050'} ${parseFloat(e.shares).toFixed(2)} 股</div>
        <div style="font-size:11px;color:var(--text-secondary);">成交價 $${e.price} · ${new Date(e.date).toLocaleString('zh-TW', {month:'numeric',day:'numeric',hour:'numeric',minute:'numeric'})}</div>
      </div>
      <div style="font-weight:700;color:var(--brand);">+${PRO.fmt.money(e.invested, 'TWD')}</div>
    </div>`).join('')}
  </div>` : ''}
</div>`;
  }

  function _init(s, mirror) { }

  function _start() {
    const s = PRO.state.get();
    const assets = s.assets || [];
    const liabilities = s.liabilities || [];
    const totalAssets = assets.reduce((sum, a) => sum + (parseFloat(a.price || a.costPrice || 0) * parseFloat(a.quantity || 1) || 0), 0);
    const totalLiab = liabilities.reduce((sum, l) => sum + (parseFloat(l.remainingPrincipal) || 0), 0);
    const netWorth = Math.max(0, totalAssets - totalLiab);
    const price = 102.85; 
    const shares = netWorth / price;

    try {
      const raw = localStorage.getItem('jizhangpro_v1');
      const state = raw ? JSON.parse(raw) : {};
      if (!state.mirrorUniverse) state.mirrorUniverse = { enabled: false, trackSymbol: '0050', entries: [] };
      state.mirrorUniverse.enabled = true;
      state.mirrorUniverse.entries.push({
        type: 'initial', date: new Date().toISOString(), price, shares, invested: netWorth
      });
      localStorage.setItem('jizhangpro_v1', JSON.stringify(state));
      PRO.sheet.close();
      setTimeout(() => PRO.mirror.open(), 200);
      PRO.toast('✅ 鏡像時空已建倉！');
    } catch(e) {
      PRO.toast('建倉失敗', 'error');
    }
  }

  return { open, _start };
})();