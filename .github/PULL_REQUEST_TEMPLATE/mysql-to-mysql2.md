# 迁移: mysql → mysql2

## 概述
将 `mysql` 驱动迁移到 `mysql2`（推荐使用 `mysql2/promise` API），以获得官方维护、更好性能和 Promise 原生支持。

## 迁移原因
- `mysql` 包维护已缓慢，`mysql2` 更活跃并支持 Promise。
- `mysql2` 提供性能优化和连接池改进。

## 变更范围
- 核心 DB 访问层（`db.js`, `db-v1.js` 等）
- 所有直接使用 `mysql` 的模块
- 配置项：可增加 `driver: mysql | mysql2` 选项以支持平滑过渡

## 兼容性与风险
- 风险等级: 高（涉及关键数据层）
- 可能破坏点:
  - 回调式 API → Promise/async-await 迁移
  - 事务处理语法差异
  - 连接配置项差异（字符集、timeZone）

## 迁移策略（双写兼容）
1. 评估与代码审计: 列出所有对 `mysql` 的调用点
2. 新建兼容层 `db-bridge`，对外提供统一接口，内部可切换驱动
3. 安装 `mysql2`: `npm install mysql2@^2.3.0`
4. 在开发/测试分支实现兼容层并运行回归测试
5. 在灰度环境启用 `mysql2` 读取（Dual read/write 可选）
6. 监控数据一致性与性能，执行对比脚本（见 `utils/dual-write.js`）
7. 无异常后，切换全部读写到 `mysql2`
8. 保持旧驱动 7 天只读作为备份，之后删除

## 回滚步骤
- 如果发现数据不一致或性能回退，立即停止 `mysql2` 写入，切换回 `mysql` 并触发回滚脚本恢复备份。

## 验证清单
- [ ] 单元测试覆盖数据库逻辑
- [ ] 集成测试通过
- [ ] 双写一致性验证脚本通过
- [ ] 灰度阶段性能指标无显著回退
- [ ] 数据备份成功并可恢复

## 代码示例
```js
// mysql (旧)
const mysql = require('mysql');
const pool = mysql.createPool(config);
pool.query('SELECT * FROM users WHERE id=?', [id], (err, results) => {});

// mysql2 (新, promise)
const mysql = require('mysql2/promise');
const pool = await mysql.createPool(config);
const [rows] = await pool.execute('SELECT * FROM users WHERE id=?', [id]);
```

## 审查要点
- 事务在 `mysql2` 上的行为是否一致
- 字符集和排序规则是否一致
- 连接池配置是否匹配（min/max/idle）
- 大查询与索引是否产生不同的性能影响

---

*注意*: 此迁移为高风险操作，请在 DBA 与后端负责人共同审批下执行。