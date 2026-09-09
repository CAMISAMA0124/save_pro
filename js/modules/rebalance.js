'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.rebalance = (() => {
  let _step = 'main'; // 'main', 'onboarding', 'select_target'

  function openRebalanceSheet() {
    const s = PRO.state.get();
    if (!s.clecStrategy || !s.clecStrategy.enabled) {
      _step = 'onboarding';
    } else {
      _step = 'main';
    }
    _render();
  }

  function _render() {
    const s = PRO.state.get();
    let html = '';
    
    if (_step === 'onboarding') {
      html = _buildOnboarding();
    } else if (_step === 'select_target') {
      html = _buildSelectTarget(s);
    } else {
      html = _buildMain(s);
    }

    if (!document.getElementById('sheet-overlay').classList.contains('active')) {
      PRO.sheet.open(html);
    } else {
      document.getElementById('sheet-body').innerHTML = html;
    }
  }

  function _buildOnboarding() {
    return `
<div style="padding:40px 20px;text-align:center;">
  <div style="font-size:64px;margin-bottom:20px;">📊</div>
  <div style="font-size:24px;font-weight:800;margin-bottom:12px;">CLEC 投資策略</div>
  <div style="font-size:14px;color:var(--text-secondary);line-height:1.6;margin-bottom:40px;">
    Cash, Leverage, Equity, Crypto<br>
    打造全天候抗跌資產配置，自動監控部位偏離度，提供再平衡建議。
  </div>
  <button onclick="PRO.rebalance._setStep('select_target')" style="width:100%;padding:16px;border-radius:16px;background:var(--accent);color:#fff;font-size:16px;font-weight:600;border:none;cursor:pointer;">開始設定目標比例</button>
</div>`;
  }

  function _buildSelectTarget(s) {
    const templates = [
      { name: '傳統股債', desc: '適合穩健型投資者', c:20, l:0, e:80, cr:0 },
      { name: '積極成長', desc: '追求長期高報酬', c:10, l:10, e:70, cr:10 },
      { name: '全天候', desc: '抗通膨與市場波動', c:25, l:25, e:25, cr:25 },
      { name: '加密貨幣狂熱', desc: '高風險極高報酬', c:5, l:0, e:15, cr:80 }
    ];
    
    return `
<div style="padding:0 0 80px;">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);z-index:10;">
    <div style="font-size:20px;font-weight:700;">設定目標比例</div>
    <button onclick="PRO.sheet.close()" style="background:none;border:none;color:var(--text-tertiary);font-size:24px;cursor:pointer;">✕</button>
  </div>
  
  <div style="padding:16px;">
    <div style="font-size:14px;font-weight:600;margin-bottom:12px;">選擇配置範本</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
      ${templates.map((t, idx) => `
        <div class="card tappable" style="border:1px solid var(--border);padding:12px;" onclick="PRO.rebalance._applyTemplate(${t.c},${t.l},${t.e},${t.cr})">
          <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${t.name}</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;">${t.desc}</div>
          <div style="font-size:10px;display:flex;gap:4px;color:var(--text-tertiary);">
            <span>C:${t.c}%</span> <span>L:${t.l}%</span> <span>E:${t.e}%</span> <span>Cr:${t.cr}%</span>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div style="font-size:14px;font-weight:600;margin-bottom:12px;">自訂比例 (需等於 100%)</div>
    <div style="background:var(--bg-card);border-radius:12px;padding:16px;">
      ${_buildRangeInput('Cash (現金)', 'c', 25, 'var(--accent-teal)')}
      ${_buildRangeInput('Leverage (槓桿)', 'l', 25, 'var(--accent-purple)')}
      ${_buildRangeInput('Equity (股票)', 'e', 25, 'var(--brand)')}
      ${_buildRangeInput('Crypto (加密)', 'cr', 25, 'var(--accent-yellow)')}
      <div id="clec-total" style="text-align:right;font-size:14px;font-weight:700;margin-top:16px;">總計: 100%</div>
    </div>
    
    <button onclick="PRO.rebalance._saveTargets()" style="width:100%;margin-top:24px;padding:16px;border-radius:16px;background:var(--brand);color:#000;font-size:16px;font-weight:600;border:none;cursor:pointer;">儲存設定</button>
  </div>
</div>`;
  }
  
  function _buildRangeInput(label, id, val, color) {
    return `
<div style="margin-bottom:16px;">
  <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px;">
    <span>${label}</span>
    <span id="clec-val-${id}" style="font-weight:600;color:${color};">${val}%</span>
  </div>
  <input type="range" id="clec-input-${id}" min="0" max="100" value="${val}" oninput="PRO.rebalance._updateTotal()"
    style="background:linear-gradient(to right, ${color} 0%, ${color} ${val}%, rgba(255,255,255,0.15) ${val}%)">
</div>`;
  }

  function _buildMain(s) {
    const targets = s.clecStrategy.targets || { cash: 25, leverage: 25, equity: 25, crypto: 25 };
    
    // 計算現有資產分類
    let cash = 0, equity = 0, crypto = 0;
    const assets = s.assets || [];
    assets.forEach(a => {
      const v = parseFloat(a.price || a.costPrice || 0) * parseFloat(a.quantity || 1) || 0;
      if (a.type === 'cash') cash += v;
      else if (a.type === 'crypto') crypto += v;
      else equity += v; // stock, etf, fund
    });
    
    const liabilities = s.liabilities || [];
    const leverage = liabilities.reduce((sum, l) => sum + (parseFloat(l.remainingPrincipal) || 0), 0);
    
    // 計算比例
    // Note: CLEC is calculated based on Gross Assets (Total Assets + Leverage exposure)
    // Here we use simplified Gross = cash + equity + crypto + leverage_debt for ratio calculation.
    const gross = cash + equity + crypto + leverage;
    
    const actual = {
      cash: gross > 0 ? (cash/gross)*100 : 0,
      leverage: gross > 0 ? (leverage/gross)*100 : 0,
      equity: gross > 0 ? (equity/gross)*100 : 0,
      crypto: gross > 0 ? (crypto/gross)*100 : 0
    };
    
    const totalDiff = Math.abs(actual.cash - targets.cash) + Math.abs(actual.leverage - targets.leverage) + Math.abs(actual.equity - targets.equity) + Math.abs(actual.crypto - targets.crypto);
    const deviation = totalDiff / 2; // Portfolio deviation
    
    const isAlert = deviation > 5;

    return `
<div style="padding:0 0 80px;">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);z-index:10;">
    <div style="font-size:20px;font-weight:700;">CLEC 策略</div>
    <div style="display:flex;gap:12px;">
      <button onclick="PRO.rebalance._setStep('select_target')" style="background:none;border:none;color:var(--accent);font-size:15px;cursor:pointer;">設定</button>
      <button onclick="PRO.sheet.close()" style="background:none;border:none;color:var(--text-tertiary);font-size:20px;cursor:pointer;">✕</button>
    </div>
  </div>
  
  <div style="padding:16px;">
    <!-- 偏離度卡片 -->
    <div style="background:var(--bg-card);border-radius:16px;padding:20px;margin-bottom:16px;text-align:center;border:${isAlert?'1px solid rgba(255,59,48,0.5)':'1px solid transparent'};">
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">投資組合偏離度</div>
      <div style="font-size:36px;font-weight:800;color:${isAlert?'var(--accent-red)':'var(--brand)'};margin-bottom:4px;">${deviation.toFixed(1)}%</div>
      <div style="font-size:13px;color:var(--text-tertiary);">${isAlert?'偏離過大，建議執行再平衡':'配置健康，無需調整'}</div>
    </div>
    
    <!-- CLEC Bars -->
    <div style="background:var(--bg-card);border-radius:16px;padding:16px;margin-bottom:16px;">
      ${_buildCompareBar('Cash 現金', actual.cash, targets.cash, 'var(--accent-teal)')}
      ${_buildCompareBar('Leverage 槓桿', actual.leverage, targets.leverage, 'var(--accent-purple)')}
      ${_buildCompareBar('Equity 股票', actual.equity, targets.equity, 'var(--brand)')}
      ${_buildCompareBar('Crypto 加密', actual.crypto, targets.crypto, 'var(--accent-yellow)')}
    </div>
    
    <!-- 再平衡建議 -->
    <div style="font-size:14px;font-weight:600;margin-bottom:12px;margin-top:24px;">再平衡建議</div>
    <div style="background:var(--bg-card);border-radius:16px;padding:16px;color:var(--text-secondary);font-size:13px;line-height:1.6;">
      ${isAlert ? '系統偵測到資產配置已偏離目標超過 5%。建議賣出超配資產（例如：加密貨幣），並買入低配資產（例如：現金/債券）以降低風險。' : '目前資產配置與目標一致。維持紀律，定期檢查即可。'}
    </div>
  </div>
