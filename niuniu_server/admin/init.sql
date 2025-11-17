-- 管理员用户表
CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  adminId VARCHAR(64) UNIQUE NOT NULL,
  adminName VARCHAR(128) NOT NULL,
  account VARCHAR(128) UNIQUE NOT NULL,
  passwordHash VARCHAR(255) NOT NULL,
  roles VARCHAR(255) NOT NULL COMMENT '逗号分隔的角色列表 (super_admin,admin,finance,support,operator)',
  email VARCHAR(128),
  mfaEnabled TINYINT(1) DEFAULT 0,
  mfaSecret VARCHAR(255) COMMENT 'TOTP 密钥',
  lastLoginAt DATETIME,
  status TINYINT(1) DEFAULT 1 COMMENT '1=active, 0=disabled',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (account),
  INDEX (adminId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 审计日志表（不可篡改）
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  adminId VARCHAR(64) NOT NULL,
  adminName VARCHAR(128) NOT NULL,
  action VARCHAR(64) NOT NULL COMMENT '操作类型 (USER_BAN, ROOM_KICK, FINANCE_RECHARGE 等)',
  details LONGTEXT COMMENT '操作详情 JSON',
  resourceType VARCHAR(32) COMMENT '资源类型 (user, room, finance 等)',
  resourceId VARCHAR(64),
  success TINYINT(1) DEFAULT 1,
  ip VARCHAR(45) COMMENT '操作者 IP 地址',
  riskFlags LONGTEXT COMMENT '风险标记 JSON',
  timestamp BIGINT NOT NULL COMMENT '毫秒级时间戳',
  hash VARCHAR(64) NOT NULL COMMENT 'SHA256 哈希（链式结构）',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX (adminId),
  INDEX (action),
  INDEX (resourceType),
  INDEX (resourceId),
  INDEX (timestamp),
  INDEX (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户黑名单表
CREATE TABLE IF NOT EXISTS user_blacklist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId VARCHAR(64) NOT NULL,
  reason TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  createdBy VARCHAR(64),
  UNIQUE (userId),
  INDEX (userId),
  INDEX (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 房间操作日志表
CREATE TABLE IF NOT EXISTS room_operations_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  roomId VARCHAR(64) NOT NULL,
  userId VARCHAR(64),
  operation VARCHAR(32) COMMENT 'KICK, CLOSE, FREEZE 等',
  details LONGTEXT COMMENT '操作详情 JSON',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  createdBy VARCHAR(64),
  INDEX (roomId),
  INDEX (userId),
  INDEX (operation),
  INDEX (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 风控规则表
CREATE TABLE IF NOT EXISTS risk_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ruleName VARCHAR(128) NOT NULL,
  ruleType VARCHAR(32) COMMENT '异常行为类型 (unusual_win_rate, rapid_recharge, bot_detection 等)',
  threshold FLOAT COMMENT '触发阈值',
  action VARCHAR(32) COMMENT '触发后的动作 (WARN, BAN, FREEZE 等)',
  description TEXT,
  enabled TINYINT(1) DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (ruleType),
  INDEX (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 财务交易表
CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  userId VARCHAR(64) NOT NULL,
  type VARCHAR(32) COMMENT 'RECHARGE, WITHDRAW, GAME_WIN, GAME_LOSS 等',
  amount DECIMAL(12, 2),
  description TEXT,
  status VARCHAR(32) DEFAULT 'COMPLETED' COMMENT 'PENDING, COMPLETED, FAILED',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  processedAt DATETIME,
  processedBy VARCHAR(64),
  INDEX (userId),
  INDEX (type),
  INDEX (createdAt),
  INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 注意：以下是示例，实际密码应通过 admin/init-admins.js 脚本生成 bcrypt 哈希
-- 运行命令: node admin/init-admins.js
-- 此脚本会创建默认管理员账户（admin, finance, support）

-- 创建表后，建议先执行 init-admins.js 脚本来安全地创建初始管理员
-- 以下 INSERT 语句已注释，避免使用明文密码

/*
INSERT INTO admin_users (adminId, adminName, account, passwordHash, roles, mfaEnabled, email, status, createdAt)
VALUES 
  ('admin_001', 'Super Admin', 'admin', '$2a$10$...bcrypt_hash...', 'super_admin', 0, 'admin@example.com', 'active', NOW()),
  ('admin_002', 'Finance Manager', 'finance', '$2a$10$...bcrypt_hash...', 'finance', 0, 'finance@example.com', 'active', NOW()),
  ('admin_003', 'Customer Support', 'support', '$2a$10$...bcrypt_hash...', 'support', 0, 'support@example.com', 'active', NOW())
ON DUPLICATE KEY UPDATE adminName = VALUES(adminName);
*/
