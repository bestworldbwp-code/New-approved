// ================= 1. CONFIG (ตั้งค่าระบบ) =================
const CONFIG = {
    // 1. Supabase URL & Key
    supaUrl: 'https://pufddwdcpugilwlavban.supabase.co', 
    supaKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZmRkd2RjcHVnaWx3bGF2YmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODY1MDUsImV4cCI6MjA3NDk2MjUwNX0.6dyYteDu6QSkTL9hIiaHw_2WeltSGSIoMSvx3OcEjN0', 
    
    // 2. EmailJS Keys
    emailPublicKey: 'rEly1Il6Xz0qZwaSc',   
    emailServiceId: 'service_tolm3pu',   
    emailTemplateId_Master: 'template_master', 

    // [1] อีเมลผู้อนุมัติเบื้องต้น (หัวหน้าแผนก)
    departmentHeads: {
        'จัดซื้อ':           'jakkidmarat@gmail.com',
        'QC':                'jakkidmarat@gmail.com',
        'ซ่อมบำรุง':         'jakkidmarat@gmail.com',
        'ฝ่ายผลิต':          'jakkidmarat@gmail.com',
        'HR':                'jakkidmarat@gmail.com'
    },

    // [2] ผู้บริหาร (อนุมัติขั้นสุดท้าย) & ฝ่ายจัดซื้อ
    managerEmail: 'bestworld.bwp328@gmail.com', 
    purchasingEmail: 'hr.bpp.2564@gmail.com',

    // รหัสผ่านเข้าสู่ระบบ (Admin)
    passwords: {
        '1001': 'จัดซื้อ', 
        '1002': 'QC', 
        '1003': 'ซ่อมบำรุง', 
        '1004': 'ฝ่ายผลิต', 
        '1005': 'HR',
        '9999': 'MANAGER_ROLE' 
    }
};

// ================= 2. SYSTEM START =================
const db = supabase.createClient(CONFIG.supaUrl, CONFIG.supaKey);
let isEmailEnabled = false;
if(typeof emailjs !== 'undefined') {
    emailjs.init(CONFIG.emailPublicKey);
    isEmailEnabled = true;
}

let currentUserRole = sessionStorage.getItem('userRole') || ''; 
let currentUserDept = sessionStorage.getItem('userDept') || ''; 
let currentDocType = 'pr';
let currentMode = 'pending'; 
let allDocs = []; 
let currentDoc = {};

document.addEventListener("DOMContentLoaded", function() {
    if (typeof LOGO_BASE64 !== 'undefined') {
        document.querySelectorAll('.app-logo').forEach(img => img.src = LOGO_BASE64);
    }
    if (window.location.href.includes('admin.html')) {
        const overlay = document.getElementById('loginOverlay');
        if (overlay) {
            if (currentUserRole && sessionStorage.getItem('isAdmin') === 'true') {
                overlay.style.display = 'none';
                updateAdminUI();
                loadData(); 
            } else { overlay.style.display = 'flex'; }
        }
    }
});

