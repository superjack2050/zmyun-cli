# 智麦云 CLI 安装指南

以下步骤面向 AI Agent，部分步骤需要用户在浏览器中配合完成。

`zmyun-cli` 默认连接智麦云官方服务：`https://dev.kjdzerp.com`。

## 环境要求

开始安装之前，请确认当前环境已安装：

- Node.js 20 或更新版本
- npm

## 第 1 步 安装

```bash
npm install -g zmyun-cli
```

安装后确认命令可用：

```bash
zmy --version
```

## 第 2 步 登录或重新授权

```bash
zmy auth login
```

命令会输出并尝试打开一个浏览器授权链接。请让用户在浏览器中完成授权，授权完成后终端命令会自动结束。

如果用户之前已经登录过，但后来新增了 Project 写权限，也执行同一个命令重新授权：

```bash
zmy auth login
```

## 第 3 步 验证

```bash
zmy auth status
zmy doctor
```

`zmy auth status` 用于查看当前授权用户和 scope。`zmy doctor` 用于检查本地凭据和后端连通性。

## 第 4 步 使用 Collection 和 Project 命令

```bash
zmy collection list --only-mine --format table
zmy collection list --project-id <project-id> --format table
zmy collection get <collection-id>
zmy collection workflow list --format table

zmy project list --status progressing --format table
zmy project get <project-id>
zmy project status list --format table
zmy project create --name "Project name" --remark "Remark"
zmy project update <project-id> --name "New name"
zmy project update <project-id> --remark ""
zmy project update <project-id> --owner "alice"
zmy project update <project-id> --keywords-file keywords.json
```

## 退出登录

```bash
zmy auth logout
```

该命令会在后端可访问时撤销当前 token，并删除 `~/.zmy-cli` 下的本地凭据。

## 常见问题

如果 `zmy auth status` 提示缺少权限，请重新执行：

```bash
zmy auth login
```

如果全局命令不可用，请确认 npm 全局 bin 目录已经加入 `PATH`。
