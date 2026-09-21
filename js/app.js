/* ================================================
   app.js - 主入口：路由、頁面切換、初始化
   記帳PRO
   ================================================ */

'use strict';

window.PRO = window.PRO || {}; var PRO = window.PRO;

/* ══════════════════════════════════════════════════
   路由 & 頁面切換
══════════════════════════════════════════════════ */
const PAGE_CONFIG = {
  explore:     { title: '探索',   initFn: () => PRO.explore?.init() },
  assets:      { title: '資產',   initFn: () => PRO.assets?.init() },
  dashboard:   { title: '儀表板', initFn: () => PRO.dashboard?.init() },
  liabilities: { title: '負債',   initFn: () => PRO.liabilities?.init() },
  settings:    { title: '設定',   initFn: () => PRO.settings?.init() },
};

let _currentPage = 'explore';

PRO.navigate = function(page) {
  if (!PAGE_CONFIG[page] || page === _currentPage) return;
  _currentPage = page;

  // 切換頁面可見性
  document.querySelectorAll('.page-container').forEach(el => {
    el.classList.toggle('active', el.id === `page-${page}`);
  });

  // 切換導航列 active
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // 更新標題列
  document.getElementById('page-title').textContent = PAGE_CONFIG[page].title;
  document.getElementById('page-actions').innerHTML = PAGE_CONFIG[page].actions || '';

  // 初始化頁面（首次或需要刷新時）
  PAGE_CONFIG[page].initFn?.();

  // 捲回頂部
  window.scrollTo({ top: 0, behavior: 'instant' });
};

/* ══════════════════════════════════════════════════
   Toast 通知系統
══════════════════════════════════════════════════ */
PRO.toast = function(msg, type = 'info', duration = 3000) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-msg">${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-4px)';
    el.style.transition = 'opacity 0.3s, transform 0.3s';
    setTimeout(() => el.remove(), 300);
  }, duration);
};

/* ══════════════════════════════════════════════════
   Bottom Sheet 系統
══════════════════════════════════════════════════ */
PRO.sheet = {
  open(htmlContent, onClose) {
    const overlay = document.getElementById('sheet-overlay');
    const body = document.getElementById('sheet-body');
    body.innerHTML = htmlContent;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    this._onClose = onClose;
  },
  close() {
    const overlay = document.getElementById('sheet-overlay');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    this._onClose?.();
    this._onClose = null;
  },
};

/* ══════════════════════════════════════════════════
   數字格式化工具
══════════════════════════════════════════════════ */
PRO.fmt = {
  /** 千分位格式 */
  num(n, decimals = 'auto') {
    if (n == null || isNaN(n)) return '--';
    if (decimals === 'auto') {
      return Number(n).toLocaleString('zh-TW', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 8
      });
    }
    return Number(n).toLocaleString('zh-TW', {
      minimumFractionDigits: (decimals > 0 && n % 1 !== 0) ? decimals : 0, 
      maximumFractionDigits: decimals > 0 ? decimals : 0,
    });
  },
  /** 貨幣格式 */
  money(n, currency = 'TWD', compact = false, decimals = 2) {
    if (n == null || isNaN(n)) return '--';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    const prefix = currency === 'TWD' ? 'NT$' : '$';
    if (compact && abs >= 1e8) return `${sign}${prefix}${(abs/1e8).toFixed(1)}億`;
    if (compact && abs >= 1e4) return `${sign}${prefix}${(abs/1e4).toFixed(1)}萬`;
    return `${sign}${prefix}${this.num(abs)}`;
  },
  /** 百分比格式（含正負號） */
  pct(n, decimals = 2) {
    if (n == null || isNaN(n)) return '--';
    const sign = n > 0 ? '+' : '';
    return `${sign}${Number(n).toFixed(decimals)}%`;
  },
  /** 槓桿倍數 */
  leverage(total, net) {
    if (!net || net <= 0) return '--';
    return `${(total / net).toFixed(2)}x`;
  },
  /** 隱藏金額（設定開啟時） */
  hide(str) {
    const state = PRO.state.get();
    return state.settings.hideAmounts ? '●●●●' : str;
  },
};

/* ══════════════════════════════════════════════════
   頁面滾動效果（標題列毛玻璃）
══════════════════════════════════════════════════ */
function initScrollEffect() {
  const header = document.getElementById('page-header');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
}

/* ══════════════════════════════════════════════════
   導航列事件綁定
══════════════════════════════════════════════════ */
function initNav() {
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => PRO.navigate(btn.dataset.page));
  });
}

/* ══════════════════════════════════════════════════
   Sheet 點擊背景關閉
══════════════════════════════════════════════════ */
function initSheet() {
  const overlay = document.getElementById('sheet-overlay');
  overlay.addEventListener('click', e => {
    if (e.target === overlay) PRO.sheet.close();
  });
}

/* ══════════════════════════════════════════════════
   每日自動快照（頁面首次載入時觸發）
══════════════════════════════════════════════════ */
async function tryAutoSnapshot() {
  const state = PRO.state.get();
  const snaps = state.netWorthSnapshots || [];
  const today = new Date().toISOString().slice(0, 10);
  if (snaps.length && snaps[snaps.length-1].date === today) return; // 今天已快照

  // 需要有資產或負債才快照
  if (!state.assets.length && !state.liabilities.length) return;

  try {
    let rates = { USD: 32, JPY: 0.21, EUR: 34 };
    try { rates = await PRO.api.getRates(); } catch {}

    const totalAssets = PRO.state.calcTotalAssets(state.assets, rates);
    const totalLiabilities = PRO.state.calcTotalLiabilities(state.liabilities, rates);
    const netWorth = totalAssets - totalLiabilities;
    const leverage = totalAssets > 0 && netWorth > 0 ? totalAssets / netWorth : 1;

    PRO.state.takeSnapshot({ netWorth, totalAssets, totalLiabilities, leverage });
    console.log('[app] Daily snapshot saved:', today, 'NW:', netWorth);
  } catch (e) {
    console.warn('[app] Snapshot failed:', e);
  }
}

/* ══════════════════════════════════════════════════
   App 初始化
══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initSheet();
  initScrollEffect();

  // 初始化探索頁（預設頁面）
  PRO.explore?.init();

  // 非同步自動快照
  tryAutoSnapshot();

  // 伺服器狀態檢查（靜默，不打擾用戶）
  PRO.api.checkHealth().then(ok => {
    if (!ok) console.warn('[app] Server not reachable. Quotes will be unavailable.');
  });

  console.log('%c記帳PRO 已啟動 ✅', 'color:#34c759;font-size:14px;font-weight:700;');
});