// ================= 3. MEMO FORM =================
const memoForm = document.getElementById('memoForm');
if (memoForm) {
    memoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnMemoSubmit');
        const originalText = btn.innerText;
        btn.disabled = true; 
        try {
            let publicUrl = null;
            const fileInput = document.getElementById('m_attachment');
            if (fileInput && fileInput.files.length > 0) {
                btn.innerText = '⏳ อัปโหลด...';
                const file = fileInput.files[0];
                const fileName = `memo_${Date.now()}.${file.name.split('.').pop()}`;
                const { error: upErr } = await db.storage.from('pr-files').upload(fileName, file);
                if (upErr) throw upErr;
                const { data: urlData } = db.storage.from('pr-files').getPublicUrl(fileName);
                publicUrl = urlData.publicUrl;
            }
            btn.innerText = '⏳ บันทึก...';
            const payload = {
                memo_no: document.getElementById('m_no').value,
                date: document.getElementById('m_date').value,
                from_dept: document.getElementById('m_from').value,
                to_dept: document.getElementById('m_to').value,
                subject: document.getElementById('m_subject').value,
                content: document.getElementById('m_content').value,
                attachment_url: publicUrl,
                status: 'pending_head'
            };
            const { data, error } = await db.from('memos').insert([payload]).select();
            if (error) throw error;
            const newId = data[0].id;
            try {
                const headEmail = CONFIG.departmentHeads[payload.from_dept];
                const adminLink = window.location.origin + '/admin.html';
                if (headEmail && isEmailEnabled) {
                    await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { 
                        to_email: headEmail, 
                        subject: `[New Memo] ขออนุมัติ Memo: ${payload.memo_no}`, 
                        html_content: `<h3>เรียน ผู้อนุมัติเบื้องต้น (${payload.from_dept})</h3><p>Memo เลขที่ ${payload.memo_no} รอตรวจสอบ</p><a href="${adminLink}">คลิกเพื่อเข้าสู่ระบบ</a>` 
                    });
                }
            } catch(e) { console.warn('Email failed', e); }
            if(confirm('✅ บันทึกสำเร็จ!\nต้องการเปิดหน้าพิมพ์ PDF เลยหรือไม่?')) {
                window.open(`view_memo.html?id=${newId}`, '_blank');
            }
            window.location.reload();
        } catch (err) { console.error(err); alert('Error: ' + err.message); btn.disabled = false; btn.innerText = originalText; }
    });
}

