/* ================================================
   passive.js - 穩定被動收入
   整合所有被動收入來源，顯示月/年收入預測
   ================================================ */
'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.passive = (() => {

  function open() {
    const s = PRO.state.get();
    const items = s.passiveIncome || [];
    const rates = s.rates || {};
    const usdTwd = rates.USD || 32;

    // 計算總月收入 (全換成 TWD)
    let totalMonthly = 0;
    items.forEach(item => {
      const monthly = item.frequency === 'annual' ? item.amount / 12
                    : item.frequency === 'quarterly' ? item.amount / 3
                    : item.amount;
      const twd = item.currency === 'TWD' ? monthly : monthly * usdTwd;
      totalMonthly += twd;
    });
    const totalAnnual = totalMonthly * 12;

    let itemsHtml = '';
    if (items.length === 0) {
      itemsHtml = `<div style="text-align:center;padding:40px 0;color:var(--text-secondary);font-size:14px;">尚未新增任何被動收入來源<br><span style="font-size:12px;">點下方「+ 新增」開始</span></div>`;
    } else {
      items.forEach((item, i) => {
        const monthly = item.frequency === 'annual' ? item.amount / 12
                      : item.frequency === 'quarterly' ? item.amount / 3
                      : item.amount;
        const twd = item.currency === 'TWD' ? monthly : monthly * usdTwd;
        const freqLabel = item.frequency === 'annual' ? '年' : (item.frequency === 'quarterly' ? '季' : '月');
        const typeIcon = item.type === 'rent' ? '🏠' : item.type === 'dividend' ? '📈' : item.type === 'royalty' ? '✍️' : '💼';

        itemsHtml += `
<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
  <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
    <div style="font-size:22px;">${typeIcon}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</div>
      <div style="font-size:11px;color:var(--text-secondary);">${PRO.fmt.money(item.amount, item.currency)} / ${freqLabel}</div>
    </div>
  </div>
  <div style="text-align:right;margin-left:12px;">
    <div style="font-size:14px;font-weight:700;color:var(--brand);">+${PRO.fmt.money(Math.round(twd), 'TWD')}/月</div>
    <button onclick="PRO.passive._delete(${i})" style="background:none;border:none;color:var(--accent-red);font-size:11px;cursor:pointer;padding:2px 0;">移除</button>
  </div>
</div>`;
      });
    }

    const html = `
<div class="sheet-title">🏠 穩定被動收入</div>
<div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">追蹤所有持續性的被動收入來源。</div>

<div class="card" style="margin-bottom:16px;padding:16px;background:linear-gradient(135deg,rgba(52,199,89,0.15),rgba(10,132,255,0.05));text-align:center;">
  <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">每月預計被動收入</div>
  <div style="font-size:36px;font-weight:900;color:var(--brand);">${PRO.fmt.money(Math.round(totalMonthly), 'TWD')}</div>
  <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">年化 ${PRO.fmt.money(Math.round(totalAnnual), 'TWD')}</div>
</div>

<div class="card" style="margin-bottom:16px;padding:16px;">
  <div style="font-size:13px;font-weight:600;margin-bottom:4px;">收入來源清單</div>
  ${itemsHtml}
</div>

<button class="btn btn-primary" onclick="PRO.passive._openAdd()" style="width:100%;margin-bottom:8px;">+ 新增被動收入</button>
<button class="btn btn-secondary" onclick="PRO.sheet.close()" style="width:100%;">關閉</button>
`;
    PRO.sheet.open(html);
  }

  function _openAdd() {
    const html = `
<div class="sheet-title">新增被動收入來源</div>
<div style="margin-bottom:12px;">
  <div style="font-size:13px;font-weight:600;margin-bottom:6px;">名稱</div>
  <input type="text" id="pi-name" class="form-input" placeholder="例：0056 股息、房租收入">
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
  <div>
    <div style="font-size:13px;font-weight:600;margin-bottom:6px;">類型</div>
    <select id="pi-type" class="form-input">
      <option value="dividend">📈 股息</option>
      <option value="rent">🏠 房租</option>
      <option value="royalty">✍️ 版稅/授權</option>
      <option value="other">💼 其他</option>
    </select>
  </div>
  <div>
    <div style="font-size:13px;font-weight:600;margin-bottom:6px;">頻率</div>
    <select id="pi-freq" class="form-input">
      <option value="monthly">每月</option>
      <option value="quarterly">每季</option>
      <option value="annual">每年</option>
    </select>
  </div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">
  <div>
    <div style="font-size:13px;font-weight:600;margin-bottom:6px;">金額</div>
    <input type="number" id="pi-amount" class="form-input" placeholder="0">
  </div>
  <div>
    <div style="font-size:13px;font-weight:600;margin-bottom:6px;">幣別</div>
    <select id="pi-currency" class="form-input">
      <option value="TWD">TWD</option>
      <option value="USD">USD</option>
    </select>
  </div>
</div>
<button class="btn btn-primary" onclick="PRO.passive._save()" style="width:100%;margin-bottom:10px;">新增</button>
<button class="btn btn-secondary" onclick="PRO.passive.open()" style="width:100%;">返回</button>
`;
    document.getElementById('sheet-body').innerHTML = html;
  }

  function _save() {
    const name     = document.getElementById('pi-name')?.value?.trim();
    const type     = document.getElementById('pi-type')?.value;
    const freq     = document.getElementById('pi-freq')?.value;
    const amount   = parseFloat(document.getElementById('pi-amount')?.value) || 0;
    const currency = document.getElementById('pi-currency')?.value;

    if (!name)   return PRO.toast('請輸入名稱', 'warning');
    if (!amount) return PRO.toast('請輸入金額', 'warning');

    const s = PRO.state.get();
    const items = [...(s.passiveIncome || []), { name, type, frequency: freq, amount, currency }];
    PRO.state.patch({ passiveIncome: items });
    PRO.toast('✅ 已新增！', 'success');
    open();
  }

  function _delete(index) {
    if (!confirm('確定移除此收入來源？')) return;
    const s = PRO.state.get();
    const items = (s.passiveIncome || []).filter((_, i) => i !== index);
    PRO.state.patch({ passiveIncome: items });
    PRO.toast('已移除', 'info');
    open();
  }

  return { open, _openAdd, _save, _delete };
})();
