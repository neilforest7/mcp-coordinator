use super::{ClaudeMCPServer, OpenCodeMCPServer};
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub enum Platform {
    Linux,
    Windows,
}

impl FromStr for Platform {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "linux" => Ok(Platform::Linux),
            "windows" => Ok(Platform::Windows),
            _ => Ok(Platform::Linux), // Default to Linux for now or return error?
                                      // Existing code in remote.rs seems to return "windows" or other strings.
                                      // Let's stick to safe default or error.
                                      // Given this is for path conversion, defaulting to Linux (forward slashes) is safer than Windows if unknown.
        }
    }
}

impl Platform {
    #[allow(dead_code)]
    pub fn current() -> Self {
        if cfg!(target_os = "windows") {
            Platform::Windows
        } else {
            Platform::Linux
        }
    }
}

#[allow(dead_code)]
pub fn claude_to_opencode(
    server: &ClaudeMCPServer,
    target_platform: Platform,
) -> OpenCodeMCPServer {
    let server_type = match server.server_type.as_deref() {
        Some("stdio") | None => "local".to_string(),
        Some("sse") | Some("http") => "remote".to_string(),
        Some(other) => other.to_string(),
    };

    let command = if server_type == "local" {
        match (&server.command, &server.args) {
            (Some(cmd), Some(args)) => {
                let mut full_cmd = vec![cmd.clone()];
                full_cmd.extend(args.clone());
                adapt_command_for_platform(full_cmd, target_platform)
            }
            (Some(cmd), None) => Some(vec![cmd.clone()]),
            _ => None,
        }
    } else {
        None
    };

    OpenCodeMCPServer {
        server_type,
        command,
        environment: server.env.clone(),
        enabled: Some(server.is_active.unwrap_or(true)),
        url: server.url.clone(),
        headers: server.headers.clone(),
    }
}

#[allow(dead_code)]
pub fn opencode_to_claude(
    server: &OpenCodeMCPServer,
    target_platform: Platform,
) -> ClaudeMCPServer {
    let server_type = match server.server_type.as_str() {
        "local" => Some("stdio".to_string()),
        "remote" => Some("http".to_string()),
        other => Some(other.to_string()),
    };

    let (command, args) = if let Some(cmd_array) = &server.command {
        if cmd_array.is_empty() {
            (None, None)
        } else {
            let adapted = adapt_command_for_platform(cmd_array.clone(), target_platform);
            if let Some(full_cmd) = adapted {
                if full_cmd.len() > 1 {
                    (Some(full_cmd[0].clone()), Some(full_cmd[1..].to_vec()))
                } else {
                    (Some(full_cmd[0].clone()), None)
                }
            } else {
                (None, None)
            }
        }
    } else {
        (None, None)
    };

    ClaudeMCPServer {
        is_active: server.enabled,
        name: None,
        server_type,
        command,
        args,
        env: server.environment.clone(),
        url: server.url.clone(),
        headers: server.headers.clone(),
    }
}

#[allow(dead_code)]
fn adapt_command_for_platform(mut command: Vec<String>, target: Platform) -> Option<Vec<String>> {
    if command.is_empty() {
        return None;
    }

    let is_windows_format = command.first().map(|s| s == "cmd").unwrap_or(false);

    match (is_windows_format, target) {
        (true, Platform::Linux) => {
            if command.len() >= 3 && command[1] == "/c" {
                Some(command[2..].to_vec())
            } else {
                Some(command)
            }
        }
        (false, Platform::Windows) => {
            let mut new_cmd = vec!["cmd".to_string(), "/c".to_string()];
            new_cmd.append(&mut command);
            Some(new_cmd)
        }
        _ => Some(command),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_claude_to_opencode_stdio() {
        let claude = ClaudeMCPServer {
            is_active: Some(true),
            command: Some("npx".to_string()),
            args: Some(vec!["-y".to_string(), "@pkg/test".to_string()]),
            server_type: Some("stdio".to_string()),
            ..Default::default()
        };

        let opencode = claude_to_opencode(&claude, Platform::Linux);

        assert_eq!(opencode.server_type, "local");
        assert_eq!(opencode.enabled, Some(true));
        assert_eq!(
            opencode.command,
            Some(vec![
                "npx".to_string(),
                "-y".to_string(),
                "@pkg/test".to_string()
            ])
        );
    }

    #[test]
    fn test_opencode_to_claude() {
        let opencode = OpenCodeMCPServer {
            server_type: "local".to_string(),
            command: Some(vec![
                "npx".to_string(),
                "-y".to_string(),
                "@pkg/test".to_string(),
            ]),
            enabled: Some(true),
            ..Default::default()
        };

        let claude = opencode_to_claude(&opencode, Platform::Linux);

        assert_eq!(claude.server_type, Some("stdio".to_string()));
        assert_eq!(claude.is_active, Some(true));
        assert_eq!(claude.command, Some("npx".to_string()));
        assert_eq!(
            claude.args,
            Some(vec!["-y".to_string(), "@pkg/test".to_string()])
        );
    }

    #[test]
    fn test_platform_adaptation_linux_to_windows() {
        let cmd = vec!["npx".to_string(), "-y".to_string(), "pkg".to_string()];
        let adapted = adapt_command_for_platform(cmd, Platform::Windows);

        assert_eq!(
            adapted,
            Some(vec![
                "cmd".to_string(),
                "/c".to_string(),
                "npx".to_string(),
                "-y".to_string(),
                "pkg".to_string()
            ])
        );
    }

    #[test]
    fn test_platform_adaptation_windows_to_linux() {
        let cmd = vec![
            "cmd".to_string(),
            "/c".to_string(),
            "npx".to_string(),
            "-y".to_string(),
            "pkg".to_string(),
        ];
        let adapted = adapt_command_for_platform(cmd, Platform::Linux);

        assert_eq!(
            adapted,
            Some(vec!["npx".to_string(), "-y".to_string(), "pkg".to_string()])
        );
    }

    #[test]
    fn test_platform_from_str() {
        assert_eq!(Platform::from_str("linux"), Ok(Platform::Linux));
        assert_eq!(Platform::from_str("Linux"), Ok(Platform::Linux));
        assert_eq!(Platform::from_str("windows"), Ok(Platform::Windows));
        assert_eq!(Platform::from_str("Windows"), Ok(Platform::Windows));
        assert_eq!(Platform::from_str("unknown"), Ok(Platform::Linux)); // Default behavior
    }
}
