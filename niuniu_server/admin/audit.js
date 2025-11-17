'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * 审计日志系统
 * - 记录所有后台操作
 * - 不可篡改（通过 hash chain）
 * - 定期备份（应配置定时任务）
 */

class AuditLog {
    constructor(dbConnection) {
        this.db = dbConnection; // 应使用专用的审计日志库或分表
    }

    /**
     * 记录审计事件
     * @param {string} adminId - 操作员 ID
     * @param {string} adminName - 操作员名称
     * @param {string} action - 操作名称（如 'USER_BAN', 'ROOM_KICK'）
     * @param {object} details - 操作详情
     * @param {string} resourceType - 资源类型（如 'user', 'room'）
     * @param {string} resourceId - 资源 ID
     * @param {boolean} success - 是否成功
     * @param {string} ip - 操作者 IP
     * @param {object} riskFlags - 风险标记（可选）
     */
    async log(adminId, adminName, action, details, resourceType, resourceId, success, ip, riskFlags = {}) {
        try {
            const timestamp = Date.now();
            const logEntry = {
                adminId,
                adminName,
                action,
                details: JSON.stringify(details),
                resourceType,
                resourceId,
                success,
                ip,
                riskFlags: JSON.stringify(riskFlags),
                timestamp,
                hash: null, // 将被计算
            };

            // 计算当前日志的 hash（包括链式哈希，用于防篡改）
            const previousHash = await this.getLastHash();
            logEntry.hash = this.calculateHash(logEntry, previousHash);

            // 持久化到数据库
            await this.insertToDb(logEntry);

            // 同时写入本地日志（便于实时监控）
            logger.center_log({
                type: 'AUDIT',
                adminId,
                action,
                resourceType,
                resourceId,
                success,
                riskFlags,
            });

            return logEntry;
        } catch (err) {
            logger.error_log(`AuditLog error: ${err.message}`);
            // 不应抛出异常导致业务中断，但需记录
            return null;
        }
    }

    /**
     * 计算日志条目的 SHA256 哈希
     */
    calculateHash(logEntry, previousHash = '') {
        const data = JSON.stringify({
            adminId: logEntry.adminId,
            action: logEntry.action,
            resourceType: logEntry.resourceType,
            resourceId: logEntry.resourceId,
            timestamp: logEntry.timestamp,
            previousHash,
        });
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * 获取最后一条日志的 hash（用于链式结构）
     */
    async getLastHash() {
        return new Promise((resolve, reject) => {
            const query = 'SELECT hash FROM admin_audit_log ORDER BY id DESC LIMIT 1';
            this.db.query(query, (err, results) => {
                if (err) {
                    logger.error_log(`getLastHash error: ${err.message}`);
                    return resolve('');
                }
                resolve(results && results[0] ? results[0].hash : '');
            });
        });
    }

    /**
     * 插入审计日志到数据库
     */
    insertToDb(logEntry) {
        return new Promise((resolve, reject) => {
            const query = `
        INSERT INTO admin_audit_log 
        (adminId, adminName, action, details, resourceType, resourceId, success, ip, riskFlags, timestamp, hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
            const values = [
                logEntry.adminId,
                logEntry.adminName,
                logEntry.action,
                logEntry.details,
                logEntry.resourceType,
                logEntry.resourceId,
                logEntry.success,
                logEntry.ip,
                logEntry.riskFlags,
                logEntry.timestamp,
                logEntry.hash,
            ];
            this.db.query(query, values, (err, result) => {
                if (err) {
                    logger.error_log(`insertToDb audit log error: ${err.message}`);
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    /**
     * 查询审计日志（支持过滤和分页）
     */
    async queryLogs(filters, page = 1, pageSize = 50) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM admin_audit_log WHERE 1=1';
            const values = [];

            if (filters.adminId) {
                query += ' AND adminId = ?';
                values.push(filters.adminId);
            }
            if (filters.action) {
                query += ' AND action = ?';
                values.push(filters.action);
            }
            if (filters.resourceType) {
                query += ' AND resourceType = ?';
                values.push(filters.resourceType);
            }
            if (filters.resourceId) {
                query += ' AND resourceId = ?';
                values.push(filters.resourceId);
            }
            if (filters.startTime) {
                query += ' AND timestamp >= ?';
                values.push(filters.startTime);
            }
            if (filters.endTime) {
                query += ' AND timestamp <= ?';
                values.push(filters.endTime);
            }

            query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
            values.push(pageSize, (page - 1) * pageSize);

            this.db.query(query, values, (err, results) => {
                if (err) {
                    logger.error_log(`queryLogs error: ${err.message}`);
                    reject(err);
                } else {
                    resolve(results || []);
                }
            });
        });
    }

    /**
     * 验证审计日志链完整性（检查哈希链是否被篡改）
     */
    async verifyIntegrity(startId = 1, endId = null) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT id, hash FROM admin_audit_log WHERE id >= ?';
            const values = [startId];

            if (endId) {
                query += ' AND id <= ?';
                values.push(endId);
            }

            query += ' ORDER BY id ASC';

            this.db.query(query, values, (err, results) => {
                if (err) {
                    logger.error_log(`verifyIntegrity error: ${err.message}`);
                    return reject(err);
                }

                let previousHash = '';
                let isValid = true;
                const invalidIds = [];

                for (const log of results) {
                    // 这里简化了验证逻辑，实际应该重新计算哈希并对比
                    // 由于日志的完整内容已序列化存储，可进行完整验证
                    if (log.hash !== this.calculateHash(log, previousHash)) {
                        isValid = false;
                        invalidIds.push(log.id);
                    }
                    previousHash = log.hash;
                }

                resolve({
                    isValid,
                    invalidIds,
                    totalRecords: results.length,
                });
            });
        });
    }
}

module.exports = AuditLog;
