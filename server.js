const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, 'data', 'submissions.json');
const DATABASE_FILE = path.join(ROOT_DIR, 'data', 'submissions.sqlite');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'sriagency';
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

const database = new DatabaseSync(DATABASE_FILE);

const initializeDatabase = async () => {
  await fs.mkdir(path.dirname(DATABASE_FILE), { recursive: true });
  database.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      phone TEXT,
      destination TEXT,
      message TEXT
    );
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      completed_at TEXT NOT NULL
    );
  `);

  const migration = database.prepare('SELECT name FROM migrations WHERE name = ?').get('json-submissions');
  if (migration) return;

  let submissions = [];
  try {
    submissions = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    if (!Array.isArray(submissions)) submissions = [];
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  database.exec('BEGIN');
  try {
    const insert = database.prepare(`
      INSERT INTO submissions (id, type, created_at, email, name, phone, destination, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const submission of submissions) {
      insert.run(
        submission.id,
        submission.type,
        submission.createdAt,
        submission.email,
        submission.name ?? null,
        submission.phone ?? null,
        submission.destination ?? null,
        submission.message ?? null
      );
    }
    database.prepare('INSERT INTO migrations (name, completed_at) VALUES (?, ?)').run('json-submissions', new Date().toISOString());
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
};

const saveSubmission = (submission) => {
  database.prepare(`
    INSERT INTO submissions (id, type, created_at, email, name, phone, destination, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    submission.id,
    submission.type,
    submission.createdAt,
    submission.email,
    submission.name ?? null,
    submission.phone ?? null,
    submission.destination ?? null,
    submission.message ?? null
  );
};

const readSubmissions = () => database.prepare(`
  SELECT id, type, created_at, email, name, phone, destination, message
  FROM submissions
  ORDER BY rowid ASC
`).all().map((submission) => {
  const result = {
    id: submission.id,
    type: submission.type,
    createdAt: submission.created_at,
    email: submission.email
  };
  if (submission.type === 'contact') {
    result.name = submission.name || '';
    result.phone = submission.phone || '';
    result.destination = submission.destination || '';
    result.message = submission.message || '';
  }
  return result;
});

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
    return sendJson(response, 200, { submissions: readSubmissions() });
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
    saveSubmission(submission);
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

initializeDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Sri Explore backend running at http://localhost:${PORT}`);
  });
}).catch((error) => {
  console.error('Unable to initialize the database:', error);
  process.exitCode = 1;
});
