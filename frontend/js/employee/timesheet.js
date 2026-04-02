// Employee Timesheet JS
let allData = [];
let filteredData = [];

(async () => {
  initTheme();
  initSidebar('timesheet');
  const user = await requireAuth('employee');
  if (!user) return;
  setSidebarUser(user);
  await loadTimesheet();

  // Search
  document.getElementById('searchDesc').addEventListener('input', applyFilters);
  document.getElementById('filterSprintTs').addEventListener('change', applyFilters);
  document.getElementById('resetTsFilters').addEventListener('click', () => {
    document.getElementById('searchDesc').value = '';
    document.getElementById('filterSprintTs').value = '';
    applyFilters();
  });
})();

async function loadTimesheet() {
  try {
    const { data: sprints } = await api.get('/employee/sprint');

    // Populate sprint filter
    const sel = document.getElementById('filterSprintTs');
    sprints.forEach(s => {
      sel.innerHTML += `<option value="${s._id}">${s.name}</option>`;
    });

    // Flatten all data
    allData = [];
    for (const sprint of sprints) {
      for (const day of sprint.days) {
        const { data: blocks } = await api.get(`/timeblock/${day._id}`);
        blocks.forEach(b => {
          allData.push({ ...b, day, sprint: { _id: sprint._id, name: sprint.name } });
        });
      }
    }

    filteredData = [...allData];
    renderTimesheet(filteredData);
    renderSummary(filteredData);
  } catch (err) {
    toast.error('Failed to load timesheet');
  }
}

function applyFilters() {
  const q = document.getElementById('searchDesc').value.toLowerCase();
  const sprintId = document.getElementById('filterSprintTs').value;

  filteredData = allData.filter(item => {
    const matchDesc = !q || item.description.toLowerCase().includes(q);
    const matchSprint = !sprintId || item.sprint._id === sprintId;
    return matchDesc && matchSprint;
  });

  renderTimesheet(filteredData);
  renderSummary(filteredData);
}

function renderTimesheet(data) {
  const tbody = document.getElementById('timesheetTbody');
  const footer = document.getElementById('tsFooterTotal');

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="icon">📋</div><h3>No entries found</h3><p>Try adjusting your filters</p></div></td></tr>`;
    footer.textContent = '0h';
    return;
  }

  // Sort by date then start time
  const sorted = [...data].sort((a, b) => {
    const dA = new Date(a.day.date) - new Date(b.day.date);
    return dA !== 0 ? dA : a.startTime.localeCompare(b.startTime);
  });

  tbody.innerHTML = sorted.map((item, i) => {
    const dur = time.formatDuration(item.startTime, item.endTime);
    const isToday = dateUtils.isToday(item.day.date);
    return `
      <tr style="${isToday ? 'background:rgba(108,99,255,0.04)' : ''}">
        <td style="font-weight:700">Day ${item.day.dayNumber}</td>
        <td style="color:var(--text-muted);font-size:13px">
          ${dateUtils.getDayName(item.day.date)}, ${dateUtils.formatShort(item.day.date)}
          ${isToday ? '<span class="badge badge-active" style="margin-left:6px;font-size:9px">Today</span>' : ''}
        </td>
        <td style="font-size:13px;color:var(--text-muted)">${item.sprint.name}</td>
        <td style="font-weight:700;color:var(--primary-light);font-size:13px">${time.to12h(item.startTime)} – ${time.to12h(item.endTime)}</td>
        <td style="font-size:13px">${item.description}</td>
        <td><span class="badge badge-active">${dur}</span></td>
      </tr>
    `;
  }).join('');

  // Footer total
  const totalMins = data.reduce((acc, b) => {
    const [sh, sm] = b.startTime.split(':').map(Number);
    const [eh, em] = b.endTime.split(':').map(Number);
    return acc + (eh * 60 + em) - (sh * 60 + sm);
  }, 0);
  footer.textContent = `${(totalMins / 60).toFixed(1)}h`;
}

function renderSummary(data) {
  const totalMins = data.reduce((acc, b) => {
    const [sh, sm] = b.startTime.split(':').map(Number);
    const [eh, em] = b.endTime.split(':').map(Number);
    return acc + (eh * 60 + em) - (sh * 60 + sm);
  }, 0);

  const uniqueDays = new Set(data.map(b => b.day._id)).size;

  document.getElementById('tsTotalHours').textContent = `${(totalMins / 60).toFixed(1)}h`;
  document.getElementById('tsDaysLogged').textContent = uniqueDays;
  document.getElementById('tsTotalBlocks').textContent = data.length;
}
