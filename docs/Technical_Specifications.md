# 技术规格说明书 (Technical Specifications)

> **版本**: 1.1  
> **更新日期**: 2026-01-22

---

## 1. 技术栈

| 层级 | 技术 | 版本要求 |
|------|------|---------|
| **框架** | Tauri (Rust) | 2.0+ |
| **前端** | React + TypeScript | React 18+ |
| **UI** | Shadcn UI + Tailwind CSS | - |
| **存储** | SQLite (加密) | - |
| **SSH** | russh (Rust 异步 SSH 库) | 0.40+ |
| **加密** | aes-gcm | 0.10+ |
| **凭据** | keyring | 2.0+ |

---

## 2. JSON 结构规范

### 2.1 Claude Code (.claude.json)

```typescript
interface ClaudeConfig {
  mcpServers: {
    [serverName: string]: ClaudeMCPServer;
  };
  projects?: Record<string, ProjectConfig>;
  userID?: string;
  numStartups?: number;
  // ... 其他用户偏好字段
}

interface ClaudeMCPServer {
  isActive?: boolean;      // 启用状态
  name?: string;           // 服务器名称
  type?: "stdio" | "sse" | "http";  // 连接类型
  command?: string;        // 命令 (分离模式)
  args?: string[];         // 参数数组
  env?: Record<string, string>;  // 环境变量
  url?: string;            // HTTP/SSE 类型的 URL
  headers?: Record<string, string>;  // HTTP 头
}
```

### 2.2 OpenCode (opencode.json)

```typescript
interface OpenCodeConfig {
  $schema?: string;
  plugin?: string[];
  provider?: ProviderConfig;
  mcp: {
    [serverName: string]: OpenCodeMCPServer;
  };
}

interface OpenCodeMCPServer {
  type: "local" | "remote";  // 连接类型
  command?: string[];        // 命令数组 (合并模式)
  environment?: Record<string, string>;  // 环境变量
  enabled?: boolean;         // 启用状态
  url?: string;              // remote 类型的 URL
  headers?: Record<string, string>;  // HTTP 头
}
```

---

## 3. 配置转换逻辑

### 3.1 字段映射表

| Claude Code | OpenCode | 转换规则 |
|-------------|----------|---------|
| `mcpServers[key]` | `mcp[key]` | 直接映射 |
| `isActive` | `enabled` | 直接映射 |
| `env` | `environment` | 直接映射 |
| `command` + `args` | `command` | 合并为数组 |
| `type: "stdio"` | `type: "local"` | 类型转换 |
| `type: "sse"` | `type: "remote"` | 类型转换 |
| `type: "http"` | `type: "remote"` | 类型转换 |

### 3.2 转换算法 (Claude -> OpenCode)

```typescript
function claudeToOpenCode(
  claudeServer: ClaudeMCPServer,
  targetPlatform: "linux" | "windows"
): OpenCodeMCPServer {
  // 1. 类型转换
  let openCodeType: "local" | "remote";
  if (claudeServer.type === "stdio" || !claudeServer.type) {
    openCodeType = "local";
  } else {
    openCodeType = "remote";
  }
  
  // 2. 命令合并
  let command: string[] | undefined;
  if (claudeServer.command && claudeServer.args) {
    command = [claudeServer.command, ...claudeServer.args];
  } else if (claudeServer.command) {
    command = [claudeServer.command];
  }
  
  // 3. 平台适配
  if (targetPlatform === "windows" && command && !command[0].includes("cmd")) {
    // 非 Windows 格式转 Windows
    command = ["cmd", "/c", ...command];
  } else if (targetPlatform === "linux" && command && command[0] === "cmd") {
    // Windows 格式转 Linux
    command = command.slice(2); // 移除 "cmd", "/c"
  }
  
  return {
    type: openCodeType,
    command: openCodeType === "local" ? command : undefined,
    url: openCodeType === "remote" ? claudeServer.url : undefined,
    environment: claudeServer.env,
    enabled: claudeServer.isActive ?? true,
    headers: claudeServer.headers
  };
}
```

### 3.3 转换算法 (OpenCode -> Claude)

```typescript
function openCodeToClaude(
  openCodeServer: OpenCodeMCPServer,
  targetPlatform: "linux" | "windows"
): ClaudeMCPServer {
  // 1. 类型转换
  let claudeType: "stdio" | "sse" | "http";
  if (openCodeServer.type === "local") {
    claudeType = "stdio";
  } else {
    claudeType = "http"; // 默认使用 http
  }
  
  // 2. 命令拆分
  let command: string | undefined;
  let args: string[] | undefined;
  
  if (openCodeServer.command && openCodeServer.command.length > 0) {
    command = openCodeServer.command[0];
    args = openCodeServer.command.slice(1);
  }
  
  // 3. 平台适配
  if (targetPlatform === "windows" && command && command !== "cmd") {
    // 添加 cmd /c 前缀
    args = ["/c", command, ...(args || [])];
    command = "cmd";
  } else if (targetPlatform === "linux" && command === "cmd") {
    // 移除 cmd /c 前缀
    command = args?.[1] || "npx";
    args = args?.slice(2);
  }
  
  return {
    isActive: openCodeServer.enabled ?? true,
    type: claudeType,
    command,
    args,
    env: openCodeServer.environment,
    url: openCodeServer.url,
    headers: openCodeServer.headers
  };
}
```

