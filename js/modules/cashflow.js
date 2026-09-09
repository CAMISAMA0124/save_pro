/* ================================================
   cashflow.js - 金流管理模組 (分類月記帳)
   ================================================ */

'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.cashflow = (() => {

  // 預設分類 (如果在 state.js 中沒有的話)
  const defaultIncomeCats = [
    { id: 'salary', name: '薪資', icon: '💼', color: '#34c759' },
    { id: 'bonus', name: '獎金', icon: '💰', color: '#30d158' },
    { id: 'dividend', name: '股息', icon: '📈', color: '#0a84ff' },
    { id: 'rent', name: '租金', icon: '🏠', color: '#5856d6' },
    { id: 'other', name: '其他', icon: '📦', color: '#8e8e93' }
  ];

  const defaultExpenseCats = [
    { id: 'fixed', name: '固定', icon: '🏢', color: '#ff9f0a' },
    { id: 'food', name: '飲食', icon: '🍔', color: '#ff3b30' },
    { id: 'transport', name: '交通', icon: '🚗', color: '#ff453a' },
    { id: 'entertainment', name: '娛樂', icon: '🎮', color: '#bf5af2' },
    { id: 'loan', name: '還款', icon: '💳', color: '#ff6961' },
    { id: 'other', name: '其他', icon: '📦', color: '#8e8e93' }
  ];

  function openCashflowSheet() {
    const state = PRO.state.get();
    if (!state.cashflow) {
      state.cashflow = {
        incomeCategories: defaultIncomeCats,
        expenseCategories: defaultExpenseCats,
        records: {} // "2026-08": { income: { salary: 50000 }, expense: { food: 15000 } }
      };
      PRO.state.patch({ cashflow: state.cashflow });
    }

    const today = new Date();
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    _renderSheet(ym);
  }

  function _renderSheet(ym) {
    const state = PRO.state.get();
    const cf = state.cashflow;
    const record = cf.records[ym] || { income: {}, expense: {} };

    let totalIncome = 0;
    let totalExpense = 0;
    Object.values(record.income).forEach(v => totalIncome += v);
    Object.values(record.expense).forEach(v => totalExpense += v);
    const savings = totalIncome - totalExpense;
    const saveRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

    let html = `
<div class="sheet-title">金流管理</div>
<div style="display:flex;justify-content:center;align-items:center;margin-bottom:16px;">
  <input type="month" id="cf-month" value="${ym}" class="form-input" style="width:160px;text-align:center;" />
</div>

<div class="card" style="margin-bottom:16px;">
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;text-align:center;">
    <div>
      <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">預估總收入</div>
      <div style="font-weight:600;color:var(--green);">${PRO.fmt.money(totalIncome, 'TWD')}</div>
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">預估總支出</div>
      <div style="font-weight:600;color:var(--red);">${PRO.fmt.money(totalExpense, 'TWD')}</div>
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">儲蓄率</div>
      <div style="font-weight:600;">${PRO.fmt.pct(saveRate, 1)}</div>
    </div>
  </div>
</div>

<div style="display:flex;gap:12px;margin-bottom:16px;">
  <div style="flex:1;">
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">收入分類</div>`;
    
    cf.incomeCategories.forEach(cat => {
      const val = record.income[cat.id] || '';
      html += `
      <div style="display:flex;align-items:center;margin-bottom:8px;">
        <div style="width:24px;font-size:14px;text-align:center;margin-right:8px;">${cat.icon}</div>
        <div style="flex:1;">
          <input class="form-input cf-income-input" data-id="${cat.id}" type="number" min="0" placeholder="0" value="${val}" style="padding:6px;font-size:14px;" />
        </div>
      </div>`;
    });

    html += `
  </div>
  <div style="flex:1;">
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">支出分類</div>`;

    cf.expenseCategories.forEach(cat => {
      const val = record.expense[cat.id] || '';
      html += `
      <div style="display:flex;align-items:center;margin-bottom:8px;">
        <div style="width:24px;font-size:14px;text-align:center;margin-right:8px;">${cat.icon}</div>
        <div style="flex:1;">
          <input class="form-input cf-expense-input" data-id="${cat.id}" type="number" min="0" placeholder="0" value="${val}" style="padding:6px;font-size:14px;" />
        </div>
      </div>`;
    });

    html += `
  </div>
</div>

<button class="btn btn-primary" style="width:100%;" id="btn-cf-save">儲存 ${ym} 紀錄</button>
`;

    PRO.sheet.open(html);

    document.getElementById('cf-month')?.addEventListener('change', (e) => {
      _renderSheet(e.target.value);
    });

    document.getElementById('btn-cf-save')?.addEventListener('click', () => {
      const targetYm = document.getElementById('cf-month').value;
      if (!targetYm) return;
      
      const inData = {};
      document.querySelectorAll('.cf-income-input').forEach(el => {
        const v = parseFloat(el.value);
        if (v > 0) inData[el.dataset.id] = v;
      });
      
      const outData = {};
      document.querySelectorAll('.cf-expense-input').forEach(el => {
        const v = parseFloat(el.value);
        if (v > 0) outData[el.dataset.id] = v;
      });
      
      const s = PRO.state.get();
      if (!s.cashflow.records) s.cashflow.records = {};
      s.cashflow.records[targetYm] = { income: inData, expense: outData };
      PRO.state.patch({ cashflow: s.cashflow });
      
      PRO.toast('已儲存金流紀錄', 'success');
      _renderSheet(targetYm);
      
      // 更新 explore 頁面的統計
      if (typeof PRO.explore !== 'undefined' && PRO.explore.render) {
        PRO.explore.render();
      }
    });
  }

  // 計算年度總結
  function getAnnualSummary() {
    const state = PRO.state.get();
    if (!state.cashflow || !state.cashflow.records) return { income: 0, expense: 0, savings: 0 };
    
    let inc = 0;
    let exp = 0;
    const year = new Date().getFullYear().toString();
    
    Object.keys(state.cashflow.records).forEach(ym => {
      if (ym.startsWith(year)) {
        const r = state.cashflow.records[ym];
        Object.values(r.income).forEach(v => inc += v);
        Object.values(r.expense).forEach(v => exp += v);
      }
    });
    
    return { income: inc, expense: exp, savings: inc - exp };
  }

  return { openCashflowSheet, getAnnualSummary };
})();