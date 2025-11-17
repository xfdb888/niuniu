#!/usr/bin/env node

/**
 * Node 版本和环境兼容性检测脚本
 * 在本地和 CI 环境中都能运行
 */

const fs = require('fs');
const path = require('path');

console.log('========== 牛牛棋牌项目兼容性检测 ==========\n');

// 1. 检查 Node 版本
console.log('1. Node 版本检查:');
const nodeVersion = process.version;
const requiredNodeVersion = '18.x';
console.log(`   当前 Node 版本: ${nodeVersion}`);
console.log(`   要求 Node 版本: ${requiredNodeVersion}`);

const nodeMajor = parseInt(process.version.split('.')[0].substring(1));
if (nodeMajor < 18) {
    console.log('   ❌ Node 版本过低，请升级到 18.x 或以上');
    process.exit(1);
} else {
    console.log('   ✓ Node 版本检查通过\n');
}

// 2. 检查 npm 版本
console.log('2. npm 版本检查:');
const { execSync } = require('child_process');
const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
console.log(`   当前 npm 版本: ${npmVersion}`);
console.log('   要求 npm 版本: 10.x 或以上');
const npmMajor = parseInt(npmVersion.split('.')[0]);
if (npmMajor < 10) {
    console.log('   ⚠ npm 版本较低，建议升级到 10.x');
} else {
    console.log('   ✓ npm 版本检查通过\n');
}

// 3. 检查项目结构
console.log('3. 项目结构检查:');
const projectRoot = path.join(__dirname);
const requiredFiles = [
    'package.json',
    'niuniu_server/package.json',
    '.nvmrc'
];

let structureOk = true;
requiredFiles.forEach(file => {
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath)) {
        console.log(`   ✓ ${file}`);
    } else {
        console.log(`   ❌ ${file} 不存在`);
        structureOk = false;
    }
});

if (!structureOk) {
    process.exit(1);
}
console.log('');

// 4. 检查 node_modules
console.log('4. 依赖安装检查:');
const serverNodeModulesPath = path.join(projectRoot, 'niuniu_server/node_modules');
if (fs.existsSync(serverNodeModulesPath)) {
    console.log('   ✓ niuniu_server 依赖已安装');
} else {
    console.log('   ⚠ niuniu_server 依赖未安装');
    console.log('   请执行: npm run install-all');
    process.exit(1);
}
console.log('');

// 5. 检查关键依赖
console.log('5. 关键依赖检查:');
const criticalDeps = ['express', 'mysql', 'redis', 'ws'];
const serverPackageJsonPath = path.join(projectRoot, 'niuniu_server/package.json');
const serverPackageJson = JSON.parse(fs.readFileSync(serverPackageJsonPath, 'utf-8'));

criticalDeps.forEach(dep => {
    if (serverPackageJson.dependencies[dep]) {
        console.log(`   ✓ ${dep}@${serverPackageJson.dependencies[dep]}`);
    } else {
        console.log(`   ❌ ${dep} 未找到`);
    }
});
console.log('');

console.log('========== 兼容性检测完成 ✓ ==========');
console.log('\n后续操作:');
console.log('- 启动服务器: cd niuniu_server && npm start');
console.log('- 查看日志: cat logs/*/data');
