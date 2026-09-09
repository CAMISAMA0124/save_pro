'use strict';
const fs = require('fs');
const path = require('path');

const express = require('express');
const cors = require('cors');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from the current directory
app.use(express.static(__dirname));

// ─── Memory Sync Vault (device migration, 6-digit code, 10 min TTL) ───────────
const syncVault = new Map();

// ─── Fugle API Helper ─────────────────────────────────────────────────────────
async function fetchFugleQuote(symbol, apiKey) {
  try {
    // Remove .TW/.TWO suffix for Fugle
    const fugleSymbol = symbol.replace(/\.(TW|TWO)$/i, '');
    const url = `https://api.fugle.tw/marketdata/v1.0/stock/intraday/quote/${fugleSymbol}`;
    const res = await fetch(url, {
      headers: { 'X-API-KEY': apiKey },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (e) {
    console.warn(`[Fugle] Failed for ${symbol}:`, e.message);
    return null;
  }
}

function normalizeFugleQuote(raw, symbol) {
  const price = raw.closePrice || raw.lastPrice || raw.referencePrice || 0;
  const prevClose = raw.previousClose || raw.referencePrice || price;
  const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
  return {
    source: 'fugle',
    symbol,
    shortName: raw.name || symbol,
    longName: raw.name || symbol,
    regularMarketPrice: price,
    regularMarketPreviousClose: prevClose,
    regularMarketChangePercent: changePct,
    regularMarketVolume: raw.totalVolume || 0,
    currency: 'TWD',
    exchangeName: raw.exchange || 'TWSE',
  };
}

// ─── GET /api/quote/:symbol ────────────────────────────────────────────────────
// Single quote with history (for asset detail)
app.get('/api/quote/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const apiKey = req.query.fugleKey || '';

    let quoteData = null;

    // Try Fugle for TW stocks
    if (apiKey && /\.(TW|TWO)$/i.test(symbol)) {
      const fugleRaw = await fetchFugleQuote(symbol, apiKey);
      if (fugleRaw) quoteData = normalizeFugleQuote(fugleRaw, symbol);
    }

    // Yahoo Finance fallback
    const [quoteResult, chartResult] = await Promise.allSettled([
      quoteData ? Promise.resolve(null) : yahooFinance.quote(symbol),
      Promise.race([
        yahooFinance.chart(symbol, {
          period1: Math.floor((Date.now() - 2 * 365 * 24 * 60 * 60 * 1000) / 1000),
          interval: '1d'
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Chart timeout')), 6000))
      ])
    ]);

    if (!quoteData) {
      if (quoteResult.status === 'rejected') throw new Error(`Quote failed: ${quoteResult.reason.message}`);
      const q = quoteResult.value;
      quoteData = {
        source: 'yahoo',
        symbol,
        shortName: q.shortName,
        longName: q.longName,
        regularMarketPrice: q.regularMarketPrice,
        regularMarketPreviousClose: q.regularMarketPreviousClose,
        regularMarketChangePercent: q.regularMarketChangePercent,
        regularMarketVolume: q.regularMarketVolume,
        fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: q.fiftyTwoWeekLow,
        currency: q.currency || 'TWD',
        exchangeName: q.fullExchangeName || q.exchange,
      };
    }

    let history = [];
    if (chartResult.status === 'fulfilled') {
      history = (chartResult.value?.quotes || [])
        .filter(q => q && q.close != null)
        .map(q => ({
          t: new Date(q.date).getTime(),
          c: q.adjClose || q.close,
        }));
    }

    res.json({ quote: quoteData, history });
  } catch (error) {
    console.error(`[quote] ${req.params.symbol}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/batch ────────────────────────────────────────────────────────────
// Batch quotes for portfolio refresh
app.get('/api/batch', async (req, res) => {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(',').filter(Boolean) : [];
    const apiKey = req.query.fugleKey || '';
    if (!symbols.length) return res.json([]);

    const results = await Promise.all(symbols.map(async (symbol) => {
      // Try Fugle for TW stocks
      if (apiKey && /\.(TW|TWO)$/i.test(symbol)) {
        const fugleRaw = await fetchFugleQuote(symbol, apiKey);
        if (fugleRaw) return normalizeFugleQuote(fugleRaw, symbol);
      }
      // Yahoo fallback
      try {
        const q = await yahooFinance.quote(symbol);
        return { source: 'yahoo', symbol, ...q };
      } catch (e) {
        return { symbol, error: e.message };
      }
    }));

    res.json(results);
  } catch (error) {
    console.error('[batch]', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/rates ────────────────────────────────────────────────────────────
// Live exchange rates (all → TWD)
app.get('/api/rates', async (req, res) => {
  try {
    const RATE_SYMBOLS = ['TWD=X', 'JPYTWD=X', 'EURTWD=X', 'CNYTWD=X', 'HKDTWD=X', 'AUDTWD=X', 'GBPTWD=X'];
    const results = await Promise.allSettled(RATE_SYMBOLS.map(s => yahooFinance.quote(s)));
    const safe = (r, fallback) =>
      (r.status === 'fulfilled' && r.value?.regularMarketPrice) ? r.value.regularMarketPrice : fallback;

    const usdTwd = safe(results[0], 32.0);
    res.json({
      success: true,
      rates: {
        USD: usdTwd,
        JPY: safe(results[1], usdTwd / 150),
        EUR: safe(results[2], usdTwd * 1.08),
        CNY: safe(results[3], usdTwd / 7.2),
        HKD: safe(results[4], usdTwd / 7.8),
        AUD: safe(results[5], usdTwd * 0.63),
        GBP: safe(results[6], usdTwd * 1.27),
      },
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error('[rates]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /api/sync/push ───────────────────────────────────────────────────────
// Push state to vault, return 6-digit code (10 min TTL)
app.post('/api/sync/push', (req, res) => {
  const state = req.body;
  if (!state || typeof state !== 'object') {
    return res.status(400).json({ error: 'Invalid state' });
  }

  // Cleanup expired entries
  for (const [k, v] of syncVault) {
    if (v.expires < Date.now()) syncVault.delete(k);
  }

  // Hard cap at 200 entries
  if (syncVault.size >= 200) {
    const oldest = syncVault.keys().next().value;
    syncVault.delete(oldest);
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  syncVault.set(code, {
    data: state,
    expires: Date.now() + 10 * 60 * 1000  // 10 minutes
  });

  console.log(`[sync] Push code=${code}`);
  res.json({ code, expiresIn: 600 });
});

// ─── GET /api/sync/pull/:code ──────────────────────────────────────────────────
// Pull state using 6-digit code (one-time use)
app.get('/api/sync/pull/:code', (req, res) => {
  const code = req.params.code;
  const item = syncVault.get(code);

  if (!item || item.expires < Date.now()) {
    syncVault.delete(code);
    return res.status(404).json({ error: '代碼無效或已過期' });
  }

  const data = item.data;
  syncVault.delete(code); // One-time use
  console.log(`[sync] Pull code=${code}`);
  res.json(data);
});

// ─── GET /api/health ──────────────────────────────────────────────────────────

// --- Metals Price API ---


// ==========================================
// GM 同步任務管理 (支援斷點續傳、進度條)
// ==========================================
let syncState = {
  isRunning: false,
  total: 0,
  current: 0,
  mode: 'top200', // or 'all'
  queue: []
};

// 取得當前進度
app.get('/api/gm/sync-status', (req, res) => {
  res.json(syncState);
});

// 重置進度
app.post('/api/gm/sync-reset', (req, res) => {
  syncState = { isRunning: false, total: 0, current: 0, mode: 'top200', queue: [] };
  res.json({ success: true, message: '進度已重置' });
});

// 開始/繼續 同步
app.post('/api/gm/sync-start', (req, res) => {
  if (syncState.isRunning) {
    return res.json({ success: false, message: '同步已經在進行中' });
  }
  
  const { mode } = req.body || {}; // 'top200' 或 'all'
  
  // 若沒有佇列，表示是全新開始
  if (syncState.queue.length === 0) {
    syncState.mode = mode || 'top200';
    syncState.total = syncState.mode === 'all' ? 3200 : 200; // 模擬：全市場 3200 檔，精選 200 檔
    syncState.current = 0;
    for (let i = 0; i < syncState.total; i++) {
      syncState.queue.push(`ETF_${i}`); // 模擬產生佇列
    }
  }

  syncState.isRunning = true;
  _processSyncQueue();
  
  res.json({ success: true, message: '開始同步' });
});

// 模擬背景處理佇列
function _processSyncQueue() {
  if (!syncState.isRunning || syncState.queue.length === 0) {
    syncState.isRunning = false;
    return;
  }
  
  // 模擬處理一筆需要 100ms
  setTimeout(() => {
    syncState.queue.shift(); // 拿出一筆處理完畢
    syncState.current++;
    
    // 假設在這裡遇到了 FMP API 額度耗盡 (例如抓了 250 筆)
    // 這裡我們模擬：如果一次抓超過 50 筆，就假裝額度用完，自動暫停
    if (syncState.current > 0 && syncState.current % 50 === 0 && syncState.mode === 'all') {
      console.log("[GM] API 額度用盡，自動暫停任務。等待明天繼續。");
      syncState.isRunning = false;
      return;
    }

    _processSyncQueue(); // 繼續下一筆
  }, 100);
}


// ==========================================
// FMP 選股 API (帶快取 24 小時，節省免費額度)
// ==========================================
let _fmpConfig = {};
try {
  _fmpConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch(e) {}

const FMP_CACHE_DIR = path.join(__dirname, 'data', 'fmp_cache');
if (!fs.existsSync(FMP_CACHE_DIR)) fs.mkdirSync(FMP_CACHE_DIR, { recursive: true });

function _fmpCacheKey(params) {
  return require('crypto').createHash('md5').update(JSON.stringify(params)).digest('hex');
}

function _readFmpCache(key) {
  const file = path.join(FMP_CACHE_DIR, key + '.json');
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const age = Date.now() - data.ts;
  if (age > 24 * 60 * 60 * 1000) return null; // 超過 24 小時失效
  return data.result;
}

function _writeFmpCache(key, result) {
  const file = path.join(FMP_CACHE_DIR, key + '.json');
  fs.writeFileSync(file, JSON.stringify({ ts: Date.now(), result }), 'utf8');
}

// GET /api/fmp/screen — 出海選股篩選

// ==========================================
// Yahoo Finance Search (替代 FMP Screener)
// ==========================================
app.get('/api/yf/search', async (req, res) => {
  const query = req.query.q || '';
  if (!query) return res.json({ success: false, error: 'Empty query' });
  try {
    const result = await yahooFinance.search(query);
    res.json({ success: true, data: result.quotes });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/fmp/screen', async (req, res) => {
  const apiKey = req.query.apikey || _fmpConfig.FMP_API_KEY;
  if (!apiKey) return res.status(400).json({ success: false, error: '尚未設定 FMP API Key' });

  const params = {
    country: req.query.country || 'US',
    sector:  req.query.sector  || '',
    marketCapMoreThan:  req.query.marketCapMin || '',
    dividendMoreThan:   req.query.dividendMin  || '',
    priceMoreThan:      req.query.priceMin     || '',
    priceLessThan:      req.query.priceMax     || '',
    limit: 30,
  };

  // 移除空值
  Object.keys(params).forEach(k => { if (!params[k] && params[k] !== 0) delete params[k]; });

  const cacheKey = _fmpCacheKey(params);
  const cached = _readFmpCache(cacheKey);
  if (cached) {
    console.log('[FMP] Cache hit, 0 API calls used.');
    return res.json({ success: true, fromCache: true, data: cached });
  }

  // 真實 API 呼叫
  try {
    const qs = new URLSearchParams({ ...params, apikey: apiKey }).toString();
    const url = `https://financialmodelingprep.com/api/v3/stock-screener?${qs}`;
    console.log('[FMP] Calling API:', url.replace(apiKey, '***'));

    // Node 18+ built-in fetch
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const json = await resp.json();

    if (!Array.isArray(json)) {
      return res.status(500).json({ success: false, error: json?.['Error Message'] || '呼叫失敗' });
    }

    _writeFmpCache(cacheKey, json);
    res.json({ success: true, fromCache: false, data: json });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/etf/:symbol/holdings', async (req, res) => {
  const sym = req.params.symbol.toUpperCase();
  const seed = sym.charCodeAt(0) + (sym.charCodeAt(1) || 0) + (sym.charCodeAt(2) || 0);
  const holdings = [];
  const baseStocks = [
    {id:'2330',n:'台積電'}, {id:'2317',n:'鴻海'}, {id:'2454',n:'聯發科'}, {id:'2382',n:'廣達'},
    {id:'2308',n:'台達電'}, {id:'2881',n:'富邦金'}, {id:'2882',n:'國泰金'}, {id:'2891',n:'中信金'},
    {id:'3231',n:'緯創'}, {id:'2357',n:'華碩'}, {id:'2603',n:'長榮'}, {id:'2303',n:'聯電'},
    {id:'AAPL',n:'Apple'}, {id:'MSFT',n:'Microsoft'}, {id:'NVDA',n:'Nvidia'}, {id:'TSLA',n:'Tesla'}
  ];
  let totalW = 100;
  for (let i = 0; i < 30; i++) {
    const stock = baseStocks[(seed + i) % baseStocks.length];
    const w = parseFloat((totalW * 0.12).toFixed(2));
    totalW -= w;
    holdings.push({ id: stock.id, name: stock.n, weight: w });
  }
  res.json({ success: true, symbol: sym, name: sym + ' ETF', holdings });
});

app.get('/api/metals', async (req, res) => {
  try {
    const SYMBOLS = ['GC=F', 'SI=F', 'PL=F', 'TWD=X'];
    const results = await Promise.allSettled(SYMBOLS.map(s => yahooFinance.quote(s)));
    
    const safeData = (r, fallback) => {
        if (r.status === 'fulfilled' && r.value) {
            return { price: r.value.regularMarketPrice || fallback, changePercent: r.value.regularMarketChangePercent || 0 };
        }
        return { price: fallback, changePercent: 0 };
    };

    const goldData     = safeData(results[0], 2300);
    const silverData   = safeData(results[1], 30);
    const platinumData = safeData(results[2], 1000);
    const twdRate      = safeData(results[3], 32.5).price;

    const RETAIL_MARKUP = { gold: 1.015, silver: 1.05, platinum: 1.05 };
    const OZ_TO_G = 31.1035;
    const G_TO_QIAN = 1 / 3.75;
    const G_TO_TAEL = 1 / 37.5;

    function buildMetal(data, markup) {
        const usdPerOz = data.price;
        const twdPerOz   = usdPerOz * twdRate * markup;
        const twdPerGram = twdPerOz / OZ_TO_G;
        return {
            usdPerOz:   Math.round(usdPerOz * 100) / 100,
            changePercent: data.changePercent,
            twdPerOz:   Math.round(twdPerOz),
            twdPerGram: Math.round(twdPerGram),
            twdPerQian: Math.round(twdPerGram / G_TO_QIAN),
            twdPerTael: Math.round(twdPerGram / G_TO_TAEL),
        };
    }

    res.json({
        success: true,
        twdRate,
        gold: buildMetal(goldData, RETAIL_MARKUP.gold),
        silver: buildMetal(silverData, RETAIL_MARKUP.silver),
        platinum: buildMetal(platinumData, RETAIL_MARKUP.platinum)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ 記帳PRO Server running on http://localhost:${PORT}`);
  console.log(`   Stock quotes: Yahoo Finance (+ Fugle fallback for TW stocks)`);
  console.log(`   Sync Vault: in-memory, 10-min TTL, 6-digit code`);
});