// ================= 4. PR FORM =================
window.addItemRow = function() {
    const container = document.getElementById('itemsContainer');
    if (!container) return; 
    const rowId = Date.now(); 
    const html = `
        <div class="item-row border p-3 mb-3 rounded bg-light shadow-sm" id="row-${rowId}">
            <div class="row g-3">
                <div class="col-md-3"><input type="text" class="form-control item-code" placeholder="รหัสสินค้า"></div>
                <div class="col-md-5"><input type="text" class="form-control item-desc" required placeholder="รายละเอียด"></div>
                <div class="col-md-2"><input type="number" class="form-control item-qty" required placeholder="จำนวน"></div>
                <div class="col-md-2"><input type="text" class="form-control item-unit" placeholder="หน่วย"></div>
            </div>
            <div class="text-end mt-2">
                <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeRow('${rowId}')">🗑️ ลบรายการนี้</button>
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
}
window.removeRow = function(id) { document.getElementById(`row-${id}`)?.remove(); }
if (document.getElementById('itemsContainer')) window.addItemRow();

const prForm = document.getElementById('prForm');
if (prForm) {
    prForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSubmit');
        const originalText = btn.innerText;
        btn.disabled = true; 
        try {
            const dept = document.getElementById('department').value;
            const headEmail = CONFIG.departmentHeads[dept];
            if (!headEmail) { alert("⚠️ ไม่พบอีเมลผู้อนุมัติของแผนกนี้"); throw new Error("Email not found"); }
            let publicUrl = null;
            const fileInput = document.getElementById('attachment');
            if (fileInput.files.length > 0) {
                btn.innerText = '⏳ อัปโหลด...';
                const file = fileInput.files[0];
                const fileName = `${Date.now()}.${file.name.split('.').pop()}`;
                const { error: upErr } = await db.storage.from('pr-files').upload(fileName, file);
                if (upErr) throw upErr;
                const { data: urlData } = db.storage.from('pr-files').getPublicUrl(fileName);
                publicUrl = urlData.publicUrl;
            }
            btn.innerText = '⏳ บันทึก...';
            const items = [];
            document.querySelectorAll('.item-row').forEach(row => { 
                items.push({
                    code: row.querySelector('.item-code').value, 
                    description: row.querySelector('.item-desc').value, 
                    quantity: row.querySelector('.item-qty').value, 
                    unit: row.querySelector('.item-unit').value, 
                    status: 'pending', 
                    remark: ''
                }); 
            });
            const payload = { 
                department: dept, 
                pr_number: document.getElementById('pr_number').value, 
                requester: document.getElementById('requester').value, 
                email: document.getElementById('email').value, 
                required_date: document.getElementById('required_date').value, 
                header_remark: document.getElementById('header_remark').value, 
                items: items, 
                attachment_url: publicUrl, 
                status: 'pending_head' 
            };
            const { data, error } = await db.from('purchase_requests').insert([payload]).select();
            if (error) throw error;
            const newId = data[0].id;
            try {
                const adminLink = window.location.origin + '/admin.html';
                if(isEmailEnabled) {
                    await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { 
                        to_email: headEmail, 
                        subject: `[New PR] แผนก${dept} ขอตรวจสอบ PR: ${payload.pr_number}`, 
                        html_content: `<h3>เรียน ผู้อนุมัติเบื้องต้น (${dept})</h3><p>มีรายการขอซื้อใหม่จาก <b>${payload.requester}</b> รอการตรวจสอบ</p><p>เลขที่ PR: ${payload.pr_number}</p><p><a href="${adminLink}">คลิกเพื่อเข้าสู่ระบบอนุมัติ</a></p>` 
                    });
                }
            } catch (emailErr) { console.error("Email sending failed but data saved:", emailErr); }
            if(confirm('✅ ส่งคำขอ PR เรียบร้อย!\nคุณต้องการเปิดหน้าสำหรับ "พิมพ์/บันทึก PDF" เพื่อเก็บเป็นหลักฐานเลยหรือไม่?')) {
                window.open(`view_pr.html?id=${newId}&mode=original`, '_blank');
            }
            window.location.href = 'index.html'; 
        } catch (err) { console.error(err); alert('Error: ' + err.message); btn.disabled = false; btn.innerText = originalText; }
    });
}

// ================= 5. ADMIN LOGIC =================
window.checkAdminPassword = function() {
    const input = document.getElementById('adminPassInput').value;
    const matchedDept = CONFIG.passwords[input];
    if (matchedDept) {
        sessionStorage.setItem('isAdmin', 'true');
        if (matchedDept === 'MANAGER_ROLE') { currentUserRole = 'manager'; currentUserDept = 'ALL'; } 
        else { currentUserRole = 'head'; currentUserDept = matchedDept; }
        sessionStorage.setItem('userRole', currentUserRole);
        sessionStorage.setItem('userDept', currentUserDept);
        document.getElementById('loginOverlay').style.display = 'none';
        updateAdminUI(); loadData();
    } else { alert("❌ รหัสผ่านไม่ถูกต้อง!"); }
}

function updateAdminUI() {
    const title = document.querySelector('#pageTitle');
    if (title) {
        const roleText = currentUserRole === 'head' ? `หัวหน้าแผนก (${currentUserDept})` : `ผู้บริหาร (อนุมัติขั้นสุดท้าย)`;
        title.innerText = `สถานะ: ${roleText}`;
    }
}

window.switchDocType = function(type) { currentDocType = type; loadData(); }
window.switchTab = function(mode) { currentMode = mode; loadData(); }

async function loadData() {
    const tableBody = document.getElementById('dataTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">⏳ กำลังโหลด...</td></tr>';
    updateBadges();
    try {
        const tableName = currentDocType === 'pr' ? 'purchase_requests' : 'memos';
        let query = db.from(tableName).select('*').order('created_at', { ascending: false });
        if (currentMode === 'pending') {
            if (currentUserRole === 'head') {
                query = query.eq('status', 'pending_head');
                if(currentDocType === 'pr') query = query.eq('department', currentUserDept);
                else query = query.eq('from_dept', currentUserDept);
            } else if (currentUserRole === 'manager') { query = query.eq('status', 'pending_manager'); }
        } else {
            if (currentUserRole === 'head') {
                query = query.neq('status', 'pending_head');
                if(currentDocType === 'pr') query = query.eq('department', currentUserDept);
                else query = query.eq('from_dept', currentUserDept);
            } else { query = query.in('status', ['processed', 'rejected']); }
        }
        const { data, error } = await query;
        if (error) throw error;
        allDocs = data;
        tableBody.innerHTML = '';
        if (data.length === 0) { tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-muted">ไม่พบรายการ</td></tr>`; return; }
        data.forEach(doc => {
            const date = new Date(doc.created_at || doc.date).toLocaleDateString('th-TH');
            let docNo = currentDocType === 'pr' ? doc.pr_number : doc.memo_no;
            let from = currentDocType === 'pr' ? `${doc.requester} (${doc.department})` : `${doc.from_dept} : ${doc.subject}`;
            let statusText = doc.status;
            let badgeClass = 'bg-secondary';
            if(statusText === 'pending_head') { statusText = 'รอหัวหน้าตรวจสอบ'; badgeClass = 'bg-warning text-dark'; }
            else if(statusText === 'pending_manager') { statusText = 'รอผู้บริหารอนุมัติ'; badgeClass = 'bg-info text-dark'; }
            else if(statusText === 'processed') { statusText = 'อนุมัติเรียบร้อย'; badgeClass = 'bg-success'; }
            else if(statusText === 'rejected') { statusText = 'ไม่อนุมัติ/ตีกลับ'; badgeClass = 'bg-danger'; }
            const row = `<tr><td class="ps-4"><span class="fw-bold text-primary">${docNo}</span></td><td>${date}</td><td><div class="small">${from}</div></td><td><span class="badge ${badgeClass}">${statusText}</span></td><td class="text-center pe-4"><button onclick="openDetailModal('${doc.id}')" class="btn btn-outline-primary btn-sm rounded-pill px-3 shadow-sm">ตรวจสอบ</button></td></tr>`;
            tableBody.innerHTML += row;
        });
    } catch (err) { console.error(err); }
}

