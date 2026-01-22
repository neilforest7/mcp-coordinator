# MCP Control Hub - 产品需求文档 (PRD)

> **版本**: 1.2  
> **更新日期**: 2026-01-22  
> **状态**: 已确认

---

## 1. 项目愿景

打造一个中心化的图形界面工具，管理分布在 Windows 本地与多台远程 Linux 机器上的 MCP (Model Context Protocol) 配置。

### 1.1 核心价值
- **统一入口**：不再手动寻找散落在各处的 `.claude.json` 或 `opencode.json`。
- **环境安全**：在应用配置前，自动验证远程机器的 Node/npx 环境。
- **即时生效**：一键保存并自动重启相关 AI 应用进程。
- **跨平台适配**：自动处理 Windows/Linux 命令格式差异。

---

## 2. 目标用户

| 用户类型 | 场景 | 痛点 |
|---------|------|------|
| **AI 开发者** | 在多台机器上使用 Claude Code 和 OpenCode | 手动编辑 JSON 易出错，格式不一致 |
| **DevOps 工程师** | 管理多台远程 Linux 服务器的 MCP 配置 | 需要 SSH 到每台机器单独操作 |
| **个人用户** | 在 Windows 和远程 Linux 间同步配置 | 跨平台命令格式转换繁琐 |

---

## 3. 管理范围

> ⚠️ **首阶段范围限定**：V1.0 - V1.5 仅管理 **全局 (Global)** MCP 服务器配置。  
> **项目级 (Project-based)** 配置管理将作为 V2.0 的可选功能。

| 范围 | 说明 | 阶段 |
|------|------|------|
| **全局配置** | `~/.claude.json` 和 `~/opencode.json` 中的 MCP 服务器 | V1.0+ |
| **项目级配置** | 项目目录下的 `.claude.json` 和本地 `opencode.json` | V2.0 (规划中) |

---

## 4. 功能模块

### 4.1 机器与层级管理

```
机器 (Machine)
├── 来源 (Source): Claude Code
│   └── 服务器 (Server): browser-tools, playwright, etc.
└── 来源 (Source): OpenCode  
    └── 服务器 (Server): firecrawl-mcp, github-mcp, etc.
```

- **层级结构**：机器 (Machine) > 来源 (Source) > 服务器 (Server)
- **多节点支持**：支持 Windows 本地及无限量远程 Linux 机器
- **来源隔离**：每个机器下独立管理 Claude Code 和 OpenCode 的配置

### 4.2 配置操作 (CRUD)

#### 4.2.1 启用/禁用逻辑

| 来源 | 启用操作 | 禁用操作 |
|------|---------|---------|
| **OpenCode** | 设置 `enabled: true` | 设置 `enabled: false` |
| **Claude Code** | 恢复原键名，设置 `isActive: true` | 设置 `isActive: false` 并**重命名键**为 `_disabled_[原名]` |

> 💡 **Claude Code 禁用策略说明**：  
> 仅设置 `isActive: false` 可能不足以完全禁用服务器。  
> 采用键名重命名（如 `playwright` → `_disabled_playwright`）确保 Claude 应用彻底忽略该配置。

**禁用示例**：
```json
{
  "mcpServers": {
    "_disabled_playwright": {
      "isActive": false,
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

#### 4.2.2 跨来源同步 (Cross-Source Sync)

支持在同一机器内，将 Claude 的配置克隆/更新至 OpenCode（或反向），自动处理字段转换。

**字段映射表**：

| Claude Code | OpenCode | 说明 |
|-------------|----------|------|
| `mcpServers` | `mcp` | 根键名 |
| `isActive` | `enabled` | 启用状态 |
| `env` | `environment` | 环境变量 |
| `command` + `args` | `command` (数组) | 命令结构合并 |
| `type: "stdio"` | `type: "local"` | 本地进程类型 |
| `type: "sse"/"http"` | `type: "remote"` | 远程连接类型 |

**同步模式**：**灵活模式**
- 克隆/同步配置时 **不强制** 执行环境预检
- 仅在用户点击「应用并重启」时触发完整校验
- 允许用户在离线状态下编辑配置，稍后应用

### 4.3 双向同步与冲突解决 (V1.5)

#### 4.3.1 同步机制

支持 Windows 客户端与 Linux 服务端配置的实时比对和双向同步。

```
┌─────────────┐     比对      ┌─────────────┐
│  本地配置   │ ◄──────────► │  远程配置   │
│  (Windows)  │              │  (Linux)    │
└─────────────┘              └─────────────┘
       │                            │
       └──────── MD5 指纹 ──────────┘
