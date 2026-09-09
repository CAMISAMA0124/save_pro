'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.market = (() => {
  function open() {
    const html = _buildHtml();
    PRO.sheet.open(html);
  }

  function _buildHtml() {
    // 假數據
    const twStock = { score: 72, label: '貪婪', margin: '+1.2%', marginAmount: '3200億', light: '黃紅燈', lightScore: 32 };
    const global = { vix: 14.5, greed: 65, greedLabel: '貪婪' };
    
    return `
<div style="padding:0 0 80px;background:var(--bg-body);">
  <!-- 頂部導航 -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);z-index:10;">
    <div style="font-size:20px;font-weight:700;">市場資訊</div>
    <button onclick="PRO.sheet.close()" style="background:none;border:none;color:var(--text-tertiary);font-size:24px;cursor:pointer;">✕</button>
  </div>

  <div style="padding:16px;">
    
    <!-- 區塊：台股情緒 -->
    <div style="margin-bottom:24px;">
      <div style="font-size:16px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
        <span style="color:var(--accent);">🇹🇼</span> 台股情緒
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <!-- 融資走勢 -->
        <div style="background:var(--bg-card);border-radius:16px;padding:16px;">
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">融資走勢</div>
          <div style="font-size:24px;font-weight:800;color:var(--accent-red);margin-bottom:4px;">${twStock.marginAmount}</div>
          <div style="font-size:12px;color:var(--text-tertiary);"><span style="color:var(--accent-red);">${twStock.margin}</span> vs 上週</div>
          <div style="margin-top:16px;height:40px;display:flex;align-items:flex-end;gap:2px;">
            ${[0.6, 0.7, 0.65, 0.8, 0.9, 1.0].map(v => `<div style="flex:1;background:var(--accent-red);opacity:${v};border-radius:2px 2px 0 0;height:${v*100}%"></div>`).join('')}
          </div>
        </div>
        
        <!-- 景氣對策信號 -->
        <div style="background:var(--bg-card);border-radius:16px;padding:16px;">
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">景氣對策信號</div>
          <div style="font-size:24px;font-weight:800;color:var(--accent-yellow);margin-bottom:4px;">${twStock.lightScore} <span style="font-size:14px;">分</span></div>
          <div style="font-size:12px;color:var(--text-tertiary);">當前燈號：<span style="color:var(--accent-yellow);font-weight:600;">${twStock.light}</span></div>
          <div style="margin-top:16px;height:40px;display:flex;align-items:center;justify-content:space-between;">
            <div style="width:12px;height:12px;border-radius:50%;background:#34c759;opacity:0.2;"></div>
            <div style="width:12px;height:12px;border-radius:50%;background:#34c759;opacity:0.2;"></div>
            <div style="width:12px;height:12px;border-radius:50%;background:var(--accent-yellow);box-shadow:0 0 8px var(--accent-yellow);"></div>
            <div style="width:12px;height:12px;border-radius:50%;background:#ff453a;opacity:0.2;"></div>
            <div style="width:12px;height:12px;border-radius:50%;background:#ff453a;opacity:0.2;"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 區塊：國際總經 -->
    <div style="margin-bottom:24px;">
      <div style="font-size:16px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
        <span style="color:var(--brand);">🌍</span> 國際總經
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <!-- 恐懼貪婪指數 -->
        <div style="background:var(--bg-card);border-radius:16px;padding:16px;">
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">恐懼貪婪指數</div>
          <div style="font-size:28px;font-weight:800;color:var(--accent-yellow);">${global.greed}</div>
          <div style="font-size:12px;font-weight:600;color:var(--accent-yellow);">${global.greedLabel}</div>
        </div>
        
        <!-- VIX 恐慌指數 -->
        <div style="background:var(--bg-card);border-radius:16px;padding:16px;">
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">VIX 恐慌指數</div>
          <div style="font-size:28px;font-weight:800;color:var(--brand);">${global.vix}</div>
          <div style="font-size:12px;color:var(--brand);">處於低位 (安全)</div>
        </div>
      </div>

      <!-- 列表式指標 -->
      <div style="background:var(--bg-card);border-radius:16px;overflow:hidden;">
        ${_buildMarketRow('全球指數', 'S&P 500, NASDAQ...', '📈', () => PRO.toast('功能開發中'))}
        ${_buildMarketRow('類股輪動', '資金流向與板塊強度', '🔄', () => PRO.toast('功能開發中'))}
        ${_buildMarketRow('大宗商品', '黃金、原油、銅價', '🛢️', () => PRO.toast('功能開發中'))}
        ${_buildMarketRow('美債殖利率', '10年期、2年期倒掛', '📉', () => PRO.toast('功能開發中'))}
        ${_buildMarketRow('利率與通膨', 'FED 利率、CPI、PCE', '🏦', () => PRO.toast('功能開發中'))}
        ${_buildMarketRow('經濟行事曆', '本週重要數據發布', '📅', () => PRO.toast('功能開發中'), false)}
      </div>
    </div>
    
    <div style="text-align:center;font-size:11px;color:var(--text-tertiary);margin-top:16px;">
      數據來自外部 API，僅供參考，不構成投資建議。
    </div>
  </div>
</div>`;
  }

  function _buildMarketRow(title, sub, icon, onClick, border = true) {
    return `
<div class="tappable" style="display:flex;align-items:center;padding:16px;${border ? 'border-bottom:1px solid var(--border);' : ''}" onclick="(${onClick.toString()})()">
  <div style="width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:16px;margin-right:12px;">${icon}</div>
  <div style="flex:1;">
    <div style="font-size:14px;font-weight:600;">${title}</div>
    <div style="font-size:11px;color:var(--text-secondary);">${sub}</div>
  </div>
  <div style="color:var(--text-tertiary);">›</div>
</div>`;
  }

  return { open };
})();