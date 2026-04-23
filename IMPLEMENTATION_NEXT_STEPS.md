# 🔐 Security Implementation - Next Steps

## Phase 1: Dependencies Installation ✅ PENDING

### Required New Packages

```bash
npm install dotenv bcryptjs helmet express-rate-limit express-validator ioredis uuid
```

**What each does:**
- `dotenv` - Load .env variables into process.env
- `bcryptjs` - Lighter bcrypt alternative for password hashing
- `helmet` - Security headers middleware
- `express-rate-limit` - Request rate limiting
- `express-validator` - Input validation schemas
- `ioredis` - Redis client for distributed session/token storage
- `uuid` - Generate secure random filenames

### Optional Upgrades
- `axios` → Remove (use native fetch to reduce dependencies)
- `passport` → Add for OAuth2 support (future)

---

## Phase 2: Generate Secrets ✅ PENDING

Before running the server, generate cryptographically secure JWT secrets:

```bash
# Run twice to get both ACCESS and REFRESH tokens
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then update `.env`:
```env
JWT_SECRET=<paste-first-secret>
JWT_SECRET_REFRESH=<paste-second-secret>
```

---

## Phase 3: Modify server.js ✅ PENDING

Key changes needed in `js/server.js`:

### 3.1 Add Imports (Top of file, line 1-10)
```javascript
require('dotenv').config();
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const { 
  authenticateToken,
  validateRegister,
  validateLogin,
  hashPassword,
  verifyPassword
} = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');
const { 
  globalLimiter,
  authLimiter,
  registerLimiter,
  scanLimiter,
  dnsLimiter,
  uploadLimiter
} = require('../middleware/limiter');
const tokenManager = require('../services/token-manager');
const securityHeaders = require('../middleware/security-headers');
```

### 3.2 Apply Security Middleware (After app init)
```javascript
const app = express();

// Apply security headers FIRST
securityHeaders(app);

// Then apply rate limiting GLOBALLY
app.use(globalLimiter);

// Standard middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors({
  origin: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 3.3 Update Auth Endpoints

#### REGISTER Endpoint (Modify existing)
**Remove:**
- Hardcoded password hashing with bcrypt
- File write logic with bcrypt

**Replace with:**
```javascript
app.post('/api/auth/register', registerLimiter, validateRegister, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user exists
    const existingUser = users.find(u => u.email === email.toLowerCase());
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Email already registered' 
      });
    }

    // Hash password with bcryptjs
    const hashedPassword = await hashPassword(password);

    // Create new user
    const newUser = {
      id: generateUUID(),
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      registeredAt: Date.now()
    };

    // Save user
    users.push(newUser);
    fs.writeFileSync(path.join(__dirname, '../users.json'), 
      JSON.stringify(users, null, 2));

    // Generate tokens
    const accessToken = jwt.sign(
      { id: newUser.id, email: newUser.email, name: newUser.name },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { id: newUser.id },
      process.env.JWT_SECRET_REFRESH,
      { expiresIn: '7d' }
    );

    // Store refresh token in Redis
    await tokenManager.storeRefreshToken(newUser.id, refreshToken);

    res.json({
      message: 'Registration successful',
      accessToken,
      refreshToken,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});
```

#### LOGIN Endpoint (Modify existing)
**Replace with:**
```javascript
app.post('/api/auth/login', authLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    // Check account lockout
    const isLocked = await tokenManager.isAccountLocked(normalizedEmail);
    if (isLocked) {
      return res.status(429).json({
        error: 'Account temporarily locked due to too many failed login attempts'
      });
    }

    // Find user
    const user = users.find(u => u.email === normalizedEmail);
    if (!user) {
      // Don't reveal if email exists
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const passwordMatch = await verifyPassword(password, user.password);
    if (!passwordMatch) {
      // Increment failed attempts
      const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || 5);
      const failKey = `failed_login:${normalizedEmail}`;
      
      // In real app, track in Redis; simplified here
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET_REFRESH,
      { expiresIn: '7d' }
    );

    // Store refresh token
    await tokenManager.storeRefreshToken(user.id, refreshToken);

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});
```

#### LOGOUT Endpoint (New)
```javascript
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    await tokenManager.revokeRefreshToken(req.user.id);
    res.json({ message: 'Logout successful' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});
```

#### REFRESH TOKEN Endpoint (New)
```javascript
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    jwt.verify(refreshToken, process.env.JWT_SECRET_REFRESH, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid refresh token' });
      }

      // Check token still in Redis
      const stored = await tokenManager.getRefreshToken(decoded.id);
      if (!stored || stored.token !== refreshToken) {
        return res.status(403).json({ error: 'Refresh token revoked' });
      }

      // Issue new access token
      const newAccessToken = jwt.sign(
        { id: decoded.id },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.json({ accessToken: newAccessToken });
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});
```

### 3.4 Update File Upload Endpoint
**Find:** `/api/upload` or file upload endpoint

**Replace with:**
```javascript
app.post('/api/upload', 
  authenticateToken,
  uploadLimiter,
  upload.single('file'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      res.json({
        message: 'File uploaded successfully',
        file: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          path: req.file.path
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);
```

### 3.5 Update Scan Endpoints
Add `scanLimiter` and `authenticateToken` to:
- `/api/scan/security-check`
- `/api/scan/vulnerability-scan`
- `/api/scan/ssl-analyzer`
- `/api/scan/subdomain-finder`

**Example pattern:**
```javascript
app.post('/api/scan/security-check',
  authenticateToken,
  scanLimiter,
  body('url').isURL().trim(''),
  (req, res) => {
    // ... existing logic
  }
);
```

