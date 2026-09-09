/* ================================================
   buyback.js - 回購計畫試算
   分批買回計劃：DCA 成本試算 + 目標價到達估算
   ================================================ */
'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.buyback = (() => {

  function open() {
    const s = PRO.state.get();
    // Pull stocks/ETFs for quick-fill
    const stocks = (s.assets || []).filter(a => ['stock','etf'].includes(a.type));
    const stockOpts = stocks.map(a =>
      `<option value="${a.id}" data-price="${a.price||a.costPrice||0}" data-qty="${a.quantity||0}">${a.name || a.id}</option>`
    ).join('');

    const html = `
<div class="sheet-title">🔄 回購計畫試算</div>
<div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;line-height:1.6;">
  設定目標股票與分批買入計畫，自動估算平均成本與達標天數。
</div>

<div class="card" style="padding:16px;margin-bottom:12px;">
  <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--text-secondary);">標的設定</div>

  ${stocks.length > 0 ? `
  <div style="margin-bottom:10px;">
    <div style="font-size:13px;margin-bottom:6px;">從資產快速帶入</div>
    <select id="bb-asset-pick" class="form-input" onchange="PRO.buyback._fillFromAsset(this)">
      <option value="">-- 選擇資產 --</option>
      ${stockOpts}
    </select>
  </div>` : ''}

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <div style="font-size:14px;">目前持有股數</div>
    <input type="number" id="bb-held-qty" class="form-input" style="width:140px;text-align:right;" placeholder="0" value="0">
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <div style="font-size:14px;">目前均價 (TWD)</div>
    <input type="number" id="bb-avg-price" class="form-input" style="width:140px;text-align:right;" placeholder="0" value="0">
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <div style="font-size:14px;">目前市價 (TWD)</div>
    <input type="number" id="bb-curr-price" class="form-input" style="width:140px;text-align:right;" placeholder="0" value="0">
  </div>
</div>

<div class="card" style="padding:16px;margin-bottom:12px;">
  <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--text-secondary);">分批買入計畫 (DCA)</div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <div style="font-size:14px;">每次買入金額 (TWD)</div>
    <input type="number" id="bb-dca-amt" class="form-input" style="width:140px;text-align:right;" placeholder="10,000" value="10000">
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <div style="font-size:14px;">買入頻率</div>
    <select id="bb-dca-freq" class="form-input" style="width:140px;">
      <option value="4">每週</option>
      <option value="2" selected>每兩週</option>
      <option value="1">每月</option>
    </select>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:14px;">目標均價降至 (TWD)</div>
    <input type="number" id="bb-target-avg" class="form-input" style="width:140px;text-align:right;" placeholder="目標均價" value="0">
  </div>
</div>

<button class="btn btn-primary" onclick="PRO.buyback._calc()" style="width:100%;margin-bottom:16px;">試算</button>
<div id="bb-result"></div>
`;
    PRO.sheet.open(html);
  }

  function _fillFromAsset(sel) {
    const opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.value) return;
    const price = parseFloat(opt.dataset.price) || 0;
    const qty   = parseFloat(opt.dataset.qty)   || 0;
    document.getElementById('bb-held-qty').value  = qty;
    document.getElementById('bb-avg-price').value = price;
    document.getElementById('bb-curr-price').value = price;
  }

  function _calc() {
    const heldQty   = parseFloat(document.getElementById('bb-held-qty')?.value)   || 0;
    const avgPrice  = parseFloat(document.getElementById('bb-avg-price')?.value)   || 0;
    const currPrice = parseFloat(document.getElementById('bb-curr-price')?.value)  || 0;
    const dcaAmt    = parseFloat(document.getElementById('bb-dca-amt')?.value)     || 0;
    const freqPerMo = parseInt(document.getElementById('bb-dca-freq')?.value)      || 2;
    const targetAvg = parseFloat(document.getElementById('bb-target-avg')?.value)  || 0;

    if (currPrice <= 0 || dcaAmt <= 0) return PRO.toast('請填入市價與每次買入金額', 'warning');

    const heldCost  = heldQty * avgPrice;
    const dcaQtyPerBuy = Math.floor(dcaAmt / currPrice);
    const dcaCostPerBuy = dcaQtyPerBuy * currPrice;

    // Simulate DCA rounds until avg drops to target
    let rounds = 0, totalQty = heldQty, totalCost = heldCost, newAvg = avgPrice;
    const maxRounds = 200;
    const rows = [];

    if (targetAvg > 0 && targetAvg < avgPrice) {
      while (newAvg > targetAvg && rounds < maxRounds) {
        rounds++;
        totalQty  += dcaQtyPerBuy;
        totalCost += dcaCostPerBuy;
        newAvg = totalQty > 0 ? totalCost / totalQty : 0;
        if (rows.length < 6) rows.push({ round: rounds, newAvg: Math.round(newAvg * 10) / 10, totalQty, totalCost });
      }
    }

    const finalAvg   = totalQty > 0 ? totalCost / totalQty : avgPrice;
    const weeksNeeded = rounds / freqPerMo * (freqPerMo === 4 ? 1 : freqPerMo === 2 ? 2 : 4);
    const monthsNeeded = rounds / freqPerMo;
    const extraInvested = rounds * dcaCostPerBuy;

    const breakEven  = currPrice > 0 && finalAvg > 0;
    const pnlPct     = currPrice > 0 ? ((currPrice - finalAvg) / finalAvg * 100) : 0;
    const pnlColor   = pnlPct >= 0 ? 'var(--brand)' : 'var(--accent-red)';

    let tableHtml = '';
    if (rows.length > 0) {
      tableHtml = `
<div style="margin-top:14px;">
  <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text-secondary);">前 ${Math.min(6,rounds)} 次買入後變化</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;font-size:11px;">
    <div style="color:var(--text-tertiary);padding:4px;">第 N 次</div>
    <div style="color:var(--text-tertiary);padding:4px;text-align:right;">新均價</div>
    <div style="color:var(--text-tertiary);padding:4px;text-align:right;">總股數</div>
    ${rows.map(r => `
      <div style="padding:4px;">第 ${r.round} 次</div>
      <div style="padding:4px;text-align:right;font-weight:600;">$${r.newAvg}</div>
      <div style="padding:4px;text-align:right;">${r.totalQty} 股</div>
    `).join('')}
  </div>
</div>`;
    }

    const html = `
<div class="card fade-in" style="padding:16px;margin-bottom:12px;">
  <div style="font-size:13px;font-weight:600;margin-bottom:14px;color:var(--text-secondary);">試算結果</div>

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <div style="font-size:14px;">目前帳面均價</div>
    <div style="font-size:14px;font-weight:700;">$${avgPrice.toFixed(1)}</div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <div style="font-size:14px;">每次買入股數</div>
    <div style="font-size:14px;font-weight:700;">${dcaQtyPerBuy} 股 (${PRO.fmt.money(dcaCostPerBuy,'TWD')})</div>
  </div>

  ${targetAvg > 0 && rounds < maxRounds ? `
  <div style="height:1px;background:var(--border);margin:10px 0;"></div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <div style="font-size:14px;">需買入次數</div>
    <div style="font-size:14px;font-weight:700;color:var(--accent);">${rounds} 次</div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <div style="font-size:14px;">預計需時</div>
    <div style="font-size:14px;font-weight:700;">${monthsNeeded.toFixed(1)} 個月</div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <div style="font-size:14px;">額外投入金額</div>
    <div style="font-size:14px;font-weight:700;color:var(--accent-red);">${PRO.fmt.money(Math.round(extraInvested),'TWD')}</div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:14px;">預計攤低均價至</div>
    <div style="font-size:18px;font-weight:900;color:var(--brand);">$${finalAvg.toFixed(1)}</div>
  </div>
  ${tableHtml}` : (targetAvg > 0 ? `<div style="color:var(--accent-yellow);font-size:13px;margin-top:8px;">⚠️ 以此 DCA 計畫無法達到目標均價 (目標過低或市價未跌夠)。</div>` : '')}

  <div style="height:1px;background:var(--border);margin:12px 0;"></div>
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:13px;color:var(--text-secondary);">若現在賣出損益</div>
    <div style="font-size:15px;font-weight:900;color:${pnlColor};">${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%</div>
  </div>
</div>`;

    document.getElementById('bb-result').innerHTML = html;
  }

  return { open, _fillFromAsset, _calc };
})();
