'use strict';

const express = require('express');
const path = require('path');
const db = require('../utils/db');
const logger = require('../utils/logger');
const auth = require('./auth');
const adminRoutes = require('./routes');

const app = express();
const ADMIN_PORT = process.env.ADMIN_PORT || 7011;

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// CORS
app.all('*', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS');
  res.header('Content-Type', 'application/json;charset=utf-8');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

/**
 * =====================
 * 认证与登录相关 API
 * =====================
 */

/**
 * POST /admin/login - 管理员登录（第一步：用户名密码）
 */
app.post('/admin/login', (req, res) => {
  try {
    const { account, password } = req.body;

    if (!account || !password) {
      return res.status(400).json({ code: 400, message: 'Missing account or password' });
    }

    // 查询管理员账户
    const query = `
      SELECT id, adminId, adminName, passwordHash, roles, mfaEnabled, mfaSecret 
      FROM admin_users 
      WHERE account = ?
    `;
    db.query(query, [account], async (err, admins) => {
      if (err || !admins || admins.length === 0) {
        return res.status(401).json({ code: 401, message: 'Invalid credentials' });
      }

      const admin = admins[0];

      // 使用 bcrypt 验证密码
      try {
        const isPasswordValid = await auth.verifyPassword(password, admin.passwordHash);
        if (!isPasswordValid) {
          return res.status(401).json({ code: 401, message: 'Invalid credentials' });
        }
      } catch (bcryptErr) {
        logger.error_log.error('Password verification error:', bcryptErr);
        return res.status(500).json({ code: 500, message: 'Internal server error' });
      }

      // 如果启用了 MFA，返回临时令牌
      if (admin.mfaEnabled) {
        const mfaToken = auth.signMFAToken(admin.adminId, admin.adminName, admin.roles.split(','));
        return res.json({
          code: 0,
          message: 'MFA required',
          data: { mfaToken, mfaRequired: true },
        });
      }

      // 没有 MFA，直接返回完整令牌
      const roles = admin.roles.split(',');
      const token = auth.signToken(admin.adminId, admin.adminName, roles, true);
      res.json({
        code: 0,
        message: 'Login successful',
        data: {
          token,
          admin: {
            adminId: admin.adminId,
            adminName: admin.adminName,
            roles,
          },
        },
      });
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * POST /admin/verify-mfa - 验证 MFA
 */
app.post('/admin/verify-mfa', (req, res) => {
  try {
    const { mfaToken, totpCode } = req.body;

    // 验证临时令牌
    const decoded = auth.verifyToken(mfaToken);
    if (!decoded || decoded.mfaVerified) {
      return res.status(401).json({ code: 401, message: 'Invalid MFA token' });
    }

    // 查询 MFA 密钥
    const query = 'SELECT mfaSecret FROM admin_users WHERE adminId = ?';
    db.query(query, [decoded.adminId], (err, results) => {
      if (err || !results || results.length === 0) {
        return res.status(500).json({ code: 500, message: 'Database error' });
      }

      const { mfaSecret } = results[0];

      // 验证 TOTP 码
      const mfa = require('./mfa');
      const totp = new mfa.TOTP(mfaSecret);
      if (!totp.verify(totpCode)) {
        return res.status(401).json({ code: 401, message: 'Invalid TOTP code' });
      }

      // 生成完整的认证令牌
      const fullToken = auth.signToken(decoded.adminId, decoded.adminName, decoded.roles, true);
      res.json({
        code: 0,
        message: 'MFA verified',
        data: { token: fullToken },
      });
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * POST /admin/setup-mfa - 设置 MFA（管理员初次设置）
 */
app.post('/admin/setup-mfa', auth.authMiddleware, auth.requireMFA, (req, res) => {
  try {
    const mfa = require('./mfa');
    const secret = mfa.generateSecret();
    const qrCodeURI = mfa.generateQRCodeURI(
      req.user.adminId,
      req.user.adminName,
      secret,
      'NiuNiu Admin'
    );

    res.json({
      code: 0,
      message: 'MFA setup initiated',
      data: {
        secret,
        qrCodeURI,
        instructions: 'Scan this QR code with Google Authenticator or similar app',
      },
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * POST /admin/confirm-mfa - 确认 MFA 设置
 */
app.post('/admin/confirm-mfa', auth.authMiddleware, auth.requireMFA, (req, res) => {
  try {
    const { secret, totpCode } = req.body;

    // 验证 TOTP 码
    const mfa = require('./mfa');
    const totp = new mfa.TOTP(secret);
    if (!totp.verify(totpCode)) {
      return res.status(400).json({ code: 400, message: 'Invalid TOTP code' });
    }

    // 保存密钥到数据库
    const query = 'UPDATE admin_users SET mfaSecret = ?, mfaEnabled = 1 WHERE adminId = ?';
    db.query(query, [secret, req.user.adminId], (err) => {
      if (err) {
        return res.status(500).json({ code: 500, message: 'Database error' });
      }
      res.json({ code: 0, message: 'MFA enabled successfully' });
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * =====================
 * 注册管理员路由
 * =====================
 */
app.use('/admin', adminRoutes);

/**
 * =====================
 * 健康检查
 * =====================
 */
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

/**
 * =====================
 * 启动服务器
 * =====================
 */
app.listen(ADMIN_PORT, () => {
  logger.center_log(`Admin server listening on port ${ADMIN_PORT}`);
  console.log(`Admin server listening on port ${ADMIN_PORT}`);
});

process.on('uncaughtException', (err) => {
  logger.error_log(`Admin server caught exception: ${err.stack}`);
});