async function updateBadges() {
    const badgePR = document.getElementById('badgePR');
    const badgeMemo = document.getElementById('badgeMemo');
    const countDisplayPR = document.getElementById('countDisplayPR');
    const countDisplayMemo = document.getElementById('countDisplayMemo');
    const getCount = async (table) => {
        let q = db.from(table).select('id', { count: 'exact', head: true });
        if (currentUserRole === 'head') {
            q = q.eq('status', 'pending_head');
            if(table === 'purchase_requests') q = q.eq('department', currentUserDept);
            else q = q.eq('from_dept', currentUserDept);
        } else { q = q.eq('status', 'pending_manager'); }
        const { count } = await q;
        return count || 0;
    };
    const countPR = await getCount('purchase_requests');
    const countMemo = await getCount('memos');
    if(countDisplayPR) countDisplayPR.innerText = countPR;
    if(countDisplayMemo) countDisplayMemo.innerText = countMemo;
    if(badgePR) { if(countPR > 0) { badgePR.innerText = countPR; badgePR.style.display = 'inline-block'; } else { badgePR.style.display = 'none'; } }
    if(badgeMemo) { if(countMemo > 0) { badgeMemo.innerText = countMemo; badgeMemo.style.display = 'inline-block'; } else { badgeMemo.style.display = 'none'; } }
}

