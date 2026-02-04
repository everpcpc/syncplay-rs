use crate::app_state::AppState;
use crate::commands::connection::emit_error_message;
use crate::utils::{hash_filename, strip_filename, PRIVACY_HIDDEN_FILENAME};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::time::{sleep, Duration};

const MEDIA_INDEX_TIMEOUT_SECONDS: u64 = 20;
const MEDIA_INDEX_FIRST_FILE_TIMEOUT_SECONDS: u64 = 25;

#[derive(Default)]
struct MediaIndexCache {
    by_lower: HashMap<String, Vec<PathBuf>>,
    by_stripped: HashMap<String, Vec<PathBuf>>,
    by_hash: HashMap<String, Vec<PathBuf>>,
}

impl MediaIndexCache {
    fn insert(&mut self, filename: &str, path: PathBuf) {
        let lower = filename.to_ascii_lowercase();
        self.by_lower.entry(lower).or_default().push(path.clone());
        let stripped = strip_filename(filename, false);
        self.by_stripped
            .entry(stripped)
            .or_default()
            .push(path.clone());
        let hash = hash_filename(filename, false);
        self.by_hash.entry(hash).or_default().push(path);
    }

    fn resolve(&self, filename: &str) -> Option<PathBuf> {
        let lower = filename.to_ascii_lowercase();
        if let Some(path) = self.find_existing(self.by_lower.get(&lower)) {
            return Some(path);
        }
        let stripped = strip_filename(filename, false);
        if let Some(path) = self.find_existing(self.by_stripped.get(&stripped)) {
            return Some(path);
        }
        let hash = hash_filename(filename, false);
        if let Some(path) = self.find_existing(self.by_hash.get(&hash)) {
            return Some(path);
        }
        None
    }

    fn find_existing(&self, paths: Option<&Vec<PathBuf>>) -> Option<PathBuf> {
        let paths = paths?;
        for path in paths {
            if path.is_file() {
                return Some(path.clone());
            }
        }
        None
    }
}

pub struct MediaIndex {
    cache: RwLock<MediaIndexCache>,
    directories: RwLock<Vec<String>>,
    updating: AtomicBool,
    disabled: AtomicBool,
}

