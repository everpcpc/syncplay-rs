use regex::Regex;
use sha2::{Digest, Sha256};
use url::Url;

use crate::config::PrivacyMode;
use crate::network::messages::FileSizeInfo;

pub const PRIVACY_HIDDEN_FILENAME: &str = "**Hidden filename**";

pub fn is_url(value: &str) -> bool {
    if !value.contains("://") {
        return false;
    }
    Url::parse(value).is_ok()
}

pub fn is_trustable_and_trusted(
    value: &str,
    trusted_domains: &[String],
    only_switch_to_trusted: bool,
) -> (bool, bool) {
    let url = match Url::parse(value) {
        Ok(url) => url,
        Err(_) => return (false, false),
    };

    let scheme = url.scheme();
    let trustable = scheme == "http" || scheme == "https";
    if !trustable {
        return (false, false);
    }

    if !only_switch_to_trusted {
        return (true, true);
    }

    let host = match url.host_str() {
        Some(host) => host,
        None => return (true, false),
    };

    for entry in trusted_domains {
        let mut parts = entry.splitn(2, '/');
        let domain = parts.next().unwrap_or("").trim();
        if domain.is_empty() {
            continue;
        }
        let path = parts.next().unwrap_or("").trim();

        let mut domain_match = false;
        if domain.contains('*') {
            let regex_pattern = format!("^{}$", regex::escape(domain).replace("\\*", "([^.]+)"));
            if let Ok(regex) = Regex::new(&regex_pattern) {
                domain_match = regex.is_match(host);
            }
        } else if host.eq_ignore_ascii_case(domain)
            || host.eq_ignore_ascii_case(&format!("www.{}", domain))
        {
            domain_match = true;
        }

        if !domain_match {
            continue;
        }

        if path.is_empty() {
            return (true, true);
        }

        let path_prefix = format!("/{}", path);
        if url.path().starts_with(&path_prefix) {
            return (true, true);
        }
    }

    (true, false)
}

pub fn strip_filename(filename: &str, strip_url: bool) -> String {
    let mut base = filename.to_string();
    if strip_url || is_url(filename) {
        if let Ok(url) = Url::parse(filename) {
            if let Some(segment) = url
                .path_segments()
                .and_then(|mut segments| segments.next_back())
            {
                base = segment.to_string();
            }
        }
    }
    let regex = Regex::new(r"[-~_\.\[\](): ]").expect("invalid filename regex");
    regex.replace_all(&base, "").to_string()
}

pub fn hash_filename(filename: &str, strip_url: bool) -> String {
    let stripped = strip_filename(filename, strip_url);
    let mut hasher = Sha256::new();
    hasher.update(stripped.as_bytes());
    let digest = hasher.finalize();
    let hex = format!("{:x}", digest);
    hex.chars().take(12).collect()
}

pub fn hash_filesize(size: u64) -> String {
    let mut hasher = Sha256::new();
    hasher.update(size.to_string().as_bytes());
    let digest = hasher.finalize();
    let hex = format!("{:x}", digest);
    hex.chars().take(12).collect()
}

pub fn apply_privacy(
    filename: Option<String>,
    filesize: Option<u64>,
    filename_mode: &PrivacyMode,
    filesize_mode: &PrivacyMode,
) -> (Option<String>, Option<FileSizeInfo>) {
    let name = match (filename, filename_mode) {
        (Some(name), PrivacyMode::SendRaw) => Some(name),
        (Some(name), PrivacyMode::SendHashed) => Some(hash_filename(&name, true)),
        (Some(_), PrivacyMode::DoNotSend) => Some(PRIVACY_HIDDEN_FILENAME.to_string()),
        (None, _) => None,
    };

    let size = match (filesize, filesize_mode) {
        (Some(size), PrivacyMode::SendRaw) => Some(FileSizeInfo::Number(size)),
        (Some(size), PrivacyMode::SendHashed) => Some(FileSizeInfo::Text(hash_filesize(size))),
        (Some(_), PrivacyMode::DoNotSend) => Some(FileSizeInfo::Number(0)),
        (None, _) => None,
    };

    (name, size)
}

