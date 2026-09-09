/* ================================================
   dividend.js - 存股配息試算機
   功能：
   1. 正算：輸入股數與殖利率/配息，算出年/月配息額
   2. 逆算：輸入目標月配息，算出需要買多少張、準備多少本金
   ================================================ */

'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.dividend = (() => {

  function openDividendSheet() {
    const html = `
<div class="sheet-title">存股配息試算</div>
<div style="margin-bottom:16px;">
  <div class="segmented-control" style="display:flex;background:rgba(255,255,255,0.05);border-radius:var(--radius-sm);padding:4px;">
    <button class="btn-seg active" id="seg-calc-income" style="flex:1;border:none;background:var(--bg-input);color:var(--text-primary);padding:6px;border-radius:6px;font-size:13px;font-weight:600;">算配息</button>
    <button class="btn-seg" id="seg-calc-target" style="flex:1;border:none;background:transparent;color:var(--text-secondary);padding:6px;border-radius:6px;font-size:13px;">算本金 (達成目標)</button>
  </div>
</div>

<div id="div-mode-income">
  <div class="form-group">
    <label class="form-label">股票代號或名稱 (選填)</label>
    <input class="form-input" id="div-symbol" placeholder="輸入代號，系統會嘗試帶入現價" />
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div class="form-group">
      <label class="form-label">股價 (元)</label>
      <input class="form-input" id="div-price" type="number" step="any" placeholder="例如：50" />
    </div>
    <div class="form-group">
      <label class="form-label">殖利率 (%)</label>
      <input class="form-input" id="div-yield" type="number" step="any" placeholder="例如：5" />
    </div>
  </div>
  <div class="form-group">
    <label class="form-label">持有股數 (1張=1000股)</label>
    <input class="form-input" id="div-qty" type="number" step="any" placeholder="例如：10000" />
  </div>
  <div style="margin-top:24px;padding:16px;background:rgba(10,132,255,0.1);border-radius:12px;border:1px solid rgba(10,132,255,0.2);">
    <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
      <div style="color:var(--text-secondary);font-size:13px;">投入總本金</div>
      <div style="font-weight:600;" id="div-res-principal">NT$0</div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
      <div style="color:var(--text-secondary);font-size:13px;">每年預估配息</div>
      <div style="font-weight:600;color:var(--brand);" id="div-res-yearly">NT$0</div>
    </div>
    <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px dashed rgba(255,255,255,0.1);">
      <div style="color:var(--text-secondary);font-size:13px;">平均每月加薪</div>
      <div style="font-weight:700;font-size:18px;color:var(--brand);" id="div-res-monthly">NT$0</div>
    </div>
  </div>
</div>

<div id="div-mode-target" style="display:none;">
  <div class="form-group">
    <label class="form-label">目標：平均每月配息 (元)</label>
    <input class="form-input" id="div-target-income" type="number" step="any" placeholder="例如：10000" />
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div class="form-group">
      <label class="form-label">股價 (元)</label>
      <input class="form-input" id="div-target-price" type="number" step="any" placeholder="例如：50" />
    </div>
    <div class="form-group">
      <label class="form-label">預估殖利率 (%)</label>
      <input class="form-input" id="div-target-yield" type="number" step="any" placeholder="例如：5" />
    </div>
  </div>
  <div style="margin-top:24px;padding:16px;background:rgba(52,199,89,0.1);border-radius:12px;border:1px solid rgba(52,199,89,0.2);">
    <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
      <div style="color:var(--text-secondary);font-size:13px;">每年需配發總額</div>
      <div style="font-weight:600;color:var(--pos);" id="div-req-yearly">NT$0</div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
      <div style="color:var(--text-secondary);font-size:13px;">需要存到幾股 (張)</div>
      <div style="font-weight:600;" id="div-req-shares">0 股 (0 張)</div>
    </div>
    <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px dashed rgba(255,255,255,0.1);">
      <div style="color:var(--text-secondary);font-size:13px;">需要準備本金</div>
      <div style="font-weight:700;font-size:18px;color:var(--pos);" id="div-req-principal">NT$0</div>
    </div>
  </div>
</div>
`;

    PRO.sheet.open(html);
    _bindEvents();
  }

  function _bindEvents() {
    const btnIncome = document.getElementById('seg-calc-income');
    const btnTarget = document.getElementById('seg-calc-target');
    const pnlIncome = document.getElementById('div-mode-income');
    const pnlTarget = document.getElementById('div-mode-target');

    btnIncome.addEventListener('click', () => {
      btnIncome.style.background = 'var(--bg-input)';
      btnIncome.style.color = 'var(--text-primary)';
      btnTarget.style.background = 'transparent';
      btnTarget.style.color = 'var(--text-secondary)';
      pnlIncome.style.display = 'block';
      pnlTarget.style.display = 'none';
    });

    btnTarget.addEventListener('click', () => {
      btnTarget.style.background = 'var(--bg-input)';
      btnTarget.style.color = 'var(--text-primary)';
      btnIncome.style.background = 'transparent';
      btnIncome.style.color = 'var(--text-secondary)';
      pnlTarget.style.display = 'block';
      pnlIncome.style.display = 'none';
    });

    // Auto Quote lookup
    const symInput = document.getElementById('div-symbol');
    if (symInput) {
      symInput.addEventListener('blur', async (e) => {
        let sym = e.target.value.trim().toUpperCase();
        if (!sym) return;
        if (/^\d{4,6}$/.test(sym)) sym += '.TW';
        e.target.value = sym;
        
        try {
          const key = (PRO.state.get().settings || {}).fugleApiKey || '';
          const data = await PRO.api.getQuote(sym, key);
          if (data && data.quote && data.quote.regularMarketPrice) {
            document.getElementById('div-price').value = data.quote.regularMarketPrice;
            document.getElementById('div-target-price').value = data.quote.regularMarketPrice;
            _calcIncome();
            _calcTarget();
            PRO.toast(`已帶入 ${sym} 股價`, 'success');
          }
        } catch (err) {}
      });
    }

    // Live Calculation for Income Mode
    ['div-price', 'div-yield', 'div-qty'].forEach(id => {
      document.getElementById(id).addEventListener('input', _calcIncome);
    });

    // Live Calculation for Target Mode
    ['div-target-income', 'div-target-price', 'div-target-yield'].forEach(id => {
      document.getElementById(id).addEventListener('input', _calcTarget);
    });
  }

  function _calcIncome() {
    const price = parseFloat(document.getElementById('div-price').value) || 0;
    const yld = parseFloat(document.getElementById('div-yield').value) || 0;
    const qty = parseFloat(document.getElementById('div-qty').value) || 0;

    const principal = price * qty;
    const yearly = principal * (yld / 100);
    const monthly = yearly / 12;

    document.getElementById('div-res-principal').textContent = PRO.fmt.money(principal, 'TWD');
    document.getElementById('div-res-yearly').textContent = PRO.fmt.money(yearly, 'TWD');
    document.getElementById('div-res-monthly').textContent = PRO.fmt.money(monthly, 'TWD');
  }

  function _calcTarget() {
    const targetMonthly = parseFloat(document.getElementById('div-target-income').value) || 0;
    const price = parseFloat(document.getElementById('div-target-price').value) || 0;
    const yld = parseFloat(document.getElementById('div-target-yield').value) || 0;

    const targetYearly = targetMonthly * 12;
    document.getElementById('div-req-yearly').textContent = PRO.fmt.money(targetYearly, 'TWD');

    if (yld > 0 && price > 0) {
      const requiredPrincipal = targetYearly / (yld / 100);
      const requiredShares = requiredPrincipal / price;
      
      document.getElementById('div-req-principal').textContent = PRO.fmt.money(requiredPrincipal, 'TWD');
      document.getElementById('div-req-shares').textContent = `${PRO.fmt.num(requiredShares)} 股 (${PRO.fmt.num(requiredShares/1000, 1)} 張)`;
    } else {
      document.getElementById('div-req-principal').textContent = 'NT$0';
      document.getElementById('div-req-shares').textContent = '0 股 (0 張)';
    }
  }

  return { openDividendSheet };
})();
