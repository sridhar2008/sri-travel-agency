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
      <td>${escapeHtml(submission.email)}</td>
      <td>${escapeHtml(submission.phone || '-')}</td>
      <td>${escapeHtml(submission.destination || '-')}</td>
      <td>${escapeHtml(submission.message || '-')}</td>
      <td>${escapeHtml(new Date(submission.createdAt).toLocaleString())}</td>
    </tr>`).join('') : '<tr><td class="empty" colspan="7">No submissions yet.</td></tr>';
};

const loadDashboard = async (token) => {
  const response = await fetch('/api/admin/submissions', { headers: { Authorization: `Bearer ${token}` } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to load submissions.');
  renderSubmissions(result.submissions);
  loginPanel.hidden = true;
  dashboard.hidden = false;
};

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
