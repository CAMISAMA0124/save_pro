/* ================================================
   settings.js - 設定頁
   記帳PRO - 外幣、隱私、通知、API Key、同步、GM 開發者
   ================================================ */

'use strict';
window.PRO = window.PRO || {};
var PRO = window.PRO;

PRO.settings = (() => {
  let _syncTimer = null;

  function init() {
    _render();
  }

  function _render() {
    const container = document.getElementById('settings-content');
    if (!container) return;

    const state = PRO.state.get();
    const s = state.settings || {};
    const snapCount = (state.netWorthSnapshots || []).length;
    const assetCount = (state.assets || []).length;
    const liabCount  = (state.liabilities || []).length;

    container.innerHTML = `
<div class="fade-in" style="padding-bottom:32px;">

  <!-- 帳本摘要 -->
  <div class="card" style="margin-bottom:16px; padding:20px; background: linear-gradient(135deg, rgba(52,199,89,0.15), rgba(10,132,255,0.08));">
    <div style="display:flex; align-items:center; gap:14px; margin-bottom:16px;">
      <div style="width:52px; height:52px; border-radius:16px; background:var(--brand); display:flex; align-items:center; justify-content:center; font-size:26px; flex-shrink:0;">📒</div>
      <div>
        <div style="font-size:18px; font-weight:700;">記帳PRO</div>
        <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">個人財富管理 與 記錄</div>
      </div>
    </div>
    <div style="display:grid; grid-template-columns:repeat(3,1fr); text-align:center; border-top:1px solid var(--border); padding-top:14px; gap:8px;">
      <div><div style="font-size:22px; font-weight:700; color:var(--brand);">${assetCount}</div><div style="font-size:11px; color:var(--text-secondary);">資產筆</div></div>
      <div><div style="font-size:22px; font-weight:700; color:var(--accent-red);">${liabCount}</div><div style="font-size:11px; color:var(--text-secondary);">負債筆</div></div>
      <div><div style="font-size:22px; font-weight:700; color:var(--accent);">${snapCount}</div><div style="font-size:11px; color:var(--text-secondary);">歷史紀錄</div></div>
    </div>
  </div>

  <!-- 外幣與隱私 -->
  <div class="settings-section-title">外幣與隱私</div>
  <div class="card" style="margin-bottom:16px;">
    <div style="display:flex;align-items:center;padding:12px 0;gap:12px;">
      <div style="flex:1;"><div style="font-size:15px;font-weight:500;">隱藏金額</div><div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">在首頁以 ●●●●● 代替</div></div>
      <label class="toggle-switch"><input type="checkbox" id="toggle-hide-amounts" \${s.hideAmounts ? 'checked' : ''}><span class="toggle-track"></span></label>
    </div>
    <div class="settings-divider"></div>
    <div style="display:flex;align-items:center;padding:12px 0;gap:12px;">
      <div style="flex:1;"><div style="font-size:15px;font-weight:500;">還款提醒</div><div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">提醒還款日</div></div>
      <label class="toggle-switch"><input type="checkbox" id="toggle-notify-repay" \${s.notifyRepayment ? 'checked' : ''}><span class="toggle-track"></span></label>
    </div>
    <div class="settings-divider"></div>
    <div style="display:flex;align-items:center;padding:12px 0;gap:12px;">
      <div style="flex:1;"><div style="font-size:15px;font-weight:500;">股息預設台幣</div><div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">配息試算預設以台幣儲存</div></div>
      <label class="toggle-switch"><input type="checkbox" id="toggle-dividend-twd" \${s.dividendDefaultTWD ? 'checked' : ''}><span class="toggle-track"></span></label>
    </div>
  </div>

  <!-- API 設定 -->
  <div class="settings-section-title">報價來源</div>
  <div class="card" style="margin-bottom:16px;">
    <div style="padding:14px 0 6px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="font-size:13px;font-weight:600;">Fugle API Key <span style="font-size:10px;color:var(--text-tertiary);font-weight:400;">(選填)</span></div>
          <a href="https://developer.fugle.tw/" target="_blank" style="font-size:11px;color:var(--accent);text-decoration:none;font-weight:600;"></span></a>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;">富果提供台股即時報價 API。留空則自動使用 Yahoo Finance 免費數據。</div>
      <div style="display:none;">
        <input type="password" id="input-fugle-key" class="form-input" style="flex:1;" placeholder="Bearer xxxxxxxx-xxxx-xxxx..." value="\${s.fugleApiKey || ''}">
        <button class="btn btn-secondary" id="btn-save-fugle" style="white-space:nowrap;flex-shrink:0;">儲存</button>
      </div>
    </div>
  </div>

  <!-- 裝置同步 -->
  <div class="settings-section-title">裝置同步</div>
  <div class="card" style="margin-bottom:16px;">
    <div style="padding:4px 0;">
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;line-height:1.6;">透過以下產生的代碼，將資料傳送至另一個裝置（代碼 10 分鐘內有效）。</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <button class="btn btn-secondary" id="btn-sync-push" style="width:100%;">📤 產生同步碼</button>
        <button class="btn btn-secondary" id="btn-sync-pull" style="width:100%;">📥 輸入同步碼</button>
      </div>
      <div id="sync-result" style="margin-top:12px;display:none;"></div>
    </div>
  </div>

  <!-- 資料管理 -->
  <div class="settings-section-title">資料管理</div>
  <div class="card" style="margin-bottom:16px;">
    <div style="display:flex;align-items:center;padding:12px 0;gap:12px;">
      <div style="flex:1;"><div style="font-size:15px;font-weight:500;">匯出資料</div><div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">下載 JSON 備份檔</div></div>
      <button class="btn btn-secondary" id="btn-export" style="flex-shrink:0;color:var(--accent);border-color:var(--accent);">📤 匯出</button>
    </div>
    <div class="settings-divider"></div>
    <div style="padding:14px 0 4px;">
      <div style="font-size:13px;font-weight:600;margin-bottom:6px;">匯入資料</div>
      <label class="btn btn-secondary" style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;">
        📁 選擇 JSON 備份檔
        <input type="file" id="input-import" accept=".json" style="display:none;">
      </label>
    </div>
  </div>

  <!-- 清除危險 -->
  <div class="settings-section-title" style="color:var(--accent-red);">危險操作</div>
  <div class="card" style="margin-bottom:16px;border-color:rgba(255,59,48,0.2);">
    <div style="display:flex;align-items:center;padding:12px 0;gap:12px;">
      <div style="flex:1;"><div style="font-size:15px;font-weight:500;">清除所有</div><div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">無法回復，請先備份資料</div></div>
      <button class="btn btn-secondary" id="btn-reset" style="flex-shrink:0;color:var(--accent-red);border-color:var(--accent-red);">⚠️ 清除</button>
    </div>
  </div>

  <!-- GM 開發者專區 -->
  <div class="settings-section-title">開發者模式</div>
  <div class="card" style="margin-bottom:16px;">
    <div id="gm-locked-view" style="display:flex;align-items:center;padding:12px 0;gap:12px;">
      <div style="flex:1;">
        <div style="font-size:15px;font-weight:500;">🔒 GM 開發者模式</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">進階 API 串接與 ETF 資料管理</div>
      </div>
      <button class="btn btn-secondary" id="btn-unlock-gm" style="flex-shrink:0;">解鎖</button>
    </div>

    <div id="gm-unlocked-view" style="display:none;padding:12px 0 4px;">
      <div style="font-weight:700;font-size:15px;color:var(--brand);margin-bottom:16px;">🛠 GM 開發者模式已啟用</div>

      <div style="background:rgba(255,255,255,0.05);padding:14px;border-radius:10px;margin-bottom:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="font-size:13px;font-weight:600;">ETF 快速同步 (免設定) <span style="display:none;"></div>
          <a href="https://financialmodelingprep.com/developer/docs" target="_blank" style="font-size:11px;color:var(--accent);text-decoration:none;font-weight:600;"></span></a>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-bottom:10px;line-height:1.5;">每日 250 次免費呼叫，支援所有美股/全球主流 ETF 完整成分股查詢。</div>
        <div style="display:none;">
          <input type="password" id="input-fmp-key" class="form-input" style="flex:1;" placeholder="輸入 FMP API Key..." value="\${s.fmpApiKey || ''}">
          <button class="btn btn-secondary" id="btn-save-fmp" style="white-space:nowrap;flex-shrink:0;">儲存</button>
        </div>
      </div>

      <div style="background:rgba(255,255,255,0.05);padding:14px;border-radius:10px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:6px;"><span style="display:none;"></span></div>
        <div style="font-size:11px;color:var(--text-secondary);margin-bottom:14px;line-height:1.6;">
          <b>⚡ 快速更新</b>：台/美股前 200 大熱門 ETF，約 10 分鐘完成。<br>
          <b>🌏 深度更新</b>：全市場所有 ETF，<b>自動儲存進度</b>、分多天慢慢跑，明天繼續執行會從斷點接續，無需重來。
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
          <button class="btn btn-secondary" id="btn-gm-sync-top200" style="flex-direction:column;line-height:1.4;">
            ⚡ 快速更新<br><span style="font-size:10px;font-weight:400;opacity:0.7;">前 200 熱門 ETF</span>
          </button>
          <button class="btn btn-primary" id="btn-gm-sync-all" style="flex-direction:column;line-height:1.4;">
            🌏 深度更新<br><span style="font-size:10px;font-weight:400;opacity:0.8;">全市場分批執行</span>
          </button>
        </div>

        <div style="background:rgba(0,0,0,0.25);border-radius:8px;padding:12px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span id="sync-status-text" style="font-size:11px;color:var(--text-secondary);">📌 閒置中</span>
            <span id="sync-progress-text" style="font-size:11px;font-weight:700;color:var(--text-primary);">0 / 0 (0%)</span>
          </div>
          <div style="width:100%;height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">
            <div id="sync-progress-bar" style="width:0%;height:100%;background:linear-gradient(to right,var(--brand),var(--accent));transition:width 0.5s ease;border-radius:4px;"></div>
          </div>
        </div>

        <div style="text-align:right;">
          <button id="btn-gm-sync-reset" style="background:none;border:none;color:var(--accent-red);font-size:12px;padding:4px 0;cursor:pointer;">🔄 重置進度</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 版本 -->
  <div style="text-align:center;padding:16px;color:var(--text-tertiary);font-size:12px;line-height:1.8;">
    記帳PRO v1.0<br>資料儲存於 LocalStorage<br>上傳至伺服器僅同步傳輸
  </div>

</div>`;

    _bindEvents();
  }

  function _bindEvents() {
    document.getElementById('toggle-hide-amounts')?.addEventListener('change', function () {
      PRO.state.patch({ settings: { hideAmounts: this.checked } });
      PRO.toast(this.checked ? '金額已隱藏' : '金額已顯示', 'success');
    });
    document.getElementById('toggle-notify-repay')?.addEventListener('change', function () {
      PRO.state.patch({ settings: { notifyRepayment: this.checked } });
    });
    document.getElementById('toggle-dividend-twd')?.addEventListener('change', function () {
      PRO.state.patch({ settings: { dividendDefaultTWD: this.checked } });
    });
    document.getElementById('btn-save-fugle')?.addEventListener('click', () => {
      const key = document.getElementById('input-fugle-key')?.value?.trim() || '';
      PRO.state.patch({ settings: { fugleApiKey: key } });
      PRO.toast('API Key 已儲存', 'success');
    });
    document.getElementById('btn-export')?.addEventListener('click', () => {
      PRO.state.exportBackup();
      PRO.toast('資料檔案下載中', 'success');
    });
    document.getElementById('input-import')?.addEventListener('change', function () {
      const file = this.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = PRO.state.importBackup(e.target.result);
        if (result.success) {
          PRO.toast('✅ 資料已匯入！', 'success');
          setTimeout(() => { _render(); PRO.explore?.init(); }, 500);
        } else {
          PRO.toast('⚠️ 匯入失敗：' + result.error, 'error');
        }
      };
      reader.readAsText(file);
    });
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      PRO.sheet.open(`
        <div class="sheet-title" style="color:var(--accent-red);">⚠️ 確認清除所有</div>
        <p style="font-size:14px;color:var(--text-secondary);text-align:center;margin-bottom:20px;line-height:1.6;">此操作無法回復！<br>所有資產、負債、歷史記錄將被刪除。<br><strong style="color:var(--text-primary);">建議先匯出資料。</strong></p>
        <button class="btn" style="width:100%;background:var(--accent-red);color:#fff;padding:14px;border-radius:12px;font-size:16px;font-weight:700;margin-bottom:10px;" id="confirm-reset-btn">確認清除</button>
        <button class="btn btn-secondary" style="width:100%;padding:14px;" onclick="PRO.sheet.close()">取消</button>
      `);
      setTimeout(() => {
        document.getElementById('confirm-reset-btn')?.addEventListener('click', () => {
          PRO.state.reset();
          PRO.sheet.close();
          PRO.toast('資料已清除', 'info');
          setTimeout(() => _render(), 300);
        });
      }, 100);
    });
    document.getElementById('btn-sync-push')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-sync-push');
      const resultEl = document.getElementById('sync-result');
      btn.disabled = true; btn.textContent = '⏳ 上傳中...';
      try {
        const res = await PRO.api.syncPush(PRO.state.get());
        resultEl.style.display = 'block';
        resultEl.innerHTML = `<div style="background:rgba(52,199,89,0.1);border:1px solid var(--brand);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;">同步碼（\${Math.ceil(res.expiresIn/60)} 分鐘內有效）</div><div style="font-size:36px;font-weight:800;letter-spacing:8px;color:var(--brand);">\${res.code}</div><div style="font-size:11px;color:var(--text-tertiary);margin-top:6px;">在另一台裝置點「輸入同步碼」</div></div>`;
      } catch (e) {
        PRO.toast('同步失敗，請確認伺服器正在執行', 'error');
      } finally {
        btn.disabled = false; btn.textContent = '📤 產生同步碼';
      }
    });
    document.getElementById('btn-sync-pull')?.addEventListener('click', () => {
      PRO.sheet.open(`
        <div class="sheet-title">📥 輸入同步碼</div>
        <p style="font-size:13px;color:var(--text-secondary);text-align:center;margin-bottom:20px;">在另一台裝置上產生的 6 位同步碼</p>
        <input type="text" id="pull-code-input" class="form-input" maxlength="6" inputmode="numeric" placeholder="000000" style="text-align:center;font-size:28px;font-weight:700;letter-spacing:8px;margin-bottom:16px;">
        <button class="btn btn-primary" id="pull-confirm-btn" style="width:100%;">🔄 同步資料</button>
      `);
      setTimeout(() => {
        document.getElementById('pull-confirm-btn')?.addEventListener('click', async () => {
          const code = document.getElementById('pull-code-input')?.value?.trim();
          if (code.length !== 6) { PRO.toast('請輸入 6 位代碼', 'error'); return; }
          try {
            const data = await PRO.api.syncPull(code);
            PRO.state.replace(data);
            PRO.sheet.close();
            PRO.toast('✅ 資料同步完成！', 'success');
            setTimeout(() => { _render(); PRO.explore?.init(); }, 300);
          } catch (e) {
            PRO.toast('同步碼錯誤或已過期', 'error');
          }
        });
      }, 100);
    });

    // ---- GM 開發者模式 ----
    document.getElementById('btn-unlock-gm')?.addEventListener('click', () => {
      const pwd = prompt('🔒 請輸入 GM 解鎖密碼：');
      if (pwd === '22345678') {
        document.getElementById('gm-locked-view').style.display = 'none';
        document.getElementById('gm-unlocked-view').style.display = 'block';
        PRO.toast('🛠 GM 模式已啟用', 'success');
        _pollSyncStatus();
        if (_syncTimer) clearInterval(_syncTimer);
        _syncTimer = setInterval(_pollSyncStatus, 2000);
      } else if (pwd !== null) {
        PRO.toast('密碼錯誤', 'error');
      }
    });
    document.getElementById('btn-gm-sync-top200')?.addEventListener('click', () => {
      _startSync('top200');
    });
    document.getElementById('btn-gm-sync-all')?.addEventListener('click', () => {
      _startSync('all');
    });
    document.getElementById('btn-gm-sync-reset')?.addEventListener('click', () => {
      if (!confirm('確定要重置所有同步進度嗎？下次執行將從頭開始。')) return;
      fetch('/api/gm/sync-reset', { method: 'POST' })
        .then(r => r.json())
        .then(res => {
          PRO.toast(res.message, 'info');
          _pollSyncStatus();
        });
    });
  }

  function _startSync(mode) {
    const key = (PRO.state.get().settings || {}).fmpApiKey;
    if (!key) return PRO.toast('請先在上方輸入並儲存 FMP API Key', 'error');
    fetch('/api/gm/sync-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, fmpKey: key })
    })
      .then(r => r.json())
      .then(res => {
        PRO.toast(res.message, res.success ? 'success' : 'warning');
        _pollSyncStatus();
      });
  }

  function _pollSyncStatus() {
    fetch('/api/gm/sync-status').then(r => r.json()).then(data => {
      const pct = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
      const progressText = document.getElementById('sync-progress-text');
      const progressBar  = document.getElementById('sync-progress-bar');
      const statusEl     = document.getElementById('sync-status-text');
      if (!progressText) return;

      progressText.textContent = `\${data.current} / \${data.total} (\${pct}%)`;
      progressBar.style.width  = `\${pct}%`;

      if (data.isRunning) {
        statusEl.textContent = '⚙️ 背景同步中...';
        statusEl.style.color  = 'var(--brand)';
      } else if (data.current > 0 && data.current < data.total) {
        statusEl.textContent = '⏸ 已暫停 (API 額度用盡)，明天繼續';
        statusEl.style.color  = 'var(--accent-yellow)';
      } else if (data.total > 0 && data.current >= data.total) {
        statusEl.textContent = '✅ 同步完成！';
        statusEl.style.color  = 'var(--brand)';
        if (_syncTimer) { clearInterval(_syncTimer); _syncTimer = null; }
      } else {
        statusEl.textContent = '📌 閒置中';
        statusEl.style.color  = 'var(--text-secondary)';
      }
    }).catch(() => {});
  }

  return { init };
})();