impl MediaIndex {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            cache: RwLock::new(MediaIndexCache::default()),
            directories: RwLock::new(Vec::new()),
            updating: AtomicBool::new(false),
            disabled: AtomicBool::new(false),
        })
    }

    pub fn update_directories(&self, directories: Vec<String>) -> bool {
        let cleaned: Vec<String> = directories
            .into_iter()
            .map(|dir| dir.trim().to_string())
            .filter(|dir| !dir.is_empty())
            .collect();
        let mut guard = self.directories.write();
        if *guard == cleaned {
            return false;
        }
        *guard = cleaned;
        self.disabled.store(false, Ordering::SeqCst);
        true
    }

    pub fn resolve_path(&self, filename: &str) -> Option<PathBuf> {
        if filename == PRIVACY_HIDDEN_FILENAME {
            return None;
        }
        let path = Path::new(filename);
        if path.is_absolute() && path.is_file() {
            return Some(path.to_path_buf());
        }
        self.cache.read().resolve(filename)
    }

    pub fn is_available(&self, filename: &str) -> bool {
        self.resolve_path(filename).is_some()
    }

    pub fn is_refreshing(&self) -> bool {
        self.updating.load(Ordering::SeqCst)
    }

    pub fn spawn_indexer(self: Arc<Self>, state: Arc<AppState>) {
        tauri::async_runtime::spawn(async move {
            self.refresh(&state).await;
        });
    }

    pub fn request_refresh(self: Arc<Self>, state: Arc<AppState>) {
        tauri::async_runtime::spawn(async move {
            self.refresh(&state).await;
        });
    }

    pub fn request_refresh_force(self: Arc<Self>, state: Arc<AppState>) {
        self.disabled.store(false, Ordering::SeqCst);
        self.request_refresh(state);
    }

    async fn refresh(&self, state: &Arc<AppState>) {
        if self.disabled.load(Ordering::SeqCst) {
            return;
        }
        if self.updating.swap(true, Ordering::SeqCst) {
            return;
        }
        state.emit_event(
            "media-index-refreshing",
            serde_json::json!({ "refreshing": true }),
        );
        let directories = self.directories.read().clone();
        if directories.is_empty() {
            self.updating.store(false, Ordering::SeqCst);
            state.emit_event(
                "media-index-refreshing",
                serde_json::json!({ "refreshing": false }),
            );
            return;
        }
        let result = tokio::task::spawn_blocking(move || scan_directories(&directories)).await;
        match result {
            Ok(Ok(cache)) => {
                *self.cache.write() = cache;
                state.emit_event(
                    "media-index-updated",
                    serde_json::json!({ "timestamp": chrono::Utc::now().to_rfc3339() }),
                );
            }
            Ok(Err(ScanError::FirstFileTimeout(dir))) => {
                self.disabled.store(true, Ordering::SeqCst);
                emit_error_message(
                    state,
                    &format!("Media directory scan timed out while accessing '{}'", dir),
                );
            }
            Ok(Err(ScanError::ScanTimeout(dir))) => {
                self.disabled.store(true, Ordering::SeqCst);
                emit_error_message(
                    state,
                    &format!("Media directory scan timed out in '{}'", dir),
                );
            }
            Ok(Err(ScanError::NoDirectories)) => {}
            Ok(Err(ScanError::Io(_))) | Err(_) => {
                emit_error_message(state, "Media directory scan failed");
            }
        }
        self.updating.store(false, Ordering::SeqCst);
        state.emit_event(
            "media-index-refreshing",
            serde_json::json!({ "refreshing": false }),
        );
        sleep(Duration::from_millis(10)).await;
    }
}

enum ScanError {
    NoDirectories,
    FirstFileTimeout(String),
    ScanTimeout(String),
    Io(std::io::Error),
}

fn scan_directories(directories: &[String]) -> Result<MediaIndexCache, ScanError> {
    if directories.is_empty() {
        return Err(ScanError::NoDirectories);
    }
    let mut cache = MediaIndexCache::default();
    let start = Instant::now();
    let timeout = Duration::from_secs(MEDIA_INDEX_TIMEOUT_SECONDS);

    for directory in directories {
        let directory = directory.trim();
        if directory.is_empty() {
            continue;
        }
        let root = Path::new(directory);
        if !root.is_dir() {
            continue;
        }
        let first_start = Instant::now();
        let mut entries = std::fs::read_dir(root).map_err(ScanError::Io)?;
        let _ = entries.next();
        if first_start.elapsed() > Duration::from_secs(MEDIA_INDEX_FIRST_FILE_TIMEOUT_SECONDS) {
            return Err(ScanError::FirstFileTimeout(directory.to_string()));
        }
    }

    for directory in directories {
        let directory = directory.trim();
        if directory.is_empty() {
            continue;
        }
        let root = Path::new(directory);
        if !root.is_dir() {
            continue;
        }
        let mut stack = vec![root.to_path_buf()];
        while let Some(current) = stack.pop() {
            if start.elapsed() > timeout {
                return Err(ScanError::ScanTimeout(directory.to_string()));
            }
            let entries = match std::fs::read_dir(&current) {
                Ok(entries) => entries,
                Err(_) => continue,
            };
            for entry in entries.flatten() {
                if start.elapsed() > timeout {
                    return Err(ScanError::ScanTimeout(directory.to_string()));
                }
                let path = entry.path();
                if path.is_dir() {
                    stack.push(path);
                    continue;
                }
                if !path.is_file() {
                    continue;
                }
                let filename_os = entry.file_name();
                let filename = match filename_os.to_str() {
                    Some(name) => name,
                    None => continue,
                };
                cache.insert(filename, path);
            }
        }
    }

    Ok(cache)
}
