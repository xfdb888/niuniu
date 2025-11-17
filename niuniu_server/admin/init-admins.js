#!/usr/bin/env node

/**
 * 初始化管理员账户脚本
 * 用法: node admin/init-admins.js
 * 
 * 创建 3 个默认管理员账户（使用 bcrypt 哈希密码）
 */

'use strict';

const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./utils/db.js');
const logger = require('./utils/logger.js');

const BCRYPT_ROUNDS = 10;

// 默认管理员账户列表
const DEFAULT_ADMINS = [
    {
        adminId: 'admin_001',
        account: 'admin',
        password: 'Admin@123456',
        adminName: '超级管理员',
        roles: 'super_admin',
        email: 'admin@example.com',
    },
    {
        adminId: 'admin_002',
        account: 'finance',
        password: 'Finance@123456',
        adminName: '财务管理员',
        roles: 'finance',
        email: 'finance@example.com',
    },
    {
        adminId: 'admin_003',
        account: 'support',
        password: 'Support@123456',
        adminName: '客服管理员',
        roles: 'support',
        email: 'support@example.com',
    },
];

/**
 * 哈希密码并插入管理员
 */
async function initializeAdmins() {
    console.log('开始初始化管理员账户...\n');

    for (const admin of DEFAULT_ADMINS) {
        try {
            // 哈希密码
            const passwordHash = await bcrypt.hash(admin.password, BCRYPT_ROUNDS);

            // 检查账户是否已存在
            const checkQuery = 'SELECT id FROM admin_users WHERE account = ?';
            db.query(checkQuery, [admin.account], (checkErr, results) => {
                if (checkErr) {
                    logger.error_log.error(`检查账户 ${admin.account} 失败:`, checkErr);
                    return;
                }

                if (results && results.length > 0) {
                    console.log(`⚠️  账户 "${admin.account}" 已存在，跳过\n`);
                    return;
                }

                // 插入新管理员
                const insertQuery = `
                    INSERT INTO admin_users 
                    (adminId, account, passwordHash, adminName, roles, email, mfaEnabled, status, createdAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `;

                db.query(
                    insertQuery,
                    [
                        admin.adminId,
                        admin.account,
                        passwordHash,
                        admin.adminName,
                        admin.roles,
                        admin.email,
                        false, // mfaEnabled: 默认未启用
                        'active',
                    ],
                    (insertErr, result) => {
                        if (insertErr) {
                            logger.error_log.error(`插入管理员 ${admin.adminId} 失败:`, insertErr);
                            console.error(`❌ 插入失败: ${admin.account}\n`);
                        } else {
                            console.log(`✅ 成功创建管理员`);
                            console.log(`   账户名: ${admin.account}`);
                            console.log(`   密码: ${admin.password}`);
                            console.log(`   角色: ${admin.roles}`);
                            console.log(`   备注: 请立即修改此密码!\n`);
                        }
                    }
                );
            });
        } catch (err) {
            logger.error_log.error(`处理管理员 ${admin.adminId} 时出错:`, err);
            console.error(`❌ 错误: ${admin.adminId} - ${err.message}\n`);
        }
    }

    console.log('初始化完成。请在 3 秒后按 Ctrl+C 退出...');
    setTimeout(() => {
        process.exit(0);
    }, 3000);
}

// 运行初始化
initializeAdmins();