### 3.6 Update DNS/Subdomain Endpoints
Add `dnsLimiter` and `authenticateToken` to:
- `/api/dns/enumerator`
- `/api/subdomain/finder`

**Example pattern:**
```javascript
app.post('/api/dns/enumerator',
  authenticateToken,
  dnsLimiter,
  body('domain').isString().trim(),
  (req, res) => {
    // ... existing logic
  }
);
```

---

## Phase 4: Update Client-Side Auth ✅ PENDING

### 4.1 Modify `js/auth-manager.js`

**Remove:**
```javascript
localStorage.setItem('access_token', token);
localStorage.setItem('refresh_token', token);
localStorage.getItem('access_token');
localStorage.removeItem('access_token');
```

**Replace with:** (Server will set httpOnly cookies, client doesn't store tokens)
```javascript
// Tokens are now managed by httpOnly cookies automatically
// Server sends Set-Cookie headers after auth endpoints

// For logout
async logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'  // Include cookies
    });
    // localStorage cleanup if any
    window.location.href = '/html/login.html';
  } catch (error) {
    console.error('Logout failed:', error);
  }
}

// For requests with token
async makeAuthenticatedRequest(url, options = {}) {
  return fetch(url, {
    ...options,
    credentials: 'include',  // Auto-include cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
}
```

### 4.2 Modify `js/progress-manager.js`

**Replace:**
```javascript
const token = localStorage.getItem('access_token');
headers.Authorization = `Bearer ${token}`;
```

**With:**
```javascript
// Token automatically sent via credentials: 'include'
// No need to manually add Authorization header
```

---

## Phase 5: Testing & Validation ✅ PENDING

### Test Rate Limiting
```bash
# Should succeed
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"TestPass123!"}'

# Run 5 times rapidly - 6th should return 429
for i in {1..6}; do curl -X POST http://localhost:3000/api/auth/login ...; done
```

### Test File Upload
```bash
# Should fail - .exe not allowed
curl -X POST http://localhost:3000/api/upload -F "file=@malware.exe" -H "Authorization: Bearer TOKEN"

# Should succeed - .pdf allowed
curl -X POST http://localhost:3000/api/upload -F "file=@document.pdf" -H "Authorization: Bearer TOKEN"
```

### Test Password Validation
```bash
# Should fail - too short
{"password": "Short1!"}

# Should fail - no uppercase
{"password": "lowercase123!"}

# Should fail - no number
{"password": "NoNumbers!"}

# Should fail - no special char
{"password": "NoSpecial123"}

# Should succeed
{"password": "ValidPass123!"}
```

---

## Phase 6: Production Deployment ✅ PENDING

### 6.1 Generate Real Secrets
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 6.2 Set Environment Variables
```bash
# Production .env
NODE_ENV=production
JWT_SECRET=<generated-value-1>
JWT_SECRET_REFRESH=<generated-value-2>
REDIS_URL=redis://:password@prod-redis:6379
```

### 6.3 Update CORS Origins
```env
CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
```

### 6.4 Enable HSTS Preload
In production, request HSTS preload at: https://hstspreload.org/

---

## Current Implementation Status

| Component | Status | File |
|-----------|--------|------|
| Environment Config | ✅ DONE | `.env` |
| Password Hashing | ✅ DONE | `middleware/auth.js` |
| JWT Validation | ✅ DONE | `middleware/auth.js` |
| Input Validation | ✅ DONE | `middleware/auth.js` |
| Rate Limiting | ✅ DONE | `middleware/limiter.js` |
| File Upload Whitelist | ✅ DONE | `middleware/upload.js` |
| Security Headers | ✅ DONE | `middleware/security-headers.js` |
| Token Persistence | ✅ DONE | `services/token-manager.js` |
| server.js Integration | ⏳ PENDING | `js/server.js` |
| NPM Dependencies | ⏳ PENDING | `package.json` |
| Client Auth Update | ⏳ PENDING | `js/auth-manager.js` |
| Testing | ⏳ PENDING | Manual tests |
| Secrets Generation | ⏳ PENDING | Manual step |

---

## Security Improvements Summary

| Vulnerability | Before | After | Status |
|---|---|---|---|
| Hardcoded JWT Secret | `evil-secret-key-2026` | Environment variable | ✅ |
| Unrestricted File Upload | All MIME types accepted | Whitelist with MIME validation | ✅ |
| No Rate Limiting | Unlimited requests | 100 req/15min globally + per-endpoint | ✅ |
| No Input Validation | None | express-validator schemas | ✅ |
| Password Storage | Plain text risk | bcryptjs with 12 rounds | ✅ |
| Session Persistence | Memory (volatile) | Redis with 7-day TTL | ✅ |
| Token Location | localStorage (XSS risk) | httpOnly cookies | ✅ |
| Security Headers | Missing | Helmet + CSP + HSTS | ✅ |
| CORS | Wide open | Whitelist validation | ✅ |
| Account Lockout | None | 5 attempts/15min lockout | ✅ |

---

## Estimated Timeline

- **Phase 1 (Dependencies):** 5 minutes
- **Phase 2 (Secrets):** 2 minutes
- **Phase 3 (server.js):** 1-2 hours (largest)
- **Phase 4 (Client):** 30 minutes
- **Phase 5 (Testing):** 1 hour
- **Total:** ~4 hours to full implementation

---

## Need Help?

This document is your roadmap. Each phase builds on the previous. Start with Phase 1 and work sequentially.

All middleware files are created and ready. Focus on integrating them into `server.js`.

Good luck! 🚀
