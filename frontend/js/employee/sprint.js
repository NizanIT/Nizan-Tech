// Employee Sprint JS — with Quick days + Detailed plan table
let currentUser = null;
let allSprints = [];
let activeDayId = null;
let activeSprintId = null;
// view mode per sprint: 'calendar' | 'plan'
const viewModes = {};

(async () => {
  initTheme();
  initSidebar('sprint');
  currentUser = await requireAuth('employee');
  if (!currentUser) return;
  setSidebarUser(currentUser);

  const socket = initSocket(currentUser.id, currentUser.role);
  socket.on('sprint:assigned', () => {
    toast.success('A new sprint was assigned to you!');
    loadSprints();
  });

  socket.on('extension:resolved', (data) => {
    if (data.status === 'approved') {
      toast.success(`🎉 Your extension (+${data.days} days) was APPROVED by an Admin! Timeline updated.`);
    } else {
      toast.error(`❌ Your deadline extension request was REJECTED by an Admin.`);
    }
    loadSprints();
  });

  socket.on('plan:change-resolved', (data) => {
    if (data.status === 'approved') {
      toast.success('🎉 Your plan change (Module/Tasks) was APPROVED by an Admin!');
    } else {
      toast.error('❌ Your plan change request was REJECTED by an Admin.');
    }
    loadSprints();
  });

  await loadSprints();
})();

async function loadSprints() {
  try {
    const { data } = await api.get('/employee/sprint');
    allSprints = data;
    renderSprints(data);
  } catch (err) {
    document.getElementById('sprintContainer').innerHTML = `
      <div class="empty-state"><div class="icon">🗂️</div><h3>No Sprint Assigned</h3><p>Your admin hasn't assigned a sprint yet. Check back soon!</p></div>`;
  }
}

function renderSprints(sprints) {
  const container = document.getElementById('sprintContainer');
  if (!sprints.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">🗂️</div><h3>No Sprint Assigned</h3><p>Your admin will assign a sprint soon.</p></div>`;
    return;
  }

  container.innerHTML = sprints.map(sprint => {
    const completedDays = sprint.completedDays || 0;
    const totalDays = sprint.totalDays || 0;
    const progress = totalDays ? Math.round((completedDays / totalDays) * 100) : 0;
    const isDetailed = sprint.planType === 'detailed';
    const mode = viewModes[sprint._id] || (isDetailed ? 'plan' : 'calendar');

    return `
      <div style="margin-bottom:40px" id="sprint-block-${sprint._id}">
        <div class="sprint-header animate-in">
          <div class="sprint-header-top">
            <div>
              <div class="sprint-name">
                ${sprint.name}
                ${isDetailed ? `<span style="font-size:11px;background:rgba(0,212,170,.15);color:#00D4AA;padding:2px 8px;border-radius:20px;font-weight:600;margin-left:8px">📋 Detailed Plan</span>` : ''}
              </div>
              <div class="sprint-dates">
                📅 ${dateUtils.formatDate(sprint.startDate)} → ${dateUtils.formatDate(sprint.endDate)}
                <button onclick="openExtensionModal('${sprint._id}', '${escHtml(sprint.name)}')" style="margin-left:12px; font-size:10px; padding:2px 8px; border-radius:12px; border:1px solid var(--border); background:var(--surface-2); color:var(--text-muted); cursor:pointer; transition:0.2s hover:background:var(--primary); hover:color:#fff; hover:border-color:var(--primary);">
                  ⏳ Request Extension
                </button>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              ${isDetailed ? `
                <div class="view-toggle">
                  <button id="vt-plan-${sprint._id}" class="${mode === 'plan' ? 'active' : ''}" onclick="setView('${sprint._id}', 'plan')">📋 Plan</button>
                  <button id="vt-cal-${sprint._id}" class="${mode === 'calendar' ? 'active' : ''}" onclick="setView('${sprint._id}', 'calendar')">📅 Calendar</button>
                </div>
              ` : ''}
              <span class="badge badge-${sprint.status}">${sprint.status}</span>
              <div style="text-align:right">
                <div style="font-size:22px;font-weight:800;color:var(--accent)">${sprint.totalHours}h</div>
                <div style="font-size:11px;color:var(--text-muted)">Total logged</div>
              </div>
            </div>
          </div>
          <div class="sprint-progress-label">
            <span>${completedDays} of ${totalDays} fully completed days</span>
            <span>${progress}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
        </div>

        <!-- Content section -->
        <div id="sprint-content-${sprint._id}">
          ${renderSprintContent(sprint, mode)}
        </div>
      </div>
    `;
  }).join('');
}

