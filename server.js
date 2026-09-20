const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, 'data', 'submissions.json');
const DATABASE_FILE = path.join(ROOT_DIR, 'data', 'submissions.sqlite');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const adminSessions = new Map();
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const STATIC_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer'
  });
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
const isValidLength = (value, maximum) => value.length <= maximum;
const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

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
      state TEXT,
      destination TEXT,
      package_id TEXT,
      travelers INTEGER,
      stay_days INTEGER,
      hotel_plan TEXT,
      transport TEXT,
      estimated_price TEXT,
      message TEXT,
      suggestion TEXT
    );
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      completed_at TEXT NOT NULL
    );
  `);
  try {
    database.exec('ALTER TABLE submissions ADD COLUMN transport TEXT');
  } catch (error) {
    if (!error.message.includes('duplicate column name')) throw error;
  }
  for (const column of ['package_id TEXT', 'travelers INTEGER', 'estimated_price TEXT']) {
    try {
      database.exec(`ALTER TABLE submissions ADD COLUMN ${column}`);
    } catch (error) {
      if (!error.message.includes('duplicate column name')) throw error;
    }
  }
  try {
    database.exec('ALTER TABLE submissions ADD COLUMN state TEXT');
  } catch (error) {
    if (!error.message.includes('duplicate column name')) throw error;
  }
  for (const column of ['stay_days INTEGER', 'hotel_plan TEXT', 'suggestion TEXT']) {
    try {
      database.exec(`ALTER TABLE submissions ADD COLUMN ${column}`);
    } catch (error) {
      if (!error.message.includes('duplicate column name')) throw error;
    }
  }

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
      INSERT INTO submissions (id, type, created_at, email, name, phone, state, destination, package_id, travelers, stay_days, hotel_plan, transport, estimated_price, message, suggestion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const submission of submissions) {
      insert.run(
        submission.id,
        submission.type,
        submission.createdAt,
        submission.email,
        submission.name ?? null,
        submission.phone ?? null,
        submission.state ?? null,
        submission.destination ?? null,
        submission.packageId ?? null,
        submission.travelers ?? null,
        submission.stayDays ?? null,
        submission.hotelPlan ?? null,
        submission.transport ?? null,
        submission.estimatedPrice ?? null,
        submission.message ?? null,
        submission.suggestion ?? null
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
    INSERT INTO submissions (id, type, created_at, email, name, phone, state, destination, package_id, travelers, stay_days, hotel_plan, transport, estimated_price, message, suggestion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    submission.id,
    submission.type,
    submission.createdAt,
    submission.email,
    submission.name ?? null,
    submission.phone ?? null,
    submission.state ?? null,
    submission.destination ?? null,
    submission.packageId ?? null,
    submission.travelers ?? null,
    submission.stayDays ?? null,
    submission.hotelPlan ?? null,
    submission.transport ?? null,
    submission.estimatedPrice ?? null,
    submission.message ?? null,
    submission.suggestion ?? null
  );
};

const readSubmissions = () => database.prepare(`
  SELECT id, type, created_at, email, name, phone, state, destination, package_id, travelers, stay_days, hotel_plan, transport, estimated_price, suggestion
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
    result.state = submission.state || '';
    result.destination = submission.destination || '';
    result.packageId = submission.package_id || '';
    result.travelers = submission.travelers || 0;
    result.stayDays = submission.stay_days || 0;
    result.hotelPlan = submission.hotel_plan || '';
    result.transport = submission.transport || '';
    result.estimatedPrice = submission.estimated_price || '';
    result.suggestion = submission.suggestion || '';
  }
  return result;
});