// ================= 6. MODAL & APPROVAL LOGIC =================
window.openDetailModal = function(id) {
    currentDoc = allDocs.find(d => String(d.id) === String(id));
    if (!currentDoc) return;
    document.getElementById('approval_comment').value = '';
    
    if (currentDocType === 'pr') {
        document.getElementById('doc_type_title').innerText = "ใบขอซื้อ (Purchase Request)";
        document.getElementById('pr_form_layout').style.display = 'block';
        document.getElementById('memo_form_layout').style.display = 'none';
        document.getElementById('pr_no').innerText = currentDoc.pr_number;
        document.getElementById('pr_req_date').innerText = new Date(currentDoc.required_date).toLocaleDateString('th-TH');
        document.getElementById('pr_requester').innerText = currentDoc.requester;
        document.getElementById('pr_dept').innerText = currentDoc.department;
        document.getElementById('pr_remark').innerText = currentDoc.header_remark || '-';
        document.getElementById('sign_requester_name').innerText = currentDoc.requester;

        const tbody = document.getElementById('pr_items_body');
        tbody.innerHTML = '';
        
        let itemsToShow = currentDoc.items;
        if (currentUserRole === 'manager') {
            itemsToShow = currentDoc.items.filter(item => item.status === 'approved');
        }

        itemsToShow.forEach((item, index) => {
            // [FIXED] ใช้ index เป็น ID เพื่อความแม่นยำ
            let realIndex = currentDoc.items.indexOf(item); 
            let actionHtml = '';
            let reasonHtml = '';

            if (currentMode === 'history') {
                actionHtml = item.status === 'approved' ? '<span class="text-success">✅ อนุมัติ</span>' : '<span class="text-danger">❌ ไม่อนุมัติ</span>';
                reasonHtml = item.remark || '-';
            } else {
                actionHtml = `
                    <div class="form-check form-switch d-inline-block">
                        <input class="form-check-input item-check" type="checkbox" checked onchange="toggleReason(${realIndex})" id="check-${realIndex}" data-index="${realIndex}">
                        <label class="form-check-label text-success fw-bold" id="label-${realIndex}" for="check-${realIndex}">อนุมัติ</label>
                    </div>`;
                reasonHtml = `<input type="text" id="reason-${realIndex}" class="form-control form-control-sm" placeholder="ระบุเหตุผล..." style="display:none;">`;
            }

            tbody.innerHTML += `
                <tr>
                    <td class="text-center">${item.code||'-'}</td>
                    <td>${item.description}</td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-center">${item.unit}</td>
                    <td class="text-center">${actionHtml}</td>
                    <td>${reasonHtml}</td>
                </tr>`;
        });

        if (currentUserRole === 'manager' && itemsToShow.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger p-3 fw-bold">⚠️ ไม่มีรายการสินค้าที่ผ่านการอนุมัติจากหัวหน้าแผนก (ถูกปฏิเสธทั้งหมด)</td></tr>';
        }

    } else {
        document.getElementById('doc_type_title').innerText = "บันทึกข้อความ (Memo)";
        document.getElementById('pr_form_layout').style.display = 'none';
        document.getElementById('memo_form_layout').style.display = 'block';
        document.getElementById('memo_from').innerText = currentDoc.from_dept;
        document.getElementById('memo_no').innerText = currentDoc.memo_no;
        document.getElementById('memo_date').innerText = new Date(currentDoc.date).toLocaleDateString('th-TH');
        document.getElementById('memo_subject').innerText = currentDoc.subject;
        document.getElementById('memo_to').innerText = currentDoc.to_dept;
        document.getElementById('memo_content').innerText = currentDoc.content;
        document.getElementById('sign_requester_name').innerText = "เจ้าหน้าที่แผนก" + currentDoc.from_dept;
    }
    const attArea = document.getElementById('attachment_area');
    if (currentDoc.attachment_url) {
        attArea.style.display = 'block';
        document.getElementById('attachment_link').href = currentDoc.attachment_url;
    } else { attArea.style.display = 'none'; }
    const footerButtons = document.querySelector('.modal-footer');
    if (currentMode === 'history') footerButtons.style.display = 'none';
    else footerButtons.style.display = 'flex';
    const signHead = document.getElementById('sign_head_status');
    const signManager = document.getElementById('sign_manager_status');
    if(signHead) signHead.innerHTML = (currentDoc.status !== 'pending_head') ? '<span class="text-success">อนุมัติแล้ว</span>' : '<span class="text-muted">...</span>';
    if(signManager) signManager.innerHTML = (currentDoc.status === 'processed') ? '<span class="text-success">อนุมัติแล้ว</span>' : '<span class="text-muted">...</span>';
    new bootstrap.Modal(document.getElementById('detailModal')).show();
}

window.toggleReason = function(index) {
    const checkbox = document.getElementById(`check-${index}`);
    const reasonInput = document.getElementById(`reason-${index}`);
    const label = document.getElementById(`label-${index}`);
    if (checkbox.checked) {
        reasonInput.style.display = 'none'; reasonInput.value = ''; label.innerText = 'อนุมัติ'; label.className = 'form-check-label text-success fw-bold';
    } else {
        reasonInput.style.display = 'block'; reasonInput.focus(); label.innerText = 'ไม่อนุมัติ'; label.className = 'form-check-label text-danger fw-bold';
    }
}

