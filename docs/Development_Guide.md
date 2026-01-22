# 开发启动指南 (Development Guide)

> **版本**: 1.1  
> **更新日期**: 2026-01-22

---

## 1. 项目初始化

### 1.1 创建 Tauri 项目

```bash
# 使用官方模板创建
npm create tauri-app@latest mcp-control-hub -- --template react-ts

# 进入项目目录
cd mcp-control-hub
```

### 1.2 安装前端依赖

```bash
# 核心依赖
npm install @tanstack/react-query zustand

# UI 组件
npx shadcn@latest init
npx shadcn@latest add button card dialog input label tabs toast

# 开发工具
npm install -D @types/node
```

---

## 2. Rust 依赖配置

### 2.1 Cargo.toml

```toml
[package]
name = "mcp-control-hub"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2.0", features = ["api-all"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# SSH 连接
russh = "0.40"
russh-keys = "0.40"

# 加密存储
aes-gcm = "0.10"
rand = "0.8"

# 系统凭据管理
keyring = "2.0"

# 数据库
rusqlite = { version = "0.29", features = ["bundled"] }

# 异步运行时
tokio = { version = "1.0", features = ["full"] }

# 错误处理
thiserror = "1.0"
anyhow = "1.0"
```

---

## 3. 目录结构

```
mcp-control-hub/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs              # Tauri 入口
│   │   ├── lib.rs               # 模块导出
│   │   ├── commands/            # Tauri 命令
│   │   │   ├── mod.rs
│   │   │   ├── config.rs        # 配置读写命令
│   │   │   ├── ssh.rs           # SSH 操作命令
│   │   │   └── system.rs        # 系统操作命令
│   │   ├── config/              # 配置解析模块
│   │   │   ├── mod.rs
│   │   │   ├── claude.rs        # Claude 配置解析
│   │   │   ├── opencode.rs      # OpenCode 配置解析
│   │   │   └── converter.rs     # 配置转换器
│   │   ├── ssh/                 # SSH 模块
│   │   │   ├── mod.rs
│   │   │   ├── connection.rs    # 连接管理
│   │   │   └── executor.rs      # 远程命令执行
│   │   ├── storage/             # 存储模块
│   │   │   ├── mod.rs
│   │   │   ├── database.rs      # SQLite 操作
│   │   │   └── encryption.rs    # 加密/解密
│   │   └── utils/               # 工具函数
│   │       ├── mod.rs
│   │       └── platform.rs      # 平台检测
│   └── Cargo.toml
├── src/
│   ├── App.tsx                  # 主应用
│   ├── main.tsx                 # 入口
│   ├── components/              # UI 组件
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx      # 侧边栏
│   │   │   └── Header.tsx       # 头部
│   │   ├── machine/
│   │   │   ├── MachineCard.tsx  # 机器卡片
│   │   │   └── MachineForm.tsx  # 添加机器表单
│   │   ├── source/
│   │   │   ├── SourceTabs.tsx   # 来源标签页
│   │   │   └── SourceConfig.tsx # 来源配置
│   │   └── server/
│   │       ├── ServerCard.tsx   # 服务器卡片
│   │       ├── ServerForm.tsx   # 服务器编辑表单
│   │       └── ServerSync.tsx   # 同步对话框
│   ├── hooks/                   # 自定义 Hooks
│   │   ├── useConfig.ts         # 配置操作
│   │   ├── useMachine.ts        # 机器管理
│   │   └── useSync.ts           # 同步逻辑
│   ├── stores/                  # 状态管理
│   │   ├── machineStore.ts      # 机器状态
│   │   └── configStore.ts       # 配置状态
│   ├── lib/                     # 工具库
│   │   ├── tauri.ts             # Tauri 命令封装
│   │   └── utils.ts             # 通用工具
│   └── types/                   # TypeScript 类型
│       ├── machine.ts           # 机器类型
│       ├── config.ts            # 配置类型
│       └── server.ts            # 服务器类型
├── package.json
└── README.md
```

---

## 4. 核心类型定义

### 4.1 TypeScript 类型 (src/types/)

```typescript
// types/machine.ts
export interface Machine {
  id: string;
  name: string;
  type: "local" | "remote";
  host?: string;
  port?: number;
  username?: string;
  // 私钥加密存储，不在此处暴露
}

// types/config.ts
export type SourceType = "claude" | "opencode";

export interface MCPServer {
  name: string;
  enabled: boolean;
  type: "local" | "remote";
  command?: string[];
  environment?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

export interface SourceConfig {
  type: SourceType;
  filePath: string;
  servers: MCPServer[];
  lastModified?: Date;
}

// types/server.ts
export interface SyncOptions {
  sourceType: SourceType;
  targetType: SourceType;
  servers: string[];  // 要同步的服务器名称
  mode: "overwrite" | "merge";
}
```

