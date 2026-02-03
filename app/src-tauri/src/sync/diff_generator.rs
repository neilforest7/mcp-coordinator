use serde::{Deserialize, Serialize};
use similar::{ChangeTag, TextDiff};

/// Represents a single line in the diff output
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffLine {
    pub tag: String,     // "equal", "insert", "delete"
    pub content: String, // The actual line content
}

/// Represents a structured diff result for UI consumption
#[derive(Debug, Serialize, Clone)]
pub struct DiffResult {
    pub lines: Vec<DiffLine>,
    pub has_changes: bool,
    pub additions: usize,
    pub deletions: usize,
}

/// Configuration diff for side-by-side view
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConfigDiff {
    pub server_name: String,
    pub claude_json: String,
    pub opencode_json: String,
    pub unified_diff: String,
    pub diff_lines: Vec<DiffLine>,
    pub additions: usize,
    pub deletions: usize,
}

/// Generate a unified diff between two JSON strings
pub fn generate_unified_diff(old: &str, new: &str, old_label: &str, new_label: &str) -> String {
    let diff = TextDiff::from_lines(old, new);

    let mut output = String::new();
    output.push_str(&format!("--- {}\n", old_label));
    output.push_str(&format!("+++ {}\n", new_label));

    for (idx, group) in diff.grouped_ops(3).iter().enumerate() {
        if idx > 0 {
            output.push_str("...\n");
        }
        for op in group {
            for change in diff.iter_changes(op) {
                let sign = match change.tag() {
                    ChangeTag::Delete => "-",
                    ChangeTag::Insert => "+",
                    ChangeTag::Equal => " ",
                };
                output.push_str(&format!("{}{}", sign, change.value()));
            }
        }
    }

    output
}

/// Generate structured diff lines for UI rendering
pub fn generate_diff_lines(old: &str, new: &str) -> DiffResult {
    let diff = TextDiff::from_lines(old, new);

    let mut lines = Vec::new();
    let mut additions = 0;
    let mut deletions = 0;

    for change in diff.iter_all_changes() {
        let (tag, content) = match change.tag() {
            ChangeTag::Delete => {
                deletions += 1;
                ("delete".to_string(), change.value().to_string())
            }
            ChangeTag::Insert => {
                additions += 1;
                ("insert".to_string(), change.value().to_string())
            }
            ChangeTag::Equal => ("equal".to_string(), change.value().to_string()),
        };

        lines.push(DiffLine { tag, content });
    }

    let has_changes = additions > 0 || deletions > 0;

    DiffResult {
        lines,
        has_changes,
        additions,
        deletions,
    }
}

/// Generate a complete ConfigDiff for a server conflict
pub fn generate_config_diff<A: Serialize, B: Serialize>(
    server_name: &str,
    claude_config: &A,
    opencode_config: &B,
) -> Result<ConfigDiff, String> {
    let claude_json = serde_json::to_string_pretty(claude_config)
        .map_err(|e| format!("Failed to serialize Claude config: {}", e))?;

    let opencode_json = serde_json::to_string_pretty(opencode_config)
        .map_err(|e| format!("Failed to serialize OpenCode config: {}", e))?;

    let unified_diff = generate_unified_diff(&claude_json, &opencode_json, "Claude", "OpenCode");
    let diff_result = generate_diff_lines(&claude_json, &opencode_json);

    Ok(ConfigDiff {
        server_name: server_name.to_string(),
        claude_json,
        opencode_json,
        unified_diff,
        diff_lines: diff_result.lines,
        additions: diff_result.additions,
        deletions: diff_result.deletions,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_generate_unified_diff_identical() {
        let text = r#"{
  "command": "npx",
  "args": ["-y", "playwright"]
}"#;

        let diff = generate_unified_diff(text, text, "Old", "New");

        // When identical, there should be no change lines (lines starting with - or + after headers)
        // Headers are "--- Old" and "+++ New"
        let lines: Vec<&str> = diff.lines().collect();
        let content_lines: Vec<&&str> = lines.iter().skip(2).collect(); // Skip header lines

        // None of the content lines should start with - or + (change markers)
        for line in content_lines {
            assert!(
                !line.starts_with('-'),
                "Found delete marker in identical diff: {}",
                line
            );
            assert!(
                !line.starts_with('+'),
                "Found insert marker in identical diff: {}",
                line
            );
        }
    }

    #[test]
    fn test_generate_unified_diff_changes() {
        let old = r#"{
  "isActive": true,
  "command": "npx"
}"#;

        let new = r#"{
  "isActive": false,
  "command": "npx"
}"#;

        let diff = generate_unified_diff(old, new, "Claude", "OpenCode");

        // Should contain the labels
        assert!(diff.contains("--- Claude"));
        assert!(diff.contains("+++ OpenCode"));

        // Should show the change
        assert!(diff.contains("-  \"isActive\": true"));
        assert!(diff.contains("+  \"isActive\": false"));
    }

    #[test]
    fn test_generate_diff_lines_counts() {
        let old = "line1\nline2\nline3\n";
        let new = "line1\nmodified\nline3\nnew_line\n";

        let result = generate_diff_lines(old, new);

        assert!(result.has_changes);
        assert_eq!(result.deletions, 1); // line2 deleted
        assert_eq!(result.additions, 2); // modified + new_line added
    }

    #[test]
    fn test_generate_diff_lines_no_changes() {
        let text = "same\ncontent\n";

        let result = generate_diff_lines(text, text);

        assert!(!result.has_changes);
        assert_eq!(result.additions, 0);
        assert_eq!(result.deletions, 0);
    }

    #[test]
    fn test_generate_config_diff() {
        let claude = json!({
            "isActive": true,
            "command": "npx",
            "args": ["-y", "playwright"]
        });

        let opencode = json!({
            "enabled": false,
            "command": ["npx", "-y", "playwright"]
        });

        let diff = generate_config_diff("playwright", &claude, &opencode).unwrap();

        assert_eq!(diff.server_name, "playwright");
        assert!(diff.additions > 0 || diff.deletions > 0);
        assert!(!diff.claude_json.is_empty());
        assert!(!diff.opencode_json.is_empty());
        assert!(!diff.unified_diff.is_empty());
    }
}
