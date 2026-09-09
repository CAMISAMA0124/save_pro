'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.marginCalc = (() => {
  // { assetId: pledgeQty }
  let _pledgeQty = {};
  let _loanAmt   = 0;
  let _rate      = 2.89;
  let _maintPct  = 130;

  const PLEDGE_TYPES = ['tw_stock','us_stock','tw_etf','us_etf','bond','stock','etf'];

  function open() {
    _pledgeQty = {};
    _loanAmt   = 0;
    _rate      = 2.89;
    _maintPct  = 130;
    _render();
  }

  function _render() {
    const s      = PRO.state.get();
    const assets = (s.assets || []).filter(a => PLEDGE_TYPES.includes(a.type));

    // Compute totals from pledge selections
    let totalPledgeVal = 0, maxLoanable = 0;
    assets.forEach(a => {
      const qty   = parseFloat(_pledgeQty[a.id] || 0);
      const price = parseFloat(a.price || a.costPrice || 0);
      const val   = qty * price;
      totalPledgeVal += val;
      maxLoanable    += val * 0.6;
    });

    if (_loanAmt > maxLoanable) _loanAmt = maxLoanable;

    // Annual interest cost
    const annualInterest  = _loanAmt * (_rate / 100);
    const monthlyInterest = annualInterest / 12;

    // Maintenance ratio warning threshold
    // When asset drops to: loan * (maintPct/100), margin call triggers
    const warningAssetVal = _loanAmt > 0 ? (_loanAmt * _maintPct / 100) : 0;
    const warningDropPct  = totalPledgeVal > 0 && _loanAmt > 0
      ? ((totalPledgeVal - warningAssetVal) / totalPledgeVal * 100)
      : 0;

    const html = `
<div style="padding:0 0 80px;">
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(28,28,30,0.95);backdrop-filter:blur(10px);z-index:10;">
    <div style="font-size:20px;font-weight:700;">質押借款計算器</div>
    <button onclick="PRO.sheet.close()" style="background:none;border:none;color:var(--accent);font-size:16px;font-weight:600;cursor:pointer;">關閉</button>
  </div>

  <div style="padding:16px;">
    <!-- Asset selection -->
    <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:10px;">選擇質押標的（台股・整合帳戶）</div>

    ${assets.length === 0 ? `
    <div style="text-align:center;padding:40px 20px;color:var(--text-secondary);font-size:14px;">
      尚無可質押資產<br>
      <span style="font-size:12px;color:var(--text-tertiary);">請先在「資產」頁面新增股票或ETF</span>
    </div>` : ''}

    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
      ${assets.map(a => {
        const isSel  = (_pledgeQty[a.id] || 0) > 0;
        const price  = parseFloat(a.price || a.costPrice || 0);
        const qty    = parseFloat(a.quantity || 0);
        const val    = qty * price;
        const pQty   = parseFloat(_pledgeQty[a.id] || 0);
        const pVal   = pQty * price;
        return `
        <div class="card" style="padding:14px;border:1px solid ${isSel ? 'var(--brand)' : 'transparent'};">
          <!-- Top row: checkbox + name + value -->
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:${isSel ? '12px' : '0'};" onclick="PRO.marginCalc._toggle('${a.id}', ${qty})">
            <div style="width:22px;height:22px;border-radius:6px;border:2px solid ${isSel ? 'var(--brand)' : 'var(--text-tertiary)'};background:${isSel ? 'var(--brand)' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;">
              ${isSel ? '<span style="color:#000;font-size:13px;font-weight:800;">✓</span>' : ''}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:15px;">${a.symbol || ''} <span style="font-size:12px;color:var(--text-secondary);font-weight:400;">${a.name || ''}</span></div>
              <div style="font-size:12px;color:var(--text-secondary);">現價 ${PRO.fmt.money(price,'TWD')} &nbsp;持有 ${qty.toLocaleString()}</div>
              ${!isSel ? `<div style="font-size:11px;color:var(--brand);margin-top:2px;">可質押 ${qty.toLocaleString()}</div>` : ''}
            </div>
            ${isSel ? `<div style="font-size:14px;font-weight:700;color:var(--brand);flex-shrink:0;">${PRO.fmt.money(pVal,'TWD')}</div>` : `<div style="font-size:13px;color:var(--text-secondary);flex-shrink:0;">${PRO.fmt.money(val,'TWD')}</div>`}
          </div>

          <!-- Qty input row (only when selected) -->
          ${isSel ? `
          <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:10px 12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-size:12px;color:var(--text-secondary);">質押數量</span>
              <button onclick="PRO.marginCalc._setQtyAll('${a.id}',${qty})" style="background:var(--brand);border:none;border-radius:6px;color:#000;font-size:11px;font-weight:700;padding:3px 10px;cursor:pointer;">全部</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <input type="number" min="1" max="${qty}" value="${pQty}"
                style="flex:1;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,0.07);border:1px solid var(--border);color:var(--text-primary);font-size:18px;font-weight:700;"
                oninput="PRO.marginCalc._setQty('${a.id}', this.value, ${qty})">
            </div>
            <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">上限 ${qty.toLocaleString()}</div>
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>

    <!-- Summary -->
    <div style="background:var(--bg-elevated);border-radius:14px;padding:14px 16px;margin-bottom:20px;">
      <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:10px;">質押摘要（${Object.values(_pledgeQty).filter(q=>q>0).length} 檔標的）</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="text-align:center;background:rgba(255,255,255,0.04);border-radius:10px;padding:10px;">
          <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;">質押總市值</div>
          <div style="font-size:17px;font-weight:800;color:var(--brand);">${PRO.fmt.money(totalPledgeVal,'TWD')}</div>
        </div>
        <div style="text-align:center;background:rgba(255,255,255,0.04);border-radius:10px;padding:10px;">
          <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;">最多可借 (60%)</div>
          <div style="font-size:17px;font-weight:800;color:var(--brand);">${PRO.fmt.money(maxLoanable,'TWD')}</div>
        </div>
      </div>
    </div>

    <!-- Loan conditions -->
    <div style="font-size:14px;font-weight:700;margin-bottom:12px;">借款條件設定</div>

    <div class="card" style="margin-bottom:10px;padding:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-size:14px;font-weight:600;">借款金額 (TWD)</div>
        <div style="font-size:12px;color:var(--text-tertiary);">最多 ${PRO.fmt.money(maxLoanable,'TWD')}</div>
      </div>
      <input type="number" value="${Math.round(_loanAmt)}" min="0" max="${Math.round(maxLoanable)}"
        style="width:100%;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--text-primary);font-size:18px;font-weight:700;box-sizing:border-box;margin-bottom:10px;"
        oninput="PRO.marginCalc._setLoanAmt(this.value, ${maxLoanable})">
      <div style="display:flex;gap:8px;">
        ${[['20%', 0.2],['30%', 0.3],['50%', 0.5],['MAX', 1.0]].map(([label, ratio]) => {
          const amt = Math.round(maxLoanable * ratio);
          const active = Math.abs(_loanAmt - amt) < 1;
          return `<button onclick="PRO.marginCalc._setLoanAmt(${amt}, ${maxLoanable})" style="flex:1;padding:7px 4px;border-radius:8px;border:none;font-size:13px;font-weight:700;cursor:pointer;background:${active ? 'var(--brand)' : 'rgba(255,255,255,0.1)'};color:${active ? '#000' : 'var(--text-primary)'};">${label}</button>`;
        }).join('')}
      </div>
    </div>

    <div class="card" style="margin-bottom:10px;padding:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:14px;font-weight:600;">年利率 (%)</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="number" value="${_rate}" min="0" max="30" step="0.01"
            style="width:80px;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,0.07);border:1px solid var(--border);color:var(--text-primary);font-size:16px;font-weight:700;text-align:right;"
            oninput="PRO.marginCalc._setRate(this.value)">
          <span style="font-size:14px;color:var(--text-secondary);">%</span>
        </div>
      </div>
      ${_loanAmt > 0 ? `
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-size:13px;">
        <span style="color:var(--text-secondary);">年利息</span>
        <span style="color:var(--accent-red);font-weight:700;">${PRO.fmt.money(annualInterest,'TWD')}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px;">
        <span style="color:var(--text-secondary);">月利息</span>
        <span style="color:var(--accent-red);font-weight:700;">${PRO.fmt.money(monthlyInterest,'TWD')}</span>
      </div>` : ''}
    </div>

    <div class="card" style="margin-bottom:20px;padding:14px;">
      <div style="font-size:14px;font-weight:600;margin-bottom:10px;">維持率警戒線 (%)</div>
      <div style="display:flex;gap:8px;margin-bottom:${_loanAmt > 0 ? '12px' : '0'};">
        ${[130, 140, 150].map(pct => {
          const active = _maintPct === pct;
          return `<button onclick="PRO.marginCalc._setMaint(${pct})" style="flex:1;padding:8px 4px;border-radius:8px;border:none;font-size:14px;font-weight:700;cursor:pointer;background:${active ? '#ff3b30' : 'rgba(255,255,255,0.1)'};color:${active ? '#fff' : 'var(--text-primary)'};">${pct}%</button>`;
        }).join('')}
      </div>
      ${_loanAmt > 0 ? `
      <div style="background:rgba(255,59,48,0.08);border-radius:10px;padding:12px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
          <span style="color:var(--text-secondary);">補繳警戒市值</span>
          <span style="color:var(--accent-red);font-weight:700;">${PRO.fmt.money(warningAssetVal,'TWD')}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;">
          <span style="color:var(--text-secondary);">資產可跌幅度</span>
          <span style="color:var(--accent-red);font-weight:700;">▼ ${warningDropPct.toFixed(1)}%</span>
        </div>
      </div>` : ''}
    </div>
  </div>
</div>`;

    if (!document.getElementById('sheet-overlay').classList.contains('active')) {
      PRO.sheet.open(html);
    } else {
      document.getElementById('sheet-body').innerHTML = html;
    }
  }

  function _toggle(id, maxQty) {
    if ((_pledgeQty[id] || 0) > 0) {
      _pledgeQty[id] = 0;
    } else {
      _pledgeQty[id] = maxQty;
    }
    _render();
  }

  function _setQty(id, val, maxQty) {
    let q = parseFloat(val) || 0;
    if (q > maxQty) q = maxQty;
    if (q < 0) q = 0;
    _pledgeQty[id] = q;
    // Re-render without full redraw to keep focus — use timeout trick
    clearTimeout(PRO.marginCalc._qtyTimer);
    PRO.marginCalc._qtyTimer = setTimeout(_render, 600);
  }

  function _setQtyAll(id, maxQty) {
    _pledgeQty[id] = maxQty;
    _render();
  }

  function _setLoanAmt(val, max) {
    let v = parseFloat(val) || 0;
    if (v > max) v = max;
    if (v < 0) v = 0;
    _loanAmt = v;
    _render();
  }

  function _setRate(val) {
    let v = parseFloat(val);
    if (isNaN(v) || v < 0) v = 0;
    _rate = v;
    clearTimeout(PRO.marginCalc._rateTimer);
    PRO.marginCalc._rateTimer = setTimeout(_render, 600);
  }

  function _setMaint(pct) {
    _maintPct = pct;
    _render();
  }

  return { open, _toggle, _setQty, _setQtyAll, _setLoanAmt, _setRate, _setMaint };
})();
