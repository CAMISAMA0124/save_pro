/* ================================================
   state.js - 全域狀態管理 (LocalStorage)
   記帳PRO - 個人淨資產追蹤器
   ================================================ */

'use strict';

window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.state = (() => {

  
  let STORAGE_KEY = localStorage.getItem('jizhangpro_active_key') || 'jizhangpro_v1';

  function getAccounts() {
    let accs = JSON.parse(localStorage.getItem('jizhangpro_accounts'));
    if (!accs || !Array.isArray(accs) || accs.length === 0) {
      accs = [{ id: 'jizhangpro_v1', name: '我的主帳戶' }];
      localStorage.setItem('jizhangpro_accounts', JSON.stringify(accs));
    }
    return accs;
  }

  function getActiveAccount() {
    const accs = getAccounts();
    return accs.find(a => a.id === STORAGE_KEY) || accs[0];
  }

  function updateAccountName(id, name) {
    const accs = getAccounts();
    const target = accs.find(a => a.id === id);
    if (target) {
      target.name = name;
      localStorage.setItem('jizhangpro_accounts', JSON.stringify(accs));
    }
  }

  function createAccount(name) {
    const accs = getAccounts();
    const newId = 'jizhangpro_v1_' + Date.now();
    accs.push({ id: newId, name });
    localStorage.setItem('jizhangpro_accounts', JSON.stringify(accs));
    return newId;
  }
  
  function deleteAccount(id) {
    let accs = getAccounts();
    if (accs.length <= 1) return false;
    accs = accs.filter(a => a.id !== id);
    localStorage.setItem('jizhangpro_accounts', JSON.stringify(accs));
    localStorage.removeItem(id); // remove the data
    if (STORAGE_KEY === id) {
      switchAccount(accs[0].id);
    }
    return true;
  }

  function switchAccount(id) {
    localStorage.setItem('jizhangpro_active_key', id);
    STORAGE_KEY = id;
    _cache = null;
    location.reload();
  }


  function defaultState() {
    return {
      version: 1,
      settings: {
        currency: 'TWD',
        fugleApiKey: '',
        theme: 'dark',
        hideAmounts: false,
        dividendDefaultTWD: false,
        notifyRepayment: true,
      },
      assets: [],
      liabilities: [],
      netWorthSnapshots: [],
      cashflow: {
        incomeCategories: [
          { id: 'salary',   name: '薪資',   icon: '💼', color: '#34c759' },
          { id: 'bonus',    name: '獎金',   icon: '🎁', color: '#30d158' },
          { id: 'dividend', name: '股息',   icon: '📈', color: '#32ade6' },
          { id: 'rent',     name: '租金',   icon: '🏠', color: '#5856d6' },
          { id: 'interest', name: '利息',   icon: '🏦', color: '#64d2ff' },
          { id: 'other',    name: '其他收入', icon: '✨', color: '#aeaeb2' },
        ],
        expenseCategories: [
          { id: 'fixed',     name: '固定支出', icon: '🔒', color: '#ff453a' },
          { id: 'food',      name: '飲食',     icon: '🍜', color: '#ff9f0a' },
          { id: 'transport', name: '交通',     icon: '🚇', color: '#ffd60a' },
          { id: 'entertain', name: '娛樂',     icon: '🎮', color: '#bf5af2' },
          { id: 'repay',     name: '還款',     icon: '💳', color: '#ff6b6b' },
          { id: 'other',     name: '其他支出', icon: '📦', color: '#aeaeb2' },
        ],
        monthlyRecords: [],
      },
      accounts: [],
    retirementGoal: { targetAmount: 0 },
    mirrorUniverse: { enabled: false, trackSymbol: '0050', entries: [] },
    clecStrategy: { enabled: false, assets: [], targets: { cash: 25, leverage: 25, equity: 25, crypto: 25 } },
      activeAccountId: null,
    };
  }

  let _cache = null;

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return _deepMerge(defaultState(), JSON.parse(raw));
    } catch (e) {
      console.error('[state] Load failed:', e);
      return defaultState();
    }
  }

  function _save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('[state] Save failed:', e);
      alert('⚠️ 儲存失敗！LocalStorage 可能已滿，請先備份並清除部分資料。');
    }
  }

  function _deepMerge(target, source) {
    const result = Object.assign({}, target);
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = _deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  function _uuid() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }

  function _toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }

  /* --- 公開 API --- */
  function get() {
    if (!_cache) _cache = _load();
    return _cache;
  }

  function patch(updates) {
    if (!_cache) _cache = _load();
    _cache = _deepMerge(_cache, updates);
    _save(_cache);
    return _cache;
  }

  function replace(newState) {
    _cache = _deepMerge(defaultState(), newState);
    _save(_cache);
    return _cache;
  }

  function reset() {
    _cache = defaultState();
    _save(_cache);
    return _cache;
  }

  /* --- 資產 CRUD --- */
  function addAsset(asset) {
    const state = get();
    const newAsset = Object.assign({
      id: _uuid(), incomeRecords: [], createdAt: Date.now(),
      price: null, prevClose: null, changePercent: null, updatedAt: null,
      targetPct: null, costPrice: null, tags: [],
    }, asset);
    patch({ assets: [...state.assets, newAsset] });
    return newAsset;
  }

  function updateAsset(id, updates) {
    const state = get();
    patch({ assets: state.assets.map(a => a.id === id ? Object.assign({}, a, updates) : a) });
  }

  function removeAsset(id) {
    patch({ assets: get().assets.filter(a => a.id !== id) });
  }

  /* --- 負債 CRUD --- */
  function addLiability(liability) {
    const state = get();
    const newLiab = Object.assign({ id: _uuid(), repaymentRecords: [], createdAt: Date.now() }, liability);
    patch({ liabilities: [...state.liabilities, newLiab] });
    return newLiab;
  }

  function updateLiability(id, updates) {
    const state = get();
    patch({ liabilities: state.liabilities.map(l => l.id === id ? Object.assign({}, l, updates) : l) });
  }

  function removeLiability(id) {
    patch({ liabilities: get().liabilities.filter(l => l.id !== id) });
  }

  /* --- 被動收入紀錄 --- */
  function addIncomeRecord(assetId, record) {
    const state = get();
    const newRecord = Object.assign({ id: _uuid(), createdAt: Date.now() }, record);
    patch({
      assets: state.assets.map(a => a.id === assetId
        ? Object.assign({}, a, { incomeRecords: [...(a.incomeRecords||[]), newRecord] })
        : a)
    });
    return newRecord;
  }

  function removeIncomeRecord(assetId, recordId) {
    const state = get();
    patch({
      assets: state.assets.map(a => a.id === assetId
        ? Object.assign({}, a, { incomeRecords: (a.incomeRecords||[]).filter(r => r.id !== recordId) })
        : a)
    });
  }

  /* --- 淨資產快照 --- */
  function takeSnapshot(totals) {
    const state = get();
    const today = _toDateStr(new Date());
    const snapshots = (state.netWorthSnapshots||[]).filter(s => s.date !== today);
    snapshots.push(Object.assign({ date: today }, totals));
    patch({ netWorthSnapshots: snapshots.slice(-1825) }); // 最近5年
  }

  function getSnapshots(range) {
    const state = get();
    const snaps = state.netWorthSnapshots || [];
    if (range === 'all') return snaps;
    const now = new Date();
    const cutoff = range === 'month'
      ? new Date(now.getFullYear(), now.getMonth()-1, now.getDate())
      : new Date(now.getFullYear(), 0, 1);
    const cutoffStr = _toDateStr(cutoff);
    return snaps.filter(s => s.date >= cutoffStr);
  }

  /* --- 金流月記錄 --- */
  function setCashflowMonth(yearMonth, data) {
    const state = get();
    const records = (state.cashflow.monthlyRecords||[]).filter(r => r.yearMonth !== yearMonth);
    records.push(Object.assign({ yearMonth }, data));
    records.sort((a,b) => a.yearMonth.localeCompare(b.yearMonth));
    patch({ cashflow: Object.assign({}, state.cashflow, { monthlyRecords: records }) });
  }

  function getCashflowMonth(yearMonth) {
    return (get().cashflow.monthlyRecords||[]).find(r => r.yearMonth === yearMonth) || null;
  }

  /* --- 備份 / 還原 --- */
  function exportBackup() {
    const backup = Object.assign({ __version: 1, __exportedAt: new Date().toISOString(), __app: 'jizhangpro' }, get());
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `記帳PRO_備份_${_toDateStr(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.__app !== 'jizhangpro') throw new Error('不是記帳PRO的備份檔案');
      const { __version, __exportedAt, __app, ...stateData } = data;
      replace(stateData);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /* --- 計算輔助 --- */
  function calcTotalAssets(assets, rates) {
    return assets.reduce((sum, a) => {
      if (!a.price || !a.quantity) return sum;
      const value = parseFloat(a.quantity) * parseFloat(a.price);
      if (a.currency === 'TWD') return sum + value;
      return sum + value * ((rates && rates[a.currency]) || 1);
    }, 0);
  }

  function calcTotalLiabilities(liabilities, rates) {
    return liabilities.reduce((sum, l) => {
      const principal = l.remainingPrincipal != null ? parseFloat(l.remainingPrincipal)||0 : parseFloat(l.totalAmount)||0;
      if (l.currency === 'TWD') return sum + principal;
      return sum + principal * ((rates && rates[l.currency]) || 1);
    }, 0);
  }

  function calcPassiveIncome(assets, yearMonth) {
    let dividend=0, rent=0, interest=0;
    assets.forEach(a => {
      (a.incomeRecords||[]).forEach(r => {
        if (yearMonth && !r.date.startsWith(yearMonth)) return;
        const amt = parseFloat(r.amount)||0;
        if (r.type==='dividend') dividend+=amt;
        else if (r.type==='rent') rent+=amt;
        else if (r.type==='interest') interest+=amt;
      });
    });
    return { dividend, rent, interest, total: dividend+rent+interest };
  }

  return {
    getAccounts, getActiveAccount, updateAccountName, createAccount, deleteAccount, switchAccount,
    get, patch, replace, reset,
    addAsset, updateAsset, removeAsset,
    addLiability, updateLiability, removeLiability,
    addIncomeRecord, removeIncomeRecord,
    takeSnapshot, getSnapshots,
    setCashflowMonth, getCashflowMonth,
    exportBackup, importBackup,
    calcTotalAssets, calcTotalLiabilities, calcPassiveIncome,
  };
})();