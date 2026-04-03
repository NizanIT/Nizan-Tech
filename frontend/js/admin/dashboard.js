// Admin Dashboard JS
(async () => {
  initTheme();
  initSidebar('dashboard');

  const user = await requireAuth('admin');
  if (!user) return;
  setSidebarUser(user);

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('welcomeMsg').textContent = `${greeting}, ${user.name} 👋`;

  // Socket
  const socket = initSocket(user.id, user.role);

  // Load stats
  try {
    const { data } = await api.get('/admin/stats');
    if (data) {
      document.getElementById('statEmployees').textContent = data.totalEmployees;
      document.getElementById('statActiveSprints').textContent = data.activeSprints;
      document.getElementById('statHoursToday').textContent = `${data.hoursLoggedToday}h`;
      document.getElementById('statTotalSprints').textContent = data.totalSprints;
    }
  } catch (e) { 
    console.error('Stats load failed:', e);
    // UI Feedback for load failure
    ['statEmployees', 'statActiveSprints', 'statHoursToday', 'statTotalSprints'].forEach(id => {
      document.getElementById(id).innerHTML = '<span title="Unable to load" style="color:var(--danger);cursor:help">⚠️</span>';
    });
  }

  // Load recent sprints
  try {
    const { data } = await api.get('/admin/sprints');
    const el = document.getElementById('recentSprints');
    if (!data.length) { el.innerHTML = '<p style="font-size:13px;color:var(--text-muted)">No sprints yet</p>'; return; }
    el.innerHTML = data.slice(0, 3).map(s => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-light)">
        <div>
          <div style="font-size:13px;font-weight:600">${s.name}</div>
          <div style="font-size:11px;color:var(--text-muted)">${dateUtils.formatShort(s.startDate)} – ${dateUtils.formatShort(s.endDate)}</div>
        </div>
        <span class="badge badge-${s.status}">${s.status}</span>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('recentSprints').innerHTML = '<p style="font-size:12px;color:var(--danger)">⚠️ Error connecting to server</p>';
  }

  // Activity feed
  const feed = document.getElementById('activityFeed');
  let events = [];

  const renderFeed = () => {
    if (!events.length) {
      feed.innerHTML = '<p style="font-size:13px;color:var(--text-muted)">No recent activity</p>';
      return;
    }
    feed.innerHTML = events.map(ev => `
      <div class="activity-item">
        <div class="activity-dot" style="background:var(--accent)"></div>
        <span style="font-size:16px">${ev.icon}</span>
        <span class="activity-text">${ev.text}</span>
        <span class="activity-time">${dateUtils.timeAgo(ev.time)}</span>
      </div>
    `).join('');
  };

  try {
    const { data } = await api.get('/admin/activities');
    events = data;
    renderFeed();
  } catch (e) {
    console.error('Failed to load activities', e);
  }

  const addActivity = (icon, text) => {
    events.unshift({ icon, text, time: new Date() });
    if (events.length > 20) events.pop();
    renderFeed();
  };

  socket.on('timeblock:created', ({ block }) => {
    addActivity('⏱️', `${block.userName} added a block: ${block.startTime}–${block.endTime}`);
    toast.info(`${block.userName} logged new time`);
  });
  socket.on('timeblock:updated', ({ block }) => {
    addActivity('✏️', `${block.userName} updated: ${block.description}`);
  });
  socket.on('timeblock:deleted', ({ userName }) => {
    addActivity('🗑️', `${block?.userName || userName} deleted a block`);
  });
})();
