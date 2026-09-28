'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.annualPerf = (() => {
  let _mode = 'year'; // 'year' or 'month'

  function open() {
    _renderSheet();
  }

  function _calculateData() {
    const s = PRO.state.get();
    const snaps = [...(s.netWorthSnapshots || [])].sort((a,b) => a.date.localeCompare(b.date));
    const cashflow = s.cashflow?.records || {};
    const overrides = s.perfOverrides || { years: {}, months: {} };

    // 計算每月金流淨額 (Income - Expense)
    const getMonthlyNetCashflow = (ym) => {
      const rec = cashflow[ym];
      if (!rec) return 0;
      let inc = 0, exp = 0;
      if (rec.income) Object.values(rec.income).forEach(v => inc += parseFloat(v)||0);
      if (rec.expense) Object.values(rec.expense).forEach(v => exp += parseFloat(v)||0);
      return inc - exp;
    };

    // 依年份與月份分組
    const yearMap = {}; // { '2023': { snaps: [], months: {} } }
    snaps.forEach(snap => {
      const y = snap.date.substring(0,4);
      const ym = snap.date.substring(0,7);
      if (!yearMap[y]) yearMap[y] = { snaps: [], months: {} };
      yearMap[y].snaps.push(snap);
      if (!yearMap[y].months[ym]) yearMap[y].months[ym] = [];
      yearMap[y].months[ym].push(snap);
    });

    const yearlyData = [];
    const monthlyData = [];

    // 處理年份
    Object.keys(yearMap).sort().forEach(y => {
      const ySnaps = yearMap[y].snaps;
      if (ySnaps.length === 0) return;
      
      const startNW = ySnaps[0].netWorth;
      const endNW = ySnaps[ySnaps.length-1].netWorth;
      
      // 今年投入 (自動從金流算，或從 overrides 拿)
      let autoInv = 0;
      Object.keys(yearMap[y].months).forEach(ym => {
        autoInv += getMonthlyNetCashflow(ym);
      });
      const invested = overrides.years[y] !== undefined ? overrides.years[y] : autoInv;
      
      const basis = startNW + invested;
      const profit = endNW - startNW - invested;
      const increase = endNW - startNW;
      const returnRate = basis > 0 ? (profit / basis) * 100 : 0;

      yearlyData.push({
        year: y,
        startNW, endNW, invested, autoInv,
        basis, profit, increase, returnRate
      });

      // 處理月份
      Object.keys(yearMap[y].months).sort().forEach(ym => {
        const mSnaps = yearMap[y].months[ym];
        const mStart = mSnaps[0].netWorth;
        const mEnd = mSnaps[mSnaps.length-1].netWorth;
        
        const mAutoInv = getMonthlyNetCashflow(ym);
        const mInv = overrides.months[ym] !== undefined ? overrides.months[ym] : mAutoInv;
        const mBasis = mStart + mInv;
        const mProfit = mEnd - mStart - mInv;
        const mIncrease = mEnd - mStart;
        const mReturn = mBasis > 0 ? (mProfit / mBasis) * 100 : 0;

        monthlyData.push({
          ym, startNW: mStart, endNW: mEnd,
          invested: mInv, autoInv: mAutoInv,
          basis: mBasis, profit: mProfit, increase: mIncrease, returnRate: mReturn
        });
      });
    });

    yearlyData.reverse(); // 最新的在最上面
    monthlyData.reverse();

    return { yearlyData, monthlyData, overrides };
  }

  function _renderSheet() {
    const data = _calculateData();
    const isYear = _mode === 'year';
    
    let html = `
    <div style="padding:24px 16px 80px;background:var(--bg-body);min-height:70vh;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="font-size:22px;font-weight:700;">📈 歷年績效投資總覽</div>
        <button onclick="PRO.sheet.close()" style="background:none;border:none;color:var(--text-tertiary);font-size:24px;cursor:pointer;">✕</button>
      </div>

      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:24px;line-height:1.6;">
        依據您的「淨資產快照」與「金流管理」自動計算。<br>
        <span style="color:var(--brand);">💡 若未完整記錄收支，您可以直接點擊「期間投入」的數字進行手動覆寫。</span>
      </div>

      <!-- 切換按鈕 -->
      <div style="display:flex;background:rgba(255,255,255,0.05);border-radius:12px;padding:4px;margin-bottom:20px;">
        <div style="flex:1;text-align:center;padding:10px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;background:${isYear?'rgba(255,255,255,0.15)':'transparent'};color:${isYear?'#fff':'var(--text-secondary)'};" onclick="PRO.annualPerf.setMode('year')">歷年總覽</div>
        <div style="flex:1;text-align:center;padding:10px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;background:${!isYear?'rgba(255,255,255,0.15)':'transparent'};color:${!isYear?'#fff':'var(--text-secondary)'};" onclick="PRO.annualPerf.setMode('month')">每月明細</div>
      </div>
    `;

    // 建立表格
    if (isYear) {
      if (data.yearlyData.length === 0) {
        html += `<div style="text-align:center;padding:40px 20px;color:var(--text-tertiary);">尚未建立足夠的淨資產快照</div>`;
      } else {
        html += data.yearlyData.map(d => _buildCard(d.year, '年份', d)).join('');
      }
    } else {
      if (data.monthlyData.length === 0) {
        html += `<div style="text-align:center;padding:40px 20px;color:var(--text-tertiary);">尚未建立足夠的淨資產快照</div>`;
      } else {
        html += data.monthlyData.map(d => _buildCard(d.ym, '月份', d)).join('');
      }
    }

    html += `</div>`;
    PRO.sheet.open(html);
  }

  function _buildCard(key, label, d) {
    const isPos = d.profit >= 0;
    const color = isPos ? 'var(--brand)' : 'var(--accent-red)';
    const sign = isPos ? '+' : '';

    return \`
    <div class="card" style="margin-bottom:16px;padding:16px;border:1px solid rgba(255,255,255,0.1);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:12px;">
        <div style="font-size:18px;font-weight:700;">\${key} \${label}</div>
        <div style="text-align:right;">
          <div style="font-size:12px;color:var(--text-secondary);">真實報酬率</div>
          <div style="font-size:20px;font-weight:800;color:\${color};">\${sign}\${d.returnRate.toFixed(2)}%</div>
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;font-size:13px;">
        <div>
          <span style="color:var(--text-secondary);">期初資產</span><br>
          <span style="font-weight:600;">\${PRO.fmt.money(d.startNW)}</span>
        </div>
        <div>
          <span style="color:var(--text-secondary);">期末資產</span><br>
          <span style="font-weight:600;">\${PRO.fmt.money(d.endNW)}</span>
        </div>
        <div style="background:rgba(255,255,255,0.05);padding:8px -8px;margin:-8px;padding-left:8px;border-radius:8px;cursor:pointer;" onclick="PRO.annualPerf.promptOverride('\${key}', \${d.invested})">
          <span style="color:var(--text-secondary);">期間投入 ✎</span><br>
          <span style="font-weight:700;color:#fff;">\${PRO.fmt.money(d.invested)}</span>
        </div>
        <div>
          <span style="color:var(--text-secondary);">真實獲利</span><br>
          <span style="font-weight:700;color:\${color};">\${sign}\${PRO.fmt.money(d.profit)}</span>
        </div>
      </div>
    </div>\`;
  }

  function setMode(mode) {
    _mode = mode;
    _renderSheet();
  }

  function promptOverride(key, currentVal) {
    const val = prompt(\`請輸入 \${key} 的實際投入金額\\n(若留空則恢復系統金流自動計算)：\`, currentVal);
    if (val === null) return;
    
    const state = PRO.state.get();
    if (!state.perfOverrides) state.perfOverrides = { years: {}, months: {} };
    
    if (val.trim() === '') {
      if (key.length === 4) delete state.perfOverrides.years[key];
      else delete state.perfOverrides.months[key];
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        if (key.length === 4) state.perfOverrides.years[key] = num;
        else state.perfOverrides.months[key] = num;
      }
    }
    
    PRO.state.patch({ perfOverrides: state.perfOverrides });
    _renderSheet();
  }

  return { open, setMode, promptOverride };
})();
