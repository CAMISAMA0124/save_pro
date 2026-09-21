/* ================================================
   api.js - 後端 API 呼叫封裝
   記帳PRO - 前端 fetch 層
   ================================================ */

'use strict';

window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.api = (() => {

  const BASE = window.location.hostname === 'localhost' ? '' : '';

  // 匯率快取（5分鐘）
  let _ratesCache = null;
  let _ratesTs = 0;
  const RATES_TTL = 5 * 60 * 1000;

  // 每支股票的報價快取（3分鐘）
  const _quoteCache = new Map();
  const QUOTE_TTL = 3 * 60 * 1000;

  async function _fetch(path, opts = {}) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        ...opts,
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      if (e.name === 'TypeError' && e.message.includes('fetch')) {
        throw new Error('無法連線到本機伺服器，請確認 node server.js 正在執行中');
      }
      throw e;
    }
  }

  /** 取得匯率（含快取） */
  async function getRates(force = false) {
    const now = Date.now();
    if (!force && _ratesCache && now - _ratesTs < RATES_TTL) {
      return _ratesCache;
    }
    try {
      const data = await _fetch('/api/rates');
      if (data.success) {
        _ratesCache = data.rates;
        _ratesTs = now;
        return data.rates;
      }
    } catch (e) {
      // Fallback if /api/rates not implemented
    }
      return { USD: 32, JPY: 0.21, EUR: 34, CNY: 4.4, HKD: 4.1, AUD: 20, GBP: 41 };
  }

  /** 批次更新報價（資產頁主要使用） */
  async function batchQuote(symbols, fugleKey = '') {
    if (!symbols.length) return [];
    const params = new URLSearchParams({
      symbols: symbols.join(','),
      fugleKey: fugleKey || '',
    });
    return await _fetch(`/api/batch?${params}`);
  }

  /** 單支股票詳細報價 + 歷史（含快取） */
  async function getQuote(symbol, fugleKey = '', force = false) {
    const now = Date.now();
    const cached = _quoteCache.get(symbol);
    if (!force && cached && now - cached.ts < QUOTE_TTL) {
      return cached.data;
    }
    const params = new URLSearchParams({ fugleKey: fugleKey || '' });
    const data = await _fetch(`/api/quote/${encodeURIComponent(symbol)}?${params}`);
    _quoteCache.set(symbol, { data, ts: now });
    return data;
  }

  /** 推送狀態到 Sync Vault，回傳 6 位數 Code */
  async function syncPush(state) {
    const data = await _fetch('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify(state),
    });
    return data; // { code, expiresIn }
  }

  /** 用 Code 拉取狀態（一次性） */
  async function syncPull(code) {
    return await _fetch(`/api/sync/pull/${encodeURIComponent(code)}`);
  }

  /** 健康檢查 */
  async function checkHealth() {
    try {
      const data = await _fetch('/api/health');
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  
  async function getMetals() {
    try {
      const data = await _fetch('/api/metals');
      return data;
    } catch (e) {
      console.warn('Failed to fetch metals', e);
      return null;
    }
  }

    /** 取得 ETF 成分股 */
  async function getEtfHoldings(symbol) {
    try {
      const fmpKey = (PRO.state && PRO.state.get().settings || {}).fmpApiKey || '';
      const params = new URLSearchParams({ fmpKey });
      const data = await _fetch(`/api/etf/${encodeURIComponent(symbol)}/holdings?${params}`);
      return data;
    } catch (e) {
      console.warn('Failed to fetch etf holdings', e);
      return null;
    }
  }

  return { getRates, batchQuote, getQuote, syncPush, syncPull, checkHealth, getMetals, getEtfHoldings };
})();