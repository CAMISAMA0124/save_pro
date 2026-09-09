'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.performance = (() => {
  function open() {
    PRO.sheet.open(_buildHtml());
  }

  function _buildHtml() {
    return `
<div style="padding:0 0 80px;background:var(--bg-body);">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);z-index:10;">
    <div style="font-size:20px;font-weight:700;">進階績效指標</div>
    <button onclick="PRO.sheet.close()" style="background:none;border:none;color:var(--text-tertiary);font-size:24px;cursor:pointer;">✕</button>
  </div>
  
  <div style="padding:16px;">
    <!-- 總覽 -->
    <div style="background:var(--bg-card);border-radius:16px;padding:20px;margin-bottom:16px;text-align:center;">
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">累積投資報酬 (YTD)</div>
      <div style="font-size:36px;font-weight:800;color:var(--brand);margin-bottom:4px;">+14.2%</div>
      <div style="font-size:13px;color:var(--text-secondary);">優於大盤 (0050) 2.1%</div>
    </div>
    
    <!-- 6宮格指標 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
      ${_buildStatCard('TWR 時間加權', '12.5%', '排除資金進出影響的真實報酬', 'rgba(10,132,255,0.15)', 'var(--accent)')}
      ${_buildStatCard('MWR 資金加權', '15.1%', '考量資金進出時點的實際獲利', 'rgba(52,199,89,0.15)', 'var(--brand)')}
      ${_buildStatCard('MaxDD 最大回撤', '-8.4%', '歷史最高點至最低點跌幅', 'rgba(255,59,48,0.15)', 'var(--accent-red)')}
      ${_buildStatCard('年化波動率', '11.2%', '資產價格波動的劇烈程度', 'rgba(255,159,10,0.15)', 'var(--accent-yellow)')}
      ${_buildStatCard('Sharpe 夏普值', '1.24', '承擔每單位風險的超額報酬', 'rgba(191,90,242,0.15)', 'var(--accent-purple)')}
      ${_buildStatCard('Sortino 索提諾', '1.85', '僅考慮下行風險的績效指標', 'rgba(50,173,230,0.15)', '#32ade6')}
    </div>
    
    <div style="background:var(--bg-card);border-radius:16px;padding:16px;margin-bottom:16px;">
      <div style="font-size:15px;font-weight:600;margin-bottom:12px;">淨值成長來源 (月度)</div>
      <div style="height:150px;display:flex;align-items:center;justify-content:center;border:1px dashed var(--border);border-radius:8px;">
        <div style="text-align:center;color:var(--text-secondary);font-size:13px;">
          瀑布圖 (Waterfall Chart)<br>建構中
        </div>
      </div>
    </div>
  </div>
</div>`;
  }

  function _buildStatCard(title, value, desc, bg, color) {
    return `
<div style="background:var(--bg-card);border-radius:16px;padding:16px;">
  <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">${title}</div>
  <div style="font-size:24px;font-weight:800;color:${color};margin-bottom:6px;">${value}</div>
  <div style="font-size:10px;color:var(--text-tertiary);line-height:1.4;">${desc}</div>
</div>`;
  }

  return { open };
})();