</div>`;
  }
  
  function _buildCompareBar(label, actual, target, color) {
    const diff = actual - target;
    const diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
    
    return `
<div style="margin-bottom:16px;">
  <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:6px;">
    <span style="font-weight:600;">${label}</span>
    <span style="color:var(--text-tertiary);">目標 ${target}% <span style="margin:0 4px;">|</span> 實際 <span style="color:${color};font-weight:600;">${actual.toFixed(1)}%</span></span>
  </div>
  <div style="display:flex;align-items:center;gap:12px;">
    <div style="flex:1;height:8px;background:rgba(255,255,255,0.05);border-radius:4px;position:relative;overflow:hidden;">
      <div style="position:absolute;left:0;top:0;height:100%;background:${color};width:${actual}%;opacity:0.6;border-radius:4px;"></div>
      <div style="position:absolute;left:0;top:0;height:100%;background:${color};width:${target}%;border-right:2px solid #fff;border-radius:4px 0 0 4px;"></div>
    </div>
    <div style="width:45px;text-align:right;font-size:12px;font-weight:600;color:${Math.abs(diff)>5?'var(--accent-red)':'var(--text-secondary)'};">
      ${diffStr}
    </div>
  </div>
</div>`;
  }

  function _setStep(step) {
    _step = step;
    _render();
  }
  
  function _applyTemplate(c, l, e, cr) {
    document.getElementById('clec-input-c').value = c;
    document.getElementById('clec-input-l').value = l;
    document.getElementById('clec-input-e').value = e;
    document.getElementById('clec-input-cr').value = cr;
    _updateTotal();
  }
  
  function _updateTotal() {
    const c = parseInt(document.getElementById('clec-input-c').value) || 0;
    const l = parseInt(document.getElementById('clec-input-l').value) || 0;
    const e = parseInt(document.getElementById('clec-input-e').value) || 0;
    const cr = parseInt(document.getElementById('clec-input-cr').value) || 0;
    
    document.getElementById('clec-val-c').textContent = c + '%';
    document.getElementById('clec-val-l').textContent = l + '%';
    document.getElementById('clec-val-e').textContent = e + '%';
    document.getElementById('clec-val-cr').textContent = cr + '%';
    
    const total = c + l + e + cr;
    const tt = document.getElementById('clec-total');
    tt.textContent = `總計: ${total}%`;
    tt.style.color = total === 100 ? 'var(--brand)' : 'var(--accent-red)';
  }
  
  function _saveTargets() {
    const c = parseInt(document.getElementById('clec-input-c').value) || 0;
    const l = parseInt(document.getElementById('clec-input-l').value) || 0;
    const e = parseInt(document.getElementById('clec-input-e').value) || 0;
    const cr = parseInt(document.getElementById('clec-input-cr').value) || 0;
    
    if (c + l + e + cr !== 100) {
      PRO.toast('比例加總必須為 100%', 'error');
      return;
    }
    
    try {
      const raw = localStorage.getItem('jizhangpro_v1');
      const state = raw ? JSON.parse(raw) : {};
      if (!state.clecStrategy) state.clecStrategy = { enabled: false, assets: [], targets: {} };
      state.clecStrategy.enabled = true;
      state.clecStrategy.targets = { cash: c, leverage: l, equity: e, crypto: cr };
      localStorage.setItem('jizhangpro_v1', JSON.stringify(state));
      
      PRO.toast('✅ 策略設定已儲存');
      _step = 'main';
      _render();
    } catch(err) {
      PRO.toast('儲存失敗', 'error');
    }
  }

  return { openRebalanceSheet, _setStep, _applyTemplate, _updateTotal, _saveTargets };
})();