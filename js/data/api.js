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
      return { getHistory, gistBackup, gistRestore, USD: 32, JPY: 0.21, EUR: 34, CNY: 4.4, HKD: 4.1, AUD: 20, GBP: 41 };
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
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
    const cacheKey = `pro_etf_cache_${symbol}`;
    try {
      // Check localStorage cache first
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
        console.log(`[ETF cache hit] ${symbol}`);
        return cached.data;
      }
    } catch(e) {}

    try {
      const fmpKey = (PRO.state && PRO.state.get().settings || {}).fmpApiKey || '';
      const params = new URLSearchParams({ fmpKey });
      const data = await _fetch(`/api/etf/${encodeURIComponent(symbol)}/holdings?${params}`);
      // Store in localStorage cache
      if (data && data.holdings && data.holdings.length > 0) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
        } catch(e) {}
      }
      return data;
    } catch (e) {
      console.warn('Failed to fetch etf holdings', e);
      return null;
    }
  }

  async function getHistory(symbol, from, to, fugleKey) {
    try {
      const params = new URLSearchParams({ from, to });
      if (fugleKey) params.append('fugleKey', fugleKey);
      const r = await fetch(`/api/history/${encodeURIComponent(symbol)}?${params}`);
      const d = await r.json();
      return d.ok ? d.data : [];
    } catch (e) {
      console.warn('[api.getHistory]', symbol, e);
      return [];
    }
  }


  // ── GitHub Gist backup / restore ─────────────────────────────────────────
  async function gistBackup(token, existingGistId) {
    const state = PRO.state.get();
    // Remove sensitive keys if any
    const payload = JSON.stringify(state, null, 2);
    const filename = 'savepro_backup.json';

    try {
      let url, method;
      if (existingGistId) {
        url = `https://api.github.com/gists/${existingGistId}`;
        method = 'PATCH';
      } else {
        url = 'https://api.github.com/gists';
        method = 'POST';
      }
      const body = {
        description: '記帳PRO 雲端備份 ' + new Date().toLocaleString('zh-TW'),
        public: false,
        files: { [filename]: { content: payload } }
      };
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return { ok: true, gistId: data.id, url: data.html_url };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async function gistRestore(token, gistId) {
    try {
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: { Authorization: `token ${token}` }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const file = data.files['savepro_backup.json'];
      if (!file) throw new Error('找不到備份檔案');
      const state = JSON.parse(file.content);
      return { ok: true, state };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }


  return { getRates, batchQuote, getQuote, syncPush, syncPull, checkHealth, getMetals, getEtfHoldings };
})();