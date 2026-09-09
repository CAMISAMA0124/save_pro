/* ================================================
   insurance.js - 保險獲利試算 v1
   試算解約金、IRR 報酬率、與指數型投資比較
   ================================================ */
'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.insurance = (() => {

  function open() {
    const html = `
<div class="sheet-title">🛡️ 保險獲利試算 v1</div>
<div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;line-height:1.6;">
  輸入保單基本資訊，自動計算 IRR 內部報酬率、與定存/指數投資的比較。
</div>

<div class="card" style="margin-bottom:12px;padding:16px;">
  <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--text-secondary);">保單資訊</div>

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <div style="font-size:14px;">每年保費 (TWD)</div>
    <input type="number" id="ins-premium" class="form-input" style="width:140px;text-align:right;" placeholder="60,000" value="60000">
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <div style="font-size:14px;">繳費年期 (年)</div>
    <input type="number" id="ins-years" class="form-input" style="width:140px;text-align:right;" placeholder="20" value="20" min="1" max="40">
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <div style="font-size:14px;">滿期/解約金 (TWD)</div>
    <input type="number" id="ins-maturity" class="form-input" style="width:140px;text-align:right;" placeholder="1,500,000" value="1500000">
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:14px;">比較指數年化報酬 (%)</div>
    <input type="number" id="ins-index-rate" class="form-input" style="width:140px;text-align:right;" placeholder="7" value="7" step="0.5">
  </div>
</div>

<button class="btn btn-primary" onclick="PRO.insurance._calc()" style="width:100%;margin-bottom:16px;">試算</button>

<div id="ins-result"></div>
`;
    PRO.sheet.open(html);
  }

  function _calc() {
    const premium  = parseFloat(document.getElementById('ins-premium')?.value) || 0;
    const years    = parseInt(document.getElementById('ins-years')?.value) || 20;
    const maturity = parseFloat(document.getElementById('ins-maturity')?.value) || 0;
    const idxRate  = parseFloat(document.getElementById('ins-index-rate')?.value) / 100 || 0.07;

    const totalPaid = premium * years;
    const profit = maturity - totalPaid;
    const roi = totalPaid > 0 ? (profit / totalPaid * 100) : 0;

    // IRR via Newton-Raphson (cashflows: pay premium each year, receive maturity at end)
    const irr = _computeIRR(premium, years, maturity);

    // 定存 1.5%
    const savingsVal = _futureValueSeries(premium, years, 0.015);
    // 指數投資
    const indexVal   = _futureValueSeries(premium, years, idxRate);

    const irrColor  = irr >= idxRate ? 'var(--brand)' : (irr >= 0.015 ? 'var(--accent-yellow)' : 'var(--accent-red)');
    const irrLabel  = irr >= idxRate ? '優於指數' : (irr >= 0.015 ? '優於定存' : '不如定存');

    const html = `
<div class="card fade-in" style="padding:16px;margin-bottom:12px;">
  <div style="font-size:13px;font-weight:600;margin-bottom:14px;color:var(--text-secondary);">試算結果</div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <div style="font-size:15px;font-weight:600;">總繳保費</div>
    <div style="font-size:15px;font-weight:700;">${PRO.fmt.money(totalPaid, 'TWD')}</div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <div style="font-size:15px;font-weight:600;">滿期獲利</div>
    <div style="font-size:15px;font-weight:700;color:${profit >= 0 ? 'var(--brand)' : 'var(--accent-red)'};">${profit >= 0 ? '+' : ''}${PRO.fmt.money(profit, 'TWD')}</div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
    <div style="font-size:15px;font-weight:600;">總 ROI</div>
    <div style="font-size:15px;font-weight:700;">${roi.toFixed(2)}%</div>
  </div>
  <div style="height:1px;background:var(--border);margin:12px 0;"></div>
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:18px;font-weight:900;color:${irrColor};">${(irr * 100).toFixed(2)}%</div>
      <div style="font-size:11px;color:var(--text-secondary);">年化 IRR</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:13px;font-weight:700;color:${irrColor};">${irrLabel}</div>
      <div style="font-size:11px;color:var(--text-secondary);">與指數 ${(idxRate*100).toFixed(1)}% 相比</div>
    </div>
  </div>
</div>

<div class="card fade-in" style="padding:16px;">
  <div style="font-size:13px;font-weight:600;margin-bottom:14px;color:var(--text-secondary);">假如把保費拿去投資 (${years} 年後)</div>
  ${_row('🛡️ 本保單', maturity, maturity)}
  ${_row('🏦 定存 1.5%', savingsVal, maturity)}
  ${_row(`📈 指數 ${(idxRate*100).toFixed(1)}%`, indexVal, maturity)}
</div>
`;
    document.getElementById('ins-result').innerHTML = html;
  }

  function _row(label, value, baseVal) {
    const pct = baseVal > 0 ? Math.round(value / baseVal * 100) : 0;
    const color = value >= baseVal ? 'var(--brand)' : 'var(--accent-red)';
    return `
<div style="margin-bottom:12px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
    <div style="font-size:13px;">${label}</div>
    <div style="font-size:13px;font-weight:700;color:${color};">${PRO.fmt.money(Math.round(value), 'TWD')}</div>
  </div>
  <div style="width:100%;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
    <div style="width:${Math.min(pct,100)}%;height:100%;background:${color};border-radius:3px;"></div>
  </div>
</div>`;
  }

  // IRR: sum of PV(cashflows) = 0
  // CFs: pay -premium each year t=1..years, receive +maturity at t=years
  function _computeIRR(premium, years, maturity) {
    let r = 0.02;
    for (let i = 0; i < 200; i++) {
      let npv = 0, dnpv = 0;
      for (let t = 1; t <= years; t++) {
        const disc = Math.pow(1 + r, t);
        npv  += -premium / disc;
        dnpv += premium * t / Math.pow(1 + r, t + 1);
      }
      npv  += maturity / Math.pow(1 + r, years);
      dnpv -= maturity * years / Math.pow(1 + r, years + 1);
      const nr = r - npv / dnpv;
      if (Math.abs(nr - r) < 1e-8) return Math.max(-1, Math.min(1, nr));
      r = nr;
    }
    return r;
  }

  // FV of annual investment (end of year)
  function _futureValueSeries(annual, years, rate) {
    if (rate === 0) return annual * years;
    return annual * (Math.pow(1 + rate, years) - 1) / rate;
  }

  return { open, _calc };
})();
