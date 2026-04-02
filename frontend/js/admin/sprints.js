// Admin Sprints JS — Full rewrite with Quick + Detailed plan support
let allSprints = [];
let allEmployees = [];
let editingSprintId = null;
let editingDetailedDays = []; // stores existing day objects when editing a detailed sprint
let deletingSprintId = null;
let assigningSprintId = null;
let currentFilter = 'all';
let selectedMethod = null; // 'quick' | 'detailed'

// Grant-edit state
let grantingDayId = null;
let grantingSprintId = null;

// Detail view state
let detailSprintId = null;
let detailDays = [];

(async () => {
  initTheme();
  initSidebar('sprints');
  const user = await requireAuth('admin');
  if (!user) return;
  setSidebarUser(user);

  await Promise.all([loadSprints(), loadEmployees()]);

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active', 'btn-primary'));
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.add('btn-ghost'));
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-ghost');
      currentFilter = btn.dataset.filter;
      renderSprints();
    });
  });

  // Open method picker
  document.getElementById('createSprintBtn').addEventListener('click', () => {
    editingSprintId = null;
    selectedMethod = null;
    document.getElementById('mcQuick').classList.remove('selected');
    document.getElementById('mcDetailed').classList.remove('selected');
    modal.open('methodPickerModal');
  });

  // Quick Sprint form submit
  document.getElementById('sprintForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('sprintSubmitBtn');
    btn.disabled = true; btn.textContent = 'Saving...';

    const payload = {
      name: document.getElementById('sprintName').value.trim(),
      description: document.getElementById('sprintDesc').value.trim(),
      startDate: document.getElementById('sprintStart').value,
      endDate: document.getElementById('sprintEnd').value,
      planType: 'quick'
    };

    if (new Date(payload.endDate) <= new Date(payload.startDate)) {
      toast.error('End date must be after start date');
      btn.disabled = false; btn.textContent = editingSprintId ? 'Save Changes' : 'Create Sprint';
      return;
    }

    try {
      if (editingSprintId) {
        await api.put(`/admin/sprints/${editingSprintId}`, payload);
        toast.success('Sprint updated');
      } else {
        await api.post('/admin/sprints', payload);
        toast.success('Sprint created — weekdays auto-generated!');
      }
      modal.close('sprintModal');
      await loadSprints();
    } catch (err) {
      toast.error(err.message);
    } finally {
      btn.disabled = false; btn.textContent = editingSprintId ? 'Save Changes' : 'Create Sprint';
    }
  });

  // Detailed Plan form submit
  document.getElementById('detailedForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('detailedSubmitBtn');
    btn.disabled = true; btn.textContent = 'Saving...';

    const name = document.getElementById('dSprintName').value.trim();
    const description = document.getElementById('dDesc').value.trim();
    const startDate = document.getElementById('dStartDate').value;
    const totalDays = parseInt(document.getElementById('dTotalDays').value);

    if (!name || !startDate || !totalDays) {
      toast.error('Please fill in all required fields');
      btn.disabled = false; btn.textContent = editingSprintId ? '💾 Save Changes' : '💾 Save Sprint Plan';
      return;
    }

    // Collect day plans from table
    const dayPlans = [];
    const rows = document.querySelectorAll('#planTableBody tr');
    if (rows.length === 0) {
      toast.error('Please generate the plan table first');
      btn.disabled = false; btn.textContent = editingSprintId ? '💾 Save Changes' : '💾 Save Sprint Plan';
      return;
    }

    rows.forEach(row => {
      dayPlans.push({
        module: row.querySelector('.dp-module').value.trim(),
        tasks: row.querySelector('.dp-tasks').value.trim(),
        plannedStatus: row.querySelector('.dp-status').value,
        notes: row.querySelector('.dp-notes').value.trim()
      });
    });

    // Calculate endDate from startDate + totalDays
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + totalDays - 1);
    const endDate = end.toISOString().slice(0, 10);

    try {
      if (editingSprintId) {
        // Update sprint metadata
        await api.put(`/admin/sprints/${editingSprintId}`, { name, description, startDate, endDate, planType: 'detailed' });
        // Bulk-update all days
        await api.put(`/admin/sprints/${editingSprintId}/days-bulk`, { dayPlans });
        toast.success('Detailed sprint updated!');
      } else {
        await api.post('/admin/sprints', { name, description, startDate, endDate, planType: 'detailed', dayPlans });
        toast.success(`Detailed sprint created with ${totalDays} days!`);
      }
      modal.close('detailedModal');
      await loadSprints();
    } catch (err) {
      toast.error(err.message);
    } finally {
      btn.disabled = false; btn.textContent = editingSprintId ? '💾 Save Changes' : '💾 Save Sprint Plan';
    }
  });

  // Assign submit
  document.getElementById('assignSubmitBtn').addEventListener('click', async () => {
    if (!assigningSprintId) return;
    const selected = [...document.querySelectorAll('.assign-checkbox:checked')].map(cb => cb.value);
    try {
      await api.post(`/admin/sprints/${assigningSprintId}/assign`, { employeeIds: selected });
      toast.success(`Sprint assigned to ${selected.length} employee(s)`);
      modal.close('assignModal');
      await loadSprints();
    } catch (err) { toast.error(err.message); }
  });

  // Delete confirm
  document.getElementById('confirmDeleteSprintBtn').addEventListener('click', async () => {
    if (!deletingSprintId) return;
    try {
      await api.del(`/admin/sprints/${deletingSprintId}`);
      toast.success('Sprint deleted');
      modal.close('deleteSprintModal');
      await loadSprints();
    } catch (err) { toast.error(err.message); }
  });

  // Grant edit save
  document.getElementById('grantSaveBtn').addEventListener('click', async () => {
    if (!grantingDayId || !grantingSprintId) return;
    const selected = [...document.querySelectorAll('.grant-emp-check:checked')].map(cb => cb.value);
    try {
      await api.post(`/admin/sprints/${grantingSprintId}/days/${grantingDayId}/grant-edit`, { employeeIds: selected });
      toast.success(`Edit access updated for ${selected.length} employee(s)`);
      modal.close('grantEditModal');
      // Refresh detail table
      await loadDetailDays(grantingSprintId);
    } catch (err) { toast.error(err.message); }
  });
})();

