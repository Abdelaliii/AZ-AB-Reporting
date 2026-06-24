/**
 * ARE Reporting - LDAP Auth Proxy
 *
 * Flow:
 *   1. User opens the app → proxy checks for valid session cookie
 *   2. No session → proxy serves a login page
 *   3. User submits Windows credentials → proxy validates against AD via LDAP
 *   4. Valid → proxy issues a signed JWT session cookie and forwards the
 *      request to the app with X-Remote-User header set
 *   5. Invalid → login page with error message
 */

'use strict';

const express      = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const ldap         = require('ldapjs');
const cookieParser = require('cookie-parser');
const jwt          = require('jsonwebtoken');

// ---------------------------------------------------------------------------
// Configuration  (all values can be overridden via environment variables)
// ---------------------------------------------------------------------------
const config = {
  // LDAP / Active Directory
  ldapUrl:        process.env.LDAP_URL        || 'ldap://your-dc.company.local',
  ldapBaseDn:     process.env.LDAP_BASE_DN    || 'DC=company,DC=local',
  ldapDomain:     process.env.LDAP_DOMAIN     || 'COMPANY',   // NETBIOS domain name

  // Upstream app (the ARE reporting container)
  appUrl:         process.env.APP_URL         || 'http://are-reporting:3000',

  // Session
  jwtSecret:      process.env.JWT_SECRET      || 'change-this-proxy-secret',
  sessionMaxAge:  parseInt(process.env.SESSION_MAX_AGE || '28800'), // seconds (8 h)

  // Proxy listen port
  port:           parseInt(process.env.PORT   || '80'),
};

const SESSION_COOKIE = 'are_proxy_session';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Attempt an LDAP bind with the supplied credentials. Resolves with the
 *  sAMAccountName (username) on success, rejects on failure. */
function ldapAuthenticate(username, password) {
  return new Promise((resolve, reject) => {
    if (!password || password.trim() === '') {
      return reject(new Error('Passwort darf nicht leer sein'));
    }

    // Bind as DOMAIN\username (works with most AD configurations)
    const bindDn = `${config.ldapDomain}\\${username}`;

    const client = ldap.createClient({ url: config.ldapUrl, timeout: 5000, connectTimeout: 5000 });

    client.on('error', (err) => {
      client.destroy();
      reject(new Error('LDAP-Server nicht erreichbar: ' + err.message));
    });

    client.bind(bindDn, password, (err) => {
      client.destroy();
      if (err) {
        reject(new Error('Ungültige Anmeldedaten'));
      } else {
        resolve(username.toLowerCase());
      }
    });
  });
}

/** Create a signed session token */
function createSessionToken(username) {
  return jwt.sign({ username }, config.jwtSecret, { expiresIn: config.sessionMaxAge });
}

