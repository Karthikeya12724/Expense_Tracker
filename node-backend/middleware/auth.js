const jwt = require('jsonwebtoken');
const pool = require('../db');
require('dotenv').config();

function parseJwt(req) {
  const headerAuth = req.headers['authorization'];
  if (headerAuth && headerAuth.startsWith('Bearer ')) {
    return headerAuth.substring(7);
  }
  return null;
}

// Verifies the JWT (if present) and attaches req.user = { id, username, email, roles: [...] }
// Mirrors AuthTokenFilter — does NOT reject the request by itself; route-level `requireRole`
// (mirroring @PreAuthorize) enforces authorization.
async function authenticate(req, res, next) {
  try {
    const token = parseJwt(req);
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const email = decoded.sub;

      const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if (users.length > 0) {
        const user = users[0];
        const [roles] = await pool.query(
          `SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ?`,
          [user.id]
        );
        req.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          enabled: !!user.enabled,
          roles: roles.map((r) => r.name),
        };
      }
    }
  } catch (e) {
    // Invalid/expired token — leave req.user undefined, same as Spring's filter swallowing the exception
  }
  next();
}

// Mirrors @PreAuthorize("hasRole('ROLE_X')")
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        error: 'Unauthorized',
        message: 'Full authentication is required to access this resource',
        path: req.originalUrl,
      });
    }
    const hasRole = req.user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      return res.status(403).json({
        status: 403,
        error: 'Forbidden',
        message: 'Access is denied',
        path: req.originalUrl,
      });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
