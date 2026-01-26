use serde_json::Value;

/// MPV property IDs for observation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PropertyId {
    TimePos = 1,
    Pause = 2,
    Filename = 3,
    Duration = 4,
    Path = 5,
    Speed = 6,
}

impl PropertyId {
    pub fn as_u64(self) -> u64 {
        self as u64
    }

    pub fn from_u64(id: u64) -> Option<Self> {
        match id {
            1 => Some(Self::TimePos),
            2 => Some(Self::Pause),
            3 => Some(Self::Filename),
            4 => Some(Self::Duration),
            5 => Some(Self::Path),
            6 => Some(Self::Speed),
            _ => None,
        }
    }

    pub fn property_name(self) -> &'static str {
        match self {
            Self::TimePos => "time-pos",
            Self::Pause => "pause",
            Self::Filename => "filename",
            Self::Duration => "duration",
            Self::Path => "path",
            Self::Speed => "speed",
        }
    }
}

/// Player state extracted from MPV properties
#[derive(Debug, Clone)]
pub struct PlayerState {
    pub position: Option<f64>,
    pub paused: Option<bool>,
    pub filename: Option<String>,
    pub duration: Option<f64>,
    pub path: Option<String>,
    pub speed: Option<f64>,
}

impl Default for PlayerState {
    fn default() -> Self {
        Self {
            position: None,
            paused: Some(true),
            filename: None,
            duration: None,
            path: None,
            speed: Some(1.0),
        }
    }
}

impl PlayerState {
    pub fn update_property(&mut self, property_id: PropertyId, value: &Value) {
        match property_id {
            PropertyId::TimePos => {
                self.position = value.as_f64();
            }
            PropertyId::Pause => {
                self.paused = value.as_bool();
            }
            PropertyId::Filename => {
                self.filename = value.as_str().map(|s| s.to_string());
            }
            PropertyId::Duration => {
                self.duration = value.as_f64();
            }
            PropertyId::Path => {
                self.path = value.as_str().map(|s| s.to_string());
            }
            PropertyId::Speed => {
                self.speed = value.as_f64();
            }
        }
    }
}
