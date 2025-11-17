'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// 密钥（生产环境应从环境变量读取）
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '8h';

/**
 * 管理员角色定义
 */
const ROLES = {
    SUPER_ADMIN: 'super_admin',      // 超级管理员 - 所有权限
    ADMIN: 'admin',                   // 管理员 - 用户/房间/风控管理
    FINANCE: 'finance',               // 财务 - 账务/提现审核
    SUPPORT: 'support',               // 客服 - 用户黑名单/封禁
    OPERATOR: 'operator',             // 运维 - 发布/回滚/配置
};

/**
 * 权限定义（细粒度权限）
 */
const PERMISSIONS = {
    // 用户管理
    USER_VIEW: 'user:view',
    USER_EDIT: 'user:edit',
    USER_BLACKLIST: 'user:blacklist',
    USER_BAN: 'user:ban',
    USER_KYC: 'user:kyc',

    // 房间管理
    ROOM_VIEW: 'room:view',
    ROOM_MANAGE: 'room:manage',
    ROOM_KICK: 'room:kick',
    ROOM_REPLAY: 'room:replay',
    ROOM_CLOSE: 'room:close',

    // 财务管理
    FINANCE_VIEW: 'finance:view',
    FINANCE_RECHARGE: 'finance:recharge',
    FINANCE_WITHDRAW: 'finance:withdraw',
    FINANCE_RECONCILE: 'finance:reconcile',

    // 风控管理
    RISK_VIEW: 'risk:view',
    RISK_RULE: 'risk:rule',
    RISK_DETECT: 'risk:detect',

    // 运维管理
    OPS_PUBLISH: 'ops:publish',
    OPS_ROLLBACK: 'ops:rollback',
    OPS_CONFIG: 'ops:config',
    OPS_MONITOR: 'ops:monitor',
};

/**
 * 角色与权限映射
 */
const ROLE_PERMISSIONS = {
    [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
    [ROLES.ADMIN]: [
        PERMISSIONS.USER_VIEW,
        PERMISSIONS.USER_EDIT,
        PERMISSIONS.USER_BAN,
        PERMISSIONS.ROOM_VIEW,
        PERMISSIONS.ROOM_MANAGE,
        PERMISSIONS.ROOM_KICK,
        PERMISSIONS.ROOM_REPLAY,
        PERMISSIONS.ROOM_CLOSE,
        PERMISSIONS.RISK_VIEW,
        PERMISSIONS.RISK_RULE,
        PERMISSIONS.RISK_DETECT,
    ],
    [ROLES.FINANCE]: [
        PERMISSIONS.USER_VIEW,
        PERMISSIONS.FINANCE_VIEW,
        PERMISSIONS.FINANCE_RECHARGE,
        PERMISSIONS.FINANCE_WITHDRAW,
        PERMISSIONS.FINANCE_RECONCILE,
    ],
    [ROLES.SUPPORT]: [
        PERMISSIONS.USER_VIEW,
        PERMISSIONS.USER_BLACKLIST,
        PERMISSIONS.USER_BAN,
        PERMISSIONS.ROOM_VIEW,
    ],
    [ROLES.OPERATOR]: [
        PERMISSIONS.OPS_PUBLISH,
        PERMISSIONS.OPS_ROLLBACK,
        PERMISSIONS.OPS_CONFIG,
        PERMISSIONS.OPS_MONITOR,
    ],
};

/**
 * 签发 JWT token
 */
function signToken(adminId, adminName, roles, mfaVerified = false) {
    const payload = {
        adminId,
        adminName,
        roles,
        mfaVerified,
        iat: Math.floor(Date.now() / 1000),
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 验证 JWT token
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

/**
 * 签发临时 MFA token（用于二次验证前）
 */
function signMFAToken(adminId, adminName, roles) {
    const payload = {
        adminId,
        adminName,
        roles,
        mfaVerified: false,
        iat: Math.floor(Date.now() / 1000),
    };
    // MFA token 有效期为 5 分钟
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '5m' });
}

/**
 * 检查管理员是否拥有指定权限
 */
function hasPermission(admin, permission) {
    if (!admin || !admin.roles || !Array.isArray(admin.roles)) {
        return false;
    }
    // 获取该管理员拥有的所有权限
    const allPermissions = new Set();
    admin.roles.forEach(role => {
        (ROLE_PERMISSIONS[role] || []).forEach(perm => {
            allPermissions.add(perm);
        });
    });
    return allPermissions.has(permission);
}

/**
 * Express 中间件：验证 JWT token
 */
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ code: 401, message: 'Missing token' });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ code: 401, message: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
}

/**
 * Express 中间件：检查权限（用法：requirePermission(PERMISSIONS.USER_VIEW)）
 */
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ code: 401, message: 'Unauthorized' });
        }
        if (!hasPermission(req.user, permission)) {
            return res.status(403).json({ code: 403, message: 'Forbidden' });
        }
        next();
    };
}

/**
 * Express 中间件：检查是否通过 MFA 验证
 */
function requireMFA(req, res, next) {
    if (!req.user || !req.user.mfaVerified) {
        return res.status(403).json({ code: 403, message: 'MFA verification required' });
    }
    next();
}

module.exports = {
    ROLES,
    PERMISSIONS,
    ROLE_PERMISSIONS,
    signToken,
    verifyToken,
    signMFAToken,
    hasPermission,
    authMiddleware,
    requirePermission,
    requireMFA,
};
