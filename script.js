// ============================================================
// DEBT SYNC - Client-Side SPA (Decoupled for GitHub Pages)
// ============================================================

// ⚠️ สำคัญมาก: นำ Web App URL ที่ได้จากการ Deploy GAS มาใส่ที่ตัวแปรนี้
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyFqY15gY1BBq1c_NizOgsXFM_tE4fIpG6bR2RD04dLAxj-GsU7JN4Wq8Md92SExDpj/exec'; 

var App = (function() {
  var state = {
    page: 'home', debtorId: null, debtor: null, debts: [], stats: {},
    payments: [], debtors: [], staff: null,
    debtPage: 1, debtPerPage: 8, payPage: 1, payPerPage: 6,
  };
  var pollingInterval = null;

  var extraStyles = '<style>' +
    '.bell-wrapper { position: relative; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%; background: var(--bg4); transition: 0.2s; }' +
    '.bell-wrapper:hover { background: var(--border2); }' +
    '.bell-badge { position: absolute; top: -4px; right: -4px; background: var(--red); color: white; font-size: 10px; font-weight: bold; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid var(--card); animation: pulseBadge 2s infinite; }' +
    '@keyframes pulseBadge { 0% { box-shadow: 0 0 0 0 rgba(255,94,122,0.7); } 70% { box-shadow: 0 0 0 6px rgba(255,94,122,0); } 100% { box-shadow: 0 0 0 0 rgba(255,94,122,0); } }' +
    '.search-box { width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-family: inherit; margin-bottom: 16px; outline: none; transition: 0.2s; }' +
    '.search-box:focus { border-color: var(--accent); }' +
  '</style>';
  document.head.insertAdjacentHTML('beforeend', extraStyles);

  function init() {
    loadDebtors().then(function() { renderPage('home'); });
  }

  function loadDebtors() {
    return callServer('getDebtors').then(function(data) { state.debtors = data || []; });
  }

  function renderPage(page, params) {
    state.page = page;
    var app = document.getElementById('app');
    if (params) Object.keys(params).forEach(function(k) { state[k] = params[k]; });
    
    if (page === 'home') { app.innerHTML = renderHome(); bindHome(); }
    else if (page === 'dashboard') { app.innerHTML = renderLayout('dashboard'); renderDashboard(); }
    else if (page === 'history') { app.innerHTML = renderLayout('history'); renderHistory(); }
    else if (page === 'staff') { app.innerHTML = renderStaff(); bindStaff(); }
  }

  function renderLayout(pg) {
    var titles = { dashboard: 'แดชบอร์ดลูกหนี้', history: 'ประวัติการชำระ' };
    return '<nav class="nav-bar">' +
      '<button class="nav-back" onclick="App.goHome()">&#8592;</button>' +
      '<span class="nav-title">' + (titles[pg] || pg) + '</span>' +
      '</nav><div class="page" id="page-content"></div>';
  }

  function renderHome() {
    var options = state.debtors.map(function(d) { return '<option value="' + esc(d.id) + '">' + esc(d.name) + '</option>'; }).join('');
    return '<div class="home-page">' +
      '<div class="home-hero">' +
        '<div class="home-logo">\u20BF</div><h1>การเงิน นพค.25</h1><p>ระบบบริหารจัดการหนี้</p>' +
      '</div>' +
      '<div class="home-card">' +
        '<h2>ตรวจสอบสถานะหนี้</h2><p>เลือกชื่อของคุณเพื่อดูรายการหนี้และแจ้งชำระเงิน</p>' +
        '<div class="select-wrap"><select id="debtor-select"><option value="">—— เลือกชื่อลูกหนี้ ——</option>' + options + '</select></div>' +
        '<button class="btn-primary" id="go-dashboard-btn" onclick="App.goDashboard()" disabled>ดูรายการหนี้ &rarr;</button>' +
        '<div class="home-staff-link" onclick="App.goStaff()">เข้าสู่ระบบพนักงาน <span>&rarr;</span></div>' +
      '</div></div>';
  }

  function bindHome() {
    var sel = document.getElementById('debtor-select');
    var btn = document.getElementById('go-dashboard-btn');
    if (sel && btn) sel.addEventListener('change', function() { btn.disabled = !sel.value; });
  }

  function goDashboard() {
    var sel = document.getElementById('debtor-select');
    if (!sel || !sel.value) return toast('กรุณาเลือกชื่อลูกหนี้', 'warning');
    state.debtorId = sel.value; state.debtor = null;
    for (var i = 0; i < state.debtors.length; i++) { if (state.debtors[i].id === sel.value) { state.debtor = state.debtors[i]; break; } }
    renderPage('dashboard');
  }

  function goHome() { state.debtorId = null; state.debtor = null; renderPage('home'); }
  function goStaff() { renderPage('staff'); }

  function renderDashboard() {
    showLoading('กำลังโหลดข้อมูล...');
    callServer('getDashboardStats', state.debtorId).then(function(data) {
      state.stats = data; state.debts = data.debts || []; state.debtPage = 1;
      var pc = document.getElementById('page-content');
      if (pc) { pc.innerHTML = buildDashboardHTML(data); bindDashboard(); }
    }).catch(function(e) { toast('โหลดไม่สำเร็จ: ' + e.message, 'error'); }).then(function() { hideLoading(); });
  }

  function buildDashboardHTML(data) {
    var d = state.debtor || {}; var initial = (d.name || '?').charAt(0).toUpperCase();
    var fmtNum = function(n) { return Number(n || 0).toLocaleString('th-TH'); };
    return '<div class="page-inner">' +
      '<div class="debtor-header stagger-item"><div class="debtor-avatar">' + initial + '</div>' +
      '<div class="debtor-info"><h2>' + esc(d.name || '-') + '</h2><p>' + esc(d.phone || '') + (d.email ? ' &bull; ' + esc(d.email) : '') + '</p></div>' +
      '<div class="debtor-header-actions"><button class="nav-btn primary" onclick="App.goHistory()">ประวัติ</button></div></div>' +
      '<div class="stats-grid stagger-item">' +
      '<div class="stat-card accent"><div class="stat-label">รายการทั้งหมด</div><div class="stat-value">' + data.total + '</div><div class="stat-sub">รายการหนี้</div></div>' +
      '<div class="stat-card red"><div class="stat-label">ค้างชำระ</div><div class="stat-value">' + data.pending + '</div><div class="stat-sub">รายการ</div></div>' +
      '<div class="stat-card orange"><div class="stat-label">รอตรวจสอบ</div><div class="stat-value">' + data.waiting + '</div><div class="stat-sub">รายการ</div></div>' +
      '<div class="stat-card green"><div class="stat-label">ยอดค้างรวม</div><div class="stat-value" style="font-size:18px">฿' + fmtNum(data.pendingAmount) + '</div><div class="stat-sub">บาท</div></div>' +
      '</div>' +
      '<div class="section stagger-item"><div class="section-header"><span class="section-title">รายการหนี้</span></div>' +
      '<div class="table-wrap"><div class="table-scroll"><table id="debt-table"><thead><tr>' +
      '<th>#</th><th>รายการหนี้</th><th>งวด</th><th>สถานะ</th><th>ดำเนินการ</th><th>หมายเหตุ</th>' +
      '</tr></thead><tbody id="debt-tbody"></tbody></table></div><div id="debt-pagination"></div></div></div></div>';
  }

  function bindDashboard() { renderDebtTable(); }

  function renderDebtTable() {
    var tbody = document.getElementById('debt-tbody'); var pgDiv = document.getElementById('debt-pagination');
    if (!tbody) return;
    var total = state.debts.length; var pages = Math.ceil(total / state.debtPerPage) || 1;
    state.debtPage = Math.min(state.debtPage, pages);
    var start = (state.debtPage - 1) * state.debtPerPage; var items = state.debts.slice(start, start + state.debtPerPage);

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="no-data"><div class="no-data-icon">&#128219;</div>ไม่มีรายการหนี้</div></td></tr>';
    } else {
      var statusCls = { 'ค้างชำระ': 'pending', 'รอตรวจสอบ': 'waiting', 'ชำระแล้ว': 'paid', 'ปฏิเสธ': 'red' };
      tbody.innerHTML = items.map(function(d, i) {
        var pct = d.totalInstallments > 0 ? Math.round((d.paidInstallments / d.totalInstallments) * 100) : 0;
        var displayStatus = d.status; var cls = statusCls[d.status] || 'pending';
        if (d.status === 'ค้างชำระ' && d.totalInstallments > 1 && d.paidInstallments > 0) { displayStatus = 'ชำระแล้ว ' + d.paidInstallments + ' งวด'; cls = 'accent'; }
        var rejectionHtml = d.rejectionNote ? '<div style="font-size:11px; color:#ff5e7a; background:rgba(255,94,122,0.1); padding:4px; border-radius:4px; margin-top:4px;">&#9888; ปฏิเสธ: ' + esc(d.rejectionNote) + '</div>' : '';
        var canPay = d.status === 'ค้างชำระ'; var amountToPay = Number(d.amountPerInstallment || 0);
        
        return '<tr class="stagger-item">' +
          '<td><span class="fs-12 color-text2 fw-6">' + (start + i + 1) + '</span></td>' +
          '<td><div class="fw-6" style="font-size:13px">' + esc(d.item) + '</div><div class="amount-display" style="font-size:12px">฿' + amountToPay.toLocaleString('th-TH') + '/งวด</div>' + rejectionHtml + '</td>' +
          '<td><div class="installment"><div class="installment-text"><strong>' + d.paidInstallments + '</strong>/' + d.totalInstallments + ' งวด</div><div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div></div></td>' +
          '<td><span class="status-badge ' + cls + '">' + esc(displayStatus) + '</span></td>' +
          '<td><div class="btn-actions">' + (canPay ? '<button class="btn btn-accent" onclick="App.openPayModal(\'' + esc(d.id) + '\',\'' + esc(d.item).replace(/'/g,"&#39;") + '\')">แจ้งชำระ</button>' : '') +
          '<button class="btn btn-ghost" onclick="App.openAccountModal(' + amountToPay + ')">บัญชีโอน</button></div></td>' +
          '<td class="color-text2 fs-12">' + esc(d.note || '-') + '</td></tr>';
      }).join('');
    }
    if (pgDiv) pgDiv.innerHTML = renderPagination(state.debtPage, pages, 'App.setDebtPage');
  }

  function setDebtPage(p) { state.debtPage = p; renderDebtTable(); var t = document.getElementById('debt-table'); if (t) t.scrollIntoView({ behavior: 'smooth' }); }
  function goHistory() { renderPage('history'); }

  function renderHistory() {
    showLoading('กำลังโหลดประวัติ...');
    callServer('getPaymentsByDebtor', state.debtorId).then(function(data) {
      state.payments = data || []; state.payPage = 1;
      var pc = document.getElementById('page-content');
      if (pc) {
        var name = state.debtor ? esc(state.debtor.name) : '';
        pc.innerHTML = '<div class="page-inner"><div class="section-header" style="margin-bottom:16px"><span style="font-size:20px;font-weight:700">' + name + '</span></div><div id="payment-list"></div><div id="pay-pagination"></div></div>';
        renderPaymentList();
      }
    }).catch(function(e) { toast('โหลดประวัติไม่สำเร็จ', 'error'); }).then(function() { hideLoading(); });
  }

  function renderPaymentList() {
    var list = document.getElementById('payment-list'); var pgDiv = document.getElementById('pay-pagination'); if (!list) return;
    var total = state.payments.length; var pages = Math.ceil(total / state.payPerPage) || 1;
    state.payPage = Math.min(state.payPage, pages);
    var start = (state.payPage - 1) * state.payPerPage; var items = state.payments.slice(start, start + state.payPerPage);
    var statusCls = { 'ค้างชำระ': 'pending', 'รอตรวจสอบ': 'waiting', 'ชำระแล้ว': 'paid', 'ปฏิเสธ': 'red' };

    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128203;</div><div class="empty-title">ยังไม่มีประวัติการชำระ</div><div class="empty-desc">ประวัติการแจ้งชำระจะแสดงที่นี่</div></div>';
    } else {
      list.innerHTML = items.map(function(p) {
        var cls = statusCls[p.status] || 'pending'; var opts = { day: '2-digit', month: 'short', year: 'numeric' };
        var dt = p.payDate ? new Date(p.payDate).toLocaleDateString('th-TH', opts) : '-';
        var notified = p.notifiedAt ? new Date(p.notifiedAt).toLocaleDateString('th-TH', opts) : '-';
        var slipBtn = p.fileId ? '<a href="https://drive.google.com/file/d/' + esc(p.fileId) + '/view" target="_blank" class="slip-btn">&#128238; ดูสลิปการโอน</a>' : '';
        var staffNoteHtml = p.staffNote ? '<div class="payment-meta-item" style="margin-top:6px; padding:6px; background:var(--bg3); border-left:3px solid ' + (p.status === 'ปฏิเสธ' ? 'var(--red)' : 'var(--accent)') + '"><span class="payment-meta-label">หมายเหตุพนักงาน</span><span class="payment-meta-value">' + esc(p.staffNote) + '</span></div>' : '';
        return '<div class="payment-card stagger-item"><div class="payment-card-header"><div><div class="payment-id">' + esc(p.id) + '</div><div class="payment-amount">฿' + Number(p.amount || 0).toLocaleString('th-TH') + '<small>บาท</small></div></div><span class="status-badge ' + cls + '">' + esc(p.status) + '</span></div><div class="payment-meta"><div class="payment-meta-item"><span class="payment-meta-label">วันที่ชำระ</span><span class="payment-meta-value">' + dt + '</span></div><div class="payment-meta-item"><span class="payment-meta-label">วันที่แจ้ง</span><span class="payment-meta-value">' + notified + '</span></div>' + staffNoteHtml + '</div>' + slipBtn + '</div>';
      }).join('');
    }
    if (pgDiv) pgDiv.innerHTML = renderPagination(state.payPage, pages, 'App.setPayPage');
  }

  function setPayPage(p) { state.payPage = p; renderPaymentList(); }

  function openPayModal(debtId, debtItem) {
    var today = new Date().toISOString().split('T')[0];
    var debtorName = state.debtor ? state.debtor.name : '';
    var html = '<div class="modal-overlay" onclick="App.closeModal(event)"><div class="modal"><div class="modal-header"><span class="modal-title">&#128179; แจ้งชำระเงิน</span><button class="modal-close" onclick="App.closeModalDirect()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">ลูกหนี้</label><div class="form-info"><strong>' + esc(debtorName) + '</strong></div></div><div class="form-group"><label class="form-label">รายการหนี้</label><div class="form-info"><strong>' + esc(debtItem) + '</strong></div></div><div class="form-group"><label class="form-label">วันที่ชำระ</label><input type="date" id="pay-date" class="form-input" value="' + today + '" max="' + today + '"></div><div class="form-group"><label class="form-label">จำนวนเงิน (บาท)</label><input type="number" id="pay-amount" class="form-input" placeholder="0.00" min="0" step="0.01"></div><div class="form-group"><label class="form-label">สลิปการโอน</label><div class="upload-area" id="upload-area" onclick="document.getElementById(\'slip-input\').click()"><div class="upload-icon">&#128206;</div><div class="upload-text">แตะเพื่ออัปโหลดรูปสลิป<br><strong>JPG, PNG ไม่เกิน 5MB</strong></div></div><div class="upload-preview" id="upload-preview" style="display:none"></div><input type="file" id="slip-input" accept="image/*" style="display:none" onchange="App.handleSlipUpload(this)"></div></div><div class="modal-footer"><button class="btn-secondary" onclick="App.closeModalDirect()">ยกเลิก</button><button class="btn-primary" onclick="App.submitPayment(\'' + esc(debtId) + '\')">&#128190; บันทึก</button></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);

    var ua = document.getElementById('upload-area');
    if (ua) {
      ua.addEventListener('dragover', function(e) { e.preventDefault(); ua.classList.add('drag-over'); });
      ua.addEventListener('dragleave', function() { ua.classList.remove('drag-over'); });
      ua.addEventListener('drop', function(e) { e.preventDefault(); ua.classList.remove('drag-over'); if (e.dataTransfer.files[0]) handleSlipFile(e.dataTransfer.files[0]); });
    }
  }

  function handleSlipUpload(input) { if (input.files[0]) handleSlipFile(input.files[0]); }
  function handleSlipFile(file) {
    if (file.size > 5 * 1024 * 1024) return toast('ไฟล์ใหญ่เกิน 5MB', 'warning');
    var reader = new FileReader();
    reader.onload = function(e) {
      var result = e.target.result;
      window._slipData = { base64: result.split(',')[1], mime: file.type, name: file.name };
      var prev = document.getElementById('upload-preview'); var area = document.getElementById('upload-area');
      if (prev) {
        prev.style.display = 'block';
        prev.innerHTML = '<img src="' + result + '" alt="slip" style="width:100%;max-height:180px;object-fit:cover;border-radius:8px"><button class="remove-btn" onclick="App.removeSlip()">ลบ</button>';
      }
      if (area) area.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  function removeSlip() {
    window._slipData = null;
    var prev = document.getElementById('upload-preview'); var area = document.getElementById('upload-area');
    if (prev) prev.style.display = 'none'; if (area) area.style.display = 'block';
    var inp = document.getElementById('slip-input'); if (inp) inp.value = '';
  }

  function submitPayment(debtId) {
    var payDate = document.getElementById('pay-date') ? document.getElementById('pay-date').value : '';
    var amountEl = document.getElementById('pay-amount'); var amount = amountEl ? amountEl.value : '';
    if (!payDate) return toast('กรุณาระบุวันที่ชำระ', 'warning');
    if (!amount || Number(amount) <= 0) return toast('กรุณาระบุจำนวนเงิน', 'warning');

    var payload = { debtId: debtId, debtorId: state.debtorId, payDate: payDate, amount: Number(amount), slipBase64: window._slipData ? window._slipData.base64 : null, slipMime: window._slipData ? window._slipData.mime : null, slipName: window._slipData ? window._slipData.name : null };
    closeModalDirect(); showLoading('กำลังบันทึก...');
    callServer('submitPayment', payload).then(function(res) {
      if (res.success) { toast('แจ้งชำระเงินสำเร็จ รอพนักงานตรวจสอบ', 'success'); window._slipData = null; renderDashboard(); }
      else { hideLoading(); toast(res.message || 'เกิดข้อผิดพลาด', 'error'); }
    }).catch(function(e) { hideLoading(); toast('เกิดข้อผิดพลาด: ' + e.message, 'error'); });
  }

  function openAccountModal(amount) {
    showLoading('กำลังโหลดบัญชี...');
    callServer('getAccounts').then(function(accounts) {
      hideLoading();
      if (!accounts || !accounts.length) return toast('ยังไม่มีบัญชีรับโอน', 'warning');
      var acCards = accounts.map(function(a) {
        var qrSection = '';
        if (a.qrCode) { qrSection = '<div class="qr-wrap" style="text-align:center;margin-top:10px"><img src="' + esc(a.qrCode) + '" alt="QR Code" style="width:160px;height:160px;border-radius:12px;border:4px solid white;background:white;"><br><span class="promptpay-badge" style="margin-top:6px;display:inline-block;">&#128241; พร้อมเพย์ ' + esc(a.promptpay) + '</span></div>'; }
        else if (a.promptpay) {
          var qrUrl = 'https://promptpay.io/' + esc(a.promptpay); if (amount && amount > 0) qrUrl += '/' + amount;
          qrSection = '<div class="qr-wrap" style="text-align:center;margin-top:10px"><img src="' + qrUrl + '" alt="PromptPay QR" style="width:160px;height:160px;border-radius:12px;border:4px solid white;background:white;" onerror="this.style.display=\'none\'"><br><span class="promptpay-badge" style="margin-top:6px;display:inline-block;">&#128241; พร้อมเพย์ ' + esc(a.promptpay) + '</span>' + (amount > 0 ? '<div style="margin-top:8px;font-size:14px;font-weight:bold;color:var(--accent)">สแกนจ่ายยอด: ฿' + Number(amount).toLocaleString('th-TH') + '</div>' : '') + '</div>';
        }
        return '<div class="account-card"><div class="account-bank">&#127974; ' + esc(a.bank) + '</div><div class="account-name">' + esc(a.accountName) + '</div><div class="account-number">' + esc(a.accountNumber) + '</div>' + qrSection + (a.note ? '<div style="margin-top:8px;font-size:12px;color:var(--text3);text-align:center;">' + esc(a.note) + '</div>' : '') + '</div>';
      }).join('');
      var html = '<div class="modal-overlay" onclick="App.closeModal(event)"><div class="modal"><div class="modal-header"><span class="modal-title">&#127974; บัญชีรับโอน</span><button class="modal-close" onclick="App.closeModalDirect()">&times;</button></div><div class="modal-body">' + acCards + '</div><div class="modal-footer"><button class="btn-primary" onclick="App.closeModalDirect()">ปิด</button></div></div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
    }).catch(function() { hideLoading(); });
  }

  function closeModal(e) { if (e.target === e.currentTarget) closeModalDirect(); }
  function closeModalDirect() { var overlay = document.querySelector('.modal-overlay'); if (overlay) overlay.remove(); }

  function renderStaff() {
    if (state.staff) return renderStaffPanel();
    return '<nav class="nav-bar"><button class="nav-back" onclick="App.goHome()">&#8592;</button><span class="nav-title">พนักงาน</span></nav><div class="staff-login" style="padding-top:var(--nav-h)"><div class="login-card"><div class="login-header"><div class="login-icon">&#128272;</div><h2>เข้าสู่ระบบพนักงาน</h2><p>สำหรับเจ้าหน้าที่ตรวจสอบการชำระเงิน</p></div><div class="form-group"><label class="form-label">ชื่อผู้ใช้</label><input type="text" id="staff-user" class="form-input" placeholder="username" autocomplete="username"></div><div class="form-group"><label class="form-label">รหัสผ่าน</label><input type="password" id="staff-pass" class="form-input" placeholder="••••••••" autocomplete="current-password"></div><button class="btn-primary" onclick="App.staffLogin()">เข้าสู่ระบบ</button></div></div>';
  }

  function renderStaffPanel() {
    var adminTab = state.staff.role === 'admin' ? '<div class="staff-tab" id="tab-staff" onclick="App.switchStaffTab(\'staff\')">พนักงาน</div><div class="staff-tab" id="tab-logs" onclick="App.switchStaffTab(\'logs\')">Log ระบบ</div>' : '';
    return '<nav class="nav-bar"><button class="nav-back" onclick="App.staffLogout()">&#8592; ออก</button><span class="nav-title">แผงควบคุมพนักงาน</span><span class="nav-badge">' + esc(state.staff.role) + '</span></nav><div class="page"><div class="page-inner"><div class="staff-panel-header stagger-item" style="display:flex; justify-content:space-between; align-items:center;"><div><div style="font-size:20px;font-weight:700">สวัสดี, ' + esc(state.staff.name) + '</div><div class="color-text2 fs-12">จัดการการชำระเงินและพนักงาน</div></div><div style="display:flex; gap:12px; align-items:center;"><div class="bell-wrapper" onclick="App.switchStaffTab(\'pending\')" title="รายการรอตรวจสอบ">&#128226;<div class="bell-badge" id="bell-badge" style="display:none">0</div></div><span class="staff-name-badge">' + esc(state.staff.username) + '</span></div></div><div class="staff-tabs" style="overflow-x:auto; white-space:nowrap; padding-bottom:8px;"><div class="staff-tab active" id="tab-pending" onclick="App.switchStaffTab(\'pending\')">รอตรวจสอบ</div><div class="staff-tab" id="tab-history" onclick="App.switchStaffTab(\'history\')">ประวัติการตรวจ</div><div class="staff-tab" id="tab-debtors" onclick="App.switchStaffTab(\'debtors\')">ลูกหนี้</div><div class="staff-tab" id="tab-accounts" onclick="App.switchStaffTab(\'accounts\')">บัญชี</div>' + adminTab + '</div><div id="staff-tab-content"></div></div></div>';
  }

  function staffLogin() {
    var user = document.getElementById('staff-user') ? document.getElementById('staff-user').value.trim() : '';
    var pass = document.getElementById('staff-pass') ? document.getElementById('staff-pass').value : '';
    if (!user || !pass) return toast('กรุณาระบุชื่อผู้ใช้และรหัสผ่าน', 'warning');
    showLoading('กำลังเข้าสู่ระบบ...');
    callServer('staffLogin', user, pass).then(function(res) {
      hideLoading();
      if (res.success) { state.staff = res.staff; toast('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ ' + res.staff.name, 'success'); var app = document.getElementById('app'); app.innerHTML = renderStaffPanel(); switchStaffTab('pending'); startPolling(); }
      else { toast(res.message || 'เข้าสู่ระบบไม่สำเร็จ', 'error'); }
    }).catch(function() { hideLoading(); toast('เกิดข้อผิดพลาด', 'error'); });
  }

  function staffLogout() { state.staff = null; stopPolling(); renderPage('staff'); }

  function startPolling() { if(pollingInterval) clearInterval(pollingInterval); fetchPendingCount(); pollingInterval = setInterval(fetchPendingCount, 15000); }
  function stopPolling() { if(pollingInterval) clearInterval(pollingInterval); }
  function fetchPendingCount() {
    if(!state.staff) { stopPolling(); return; }
    callServer('getPendingCount').then(function(count) { var badge = document.getElementById('bell-badge'); if(badge) { badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none'; } }).catch(function(){});
  }

  function filterList(input, containerId) {
    var keyword = input.value.toLowerCase(); var items = document.querySelectorAll('#' + containerId + ' .search-item');
    items.forEach(function(item) { var text = item.getAttribute('data-search').toLowerCase(); item.style.display = text.indexOf(keyword) > -1 ? '' : 'none'; });
  }

  function switchStaffTab(tab) {
    var tabs = ['pending', 'history', 'debtors', 'accounts', 'staff', 'logs'];
    tabs.forEach(function(t) { var el = document.getElementById('tab-' + t); if (el) el.classList.toggle('active', t === tab); });
    var content = document.getElementById('staff-tab-content'); if (!content) return;
    showLoading(); fetchPendingCount(); 
    if (tab === 'pending') renderPendingTab(content); else if (tab === 'history') renderHistoryTab(content); else if (tab === 'debtors') renderDebtorsTab(content); else if (tab === 'accounts') renderAccountsTab(content); else if (tab === 'staff') renderStaffMgmtTab(content); else if (tab === 'logs') renderLogsTab(content);
  }

  function renderPendingTab(content) {
    callServer('getAllPendingPayments').then(function(pending) {
      hideLoading();
      var searchHtml = '<input type="text" class="search-box stagger-item" placeholder="🔍 ค้นหารายการชำระ, ชื่อลูกหนี้, ยอดเงิน..." onkeyup="App.filterList(this, \'pending-list-container\')">';
      if (!pending || !pending.length) { content.innerHTML = searchHtml + '<div class="empty-state"><div class="empty-icon">&#9989;</div><div class="empty-title">ไม่มีรายการรอตรวจสอบ</div><div class="empty-desc">รายการชำระเงินที่รอตรวจสอบจะแสดงที่นี่</div></div>'; return; }
      var cardsHtml = pending.map(function(p) {
        var debtor = null; for (var i = 0; i < state.debtors.length; i++) { if (state.debtors[i].id === p.debtorId) { debtor = state.debtors[i]; break; } }
        var dt = p.payDate ? new Date(p.payDate).toLocaleDateString('th-TH') : '-';
        var slipBtn = p.fileId ? '<a href="https://drive.google.com/file/d/' + esc(p.fileId) + '/view" target="_blank" class="slip-btn" style="margin-top:8px">&#128238; ดูสลิป</a>' : '<div style="margin-top:8px;font-size:12px;color:var(--text3)">ไม่มีสลิป</div>';
        var searchString = esc(debtor ? debtor.name : '') + ' ' + esc(p.id) + ' ' + p.amount;
        return '<div class="pending-payment-card stagger-item search-item" data-search="' + searchString + '"><div class="pending-payment-header"><div><div class="pending-payment-id">' + esc(p.id) + '</div><div style="font-size:14px;font-weight:600;margin-top:2px">' + esc(debtor ? debtor.name : p.debtorId) + '</div></div><div class="pending-amount">\u0e3f' + Number(p.amount || 0).toLocaleString('th-TH') + '</div></div><div class="color-text2 fs-12">วันที่ชำระ: ' + dt + '</div>' + slipBtn + '<input type="text" class="staff-note-input" id="note-' + esc(p.id) + '" placeholder="หมายเหตุ (ถ้ามี)"><div class="pending-actions"><button class="btn btn-green" onclick="App.approvePayment(\'' + esc(p.id) + '\')">&#10003; อนุมัติ</button><button class="btn btn-danger" onclick="App.rejectPayment(\'' + esc(p.id) + '\')">&#10007; ปฏิเสธ</button></div></div>';
      }).join('');
      content.innerHTML = searchHtml + '<div id="pending-list-container">' + cardsHtml + '</div>';
    }).catch(function() { hideLoading(); toast('โหลดไม่สำเร็จ', 'error'); });
  }

  function renderHistoryTab(content) {
    callServer('getVerifiedPayments').then(function(history) {
      hideLoading();
      var searchHtml = '<input type="text" class="search-box stagger-item" placeholder="🔍 ค้นหาชื่อลูกหนี้, รหัสอ้างอิง, ชื่อผู้ตรวจ..." onkeyup="App.filterList(this, \'history-list-container\')">';
      if (!history || !history.length) { content.innerHTML = searchHtml + '<div class="empty-state"><div class="empty-icon">&#128203;</div><div class="empty-title">ยังไม่มีประวัติการตรวจสอบ</div></div>'; return; }
      var listHtml = history.map(function(p) {
        var debtorName = p.debtorId; for (var i = 0; i < state.debtors.length; i++) { if (state.debtors[i].id === p.debtorId) { debtorName = state.debtors[i].name; break; } }
        var dt = p.verifiedAt ? new Date(p.verifiedAt).toLocaleString('th-TH') : '-';
        var cls = p.status === 'ชำระแล้ว' ? 'paid' : (p.status === 'ปฏิเสธ' ? 'red' : 'pending');
        var searchString = esc(debtorName) + ' ' + esc(p.id) + ' ' + esc(p.verifier);
        var noteHtml = p.staffNote ? '<div style="font-size:12px; margin-top:6px; padding:6px; background:var(--bg3); border-left:3px solid ' + (p.status === 'ปฏิเสธ' ? 'var(--red)' : 'var(--accent)') + '; border-radius:2px;">หมายเหตุ: ' + esc(p.staffNote) + '</div>' : '';
        return '<div class="payment-card stagger-item search-item" data-search="' + searchString + '"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><div><div style="font-size:11px; color:var(--text3);">' + esc(p.id) + '</div><div style="font-weight:600; font-size:14px;">' + esc(debtorName) + '</div></div><div style="text-align:right;"><span class="status-badge ' + cls + '">' + esc(p.status) + '</span><br><span style="font-size:14px; font-weight:bold; color:var(--text);">฿' + Number(p.amount).toLocaleString('th-TH') + '</span></div></div>' + noteHtml + '<div style="font-size:12px; color:var(--text2); display:flex; justify-content:space-between; margin-top:8px; padding-top:8px; border-top:1px solid var(--border);"><span><span style="color:var(--text3)">ผู้อนุมัติ/ปฏิเสธ:</span> <strong>' + esc(p.verifier || 'System') + '</strong></span><span>' + dt + '</span></div></div>';
      }).join('');
      content.innerHTML = searchHtml + '<div id="history-list-container">' + listHtml + '</div>';
    }).catch(function() { hideLoading(); });
  }

  function renderLogsTab(content) {
    callServer('getSystemLogs').then(function(logs) {
      hideLoading();
      if (!logs || !logs.length) { content.innerHTML = '<div class="empty-state"><div class="empty-title">ไม่มีข้อมูล Log</div></div>'; return; }
      var rows = logs.map(function(l) { var dt = l.timestamp ? new Date(l.timestamp).toLocaleString('th-TH') : '-'; return '<tr class="stagger-item"><td class="fs-12 color-text2">' + dt + '</td><td><span class="badge badge-active" style="background:var(--bg4)">' + esc(l.staff) + '</span></td><td class="fw-6 fs-12">' + esc(l.action) + '</td><td class="fs-12 color-text2">' + esc(l.refId) + '</td><td class="fs-12 color-text3">' + esc(l.detail) + '</td></tr>'; }).join('');
      content.innerHTML = '<div class="table-wrap"><div class="table-scroll"><table><thead><tr><th>วันเวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>อ้างอิง</th><th>รายละเอียด</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }).catch(function() { hideLoading(); });
  }

  function renderDebtorsTab(content) {
    loadDebtors().then(function() {
      hideLoading();
      var rows = state.debtors.map(function(d, i) {
        var searchString = esc(d.name) + ' ' + esc(d.phone);
        return '<tr class="stagger-item search-item" data-search="' + searchString + '"><td class="color-text2 fs-12 fw-6">' + (i + 1) + '</td><td><div class="fw-6">' + esc(d.name) + '</div></td><td class="color-text2">' + esc(d.phone || '-') + '</td><td class="text-center" style="display:flex; justify-content:center; gap:6px;"><button class="btn btn-ghost" style="font-size:11px;padding:4px 8px" onclick="App.openViewDebtsModal(\'' + esc(d.id) + '\',\'' + esc(d.name).replace(/'/g,"&#39;") + '\')">ดูหนี้</button><button class="btn btn-accent" style="font-size:11px;padding:4px 8px" onclick="App.openAddDebtModal(\'' + esc(d.id) + '\',\'' + esc(d.name).replace(/'/g,"&#39;") + '\')">+ เพิ่มหนี้</button></td></tr>';
      }).join('');
      var searchHtml = '<input type="text" class="search-box stagger-item" placeholder="🔍 ค้นหาชื่อลูกหนี้, เบอร์โทร..." onkeyup="App.filterList(this, \'debtors-tbody\')">';
      content.innerHTML = searchHtml + '<div style="margin-bottom:12px;display:flex;justify-content:flex-end"><button class="btn btn-accent" onclick="App.openAddDebtorModal()">+ เพิ่มลูกหนี้ใหม่</button></div><div class="table-wrap"><div class="table-scroll"><table><thead><tr><th>#</th><th>ชื่อ</th><th>เบอร์โทร</th><th class="text-center">จัดการหนี้</th></tr></thead><tbody id="debtors-tbody">' + (rows || '<tr><td colspan="4" class="text-center color-text2">ไม่มีข้อมูลลูกหนี้</td></tr>') + '</tbody></table></div></div>';
    }).catch(function() { hideLoading(); });
  }

  function renderAccountsTab(content) {
    callServer('getAccounts').then(function(accounts) {
      hideLoading(); accounts = accounts || [];
      var cards = accounts.map(function(a) {
        var qrSection = '';
        if (a.qrCode) { qrSection = '<div class="qr-wrap" style="text-align:center;margin-top:12px;"><img src="' + esc(a.qrCode) + '" alt="QR Code" style="width:100px;height:100px;border-radius:8px;border:2px solid white;background:white;"><br><span class="promptpay-badge" style="margin-top:6px;display:inline-block;">&#128241; พร้อมเพย์ ' + esc(a.promptpay) + '</span></div>'; }
        else if (a.promptpay) { qrSection = '<div class="qr-wrap" style="text-align:center;margin-top:12px;"><img src="https://promptpay.io/' + esc(a.promptpay) + '" alt="PromptPay QR" style="width:100px;height:100px;border-radius:8px;border:2px solid white;background:white;" onerror="this.style.display=\'none\'"><br><span class="promptpay-badge" style="margin-top:6px;display:inline-block;">&#128241; พร้อมเพย์ ' + esc(a.promptpay) + '</span></div>'; }
        return '<div class="account-card" style="flex: 1 1 250px;"><div class="account-bank">&#127974; ' + esc(a.bank) + '</div><div class="account-name">' + esc(a.accountName) + '</div><div class="account-number">' + esc(a.accountNumber) + '</div>' + qrSection + (a.note ? '<div style="margin-top:8px;font-size:12px;color:var(--text3);text-align:center;">' + esc(a.note) + '</div>' : '') + '</div>';
      }).join('') || '<div class="empty-state" style="width:100%"><div class="empty-icon">&#127974;</div><div class="empty-title">ยังไม่มีบัญชีรับโอน</div></div>';
      content.innerHTML = '<div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;"><div class="color-text2 fs-12">บัญชีที่จะแสดงให้ลูกค้าเห็น</div><button class="btn btn-accent" onclick="App.openAddAccountModal()">+ เพิ่มบัญชีรับโอน</button></div><div style="display:flex;flex-wrap:wrap;gap:12px;">' + cards + '</div>';
    }).catch(function() { hideLoading(); });
  }

  function renderStaffMgmtTab(content) {
    callServer('getStaffList').then(function(staffList) {
      hideLoading(); staffList = staffList || [];
      var items = staffList.map(function(s) {
        var isSelf = s.id === state.staff.id;
        var toggleBtn = isSelf ? '<span class="fs-12 color-text3">(คุณ)</span>' : '<button class="btn btn-ghost" style="font-size:11px;padding:4px 8px" onclick="App.toggleStaff(\'' + esc(s.id) + '\',\'' + esc(s.status) + '\')">' + (s.status === 'active' ? 'ปิดใช้งาน' : 'เปิดใช้งาน') + '</button>';
        return '<div class="staff-list-item stagger-item"><div class="staff-item-info"><span class="staff-item-name">' + esc(s.name) + '</span><span class="staff-item-role">@' + esc(s.username) + ' &bull; ' + esc(s.role) + '</span></div><div style="display:flex;align-items:center;gap:8px"><span class="badge ' + (s.status === 'active' ? 'badge-active' : 'badge-inactive') + '">' + (s.status === 'active' ? 'ใช้งาน' : 'ปิด') + '</span>' + toggleBtn + '</div></div>';
      }).join('');
      content.innerHTML = '<div style="margin-bottom:12px;display:flex;justify-content:flex-end"><button class="btn btn-accent" onclick="App.openAddStaffModal()">+ เพิ่มพนักงาน</button></div>' + (items || '<div class="empty-state"><div class="empty-icon">&#128100;</div></div>');
    }).catch(function() { hideLoading(); });
  }

  function approvePayment(paymentId) {
    var noteEl = document.getElementById('note-' + paymentId); var note = noteEl ? noteEl.value : '';
    if (!confirm('ยืนยันการอนุมัติการชำระเงิน?')) return; showLoading('กำลังบันทึก...');
    callServer('approvePayment', paymentId, note, state.staff.name).then(function(res) {
      hideLoading(); if (res.success) { toast('อนุมัติสำเร็จ', 'success'); switchStaffTab('pending'); } else toast('เกิดข้อผิดพลาด', 'error');
    }).catch(function() { hideLoading(); toast('เกิดข้อผิดพลาด', 'error'); });
  }

  function rejectPayment(paymentId) {
    var noteEl = document.getElementById('note-' + paymentId); var note = noteEl ? noteEl.value : '';
    if (!note) return toast('กรุณาระบุเหตุผลที่ปฏิเสธ', 'warning'); if (!confirm('ยืนยันการปฏิเสธการชำระเงิน?')) return;
    showLoading('กำลังบันทึก...');
    callServer('rejectPayment', paymentId, note, state.staff.name).then(function(res) {
      hideLoading(); if (res.success) { toast('ปฏิเสธการชำระเงิน', 'info'); switchStaffTab('pending'); } else toast('เกิดข้อผิดพลาด', 'error');
    }).catch(function() { hideLoading(); toast('เกิดข้อผิดพลาด', 'error'); });
  }

  function openViewDebtsModal(debtorId, debtorName) {
    showLoading('กำลังโหลดรายการหนี้...');
    callServer('getDebtsByDebtor', debtorId).then(function(debts) {
      hideLoading(); debts = debts || [];
      var statusCls = { 'ค้างชำระ': 'pending', 'รอตรวจสอบ': 'waiting', 'ชำระแล้ว': 'paid' };
      var listHtml = debts.map(function(d) {
        var cls = statusCls[d.status] || 'pending'; var displayStatus = d.status;
        if (d.status === 'ค้างชำระ' && d.totalInstallments > 1 && d.paidInstallments > 0) { displayStatus = 'ชำระแล้ว ' + d.paidInstallments + ' งวด'; cls = 'accent'; }
        var rejectionHtml = d.rejectionNote ? '<div style="font-size:11px; color:#ff5e7a; background:rgba(255,94,122,0.1); padding:4px; border-radius:4px; margin-top:4px;">&#9888; ปฏิเสธ: ' + esc(d.rejectionNote) + '</div>' : '';
        return '<div style="padding:12px; background:var(--bg4); border-radius:8px; margin-bottom:10px;"><div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:6px;"><strong style="font-size:14px;">' + esc(d.item) + '</strong><span class="status-badge ' + cls + '">' + esc(displayStatus) + '</span></div><div style="font-size:13px; color:var(--text2);">ยอดหนี้รวม: ฿' + Number(d.totalAmount).toLocaleString('th-TH') + '</div><div style="font-size:13px; color:var(--text2);">ชำระแล้ว: ' + d.paidInstallments + ' / ' + d.totalInstallments + ' งวด (งวดละ: ฿' + Number(d.amountPerInstallment).toLocaleString('th-TH') + ')</div>' + rejectionHtml + (d.note ? '<div style="font-size:12px; color:var(--text3); margin-top:4px;">หมายเหตุ: ' + esc(d.note) + '</div>' : '') + '</div>';
      }).join('');
      if(!listHtml) listHtml = '<div class="empty-state"><div class="empty-icon" style="font-size:30px; margin-bottom:10px;">&#128203;</div><div class="empty-title">ยังไม่มีรายการหนี้</div></div>';
      var html = '<div class="modal-overlay" onclick="App.closeModal(event)"><div class="modal"><div class="modal-header"><span class="modal-title">&#128203; รายการหนี้ของ ' + esc(debtorName) + '</span><button class="modal-close" onclick="App.closeModalDirect()">&times;</button></div><div class="modal-body" style="max-height:60vh; overflow-y:auto; padding:16px;">' + listHtml + '</div><div class="modal-footer"><button class="btn-primary" onclick="App.closeModalDirect()">ปิดหน้าต่าง</button></div></div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
    }).catch(function() { hideLoading(); toast('โหลดไม่สำเร็จ', 'error'); });
  }

  function openAddDebtorModal() {
    var html = '<div class="modal-overlay" onclick="App.closeModal(event)"><div class="modal"><div class="modal-header"><span class="modal-title">&#128100; เพิ่มลูกหนี้ใหม่</span><button class="modal-close" onclick="App.closeModalDirect()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">ชื่อ-นามสกุล *</label><input type="text" id="new-name" class="form-input" placeholder="ชื่อ-นามสกุล"></div><div class="form-group"><label class="form-label">เบอร์โทร</label><input type="tel" id="new-phone" class="form-input" placeholder="0812345678"></div><div class="form-group"><label class="form-label">อีเมล</label><input type="email" id="new-email" class="form-input" placeholder="email@example.com"></div><div class="form-group"><label class="form-label">หมายเหตุ</label><textarea id="new-note" class="form-input" rows="2" placeholder="หมายเหตุ..."></textarea></div></div><div class="modal-footer"><button class="btn-secondary" onclick="App.closeModalDirect()">ยกเลิก</button><button class="btn-primary" onclick="App.saveDebtor()">บันทึก</button></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function saveDebtor() {
    var nameEl = document.getElementById('new-name'); var name = nameEl ? nameEl.value.trim() : '';
    if (!name) return toast('กรุณาระบุชื่อ-นามสกุล', 'warning');
    var data = { name: name, phone: document.getElementById('new-phone') ? document.getElementById('new-phone').value : '', email: document.getElementById('new-email') ? document.getElementById('new-email').value : '', note: document.getElementById('new-note') ? document.getElementById('new-note').value : '' };
    closeModalDirect(); showLoading('กำลังบันทึก...');
    callServer('addDebtor', data).then(function(res) {
      hideLoading(); if (res.success) { toast('เพิ่มลูกหนี้สำเร็จ', 'success'); switchStaffTab('debtors'); } else toast('เกิดข้อผิดพลาด', 'error');
    }).catch(function() { hideLoading(); toast('เกิดข้อผิดพลาด', 'error'); });
  }

  function openAddDebtModal(debtorId, debtorName) {
    var html = '<div class="modal-overlay" onclick="App.closeModal(event)"><div class="modal"><div class="modal-header"><span class="modal-title">&#128176; เพิ่มรายการหนี้</span><button class="modal-close" onclick="App.closeModalDirect()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">ลูกหนี้</label><div class="form-info"><strong>' + esc(debtorName) + '</strong></div></div><div class="form-group"><label class="form-label">รายการหนี้ / ชื่อสินค้า *</label><input type="text" id="add-debt-item" class="form-input" placeholder="เช่น ค่าสินค้า, ค่างวดรถ"></div><div class="form-group"><label class="form-label">ยอดหนี้รวม (บาท) *</label><input type="number" id="add-debt-total" class="form-input" placeholder="0.00" min="0" oninput="App.calculateInstallment()"></div><div class="form-group"><label class="form-label">รูปแบบการชำระ</label><select id="add-debt-type" class="form-input" onchange="App.toggleDebtType()"><option value="one_time">ชำระครั้งเดียวจบ</option><option value="installment">ผ่อนชำระหลายงวด</option></select></div><div id="installment-fields" style="display:none; padding:12px; background:var(--bg4); border-radius:8px; margin-bottom:16px;"><div class="form-group"><label class="form-label">จำนวนงวดทั้งหมด *</label><input type="number" id="add-debt-inst" class="form-input" value="1" min="1" oninput="App.calculateInstallment()"></div><div class="form-group"><label class="form-label">ยอดผ่อนต่องวด (ประเมิน)</label><input type="number" id="add-debt-per-inst" class="form-input" readonly style="color:var(--text2);"></div></div><div class="form-group"><label class="form-label">หมายเหตุ</label><textarea id="add-debt-note" class="form-input" rows="2" placeholder="เพิ่มเติม (ถ้ามี)"></textarea></div></div><div class="modal-footer"><button class="btn-secondary" onclick="App.closeModalDirect()">ยกเลิก</button><button class="btn-primary" onclick="App.saveDebt(\'' + esc(debtorId) + '\')">บันทึกรายการ</button></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function toggleDebtType() {
    var type = document.getElementById('add-debt-type').value; var instDiv = document.getElementById('installment-fields');
    instDiv.style.display = (type === 'installment') ? 'block' : 'none'; calculateInstallment();
  }

  function calculateInstallment() {
    var total = Number(document.getElementById('add-debt-total').value) || 0; var type = document.getElementById('add-debt-type').value;
    var inst = (type === 'installment') ? (Number(document.getElementById('add-debt-inst').value) || 1) : 1;
    if (inst > 0) document.getElementById('add-debt-per-inst').value = (total / inst).toFixed(2);
  }

  function saveDebt(debtorId) {
    var item = document.getElementById('add-debt-item').value.trim(); var total = Number(document.getElementById('add-debt-total').value) || 0;
    var type = document.getElementById('add-debt-type').value; var note = document.getElementById('add-debt-note').value.trim();
    if (!item) return toast('กรุณาระบุรายการหนี้', 'warning'); if (total <= 0) return toast('กรุณาระบุยอดหนี้ที่ถูกต้อง', 'warning');

    var installments = 1; var perInst = total;
    if (type === 'installment') {
      installments = Number(document.getElementById('add-debt-inst').value) || 1;
      if (installments < 1) return toast('จำนวนงวดต้องมากกว่า 0', 'warning');
      perInst = Number((total / installments).toFixed(2));
    }

    var payload = { debtorId: debtorId, item: item, totalAmount: total, totalInstallments: installments, amountPerInstallment: perInst, note: note };
    closeModalDirect(); showLoading('กำลังสร้างรายการหนี้...');
    callServer('addDebtRecord', payload).then(function(res) { hideLoading(); if (res.success) toast('เพิ่มรายการหนี้สำเร็จ', 'success'); else toast('เกิดข้อผิดพลาด', 'error'); }).catch(function() { hideLoading(); toast('เกิดข้อผิดพลาด', 'error'); });
  }

  function previewPromptPayQR() {
    var pp = document.getElementById('acc-pp').value.trim(); var container = document.getElementById('qr-preview-container'); var img = document.getElementById('qr-preview-img');
    if (pp.length >= 10) { img.src = 'https://promptpay.io/' + pp; container.style.display = 'block'; } else { container.style.display = 'none'; }
  }

  function openAddAccountModal() {
    var html = '<div class="modal-overlay" onclick="App.closeModal(event)"><div class="modal"><div class="modal-header"><span class="modal-title">&#127974; เพิ่มบัญชีรับโอน</span><button class="modal-close" onclick="App.closeModalDirect()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">ธนาคาร *</label><input type="text" id="acc-bank" class="form-input" placeholder="เช่น กสิกรไทย, ไทยพาณิชย์"></div><div class="form-group"><label class="form-label">ชื่อบัญชี *</label><input type="text" id="acc-name" class="form-input" placeholder="ชื่อ นามสกุล"></div><div class="form-group"><label class="form-label">เลขบัญชี *</label><input type="text" id="acc-no" class="form-input" placeholder="xxx-x-xxxxx-x"></div><div class="form-group"><label class="form-label">เบอร์พร้อมเพย์ (ถ้ามี)</label><input type="text" id="acc-pp" class="form-input" placeholder="เพื่อสร้าง QR Code อัตโนมัติ" oninput="App.previewPromptPayQR()"></div><div id="qr-preview-container" style="display:none; text-align:center; margin-bottom:16px;"><div style="font-size:12px; color:var(--text2); margin-bottom:6px;">ตัวอย่าง QR Code พร้อมเพย์</div><img id="qr-preview-img" src="" style="width:120px;height:120px;border-radius:8px;border:2px solid white;background:white;"></div><div class="form-group"><label class="form-label">หมายเหตุ</label><input type="text" id="acc-note" class="form-input" placeholder="เช่น บัญชีหลัก"></div></div><div class="modal-footer"><button class="btn-secondary" onclick="App.closeModalDirect()">ยกเลิก</button><button class="btn-primary" onclick="App.saveAccount()">บันทึกบัญชี</button></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function saveAccount() {
    var data = { bank: document.getElementById('acc-bank').value.trim(), accountName: document.getElementById('acc-name').value.trim(), accountNumber: document.getElementById('acc-no').value.trim(), promptpay: document.getElementById('acc-pp').value.trim(), note: document.getElementById('acc-note').value.trim() };
    if (!data.bank || !data.accountName || !data.accountNumber) return toast('กรุณากรอกข้อมูลธนาคาร ชื่อ และเลขบัญชีให้ครบ', 'warning');
    closeModalDirect(); showLoading('กำลังบันทึกบัญชี...');
    callServer('addBankAccount', data).then(function(res) { hideLoading(); if (res.success) { toast('เพิ่มบัญชีสำเร็จ', 'success'); switchStaffTab('accounts'); } else toast('เกิดข้อผิดพลาด', 'error'); }).catch(function() { hideLoading(); toast('เกิดข้อผิดพลาด', 'error'); });
  }

  function openAddStaffModal() {
    var html = '<div class="modal-overlay" onclick="App.closeModal(event)"><div class="modal"><div class="modal-header"><span class="modal-title">&#128272; เพิ่มพนักงาน</span><button class="modal-close" onclick="App.closeModalDirect()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">ชื่อพนักงาน *</label><input type="text" id="st-name" class="form-input" placeholder="ชื่อพนักงาน"></div><div class="form-group"><label class="form-label">Username *</label><input type="text" id="st-user" class="form-input" placeholder="username"></div><div class="form-group"><label class="form-label">รหัสผ่าน *</label><input type="password" id="st-pass" class="form-input" placeholder="อย่างน้อย 6 ตัวอักษร"></div><div class="form-group"><label class="form-label">บทบาท</label><select id="st-role" class="form-input"><option value="staff">staff</option><option value="admin">admin</option></select></div></div><div class="modal-footer"><button class="btn-secondary" onclick="App.closeModalDirect()">ยกเลิก</button><button class="btn-primary" onclick="App.saveStaff()">บันทึก</button></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function saveStaff() {
    var name = document.getElementById('st-name') ? document.getElementById('st-name').value.trim() : ''; var username = document.getElementById('st-user') ? document.getElementById('st-user').value.trim() : ''; var password = document.getElementById('st-pass') ? document.getElementById('st-pass').value : ''; var role = document.getElementById('st-role') ? document.getElementById('st-role').value : 'staff';
    if (!name || !username || !password) return toast('กรุณากรอกข้อมูลให้ครบ', 'warning'); if (password.length < 6) return toast('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'warning');
    closeModalDirect(); showLoading('กำลังบันทึก...');
    callServer('addStaff', { name: name, username: username, password: password, role: role }).then(function(res) { hideLoading(); if (res.success) { toast('เพิ่มพนักงานสำเร็จ', 'success'); switchStaffTab('staff'); } else toast('เกิดข้อผิดพลาด', 'error'); }).catch(function() { hideLoading(); toast('เกิดข้อผิดพลาด', 'error'); });
  }

  function toggleStaff(staffId, currentStatus) {
    var newStatus = currentStatus === 'active' ? 'inactive' : 'active'; showLoading();
    callServer('updateStaffStatus', staffId, newStatus).then(function() { hideLoading(); toast('อัปเดตสถานะสำเร็จ', 'success'); switchStaffTab('staff'); }).catch(function() { hideLoading(); });
  }

  function bindStaff() {
    var u = document.getElementById('staff-user'); var p = document.getElementById('staff-pass');
    if (u) u.addEventListener('keydown', function(e) { if (e.key === 'Enter' && p) p.focus(); });
    if (p) p.addEventListener('keydown', function(e) { if (e.key === 'Enter') staffLogin(); });
  }

  function renderPagination(current, total, fn) {
    if (total <= 1) return ''; var btns = '<button class="page-btn" onclick="' + fn + '(' + (current - 1) + ')" ' + (current <= 1 ? 'disabled' : '') + '>&#8592;</button>';
    for (var p = 1; p <= total; p++) {
      if (total > 7 && p > 2 && p < total - 1 && Math.abs(p - current) > 1) { if (p === 3 || p === total - 2) btns += '<span class="page-info">&hellip;</span>'; continue; }
      btns += '<button class="page-btn ' + (p === current ? 'active' : '') + '" onclick="' + fn + '(' + p + ')">' + p + '</button>';
    }
    btns += '<button class="page-btn" onclick="' + fn + '(' + (current + 1) + ')" ' + (current >= total ? 'disabled' : '') + '>&#8594;</button>';
    return '<div class="pagination">' + btns + '</div>';
  }

  // ⚠️ แกนกลางหลักที่เปลี่ยนจากการเรียก GAS API แบบเก่า มาใช้การ fetch 
  function callServer(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    
    // ยิง HTTP POST ไปที่ Web App พร้อมแนบพารามิเตอร์แบบ JSON
    return fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', 
      },
      body: JSON.stringify({ action: fn, args: args })
    })
    .then(function(response) {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    })
    .then(function(result) {
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Server error');
      }
    });
  }

  function showLoading(text) { var el = document.getElementById('loading-overlay'); var txt = document.getElementById('loading-text'); if (el) el.classList.remove('hidden'); if (txt) txt.textContent = text || 'กำลังโหลด...'; }
  function hideLoading() { var el = document.getElementById('loading-overlay'); if (el) el.classList.add('hidden'); }
  function toast(msg, type, ms) {
    ms = ms || 3000; type = type || 'info'; var container = document.getElementById('toast-container'); if (!container) return;
    var div = document.createElement('div'); div.className = 'toast ' + type; div.textContent = msg; container.appendChild(div);
    setTimeout(function() { div.classList.add('hide'); setTimeout(function() { if (div.parentNode) div.parentNode.removeChild(div); }, 300); }, ms);
  }
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  return {
    init: init, goDashboard: goDashboard, goHome: goHome, goHistory: goHistory, goStaff: goStaff,
    openPayModal: openPayModal, closeModal: closeModal, closeModalDirect: closeModalDirect,
    handleSlipUpload: handleSlipUpload, removeSlip: removeSlip, submitPayment: submitPayment,
    openAccountModal: openAccountModal, openViewDebtsModal: openViewDebtsModal, openAddDebtorModal: openAddDebtorModal, saveDebtor: saveDebtor,
    openAddDebtModal: openAddDebtModal, toggleDebtType: toggleDebtType, calculateInstallment: calculateInstallment, saveDebt: saveDebt,
    openAddAccountModal: openAddAccountModal, saveAccount: saveAccount, previewPromptPayQR: previewPromptPayQR, 
    staffLogin: staffLogin, staffLogout: staffLogout, switchStaffTab: switchStaffTab,
    approvePayment: approvePayment, rejectPayment: rejectPayment, openAddStaffModal: openAddStaffModal, saveStaff: saveStaff, toggleStaff: toggleStaff,
    setDebtPage: setDebtPage, setPayPage: setPayPage, toast: toast, filterList: filterList
  };
})();

document.addEventListener('DOMContentLoaded', function() {
  App.init();
});
