(async () => {
  initTheme();
  initSidebar('analytics');
  
  const user = await requireAuth('admin');
  if (!user) return;
  setSidebarUser(user);

  loadGlobalAnalytics();
})();

let analyticsChartInstance = null;
let currentAnalyticsData = { sprints: [], employees: [], blocks: [] };
let currentAnalyticsGroup = 'day'; // day, week, month

async function loadGlobalAnalytics() {
  try {
    const { data } = await api.get('/admin/analytics');
    currentAnalyticsData = data;
    
    // Populate Filters
    const sprintSelect = document.getElementById('analyticsSprintFilter');
    sprintSelect.innerHTML = '<option value="all">All Sprints</option>' + 
      data.sprints.map(s => `<option value="${s._id}">${s.name}</option>`).join('');

    const empSelect = document.getElementById('analyticsEmpFilter');
    empSelect.innerHTML = '<option value="all">All Employees</option>' + 
      data.employees.map(e => `<option value="${e._id}">${e.name}</option>`).join('');

    // Attach listeners
    sprintSelect.addEventListener('change', renderAnalyticsChart);
    empSelect.addEventListener('change', renderAnalyticsChart);

    // Initial render
    setAnalyticsGroup('day', false);
    renderAnalyticsChart();

  } catch (err) {
    toast.error('Failed to load global analytics: ' + err.message);
  }
}

window.setAnalyticsGroup = function (groupType, reRender = true) {
  currentAnalyticsGroup = groupType;
  document.getElementById('btnGroupDay').classList.replace('btn-primary', 'btn-ghost');
  document.getElementById('btnGroupWeek').classList.replace('btn-primary', 'btn-ghost');
  document.getElementById('btnGroupMonth').classList.replace('btn-primary', 'btn-ghost');
  
  if (groupType === 'day') {
    document.getElementById('btnGroupDay').classList.replace('btn-ghost', 'btn-primary');
  } else if (groupType === 'week') {
    document.getElementById('btnGroupWeek').classList.replace('btn-ghost', 'btn-primary');
  } else if (groupType === 'month') {
    document.getElementById('btnGroupMonth').classList.replace('btn-ghost', 'btn-primary');
  }
  
  if (reRender) renderAnalyticsChart();
};

