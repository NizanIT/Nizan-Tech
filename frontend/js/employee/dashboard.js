// Employee Dashboard JS
(async () => {
  initTheme();
  initSidebar('dashboard');
  const user = await requireAuth('employee');
  if (!user) return;
  setSidebarUser(user);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('welcomeMsg').textContent = `${greeting}, ${user.name} 👋`;

  // Socket
  const socket = initSocket(user.id, user.role);
  socket.on('sprint:assigned', ({ sprintName }) => {
    toast.success(`🎉 New sprint assigned: ${sprintName}`);
    loadDashboard();
  });

  await loadDashboard();

  async function loadDashboard() {
    try {
      const { data } = await api.get('/employee/dashboard');
      document.getElementById('statTasks').textContent = data.totalTasks;
      document.getElementById('statHours').textContent = `${data.totalHours}h`;
      document.getElementById('statToday').textContent = `${data.todayHours}h`;
      document.getElementById('statSprintName').textContent = data.currentSprint?.name || 'None';
      if (data.currentSprint) {
        document.getElementById('statSprintStatus').innerHTML = `<span class="badge badge-${data.currentSprint.status}">${data.currentSprint.status}</span>`;
      }
    } catch (err) { toast.error('Failed to load dashboard'); }

    // Today's blocks
    try {
      const { data: sprints } = await api.get('/employee/sprint');
      const todayBlock = document.getElementById('todayBlocks');
      let allTodayBlocks = [];

      for (const sprint of sprints) {
        const todayDay = sprint.days?.find(d => dateUtils.isToday(d.date));
        if (todayDay) {
          const { data: blocks } = await api.get(`/timeblock/${todayDay._id}`);
          allTodayBlocks = allTodayBlocks.concat(blocks.map(b => ({ ...b, sprintName: sprint.name })));
        }
      }

      if (!allTodayBlocks.length) {
        todayBlock.innerHTML = `
          <div class="empty-state" style="padding:30px 0">
            <div class="icon">⏰</div>
            <h3>No blocks yet today</h3>
            <p>Go to <a href="sprint.html" style="color:var(--primary-light)">My Sprint</a> to add time blocks</p>
          </div>`;
        return;
      }

      todayBlock.innerHTML = allTodayBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(b => `
        <div class="block-item">
          <div class="block-time-range">${time.to12h(b.startTime)} – ${time.to12h(b.endTime)}</div>
          <div class="block-desc">${b.description}</div>
          <div class="block-duration">${time.formatDuration(b.startTime, b.endTime)}</div>
        </div>
      `).join('');
    } catch {}
  }
})();
