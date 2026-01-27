use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub fn watch_config_files(app: AppHandle, paths: Vec<PathBuf>) {
    std::thread::spawn(move || {
        let (tx, rx) = channel();

        // Create a watcher object, delivering debounced events.
        // The notification back-end is selected based on the platform.
        let mut watcher = match RecommendedWatcher::new(tx, Config::default()) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("Failed to create watcher: {:?}", e);
                return;
            }
        };

        // Add paths to be watched
        for path in &paths {
            // We watch the parent directory because watching a specific file that might be overwritten (atomic write) can be tricky
            // depending on the OS/editor. However, watching specific files is usually preferred if they exist.
            // If the file doesn't exist, we might need to watch the parent.
            // For simplicity, let's try watching the specific files. If they don't exist, this might fail or do nothing.
            // If they don't exist, let's watch the parent dir.

            let path_to_watch = if path.exists() {
                path.clone()
            } else {
                // If file doesn't exist, watch parent to detect creation
                path.parent().unwrap_or(path).to_path_buf()
            };

            if let Err(e) = watcher.watch(&path_to_watch, RecursiveMode::NonRecursive) {
                eprintln!("Failed to watch path {:?}: {:?}", path_to_watch, e);
            } else {
                println!("Watching path: {:?}", path_to_watch);
            }
        }

        loop {
            match rx.recv() {
                Ok(res) => {
                    match res {
                        Ok(event) => {
                            // Filter events for our specific files if we are watching directories
                            let relevant_change = event.paths.iter().any(|p| {
                                paths
                                    .iter()
                                    .any(|target| p.ends_with(target) || target == p)
                            });

                            if relevant_change {
                                println!("Config file changed: {:?}", event);
                                // Emit event to frontend
                                if let Err(e) = app.emit("config-changed", ()) {
                                    eprintln!("Failed to emit event: {:?}", e);
                                }
                            }
                        }
                        Err(e) => eprintln!("watch error: {:?}", e),
                    }
                }
                Err(e) => {
                    eprintln!("watch channel error: {:?}", e);
                    break;
                }
            }
        }
    });
}