const deleteSubmission = (id) => database.prepare('DELETE FROM submissions WHERE id = ?').run(id).changes > 0;

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
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return sendJson(response, 503, { error: 'Admin login is not configured.' });
  }
  const clientAddress = request.socket.remoteAddress || 'unknown';
  const attempt = loginAttempts.get(clientAddress) || { count: 0, startedAt: Date.now() };
  if (Date.now() - attempt.startedAt > LOGIN_WINDOW_MS) {
    attempt.count = 0;
    attempt.startedAt = Date.now();
  }
  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    return sendJson(response, 429, { error: 'Too many login attempts. Try again later.' });
  }
  let payload;
  try {
    payload = JSON.parse(await readRequestBody(request));
  } catch {
    return sendJson(response, 400, { error: 'Please send valid JSON.' });
  }
  const username = clean(payload.username);
  const password = typeof payload.password === 'string' ? payload.password : '';
  if (!safeEqual(username, ADMIN_USERNAME) || !safeEqual(password, ADMIN_PASSWORD)) {
    attempt.count += 1;
    loginAttempts.set(clientAddress, attempt);
    return sendJson(response, 401, { error: 'Invalid admin credentials.' });
  }
  loginAttempts.delete(clientAddress);
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

const handleDeleteSubmission = (request, response, id) => {
  if (!isAdmin(request)) return sendJson(response, 401, { error: 'Admin login required.' });
  if (!id || !deleteSubmission(id)) return sendJson(response, 404, { error: 'Submission not found.' });
  return sendJson(response, 200, { message: 'Submission deleted.' });
};

const handleSubmission = async (request, response, type) => {
  let payload;
  try {
    payload = JSON.parse(await readRequestBody(request));
  } catch {
    return sendJson(response, 400, { error: 'Please send valid JSON.' });
  }

  const email = clean(payload.email);
  if (!validateEmail(email) || !isValidLength(email, 254)) {
    return sendJson(response, 400, { error: 'Please provide a valid email address.' });
  }

  const submission = { id: crypto.randomUUID(), type, createdAt: new Date().toISOString(), email };
  if (type === 'contact') {
    submission.name = clean(payload.name);
    submission.phone = clean(payload.phone);
    submission.state = clean(payload.state);
    submission.destination = clean(payload.destination);
    submission.packageId = clean(payload.packageId);
    submission.travelers = Number.isInteger(payload.travelers) ? payload.travelers : 0;
    submission.stayDays = Number.isInteger(payload.stayDays) ? payload.stayDays : 0;
    submission.hotelPlan = clean(payload.hotelPlan);
    submission.transport = clean(payload.transport);
    submission.estimatedPrice = clean(payload.estimatedPrice);
    submission.suggestion = clean(payload.suggestion);
    if (!submission.name || !submission.state || !submission.destination || !submission.suggestion
      || !isValidLength(submission.name, 120)
      || !isValidLength(submission.state, 80)
      || !isValidLength(submission.phone, 40)
      || !isValidLength(submission.destination, 80)
      || submission.travelers < 1 || submission.travelers > 20
      || submission.stayDays < 1 || submission.stayDays > 30
      || !['budget', 'standard', 'premium'].includes(submission.hotelPlan)
      || !isValidLength(submission.packageId, 80)
      || !isValidLength(submission.transport, 80)
      || !isValidLength(submission.estimatedPrice, 120)
      || !isValidLength(submission.suggestion, 2000)) {
      return sendJson(response, 400, { error: 'Name, state, tourist spot, package, stay days, transport, and suggestion are required.' });
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
  const relativePath = path.relative(ROOT_DIR, filePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)
    || relativePath === 'data' || relativePath.startsWith(`data${path.sep}`)
    || relativePath.startsWith('.env')) {
    return sendJson(response, 403, { error: 'Forbidden.' });
  }
  try {
    const content = await fs.readFile(filePath);
    const contentType = STATIC_TYPES[path.extname(filePath)] || 'application/octet-stream';
    response.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer'
    });
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
  if (request.method === 'DELETE' && request.url.startsWith('/api/admin/submissions/')) {
    const id = decodeURIComponent(request.url.slice('/api/admin/submissions/'.length));
    return handleDeleteSubmission(request, response, id);
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