/** Verify session token — returns username or null */
function verifySessionToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    return decoded.username;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Login HTML page
// ---------------------------------------------------------------------------
function loginPage(error = '') {
  const errorHtml = error
    ? `<div class="error"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${error}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ARE Beteiligungen – Anmeldung</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: radial-gradient(ellipse at 60% 20%, #1e293b 0%, #0f172a 70%);
    }

    .container { width: 100%; max-width: 420px; }

    .logo {
      text-align: center;
      margin-bottom: 2.5rem;
    }
    .logo-text {
      font-size: 3.75rem;
      font-weight: 900;
      font-style: italic;
      letter-spacing: -0.05em;
      background: linear-gradient(135deg, #f3d38c, #C8B568, #947e3a);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
    }
    .logo-sub {
      color: rgba(255,255,255,0.4);
      font-size: 0.65rem;
      letter-spacing: 0.35em;
      font-weight: 700;
      text-transform: uppercase;
      margin-top: 0.4rem;
    }

    .card {
      background: rgba(255,255,255,0.04);
      backdrop-filter: blur(24px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 1.5rem;
      padding: 2rem;
      box-shadow: 0 25px 50px rgba(0,0,0,0.4);
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.75rem;
    }
    .card-icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.6rem;
      background: rgba(200,181,104,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .card-icon svg { color: #C8B568; }
    .card-title { color: #fff; font-weight: 700; font-size: 1.05rem; }
    .card-subtitle { color: #94a3b8; font-size: 0.8rem; margin-top: 0.1rem; }

    .form-group { margin-bottom: 1.1rem; }
    label {
      display: block;
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #64748b;
      margin-bottom: 0.45rem;
    }
    input {
      width: 100%;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 0.75rem;
      padding: 0.85rem 1rem;
      color: #fff;
      font-family: inherit;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s, background 0.2s;
    }
    input::placeholder { color: #334155; }
    input:focus {
      border-color: rgba(200,181,104,0.5);
      background: rgba(255,255,255,0.06);
    }

    .error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.2);
      border-radius: 0.75rem;
      padding: 0.75rem 1rem;
      color: #fca5a5;
      font-size: 0.85rem;
      font-weight: 500;
      margin-bottom: 1.1rem;
    }

    button[type=submit] {
      width: 100%;
      background: linear-gradient(135deg, #C8B568, #b9a557);
      border: none;
      border-radius: 0.75rem;
      padding: 0.95rem;
      color: #fff;
      font-family: inherit;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.15s;
      margin-top: 0.5rem;
      box-shadow: 0 8px 24px rgba(200,181,104,0.2);
    }
    button[type=submit]:hover { opacity: 0.9; transform: translateY(-1px); }
    button[type=submit]:active { transform: translateY(0); }

    .hint {
      text-align: center;
      color: #334155;
      font-size: 0.75rem;
      margin-top: 1.25rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <div class="logo-text">ARE</div>
      <div class="logo-sub">Beteiligungen &middot; Reporting</div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div>
          <div class="card-title">Windows-Anmeldung</div>
          <div class="card-subtitle">Bitte melde dich mit deinen Firmendaten an</div>
        </div>
      </div>

      <form method="POST" action="/_proxy/login">
        ${errorHtml}
        <div class="form-group">
          <label for="username">Windows-Benutzername</label>
          <input id="username" name="username" type="text" required autocomplete="username" placeholder="z.B. aelyoussfi">
        </div>
        <div class="form-group">
          <label for="password">Passwort</label>
          <input id="password" name="password" type="password" required autocomplete="current-password" placeholder="••••••••">
        </div>
        <button type="submit">Anmelden</button>
      </form>

      <p class="hint">Nutze deine normalen Windows-Anmeldedaten</p>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(cookieParser());
// Parse URL-encoded form data for the login POST
app.use(express.urlencoded({ extended: false }));

// ------ Login page (GET) ------
app.get('/_proxy/login', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(loginPage());
});

// ------ Login form submission (POST) ------
app.post('/_proxy/login', async (req, res) => {
  const { username, password } = req.body;
  const redirectTo = req.query.redirect || '/';

  try {
    const verifiedUsername = await ldapAuthenticate(username, password);
    const token = createSessionToken(verifiedUsername);

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure:   false,   // set to true when using HTTPS
      sameSite: 'Strict',
      maxAge:   config.sessionMaxAge * 1000,
    });

    res.redirect(redirectTo);
  } catch (err) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(401).send(loginPage(err.message));
  }
});

// ------ Logout ------
app.get('/_proxy/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.redirect('/_proxy/login');
});

// ------ Auth middleware for all other routes ------
app.use((req, res, next) => {
  // Skip the proxy routes themselves
  if (req.path.startsWith('/_proxy/')) return next();

  const token = req.cookies[SESSION_COOKIE];
  const username = token ? verifySessionToken(token) : null;

  if (!username) {
    const loginUrl = `/_proxy/login?redirect=${encodeURIComponent(req.originalUrl)}`;
    return res.redirect(loginUrl);
  }

  // Inject the remote-user header for the upstream app
  req.headers['x-remote-user'] = username;
  // Remove any client-supplied header to prevent spoofing
  next();
});

// ------ Proxy to upstream app ------
app.use(
  '/',
  createProxyMiddleware({
    target:      config.appUrl,
    changeOrigin: true,
    on: {
      error: (err, req, res) => {
        console.error('Proxy error:', err.message);
        res.status(502).send('App nicht erreichbar');
      }
    }
  })
);

// ---------------------------------------------------------------------------
app.listen(config.port, '0.0.0.0', () => {
  console.log(`ARE Auth Proxy listening on port ${config.port}`);
  console.log(`LDAP: ${config.ldapUrl} | Base DN: ${config.ldapBaseDn}`);
  console.log(`Upstream: ${config.appUrl}`);
});
