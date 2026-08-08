require('dotenv').config();
const path = require('path');

module.exports = {
  port: process.env.PORT || 11285,
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET || 'alip_keren_jir',
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    rememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || '90d'
  },

  cors: {
    origins: (process.env.CORS_ORIGIN || 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300
  },

  admin: {
    name: process.env.ADMIN_NAME || 'alif',
    password: process.env.ADMIN_PASSWORD || 'alif2012'
  },

  uploads: {
    dir: path.join(__dirname, 'uploads'),
    maxMb: parseInt(process.env.MAX_UPLOAD_MB, 10) || 5
  },

  db: {
    file: path.join(__dirname, 'database.json')
  },

  attendanceStatuses: ['present', 'late', 'permission', 'sick', 'absent'],
  attendanceReasonRequired: ['permission', 'sick']
};
