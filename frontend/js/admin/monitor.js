// Admin Monitor JS
let allBlocks = [];

(async () => {
  initTheme();
  initSidebar('monitor');
  const user = await requireAuth('admin');
  if (!user) return;
  setSidebarUser(user);

  // Populate filter dropdowns
  try {
    const [sprintsRes, empsRes] = await Promise.all([api.get('/admin/sprints'), api.get('/admin/employees')]);
    const sprintSel = document.getElementById('filterSprint');
    const empSel = document.getElementById('filterEmployee');

    sprintsRes.data.forEach(s => {
      sprintSel.innerHTML += `<option value="${s._id}">${s.name}</option>`;
    });
    empsRes.data.forEach(e => {
      empSel.innerHTML += `<option value="${e._id}">${e.name}</option>`;
    });
  } catch {}

  await loadMonitor();

  document.getElementById('applyFilters').addEventListener('click', loadMonitor);
  document.getElementById('resetFilters').addEventListener('click', () => {
    document.getElementById('filterSprint').value = '';
    document.getElementById('filterEmployee').value = '';
    loadMonitor();
  });

  // Socket.IO live updates
  const socket = initSocket(user.id, user.role);

  socket.on('timeblock:created', ({ block }) => {
    toast.info(`🆕 ${block.userName} added a time block`);
    loadMonitor();
  });
  socket.on('timeblock:updated', ({ block }) => {
    toast.info(`✏️ ${block.userName} updated a time block`);
    loadMonitor();
  });
  socket.on('timeblock:deleted', ({ userName }) => {
    toast.info(`🗑️ ${userName} deleted a time block`);
    loadMonitor();
  });
})();

async function loadMonitor() {
  const sprintId = document.getElementById('filterSprint').value;
  const employeeId = document.getElementById('filterEmployee').value;
  let query = '';
  if (sprintId) query += `?sprintId=${sprintId}`;
  if (employeeId) query += `${query ? '&' : '?'}employeeId=${employeeId}`;

  try {
    const { data } = await api.get(`/admin/monitor${query}`);
    allBlocks = data;
    renderMonitor(data);
  } catch (err) {
    toast.error('Failed to load monitor data');
  }
}

function renderMonitor(blocks) {
  const tbody = document.getElementById('monitorTbody');
  document.getElementById('totalBlocks').textContent = blocks.length;

  const totalMins = blocks.reduce((acc, b) => {
    const [sh, sm] = b.startTime.split(':').map(Number);
    const [eh, em] = b.endTime.split(':').map(Number);
    return acc + (eh * 60 + em) - (sh * 60 + sm);
  }, 0);
  document.getElementById('totalHours').textContent = (totalMins / 60).toFixed(1);

  if (!blocks.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon">📭</div><h3>No time blocks</h3><p>No data matches the current filters</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = blocks.map(b => {
    const [sh, sm] = b.startTime.split(':').map(Number);
    const [eh, em] = b.endTime.split(':').map(Number);
    const dur = (eh * 60 + em) - (sh * 60 + sm);
    const h = Math.floor(dur / 60), m = dur % 60;
    const durStr = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="avatar" style="background:${b.userId?.avatarColor || '#6C63FF'};width:30px;height:30px;font-size:12px">${b.userId ? getInitials(b.userId.name) : '?'}</div>
            <div>
              <div style="font-weight:600;font-size:13px">${b.userId?.name || 'Unknown'}</div>
              <div style="font-size:11px;color:var(--text-muted)">${b.userId?.email || ''}</div>
            </div>
          </div>
        </td>
        <td style="font-size:13px">${b.sprintId?.name || '—'}</td>
        <td style="font-size:13px">Day ${b.dayId?.dayNumber || '—'}<br><span style="font-size:11px;color:var(--text-muted)">${b.dayId?.date ? dateUtils.formatShort(b.dayId.date) : ''}</span></td>
        <td style="font-weight:700;color:var(--primary-light);font-size:13px">${time.to12h(b.startTime)} – ${time.to12h(b.endTime)}</td>
        <td style="font-size:13px;max-width:200px">${b.description}</td>
        <td><span class="badge badge-active" style="font-size:12px">${durStr}</span></td>
        <td style="font-size:12px;color:var(--text-muted)">${dateUtils.timeAgo(b.createdAt)}</td>
      </tr>
    `;
  }).join('');
}