pub fn same_filename(a: Option<&str>, b: Option<&str>) -> bool {
    let a = match a {
        Some(value) => value,
        None => return false,
    };
    let b = match b {
        Some(value) => value,
        None => return false,
    };

    if a == PRIVACY_HIDDEN_FILENAME || b == PRIVACY_HIDDEN_FILENAME {
        return true;
    }

    if a.eq_ignore_ascii_case(b) {
        return true;
    }

    let a_stripped = strip_filename(a, is_url(a) ^ is_url(b));
    let b_stripped = strip_filename(b, is_url(a) ^ is_url(b));
    if a_stripped == b_stripped {
        return true;
    }

    let a_hash = hash_filename(a, is_url(a) ^ is_url(b));
    let b_hash = hash_filename(b, is_url(a) ^ is_url(b));
    a_stripped == b_hash || a_hash == b_stripped || a_hash == b_hash
}

pub fn same_filesize(a: Option<&FileSizeInfo>, b: Option<&FileSizeInfo>) -> bool {
    let (Some(a), Some(b)) = (a, b) else {
        return false;
    };

    let (a_number, a_text) = match a {
        FileSizeInfo::Number(value) => (Some(*value), None),
        FileSizeInfo::Text(value) => (None, Some(value.as_str())),
    };
    let (b_number, b_text) = match b {
        FileSizeInfo::Number(value) => (Some(*value), None),
        FileSizeInfo::Text(value) => (None, Some(value.as_str())),
    };

    if let (Some(a_raw), Some(b_raw)) = (a_number, b_number) {
        if a_raw == 0 || b_raw == 0 {
            return true;
        }
        if a_raw == b_raw {
            return true;
        }
    }

    let a_hash = match (a_number, a_text) {
        (Some(value), _) => hash_filesize(value),
        (None, Some(text)) => text.to_string(),
        _ => String::new(),
    };
    let b_hash = match (b_number, b_text) {
        (Some(value), _) => hash_filesize(value),
        (None, Some(text)) => text.to_string(),
        _ => String::new(),
    };

    if a_hash.is_empty() || b_hash.is_empty() {
        return false;
    }

    a_hash == b_hash
}

pub fn parse_player_arguments(value: &str) -> Vec<String> {
    if value.trim().is_empty() {
        return Vec::new();
    }
    shell_words::split(value)
        .unwrap_or_else(|_| value.split_whitespace().map(|s| s.to_string()).collect())
}

pub fn strip_control_password(value: &str) -> String {
    value
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .collect::<String>()
        .to_uppercase()
}

pub fn parse_controlled_room_input(room: &str) -> (String, Option<String>) {
    if !room.starts_with('+') {
        return (room.to_string(), None);
    }
    let parts: Vec<&str> = room.split(':').collect();
    if parts.len() < 3 {
        return (room.to_string(), None);
    }
    let normalized_room = format!("{}:{}", parts[0], parts[1]);
    let password = strip_control_password(parts[2]);
    let password = if password.is_empty() {
        None
    } else {
        Some(password)
    };
    (normalized_room, password)
}

pub fn is_controlled_room(room: &str) -> bool {
    if !room.starts_with('+') {
        return false;
    }
    let parts: Vec<&str> = room.split(':').collect();
    if parts.len() != 2 {
        return false;
    }
    let hash = parts[1];
    if hash.len() != 12 {
        return false;
    }
    hash.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

pub fn truncate_text(value: &str, max_length: usize) -> String {
    value.chars().take(max_length).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_filename() {
        let hashed = hash_filename("Movie File.mp4", true);
        assert_eq!(hashed.len(), 12);
    }

    #[test]
    fn test_same_filename_hidden() {
        assert!(same_filename(Some(PRIVACY_HIDDEN_FILENAME), Some("foo")));
    }

    #[test]
    fn test_same_filename_hash_match() {
        let name = "Movie File.mp4";
        let hashed = hash_filename(name, true);
        assert!(same_filename(Some(name), Some(&hashed)));
    }

    #[test]
    fn test_parse_player_arguments() {
        let args = parse_player_arguments("--foo bar --baz=1");
        assert_eq!(args, vec!["--foo", "bar", "--baz=1"]);
    }

    #[test]
    fn test_truncate_text() {
        let text = truncate_text("hello", 3);
        assert_eq!(text, "hel");
    }
}