// ── Method Selection ─────────────────────────────────────
window.selectMethod = function (method) {
  selectedMethod = method;
  document.getElementById('mcQuick').classList.toggle('selected', method === 'quick');
  document.getElementById('mcDetailed').classList.toggle('selected', method === 'detailed');
};

window.proceedToForm = function () {
  if (!selectedMethod) {
    toast.error('Please select a method first');
    return;
  }
  modal.close('methodPickerModal');
  if (selectedMethod === 'quick') {
    editingSprintId = null;
    document.getElementById('sprintModalTitle').textContent = '⚡ Quick Sprint';
    document.getElementById('sprintSubmitBtn').textContent = 'Create Sprint';
    document.getElementById('sprintForm').reset();
    document.getElementById('sprintId').value = '';
    modal.open('sprintModal');
  } else {
    editingSprintId = null;
    document.getElementById('detailedModalTitle').textContent = '📋 Detailed Sprint Plan';
    document.getElementById('detailedModalSub').textContent = 'Fill in day-by-day tasks — employees will see this as their roadmap';
    document.getElementById('detailedSubmitBtn').textContent = '💾 Save Sprint Plan';
    document.getElementById('detailedForm').reset();
    document.getElementById('dEndDate').value = '';
    document.getElementById('planTableWrap').style.display = 'none';
    document.getElementById('planEmptyHint').style.display = 'block';
    document.getElementById('planTableBody').innerHTML = '';
    document.getElementById('pasteInput').value = '';
    modal.open('detailedModal');
  }
};

window.closeDetailedModal = function () {
  editingSprintId = null;
  editingDetailedDays = [];
  modal.close('detailedModal');
};

// ── Date / Days Auto-Sync ────────────────────────────────
window.onStartDateChange = function () {
  updateDayDates();
  // If end date already set, recalculate total days
  const start = document.getElementById('dStartDate').value;
  const end = document.getElementById('dEndDate').value;
  if (start && end) {
    const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
    if (days > 0) document.getElementById('dTotalDays').value = days;
  }
};

