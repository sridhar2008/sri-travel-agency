const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, 'data', 'submissions.json');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'sridharagency';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'asdfghjkl';
const adminSessions = new Map();
const STATIC_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
};

const readRequestBody = (request) => new Promise((resolve, reject) => {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1_000_000) {
      reject(new Error('Request body is too large.'));
      request.destroy();
    }
  });
  request.on('end', () => resolve(body));
  request.on('error', reject);
});

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const clean = (value) => typeof value === 'string' ? value.trim() : '';

const saveSubmission = async (submission) => {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  let submissions = [];
  try {
    submissions = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    if (!Array.isArray(submissions)) submissions = [];
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  submissions.push(submission);
  await fs.writeFile(DATA_FILE, `${JSON.stringify(submissions, null, 2)}\n`, 'utf8');
};

const readSubmissions = async () => {
  try {
    const submissions = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    return Array.isArray(submissions) ? submissions : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
};

const getAdminToken = (request) => {
  const authorization = request.headers.authorization || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
};

const isAdmin = (request) => {
  const token = getAdminToken(request);
  const expiresAt = adminSessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    adminSessions.delete(token);
    return false;
  }
  return true;
};

const handleAdminLogin = async (request, response) => {
  let payload;
  try {
    payload = JSON.parse(await readRequestBody(request));
  } catch {
    return sendJson(response, 400, { error: 'Please send valid JSON.' });
  }
  if (payload.username !== ADMIN_USERNAME || payload.password !== ADMIN_PASSWORD) {
    return sendJson(response, 401, { error: 'Invalid admin credentials.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
  return sendJson(response, 200, { token });
};

const handleAdminSubmissions = async (request, response) => {
  if (!isAdmin(request)) return sendJson(response, 401, { error: 'Admin login required.' });
  try {
    return sendJson(response, 200, { submissions: await readSubmissions() });
  } catch {
    return sendJson(response, 500, { error: 'Unable to load submissions.' });
  }
};

const handleSubmission = async (request, response, type) => {
  let payload;
  try {
    payload = JSON.parse(await readRequestBody(request));
  } catch {
    return sendJson(response, 400, { error: 'Please send valid JSON.' });
  }

  const email = clean(payload.email);
  if (!validateEmail(email)) {
    return sendJson(response, 400, { error: 'Please provide a valid email address.' });
  }

  const submission = { id: crypto.randomUUID(), type, createdAt: new Date().toISOString(), email };
  if (type === 'contact') {
    submission.name = clean(payload.name);
    submission.phone = clean(payload.phone);
    submission.destination = clean(payload.destination);
    submission.message = clean(payload.message);
    if (!submission.name || !submission.message) {
      return sendJson(response, 400, { error: 'Name and message are required.' });
    }
  }

  try {
    await saveSubmission(submission);
    return sendJson(response, 201, { message: 'Submission received.', submission });
  } catch {
    return sendJson(response, 500, { error: 'Unable to save your submission right now.' });
  }
};

const serveStatic = async (request, response) => {
  const requestPath = decodeURIComponent(request.url === '/' ? '/index.html' : request.url.split('?')[0]);
  const filePath = path.resolve(ROOT_DIR, `.${requestPath}`);
  if (!filePath.startsWith(ROOT_DIR)) return sendJson(response, 403, { error: 'Forbidden.' });
  try {
    const content = await fs.readFile(filePath);
    const contentType = STATIC_TYPES[path.extname(filePath)] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': contentType });
    response.end(content);
  } catch (error) {
    sendJson(response, error.code === 'ENOENT' ? 404 : 500, { error: 'Not found.' });
  }
};

const server = http.createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/api/admin/login') {
    return handleAdminLogin(request, response);
  }
  if (request.method === 'GET' && request.url === '/api/admin/submissions') {
    return handleAdminSubmissions(request, response);
  }
  if (request.method === 'POST' && request.url === '/api/newsletter') {
    return handleSubmission(request, response, 'newsletter');
  }
  if (request.method === 'POST' && request.url === '/api/contact') {
    return handleSubmission(request, response, 'contact');
  }
  if (request.method === 'GET') return serveStatic(request, response);
  return sendJson(response, 405, { error: 'Method not allowed.' });
});

server.listen(PORT, () => {
  console.log(`Sri Explore backend running at http://localhost:${PORT}`);
});
