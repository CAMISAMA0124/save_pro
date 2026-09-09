/* ================================================
   liabilities.js - 負債頁面
   ================================================ */

'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.liabilities = (() => {

  function init() {
    _render();
    _bindHeaderActions();
  }

  function _render() {
    const container = document.getElementById('liabilities-content');
    if (!container) return;
    const state = PRO.state.get();
    const libs = state.liabilities || [];

    if (!libs.length) {
      container.innerHTML = _renderEmpty();
      container.querySelector('#btn-add-liability-empty')?.addEventListener('click', openAddSheet);
      _updateHeaderActions(false);
      return;
    }

    let totalRemaining = 0;
    let nextMonthTotal = 0;

    libs.forEach(L => {
      totalRemaining += L.remaining || 0;
      nextMonthTotal += L.monthlyPayment || 0;
    });

    const hide = state.settings.hideAmounts;

    let html = `
<div class="card fade-in" style="margin-bottom:16px;">
  <div style="color:var(--text-secondary);font-size:13px;margin-bottom:4px;">總負債</div>
  <div class="amount-large ${hide ? 'amount-hidden' : ''}">
    ${PRO.fmt.hide(PRO.fmt.money(totalRemaining, 'TWD', true))}
  </div>
  <div style="font-size:14px;margin-top:4px;color:var(--text-secondary);">
    預計下期應繳：<span style="color:var(--text-primary);font-weight:600;">${PRO.fmt.money(nextMonthTotal, 'TWD')}</span>
  </div>
</div>`;

    function _estRemPeriods(remaining, pmt, rate) {
        if (remaining <= 0) return 0;
        if (!pmt || pmt <= 0) return 999;
        const r = rate / 100 / 12;
        if (r === 0) return Math.ceil(remaining / pmt);
        if (pmt <= remaining * r) return 999;
        return Math.max(0, Math.ceil(-Math.log(1 - remaining * r / pmt) / Math.log(1 + r)));
      }

      libs.forEach(L => {
        const pct = L.principal > 0 ? Math.min(100, ((L.principal - (L.remaining||0)) / L.principal) * 100) : 0;
        const remPeriods = _estRemPeriods(L.remaining || 0, L.monthlyPayment, L.rate);
        const paidPeriods = Math.max(0, L.months - remPeriods);
        html += `
<div class="asset-card" data-id="${L.id}">
  <div class="asset-icon" style="background:var(--red);">
    💳
  </div>
  <div class="asset-info" style="flex:1;min-width:0;">
    <div class="asset-symbol">${L.name}</div>
    <div style="margin-top:5px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
        <span style="font-size:11px;color:var(--text-tertiary);">還款進度 ${pct.toFixed(1)}%</span>
        <span style="font-size:11px;color:var(--text-tertiary);">已還 <span style="color:var(--brand);font-weight:600;">${paidPeriods}</span> 期｜剩 <span style="color:var(--accent-red);font-weight:600;">${remPeriods <= 0 ? '✅' : remPeriods}</span> 期</span>
      </div>
      <div style="width:100%;height:5px;background:var(--bg-input);border-radius:3px;overflow:hidden;">
        <div style="width:${pct.toFixed(1)}%;height:100%;border-radius:3px;background:linear-gradient(90deg,var(--brand),#30d158);"></div>
      </div>
    </div>
  </div>
  <div class="asset-right" style="text-align:right;flex-shrink:0;">
    <div class="asset-value ${hide ? 'amount-hidden' : ''}">${PRO.fmt.hide(PRO.fmt.money(L.remaining, 'TWD', true))}</div>
    <div class="asset-change" style="color:var(--text-secondary);">
      月付 ${PRO.fmt.money(L.monthlyPayment, 'TWD')}
    </div>
  </div>
</div>`;
      });

    container.innerHTML = html;
    
    container.querySelectorAll('.asset-card[data-id]').forEach(card => {
      card.addEventListener('click', () => openDetailSheet(card.dataset.id));
    });

    _updateHeaderActions(true);
  }

  function _renderEmpty() {
    return `
<div class="empty-state fade-in">
  <div class="empty-state-icon">💳</div>
  <h2 class="empty-state-title">無任何負債</h2>
  <p class="empty-state-sub">無債一身輕！如果有房貸、信貸等<br/>可以在這裡新增管理</p>
  <div style="height:24px;"></div>
  <button class="btn btn-primary" id="btn-add-liability-empty" style="padding:14px 32px;">+ 新增負債</button>
</div>`;
  }

  function _updateHeaderActions(hasItems) {
    const actions = document.getElementById('page-actions');
    if (!actions) return;
    if (document.getElementById('page-liabilities')?.classList.contains('active')) {
      actions.innerHTML = `<button class="btn-icon" id="btn-add-liability" title="新增負債">➕</button>`;
      actions.querySelector('#btn-add-liability')?.addEventListener('click', openAddSheet);
    }
  }

  function _bindHeaderActions() { _updateHeaderActions(true); }

  function openAddSheet() {
    const html = `
<div class="sheet-title">新增負債</div>
<div class="form-group">
  <label class="form-label">負債名稱</label>
  <input class="form-input" id="lia-name" placeholder="例如：個人信貸、房貸" />
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
  <div class="form-group">
    <label class="form-label">貸款總額 (本金)</label>
    <input class="form-input" id="lia-principal" type="number" min="0" placeholder="0" />
  </div>
  <div class="form-group">
    <label class="form-label">目前剩餘本金</label>
    <input class="form-input" id="lia-remaining" type="number" min="0" placeholder="中途加入可填" />
  </div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
  <div class="form-group">
    <label class="form-label">年利率 (%)</label>
    <input class="form-input" id="lia-rate" type="number" min="0" step="any" placeholder="2.15" />
  </div>
  <div class="form-group">
    <label class="form-label">總期數 (月)</label>
    <input class="form-input" id="lia-months" type="number" min="1" placeholder="84" />
  </div>
</div>
<div class="form-group">
  <label class="form-label">寬限期 (月)</label>
  <input class="form-input" id="lia-grace" type="number" min="0" value="0" />
</div>
<div class="form-group">
  <label class="form-label">還款方式</label>
  <select class="form-select" id="lia-type">
    <option value="pmt">本息平均攤還</option>
    <option value="custom">自訂月繳金額</option>
  </select>
</div>
<div class="form-group" id="lia-pmt-wrapper" style="display:none;">
  <label class="form-label">自訂每月應繳金</label>
  <input class="form-input" id="lia-custom-pmt" type="number" min="0" />
</div>
<div style="display:flex;gap:12px;margin-top:8px;">
  <button class="btn btn-ghost" style="flex:1;" id="btn-lia-cancel">取消</button>
  <button class="btn btn-primary" style="flex:2;" id="btn-lia-confirm">新增負債</button>
</div>`;

    PRO.sheet.open(html);

    document.getElementById('btn-lia-cancel')?.addEventListener('click', () => PRO.sheet.close());

    const typeSelect = document.getElementById('lia-type');
    const customWrapper = document.getElementById('lia-pmt-wrapper');
    typeSelect.addEventListener('change', (e) => {
      customWrapper.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });

    document.getElementById('btn-lia-confirm')?.addEventListener('click', () => {
      const name = document.getElementById('lia-name').value.trim();
      const principal = parseFloat(document.getElementById('lia-principal').value);
      let remaining = parseFloat(document.getElementById('lia-remaining').value);
      const rate = parseFloat(document.getElementById('lia-rate').value) || 0;
      const months = parseInt(document.getElementById('lia-months').value);
      const grace = parseInt(document.getElementById('lia-grace').value) || 0;
      const type = typeSelect.value;
      const customPmt = parseFloat(document.getElementById('lia-custom-pmt').value) || 0;

      if (!name) { PRO.toast('請輸入名稱', 'error'); return; }
      if (!principal) { PRO.toast('請輸入本金', 'error'); return; }
      if (!months) { PRO.toast('請輸入期數', 'error'); return; }

      if (isNaN(remaining)) remaining = principal;

      let monthlyPayment = customPmt;
      
      if (type === 'pmt') {
        const calc = PRO.loanCalc.calcMortgage(principal, rate, months, grace);
        monthlyPayment = calc.monthlyPayment;
      }

      const id = Date.now().toString();
      const liability = {
        id,
        name,
        principal,
        remaining,
        rate,
        months,
        grace,
        type,
        monthlyPayment
      };

      const state = PRO.state.get();
      const libs = state.liabilities || [];
      libs.push(liability);
      PRO.state.patch({ liabilities: libs });

      PRO.sheet.close();
      _render();
      PRO.toast('負債已新增', 'success');
    });
  }

  function openDetailSheet(id) {
    const state = PRO.state.get();
    const libs = state.liabilities || [];
    const L = libs.find(x => x.id === id);
    if (!L) return;

    function _payNPeriods(n) {
      let remaining = L.remaining;
      for (let i = 0; i < n; i++) {
        if (remaining <= 0) break;
        const monthlyRate = L.rate / 100 / 12;
        const interest = Math.round(remaining * monthlyRate);
        const principalPay = L.monthlyPayment - interest;
        remaining = remaining - principalPay;
        if (remaining < 0) remaining = 0;
      }
      return remaining;
    }

    function _calcRemainingPeriods(remaining, pmt, rate) {
      if (remaining <= 0) return 0;
      if (!pmt || pmt <= 0) return 999;
      const r = rate / 100 / 12;
      if (r === 0) return Math.ceil(remaining / pmt);
      if (pmt <= remaining * r) return 999;
      return Math.max(0, Math.ceil(-Math.log(1 - remaining * r / pmt) / Math.log(1 + r)));
    }

    function _renderSheet() {
      const remainingPeriods = _calcRemainingPeriods(L.remaining, L.monthlyPayment, L.rate);
      const paidPeriods = Math.max(0, L.months - remainingPeriods);
      const paidPct = L.principal > 0 ? Math.min(100, ((L.principal - L.remaining) / L.principal) * 100) : 0;
      const paidPctStr = paidPct.toFixed(1);

      const html = `
<div class="sheet-title">${L.name}</div>
<div style="text-align:center;margin-bottom:12px;">
  <div style="color:var(--text-secondary);font-size:13px;margin-bottom:4px;">剩餘本金</div>
  <div style="font-size:32px;font-weight:700;">${PRO.fmt.money(L.remaining, 'TWD', true)}</div>
</div>

<div style="background:var(--bg-input);border-radius:var(--radius-md);padding:14px;margin-bottom:16px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <span style="font-size:12px;color:var(--text-secondary);">還款進度</span>
    <span style="font-size:13px;font-weight:700;color:var(--brand);">${paidPctStr}%</span>
  </div>
  <div style="background:rgba(255,255,255,0.1);border-radius:6px;height:10px;overflow:hidden;margin-bottom:10px;">
    <div style="height:100%;border-radius:6px;background:linear-gradient(90deg,var(--brand),#30d158);width:${paidPctStr}%;transition:width 0.4s ease;"></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;text-align:center;">
    <div>
      <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:2px;">已還</div>
      <div style="font-size:16px;font-weight:700;color:var(--brand);">${paidPeriods}<span style="font-size:11px;font-weight:400;margin-left:2px;">期</span></div>
    </div>
    <div style="border-left:1px solid var(--border);border-right:1px solid var(--border);">
      <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:2px;">總期數</div>
      <div style="font-size:16px;font-weight:700;">${L.months}<span style="font-size:11px;font-weight:400;margin-left:2px;">期</span></div>
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:2px;">剩餘</div>
      <div style="font-size:16px;font-weight:700;color:${remainingPeriods > 0 ? 'var(--accent-red)' : 'var(--brand)'};">${remainingPeriods <= 0 ? '✅' : remainingPeriods}<span style="font-size:11px;font-weight:400;margin-left:2px;">${remainingPeriods > 0 ? '期' : ''}</span></div>
    </div>
  </div>
</div>

<div class="metrics-row" style="grid-template-columns:repeat(2,1fr);margin-bottom:20px;">
  <div class="metric-cell"><div class="metric-label">貸款總額</div><div class="metric-value">${PRO.fmt.money(L.principal, 'TWD')}</div></div>
  <div class="metric-cell"><div class="metric-label">月付金額</div><div class="metric-value">${PRO.fmt.money(L.monthlyPayment, 'TWD')}</div></div>
  <div class="metric-cell"><div class="metric-label">年利率</div><div class="metric-value">${L.rate}%</div></div>
  <div class="metric-cell"><div class="metric-label">總期數</div><div class="metric-value">${L.months} 個月</div></div>
</div>

<div style="background:var(--bg-input);border-radius:var(--radius-md);padding:14px;margin-bottom:16px;">
  <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;font-weight:600;">還款操作</div>
  
  <button class="btn btn-primary" style="width:100%;margin-bottom:10px;" id="btn-pay-monthly">還款一期（立即執行）</button>
  
  <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:8px;">
    <button style="width:44px;height:44px;font-size:24px;background:var(--bg-card);border:1px solid var(--border);border-radius:50%;color:var(--text-primary);cursor:pointer;" id="btn-n-minus">−</button>
    <div style="text-align:center;">
      <input id="repay-n" type="number" min="1" max="360" value="3" style="width:60px;text-align:center;background:none;border:none;color:var(--text-primary);font-size:28px;font-weight:700;" />
      <div style="font-size:11px;color:var(--text-tertiary);">期</div>
    </div>
    <button style="width:44px;height:44px;font-size:24px;background:var(--bg-card);border:1px solid var(--border);border-radius:50%;color:var(--text-primary);cursor:pointer;" id="btn-n-plus">+</button>
  </div>
  <div style="text-align:center;font-size:12px;color:var(--text-tertiary);margin-bottom:10px;" id="preview-n-periods">
    預計剩餘：${PRO.fmt.money(_payNPeriods(3), 'TWD', true)}
  </div>
  <button class="btn btn-primary" style="width:100%;" id="btn-pay-n">確認還 <span id="n-label">3</span> 期</button>
</div>

<div style="display:flex;gap:8px;">
  <button class="btn btn-ghost" style="flex:1;" id="btn-lia-edit">✏️ 編輯</button>
  <button class="btn btn-danger" style="flex:1;" id="btn-lia-delete">刪除</button>
</div>`;

      PRO.sheet.open(html);
      
      // N-period repay input bindings
      const nInput = document.getElementById('repay-n');
      const nLabel = document.getElementById('n-label');
      const previewEl = document.getElementById('preview-n-periods');
      
      function updatePreview() {
        const n = parseInt(nInput.value) || 1;
        nLabel.textContent = n;
        previewEl.textContent = '預計剩餘：' + PRO.fmt.money(_payNPeriods(n), 'TWD', true);
      }
      
      document.getElementById('btn-n-minus')?.addEventListener('click', () => {
        nInput.value = Math.max(1, (parseInt(nInput.value) || 1) - 1);
        updatePreview();
      });
      document.getElementById('btn-n-plus')?.addEventListener('click', () => {
        nInput.value = (parseInt(nInput.value) || 1) + 1;
        updatePreview();
      });
      nInput?.addEventListener('input', updatePreview);

      // Pay 1 period directly
      document.getElementById('btn-pay-monthly')?.addEventListener('click', () => {
        if (L.remaining <= 0) { PRO.toast('已還清', 'success'); return; }
        const monthlyRate = L.rate / 100 / 12;
        const interest = Math.round(L.remaining * monthlyRate);
        const principalPay = L.monthlyPayment - interest;
        let newRemaining = L.remaining - principalPay;
        if (newRemaining < 0) newRemaining = 0;
        const idx = libs.findIndex(x => x.id === id);
        libs[idx].remaining = newRemaining;
        L.remaining = newRemaining;
        PRO.state.patch({ liabilities: libs });
        PRO.sheet.close();
        _render();
        PRO.toast('已還款 ' + PRO.fmt.money(principalPay, 'TWD') + '（本金）', 'success');
      });

      // Pay N periods
      document.getElementById('btn-pay-n')?.addEventListener('click', () => {
        const n = parseInt(document.getElementById('repay-n').value) || 1;
        if (L.remaining <= 0) { PRO.toast('已還清', 'success'); return; }
        const newRemaining = _payNPeriods(n);
        const paid = L.remaining - newRemaining;
        const idx = libs.findIndex(x => x.id === id);
        libs[idx].remaining = newRemaining;
        L.remaining = newRemaining;
        PRO.state.patch({ liabilities: libs });
        PRO.sheet.close();
        _render();
        PRO.toast('已還 ' + n + ' 期，共減少本金 ' + PRO.fmt.money(paid, 'TWD'), 'success');
      });

      // Edit
      document.getElementById('btn-lia-edit')?.addEventListener('click', () => {
        PRO.sheet.close();
        _openEditSheet(id);
      });

      // Delete
      document.getElementById('btn-lia-delete')?.addEventListener('click', () => {
        if (!confirm('確定要刪除「' + L.name + '」嗎？')) return;
        const newLibs = libs.filter(x => x.id !== id);
        PRO.state.patch({ liabilities: newLibs });
        PRO.sheet.close();
        _render();
        PRO.toast('已刪除負債', 'success');
      });
    }

    _renderSheet();
  }

  function _openEditSheet(id) {
    const state = PRO.state.get();
    const libs = state.liabilities || [];
    const L = libs.find(x => x.id === id);
    if (!L) return;

    const html = `
<div class="sheet-title">編輯負債</div>
<div class="form-group">
  <label class="form-label">負債名稱</label>
  <input class="form-input" id="edit-lia-name" value="${L.name}" />
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
  <div class="form-group">
    <label class="form-label">貸款總額 (元)</label>
    <input class="form-input" id="edit-lia-principal" type="number" value="${L.principal}" />
  </div>
  <div class="form-group">
    <label class="form-label">目前剩餘本金</label>
    <input class="form-input" id="edit-lia-remaining" type="number" value="${L.remaining}" />
  </div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
  <div class="form-group">
    <label class="form-label">年利率 (%)</label>
    <input class="form-input" id="edit-lia-rate" type="number" step="any" value="${L.rate}" />
  </div>
  <div class="form-group">
    <label class="form-label">總期數 (月)</label>
    <input class="form-input" id="edit-lia-months" type="number" value="${L.months}" />
  </div>
</div>
<div class="form-group">
  <label class="form-label">月付金額（0＝自動計算）</label>
  <input class="form-input" id="edit-lia-pmt" type="number" value="${L.monthlyPayment || 0}" />
</div>
<div style="display:flex;gap:12px;margin-top:8px;">
  <button class="btn btn-ghost" style="flex:1;" id="btn-edit-cancel">取消</button>
  <button class="btn btn-primary" style="flex:2;" id="btn-edit-save">儲存</button>
</div>`;

    PRO.sheet.open(html);

    document.getElementById('btn-edit-cancel')?.addEventListener('click', () => {
      PRO.sheet.close();
      openDetailSheet(id);
    });

    document.getElementById('btn-edit-save')?.addEventListener('click', () => {
      const name      = document.getElementById('edit-lia-name').value.trim();
      const principal = parseFloat(document.getElementById('edit-lia-principal').value) || L.principal;
      const remaining = parseFloat(document.getElementById('edit-lia-remaining').value);
      const rate      = parseFloat(document.getElementById('edit-lia-rate').value) || 0;
      const months    = parseInt(document.getElementById('edit-lia-months').value) || L.months;
      let   pmt       = parseFloat(document.getElementById('edit-lia-pmt').value) || 0;

      if (!name) { PRO.toast('請輸入名稱', 'error'); return; }

      if (!pmt) {
        const calc = PRO.loanCalc.calcMortgage(principal, rate, months, L.grace || 0);
        pmt = calc.monthlyPayment;
      }

      const idx = libs.findIndex(x => x.id === id);
      libs[idx] = Object.assign({}, libs[idx], { name, principal, remaining: isNaN(remaining) ? L.remaining : remaining, rate, months, monthlyPayment: pmt });
      PRO.state.patch({ liabilities: libs });
      PRO.sheet.close();
      _render();
      PRO.toast('負債已更新', 'success');
    });
  }

    return { init, render: _render };
})();