function renderAnalyticsChart() {
  const sprintId = document.getElementById('analyticsSprintFilter').value;
  const empId = document.getElementById('analyticsEmpFilter').value;
  
  let blocks = currentAnalyticsData.blocks;
  
  if (sprintId !== 'all') {
    blocks = blocks.filter(b => b.sprintId && b.sprintId._id === sprintId);
  }
  if (empId !== 'all') {
    blocks = blocks.filter(b => b.userId && b.userId._id === empId);
  }

  const agg = {};
  const getWeek = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return `W${Math.ceil((((d - yearStart) / 86400000) + 1)/7)} ${d.getUTCFullYear()}`;
  };

  // Sort chronologically before grouping to preserve order
  blocks.sort((a, b) => {
    if (!a.dayId || !b.dayId) return 0;
    return new Date(a.dayId.date) - new Date(b.dayId.date);
  });

  let totalHrsInt = 0;
  let totalTasksInt = 0;

  blocks.forEach(b => {
    if (!b.dayId || !b.dayId.date) return;
    const dateObj = new Date(b.dayId.date);
    let key = '';
    
    if (currentAnalyticsGroup === 'day') {
      key = dateUtils.formatShort(dateObj);
    } else if (currentAnalyticsGroup === 'week') {
      key = getWeek(dateObj);
    } else if (currentAnalyticsGroup === 'month') {
      const ms = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      key = `${ms[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
    }
    
    if (!agg[key]) agg[key] = { hrs: 0, tasks: 0 };
    
    if (b.isLeave) return;
    
    if (b.startTime && b.endTime) {
      const [sh, sm] = b.startTime.split(':').map(Number);
      const [eh, em] = b.endTime.split(':').map(Number);
      const hrs = (eh * 60 + em - (sh * 60 + sm)) / 60;
      agg[key].hrs += hrs;
      totalHrsInt += hrs;
    }
    if (b.completed) {
      agg[key].tasks += 1;
      totalTasksInt += 1;
    }
  });

  document.getElementById('statGlobalHours').textContent = totalHrsInt.toFixed(1) + 'h';
  document.getElementById('statGlobalTasks').textContent = totalTasksInt;

  const labels = Object.keys(agg);
  const dataHrs = labels.map(l => Number(agg[l].hrs.toFixed(1)));
  const dataTasks = labels.map(l => agg[l].tasks);

  if (analyticsChartInstance) {
    analyticsChartInstance.destroy();
  }

  const ctx = document.getElementById('analyticsChart').getContext('2d');
  
  if (typeof Chart === 'undefined') {
    toast.error('Chart.js failed to load');
    return;
  }
  
  Chart.defaults.color = '#a0a0b0';

  const gradientHours = ctx.createLinearGradient(0, 0, 0, 400);
  gradientHours.addColorStop(0, 'rgba(0, 212, 170, 0.85)');
  gradientHours.addColorStop(1, 'rgba(0, 212, 170, 0.1)');

  const gradientTasks = ctx.createLinearGradient(0, 0, 0, 400);
  gradientTasks.addColorStop(0, 'rgba(108, 99, 255, 0.85)');
  gradientTasks.addColorStop(1, 'rgba(108, 99, 255, 0.1)');

  analyticsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['No Data in Selected Range'],
      datasets: [
        {
          label: 'Hours Logged',
          data: dataHrs.length ? dataHrs : [0],
          backgroundColor: gradientHours,
          borderColor: '#00D4AA',
          borderWidth: 1,
          borderRadius: 6,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Tasks Completed',
          data: dataTasks.length ? dataTasks : [0],
          backgroundColor: gradientTasks,
          borderColor: '#6C63FF',
          borderWidth: 3,
          pointBackgroundColor: '#6C63FF',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 800,
        easing: 'easeOutQuart'
      },
      interaction: { 
        mode: 'index', 
        intersect: false 
      },
      plugins: {
        tooltip: {
          backgroundColor: 'rgba(20,20,30,0.9)',
          titleColor: '#fff',
          bodyColor: '#e0e0e0',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          boxPadding: 4,
          usePointStyle: true
        }
      },
      scales: {
        y: {
          type: 'linear', display: true, position: 'left',
          title: { display: true, text: 'Hours Logged' },
          grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
          beginAtZero: true
        },
        y1: {
          type: 'linear', display: true, position: 'right',
          title: { display: true, text: 'Tasks Completed' },
          grid: { drawOnChartArea: false },
          beginAtZero: true
        },
        x: { 
          grid: { display: false } 
        }
      }
    }
  });

  renderDetailedSprintView(sprintId, empId);
}

function renderDetailedSprintView(sprintId, empId) {
  const container = document.getElementById('detailedSprintContainer');
  
  if (sprintId === 'all') {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  
  // Find the selected sprint details
  const sprint = currentAnalyticsData.sprints.find(s => s._id === sprintId);
  const sprintDays = currentAnalyticsData.days.filter(d => d.sprintId === sprintId);
  
  // Find the blocks for this sprint (filtered by empId if provided)
  let sprintBlocks = currentAnalyticsData.blocks.filter(b => b.sprintId && b.sprintId._id === sprintId);
  if (empId !== 'all') {
    sprintBlocks = sprintBlocks.filter(b => b.userId && b.userId._id === empId);
  }
  
  // Calculate completed days correctly using fully completed logic
  const totalDays = sprintDays.length;
  let completedDays = 0;
  let totalHours = 0;
  
  sprintDays.forEach(day => {
    const dayBlocks = sprintBlocks.filter(b => b.dayId && b.dayId._id === day._id);
    if (dayBlocks.length > 0) {
      // Calculate hours
      dayBlocks.forEach(b => {
        if (b.startTime && b.endTime) {
          const [sh, sm] = b.startTime.split(':').map(Number);
          const [eh, em] = b.endTime.split(':').map(Number);
          totalHours += (eh * 60 + em - (sh * 60 + sm)) / 60;
        }
      });
      // Check if fully completed
      if (dayBlocks.every(b => b.completed === true)) {
        completedDays++;
      }
    }
  });
  
  const progressPct = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
  
  // Update Header UI
  document.getElementById('dsTitle').innerHTML = `${escHtml(sprint.name)} <span style="font-size:11px;background:rgba(108,99,255,.15);color:#6C63FF;padding:2px 8px;border-radius:20px;font-weight:600;margin-left:8px;vertical-align:middle;">${sprint.planType === 'detailed' ? '📋 Detailed Plan' : '⚡ Quick Plan'}</span>`;
  document.getElementById('dsDates').textContent = `📅 ${dateUtils.formatDate(sprint.startDate)} → ${dateUtils.formatDate(sprint.endDate)}`;
  document.getElementById('dsHours').textContent = `${totalHours.toFixed(1)}h`;
  document.getElementById('dsProgressText').textContent = `${completedDays} of ${totalDays} fully completed days`;
  document.getElementById('dsProgressPct').textContent = `${progressPct}%`;
  document.getElementById('dsProgressFill').style.width = `${progressPct}%`;
  
  // Render Grid
  const grid = document.getElementById('dsDaysGrid');
  grid.innerHTML = sprintDays.map(day => {
    const dBlocks = sprintBlocks.filter(b => b.dayId && b.dayId._id === day._id);
    const hLogged = dBlocks.reduce((acc, b) => {
      if (b.isLeave) return acc;
      const [sh, sm] = b.startTime.split(':').map(Number);
      const [eh, em] = b.endTime.split(':').map(Number);
      return acc + (eh * 60 + em - (sh * 60 + sm)) / 60;
    }, 0);
    
    // Day Context Logic (Past / Present / Future)
    const dayClasses = ['day-card'];
    if (dateUtils.isToday(day.date)) dayClasses.push('today');
    else if (dateUtils.isPast(day.date)) dayClasses.push('past');
    else if (dateUtils.isFuture(day.date)) dayClasses.push('future');

    // Aggregating Block Specs
    const totalBlocks = dBlocks.length;
    const completedBlocks = dBlocks.filter(b => b.completed).length;
    const completionPct = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;
    
    // Setting Status Theme
    let badgeClass = 'badge-notstarted';
    let badgeText = 'Not Started';
    if (totalBlocks > 0) {
      if (completedBlocks === totalBlocks) {
        badgeClass = 'badge-completed';
        badgeText = 'Completed';
      } else if (completedBlocks > 0 || hLogged > 0) {
        badgeClass = 'badge-inprogress';
        badgeText = 'In Progress';
      }
    }

    return `
      <div class="${dayClasses.join(' ')}" onclick="openDayDetailsModal('${day._id}', '${sprintId}', '${empId}')">
        <div class="day-title">Day ${day.dayNumber}</div>
        <div class="day-date">${dateUtils.getDayName(day.date)}, ${dateUtils.formatShort(day.date)}</div>
        <div class="day-tasks">
          ${day.agenda ? `<div class="day-task" style="margin-bottom:12px; font-weight:600; color:var(--text);">${escHtml(day.agenda)}</div>` : ''}
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span>Tasks Progress</span>
              <span style="font-weight:700;">${completedBlocks} / ${totalBlocks}</span>
            </div>
            <div class="mini-progress" style="width:100%;"><div class="mini-progress-fill" style="width:${completionPct}%; background:${completionPct === 100 ? '#00D4AA' : 'var(--primary)'}"></div></div>
          </div>
          <div><span class="badge-status ${badgeClass}">${badgeText}</span></div>
        </div>
        <div class="day-stats">
          ${hLogged > 0 ? `<div class="hr-badge">⏱ ${hLogged.toFixed(1)}h</div>` : '<div style="font-size:11px;color:var(--text-dim)">0h</div>'}
          <div class="block-count">${completionPct}% done</div>
        </div>
      </div>
    `;
  }).join('');
}

window.openDayDetailsModal = function(dayId, sprintId, empId) {
  const day = currentAnalyticsData.days.find(d => d._id === dayId);
  const sprint = currentAnalyticsData.sprints.find(s => s._id === sprintId);
  if (!day || !sprint) return;

  // Set modal headers
  document.getElementById('ddTitle').textContent = `Day ${day.dayNumber} Breakdown`;
  document.getElementById('ddSubtitle').textContent = `${dateUtils.getDayName(day.date)}, ${dateUtils.formatDate(day.date)} • ${sprint.name}`;

  // Filter blocks for this day
  let dayBlocks = currentAnalyticsData.blocks.filter(b => b.dayId && b.dayId._id === dayId && b.sprintId && b.sprintId._id === sprintId);

  // Re-calculate totals
  const totalTasks = dayBlocks.length;
  const totalCompleted = dayBlocks.filter(b => b.completed).length;
  let totalHours = 0;
      dayBlocks.forEach(b => {
        if (b.isLeave) return;
        if (b.startTime && b.endTime) {
          const [sh, sm] = b.startTime.split(':').map(Number);
          const [eh, em] = b.endTime.split(':').map(Number);
          totalHours += (eh * 60 + em - (sh * 60 + sm)) / 60;
        }
      });

  document.getElementById('ddTotalHours').textContent = totalHours.toFixed(1) + 'h';
  document.getElementById('ddTotalTasks').textContent = `${totalCompleted} / ${totalTasks}`;

  // Employee Matrix
  let employeesToRender = sprint.assignedTo;
  if (empId !== 'all') {
    // If the empId filter is active, only show that employee
    const filteredEmp = currentAnalyticsData.employees.find(e => e._id === empId);
    if(filteredEmp) {
      employeesToRender = [filteredEmp];
    }
  }

  const tbody = document.getElementById('ddEmployeeTable');
  
  if (!employeesToRender || employeesToRender.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted);">No employees assigned to view.</td></tr>`;
  } else {
    tbody.innerHTML = employeesToRender.map(emp => {
      // Find blocks strictly for this given employee on this given day
      const eBlocks = dayBlocks.filter(b => b.userId && b.userId._id === emp._id);
      
      const eTotalTasks = eBlocks.length;
      const eCompleted = eBlocks.filter(b => b.completed).length;
      const eCompletionPct = eTotalTasks > 0 ? Math.round((eCompleted / eTotalTasks) * 100) : 0;
      
      let eHours = 0;
      eBlocks.forEach(b => {
        if (b.isLeave) return;
        if (b.startTime && b.endTime) {
          const [sh, sm] = b.startTime.split(':').map(Number);
          const [eh, em] = b.endTime.split(':').map(Number);
          eHours += (eh * 60 + em - (sh * 60 + sm)) / 60;
        }
      });

      const isLeave = eBlocks.some(b => b.isLeave);

      let badgeClass = 'badge-notstarted';
      let badgeText = 'Not Started';
      if (isLeave) {
        badgeClass = ''; // custom styling below
        badgeText = 'ON LEAVE 🌴';
      } else if (eTotalTasks > 0) {
        if (eCompleted === eTotalTasks) { badgeClass = 'badge-completed'; badgeText = 'Completed'; }
        else if (eCompleted > 0 || eHours > 0) { badgeClass = 'badge-inprogress'; badgeText = 'In Progress'; }
      }

      return `
        <tr class="emp-table-row" style="border-bottom: ${(eBlocks.length > 0 && !isLeave) ? 'none' : '1px solid var(--border-transparent)'};">
          <td style="display:flex; align-items:center; gap:12px;">
            <div class="avatar sm" style="background:${emp.avatarColor || '#6C63FF'}">${emp.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>
            <div>
              <div style="font-weight:600; color:var(--text);">${escHtml(emp.name)}</div>
              <div style="font-size:11px; color:var(--text-dim);">${escHtml(emp.email)}</div>
            </div>
          </td>
          <td>${isLeave ? '-' : `<span style="font-weight:700;">${eTotalTasks}</span> blocks`}</td>
          <td>${isLeave ? '-' : `<span style="font-weight:700; color:var(--primary);">${eCompleted}</span> done`}</td>
          <td>${isLeave ? '-' : `<span style="font-weight:700; color:var(--text);">${eHours.toFixed(1)}</span> h`}</td>
          <td>
            <div style="display:flex; align-items:center; justify-content:space-between; width: 150px;">
              ${isLeave 
                ? `<span class="badge-status" style="background:rgba(234,179,8,0.15); color:#EAB308; border:1px solid rgba(234,179,8,0.3); zoom: 0.9;">ON LEAVE 🌴</span>`
                : `<span class="badge-status ${badgeClass}" style="zoom: 0.9;">${badgeText}</span><span style="font-size:11px; font-weight:700;">${eCompletionPct}%</span>`
              }
            </div>
            ${!isLeave ? `<div class="mini-progress" style="width:140px; margin-top:4px;"><div class="mini-progress-fill" style="width:${eCompletionPct}%; background:${eCompletionPct === 100 ? '#00D4AA' : 'var(--primary)'}"></div></div>` : ''}
            <div style="margin-top:8px;">
              <button onclick="toggleAdminLeaveStatus('${emp._id}', '${sprintId}', '${dayId}')" style="background:var(--surface-2); border:1px solid var(--border-light); padding:3px 8px; border-radius:4px; font-size:10px; cursor:pointer; color:var(--text-muted); transition:0.2s hover:background:var(--surface);">
                ${isLeave ? 'Revoke Leave' : 'Mark as On Leave'}
              </button>
            </div>
          </td>
        </tr>
        ${(eBlocks.length > 0 && !isLeave) ? `
        <tr style="background: rgba(0,0,0,0.1); border-bottom: 1px solid var(--border-transparent);">
          <td colspan="5" style="padding: 16px 20px 24px 48px;">
            <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; display:flex; align-items:center; gap:6px;">
              <span>Detailed Time Logs</span>
              <div style="height:1px; flex:1; background:var(--border-transparent);"></div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:12px;">
              ${eBlocks.filter(b => b.startTime && b.endTime).sort((a,b) => time.toMinutes(a.startTime) - time.toMinutes(b.startTime)).map(b => {
                 const hrs = ((time.toMinutes(b.endTime) - time.toMinutes(b.startTime)) / 60).toFixed(1);
                 return `<div style="background:var(--surface); border:1px solid ${b.completed?'rgba(0,212,170,0.3)':'var(--border)'}; border-radius:8px; padding:12px; min-width:240px; max-width:300px; flex:1; transition:all 0.2s; box-shadow:var(--shadow-sm);">
                   <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                      <span style="background:var(--surface-2); padding:2px 6px; border-radius:4px; font-weight:600;"><span style="opacity:0.6">⏱</span> ${time.to12h(b.startTime)} - ${time.to12h(b.endTime)}</span>
                      <span style="font-weight:700; color:var(--primary);">${hrs}h</span>
                   </div>
                   <div style="font-weight:600; font-size:13px; color:${b.completed?'#00D4AA':'var(--text)'}; display:flex; align-items:center; gap:6px;">
                      ${b.completed ? '✔️' : '⏳'} ${escHtml(b.taskName || 'Timeblock')}
                   </div>
                   ${b.description ? '<div style="font-size:11px; color:var(--text-dim); margin-top:8px; line-height:1.4;">' + escHtml(b.description) + '</div>' : ''}
                 </div>`;
              }).join('')}
            </div>
          </td>
        </tr>
        ` : ''}
      `;
    }).join('');
  }

  modal.open('dayDetailsModal');
};

window.toggleAdminLeaveStatus = async function(userId, sprintId, dayId) {
  try {
    const res = await api.post('/admin/timeblock/leave', { userId, sprintId, dayId });
    if (res.isLeave) {
      toast.success('Employee marked as ON LEAVE for this day.');
    } else {
      toast.success('Leave status revoked.');
    }
    // Refresh modal
    loadAnalyticsData(document.getElementById('analyticsSprintFilter').value, document.getElementById('analyticsEmpFilter').value, true);
    setTimeout(() => {
      window.openDayDetailsModal(dayId, sprintId, document.getElementById('analyticsEmpFilter').value);
    }, 300);
  } catch (err) {
    toast.error('Failed to update leave status');
  }
};
