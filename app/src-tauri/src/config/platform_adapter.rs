pub fn normalize_command_for_platform(command: Vec<String>, target_platform: &str) -> Vec<String> {
    if command.is_empty() {
        return command;
    }

    let is_windows_target = target_platform.eq_ignore_ascii_case("windows");
    let cmd_head = &command[0];

    if is_windows_target {
        // Linux -> Windows transformation
        // If command is npx/uvx/npm and NOT already prefixed with cmd /c
        if cmd_head == "npx" || cmd_head == "uvx" || cmd_head == "npm" {
            let mut new_cmd = vec!["cmd".to_string(), "/c".to_string()];
            new_cmd.extend(command);
            return new_cmd;
        }
    } else {
        // Windows -> Linux transformation
        // Remove "cmd", "/c" prefix if present
        if command.len() >= 3 && cmd_head == "cmd" && command[1] == "/c" {
            // Check if the actual command is safe/cross-platform (like npx)
            // Ideally we just strip the wrapper
            return command[2..].to_vec();
        }
    }

    command
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_linux_to_windows_npx() {
        let input = vec!["npx".to_string(), "-y".to_string(), "pkg".to_string()];
        let expected = vec![
            "cmd".to_string(),
            "/c".to_string(),
            "npx".to_string(),
            "-y".to_string(),
            "pkg".to_string(),
        ];
        assert_eq!(normalize_command_for_platform(input, "windows"), expected);
    }

    #[test]
    fn test_windows_to_linux_npx() {
        let input = vec![
            "cmd".to_string(),
            "/c".to_string(),
            "npx".to_string(),
            "-y".to_string(),
            "pkg".to_string(),
        ];
        let expected = vec!["npx".to_string(), "-y".to_string(), "pkg".to_string()];
        assert_eq!(normalize_command_for_platform(input, "linux"), expected);
    }

    #[test]
    fn test_no_change_needed() {
        let input = vec!["ls".to_string(), "-la".to_string()];
        assert_eq!(
            normalize_command_for_platform(input.clone(), "linux"),
            input
        );
    }
}
