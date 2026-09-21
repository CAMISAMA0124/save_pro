/* ================================================
   assets.js - 資產管理
   功能：資產列表、詳情頁、即時報價、新增資產
   ================================================ */

'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.assets = (() => {

  let _rates = {};
  let _initialized = false;
  let _assetChartInst = null;
  let _assetChartMode = 'pct';
  let _assetChartRange = 'ytd';

  /* ─── 設定 ──────────────────────────────────────── */
  const METAL_UNITS = { oz: 'OZ', qian: '台錢', tael: '台兩', g: 'g' };

  const ASSET_TYPES = {
    tw_stock:   { label: '台股',     icon: '📈', color: '#0a84ff' },
    us_stock:   { label: '美股',     icon: '🇺🇸', color: '#5e5ce6' },
    tw_etf:     { label: '台股ETF',  icon: '📊', color: '#32ade6' },
    us_etf:     { label: '美股ETF',  icon: '📊', color: '#0a84ff' },
    twd_cash:   { label: '台幣現金', icon: '💵', color: '#34c759' },
    usd_cash:   { label: '美金現金', icon: '💰', color: '#30b0c7' },
    bond:       { label: '債券',     icon: '📄', color: '#ffd60a' },
    realEstate: { label: '不動產',   icon: '🏠', color: '#5856d6' },
    insurance:  { label: '保險',     icon: '🛡️', color: '#64d2ff' },
    gold:       { label: '黃金',     icon: '🥇', color: '#ffd60a' },
    platinum:   { label: '白金',     icon: '🥈', color: '#e5e5ea' },
    silver:     { label: '白銀',     icon: '🪙', color: '#c0c0c0' },
    other:      { label: '其他',     icon: '💼', color: '#aeaeb2' },
  };

  const CURRENCIES  = ['TWD', 'USD', 'JPY', 'EUR', 'HKD', 'CNY', 'AUD', 'GBP'];
  const METAL_TYPES = ['gold', 'platinum', 'silver'];
  const STOCK_TYPES = ['tw_stock', 'us_stock', 'tw_etf', 'us_etf', 'bond'];
  const CASH_TYPES  = ['twd_cash', 'usd_cash', 'realEstate', 'insurance', 'other'];

  /* ─── 初始化 ─────────────────────────────────────── */
  async function init() {
    // 資料遷移：修復舊版本存入的貴金屬資產
    try {
      const UNIT_TO_GRAM_MIG = { oz: 31.1035, g: 1, qian: 3.75, tael: 37.5 };
      const state = PRO.state.get();
      state.assets.forEach(a => {
        if (METAL_TYPES.includes(a.type)) {
          const updates = {};
          if (!a.metalUnit) updates.metalUnit = 'tael';
          if (a.currency === 'USD') updates.currency = 'TWD';
          // If price was stored per-unit (large number like 182259), convert to per-gram
          // twdPerTael ~ 182000+, twdPerGram ~ 4000-5000
          if (a.price > 10000 && a.metalUnit) {
            // Convert from per-unit price to per-gram
            const ug = UNIT_TO_GRAM_MIG[a.metalUnit] || 37.5;
            updates.price = Math.round(a.price / ug);
            updates.metalUnitToGram = ug;
          } else if (!a.metalUnitToGram && a.metalUnit) {
            updates.metalUnitToGram = UNIT_TO_GRAM_MIG[a.metalUnit] || 37.5;
          }
          if (Object.keys(updates).length) PRO.state.updateAsset(a.id, updates);
        }
      });
    } catch(e) {}

    _initialized = true;
    _render();
    _bindHeaderActions();

    try { _rates = await PRO.api.getRates(); } catch {}
    await _refreshQuotes();
    _render();
  }

  /* ─── 報價更新 ────────────────────────────────────── */
  async function _refreshQuotes() {
    const state = PRO.state.get();

    // 貴金屬即時報價 (Stock-YC 公克中介法)
    // 存 price = twdPerGram，計算時用 qty * UNIT_TO_GRAM[unit] * twdPerGram
    const UNIT_TO_GRAM = { oz: 31.1035, g: 1, qian: 3.75, tael: 37.5 };
    const metalAssets = state.assets.filter(a => METAL_TYPES.includes(a.type));
    if (metalAssets.length > 0 && PRO.api.getMetals) {
      try {
        const metalsData = await PRO.api.getMetals();
        if (metalsData && metalsData.success) {
          metalAssets.forEach(a => {
            const mData = metalsData[a.type];
            if (!mData) return;
            PRO.state.updateAsset(a.id, {
              price: mData.twdPerGram,         // 永遠存公克價，單位換算在 calcSummary
              metalUnitToGram: UNIT_TO_GRAM[a.metalUnit || 'tael'],
              changePercent: mData.changePercent,
              currency: 'TWD',
              updatedAt: Date.now(),
            });
          });
        }
      } catch (e) { console.warn('Metal refresh failed:', e); }
    }

    // 股票/ETF 即時報價
    const tradable = state.assets.filter(a => a.symbol && STOCK_TYPES.includes(a.type));
    if (!tradable.length) return;
    const symbols = [...new Set(tradable.map(a => a.symbol))];
    const fugleKey = (state.settings && state.settings.fugleApiKey) || '';
    try {
      const quotes = await PRO.api.batchQuote(symbols, fugleKey);
      const quoteMap = {};
      quotes.forEach(q => { if (!q.error) quoteMap[q.symbol] = q; });
      const updatedAssets = state.assets.map(a => {
        const q = quoteMap[a.symbol];
        if (!q) return a;
        return Object.assign({}, a, {
          price: q.regularMarketPrice,
          prevClose: q.regularMarketPreviousClose,
          changePercent: q.regularMarketChangePercent,
          updatedAt: Date.now(),
        });
      });
      PRO.state.patch({ assets: updatedAssets });
    } catch (e) { console.warn('[assets] Quote refresh failed:', e.message); }
  }

  /* ─── 計算摘要 ─────────────────────────────────────── */
  function _calcSummary(assets) {
    let totalValue = 0, totalCost = 0, todayPnl = 0;
    const UNIT_TO_GRAM = { oz: 31.1035, g: 1, qian: 3.75, tael: 37.5 };
    assets.forEach(a => {
      const qty   = parseFloat(a.quantity)  || 0;
      const price = parseFloat(a.price)     || 0;
      const cost  = parseFloat(a.costPrice) || 0;
      const rate  = a.currency === 'TWD' ? 1 : (_rates[a.currency] || 1);

      // 貴金屬用公克中介法 (Stock-YC style)
      let value;
      const isMetal = ['gold','platinum','silver'].includes(a.type);
      if (isMetal && price > 0) {
        const unitGram = a.metalUnitToGram || UNIT_TO_GRAM[a.metalUnit || 'tael'] || 37.5;
        value = qty * unitGram * price; // weight * gram/unit * twd/gram = twd
      } else {
        value = qty * price;
      }

      totalValue += value * rate;
      totalCost  += (cost > 0 ? cost : value) * rate;

      if (a.prevClose) {
        todayPnl += (value - qty * parseFloat(a.prevClose)) * rate;
      }
    });
    return {
      totalValue,
      totalCost,
      unrealizedPnl: totalValue - totalCost,
      unrealizedPct: totalCost > 0 ? (totalValue - totalCost) / totalCost * 100 : 0,
      todayPnl,
    };
  }

  /* ─── 渲染主頁 ─────────────────────────────────────── */
  function _render() {
    const state = PRO.state.get();
    const assets = state.assets;
    const container = document.getElementById('assets-content');
    if (!container) return;

    if (!assets.length) {
      container.innerHTML = _renderEmpty();
      container.querySelector('#btn-add-asset-empty') && container.querySelector('#btn-add-asset-empty').addEventListener('click', openAddSheet);
      _updateHeaderActions(false);
      return;
    }

    const summary = _calcSummary(assets);
    const hideAmounts = state.settings && state.settings.hideAmounts;

    const groups = {};
    assets.forEach(a => {
      let type = a.type || 'other';
      if (type === 'stock') type = 'tw_stock';
      if (type === 'etf')   type = 'tw_etf';
      if (type === 'cash')  type = 'twd_cash';

      const typeInfo = ASSET_TYPES[type] || ASSET_TYPES.other;
      let groupKey   = type;
      let groupTitle = typeInfo.label;
      let groupIcon  = typeInfo.icon;
      let groupColor = typeInfo.color;

      if (type === 'twd_cash' || type === 'usd_cash') {
        const bankName = a.name.split('-')[0].trim();
        groupKey   = 'bank_' + bankName;
        groupTitle = '🏦 ' + bankName;
        groupIcon  = '';
        groupColor = '#34c759';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = { title: groupTitle, icon: groupIcon, color: groupColor, items: [] };
      }
      groups[groupKey].items.push(a);
    });

    const _snaps = (PRO.state.get().netWorthSnapshots || []).sort((a,b)=>a.date.localeCompare(b.date));
    const _hasChart = _snaps.length >= 2;
      const _modeLbl = _assetChartMode === 'pct' ? '⇄ %' : '⇄ TWD';
      let html = `<div class="card fade-in" style="margin-bottom:16px;position:relative;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:13px;color:var(--text-secondary);font-weight:600;">總資產</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button onclick="PRO.assets._toggleChartMode()" style="font-size:11px;padding:3px 8px;border-radius:20px;background:rgba(255,255,255,0.1);color:var(--text-secondary);border:none;cursor:pointer;">${_modeLbl}</button>
            <button class="btn-icon" id="btn-refresh-quotes" title="更新" style="padding:4px;"><span style="font-size:14px;">🔄</span></button>
          </div>
        </div>
        <div style="font-size:36px;font-weight:800;margin-bottom:4px;" class="${hideAmounts ? 'amount-hidden' : ''}">
          ${PRO.fmt.hide(PRO.fmt.money(summary.totalValue, 'TWD', true))}
        </div>
        <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
          <div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:2px;">今日損益</div>
            <div style="font-size:13px;font-weight:600;" class="${summary.todayPnl >= 0 ? 'pos' : 'neg'}">${PRO.fmt.hide(PRO.fmt.money(summary.todayPnl, 'TWD'))}</div>
          </div>
          <div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:2px;">未實現損益</div>
            <div style="font-size:13px;font-weight:600;" class="${summary.unrealizedPnl >= 0 ? 'pos' : 'neg'}">${PRO.fmt.hide(PRO.fmt.money(summary.unrealizedPnl, 'TWD'))} (${PRO.fmt.pct(summary.unrealizedPct, 1)})</div>
          </div>
        </div>
        
        <div style="display:flex;gap:6px;margin-bottom:12px;background:rgba(255,255,255,0.05);padding:4px;border-radius:24px;width:fit-content;">
          <button class="range-tab ${_assetChartRange==='month'?'active':''}" onclick="PRO.assets._setChartRange(this.dataset.r)" data-r="month">近月</button>
          <button class="range-tab ${_assetChartRange==='ytd'?'active':''}" onclick="PRO.assets._setChartRange(this.dataset.r)" data-r="ytd">今年</button>
          <button class="range-tab ${_assetChartRange==='all'?'active':''}" onclick="PRO.assets._setChartRange(this.dataset.r)" data-r="all">全部</button>
        </div>
        
        <div style="position:relative;height:180px;width:100%;">
          ${!_hasChart ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);border-radius:12px;z-index:10;flex-direction:column;backdrop-filter:blur(2px);"><div style="font-size:24px;margin-bottom:8px;">📊</div><div style="font-size:14px;font-weight:600;">資料不足</div></div>` : ''}
          <canvas id="chart-asset-trend"></canvas>
        </div>
      </div>`;
      
      if (!(state.settings && state.settings.fugleApiKey)) {
      html += '<div class="card" style="background:rgba(10,132,255,0.08);border-color:rgba(10,132,255,0.2);"><div style="display:flex;align-items:center;gap:12px;"><span style="font-size:24px;">🔑</span><div><div style="font-weight:600;margin-bottom:2px;">設定台股即時報價</div><div style="font-size:13px;color:var(--text-secondary);">設定 Fugle API Token 來啟用</div></div><button class="btn btn-primary" style="padding:8px 14px;font-size:13px;margin-left:auto;" id="btn-goto-fugle">設定</button></div></div>';
    }

    const sortedKeys = Object.keys(groups).sort((a, b) => groups[a].title.localeCompare(groups[b].title));
    sortedKeys.forEach(key => {
      const g = groups[key];
      const catTotal = _calcSummary(g.items).totalValue;
      html += '<div class="list-section-header" style="margin-top:24px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;margin-bottom:12px;">';
      html += '<span class="list-section-label" style="color:' + g.color + ';display:flex;align-items:center;gap:6px;">' + (g.icon ? '<span>' + g.icon + '</span> ' : '') + g.title + '</span>';
      html += '<span class="list-section-sum">' + PRO.fmt.hide(PRO.fmt.money(catTotal, 'TWD', true)) + '</span></div>';
      g.items.forEach(a => { html += _renderAssetCard(a, hideAmounts); });
    });

    html += '<div style="display:flex;justify-content:center;margin-top:24px;padding-bottom:24px;"><button id="btn-add-asset-bottom" style="width:100%;max-width:300px;padding:16px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px dashed var(--border);color:var(--text-secondary);font-size:16px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;"><span>＋</span> 新增資產</button></div>';
    container.innerHTML = html;

    _bindAssetEvents(container);
    requestAnimationFrame(_drawAssetChart);
    var addBtn = container.querySelector('#btn-add-asset-bottom');
    if (addBtn) addBtn.addEventListener('click', openAddSheet);
    _updateHeaderActions(true);
  }

  /* ─── 資產卡片 ─────────────────────────────────────── */
  function _renderAssetCard(asset, hideAmounts) {
    const typeInfo  = ASSET_TYPES[asset.type] || ASSET_TYPES.other;
    const qty       = parseFloat(asset.quantity)  || 0;
    const price     = parseFloat(asset.price)     || 0;
    const cost      = parseFloat(asset.costPrice) || 0;
    const rate      = asset.currency === 'TWD' ? 1 : (_rates[asset.currency] || 1);
    const isMetal   = METAL_TYPES.includes(asset.type);
    const mLabel    = isMetal && asset.metalUnit ? (METAL_UNITS[asset.metalUnit] || '') : '';

    const UNIT_TO_GRAM_CARD = { oz: 31.1035, g: 1, qian: 3.75, tael: 37.5 };
    let value;
    if (isMetal && price > 0) {
      const ug = asset.metalUnitToGram || UNIT_TO_GRAM_CARD[asset.metalUnit || 'tael'] || 37.5;
      value = qty * ug * price * rate;
    } else {
      value = qty * price * rate;
    }
    const changePct = parseFloat(asset.changePercent) || 0;
    const curValTWD = isMetal && price > 0 ? qty * (asset.metalUnitToGram || UNIT_TO_GRAM_CARD[asset.metalUnit || 'tael'] || 37.5) * price : qty * price;
    const pnlPct    = cost > 0 ? (curValTWD - cost) / cost * 100 : 0;
    const qtyDisplay = isMetal ? (PRO.fmt.num(qty) + ' ' + mLabel) : PRO.fmt.num(qty);

    const gradients = {
      tw_stock: 'linear-gradient(135deg,#0a84ff,#5856d6)',
      us_stock: 'linear-gradient(135deg,#5e5ce6,#bf5af2)',
      tw_etf:   'linear-gradient(135deg,#32ade6,#0a84ff)',
      us_etf:   'linear-gradient(135deg,#0a84ff,#32ade6)',
      twd_cash: 'linear-gradient(135deg,#34c759,#30d158)',
      usd_cash: 'linear-gradient(135deg,#30b0c7,#32ade6)',
      bond:     'linear-gradient(135deg,#ffd60a,#ff9f0a)',
      realEstate:'linear-gradient(135deg,#5856d6,#bf5af2)',
      insurance: 'linear-gradient(135deg,#64d2ff,#5ac8fa)',
      gold:     'linear-gradient(135deg,#ffd60a,#ff9f0a)',
      platinum: 'linear-gradient(135deg,#e5e5ea,#aeaeb2)',
      silver:   'linear-gradient(135deg,#c0c0c0,#8e8e93)',
      other:    'linear-gradient(135deg,#636366,#48484a)',
    };
    const bg = gradients[asset.type] || gradients.other;
    const showChange = isMetal || STOCK_TYPES.includes(asset.type);

    let changeHTML = '';
    if (cost > 0) {
      const dailyTag = (showChange && changePct !== 0) ? ' <span style="font-size:11px;opacity:0.75;">(' + PRO.fmt.pct(changePct, 2) + '今日)</span>' : '';
      const pnlVal = (curValTWD - cost) * rate;
      changeHTML = '<div class="asset-change ' + (pnlVal >= 0 ? 'pos' : 'neg') + '">' + (pnlVal > 0 ? '+' : '') + PRO.fmt.money(pnlVal, 'TWD') + ' (' + PRO.fmt.pct(pnlPct, 2) + ')' + dailyTag + '</div>';
    } else if (showChange && changePct !== 0) {
      changeHTML = '<div class="asset-change ' + (changePct >= 0 ? 'pos' : 'neg') + '">' + PRO.fmt.pct(changePct, 2) + '</div>';
    } else {
      changeHTML = '<div class="asset-change" style="color:var(--text-tertiary);">--</div>';
    }

    return '<div class="asset-card" data-id="' + asset.id + '" style="cursor:pointer;">' +
      '<div class="asset-card-left">' +
      '<div class="asset-icon" style="background:' + bg + ';">' + typeInfo.icon + '</div>' +
      '<div><div class="asset-name">' + (asset.name || asset.symbol || '未命名') + '</div>' +
      '<div class="asset-qty">' + qtyDisplay + '</div></div></div>' +
      '<div class="asset-card-right">' +
      '<div class="asset-value ' + (hideAmounts ? 'amount-hidden' : '') + '">' + PRO.fmt.hide(PRO.fmt.money(value, 'TWD', true)) + '</div>' +
      changeHTML + '</div></div>';
  }

  function _renderEmpty() {
    return '<div class="empty-state fade-in"><div class="empty-state-icon">📊</div><h3 class="empty-state-title">還沒有資產</h3><p class="empty-state-sub">點下方新增第一個資產<br/>開始追蹤你的財富</p><div style="height:24px;"></div><button class="btn btn-primary" id="btn-add-asset-empty" style="padding:14px 32px;">+ 新增資產</button></div>';
  }

  /* ─── 事件綁定 ─────────────────────────────────────── */
  function _bindAssetEvents(container) {
    var refreshBtn = container.querySelector('#btn-refresh-quotes');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.style.animation = 'spin 0.8s linear infinite';
        try {
          _rates = await PRO.api.getRates();
          await _refreshQuotes();
          _render();
          PRO.toast('已更新', 'success');
        } catch (err) {
          PRO.toast('更新失敗：' + err.message, 'error');
        }
        btn.style.animation = '';
      });
    }
    var fugleBtn = container.querySelector('#btn-goto-fugle');
    if (fugleBtn) fugleBtn.addEventListener('click', () => PRO.navigate('settings'));
    container.querySelectorAll('.asset-card[data-id]').forEach(card => {
      card.addEventListener('click', () => openDetailSheet(card.dataset.id));
    });
  }

  function _updateHeaderActions(hasAssets) {
    const actions = document.getElementById('page-actions');
    if (!actions) return;
    if (document.getElementById('page-assets') && document.getElementById('page-assets').classList.contains('active')) {
      actions.innerHTML = '';
    }
  }
  function _bindHeaderActions() { _updateHeaderActions(true); }

  /* ─── 新增資產 Sheet ─────────────────────────────────── */
  function openAddSheet() {
    var currencyOptions = CURRENCIES.map(c => '<option value="' + c + '">' + c + '</option>').join('');
    var html = '<div class="sheet-title">新增資產</div>' +
      '<div class="form-group"><label class="form-label">資產名稱</label>' +
      '<input class="form-input" id="add-name" placeholder="例如：元大台灣50 或 國泰世華" /></div>' +
      '<div class="form-group" id="grp-symbol"><label class="form-label">股票代號 (選填)</label>' +
      '<input class="form-input" id="add-symbol" placeholder="例如：0050.TW 或 AAPL" />' +
      '<div class="form-help">台股加 .TW，輸入後系統自動查詢</div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
      '<div class="form-group"><label class="form-label">類型</label>' +
      '<select class="form-select" id="add-type">' +
      '<option value="tw_stock">台股</option><option value="us_stock">美股</option>' +
      '<option value="tw_etf">台股ETF</option><option value="us_etf">美股ETF</option>' +
      '<option value="twd_cash">台幣</option><option value="usd_cash">美金</option>' +
      '<option value="bond">債券</option><option value="realEstate">不動產</option>' +
      '<option value="insurance">保險</option><option value="gold">黃金</option>' +
      '<option value="platinum">白金</option><option value="silver">白銀</option>' +
      '<option value="other">其他</option></select></div>' +
      '<div class="form-group" id="grp-currency"><label class="form-label">幣別</label>' +
      '<select class="form-select" id="add-currency">' + currencyOptions + '</select></div></div>' +
      '<div class="form-group" id="grp-metal-unit" style="display:none;"><label class="form-label">貴金屬單位</label>' +
      '<select class="form-select" id="add-metal-unit">' +
      '<option value="tael">台兩</option><option value="qian">台錢</option>' +
      '<option value="oz">盎司 (OZ)</option><option value="g">公克 (g)</option></select></div>' +
      '<div id="grp-stock-fields"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
      '<div class="form-group"><label class="form-label" id="lbl-qty">數量 / 股數</label>' +
      '<input class="form-input" id="add-qty" type="number" min="0" step="any" placeholder="1000" /></div>' +
      '<div class="form-group"><label class="form-label">總投入成本 (選填)</label>' +
      '<input class="form-input" id="add-cost" type="number" step="any" placeholder="10000" /></div></div>' +
      '<div class="form-group"><label class="form-label">現在價格 (選填)</label>' +
      '<input class="form-input" id="add-price" type="number" step="any" placeholder="系統自動抓取報價" /></div></div>' +
      '<div id="grp-amount-container" style="display:none;"><div class="form-group">' +
      '<label class="form-label" id="lbl-amount">目前總金額 / 市值</label>' +
      '<input class="form-input" id="add-amount" type="number" min="0" step="any" placeholder="例如：10000" />' +
      '<div class="form-help" id="help-amount">非股票資產請直接輸入當前總值即可</div></div></div>' +
      '<div class="form-group" style="margin-top:16px;"><label class="form-label">被動收入標籤</label>' +
      '<div style="display:flex;gap:16px;margin-top:8px;">' +
      '<label class="checkbox-label"><input type="checkbox" id="tag-dividend"> 股息</label>' +
      '<label class="checkbox-label"><input type="checkbox" id="tag-rent"> 收租</label>' +
      '<label class="checkbox-label"><input type="checkbox" id="tag-interest"> 利息</label>' +
      '</div></div>' +
      '<div style="display:flex;gap:12px;margin-top:24px;">' +
      '<button class="btn btn-ghost" style="flex:1;" id="btn-add-cancel">取消</button>' +
      '<button class="btn btn-primary" style="flex:2;" id="btn-add-confirm">新增資產</button></div>';

    PRO.sheet.open(html);

    const selType   = document.getElementById('add-type');
    const selCurr   = document.getElementById('add-currency');
    const grpCurr   = document.getElementById('grp-currency');
    const grpSymbol = document.getElementById('grp-symbol');
    const grpStock  = document.getElementById('grp-stock-fields');
    const grpMetal  = document.getElementById('grp-metal-unit');
    const grpAmount = document.getElementById('grp-amount-container');

    function updateFormVisibility() {
      const type    = selType.value;
      const isStock = STOCK_TYPES.includes(type);
      const isMetal = METAL_TYPES.includes(type);

      if (isMetal) {
        grpCurr.style.display = 'none';
        selCurr.value = 'TWD';
      } else {
        grpCurr.style.display = 'block';
      }

      if (isStock) {
        grpSymbol.style.display = 'block';
        grpStock.style.display  = 'block';
        grpMetal.style.display  = 'none';
        grpAmount.style.display = 'none';
        document.getElementById('lbl-qty').textContent = '數量 / 股數';
        document.getElementById('add-qty').placeholder = '1000';
        document.getElementById('add-price').placeholder = '系統自動抓取報價';
      } else if (isMetal) {
        grpSymbol.style.display = 'none';
        grpStock.style.display  = 'block';
        grpMetal.style.display  = 'block';
        grpAmount.style.display = 'none';
        document.getElementById('lbl-qty').textContent = '持有數量';
        document.getElementById('add-qty').placeholder = '例如：2（輸入數量）';
        document.getElementById('add-price').placeholder = '系統自動抓取（可空白）';
      } else {
        grpSymbol.style.display = 'none';
        grpStock.style.display  = 'none';
        grpMetal.style.display  = 'none';
        grpAmount.style.display = 'block';
      }
    }

    selType.addEventListener('change', () => {
      updateFormVisibility();
      const t = selType.value;
      if (t === 'usd_cash' || t === 'us_stock' || t === 'us_etf') selCurr.value = 'USD';
      else if (['twd_cash','tw_stock','tw_etf'].includes(t)) selCurr.value = 'TWD';
    });


    // ── 自動識別代碼類型 ──────────────────────────────────────────
    function _autoDetectType(rawSym) {
      if (!rawSym) return;
      const sym = rawSym.trim().toUpperCase().replace(/\.TW$/i, '');

      // Taiwan symbols: 數字 [+ 尾碼]
      const twMatch = sym.match(/^(\d{4,6})([A-Z]?)$/);
      if (twMatch) {
        const digits = twMatch[1];
        const suffix = twMatch[2];
        let detected = 'tw_stock';

        if (suffix === 'B') {
          // 債券ETF e.g. 00978B, 00878B, 00720B
          detected = 'bond';
        } else if (suffix === 'L' || suffix === 'R') {
          // 槓桿/反向ETF e.g. 00631L, 00632R
          detected = 'tw_etf';
        } else if (suffix === 'A') {
          // 主動式ETF e.g. 00703A, 00762A
          detected = 'tw_etf';
        } else if (digits.startsWith('00') && digits.length >= 4) {
          // 一般台股ETF e.g. 0050, 006208, 00878
          detected = 'tw_etf';
        } else {
          // 普通台股 e.g. 2330, 2454
          detected = 'tw_stock';
        }

        selType.value = detected;
        selCurr.value = 'TWD';

        // Show hint badge
        const badge = document.getElementById('type-detect-badge');
        const labels = {
          tw_stock: '🇹🇼 台股',
          tw_etf: suffix === 'L' ? '⚡ 台股槓桿ETF' : suffix === 'R' ? '↩️ 台股反向ETF' : suffix === 'A' ? '✨ 台股主動式ETF' : '📊 台股ETF',
          bond: '📄 債券ETF',
        };
        if (badge) badge.textContent = labels[detected] || detected;
        updateFormVisibility();
        return;
      }

      // US symbols: 純英文或含數字
      const usEtfs = new Set([
        'SPY','QQQ','VTI','VOO','IWM','GLD','TLT','AGG','BND','XLF','XLK','XLE',
        'ARKK','ARKW','ARKG','ARKQ','VWO','EEM','HYG','LQD','SHY','IEF','SQQQ',
        'TQQQ','SPXL','SPXS','UPRO','UVXY','VXX','DIA','MDY','IJH','IJR',
        'VIG','SCHD','NOBL','DGRO','VYM','VNQ','XLRE','XLV','XLU','XLB','XLI',
        'IBIT','FBTC','BITO','VEA','VGK','EWJ','EWT','EWY','MCHI','KWEB',
      ]);
      if (/^[A-Z]{2,5}$/.test(sym)) {
        const detected = usEtfs.has(sym) ? 'us_etf' : 'us_stock';
        selType.value = detected;
        selCurr.value = 'USD';
        const badge = document.getElementById('type-detect-badge');
        if (badge) badge.textContent = detected === 'us_etf' ? '🇺🇸 美股ETF' : '🇺🇸 美股';
        updateFormVisibility();
      }
    }

    let _symbolDebounceTimer = null;
    const inputSymbol = document.getElementById('add-symbol');
    const inputName = document.getElementById('add-name');
    
    inputSymbol.addEventListener('input', e => {
      let val = e.target.value.trim().toUpperCase();
      
      // We don't modify the value while typing to prevent cutting off typing (e.g. 0068.TW5L)
      _autoDetectType(val);

      // Debounced formatting and fetching
      clearTimeout(_symbolDebounceTimer);
      if (val) {
         _symbolDebounceTimer = setTimeout(async () => {
            // After user stops typing for 1000ms, auto-append .TW if it's a Taiwan stock
            if (/^\d{4,6}[A-Z]?$/.test(val)) {
               val = val + '.TW';
               inputSymbol.value = val;
               _autoDetectType(val); // Update type detection with the final .TW
            }

            const key = (PRO.state.get().settings || {}).fugleApiKey || '';
            inputSymbol.style.opacity = '0.5';
            try {
               const data = await PRO.api.getQuote(val, key);
               // Only fill if user hasn't typed a name yet
               if (data && data.quote && (data.quote.shortName || data.quote.longName) && !inputName.value) {
                  inputName.value = data.quote.shortName || data.quote.longName;
               }
            } catch(err) {
               console.warn('[Assets] Failed to auto-fetch name', err);
            }
            inputSymbol.style.opacity = '1';
         }, 1000);
      }
    });

    inputSymbol.addEventListener('blur', e => {
      let val = e.target.value.trim().toUpperCase();
      // Final fallback format on blur
      if (/^\d{4,6}[A-Z]?$/.test(val)) {
         val = val + '.TW';
         e.target.value = val;
      } else {
         e.target.value = val;
      }
      _autoDetectType(val);
    });

    document.getElementById('btn-add-cancel').addEventListener('click', () => PRO.sheet.close());

    document.getElementById('btn-add-confirm').addEventListener('click', async () => {
      const name     = document.getElementById('add-name').value.trim();
      const type     = selType.value;
      const currency = selCurr.value;
      let symbol     = document.getElementById('add-symbol').value.trim().toUpperCase();

      const isStock  = STOCK_TYPES.includes(type);
      const isMetal  = METAL_TYPES.includes(type);

      if (!name) { PRO.toast('請輸入資產名稱', 'error'); return; }

      let qty = 0, costPrice = null, price = null, metalUnit = null;

      if (isStock || isMetal) {
        qty       = parseFloat(document.getElementById('add-qty').value)   || 0;
        costPrice = parseFloat(document.getElementById('add-cost').value)  || null;
        price     = parseFloat(document.getElementById('add-price').value) || null;
        if (isMetal) metalUnit = document.getElementById('add-metal-unit').value;
        if (!qty) { PRO.toast('請輸入數量', 'error'); return; }
        if (!symbol && /^\d{4,6}$/.test(name) && isStock) symbol = name + '.TW';
      } else {
        const amount = parseFloat(document.getElementById('add-amount').value) || 0;
        if (!amount) { PRO.toast('請輸入金額', 'error'); return; }
        qty = 1; price = amount; costPrice = amount; symbol = '';
      }

      const tags = [];
      ['dividend','rent','interest'].forEach(t => {
        const el = document.getElementById('tag-' + t);
        if (el && el.checked) tags.push(t);
      });

      const category = ['realEstate','gold','platinum','silver'].includes(type) ? 'illiquid' : 'liquid';
      const asset = PRO.state.addAsset({ name, symbol, type, category, quantity: qty, currency, costPrice, price, tags, metalUnit });

      PRO.sheet.close();
      _render();
      PRO.toast('資產已新增', 'success');

      if (symbol && isStock) {
        try {
          const fugleKey = (PRO.state.get().settings && PRO.state.get().settings.fugleApiKey) || '';
          const result   = await PRO.api.getQuote(symbol, fugleKey, true);
          if (result && result.quote) {
            const q = result.quote;
            PRO.state.updateAsset(asset.id, {
              price: q.regularMarketPrice,
              prevClose: q.regularMarketPreviousClose,
              changePercent: q.regularMarketChangePercent,
              updatedAt: Date.now(),
            });
            _render();
          }
        } catch {}
      } else if (isMetal && PRO.api.getMetals) {
        try {
          const metalsData = await PRO.api.getMetals();
          const mData = metalsData && metalsData[type];
          if (mData) {
            const UNIT_TO_GRAM = { oz: 31.1035, g: 1, qian: 3.75, tael: 37.5 };
            const unit = metalUnit || 'tael';
            PRO.state.updateAsset(asset.id, {
              price: mData.twdPerGram,           // 存公克價
              metalUnitToGram: UNIT_TO_GRAM[unit],
              changePercent: mData.changePercent,
              currency: 'TWD',
              updatedAt: Date.now(),
            });
            _render();
          }
        } catch {}
      }
    });

    updateFormVisibility();
  }

  /* ─── 資產詳情 Sheet ─────────────────────────────────── */
  function openDetailSheet(assetId) {
    const state = PRO.state.get();
    const asset = state.assets.find(a => a.id === assetId);
    if (!asset) return;

    const isMetal   = METAL_TYPES.includes(asset.type);
    const mLabel    = isMetal && asset.metalUnit ? (METAL_UNITS[asset.metalUnit] || '') : '';
    const qty       = parseFloat(asset.quantity)  || 0;
    const price     = parseFloat(asset.price)     || 0;
    const totalCost = parseFloat(asset.costPrice) || 0;
    const rate      = asset.currency === 'TWD' ? 1 : (_rates[asset.currency] || 1);

    const UNIT_TO_GRAM_DET = { oz: 31.1035, g: 1, qian: 3.75, tael: 37.5 };
    let value, curVal;
    if (isMetal && price > 0) {
      const ug = asset.metalUnitToGram || UNIT_TO_GRAM_DET[asset.metalUnit || 'tael'] || 37.5;
      curVal = qty * ug * price;
      value  = curVal * rate;
    } else {
      curVal = qty * price;
      value  = curVal * rate;
    }
    const pnl       = totalCost > 0 ? (curVal - totalCost) * rate : 0;
    const pnlPct    = totalCost > 0 ? (curVal - totalCost) / totalCost * 100 : 0;

    const incomeRecords = (asset.incomeRecords || []).slice(-5).reverse();
    const qtyDisplay    = isMetal ? (PRO.fmt.num(qty) + ' ' + mLabel) : PRO.fmt.num(qty);
    const avgCostLabel  = isMetal ? ('每' + (mLabel || '單位') + '成本') : '每股/單位均價';
    const pnlStr        = pnl !== 0 ? (PRO.fmt.money(pnl, 'TWD') + ' (' + PRO.fmt.pct(pnlPct, 2) + ')') : '--';

    let html = '<div class="sheet-title">' + (asset.name || asset.symbol || '資產詳情') + '</div>';
    html += '<div style="text-align:center;margin-bottom:24px;">';
    html += '<div style="font-size:32px;font-weight:700;">' + PRO.fmt.money(value, 'TWD', true) + '</div>';
    html += '<div style="font-size:15px;margin-top:4px;" class="' + (pnl >= 0 ? 'pos' : 'neg') + '">' + pnlStr + '</div></div>';
    html += '<div class="metrics-row" style="grid-template-columns:repeat(3,1fr);">';
    html += '<div class="metric-cell"><div class="metric-label">持有量</div><div class="metric-value">' + qtyDisplay + '</div></div>';
    const UNIT_TO_GRAM_DISPLAY = { oz: 31.1035, g: 1, qian: 3.75, tael: 37.5 };
    const displayPrice = isMetal && price > 0
      ? PRO.fmt.money(Math.round(price * (asset.metalUnitToGram || UNIT_TO_GRAM_DISPLAY[asset.metalUnit || 'tael'] || 37.5)), 'TWD')
      : (price ? 'NT$' + Number(price).toLocaleString('zh-TW', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '--');
    html += '<div class="metric-cell"><div class="metric-label">現價/單位</div><div class="metric-value">' + displayPrice + '</div></div>';
    html += '<div class="metric-cell"><div class="metric-label">總投入成本</div><div class="metric-value">' + (totalCost ? PRO.fmt.money(totalCost, 'TWD') : '--') + '</div></div>';
    html += '</div>';
    html += '<div style="background:var(--bg-input);border-radius:var(--radius-md);padding:12px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">';
    html += '<div><span style="color:var(--text-tertiary);">' + avgCostLabel + '</span><div style="font-weight:600;margin-top:2px;">' + (totalCost && qty ? 'NT$' + Number(totalCost / qty).toLocaleString('zh-TW', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '--') + '</div></div>';
    html += '<div><span style="color:var(--text-tertiary);">現在總市值</span><div style="font-weight:600;margin-top:2px;">' + PRO.fmt.money(value, 'TWD') + '</div></div>';
    html += '</div>';

    if (asset.tags && asset.tags.length) {
      html += '<div style="margin-bottom:16px;"><div class="form-label">被動收入記錄</div>';
      if (incomeRecords.length) {
        html += incomeRecords.map(r => '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:14px;"><span>' + r.date + ' 　' + (r.type==='dividend'?'股息':r.type==='rent'?'租金':'利息') + '</span><span class="pos">+' + PRO.fmt.money(r.amount, r.currency||asset.currency) + '</span></div>').join('');
      } else {
        html += '<div style="color:var(--text-tertiary);font-size:14px;padding:8px 0;">尚無記錄</div>';
      }
      html += '<button class="btn btn-ghost" style="width:100%;margin-top:12px;" id="btn-add-income">+ 新增收入</button></div>';
    }

    html += '<div style="display:flex;gap:12px;margin-top:8px;">';
    html += '<button class="btn btn-danger" style="flex:1;" id="btn-delete-asset">刪除</button>';
    html += '<button class="btn btn-ghost" style="flex:1;" id="btn-edit-qty">改數量</button>';
    html += '<button class="btn btn-ghost" style="flex:1;" id="btn-edit-cost">改成本</button>';
    html += '</div>';

    PRO.sheet.open(html);

    document.getElementById('btn-delete-asset').addEventListener('click', () => {
      if (!confirm('確定要刪除「' + (asset.name || asset.symbol) + '」嗎？')) return;
      PRO.state.removeAsset(assetId);
      PRO.sheet.close();
      _render();
      PRO.toast('已刪除資產', 'success');
    });

    document.getElementById('btn-edit-qty').addEventListener('click', () => {
      const newQty = prompt('請輸入新數量：', asset.quantity);
      if (newQty === null) return;
      const q = parseFloat(newQty);
      if (isNaN(q) || q < 0) { PRO.toast('數量格式錯誤', 'error'); return; }
      PRO.state.updateAsset(assetId, { quantity: q });
      PRO.sheet.close();
      _render();
      PRO.toast('已更新數量', 'success');
    });

    document.getElementById('btn-edit-cost').addEventListener('click', () => {
      const newCost = prompt('請輸入新的「總投入成本」：', asset.costPrice || '');
      if (newCost === null) return;
      const c = parseFloat(newCost);
      if (isNaN(c) || c < 0) { PRO.toast('成本格式錯誤', 'error'); return; }
      PRO.state.updateAsset(assetId, { costPrice: c });
      PRO.sheet.close();
      _render();
      PRO.toast('已更新成本', 'success');
    });

    var incomeBtn = document.getElementById('btn-add-income');
    if (incomeBtn) incomeBtn.addEventListener('click', () => _openIncomeSheet(assetId, asset));
  }

  /* ─── 收入記錄 Sheet ─────────────────────────────────── */
  function _openIncomeSheet(assetId, asset) {
    const today = new Date().toISOString().slice(0, 10);
    const types = (asset.tags || ['dividend']).filter(t => ['dividend','rent','interest'].includes(t));
    var currencyOptions = CURRENCIES.map(c => '<option value="' + c + '"' + (c === asset.currency ? ' selected' : '') + '>' + c + '</option>').join('');

    var html = '<div class="sheet-title">新增收入</div>';
    html += '<div class="form-group"><label class="form-label">收入類型</label><select class="form-select" id="income-type">';
    if (types.includes('dividend')) html += '<option value="dividend">股息</option>';
    if (types.includes('rent'))     html += '<option value="rent">租金</option>';
    if (types.includes('interest')) html += '<option value="interest">利息</option>';
    html += '</select></div>';
    html += '<div class="form-group"><label class="form-label">日期</label><input class="form-input" id="income-date" type="date" value="' + today + '" /></div>';
    html += '<div class="form-group"><label class="form-label">金額</label><input class="form-input" id="income-amount" type="number" min="0" step="any" placeholder="0" /></div>';
    html += '<div class="form-group"><label class="form-label">幣別</label><select class="form-select" id="income-currency">' + currencyOptions + '</select></div>';
    html += '<div style="display:flex;gap:12px;margin-top:8px;"><button class="btn btn-ghost" style="flex:1;" id="btn-income-cancel">取消</button><button class="btn btn-green" style="flex:2;" id="btn-income-confirm">新增收入</button></div>';

    PRO.sheet.open(html);
    document.getElementById('btn-income-cancel').addEventListener('click', () => PRO.sheet.close());
    document.getElementById('btn-income-confirm').addEventListener('click', () => {
      const type     = document.getElementById('income-type').value;
      const date     = document.getElementById('income-date').value;
      const amount   = parseFloat(document.getElementById('income-amount').value);
      const currency = document.getElementById('income-currency').value;
      if (!amount || amount <= 0) { PRO.toast('請輸入金額', 'error'); return; }
      PRO.state.addIncomeRecord(assetId, { type, date, amount, currency });
      PRO.sheet.close();
      PRO.toast('收入已新增', 'success');
      _render();
    });
  }


  /* ─── 資產走勢圖 ──────────────────────────────────────────────── */
  function _drawAssetChart() {
    const state = PRO.state.get();
    const ctx = document.getElementById('chart-asset-trend') && document.getElementById('chart-asset-trend').getContext('2d');
    if (!ctx || !window.Chart) return;
    if (_assetChartInst) { try { _assetChartInst.destroy(); } catch(e){} _assetChartInst = null; }

    let snaps = (state.netWorthSnapshots || []).sort((a, b) => a.date.localeCompare(b.date));
    if (snaps.length < 2) return;

    if (_assetChartRange === 'month') {
      snaps = snaps.slice(-30);
    } else if (_assetChartRange === 'ytd') {
      const yr = new Date().getFullYear().toString();
      const filtered = snaps.filter(s => s.date.startsWith(yr));
      if (filtered.length >= 2) snaps = filtered;
    }

    const labels = snaps.map(s => s.date.substring(5));
    let values, tickCb;

    if (_assetChartMode === 'pct') {
      const base = snaps[0].netWorth;
      values = snaps.map(s => base > 0 ? ((s.netWorth - base) / base * 100) : 0);
      tickCb = v => v.toFixed(0) + '%';
    } else {
      values = snaps.map(s => s.netWorth);
      tickCb = v => v >= 10000 ? (v / 10000).toFixed(0) + 'k' : v;
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 160);
    gradient.addColorStop(0, 'rgba(10,132,255,0.35)');
    gradient.addColorStop(1, 'rgba(10,132,255,0.0)');

    _assetChartInst = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ data: values, borderColor: '#0a84ff', backgroundColor: gradient, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, fill: true, tension: 0.1 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: { position: 'right', border: { display: false }, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8e8e93', font: { size: 10 }, callback: tickCb } }
        },
        interaction: { intersect: false, mode: 'index' }
      }
    });
  }

  function _toggleChartMode() {
    _assetChartMode = _assetChartMode === 'pct' ? 'twd' : 'pct';
    _render();
    requestAnimationFrame(_drawAssetChart);
  }

  function _setChartRange(range) {
    _assetChartRange = range;
    _render();
    requestAnimationFrame(_drawAssetChart);
  }

  return { init, refresh: _refreshQuotes, _toggleChartMode, _setChartRange };
})();