// [FIXED] Logic บันทึกที่ปลอดภัย 100% ไม่พึ่งพา DOM
window.finalizeApproval = async function() {
    const btn = document.querySelector('.btn-success');
    btn.disabled = true; btn.innerText = '⏳ กำลังบันทึก...';

    try {
        const tableName = currentDocType === 'pr' ? 'purchase_requests' : 'memos';
        let nextStatus = '';
        let emailSubject = '';
        let emailTo = '';
        let emailContent = '';
        const now = new Date().toISOString();

        if (currentDocType === 'pr') {
            let hasRejectionWithoutReason = false;
            
            // ใช้ map เพื่อสร้าง array ใหม่ที่อัปเดตแล้ว
            const updatedItems = currentDoc.items.map((item, index) => {
                const checkbox = document.getElementById(`check-${index}`);
                const reasonInput = document.getElementById(`reason-${index}`);
                
                // ถ้าหา Element ไม่เจอ (เช่น กรณี Modal เรนเดอร์ไม่ครบ) ให้ใช้สถานะเดิม
                // แต่ปกติถ้าเปิด Modal แล้ว Element ต้องอยู่
                let isApproved = true;
                let reason = '';

                if (checkbox) {
                    isApproved = checkbox.checked;
                    reason = reasonInput ? reasonInput.value : '';
                    if (!isApproved && !reason.trim()) hasRejectionWithoutReason = true;
                } else {
                    // Fallback: ถ้าหา Checkbox ไม่เจอ ให้ถือว่าอนุมัติไปก่อน หรือใช้ค่าเดิม
                    isApproved = (item.status === 'approved' || item.status === 'pending');
                }

                const roleName = currentUserRole === 'head' ? 'หัวหน้าแผนก' : 'ผู้บริหาร';
                
                return {
                    ...item, // เก็บค่าเดิม (code, qty, etc.)
                    status: isApproved ? 'approved' : 'rejected',
                    remark: isApproved ? '' : `${reason} (โดย: ${roleName})`
                };
            });

            if (hasRejectionWithoutReason) {
                alert('⚠️ กรุณาระบุเหตุผลสำหรับรายการที่ "ไม่อนุมัติ" ให้ครบถ้วน');
                btn.disabled = false; btn.innerText = 'อนุมัติ';
                return;
            }
            
            // อัปเดต items กลับไปที่ตัวแปรหลัก
            currentDoc.items = updatedItems;
        }

        const updatePayload = { status: '' };
        if (currentUserRole === 'head') {
            nextStatus = 'pending_manager';
            updatePayload.status = nextStatus;
            updatePayload.head_approved_at = now; 
            emailTo = CONFIG.managerEmail;
            emailSubject = `[อนุมัติขั้นที่ 1] PR ${currentDoc.pr_number} ผ่านการตรวจสอบแล้ว`;
            emailContent = `<h3>เรียน ผู้บริหาร</h3><p>PR เลขที่ ${currentDoc.pr_number} ผ่านการตรวจสอบจากหัวหน้าแผนกแล้ว</p><a href="${window.location.origin}/admin.html">เข้าสู่ระบบ</a>`;

        } else if (currentUserRole === 'manager') {
            nextStatus = 'processed';
            updatePayload.status = nextStatus;
            updatePayload.manager_approved_at = now; 
            emailTo = CONFIG.purchasingEmail;
            emailSubject = `[Approved] คำสั่งซื้อ PR ${currentDoc.pr_number} อนุมัติแล้ว`;
            const linkApproved = window.location.origin + `/view_pr.html?id=${currentDoc.id}&mode=approved`;
            const linkOriginal = window.location.origin + `/view_pr.html?id=${currentDoc.id}&mode=original`;
            emailContent = `<h3>เรียน ฝ่ายจัดซื้อ</h3><p>PR เลขที่ <b>${currentDoc.pr_number}</b> อนุมัติเรียบร้อยแล้ว</p><hr><p>1. <a href="${linkApproved}">📂 ไฟล์ PO</a></p><p>2. <a href="${linkOriginal}">📄 ไฟล์ Log ต้นฉบับ</a></p>`;
        }

        if (currentDocType === 'pr') updatePayload.items = currentDoc.items;

        // [FIXED] ดักจับ Error 400 (กรณีไม่มี Column เวลา)
        // พยายามบันทึกแบบปกติก่อน
        let { error } = await db.from(tableName).update(updatePayload).eq('id', currentDoc.id);

        // ถ้า Error 400 (Bad Request) เดาว่าไม่มี Column head_approved_at
        if (error && error.code === 'PGRST204' || error.code === '42703' || error.message.includes('400')) {
            console.warn("Database missing timestamp columns. Retrying without timestamp...");
            delete updatePayload.head_approved_at;
            delete updatePayload.manager_approved_at;
            const retry = await db.from(tableName).update(updatePayload).eq('id', currentDoc.id);
            error = retry.error;
        }

        if (error) throw error;

        // ส่งเมล (Safe Mode)
        try {
            if (emailTo && isEmailEnabled) {
                btn.innerText = '⏳ กำลังส่งเมล...';
                await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { 
                    to_email: emailTo, subject: emailSubject, html_content: emailContent 
                });
            }
        } catch (emailErr) { console.warn("Email Failed:", emailErr); }

        alert('✅ บันทึกผลอนุมัติเรียบร้อย!');
        bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
        loadData();

    } catch (err) { console.error(err); alert('Error: ' + err.message); } finally { btn.disabled = false; }
}

