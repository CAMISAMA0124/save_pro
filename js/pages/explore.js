'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.explore = (() => {
  function init() {
    _render();
  }

  
  // ============================================================
  // 精確有效槓桿計算
  // 有效槓桿 = 總市場暴露 / 淨值
  // 台股正2(符號L結尾) × 2、正3 × 3，美股2x/3x ETF自動辨識
  // ============================================================
  function _calcEffectiveLeverage(assets, totalLiab, netWorth, rates) {
    if (netWorth <= 0) return 0;
    const UNIT_TO_GRAM = { oz: 31.1035, g: 1, qian: 3.75, tael: 37.5 };
    // Known US 2x/3x leveraged ETF tickers
    const US_2X = new Set(['SSO','QLD','DDM','MVV','UWM','SAA','UCC','DIG','RXL','EET','ROM','UYM','UYG','BIB','AGQ','DGP','UGL','SPLX','UPWM']);
    const US_3X = new Set(['TQQQ','UPRO','SPXL','SOXL','TECL','FNGU','NAIL','LABU','FAS','TNA','DFEN','UDOW','MIDU','WANT','HIBL','DPST','WEBL','CURE','DRN','ERX','URTY']);
    const US_INV = new Set(['SH','PSQ','DOG','SDS','QID','SPXU','SQQQ','SRTY','SPXS','FAZ','TZA']);

    let totalExposure = 0;
    assets.forEach(a => {
      const qty   = parseFloat(a.quantity) || 0;
      const price = parseFloat(a.price || a.costPrice) || 0;
      const rate  = a.currency === 'TWD' ? 1 : ((rates && rates[a.currency]) || 1);
      const isMetal = ['gold','platinum','silver'].includes(a.type);
      let value;
      if (isMetal && price > 0) {
        const unitGram = a.metalUnitToGram || UNIT_TO_GRAM[a.metalUnit || 'tael'] || 37.5;
        value = qty * unitGram * price;
      } else {
        value = qty * price * rate;
      }

      // 判斷槓桿倍數
      let lv = a.leverageMultiplier || 1; // 使用者手動設定優先
      if (!a.leverageMultiplier) {
        const sym = (a.symbol || '').toUpperCase().replace('.TW','').replace('.TWO','');
        // 台股正2：代號以L結尾，且是純數字+L (00631L, 00633L等)
        if (/^\d+L$/.test(sym)) lv = 2;
        // 台股正3 (若有): 以3L結尾 (不常見但保留)
        else if (/^\d+3L$/.test(sym)) lv = 3;
        // 美股2x/3x/反向
        else if (US_3X.has(sym)) lv = 3;
        else if (US_2X.has(sym)) lv = 2;
        else if (US_INV.has(sym)) lv = -1;
      }

      totalExposure += value * lv;
    });

    // 借貸本身已被計入 totalAssets (借的錢買了資產)
    // 借貸讓淨值降低，自然反映在分母，不需再加一次
    return totalExposure / netWorth;
  }

  function _render() {
    const container = document.getElementById('explore-content');
    if (!container) return;
    
    const s = PRO.state.get();
    const assets = s.assets || [];
    const liabilities = s.liabilities || [];
    const hide = (s.settings || {}).hideAmounts;
    
    // 精確計算總資產（含外幣匯率換算 + 貴金屬單位換算，與資產頁保持一致）
    const _rates_exp = (() => {
      if (typeof PRO !== 'undefined' && PRO.assets && PRO.assets.getRates) {
        const r = PRO.assets.getRates();
        if (r && Object.keys(r).length > 0) return r;
      }
      return { USD: 32, JPY: 0.21, EUR: 34, CNY: 4.4, HKD: 4.1, AUD: 20, GBP: 41 };
    })();
    const _UNIT_TO_GRAM_EXP = { oz: 31.1035, g: 1, qian: 3.75, tael: 37.5 };
    const totalAssets = assets.reduce((sum, a) => {
      const qty   = parseFloat(a.quantity)  || 0;
      const price = parseFloat(a.price || a.costPrice) || 0;
      const rate  = a.currency === 'TWD' ? 1 : (_rates_exp[a.currency] || 1);
      const isMetal = ['gold', 'platinum', 'silver'].includes(a.type);
      let value;
      if (isMetal && price > 0) {
        const unitGram = a.metalUnitToGram || _UNIT_TO_GRAM_EXP[a.metalUnit || 'tael'] || 37.5;
        value = qty * unitGram * price;
      } else {
        value = qty * price * rate;
      }
      return sum + (value || 0);
    }, 0);
    const totalLiab = liabilities.reduce((sum, l) => sum + (parseFloat(l.remaining != null ? l.remaining : l.principal) || 0), 0);
    const netWorth = Math.max(0, totalAssets - totalLiab);
    const leverage = _calcEffectiveLeverage(assets, totalLiab, netWorth, _rates_exp);
    
    // 計算被動收入
    const pInfo = _calcPassiveIncome(assets);

    // 計算現金流 (年度加總，使用 cashflow 模組)
    let cfIncome = 0, cfExpense = 0;
    if (typeof PRO !== 'undefined' && PRO.cashflow && PRO.cashflow.getAnnualSummary) {
      const ann = PRO.cashflow.getAnnualSummary();
      cfIncome = ann.income || 0;
      cfExpense = ann.expense || 0;
    } else if (s.cashflow && s.cashflow.records) {
      // Fallback: 手動加總今年所有月份
      const year = new Date().getFullYear().toString();
      Object.keys(s.cashflow.records).forEach(ym => {
        if (ym.startsWith(year)) {
          const r = s.cashflow.records[ym];
          Object.values(r.income || {}).forEach(v => cfIncome += v);
          Object.values(r.expense || {}).forEach(v => cfExpense += v);
        }
      });
    }
    const cfSavings = cfIncome - cfExpense;
    const saveRate = cfIncome > 0 ? (cfSavings / cfIncome * 100) : 0;

    let html = `<div style="padding: 16px;">`;

    // 1. 主帳戶卡片
    html += `
<div class="card" style="margin-bottom:12px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;" onclick="if(PRO.dashboard && PRO.dashboard._openAccountSwitcher) PRO.dashboard._openAccountSwitcher()" style="cursor:pointer;">
    <div style="display:flex;align-items:center;">
      <div class="explore-icon" style="background:rgba(10,132,255,0.15);">💼</div>
      <div>
        <div style="font-weight:600;font-size:15px;margin-bottom:3px;display:flex;align-items:center;gap:6px;">${PRO.state.getActiveAccount ? PRO.state.getActiveAccount().name : '我的主帳戶'} <span class="badge-pro">PRO</span></div>
        <div style="font-size:12px;color:var(--text-secondary);">帳戶總覽・點擊切換帳戶</div>
      </div>
    </div>
    <button onclick="if(PRO.dashboard && PRO.dashboard._openAccountSwitcher) PRO.dashboard._openAccountSwitcher()" style="background:rgba(255,255,255,0.1);border:none;border-radius:20px;padding:6px 12px;color:var(--text-primary);font-size:13px;font-weight:600;display:flex;align-items:center;gap:4px;cursor:pointer;">
      切換 <span>⇄</span>
    </button>
  </div>
  <div class="account-stats-grid">
    <div class="account-stat-item"><div class="label">淨資產</div><div class="value" style="color:var(--brand);">${hide ? '****' : PRO.fmt.money(netWorth,'TWD')}</div></div>
    <div class="account-stat-item"><div class="label">總資產</div><div class="value">${hide ? '****' : PRO.fmt.money(totalAssets,'TWD')}</div></div>
    <div class="account-stat-item"><div class="label">槓桿</div><div class="value" style="color:${leverage>2?'var(--accent-red)':(leverage>1?'var(--accent-yellow)':'var(--text-secondary)')};">${leverage.toFixed(2)}x</div></div>
    <div class="account-stat-item"><div class="label">總負債</div><div class="value" style="color:var(--accent-red);">${hide ? '****' : PRO.fmt.money(totalLiab,'TWD')}</div></div>
  </div>
</div>`;

    // 2. 金流管理 beta 版卡片
    html += `
<div class="card tappable" style="margin-bottom:12px;" onclick="if(PRO.cashflow) PRO.cashflow.openCashflowSheet()">
  <div style="display:flex;align-items:center;margin-bottom:16px;">
    <div class="explore-icon" style="background:rgba(52,199,89,0.15);">💱</div>
    <div style="flex:1;">
      <div style="font-weight:600;font-size:15px;margin-bottom:3px;display:flex;align-items:center;gap:6px;">金流管理 <span class="badge-beta">beta</span></div>
      <div style="font-size:12px;color:var(--text-secondary);">年度自由現金流 <span style="color:var(--brand);">${PRO.fmt.money(cfSavings,'TWD')}</span></div>
    </div>
    <div style="color:var(--text-tertiary);">›</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);text-align:center;padding-top:16px;border-top:1px solid var(--border);">
    <div class="account-stat-item"><div class="label">預估總收入</div><div class="value" style="color:var(--brand);">${PRO.fmt.money(cfIncome,'TWD')}</div></div>
    <div class="account-stat-item"><div class="label">預估總支出</div><div class="value" style="color:var(--accent-red);">${PRO.fmt.money(cfExpense,'TWD')}</div></div>
    <div class="account-stat-item"><div class="label">儲蓄率</div><div class="value" style="color:var(--accent-yellow);">${PRO.fmt.pct(saveRate,0)}</div></div>
  </div>
</div>`;

    // 3. 被動收入總覽卡片
    html += `
<div class="card" style="margin-bottom:12px;">
  <div class="tappable" style="display:flex;align-items:center;" id="passive-card">
    <div class="explore-icon" style="background:rgba(255,159,10,0.15);">💰</div>
    <div style="flex:1;">
      <div style="font-weight:600;font-size:15px;margin-bottom:3px;">被動收入總覽</div>
      <div style="font-size:12px;color:var(--text-secondary);">點標的記錄股息、收租、利息</div>
    </div>
    <div style="color:var(--text-tertiary);transition:transform 0.3s;" id="passive-chevron">›</div>
  </div>
  <div id="passive-detail" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
    ${_buildPassiveDetail(pInfo)}
  </div>
</div>`;

    
    // 歷年績效投資總覽
    html += _menuCard('📈', 'rgba(10,132,255,0.15)', '歷年績效投資總覽', '', '自動讀取資產與金流，結算真實獲利', 'if(PRO.annualPerf) PRO.annualPerf.open()');

// 4. CLEC 投資策略卡片
    html += _menuCard('📊', 'rgba(255,69,58,0.15)', 'CLEC 投資策略', '', '點擊開始設定', 'if(PRO.rebalance) PRO.rebalance.openRebalanceSheet()');

    // 5. 期貨計算機卡片
    html += _menuCard('🏦', 'rgba(142,142,147,0.15)', '質押借款計算', '', '試算可融資額、維持率警戒線', 'if(PRO.marginCalc) PRO.marginCalc.open()');

    // 8. ETF X-Ray 卡片
    html += _menuCard('🔍', 'rgba(0,199,190,0.15)', 'ETF X-Ray 成分股', '', '比對多檔高股息 ETF 重疊度', 'if(PRO.xray) PRO.xray.openXraySheet()');

    // 9. 回購計畫卡片
    html += _menuCard('🔄', 'rgba(10,132,255,0.15)', '回購計畫', '', '分批 DCA 攤低成本試算', 'if(PRO.buyback) PRO.buyback.open()');

    // 10. 穩定被動收入卡片
    html += _menuCard('🏠', 'rgba(52,199,89,0.15)', '穩定被動收入', '', '一覽所有在跑的穩定被動收入', 'if(PRO.passive) PRO.passive.open()');

    // 11. 保險獲利試算卡片
    html += _menuCard('🛡️', 'rgba(255,204,0,0.15)', '保險獲利試算 v1', '', '試算解約金、IRR 報酬率', 'if(PRO.insurance) PRO.insurance.open()');

    html += _menuCard('💰', 'rgba(10,132,255,0.15)', '股票配息試算', '', '算本金、算股數、算加薪', 'if(PRO.dividend) PRO.dividend.openDividendSheet()');
    html += `<div style="height:40px;"></div></div>`;
    container.innerHTML = html;

    // 綁定事件
    document.getElementById('passive-card')?.addEventListener('click', () => {
      const detail = document.getElementById('passive-detail');
      const chevron = document.getElementById('passive-chevron');
      if (!detail) return;
      const isOpen = detail.style.display !== 'none';
      detail.style.display = isOpen ? 'none' : 'block';
      if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
    });
  }

  function _menuCard(icon, bgColor, title, badgeHtml, subtitle, onClick) {
    return `
<div class="card tappable" style="margin-bottom:12px;" onclick="${onClick}">
  <div style="display:flex;align-items:center;">
    <div class="explore-icon" style="background:${bgColor};">${icon}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-weight:600;font-size:15px;margin-bottom:3px;display:flex;align-items:center;gap:6px;">${title} ${badgeHtml}</div>
      <div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${subtitle}</div>
    </div>
    <div style="color:var(--text-tertiary);margin-left:8px;">›</div>
  </div>
</div>`;
  }

  function _calcPassiveIncome(assets) {
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const cutoffStr = cutoff.toISOString().slice(0, 7);

    let dividend = 0, rent = 0, interest = 0;
    const byMonth = {};

    assets.forEach(a => {
      (a.incomeRecords || []).forEach(r => {
        const ym = (r.date || '').slice(0, 7);
        if (ym < cutoffStr) return;
        const amt = parseFloat(r.amount) || 0;
        if (r.type === 'dividend') dividend += amt;
        else if (r.type === 'rent') rent += amt;
        else if (r.type === 'interest') interest += amt;
        byMonth[ym] = (byMonth[ym] || 0) + amt;
      });
    });

    const total = dividend + rent + interest;
    return {
      total, dividend, rent, interest,
      monthly: total / 12,
      byMonth,
      hasData: total > 0
    };
  }

  function _buildPassiveDetail(p) {
    if (!p.hasData) {
      return `<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:13px;">
        尚無被動收入紀錄<br>
        <span style="font-size:11px;color:var(--text-tertiary);">在資產列表點擊資產，可新增配息、收租紀錄</span>
      </div>`;
    }

    const items = [
      { label: '配息 / 股利', value: p.dividend, color: 'var(--accent)', icon: '📈' },
      { label: '收租', value: p.rent, color: 'var(--accent-purple)', icon: '🏠' },
      { label: '利息', value: p.interest, color: 'var(--accent-teal)', icon: '💰' },
    ].filter(x => x.value > 0);

    const now = new Date();
    const recentMonths = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = d.toISOString().slice(0, 7);
      recentMonths.push({ ym, label: (d.getMonth() + 1) + '月', value: p.byMonth[ym] || 0 });
    }
    const maxVal = Math.max(...recentMonths.map(m => m.value), 1);

    return `
<div>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px;">
    <div>
      <div style="font-size:11px;color:var(--text-secondary);">近 12 個月總計</div>
      <div style="font-size:26px;font-weight:800;color:var(--accent-yellow);">${PRO.fmt.money(p.total,'TWD')}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;color:var(--text-secondary);">月均</div>
      <div style="font-size:16px;font-weight:700;color:var(--brand);">${PRO.fmt.money(Math.round(p.monthly),'TWD')}</div>
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
    ${items.map(x => `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span>${x.icon}</span>
        <span style="font-size:14px;">${x.label}</span>
      </div>
      <div style="text-align:right;">
        <div style="font-size:14px;font-weight:600;color:${x.color};">${PRO.fmt.money(x.value,'TWD')}</div>
        <div style="font-size:10px;color:var(--text-tertiary);">月均 ${PRO.fmt.money(Math.round(x.value/12),'TWD')}</div>
      </div>
    </div>`).join('')}
  </div>
  <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;">近 6 個月趨勢</div>
  <div style="display:flex;align-items:flex-end;gap:4px;height:60px;">
    ${recentMonths.map(m => `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">
      <div style="flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center;">
        <div style="width:100%;background:${m.value>0?'var(--accent-yellow)':'rgba(255,255,255,0.08)'};border-radius:4px 4px 0 0;height:${Math.max(4, (m.value/maxVal)*48)}px;"></div>
      </div>
      <div style="font-size:9px;color:var(--text-tertiary);">${m.label}</div>
    </div>`).join('')}
  </div>
</div>`;
  }

  return { init, render: _render };
})();
