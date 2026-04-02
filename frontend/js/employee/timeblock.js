// Employee Time Block CRUD JS
// Depends on sprint.js for activeDayId, activeSprintId

// Show add form
document.getElementById('showAddBlockBtn').addEventListener('click', () => {
  document.getElementById('addBlockForm').style.display = 'flex';
  document.getElementById('showAddBlockBtn').style.display = 'none';
  document.getElementById('blockStart').value = '';
  document.getElementById('blockEnd').value = '';
  document.getElementById('blockDesc').value = '';
});

// Cancel add
document.getElementById('cancelAddBlock').addEventListener('click', () => {
  document.getElementById('addBlockForm').style.display = 'none';
  document.getElementById('showAddBlockBtn').style.display = 'flex';
});

// Save new block
document.getElementById('saveBlockBtn').addEventListener('click', async () => {
  const startTime = document.getElementById('blockStart').value;
  const endTime = document.getElementById('blockEnd').value;
  const description = document.getElementById('blockDesc').value.trim();

  if (!startTime || !endTime || !description) {
    toast.error('All fields are required');
    return;
  }

  const btn = document.getElementById('saveBlockBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    await api.post('/timeblock', {
      dayId: activeDayId,
      sprintId: activeSprintId,
      startTime,
      endTime,
      description
    });
    toast.success('Time block added!');
    document.getElementById('addBlockForm').style.display = 'none';
    document.getElementById('showAddBlockBtn').style.display = 'flex';
    await loadDayBlocks(activeDayId);
    await loadSprints(); // refresh day cards
  } catch (err) {
    toast.error(err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Save Block';
  }
});

// Load blocks for a day
async function loadDayBlocks(dayId) {
  const list = document.getElementById('blockList');
  list.innerHTML = '<div class="spinner" style="margin:0 auto"></div>';
  try {
    const { data } = await api.get(`/timeblock/${dayId}`);
    renderBlockList(data);
    updateDayTotal(data);
  } catch {
    list.innerHTML = '<p style="text-align:center;color:var(--text-muted)">Failed to load blocks</p>';
  }
}

function renderBlockList(blocks) {
  const list = document.getElementById('blockList');
  if (!blocks.length) {
    list.innerHTML = `<div class="empty-state" style="padding:20px 0"><div class="icon" style="font-size:32px">⏰</div><h3>No time blocks</h3><p>Add your first block below</p></div>`;
    return;
  }

  list.innerHTML = blocks.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(b => `
    <div class="block-item ${b.completed ? 'is-completed' : ''}" id="block-${b._id}">
      <div style="display:flex;align-items:center;gap:12px;width:100%">
        <input type="checkbox" class="block-check" ${b.completed ? 'checked' : ''} onchange="toggleBlockStatus('${b._id}', this.checked)" />
        <div style="flex:1">
          <div class="block-time-range">${time.to12h(b.startTime)} – ${time.to12h(b.endTime)}</div>
          <div class="block-desc">${escHtml(b.description)}</div>
          <div class="block-duration">${time.formatDuration(b.startTime, b.endTime)}</div>
        </div>
        <div class="block-actions">
          <button class="btn btn-icon btn-edit btn-sm" onclick="openEditBlock('${b._id}','${b.startTime}','${b.endTime}','${b.description.replace(/'/g, "\\'")}',${b.completed})">✏️</button>
          <button class="btn btn-icon btn-del btn-sm" onclick="deleteBlock('${b._id}')">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function toggleBlockStatus(id, completed) {
  try {
    await api.put(`/timeblock/${id}`, { completed });
    // Reload local data
    await loadDayBlocks(activeDayId);
    await loadSprints();
  } catch (err) {
    toast.error(err.message);
  }
}

function updateDayTotal(blocks) {
  const total = time.totalHoursFromBlocks(blocks);
  document.getElementById('dayTotalHours').textContent = `${total}h`;
}

// Open edit modal
function openEditBlock(id, startTime, endTime, description, completed) {
  document.getElementById('editBlockId').value = id;
  document.getElementById('editStart').value = startTime;
  document.getElementById('editEnd').value = endTime;
  document.getElementById('editDesc').value = description;
  document.getElementById('editCompleted').checked = !!completed;
  modal.open('editBlockModal');
}

// Save edit
document.getElementById('saveEditBtn').addEventListener('click', async () => {
  const id = document.getElementById('editBlockId').value;
  const startTime = document.getElementById('editStart').value;
  const endTime = document.getElementById('editEnd').value;
  const description = document.getElementById('editDesc').value.trim();
  const completed = document.getElementById('editCompleted').checked;

  if (!startTime || !endTime || !description) { toast.error('All fields required'); return; }

  const btn = document.getElementById('saveEditBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    await api.put(`/timeblock/${id}`, { startTime, endTime, description, completed });
    toast.success('Block updated');
    modal.close('editBlockModal');
    await loadDayBlocks(activeDayId);
    await loadSprints();
  } catch (err) {
    toast.error(err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Save Changes';
  }
});

// Delete block
async function deleteBlock(id) {
  if (!confirm('Delete this time block?')) return;
  try {
    await api.del(`/timeblock/${id}`);
    toast.success('Block deleted');
    await loadDayBlocks(activeDayId);
    await loadSprints();
  } catch (err) {
    toast.error(err.message);
  }
}