window.onEndDateChange = function () {
  const start = document.getElementById('dStartDate').value;
  const end = document.getElementById('dEndDate').value;
  if (start && end) {
    const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
    if (days > 0) {
      document.getElementById('dTotalDays').value = days;
      generatePlanTable();
    }
  }
};

window.onTotalDaysChange = function () {
  const start = document.getElementById('dStartDate').value;
  const total = parseInt(document.getElementById('dTotalDays').value);
  if (start && total > 0) {
    const end = new Date(start);
    end.setDate(end.getDate() + total - 1);
    document.getElementById('dEndDate').value = end.toISOString().slice(0, 10);
  }
  generatePlanTable();
};

// ── Plan Table Generation ─────────────────────────────────
window.generatePlanTable = function (initialData) {
  const totalDays = parseInt(document.getElementById('dTotalDays').value);
  const startDate = document.getElementById('dStartDate').value;
  if (!totalDays || totalDays < 1) {
    toast.error('Enter total days first');
    return;
  }

  const tbody = document.getElementById('planTableBody');
  tbody.innerHTML = '';

  const start = startDate ? new Date(startDate) : null;

  for (let i = 0; i < totalDays; i++) {
    let dateLabel = '';
    if (start) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dateLabel = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    }

    const preset = (initialData && initialData[i]) || {};
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="day-num-cell">
        Day ${i + 1}
        <div style="font-size:10px;color:var(--text-dim);font-weight:400">${dateLabel}</div>
      </td>
      <td><input class="dp-module" type="text" value="${escHtml(preset.module || '')}" placeholder="e.g. Auth" /></td>
      <td><textarea class="dp-tasks" rows="2" placeholder="What needs to be done…">${escHtml(preset.tasks || '')}</textarea></td>
      <td>
        <select class="dp-status">
          <option value="pending" ${(preset.plannedStatus || 'pending') === 'pending' ? 'selected' : ''}>⏳ Pending</option>
          <option value="in-progress" ${preset.plannedStatus === 'in-progress' ? 'selected' : ''}>🔄 In Progress</option>
          <option value="done" ${preset.plannedStatus === 'done' ? 'selected' : ''}>✅ Done</option>
        </select>
      </td>
      <td><input class="dp-notes" type="text" value="${escHtml(preset.notes || '')}" placeholder="Notes…" /></td>
    `;
    tbody.appendChild(row);
  }

  document.getElementById('planTableWrap').style.display = 'block';
  document.getElementById('planEmptyHint').style.display = 'none';
};

window.updateDayDates = function () {
  const tbody = document.getElementById('planTableBody');
  if (!tbody.children.length) return;
  const startDate = document.getElementById('dStartDate').value;
  if (!startDate) return;
  const start = new Date(startDate);
  [...tbody.children].forEach((row, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateLabel = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const cell = row.querySelector('.day-num-cell');
    if (cell) cell.innerHTML = `Day ${i + 1}<div style="font-size:10px;color:var(--text-dim);font-weight:400">${dateLabel}</div>`;
  });
};

// ── Paste from Spreadsheet ────────────────────────────────
window.parsePastedData = function () {
  const raw = document.getElementById('pasteInput').value.trim();
  if (!raw) { toast.error('Nothing pasted yet — copy from your spreadsheet first'); return; }

  const lines = raw.split('\n').filter(l => l.trim());
  if (!lines.length) { toast.error('No data found in paste area'); return; }

  // Parse rows: split by tab (Google Sheets/Excel) or pipe (|) for versatile text imports
  const parsed = lines.map(line => {
    const cols = line.split(/\t|\|/).map(c => c.trim());
    const rawStatus = (cols[2] || '').toLowerCase().replace(/[^a-z-]/g, '');
    const statusMap = {
      'pending': 'pending', 'inprogress': 'in-progress', 'in-progress': 'in-progress',
      'done': 'done', 'complete': 'done', 'completed': 'done', 'todo': 'pending', 'wip': 'in-progress'
    };
    return {
      module: cols[0] || '',
      tasks: cols[1] || '',
      plannedStatus: statusMap[rawStatus] || 'pending',
      notes: cols[3] || ''
    };
  });

  // Set total days to number of parsed rows if not already set
  const currentTotal = parseInt(document.getElementById('dTotalDays').value);
  if (!currentTotal || currentTotal < parsed.length) {
    document.getElementById('dTotalDays').value = parsed.length;
    // Also update end date if start is set
    const start = document.getElementById('dStartDate').value;
    if (start) {
      const end = new Date(start);
      end.setDate(end.getDate() + parsed.length - 1);
      document.getElementById('dEndDate').value = end.toISOString().slice(0, 10);
    }
  }

  // Generate table with preset data
  generatePlanTable(parsed);

  // Merge into existing rows if table already had more rows
  const rows = document.querySelectorAll('#planTableBody tr');
  parsed.forEach((d, i) => {
    if (rows[i]) {
      rows[i].querySelector('.dp-module').value = d.module;
      rows[i].querySelector('.dp-tasks').value = d.tasks;
      rows[i].querySelector('.dp-status').value = d.plannedStatus;
      rows[i].querySelector('.dp-notes').value = d.notes;
    }
  });

  toast.success(`✅ Imported ${parsed.length} rows from spreadsheet!`);
};

window.clearPasteArea = function () {
  document.getElementById('pasteInput').value = '';
};


// ── Data Loading ─────────────────────────────────────────
async function loadSprints() {
  try {
    const [sprintsRes, extsRes, plansRes] = await Promise.all([
      api.get('/admin/sprints'),
      api.get('/admin/extensions'),
      api.get('/admin/plan-requests')
    ]);
    allSprints = sprintsRes.data;
    renderSprints();
    renderExtensionsBadge(extsRes.data);
    renderPlanRequestsBadge(plansRes.data);
  } catch (err) { toast.error('Failed to load sprints or requests'); }
}

function renderPlanRequestsBadge(requests) {
  let container = document.getElementById('planRequestsContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'planRequestsContainer';
    // Insert after extensions if exists, otherwise before grid
    const extCont = document.getElementById('extensionsContainer');
    const pivot = extCont || document.getElementById('sprintsGrid');
    pivot.parentNode.insertBefore(container, pivot.nextSibling || pivot);
  }

  if (!requests || requests.length === 0) {
    container.innerHTML = '';
    return;
  }

  const reqsHtml = requests.map(req => {
    const sprintName = req.sprintId?.name || 'Unknown Sprint';
    const empNames = req.sprintId?.assignedTo?.map(a => a.name).join(', ') || 'Employee';
    
    return `
      <div style="background:rgba(0,212,170,0.1); border:1px solid rgba(0,212,170,0.3); padding:16px; border-radius:8px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:16px; flex:1">
          <div style="background:rgba(0,212,170,0.2); width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px;">📝</div>
          <div style="flex:1">
            <h4 style="margin:0 0 4px 0; color:var(--text); font-size:14px;">Plan Change Request: ${escHtml(sprintName)} (Day ${req.dayNumber})</h4>
            <div style="display:flex; gap:20px; font-size:12px;">
               <div style="flex:1">
                  <div style="color:var(--text-muted); font-size:10px; text-transform:uppercase; margin-bottom:2px">Proposed Module</div>
                  <div style="color:var(--primary); font-weight:600">${escHtml(req.pendingModule || 'No change')}</div>
               </div>
               <div style="flex:2">
                  <div style="color:var(--text-muted); font-size:10px; text-transform:uppercase; margin-bottom:2px">Proposed Tasks</div>
                  <div style="color:var(--text); font-style:italic">"${escHtml(req.pendingTasks || 'No change')}"</div>
               </div>
            </div>
          </div>
        </div>
        <div style="display:flex; gap:8px; margin-left:20px">
          <button class="btn btn-ghost" onclick="resolvePlanRequest('${req._id}', 'rejected')" style="color:#ef4444; border:1px solid rgba(239,68,68,0.2);">Reject</button>
          <button class="btn btn-primary" onclick="resolvePlanRequest('${req._id}', 'approved')" style="background:#00D4AA; border:none; color:#14141e;">Approve Change</button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `<h3 style="margin-top:20px; margin-bottom:12px; font-size:14px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Pending Plan Updates (Review Needed)</h3>` + reqsHtml + `<hr style="border:none; border-bottom:1px solid var(--border-transparent); margin:24px 0;">`;
}

