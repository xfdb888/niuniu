const { expect } = require('chai');

describe('工具函数', function () {
    describe('基础工具', function () {
        it('应该能导入 utils 模块', function () {
            const utils = require('../utils/utils');
            expect(utils).to.be.an('object');
        });

        it('应该能导入 config 模块', function () {
            const config = require('../common/config');
            expect(config).to.be.an('object');
        });
    });

    describe('日志系统', function () {
        it('应该能导入 logger 模块', function () {
            const logger = require('../utils/logger');
            expect(logger).to.be.an('object');
        });

        it('logger 应该有必要的方法', function () {
            const logger = require('../utils/logger');
            expect(logger).to.have.property('info');
            expect(logger).to.have.property('error');
            expect(logger).to.have.property('warn');
        });
    });

    describe('数据库', function () {
        it('应该能导入数据库模块', function () {
            const db = require('../utils/db');
            expect(db).to.be.an('object');
        });

        it('应该能导入数据库暂存模块', function () {
            const dbStage = require('../utils/dbStage');
            expect(dbStage).to.be.an('object');
        });
    });
});

describe('网络通信', function () {
    it('应该能导入 socket 模块', function () {
        const socket = require('../utils/socket');
        expect(socket).to.be.an('object');
    });

    it('应该能导入 HTTP 模块', function () {
        const http = require('../utils/http');
        expect(http).to.be.an('object');
    });
});
