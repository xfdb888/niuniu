# 迁移: request → axios

## 概述
将所有 `request` 使用替换为 `axios`，移除已弃用的 `request` 包，使用 `axios` 提供更现代的 Promise 接口和更好的维护支持。

## 迁移原因
- `request` 已被官方弃用（不再维护）。
- `axios` 支持 Promise/async-await，体积小、维护活跃。

## 变更范围
- 替换文件列表（示例）:
  - `utils/http.js`
  - `utils/someApiCaller.js`
  - `scripts/*`（所有使用 request 的脚本）

## 兼容性与风险
- 风险等级: 中
- 可能破坏点:
  - `request` 的流式用法需重写为 `axios` 的流或者 Node stream
  - 某些请求选项（multipart/form-data）语法不同

## 迁移步骤
1. 创建分支: `git checkout -b migrate/request-to-axios`
2. 安装 `axios`: `npm install axios@^1.6.0`
3. 在项目中查找 `request` 使用: `grep -R "require('request')" -n .`
4. 逐文件替换为 `axios`:
   - 使用 `axios` 的 `axios(config)` 或 `axios.get/post` 风格
   - 使用 `FormData` 或 `form-data` 处理 multipart
5. 运行单元测试: `npm test`
6. 运行集成测试并本地压力测试
7. 提交 PR，标注需要至少 2 个 reviewer
8. 合并后在测试环境灰度部署

## 回滚步骤
- 如果发现问题，回滚 PR（restore `request` 版本），并立即执行 `./rollback.sh --version <previous>` 回滚到上一个镜像。

## 验证清单
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] Locust/WRK 压力测试基线无回归
- [ ] 灰度期观察 24 小时无重大异常

## 必要变更示例
```js
// 旧：
const request = require('request');
request({ url: url, method: 'GET' }, (err, res, body) => {});

// 新：
const axios = require('axios');
axios.get(url).then(res => {}).catch(err => {});
```

## 代码审查要点
- 确认所有错误处理逻辑（status code、timeout）正确迁移
- 确认 `Content-Type` 和 `Accept` 头一致
- 对于较复杂的 multipart 流，确认使用 `form-data` 的正确实现

---

*模板由 DevOps 自动生成，迁移完成后请移除对此模板的引用。*