window.resolvePlanRequest = async function(id, status) {
  try {
    await api.post(`/admin/plan-requests/${id}/resolve`, { status });
    toast.success(`Plan update ${status} successfully.`);
    loadSprints(); 
  } catch (err) {
    toast.error('Failed to resolve plan request.');
  }
};

function renderExtensionsBadge(extensions) {
  let container = document.getElementById('extensionsContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'extensionsContainer';
    document.getElementById('sprintsGrid').parentNode.insertBefore(container, document.getElementById('sprintsGrid'));
  }

  if (!extensions || extensions.length === 0) {
    container.innerHTML = '';
    return;
  }

  const extsHtml = extensions.map(ext => `
    <div style="background:rgba(234,179,8,0.1); border:1px solid rgba(234,179,8,0.3); padding:16px; border-radius:8px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; align-items:center; gap:16px;">
        <div style="background:rgba(234,179,8,0.2); width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px;">⏳</div>
        <div>
          <h4 style="margin:0 0 4px 0; color:var(--text); font-size:14px;">Extension Request: ${escHtml(ext.sprintId.name)}</h4>
          <div style="color:var(--text-dim); font-size:12px;"><strong>${escHtml(ext.userId.name)}</strong> mathematically requested <strong>+${ext.requestedDays} Days</strong> starting backwards from <strong>Day ${ext.delayedDayNumber || '?'}</strong>. Reason: <em>"${escHtml(ext.reason)}"</em></div>
        </div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-ghost" onclick="resolveExtension('${ext._id}', 'rejected')" style="color:#ef4444; border:1px solid rgba(239,68,68,0.2);">Reject</button>
        <button class="btn btn-primary" onclick="resolveExtension('${ext._id}', 'approved')" style="background:#00D4AA; border:none; color:#14141e;">Approve (+${ext.requestedDays}d)</button>
      </div>
    </div>
  `).join('');

  container.innerHTML = `<h3 style="margin-bottom:12px; font-size:14px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Pending Deadline Extensions</h3>` + extsHtml + `<hr style="border:none; border-bottom:1px solid var(--border-transparent); margin:24px 0;">`;
}

