const loginPanel = document.getElementById('loginPanel');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const dashboardMessage = document.getElementById('dashboardMessage');
const submissionsBody = document.getElementById('submissionsBody');
const summary = document.getElementById('summary');
const logoutButton = document.getElementById('logoutButton');

const setMessage = (element, message) => { element.textContent = message; };
const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[character]));
const escapeAttribute = (value) => escapeHtml(value).replace(/`/g, '&#96;');

const showLogin = () => {
  loginPanel.hidden = false;
  dashboard.hidden = true;
};

const renderSubmissions = (submissions) => {
  const contacts = submissions.filter((submission) => submission.type === 'contact').length;
  const newsletters = submissions.filter((submission) => submission.type === 'newsletter').length;
  summary.innerHTML = `<span><strong>${submissions.length}</strong> total</span><span><strong>${contacts}</strong> enquiries</span><span><strong>${newsletters}</strong> subscribers</span>`;
  submissionsBody.innerHTML = submissions.length ? submissions.map((submission) => `
    <tr>
      <td><span class="badge ${escapeHtml(submission.type)}">${escapeHtml(submission.type)}</span></td>
      <td>${escapeHtml(submission.name || '-')}</td>
      <td><a class="admin-link" href="mailto:${escapeAttribute(submission.email)}">${escapeHtml(submission.email)}</a></td>
      <td>${submission.phone ? `<a class="admin-link" href="tel:${escapeAttribute(submission.phone)}">${escapeHtml(submission.phone)}</a>` : '-'}</td>
      <td>${escapeHtml(submission.destination || '-')}</td>
      <td>${escapeHtml(submission.message || '-')}</td>
      <td>${escapeHtml(new Date(submission.createdAt).toLocaleString())}</td>
      <td><button class="delete-submission" type="button" data-id="${escapeAttribute(submission.id)}">Delete</button></td>
    </tr>`).join('') : '<tr><td class="empty" colspan="8">No submissions yet.</td></tr>';
};

const loadDashboard = async (token) => {
  const response = await fetch('/api/admin/submissions', { headers: { Authorization: `Bearer ${token}` } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to load submissions.');
  renderSubmissions(result.submissions);
  loginPanel.hidden = true;
  dashboard.hidden = false;
};

const deleteSubmission = async (id) => {
  if (!window.confirm('Delete this submission permanently?')) return;
  const token = sessionStorage.getItem('adminToken');
  try {
    const response = await fetch(`/api/admin/submissions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to delete submission.');
    await loadDashboard(token);
  } catch (error) {
    setMessage(dashboardMessage, error.message);
  }
};

submissionsBody.addEventListener('click', (event) => {
  const button = event.target.closest('.delete-submission');
  if (button) deleteSubmission(button.dataset.id);
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(loginMessage, 'Signing in...');
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginForm.username.value, password: loginForm.password.value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to sign in.');
    sessionStorage.setItem('adminToken', result.token);
    await loadDashboard(result.token);
  } catch (error) {
    setMessage(loginMessage, error.message);
  }
});

logoutButton.addEventListener('click', () => {
  sessionStorage.removeItem('adminToken');
  loginForm.reset();
  setMessage(loginMessage, '');
  showLogin();
});

const existingToken = sessionStorage.getItem('adminToken');
if (existingToken) {
  loadDashboard(existingToken).catch(() => {
    sessionStorage.removeItem('adminToken');
    setMessage(dashboardMessage, 'Your admin session has expired.');
    showLogin();
  });
}
