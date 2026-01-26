pub mod persistence;
pub mod settings;

pub use persistence::{get_config_path, load_config, save_config};
pub use settings::{ServerConfig, SyncplayConfig, UserPreferences};
