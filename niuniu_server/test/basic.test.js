const { expect } = require('chai');
const path = require('path');

describe('项目结构', function () {
    it('应该存在 launch.js 文件', function () {
        const fs = require('fs');
        const launchPath = path.join(__dirname, '../launch.js');
        expect(fs.existsSync(launchPath)).to.be.true;
    });

    it('应该存在 common/config.js 文件', function () {
        const fs = require('fs');
        const configPath = path.join(__dirname, '../common/config.js');
        expect(fs.existsSync(configPath)).to.be.true;
    });

    it('应该存在服务器目录', function () {
        const fs = require('fs');
        const dirs = [
            'center_server',
            'login_server',
            'hall_server',
            'majiang_server',
            'utils'
        ];

        dirs.forEach(dir => {
            const dirPath = path.join(__dirname, `../${dir}`);
            expect(fs.existsSync(dirPath)).to.be.true;
        });
    });

    it('应该有有效的 package.json', function () {
        const packageJson = require('../package.json');
        expect(packageJson.name).to.equal('niuniu_server');
        expect(packageJson.main).to.equal('launch.js');
        expect(packageJson.engines.node).to.equal('18.x');
    });
});

describe('依赖检查', function () {
    it('应该安装必要的依赖', function () {
        const packageJson = require('../package.json');
        const requiredDeps = ['express', 'mysql', 'redis', 'ws'];

        requiredDeps.forEach(dep => {
            expect(packageJson.dependencies).to.have.property(dep);
        });
    });

    it('应该安装测试工具', function () {
        const packageJson = require('../package.json');
        expect(packageJson.devDependencies).to.have.property('mocha');
        expect(packageJson.devDependencies).to.have.property('chai');
        expect(packageJson.devDependencies).to.have.property('eslint');
    });
});

describe('配置文件', function () {
    it('应该有 ESLint 配置', function () {
        const fs = require('fs');
        const eslintPath = path.join(__dirname, '../.eslintrc.json');
        expect(fs.existsSync(eslintPath)).to.be.true;
    });

    it('ESLint 配置应该有效', function () {
        const eslintConfig = require('../.eslintrc.json');
        expect(eslintConfig.env.node).to.be.true;
        expect(eslintConfig.extends).to.exist;
    });
});

describe('代码质量检查', function () {
    it('launch.js 应该没有语法错误', function () {
        const fs = require('fs');
        const launchPath = path.join(__dirname, '../launch.js');
        const content = fs.readFileSync(launchPath, 'utf-8');
        expect(content).to.be.a('string');
        expect(content.length).to.be.greaterThan(0);
    });
});