window.resolveExtension = async function(id, status) {
  try {
    await api.post(`/admin/extensions/${id}/resolve`, { status });
    toast.success(`Extension ${status} successfully.`);
    loadSprints(); // Refresh to clear badge and update sprint dates
  } catch (err) {
    toast.error('Failed to resolve extension request.');
  }
};

async function loadEmployees() {
  try {
    const { data } = await api.get('/admin/employees');
    allEmployees = data;
  } catch {}
}

// ── Render Sprints Grid ───────────────────────────────────
function renderSprints() {
  const grid = document.getElementById('sprintsGrid');
  const filtered = currentFilter === 'all' ? allSprints : allSprints.filter(s => s.status === currentFilter);

  if (!filtered.length) {
    grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><div class="icon">🗂️</div><h3>No sprints found</h3><p>Create your first sprint to get started</p></div></div>`;
    return;
  }

  grid.innerHTML = filtered.map(sprint => {
    const completedDays = sprint.completedDays || 0;
    const totalDays = sprint.totalDays || 0;
    const progress = totalDays ? Math.round((completedDays / totalDays) * 100) : 0;

    return `
    <div class="sprint-card animate-in">
      <div class="sprint-card-header">
        <div>
          <div class="sprint-card-title">${sprint.name}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">by ${sprint.createdBy?.name || 'Admin'}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${sprint.planType === 'detailed' ? `<span style="font-size:10px;background:rgba(0,212,170,.15);color:#00D4AA;padding:2px 8px;border-radius:20px;font-weight:600">📋 Detailed</span>` : ''}
          <span class="badge badge-${sprint.status}">${sprint.status}</span>
        </div>
      </div>
      <div class="sprint-card-desc">${sprint.description || 'No description'}</div>
      <div class="sprint-meta">
        <span>📅 ${dateUtils.formatShort(sprint.startDate)}</span>
        <span>🏁 ${dateUtils.formatShort(sprint.endDate)}</span>
      </div>
      <div style="margin-bottom:16px;">
        <div class="sprint-progress-label">
          <span>${completedDays} of ${totalDays} fully completed days</span>
          <span>${progress}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:14px;flex-wrap:wrap">
        ${sprint.assignedTo.map(emp => `
          <div class="avatar" style="background:${emp.avatarColor};width:28px;height:28px;font-size:11px;border:2px solid var(--surface)" title="${emp.name}">${getInitials(emp.name)}</div>
        `).join('')}
        ${sprint.assignedTo.length > 0
          ? `<span class="assignee-count">${sprint.assignedTo.length} assigned</span>`
          : `<span style="font-size:12px;color:var(--text-dim)">No employees assigned</span>`
        }
      </div>
      <div class="sprint-card-footer">
        ${sprint.planType === 'detailed' ? `<button class="btn btn-ghost btn-sm" onclick="viewSprintPlan('${sprint._id}', '${sprint.name}', '${sprint.startDate}')">📋 View Plan</button>` : ''}
        <button class="btn btn-accent btn-sm" onclick="openAssign('${sprint._id}', '${sprint.name}', ${JSON.stringify(sprint.assignedTo.map(e => e._id))})">👥 Assign</button>
        <button class="btn btn-ghost btn-sm" onclick="editSprint('${sprint._id}')">✏️ Edit</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteSprint('${sprint._id}', '${sprint.name}')">🗑️</button>
      </div>
    </div>
  `}).join('');
}

// ── Sprint Detail / Day Plan View ─────────────────────────
window.viewSprintPlan = async function (sprintId, sprintName, startDate) {
  detailSprintId = sprintId;
  document.getElementById('detailModalTitle').textContent = sprintName;
  document.getElementById('detailModalSub').textContent = `Sprint plan — ${dateUtils.formatShort(startDate)}`;
  document.getElementById('detailLoadingState').style.display = 'block';
  document.getElementById('detailTableContainer').style.display = 'none';
  modal.open('sprintDetailModal');
  await loadDetailDays(sprintId);
};

async function loadDetailDays(sprintId) {
  try {
    const { data } = await api.get(`/admin/sprints/${sprintId}/days`);
    detailDays = data;
    renderDetailTable();
    document.getElementById('detailLoadingState').style.display = 'none';
    document.getElementById('detailTableContainer').style.display = 'block';
  } catch (err) {
    toast.error('Failed to load days');
  }
}

function renderDetailTable() {
  const tbody = document.getElementById('detailTableBody');
  tbody.innerHTML = detailDays.map(day => {
    const dateStr = day.date ? new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }) : '—';
    const statusClass = `status-${(day.plannedStatus || 'pending').replace('-', '-')}`;
    const hasEdit = day.editableBy && day.editableBy.length > 0;

    return `
      <tr id="day-row-${day._id}">
        <td style="font-weight:700;color:var(--primary)">Day ${day.dayNumber}</td>
        <td style="font-size:12px;color:var(--text-muted);white-space:nowrap">${dateStr}</td>
        <td class="editable-cell">
          <input id="dm-${day._id}" type="text" value="${escHtml(day.module || '')}" placeholder="Module…" oninput="markDayDirty('${day._id}')" />
        </td>
        <td class="editable-cell">
          <textarea id="dt-${day._id}" rows="2" placeholder="Tasks…" oninput="markDayDirty('${day._id}')">${escHtml(day.tasks || '')}</textarea>
        </td>
        <td>
          <select id="ds-${day._id}" onchange="markDayDirty('${day._id}')">
            <option value="pending" ${day.plannedStatus === 'pending' ? 'selected' : ''}>⏳ Pending</option>
            <option value="in-progress" ${day.plannedStatus === 'in-progress' ? 'selected' : ''}>🔄 In Progress</option>
            <option value="done" ${day.plannedStatus === 'done' ? 'selected' : ''}>✅ Done</option>
          </select>
          <button class="save-day-btn" id="save-${day._id}" onclick="saveDayPlan('${day._id}')">💾 Save</button>
        </td>
        <td class="editable-cell">
          <input id="dn-${day._id}" type="text" value="${escHtml(day.notes || '')}" placeholder="Notes…" oninput="markDayDirty('${day._id}')" />
        </td>
        <td>
          <button class="grant-edit-btn ${hasEdit ? 'granted' : ''}" onclick="openGrantEdit('${day._id}', ${day.dayNumber}, ${JSON.stringify(day.editableBy || [])})">
            ${hasEdit ? '🔓 Granted' : '🔒 Grant Edit'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.markDayDirty = function (dayId) {
  const btn = document.getElementById(`save-${dayId}`);
  if (btn) btn.classList.add('visible');
};

window.saveDayPlan = async function (dayId) {
  const btn = document.getElementById(`save-${dayId}`);
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
  try {
    await api.put(`/admin/sprints/${detailSprintId}/days/${dayId}`, {
      module: document.getElementById(`dm-${dayId}`).value,
      tasks: document.getElementById(`dt-${dayId}`).value,
      plannedStatus: document.getElementById(`ds-${dayId}`).value,
      notes: document.getElementById(`dn-${dayId}`).value
    });
    toast.success('Day saved!');
    if (btn) { btn.classList.remove('visible'); btn.textContent = '💾 Save'; btn.disabled = false; }
  } catch (err) {
    toast.error(err.message);
    if (btn) { btn.textContent = '💾 Save'; btn.disabled = false; }
  }
};

// ── Grant / Revoke Edit ───────────────────────────────────
window.openGrantEdit = function (dayId, dayNum, currentGranted) {
  grantingDayId = dayId;
  grantingSprintId = detailSprintId;
  document.getElementById('grantDayLabel').textContent = `Day ${dayNum}`;

  const list = document.getElementById('grantEmpList');
  const sprint = allSprints.find(s => s._id === detailSprintId);
  const assignedIds = sprint ? sprint.assignedTo.map(e => typeof e === 'object' ? e._id : e) : [];
  const empPool = allEmployees.filter(e => assignedIds.includes(e._id));

  const hasAnyGranted = currentGranted && currentGranted.length > 0;

  if (!empPool.length) {
    list.innerHTML = `<p style="font-size:13px;color:var(--text-muted)">No employees assigned to this sprint yet. Assign employees first.</p>`;
  } else {
    list.innerHTML = `
      <div style="margin-bottom:15px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;color:var(--text-muted)">Select employees who can edit:</span>
        ${hasAnyGranted ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger);font-size:11px" onclick="revokeAllDayEdit()">🛑 Revoke All</button>` : ''}
      </div>
      ${empPool.map(emp => `
        <label class="emp-check-row">
          <input type="checkbox" class="grant-emp-check" value="${emp._id}" ${currentGranted.includes(emp._id) ? 'checked' : ''} />
          <div class="avatar" style="background:${emp.avatarColor};width:28px;height:28px;font-size:11px">${getInitials(emp.name)}</div>
          <div>
            <div style="font-size:13px;font-weight:600">${emp.name}</div>
            <div style="font-size:11px;color:var(--text-muted)">${emp.email}</div>
          </div>
        </label>
      `).join('')}
    `;
  }
  modal.open('grantEditModal');
};

window.revokeAllDayEdit = async function () {
  if (!confirm('Are you sure you want to revoke all edit permissions for this day?')) return;
  try {
    const { data } = await api.post(`/admin/sprints/${grantingSprintId}/days/${grantingDayId}/grant-edit`, { employeeIds: [] });
    toast.success('Edit permissions revoked');
    modal.close('grantEditModal');
    // Update local state
    const idx = detailDays.findIndex(d => d._id === grantingDayId);
    if (idx !== -1) detailDays[idx] = data;
    renderDetailTable();
  } catch (err) {
    toast.error(err.message);
  }
};

window.stopAllEditPermissions = async function () {
  if (!confirm('This will revoke ALL edit permissions for EVERY day in this sprint. Proceed?')) return;
  try {
    await api.post(`/admin/sprints/${detailSprintId}/grant-edit-all`, { employeeIds: [] });
    toast.success('All edit permissions stopped');
    await loadDetailDays(detailSprintId);
  } catch (err) {
    toast.error(err.message);
  }
}
window.saveGrantEdit = async function () {
  const selected = Array.from(document.querySelectorAll('.grant-emp-check:checked')).map(c => c.value);
  const btn = document.getElementById('grantSaveBtn');
  btn.textContent = '⏳'; btn.disabled = true;

  try {
    const { data } = await api.post(`/admin/sprints/${grantingSprintId}/days/${grantingDayId}/grant-edit`, { employeeIds: selected });
    toast.success('Permissions updated');
    modal.close('grantEditModal');
    // Update local state
    const idx = detailDays.findIndex(d => d._id === grantingDayId);
    if (idx !== -1) detailDays[idx] = data;
    renderDetailTable();
  } catch (err) {
    toast.error(err.message);
  } finally {
    btn.textContent = 'Save'; btn.disabled = false;
  }
};

// ── Edit / Delete / Assign ────────────────────────────────
window.editSprint = async function (id) {
  const sprint = allSprints.find(s => s._id === id);
  if (!sprint) return;
  editingSprintId = id;

  if (sprint.planType === 'detailed') {
    // Set modal to edit mode
    document.getElementById('detailedModalTitle').textContent = '✏️ Edit Detailed Sprint';
    document.getElementById('detailedModalSub').textContent = `Editing: ${sprint.name}`;
    document.getElementById('detailedSubmitBtn').textContent = '💾 Save Changes';

    document.getElementById('dSprintName').value = sprint.name;
    document.getElementById('dDesc').value = sprint.description || '';
    document.getElementById('dStartDate').value = sprint.startDate.slice(0, 10);
    document.getElementById('dEndDate').value = sprint.endDate.slice(0, 10);
    const totalDays = Math.round((new Date(sprint.endDate) - new Date(sprint.startDate)) / 86400000) + 1;
    document.getElementById('dTotalDays').value = totalDays;
    document.getElementById('pasteInput').value = '';

    // Load existing days and fill table
    try {
      const { data: days } = await api.get(`/admin/sprints/${id}/days`);
      editingDetailedDays = days;
      const initialData = days.map(d => ({
        module: d.module || '',
        tasks: d.tasks || '',
        plannedStatus: d.plannedStatus || 'pending',
        notes: d.notes || ''
      }));
      generatePlanTable(initialData);
    } catch (err) {
      toast.error('Failed to load sprint days');
      generatePlanTable();
    }

    modal.open('detailedModal');
  } else {
    // Quick sprint — open simple form
    document.getElementById('sprintModalTitle').textContent = 'Edit Sprint';
    document.getElementById('sprintSubmitBtn').textContent = 'Save Changes';
    document.getElementById('sprintId').value = id;
    document.getElementById('sprintName').value = sprint.name;
    document.getElementById('sprintDesc').value = sprint.description || '';
    document.getElementById('sprintStart').value = sprint.startDate.slice(0, 10);
    document.getElementById('sprintEnd').value = sprint.endDate.slice(0, 10);
    modal.open('sprintModal');
  }
};

window.deleteSprint = function (id, name) {
  deletingSprintId = id;
  document.getElementById('deleteSprintName').textContent = name;
  modal.open('deleteSprintModal');
};

window.openAssign = function (sprintId, sprintName, currentAssigned) {
  assigningSprintId = sprintId;
  document.getElementById('assignSprintName').textContent = sprintName;
  const list = document.getElementById('assignEmployeeList');
  list.innerHTML = allEmployees.map(emp => `
    <label style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--surface);border:1px solid var(--border);border-radius:8px;cursor:pointer">
      <input type="checkbox" class="assign-checkbox" value="${emp._id}" ${currentAssigned.includes(emp._id) ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--primary)" />
      <div class="avatar" style="background:${emp.avatarColor}">${getInitials(emp.name)}</div>
      <div>
        <div style="font-size:14px;font-weight:600">${emp.name}</div>
        <div style="font-size:12px;color:var(--text-muted)">${emp.email}</div>
      </div>
    </label>
  `).join('');
  modal.open('assignModal');
};

// ── Helpers ───────────────────────────────────────────────
