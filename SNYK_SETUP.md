# Snyk 集成与设置说明

本仓库已在 CI 工作流中集成 Snyk（见 `.github/workflows/security-scan.yml`），但需要在 GitHub 仓库中配置 `SNYK_TOKEN` 才能启用完整扫描并上传报告。

## 1. 创建并设置 SNYK_TOKEN

1. 访问 https://snyk.io 并登录你的组织账号。
2. 在 Snyk 控制台中找到 `Account settings → API token`，复制 token。
3. 在 GitHub 仓库中：`Settings → Secrets and variables → Actions → New repository secret`。
4. 名称填写 `SNYK_TOKEN`，值填写上一步复制的 token，保存。

## 2. CI 行为

- 如果 `SNYK_TOKEN` 配置正确，CI 的 `snyk-scan` job 会运行完整扫描并上传结果到 GitHub Security。  
- 如果未配置，CI 中新增的验证步骤会提示并失败，防止误认为 Snyk 已生效。

## 3. 本地运行 Snyk（可选）

在本地机器上测试 Snyk，先安装 CLI 并登录：

```bash
npm install -g snyk
snyk auth <your-snyk-token>

# 在项目目录运行扫描
cd niuniu_server
snyk test --severity-threshold=high
```

## 4. 常见问题

- Q: 我没有 Snyk 账户，能否只用 `npm audit`？  
  A: 可以。`npm audit` 已经被集成为 `npm-audit` job，并会在 CI 中生成报告。

- Q: 我希望 CI 在没有 SNYK_TOKEN 时跳过 Snyk 而不是失败？  
  A: 可以修改 `.github/workflows/security-scan.yml`，将 Snyk 步骤设为 `if: ${{ secrets.SNYK_TOKEN != '' }}`。当前仓库选择在未配置时显式失败以提醒设置。

## 5. 权限建议

- 仅将 Snyk token 存放在仓库的 `Actions` secrets 中，不要在代码或其它地方泄露。  
- 推荐至少在 `main` 分支启用 Snyk 扫描并设置邮件/Slack 通知以便安全团队及时响应。

---

需要我现在把 `SNYK_TOKEN` 检查修改为“跳过而非失败”吗？如果你愿意我也可以帮你在仓库设置文档中加入 Slack 通知的示例。