---

## 4. 增量修改算法

### 4.1 核心原则

- **原子性**：禁止全量覆盖。必须读取 -> 解析 -> 仅修改目标节点 -> 回写
- **格式保留**：保留用户原始 JSON 的缩进和非相关节点
- **备份机制**：修改前自动创建 `.bak` 备份

### 4.2 伪代码

```rust
fn update_mcp_config(
    file_path: &Path,
    server_name: &str,
    new_config: Value,
    source_type: SourceType, // Claude | OpenCode
) -> Result<()> {
    // 1. 读取原文件
    let original = fs::read_to_string(file_path)?;
    
    // 2. 备份
    fs::write(file_path.with_extension("json.bak"), &original)?;
    
    // 3. 解析 JSON (保留格式信息)
    let mut root: Value = serde_json::from_str(&original)?;
    
    // 4. 仅修改目标节点
    let mcp_key = match source_type {
        SourceType::Claude => "mcpServers",
        SourceType::OpenCode => "mcp",
    };
    
    if let Some(servers) = root.get_mut(mcp_key) {
        servers[server_name] = new_config;
    }
    
    // 5. 回写 (保留 2 空格缩进)
    let output = serde_json::to_string_pretty(&root)?;
    fs::write(file_path, output)?;
    
    Ok(())
}
```

---

## 5. 跨平台命令适配

### 5.1 命令格式对照表

| 场景 | Linux 格式 | Windows 格式 |
|------|-----------|-------------|
| **npx 运行** | `["npx", "-y", "@pkg/name"]` | `["cmd", "/c", "npx", "-y", "@pkg/name"]` |
| **uvx 运行** | `["uvx", "mcp-server-fetch"]` | `["uvx.exe", "mcp-server-fetch"]` |
| **绝对路径** | `["/usr/bin/uvx", "..."]` | `["C:\\Users\\...\\uvx.exe", "..."]` |
| **Docker** | `["docker", "run", ...]` | `["docker.exe", "run", ...]` |

### 5.2 路径转义规则

| 平台 | JSON 中的表示 | 实际路径 |
|------|-------------|---------|
| Linux | `"/opt/path/to/file"` | `/opt/path/to/file` |
| Windows (Claude) | `"C:\\\\Users\\\\name"` | `C:\Users\name` |
| Windows (OpenCode) | `"C:\\Users\\name"` | `C:\Users\name` |

> ⚠️ **注意**: Claude Code 的 Windows 路径使用双重转义

---

## 6. 安全方案

### 6.1 SSH 私钥存储

```
+------------------+     +------------------+     +------------------+
| 用户输入私钥文本  | --> | AES-256-GCM 加密 | --> | SQLite 存储密文   |
+------------------+     +------------------+     +------------------+
                                ^
                                |
                         +------------------+
                         | Master Key       |
                         | (系统凭据管理器)   |
                         +------------------+
```

### 6.2 密钥管理

| 平台 | Master Key 存储位置 |
|------|-------------------|
| Windows | Windows 凭据管理器 (Credential Manager) |
| Linux | libsecret / GNOME Keyring |
| macOS | Keychain |

### 6.3 运行时安全

- 私钥仅在内存中解密使用
- 使用后立即清零内存
- 严禁写入临时文件或日志

---

## 7. 自动化脚本

### 7.1 环境检查 (Linux)

```bash
#!/bin/bash
# 检查 npx 环境
NPX_PATH=$(which npx 2>/dev/null)
if [ -z "$NPX_PATH" ]; then 
    echo "ERR_NO_NPX"
    exit 1
fi

NPX_VERSION=$($NPX_PATH -v 2>/dev/null | cut -d'.' -f1)
if [ "$NPX_VERSION" -lt 8 ]; then
    echo "ERR_NPX_VERSION|$NPX_VERSION"
    exit 1
fi

echo "SUCCESS|$NPX_PATH|$NPX_VERSION"
```

### 7.2 环境检查 (Windows PowerShell)

```powershell
# 检查 npx 环境
$npxPath = (Get-Command npx -ErrorAction SilentlyContinue).Path
if (-not $npxPath) {
    Write-Output "ERR_NO_NPX"
    exit 1
}

$npxVersion = (npx -v) -split '\.' | Select-Object -First 1
if ([int]$npxVersion -lt 8) {
    Write-Output "ERR_NPX_VERSION|$npxVersion"
    exit 1
}

Write-Output "SUCCESS|$npxPath|$npxVersion"
```

### 7.3 进程重启

| 平台 | 命令 |
|------|------|
| Windows | `taskkill /F /IM Claude.exe` |
| Linux | `pkill -f "claude" \|\| true` |

---

## 8. 错误处理

### 8.1 错误码定义

| 错误码 | 描述 | 处理方式 |
|-------|------|---------|
| `ERR_NO_NPX` | 未找到 npx | 提示用户安装 Node.js |
| `ERR_NPX_VERSION` | npx 版本过低 | 提示升级 Node.js |
| `ERR_SSH_CONNECT` | SSH 连接失败 | 检查凭据和网络 |
| `ERR_SSH_AUTH` | SSH 认证失败 | 检查私钥和用户名 |
| `ERR_JSON_PARSE` | JSON 解析失败 | 显示原始文件让用户修复 |
| `ERR_JSON_WRITE` | JSON 写入失败 | 检查文件权限 |
