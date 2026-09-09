'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

/* ─── navPage: right-to-left slide navigation ─── */
PRO.navPage = (() => {
  function push(html) {
    const page = document.getElementById('nav-page');
    if (!page) return;
    page.innerHTML = html;
    // The element is always in DOM, off-screen via translateX(100%)
    // Just adding the class triggers the CSS transition
    requestAnimationFrame(() => {
      page.classList.add('nav-open');
    });
  }

  function pop() {
    const page = document.getElementById('nav-page');
    if (!page) return;
    page.classList.remove('nav-open');
    // Clear content after transition so it doesn't intercept events
    setTimeout(() => {
      if (!page.classList.contains('nav-open')) {
        page.innerHTML = '';
      }
    }, 350);
  }

  return { push, pop };
})();

PRO.leverageExposure = (() => {

  function open() {
    const s = PRO.state.get();
    const strategy = s.leverageExposure || null;

    const html = `
<div style="min-height:100vh;padding:0 0 120px;background:var(--bg);">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:54px 16px 8px;">
    <button onclick="PRO.navPage.pop()" style="background:none;border:none;color:var(--accent);font-size:16px;font-weight:500;cursor:pointer;padding:4px 12px 4px 0;display:flex;align-items:center;gap:2px;">
      <span style="font-size:22px;line-height:1;">‹</span> 儀表板
    </button>
    <div style="font-size:17px;font-weight:700;">槓桿曝險</div>
    <div style="display:flex;gap:12px;font-size:20px;color:var(--text-secondary);">
      <span class="tappable" onclick="if(PRO.market) PRO.market.open()">🌐</span>
      <span class="tappable" onclick="if(PRO.performance) PRO.performance.open()">📊</span>
    </div>
  </div>
  <div style="padding:8px 16px;">
    ${_buildStrategyStatus(strategy)}
    ${_buildWhatIsThis()}
    ${_buildDisclaimer()}
  </div>
</div>`;

    PRO.navPage.push(html);
  }

  function _buildStrategyStatus(strategy) {
    if (!strategy || !strategy.enabled) {
      return `
<div class="card" style="margin-bottom:16px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span>ℹ️</span>
      <span style="font-weight:600;font-size:15px;">策略狀態</span>
    </div>
    <span style="font-size:13px;color:var(--text-tertiary);">尚未設定</span>
  </div>
  <div class="card tappable" style="background:rgba(255,255,255,0.03);display:flex;justify-content:space-between;align-items:center;padding:14px 16px;" onclick="PRO.leverageExposure._openSetup()">
    <div style="display:flex;align-items:center;gap:10px;">
      <span>⚙️</span>
      <span style="font-weight:600;">開始設定</span>
    </div>
    <span style="color:var(--text-tertiary);">›</span>
  </div>
</div>`;
    }

    const { targetBeta, tolerancePct } = strategy;
    const assets = PRO.state.get().assets || [];
    const currentBeta = _calcCurrentBeta(assets, strategy);
    const diff = currentBeta - targetBeta;
    const inBand = Math.abs(diff) <= (tolerancePct / 100) * targetBeta;
    const statusColor = inBand ? 'var(--brand)' : 'var(--accent-red)';
    const statusLabel = inBand ? '✅ 在容忍區間內' : '⚠️ 需要調整';
    const maxBeta = Math.max(targetBeta * 2, currentBeta * 1.2, 0.1);
    const targetPct = Math.min(99, Math.max(1, (targetBeta / maxBeta) * 100));
    const currentPct = Math.min(99, Math.max(1, (currentBeta / maxBeta) * 100));

    return `
<div class="card" style="margin-bottom:16px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span>ℹ️</span>
      <span style="font-weight:600;font-size:15px;">策略狀態</span>
    </div>
    <span style="font-size:13px;color:${statusColor};font-weight:600;">${statusLabel}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
    <div style="text-align:center;">
      <div style="font-size:10px;color:var(--text-tertiary);margin-bottom:4px;">目標 Beta</div>
      <div style="font-size:22px;font-weight:800;">${targetBeta.toFixed(1)}x</div>
    </div>
    <div style="text-align:center;">
      <div style="font-size:10px;color:var(--text-tertiary);margin-bottom:4px;">目前 Beta</div>
      <div style="font-size:22px;font-weight:800;color:${statusColor};">${currentBeta.toFixed(2)}x</div>
    </div>
    <div style="text-align:center;">
      <div style="font-size:10px;color:var(--text-tertiary);margin-bottom:4px;">容忍區間</div>
      <div style="font-size:22px;font-weight:800;">±${tolerancePct}%</div>
    </div>
  </div>
  <div style="position:relative;background:rgba(255,255,255,0.08);border-radius:6px;height:8px;margin-bottom:20px;">
    <div style="position:absolute;left:${currentPct}%;top:-4px;width:16px;height:16px;border-radius:50%;background:${statusColor};transform:translateX(-50%);box-shadow:0 0 6px ${statusColor};"></div>
    <div style="position:absolute;left:${targetPct}%;top:-2px;width:2px;height:12px;background:rgba(255,255,255,0.5);border-radius:1px;"></div>
  </div>
  <div class="card tappable" style="background:rgba(255,255,255,0.03);display:flex;justify-content:space-between;align-items:center;padding:14px 16px;" onclick="PRO.leverageExposure._openSetup()">
    <div style="display:flex;align-items:center;gap:10px;">
      <span>⚙️</span>
      <span style="font-weight:600;">調整策略設定</span>
    </div>
    <span style="color:var(--text-tertiary);">›</span>
  </div>
</div>`;
  }

  function _buildWhatIsThis() {
    return `
<div class="card" style="margin-bottom:16px;">
  <div style="font-size:17px;font-weight:800;margin-bottom:12px;">這是什麼</div>
  <div style="font-size:14px;color:var(--text-secondary);line-height:1.75;margin-bottom:12px;">
    設定一個目標 Beta（市場曝險倍數）與容忍區間，系統會持續計算你目前的曝險落在哪裡。
  </div>
  <div style="font-size:14px;color:var(--text-secondary);line-height:1.75;margin-bottom:12px;">
    槓桿 ETF 因為天天重設，倍數會自己維持；但用借款做的槓桿沒有人幫你重設——市場一跌，淨值縮水而負債不動，曝險倍數就會自己往上跑。這套工具就是為了看住這件事。
  </div>
  <div style="font-size:14px;color:var(--text-secondary);line-height:1.75;">
    第一步是選出哪些資產與負債要納入這套策略。不動產、保單這類幾乎不隨市場波動的資產如果一起算進來，會把曝險倍數稀釋到永遠達不到目標，所以預設不納入。
  </div>
</div>`;
  }

  function _buildDisclaimer() {
    return `
<div class="card" style="margin-bottom:16px;background:rgba(255,255,255,0.02);">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
    <span>📋</span>
    <span style="font-weight:600;font-size:14px;">關於這些數字</span>
  </div>
  <div style="font-size:12px;color:var(--text-tertiary);line-height:1.9;">
    本頁所有數值都是依你自己填入的策略池、敏感度、目標與容忍區間換算出來的計算結果，並非投資建議，也不構成任何市場或時點的推薦。
    <br><br>
    敏感度是你對「這檔跟著基準漲跌幾 %」的估計值，不是實際觀測到的統計量，實際走勢會有落差。
    <br><br>
    系統不會自動下單，也不會自行改動你的持倉——只有在你回填實際成交之後才會寫入交易紀錄。投資決策與結果由你自行負責。
  </div>
</div>`;
  }

  function _calcCurrentBeta(assets, strategy) {
    if (!strategy || !strategy.pool) return 0;
    const pool = strategy.pool;
    let weightedBeta = 0, totalValue = 0;
    assets.forEach(a => {
      if (!pool[a.id]) return;
      const val = parseFloat(a.price || a.costPrice || 0) * parseFloat(a.quantity || 1) || 0;
      const beta = parseFloat(pool[a.id].beta || 1);
      weightedBeta += val * beta;
      totalValue += val;
    });
    const liabilities = PRO.state.get().liabilities || [];
    let totalLiab = 0;
    liabilities.forEach(l => { totalLiab += parseFloat(l.remaining != null ? l.remaining : l.principal) || 0; });
    const netVal = totalValue - totalLiab;
    return netVal > 0 ? (weightedBeta + totalLiab) / netVal : 0;
  }

  function _openSetup() {
    const s = PRO.state.get();
    const strategy = s.leverageExposure || { targetBeta: 1.5, tolerancePct: 10, enabled: false, pool: {} };

    const html = `
<div style="min-height:100vh;padding:0 0 120px;background:var(--bg);">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:54px 16px 8px;">
    <button onclick="PRO.leverageExposure.open()" style="background:none;border:none;color:var(--accent);font-size:16px;font-weight:500;cursor:pointer;padding:4px 12px 4px 0;display:flex;align-items:center;gap:2px;">
      <span style="font-size:22px;line-height:1;">‹</span> 槓桿曝險
    </button>
    <div style="font-size:17px;font-weight:700;">策略設定</div>
    <div style="width:80px;"></div>
  </div>
  <div style="padding:8px 16px;">
    <div class="card" style="margin-bottom:16px;">
      <label style="font-size:13px;color:var(--text-secondary);display:block;margin-bottom:8px;">目標 Beta（市場曝險倍數）</label>
      <input id="le-target-beta" type="number" step="0.1" min="0.1" max="5" value="${strategy.targetBeta || 1.5}"
        style="width:100%;padding:14px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--text-primary);font-size:20px;font-weight:700;box-sizing:border-box;">
      <div style="font-size:12px;color:var(--text-tertiary);margin-top:8px;">例：1.0 = 和大盤同步　1.5 = 1.5 倍曝險　2.0 = 兩倍槓桿</div>
    </div>
    <div class="card" style="margin-bottom:24px;">
      <label style="font-size:13px;color:var(--text-secondary);display:block;margin-bottom:8px;">容忍區間（%）</label>
      <input id="le-tolerance" type="number" step="1" min="1" max="50" value="${strategy.tolerancePct || 10}"
        style="width:100%;padding:14px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--text-primary);font-size:20px;font-weight:700;box-sizing:border-box;">
      <div style="font-size:12px;color:var(--text-tertiary);margin-top:8px;">當目前 Beta 偏離目標超過此幅度時發出警告</div>
    </div>
    <button onclick="PRO.leverageExposure._saveSetup()" style="width:100%;padding:16px;border-radius:14px;background:var(--brand);color:#000;font-size:16px;font-weight:700;border:none;cursor:pointer;">
      儲存策略
    </button>
  </div>
</div>`;

    PRO.navPage.push(html);
  }

  function _saveSetup() {
    const targetBeta = parseFloat(document.getElementById('le-target-beta').value) || 1.5;
    const tolerancePct = parseFloat(document.getElementById('le-tolerance').value) || 10;
    PRO.state.patch({ leverageExposure: { targetBeta, tolerancePct, enabled: true, pool: {} } });
    PRO.toast('✅ 策略已儲存！');
    open();
  }

  return { open, _openSetup, _saveSetup };
})();