```

#### 4.3.2 冲突检测

使用 **MD5 指纹** 监测远程文件变动：

| 场景 | 检测方式 | 处理 |
|------|---------|------|
| 无变更 | 本地指纹 = 远程指纹 | 正常同步 |
| 远程变更 | 上次同步指纹 ≠ 当前远程指纹 | 触发冲突解决流程 |
| 本地变更 | 编辑后自动标记脏状态 | 提示用户推送 |

#### 4.3.3 冲突解决 UI

当检测到冲突时，提供 **Diff 视图** 让用户决策：

```
┌────────────────────────────────────────────────────┐
│  ⚠️ 配置冲突检测                                   │
├────────────────────────────────────────────────────┤
│  本地版本 (Windows)     │  远程版本 (Linux)        │
│  ─────────────────────  │  ─────────────────────   │
│  "playwright": {        │  "playwright": {         │
│ -  "isActive": true,    │ +  "isActive": false,    │
│    "command": "npx"     │    "command": "npx"      │
│  }                      │  }                       │
├────────────────────────────────────────────────────┤
│  [保留本地] [保留远程] [手动合并] [取消]           │
└────────────────────────────────────────────────────┘
```

**决策选项**：
| 选项 | 行为 |
|------|------|
| **保留本地** | 用本地版本覆盖远程 |
| **保留远程** | 用远程版本覆盖本地 |
| **手动合并** | 打开编辑器让用户逐字段选择 |
| **取消** | 放弃本次同步 |

### 4.4 跨平台命令适配

#### 4.4.1 命令格式转换规则

| 平台 | Claude Code 格式 | OpenCode 格式 |
|------|-----------------|---------------|
| **Linux** | `"command": "npx"`, `"args": ["-y", "pkg"]` | `"command": ["npx", "-y", "pkg"]` |
| **Windows** | `"command": "cmd"`, `"args": ["/c", "npx", "-y", "pkg"]` | `"command": ["cmd", "/c", "npx", "-y", "pkg"]` |

#### 4.4.2 二进制路径处理

| 工具 | Linux | Windows |
|------|-------|---------|
| **npx** | `npx` (PATH) | `cmd /c npx` 或绝对路径 |
| **uvx** | `uvx` (PATH) | `uvx.exe` 或 `C:\Users\...\uvx.exe` |
| **uv** | `uv` | `uv.exe` |

### 4.5 自动化维护

#### 4.5.1 环境预检

```bash
# Linux 检测脚本
NPX_PATH=$(which npx)
if [ -z "$NPX_PATH" ]; then echo "ERR_NO_NPX"; exit 1; fi
NPX_VERSION=$($NPX_PATH -v | cut -d'.' -f1)
echo "SUCCESS|$NPX_PATH|$NPX_VERSION"
```

**预检项目**：
- [ ] npx 路径是否存在
- [ ] npx 版本 ≥ 8.0.0
- [ ] Node.js 版本兼容性

#### 4.5.2 核能重启 (Nuclear Restart)

应用配置后，强杀所有关联的 CLI 进程以强制重载。

| 平台 | 命令 |
|------|------|
| Windows | `taskkill /F /IM Claude.exe` |
| Linux | `pkill -f "claude" \|\| true` |

---

## 5. 数据模型

### 5.1 配置文件位置

| 来源 | 平台 | 默认路径 |
|------|------|---------|
| Claude Code | Windows | `%APPDATA%\Claude\.claude.json` 或 `~/.claude.json` |
| Claude Code | Linux | `~/.claude.json` |
| OpenCode | Windows | `%USERPROFILE%\opencode.json` 或项目根目录 |
| OpenCode | Linux | `~/opencode.json` 或项目根目录 |

### 5.2 JSON 结构对比

#### Claude Code (.claude.json)

```json
{
  "mcpServers": {
    "server-name": {
      "isActive": true,
      "name": "server-name",
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@package/name"],
      "env": {
        "API_KEY": "xxx"
      }
    }
  },
  "projects": { ... },
  "userID": "...",
  "numStartups": 115
}
```

#### OpenCode (opencode.json)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["plugin-name"],
  "provider": {
    "google": {
      "models": { ... }
    }
  },
  "mcp": {
    "server-name": {
      "type": "local",
      "command": ["npx", "-y", "@package/name"],
      "environment": {
        "API_KEY": "xxx"
      },
      "enabled": true
    }
  }
}
```