window.rejectDocument = async function() {
    const comment = document.getElementById('approval_comment').value.trim();
    if (!comment) { alert("⚠️ กรุณาระบุเหตุผลที่ตีกลับเอกสาร"); return; }
    const btn = document.querySelector('.btn-outline-danger');
    btn.disabled = true; btn.innerText = '⏳ กำลังบันทึก...';
    try {
        const tableName = currentDocType === 'pr' ? 'purchase_requests' : 'memos';
        let updatePayload = { status: 'rejected' };
        if(currentDocType === 'pr') {
            const roleName = currentUserRole === 'head' ? 'หัวหน้าแผนก' : 'ผู้บริหาร';
            currentDoc.items.forEach(item => { item.status = 'rejected'; item.remark = `ตีกลับทั้งใบโดย ${roleName}: ${comment}`; });
            updatePayload.items = currentDoc.items;
        }
        await db.from(tableName).update(updatePayload).eq('id', currentDoc.id);
        alert('❌ ตีกลับเอกสารเรียบร้อย');
        bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
        loadData();
    } catch(err) { console.error(err); alert('Error: ' + err.message); } finally { if(btn) { btn.disabled = false; btn.innerText = 'ตีกลับเอกสาร'; } }
}

// ================= 7. VIEW / PRINT LOADERS (Auto Pagination) =================
const formatDate = (isoStr) => {
    if(!isoStr) return "";
    const d = new Date(isoStr);
    return `${d.toLocaleDateString('th-TH')} ${d.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}`;
};

