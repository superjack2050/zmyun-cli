# zmyun-cli

智麦云 CLI，用于在本机终端和 AI Agent 中操作 ZMY Collection 与 Project 工作流。

CLI 默认连接智麦云官方服务：`https://dev.kjdzerp.com`。

## 让 AI 助手安装

把下面这段提示词复制给你的 AI 助手（Claude Code、Codex、Cursor、Trae 等），它会按安装文档完成安装、登录和验证：

```text
帮我安装智麦云 CLI：https://github.com/superjack2050/zmyun-cli/blob/main/installation-guide.md
```

## 手动安装

```bash
npm install -g zmyun-cli
zmy auth login
zmy auth status
zmy doctor
```

需要 Node.js 20 或更新版本。已经登录过的用户，如果新增了 Project 写权限，请重新执行 `zmy auth login`。

## 常用命令

```bash
zmy collection list --only-mine --format table
zmy collection list --workflow ai-editing --size 10
zmy collection get <collection-id>
zmy collection variants sku patch <collection-id> --sku-id <sku-id> --master-image ./main.jpg
zmy collection variants sku affiliate-image replace <collection-id> --sku-id <sku-id> --old-url <old-url> --new-url <new-url> --dry-run
zmy collection variants sku affiliate-image replace <collection-id> --sku-id <sku-id> --old-url <old-url> --new-file ./fixed.jpg
zmy collection workflow list --format table
zmy collection ai-status list --format table
zmy collection origin list --format table
zmy collection sort list --format table

zmy project list --status progressing --format table
zmy project get <project-id>
zmy project status list --format table
zmy project create --name "Project name" --remark "Remark"
zmy project update <project-id> --name "New name"
zmy project update <project-id> --remark ""
zmy project update <project-id> --owner "alice"
zmy project update <project-id> --keywords-file keywords.json
```

## 本地凭据

`zmy` 会把本地登录凭据保存到 `~/.zmy-cli`，并使用私有文件权限写入。退出登录并删除本地凭据：

```bash
zmy auth logout
```

完整流程见 [installation-guide.md](installation-guide.md)。
