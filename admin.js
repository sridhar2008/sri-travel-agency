const loginPanel = document.getElementById('loginPanel');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const dashboardMessage = document.getElementById('dashboardMessage');
const submissionsBody = document.getElementById('submissionsBody');
const summary = document.getElementById('summary');
const logoutButton = document.getElementById('logoutButton');
const refreshButton = document.getElementById('refreshButton');

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
      <td>${escapeHtml(submission.state || '-')}</td>
      <td>${escapeHtml(submission.destination || '-')}</td>
      <td>${escapeHtml(submission.packageId || '-')}</td>
      <td>${escapeHtml(submission.travelers || '-')}</td>
      <td>${escapeHtml(submission.transport || '-')}</td>
      <td>${escapeHtml(submission.estimatedPrice || '-')}</td>
      <td>${escapeHtml(submission.message || '-')}</td>
      <td>${escapeHtml(submission.createdAt?.toDate().toLocaleString() || '-')}</td>
      <td><button class="delete-submission" type="button" data-id="${escapeAttribute(submission.id)}">Delete</button></td>
    </tr>`).join('') : '<tr><td class="empty" colspan="13">No submissions yet.</td></tr>';
};

const loadDashboard = async () => {
  if (!firebaseAuth.currentUser) return;
  const snapshot = await firebaseDb.collection('submissions').orderBy('createdAt', 'desc').get();
  renderSubmissions(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
  loginPanel.hidden = true;
  dashboard.hidden = false;
};

refreshButton.addEventListener('click', async () => {
  refreshButton.disabled = true;
  refreshButton.textContent = 'Refreshing...';
  setMessage(dashboardMessage, '');
  try {
    await loadDashboard();
  } catch (error) {
    setMessage(dashboardMessage, error.message);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = 'Refresh';
  }
});

const deleteSubmission = async (id) => {
  if (!window.confirm('Delete this submission permanently?')) return;
  try {
    await firebaseDb.collection('submissions').doc(id).delete();
    await loadDashboard();
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
    await firebaseAuth.signInWithEmailAndPassword(loginForm.username.value, loginForm.password.value);
    await loadDashboard();
  } catch (error) {
    setMessage(loginMessage, error.code === 'auth/invalid-credential' ? 'Invalid email or password.' : error.message);
  }
});

logoutButton.addEventListener('click', () => {
  firebaseAuth.signOut();
  loginForm.reset();
  setMessage(loginMessage, '');
  showLogin();
});

firebaseAuth.onAuthStateChanged((user) => {
  if (!user) return showLogin();
  user.getIdTokenResult(true).then((tokenResult) => {
    if (tokenResult.claims.admin !== true) {
      setMessage(loginMessage, 'This account does not have admin access.');
      return firebaseAuth.signOut();
    }
    return loadDashboard().catch((error) => setMessage(dashboardMessage, error.message));
  }).catch(() => {
    setMessage(loginMessage, 'Unable to verify admin access.');
    return firebaseAuth.signOut();
  });
});