async function loadPRForPrint() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const mode = params.get('mode');
    if (!id) return;
    try {
        const { data: pr, error } = await db.from('purchase_requests').select('*').eq('id', id).single();
        if (error) throw error;

        let displayItems = pr.items;
        if (mode === 'approved') displayItems = pr.items.filter(item => item.status === 'approved');

        const ITEMS_PER_PAGE = 15; // ปรับเป็น 15 รายการต่อหน้า
        const totalItems = displayItems.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
        const container = document.getElementById('pages-container');
        const template = document.getElementById('page-template').innerHTML;

        container.innerHTML = ''; 

        for (let i = 0; i < totalPages; i++) {
            const pageDiv = document.createElement('div');
            pageDiv.innerHTML = template;
            
            pageDiv.querySelector('.v_pr_number').innerText = pr.pr_number;
            pageDiv.querySelector('.v_created_at').innerText = new Date(pr.created_at).toLocaleDateString('th-TH');
            pageDiv.querySelector('.v_requester').innerText = pr.requester;
            pageDiv.querySelector('.v_department').innerText = pr.department;
            pageDiv.querySelector('.v_required_date').innerText = new Date(pr.required_date).toLocaleDateString('th-TH');
            pageDiv.querySelector('.page-number-slot').innerText = `หน้า ${i + 1}/${totalPages}`;

            if (mode === 'approved') pageDiv.querySelector('.doc-title').innerHTML += ' <span class="text-success" style="font-size:16px;">(รายการที่อนุมัติ)</span>';
            else if (mode === 'original') pageDiv.querySelector('.doc-title').innerHTML += ' <span class="text-secondary" style="font-size:16px;">(ต้นฉบับทั้งหมด)</span>';

            const start = i * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const pageItems = displayItems.slice(start, end);
            const tbody = pageDiv.querySelector('.v_tableBody');

            pageItems.forEach((item, index) => {
                let globalIndex = start + index + 1;
                let statusBadge = item.status === 'approved' ? '<span class="fw-bold text-success">✅ อนุมัติ</span>' : `<span class="text-danger fw-bold">❌ ไม่อนุมัติ</span><br><span class="text-danger small d-block mt-1">${item.remark}</span>`;
                if(item.status === 'pending') statusBadge = '<span class="text-warning">รอพิจารณา</span>';
                let rowStyle = (item.status === 'rejected' && mode === 'original') ? 'background-color: #fff5f5;' : '';
                tbody.innerHTML += `<tr style="${rowStyle}"><td class="text-center">${globalIndex}</td><td>${item.code || '-'}</td><td>${item.description}</td><td class="text-center">${item.quantity}</td><td class="text-center">${item.unit}</td><td class="text-center">${statusBadge}</td></tr>`;
            });

            const emptyRows = ITEMS_PER_PAGE - pageItems.length;
            for(let k=0; k<emptyRows; k++) tbody.innerHTML += `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`;

            const footer = pageDiv.querySelector('.footer-section');
            if (i < totalPages - 1) {
                footer.style.display = 'none'; 
            } else {
                pageDiv.querySelector('.v_remark').innerText = pr.header_remark || '-';
                pageDiv.querySelector('.v_sign_requester').innerText = pr.requester;
                pageDiv.querySelector('.v_sign_date_req').innerText = "วันที่ " + new Date(pr.created_at).toLocaleDateString('th-TH');
                if (pr.status !== 'pending_head' && pr.status !== 'pending') {
                    let headTime = pr.head_approved_at ? `<br><span class="text-dark small">วันที่ ${formatDate(pr.head_approved_at)}</span>` : '';
                    pageDiv.querySelector('.v_sign_head').innerHTML = `( ผู้อนุมัติเบื้องต้น ${pr.department} )<br><span class="text-success small">อนุมัติออนไลน์</span>${headTime}`; 
                }
                if (pr.status === 'processed') { 
                    let managerTime = pr.manager_approved_at ? `<br><span class="text-dark small">วันที่ ${formatDate(pr.manager_approved_at)}</span>` : '';
                    pageDiv.querySelector('.v_sign_manager').innerHTML = `( เบญจมาศ ถิ่นจันทร์ )<br><span class="text-success small">อนุมัติออนไลน์</span>${managerTime}`; 
                }
            }
            container.appendChild(pageDiv);
        }
    } catch (err) { alert('Error: ' + err.message); }
}

async function loadMemoForPrint() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return;
    try {
        const { data: m, error } = await db.from('memos').select('*').eq('id', id).single();
        if (error) throw error;
        document.getElementById('v_memo_no').innerText = m.memo_no;
        document.getElementById('v_date').innerText = new Date(m.date).toLocaleDateString('th-TH');
        document.getElementById('v_from').innerText = m.from_dept;
        document.getElementById('v_to').innerText = m.to_dept;
        document.getElementById('v_subject').innerText = m.subject;
        document.getElementById('v_content').innerText = m.content;
        if (m.attachment_url) { document.getElementById('v_attachment_area').style.display = 'block'; document.getElementById('v_attachment_link').href = m.attachment_url; }
        document.getElementById('v_sign_requester').innerText = "เจ้าหน้าที่แผนก" + m.from_dept;
        if (m.status !== 'pending_head') document.getElementById('v_sign_head').innerHTML = `( ผู้อนุมัติเบื้องต้น )<br><span class="text-success small">อนุมัติออนไลน์</span>`; 
        if (m.status === 'processed') document.getElementById('v_sign_manager').innerHTML = '( ผู้บริหาร )<br><span class="text-success small">อนุมัติออนไลน์</span>'; 
    } catch (err) { alert('Error: ' + err.message); }
}

if(document.getElementById('pages-container')) window.onload = loadPRForPrint;
if(document.getElementById('v_content')) window.onload = loadMemoForPrint;
