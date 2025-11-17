#!/usr/bin/env node

/**
 * CI 环境模拟脚本
 * 模拟 GitHub Actions 中的 npm ci 流程
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('========== CI 环境模拟测试 ==========\n');

const projectRoot = process.cwd();

function run(command, description) {
    console.log(`\n▶ ${description}`);
    console.log(`  $ ${command}`);
    try {
        const output = execSync(command, {
            encoding: 'utf-8',
            stdio: 'inherit'
        });
        console.log('  ✓ 成功');
        return true;
    } catch (error) {
        console.log('  ✗ 失败');
        return false;
    }
}

let success = true;

// 1. 验证 Node 版本
success = run('node --version', '1. 检查 Node 版本') && success;
success = run('npm --version', '2. 检查 npm 版本') && success;

// 2. 检查 .nvmrc
if (fs.existsSync(path.join(projectRoot, '.nvmrc'))) {
    console.log('\n▶ 3. 读取 .nvmrc 配置');
    const nvmrc = fs.readFileSync(path.join(projectRoot, '.nvmrc'), 'utf-8').trim();
    console.log(`  Node 版本配置: ${nvmrc}`);
    console.log('  ✓ 成功');
} else {
    console.log('\n▶ 3. .nvmrc 不存在');
    success = false;
}

// 3. 清理之前的安装
console.log('\n▶ 4. 清理旧的依赖');
if (fs.existsSync(path.join(projectRoot, 'node_modules'))) {
    console.log('  删除 node_modules...');
    execSync('rm -rf node_modules', { stdio: 'pipe', shell: '/bin/bash' });
}
if (fs.existsSync(path.join(projectRoot, 'package-lock.json'))) {
    console.log('  删除 package-lock.json...');
    fs.unlinkSync(path.join(projectRoot, 'package-lock.json'));
}
console.log('  ✓ 清理完成');

// 4. npm ci (生产环境方式)
success = run('npm ci', '5. npm ci (安装项目依赖)') && success;

// 5. 服务器依赖 npm ci
const serverDir = path.join(projectRoot, 'niuniu_server');
if (fs.existsSync(path.join(serverDir, 'package.json'))) {
    process.chdir(serverDir);
    success = run('npm ci', '6. npm ci (安装服务器依赖)') && success;
    process.chdir(projectRoot);
} else {
    console.log('\n▶ 6. niuniu_server/package.json 不存在');
    success = false;
}

// 6. 兼容性检测
success = run('node check-compatibility.js', '7. 运行兼容性检测') && success;

// 7. 依赖列表
success = run('npm list --depth=0', '8. 显示项目依赖版本') && success;

if (fs.existsSync(path.join(serverDir, 'package.json'))) {
    process.chdir(serverDir);
    success = run('npm list --depth=0', '9. 显示服务器依赖版本') && success;
    process.chdir(projectRoot);
}

console.log('\n========== CI 测试完成 ==========');
if (success) {
    console.log('✓ 所有检查通过，可以部署到生产环境');
    process.exit(0);
} else {
    console.log('✗ 有检查失败，请修复问题后重试');
    process.exit(1);
}