---

## 5. Tauri 命令示例

### 5.1 配置读取命令

```rust
// src-tauri/src/commands/config.rs
use tauri::command;
use crate::config::{claude::ClaudeConfig, opencode::OpenCodeConfig};

#[command]
pub async fn read_claude_config(path: String) -> Result<ClaudeConfig, String> {
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let config: ClaudeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;
    
    Ok(config)
}

#[command]
pub async fn read_opencode_config(path: String) -> Result<OpenCodeConfig, String> {
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let config: OpenCodeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;
    
    Ok(config)
}
```

### 5.2 SSH 连接命令

```rust
// src-tauri/src/commands/ssh.rs
use tauri::command;
use crate::ssh::connection::SshConnection;

#[command]
pub async fn test_ssh_connection(
    host: String,
    port: u16,
    username: String,
    private_key: String,
) -> Result<bool, String> {
    let conn = SshConnection::new(&host, port, &username, &private_key)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;
    
    // 测试执行简单命令
    let output = conn.execute("echo 'test'")
        .await
        .map_err(|e| format!("Command failed: {}", e))?;
    
    Ok(output.contains("test"))
}
```

---

## 6. 前端集成示例

### 6.1 Tauri 命令调用

```typescript
// src/lib/tauri.ts
import { invoke } from "@tauri-apps/api/core";
import type { ClaudeConfig, OpenCodeConfig } from "@/types/config";

export async function readClaudeConfig(path: string): Promise<ClaudeConfig> {
  return invoke("read_claude_config", { path });
}

export async function readOpenCodeConfig(path: string): Promise<OpenCodeConfig> {
  return invoke("read_opencode_config", { path });
}

export async function testSshConnection(
  host: string,
  port: number,
  username: string,
  privateKey: string
): Promise<boolean> {
  return invoke("test_ssh_connection", { host, port, username, privateKey });
}
```

### 6.2 React Hook 示例

```typescript
// src/hooks/useConfig.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { readClaudeConfig, readOpenCodeConfig } from "@/lib/tauri";

export function useClaudeConfig(path: string) {
  return useQuery({
    queryKey: ["claude-config", path],
    queryFn: () => readClaudeConfig(path),
    enabled: !!path,
  });
}

export function useOpenCodeConfig(path: string) {
  return useQuery({
    queryKey: ["opencode-config", path],
    queryFn: () => readOpenCodeConfig(path),
    enabled: !!path,
  });
}
```

---

## 7. 开发工作流

### 7.1 日常开发

```bash
# 启动开发服务器
npm run tauri dev

# 仅前端开发 (不启动 Tauri)
npm run dev

# 类型检查
npm run typecheck

# 代码格式化
npm run format
```

### 7.2 构建发布

```bash
# 构建生产版本
npm run tauri build

# 输出位置
# Windows: src-tauri/target/release/bundle/msi/
# macOS: src-tauri/target/release/bundle/dmg/
# Linux: src-tauri/target/release/bundle/deb/
```

---

## 8. 测试策略

### 8.1 Rust 单元测试

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_claude_to_opencode_conversion() {
        let claude_server = ClaudeMCPServer {
            is_active: Some(true),
            command: Some("npx".to_string()),
            args: Some(vec!["-y".to_string(), "@pkg/name".to_string()]),
            env: None,
            ..Default::default()
        };
        
        let opencode_server = claude_to_opencode(&claude_server, Platform::Linux);
        
        assert_eq!(opencode_server.enabled, Some(true));
        assert_eq!(opencode_server.command, Some(vec![
            "npx".to_string(), "-y".to_string(), "@pkg/name".to_string()
        ]));
    }
}
```

### 8.2 前端测试

```typescript
// __tests__/converter.test.ts
import { claudeToOpenCode } from "@/lib/converter";

describe("Config Converter", () => {
  it("should convert Claude config to OpenCode format", () => {
    const claudeServer = {
      isActive: true,
      command: "npx",
      args: ["-y", "@pkg/name"],
    };
    
    const openCodeServer = claudeToOpenCode(claudeServer, "linux");
    
    expect(openCodeServer.enabled).toBe(true);
    expect(openCodeServer.command).toEqual(["npx", "-y", "@pkg/name"]);
  });
});
```