function renderSprintContent(sprint, mode) {
  if (mode === 'plan' && sprint.planType === 'detailed') {
    return renderPlanTable(sprint);
  }
  return renderCalendarDays(sprint);
}

// ── Calendar View ─────────────────────────────────────────
function renderCalendarDays(sprint) {
  return `
    <div class="days-grid">
      ${sprint.days.map(day => renderDayCard(day, sprint._id)).join('')}
    </div>
  `;
}

function renderDayCard(day, sprintId) {
  const today = dateUtils.isToday(day.date);
  const past = dateUtils.isPast(day.date);
  const classes = ['day-card', today ? 'today' : past ? 'past' : 'future', parseFloat(day.totalHours) > 0 ? 'has-blocks' : ''].join(' ');

  const hasModule = day.module && day.module.trim();
  const hasTasks = day.tasks && day.tasks.trim();

  return `
    <div class="${classes}" onclick="openDayModal('${day._id}', '${sprintId}', ${day.dayNumber}, '${day.date}')">
      <div class="day-number">Day ${day.dayNumber}</div>
      <div class="day-date">${dateUtils.getDayName(day.date)}, ${dateUtils.formatShort(day.date)}</div>
      ${hasModule ? `<div style="font-size:10px;color:var(--primary);font-weight:600;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${day.module}</div>` : ''}
      ${hasTasks ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">${day.tasks}</div>` : ''}
      ${parseFloat(day.totalHours) > 0
        ? `<div class="day-hours-chip">⏱️ ${day.totalHours}h</div>`
        : `<div class="day-hours-chip" style="background:rgba(136,136,170,0.1);color:var(--text-dim)">0h</div>`
      }
      ${day.blockCount > 0 ? `<div class="day-block-count">${day.blockCount} block${day.blockCount > 1 ? 's' : ''}</div>` : ''}
    </div>
  `;
}

// ── Plan Table View ───────────────────────────────────────
function renderPlanTable(sprint) {
  return `
    <div class="plan-section">
      <div class="plan-section-header">
        <div class="plan-section-title">📋 Day-by-Day Plan</div>
        <div style="font-size:12px;color:var(--text-muted)">${sprint.days.length} days · Click a row to log time</div>
      </div>
      <div class="plan-table-scroll">
        <table class="plan-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Date</th>
              <th>Module</th>
              <th>Tasks</th>
              <th>Status</th>
              <th>Notes</th>
              <th>⏱️ Logged</th>
            </tr>
          </thead>
          <tbody>
            ${sprint.days.map(day => {
              const isToday = day.isToday;
              const dateStr = new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
              const statusClass = `status-${day.plannedStatus || 'pending'}`;
              const statusLabel = { pending: '⏳ Pending', 'in-progress': '🔄 In Progress', done: '✅ Done' }[day.plannedStatus] || '⏳ Pending';
              const canEdit = day.canEdit;
              const hasPending = day.hasPendingChanges;

              if (canEdit) {
                // Editable row for permitted employee (Today OR Granted)
                const displayModule = hasPending ? (day.pendingModule || '') : (day.module || '');
                const displayTasks = hasPending ? (day.pendingTasks || '') : (day.tasks || '');

                return `
                  <tr class="${isToday ? 'today-row' : ''} ${hasPending ? 'row-pending' : ''}" title="${hasPending ? 'Plan change is waiting for Admin approval' : 'Click 💾 to save changes'}">
                    <td class="day-col">
                      Day ${day.dayNumber}
                      ${isToday ? '<span class="today-badge">TODAY</span>' : ''}
                      ${hasPending ? '<div class="pending-badge">⏳ Pending Review</div>' : ''}
                    </td>
                    <td class="date-col">${dateStr}</td>
                    <td class="edit-cell">
                      <input id="em-${day._id}" type="text" value="${escHtml(displayModule)}" placeholder="Module…" oninput="markRowDirty('${day._id}')" />
                    </td>
                    <td class="edit-cell">
                      <textarea id="et-${day._id}" rows="2" placeholder="Tasks…" oninput="markRowDirty('${day._id}')">${escHtml(displayTasks)}</textarea>
                    </td>
                    <td class="edit-cell">
                      <select id="es-${day._id}" onchange="markRowDirty('${day._id}')">
                        <option value="pending" ${day.plannedStatus === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                        <option value="in-progress" ${day.plannedStatus === 'in-progress' ? 'selected' : ''}>🔄 In Progress</option>
                        <option value="done" ${day.plannedStatus === 'done' ? 'selected' : ''}>✅ Done</option>
                      </select>
                      <button class="save-row-btn" id="srow-${day._id}" onclick="saveRow('${day._id}', '${sprint._id}')">💾 Save</button>
                    </td>
                    <td class="edit-cell">
                      <input id="en-${day._id}" type="text" value="${escHtml(day.notes || '')}" placeholder="Notes…" oninput="markRowDirty('${day._id}')" />
                      ${!isToday ? '<span class="edit-granted-badge" style="margin-top:4px;display:inline-block">🔓 Edit Granted</span>' : '<span class="edit-granted-badge active" style="margin-top:4px;display:inline-block">⚡ Active Day</span>'}
                    </td>
                    <td>
                      <div style="font-weight:700;color:var(--accent)">${day.totalHours}h</div>
                      <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px;margin-top:4px" onclick="openDayModal('${day._id}', '${sprint._id}', ${day.dayNumber}, '${day.date}')">⏱️ Log</button>
                    </td>
                  </tr>
                `;
              } else {
                // Read-only row
                return `
                  <tr class="${isToday ? 'today-row' : ''}">
                    <td class="day-col">
                      Day ${day.dayNumber}
                      ${isToday ? '<span class="today-badge">TODAY</span>' : ''}
                    </td>
                    <td class="date-col">${dateStr}</td>
                    <td class="module-col">${escHtml(day.module || '—')}</td>
                    <td class="tasks-col">${escHtml(day.tasks || '—')}</td>
                    <td><span class="status-chip ${statusClass}">${statusLabel}</span></td>
                    <td class="notes-col">${escHtml(day.notes || '—')}</td>
                    <td>
                      <div style="font-weight:700;color:var(--accent)">${day.totalHours}h</div>
                      <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px;margin-top:4px" onclick="openDayModal('${day._id}', '${sprint._id}', ${day.dayNumber}, '${day.date}')">⏱️ Log</button>
                    </td>
                  </tr>
                `;
              }
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── View Toggle ───────────────────────────────────────────
window.setView = function (sprintId, mode) {
  viewModes[sprintId] = mode;
  const sprint = allSprints.find(s => s._id === sprintId);
  if (!sprint) return;

  // Update toggle buttons
  const planBtn = document.getElementById(`vt-plan-${sprintId}`);
  const calBtn = document.getElementById(`vt-cal-${sprintId}`);
  if (planBtn) planBtn.classList.toggle('active', mode === 'plan');
  if (calBtn) calBtn.classList.toggle('active', mode === 'calendar');

  // Re-render content
  const content = document.getElementById(`sprint-content-${sprintId}`);
  if (content) content.innerHTML = renderSprintContent(sprint, mode);
};

// ── Employee Row Save ─────────────────────────────────────
window.markRowDirty = function (dayId) {
  const btn = document.getElementById(`srow-${dayId}`);
  if (btn) btn.classList.add('visible');
};

window.saveRow = async function (dayId, sprintId) {
  const btn = document.getElementById(`srow-${dayId}`);
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
  try {
    await api.put(`/employee/days/${dayId}`, {
      module: document.getElementById(`em-${dayId}`)?.value || '',
      tasks: document.getElementById(`et-${dayId}`)?.value || '',
      plannedStatus: document.getElementById(`es-${dayId}`)?.value || 'pending',
      notes: document.getElementById(`en-${dayId}`)?.value || ''
    });
    toast.success('Day updated!');
    if (btn) { btn.classList.remove('visible'); btn.textContent = '💾 Save'; btn.disabled = false; }
    // Refresh sprint data in background to sync
    const { data } = await api.get('/employee/sprint');
    allSprints = data;
    const sprint = allSprints.find(s => s._id === sprintId);
    if (sprint) {
      const content = document.getElementById(`sprint-content-${sprintId}`);
      if (content) content.innerHTML = renderSprintContent(sprint, viewModes[sprintId] || 'plan');
    }
  } catch (err) {
    toast.error(err.message);
    if (btn) { btn.textContent = '💾 Save'; btn.disabled = false; }
  }
};

// ── Day Modal ─────────────────────────────────────────────
function openDayModal(dayId, sprintId, dayNumber, date) {
  activeDayId = dayId;
  activeSprintId = sprintId;
  document.getElementById('dayModalTitle').textContent = `Day ${dayNumber}`;
  document.getElementById('dayModalDate').textContent = `${dateUtils.getDayName(date)}, ${dateUtils.formatDate(date)}`;
  
  // Inject Assigned Tasks / Agenda directly into the Modal
  const sprint = allSprints.find(s => s._id === sprintId);
  const dayData = sprint?.days?.find(d => d._id === dayId);
  const agendaEl = document.getElementById('dayModalAgenda');
  const agendaContent = document.getElementById('dayModalAgendaContent');
  
  let assignedText = '';
  if (dayData) {
    if (dayData.module) assignedText += `<div style="margin-bottom:4px;"><b>Module:</b> ${escHtml(dayData.module)}</div>`;
    if (dayData.tasks) assignedText += `<div style="margin-bottom:4px;"><b>Tasks:</b> ${escHtml(dayData.tasks).replace(/\n/g, '<br>')}</div>`;
    if (dayData.notes) assignedText += `<div style="margin-top:8px; font-size:11px; opacity:0.8;"><i>Notes: ${escHtml(dayData.notes)}</i></div>`;
  }
  
  if (assignedText.trim()) {
    agendaContent.innerHTML = assignedText;
    agendaEl.style.display = 'block';
  } else {
    agendaContent.innerHTML = '';
    agendaEl.style.display = 'none';
  }

  document.getElementById('addBlockForm').style.display = 'none';
  document.getElementById('showAddBlockBtn').style.display = 'flex';
  modal.open('dayModal');
  loadDayBlocks(dayId);
}

// ─── EXTENSION REQUEST MODAL ──────────────────────────────
window.openExtensionModal = function(sprintId, sprintName) {
  const sprint = allSprints.find(s => s._id === sprintId);
  if (!sprint || !sprint.days) return toast.error('Sprint information could not be loaded.');

  // Lazily inject modal into DOM if it doesn't exist
  if (!document.getElementById('extensionModal')) {
    const modalHtml = `
      <div id="extensionModal" class="modal-overlay">
        <div class="modal" style="max-width: 440px;">
          <div class="modal-header">
            <div class="modal-title">⏳ Request Deadline Extension</div>
            <button class="modal-close" onclick="modal.close('extensionModal')">✕</button>
          </div>
          <p style="color:var(--text-muted); font-size:13px; margin-bottom:24px;">Admins must approve extension requests. Time will be added mathematically, skipping Sundays. Your planned work will cascade forward automatically.</p>
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label">Sprint Name</label>
            <input type="text" id="extSprintName" disabled class="form-input" style="background:var(--surface-2); color:var(--text-dim);">
          </div>
          <div class="form-row" style="margin-bottom:16px;">
            <div class="form-group">
              <label class="form-label">Delayed On Day <span style="color:var(--danger)">*</span></label>
              <select id="extDelayedDay" class="form-input" required></select>
            </div>
            <div class="form-group">
              <label class="form-label">Extra Days Needed <span style="color:var(--danger)">*</span></label>
              <input type="number" id="extDays" min="1" max="10" placeholder="1" class="form-input" required>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:24px;">
            <label class="form-label">Reason for Delay <span style="color:var(--danger)">*</span></label>
            <textarea id="extReason" class="form-input" placeholder="E.g., Sick on Tuesday, or Waiting for assets" rows="3" required></textarea>
          </div>
          <input type="hidden" id="extSprintId">
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="modal.close('extensionModal')">Cancel</button>
            <button class="btn btn-primary" onclick="submitExtensionRequest()">Submit Request</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  const daySelect = document.getElementById('extDelayedDay');
  daySelect.innerHTML = '';
  let autoSelected = false;
  
  sprint.days.forEach(day => {
    const option = document.createElement('option');
    option.value = day.dayNumber;
    option.textContent = `Day ${day.dayNumber} (${dateUtils.formatDate(day.date)})`;
    
    if (day.isToday) {
      option.selected = true;
      option.textContent += ' [TODAY]';
      autoSelected = true;
    }
    daySelect.appendChild(option);
  });

  document.getElementById('extSprintId').value = sprintId;
  document.getElementById('extSprintName').value = sprintName;
  document.getElementById('extDays').value = 1;
  document.getElementById('extReason').value = '';
  modal.open('extensionModal');
};

window.submitExtensionRequest = async function() {
  const sprintId = document.getElementById('extSprintId').value;
  const requestedDays = parseInt(document.getElementById('extDays').value);
  const delayedDayNumber = parseInt(document.getElementById('extDelayedDay').value);
  const reason = document.getElementById('extReason').value.trim();

  if (!requestedDays || requestedDays < 1) return toast.error('Please request at least 1 day.');
  if (isNaN(delayedDayNumber) || delayedDayNumber < 1) return toast.error('Please select the day you were delayed on.');
  if (reason.length < 5) return toast.error('Please provide a valid reason.');

  try {
    const res = await api.post(`/employee/sprint/${sprintId}/extension`, { requestedDays, delayedDayNumber, reason });
    toast.success('Your cascading extension request has been securely submitted to the Admins.');
    modal.close('extensionModal');
  } catch (err) {
    if (err.message && err.message.includes('pending')) {
      toast.error('You already have a pending extension request for this sprint.');
    } else {
      toast.error(err.message || 'Failed to request extension.');
    }
  }
};

// ── Helpers ───────────────────────────────────────────────