### 5.3 增量修改算法

- **原子性**：禁止全量覆盖。必须读取 -> 解析 -> 仅修改 `mcpServers` 或 `mcp` 节点 -> 回写
- **格式保留**：保留用户原始 JSON 的缩进（2 空格）和其他非相关节点
- **安全备份**：修改前自动创建 `.bak` 备份文件

---

## 6. 技术规格

### 6.1 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| **框架** | Tauri 2.0 (Rust) | 跨平台桌面应用 |
| **前端** | React + TypeScript | 用户界面 |
| **UI 库** | Shadcn UI + Tailwind CSS | 组件库 |
| **存储** | SQLite (加密) | 连接信息存储 |
| **SSH** | russh | Rust 异步 SSH 库 |
| **加密** | AES-256-GCM | 敏感数据加密 |

### 6.2 安全方案

| 组件 | 方案 |
|------|------|
| **私钥存储** | AES-256-GCM 加密后存入 SQLite |
| **Master Key** | Windows: 凭据管理器 / Linux: libsecret |
| **运行时** | 私钥仅在内存中解密，严禁落盘 |
| **传输** | SSH 隧道加密通信 |

### 6.3 目录结构

```
src-tauri/
├── src/
│   ├── ssh/           # SSH 连接池和远程命令执行
│   ├── config/        # JSON 解析与增量写入
│   └── main.rs        # 入口
src/
├── components/        # React UI 组件
│   ├── MachineSidebar.tsx
│   ├── SourceTabs.tsx
│   └── ServerCard.tsx
├── hooks/             # 配置同步和环境检查
└── App.tsx
```

---

## 7. 路线图

### V1.0 (MVP)
- [ ] 核心链路：读取/修改本地配置
- [ ] SSH 加密存储：安全管理远程连接
- [ ] 单来源 CRUD：基本增删改查
- [ ] 预检与重启：环境验证和进程重启

### V1.5
- [ ] 跨来源同步：Claude ↔ OpenCode 配置转换
- [ ] 双向同步冲突解决
- [ ] 批量操作支持

### V2.0
- [ ] 项目级配置管理
- [ ] MCP 市场一键安装
- [ ] 配置模板和导入导出

---

## 8. 附录

### 8.1 MCP Server 类型对照表

| 功能类型 | Claude Code 示例 | OpenCode 示例 |
|---------|-----------------|---------------|
| **浏览器自动化** | `playwright`, `browsermcp` | 同 |
| **数据库** | `postgres-mcp`, `sqlite` | 同 |
| **API 集成** | `github-mcp`, `firecrawl-mcp` | 同 |
| **开发工具** | `desktop-commander`, `Context7` | 同 |

### 8.2 已知差异点

1. **HTTP 类型差异**：
   - Claude: `type: "http"` 或 `type: "sse"`
   - OpenCode: `type: "remote"` + `url` 字段

2. **Windows 路径转义**：
   - Claude: `"C:\\\\Users\\\\..."` (双转义)
   - OpenCode: `"C:\\Users\\..."` (单转义)

3. **特殊字段**：
   - Claude 独有: `numStartups`, `projects`, `tipsHistory`
   - OpenCode 独有: `$schema`, `plugin`, `provider`
