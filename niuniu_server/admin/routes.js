'use strict';

const express = require('express');
const auth = require('./auth');
const AuditLog = require('./audit');
const db = require('../utils/db');
const logger = require('../utils/logger');

const router = express.Router();

// 初始化审计日志（需要传入数据库连接）
const auditLog = new AuditLog(db);

/**
 * 工具函数：获取请求者 IP
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress || '';
}

/**
 * =====================
 * 1. 用户管理相关 API
 * =====================
 */

/**
 * GET /admin/users - 获取用户列表
 */
router.get('/users', auth.authMiddleware, auth.requirePermission(auth.PERMISSIONS.USER_VIEW), async (req, res) => {
  try {
    const { page = 1, pageSize = 50, keyword, status } = req.query;
    const offset = (page - 1) * pageSize;

    let query = 'SELECT id, userId, account, registerTime, status, balance FROM users WHERE 1=1';
    const values = [];

    if (keyword) {
      query += ' AND (account LIKE ? OR userId LIKE ?)';
      values.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (status !== undefined) {
      query += ' AND status = ?';
      values.push(status);
    }

    query += ' LIMIT ? OFFSET ?';
    values.push(pageSize, offset);

    db.query(query, values, (err, users) => {
      if (err) {
        return res.status(500).json({ code: 500, message: 'Database error' });
      }
      res.json({ code: 0, message: 'OK', data: { users, page, pageSize } });
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * POST /admin/users/:userId/ban - 封禁用户
 */
router.post('/users/:userId/ban', auth.authMiddleware, auth.requirePermission(auth.PERMISSIONS.USER_BAN), async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, duration } = req.body; // duration in days, 0 = permanent

    const query = 'UPDATE users SET status = ?, banReason = ?, banUntil = ? WHERE userId = ?';
    const banUntil = duration === 0 ? null : new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    const values = [1, reason, banUntil, userId]; // status=1 means banned

    db.query(query, values, async (err) => {
      if (err) {
        return res.status(500).json({ code: 500, message: 'Database error' });
      }

      // 记录审计日志
      await auditLog.log(
        req.user.adminId,
        req.user.adminName,
        'USER_BAN',
        { reason, duration },
        'user',
        userId,
        true,
        getClientIP(req)
      );

      res.json({ code: 0, message: 'User banned successfully' });
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * POST /admin/users/:userId/blacklist - 添加用户到黑名单
 */
router.post('/users/:userId/blacklist', auth.authMiddleware, auth.requirePermission(auth.PERMISSIONS.USER_BLACKLIST), async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const query = 'INSERT INTO user_blacklist (userId, reason, createdAt) VALUES (?, ?, ?)';
    const values = [userId, reason, new Date()];

    db.query(query, values, async (err) => {
      if (err) {
        return res.status(500).json({ code: 500, message: 'Database error' });
      }

      await auditLog.log(
        req.user.adminId,
        req.user.adminName,
        'USER_BLACKLIST',
        { reason },
        'user',
        userId,
        true,
        getClientIP(req)
      );

      res.json({ code: 0, message: 'User added to blacklist' });
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * =====================
 * 2. 房间管理相关 API
 * =====================
 */

/**
 * GET /admin/rooms - 获取房间列表
 */
router.get('/rooms', auth.authMiddleware, auth.requirePermission(auth.PERMISSIONS.ROOM_VIEW), async (req, res) => {
  try {
    const { page = 1, pageSize = 50, status } = req.query;
    const offset = (page - 1) * pageSize;

    let query = 'SELECT roomId, gameType, playerCount, createdAt, status FROM rooms WHERE 1=1';
    const values = [];

    if (status !== undefined) {
      query += ' AND status = ?';
      values.push(status);
    }

    query += ' LIMIT ? OFFSET ?';
    values.push(pageSize, offset);

    db.query(query, values, (err, rooms) => {
      if (err) {
        return res.status(500).json({ code: 500, message: 'Database error' });
      }
      res.json({ code: 0, message: 'OK', data: { rooms, page, pageSize } });
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * POST /admin/rooms/:roomId/kick - 踢出房间内的玩家
 */
router.post('/rooms/:roomId/kick', auth.authMiddleware, auth.requirePermission(auth.PERMISSIONS.ROOM_KICK), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, reason } = req.body;

    // 这里应该调用游戏服务进程内的踢人逻辑
    // 示例：通过内部消息队列或 Redis pub/sub 通知游戏进程

    const query = 'INSERT INTO room_operations_log (roomId, userId, operation, details) VALUES (?, ?, ?, ?)';
    const values = [roomId, userId, 'KICK', JSON.stringify({ reason })];

    db.query(query, values, async (err) => {
      if (err) {
        return res.status(500).json({ code: 500, message: 'Database error' });
      }

      await auditLog.log(
        req.user.adminId,
        req.user.adminName,
        'ROOM_KICK',
        { reason },
        'room',
        roomId,
        true,
        getClientIP(req)
      );

      res.json({ code: 0, message: 'Player kicked from room' });
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * =====================
 * 3. 财务管理相关 API
 * =====================
 */

/**
 * GET /admin/finance/balance - 获取账户余额与交易历史
 */
router.get('/finance/balance', auth.authMiddleware, auth.requirePermission(auth.PERMISSIONS.FINANCE_VIEW), async (req, res) => {
  try {
    const { userId, page = 1, pageSize = 50 } = req.query;
    const offset = (page - 1) * pageSize;

    let query = 'SELECT userId, account, balance FROM users WHERE userId = ?';
    db.query(query, [userId], (err, users) => {
      if (err || !users || users.length === 0) {
        return res.status(404).json({ code: 404, message: 'User not found' });
      }

      // 获取交易历史
      const txQuery = `
        SELECT id, type, amount, description, createdAt 
        FROM transactions 
        WHERE userId = ? 
        ORDER BY id DESC 
        LIMIT ? OFFSET ?
      `;
      db.query(txQuery, [userId, pageSize, offset], (err, txs) => {
        if (err) {
          return res.status(500).json({ code: 500, message: 'Database error' });
        }
        res.json({ code: 0, message: 'OK', data: { user: users[0], transactions: txs } });
      });
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * POST /admin/finance/recharge - 充值操作
 */
router.post('/finance/recharge', auth.authMiddleware, auth.requirePermission(auth.PERMISSIONS.FINANCE_RECHARGE), async (req, res) => {
  try {
    const { userId, amount, note } = req.body;

    if (amount <= 0) {
      return res.status(400).json({ code: 400, message: 'Invalid amount' });
    }

    const updateQuery = 'UPDATE users SET balance = balance + ? WHERE userId = ?';
    db.query(updateQuery, [amount, userId], async (err) => {
      if (err) {
        return res.status(500).json({ code: 500, message: 'Database error' });
      }

      // 记录交易
      const txQuery = 'INSERT INTO transactions (userId, type, amount, description) VALUES (?, ?, ?, ?)';
      db.query(txQuery, [userId, 'RECHARGE', amount, note], async (err) => {
        if (err) {
          return res.status(500).json({ code: 500, message: 'Transaction log error' });
        }

        await auditLog.log(
          req.user.adminId,
          req.user.adminName,
          'FINANCE_RECHARGE',
          { userId, amount, note },
          'user',
          userId,
          true,
          getClientIP(req)
        );

        res.json({ code: 0, message: 'Recharge successful' });
      });
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * =====================
 * 4. 风控规则配置 API
 * =====================
 */

/**
 * GET /admin/risk/rules - 获取风控规则列表
 */
router.get('/risk/rules', auth.authMiddleware, auth.requirePermission(auth.PERMISSIONS.RISK_VIEW), async (req, res) => {
  try {
    const query = 'SELECT id, ruleName, ruleType, threshold, action FROM risk_rules ORDER BY id DESC';
    db.query(query, (err, rules) => {
      if (err) {
        return res.status(500).json({ code: 500, message: 'Database error' });
      }
      res.json({ code: 0, message: 'OK', data: { rules } });
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * POST /admin/risk/rules - 创建或更新风控规则
 */
router.post('/risk/rules', auth.authMiddleware, auth.requirePermission(auth.PERMISSIONS.RISK_RULE), async (req, res) => {
  try {
    const { ruleName, ruleType, threshold, action, description } = req.body;

    const query = `
      INSERT INTO risk_rules (ruleName, ruleType, threshold, action, description, enabled)
      VALUES (?, ?, ?, ?, ?, 1)
    `;
    const values = [ruleName, ruleType, threshold, action, description];

    db.query(query, values, async (err, result) => {
      if (err) {
        return res.status(500).json({ code: 500, message: 'Database error' });
      }

      await auditLog.log(
        req.user.adminId,
        req.user.adminName,
        'RISK_RULE_CREATE',
        { ruleName, ruleType, threshold, action },
        'risk_rule',
        String(result.insertId),
        true,
        getClientIP(req)
      );

      res.json({ code: 0, message: 'Risk rule created', data: { ruleId: result.insertId } });
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * =====================
 * 5. 审计日志查询 API
 * =====================
 */

/**
 * GET /admin/audit-logs - 获取审计日志
 */
router.get('/audit-logs', auth.authMiddleware, auth.requirePermission(auth.PERMISSIONS.OPS_MONITOR), async (req, res) => {
  try {
    const { page = 1, pageSize = 50, adminId, action, startTime, endTime } = req.query;
    const filters = { adminId, action };
    if (startTime) filters.startTime = parseInt(startTime);
    if (endTime) filters.endTime = parseInt(endTime);

    const logs = await auditLog.queryLogs(filters, parseInt(page), parseInt(pageSize));
    res.json({ code: 0, message: 'OK', data: { logs, page, pageSize } });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

module.exports = router;
