use std::path::PathBuf;

pub struct AppPaths {
    pub claude_path: PathBuf,
    pub opencode_path: PathBuf,
}

pub fn get_app_paths() -> Option<AppPaths> {
    let home = dirs::home_dir()?;
    let claude_path = home.join(".claude.json");
    let opencode_path = home.join(".config").join("opencode").join("opencode.json");

    Some(AppPaths {
        claude_path,
        opencode_path,
    })
}
