// Admin Employees JS
let allEmployees = [];
let editingId = null;
let deletingId = null;

(async () => {
  initTheme();
  initSidebar('employees');
  const user = await requireAuth('admin');
  if (!user) return;
  setSidebarUser(user);
  await loadEmployees();

  // Search
  document.getElementById('searchInput').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderTable(allEmployees.filter(emp =>
      emp.name.toLowerCase().includes(q) || emp.email.toLowerCase().includes(q)
    ));
  });

  // Add employee button
  document.getElementById('addEmployeeBtn').addEventListener('click', () => {
    editingId = null;
    document.getElementById('empModalTitle').textContent = 'Add Employee';
    document.getElementById('empSubmitBtn').textContent = 'Add Employee';
    document.getElementById('empForm').reset();
    document.getElementById('empId').value = '';
    document.getElementById('empPassword').required = true;
    modal.open('empModal');
  });

  // Form submit
  document.getElementById('empForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('empSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const payload = {
      name: document.getElementById('empName').value.trim(),
      email: document.getElementById('empEmail').value.trim(),
    };
    const pass = document.getElementById('empPassword').value;
    if (pass) payload.password = pass;

    try {
      if (editingId) {
        await api.put(`/admin/employees/${editingId}`, payload);
        toast.success('Employee updated successfully');
      } else {
        if (!pass) { toast.error('Password is required'); btn.disabled = false; btn.textContent = 'Add Employee'; return; }
        await api.post('/admin/employees', payload);
        toast.success('Employee added successfully');
      }
      modal.close('empModal');
      await loadEmployees();
    } catch (err) {
      toast.error(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = editingId ? 'Save Changes' : 'Add Employee';
    }
  });

  // Delete confirm
  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!deletingId) return;
    try {
      await api.del(`/admin/employees/${deletingId}`);
      toast.success('Employee deleted');
      modal.close('deleteModal');
      await loadEmployees();
    } catch (err) {
      toast.error(err.message);
    }
  });
})();

async function loadEmployees() {
  try {
    const { data } = await api.get('/admin/employees');
    allEmployees = data;
    renderTable(data);
  } catch (err) {
    toast.error('Failed to load employees');
  }
}

function renderTable(employees) {
  const tbody = document.getElementById('employeeTbody');
  if (!employees.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">👥</div><h3>No employees</h3><p>Add your first employee to get started</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = employees.map(emp => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar" style="background:${emp.avatarColor || '#6C63FF'}">${getInitials(emp.name)}</div>
          <span style="font-weight:600">${emp.name}</span>
        </div>
      </td>
      <td style="color:var(--text-muted)">${emp.email}</td>
      <td><span class="badge ${emp.isActive ? 'badge-active' : 'badge-completed'}">${emp.isActive ? 'Active' : 'Inactive'}</span></td>
      <td style="color:var(--text-muted);font-size:13px">${dateUtils.formatDate(emp.createdAt)}</td>
      <td>
        <div class="employee-actions">
          <button class="btn btn-ghost btn-sm" onclick="editEmployee('${emp._id}')">✏️ Edit</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteEmployee('${emp._id}','${emp.name}')">🗑️</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleStatus('${emp._id}', ${emp.isActive})">${emp.isActive ? '🚫 Deactivate' : '✅ Activate'}</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function editEmployee(id) {
  const emp = allEmployees.find(e => e._id === id);
  if (!emp) return;
  editingId = id;
  document.getElementById('empModalTitle').textContent = 'Edit Employee';
  document.getElementById('empSubmitBtn').textContent = 'Save Changes';
  document.getElementById('empId').value = id;
  document.getElementById('empName').value = emp.name;
  document.getElementById('empEmail').value = emp.email;
  document.getElementById('empPassword').value = '';
  document.getElementById('empPassword').required = false;
  modal.open('empModal');
}

function deleteEmployee(id, name) {
  deletingId = id;
  document.getElementById('deleteEmpName').textContent = name;
  modal.open('deleteModal');
}

async function toggleStatus(id, currentActive) {
  try {
    await api.put(`/admin/employees/${id}`, { isActive: !currentActive });
    toast.success(`Employee ${currentActive ? 'deactivated' : 'activated'}`);
    await loadEmployees();
  } catch (err) { toast.error(err.message); }
}
