use tracing::{debug, info, warn};

/// Synchronization thresholds (in seconds)
pub const SEEK_THRESHOLD_REWIND: f64 = 4.0;
pub const SEEK_THRESHOLD_FASTFORWARD: f64 = 5.0;
pub const SLOWDOWN_THRESHOLD: f64 = 1.5;
pub const SLOWDOWN_RESET_THRESHOLD: f64 = 0.5;
pub const SLOWDOWN_RATE: f64 = 0.95;

/// Synchronization action to take
#[derive(Debug, Clone, PartialEq)]
pub enum SyncAction {
    /// No action needed
    None,
    /// Seek to position
    Seek(f64),
    /// Set pause state
    SetPaused(bool),
    /// Apply slowdown
    Slowdown,
    /// Reset speed to normal
    ResetSpeed,
}

/// Synchronization engine
pub struct SyncEngine {
    /// Whether slowdown is currently active
    slowdown_active: bool,
}

impl SyncEngine {
    pub fn new() -> Self {
        Self {
            slowdown_active: false,
        }
    }

    /// Calculate synchronization actions needed
    pub fn calculate_sync_actions(
        &mut self,
        local_position: f64,
        local_paused: bool,
        global_position: f64,
        global_paused: bool,
        message_age: f64,
    ) -> Vec<SyncAction> {
        let mut actions = Vec::new();

        // Adjust global position for message age
        let adjusted_global_position = if !global_paused {
            global_position + message_age
        } else {
            global_position
        };

        // Calculate position difference
        let diff = local_position - adjusted_global_position;

        debug!(
            "Sync check: local={:.2}s ({}), global={:.2}s ({}), diff={:.2}s",
            local_position,
            if local_paused { "paused" } else { "playing" },
            adjusted_global_position,
            if global_paused { "paused" } else { "playing" },
            diff
        );

        // Check pause state first
        if local_paused != global_paused {
            info!(
                "Pause state mismatch: local={}, global={} - syncing",
                local_paused, global_paused
            );
            actions.push(SyncAction::SetPaused(global_paused));
        }

        // Only sync position if both are playing or both are paused
        if local_paused == global_paused {
            // Check if we need to seek
            if diff.abs() > SEEK_THRESHOLD_REWIND && diff < 0.0 {
                // We're behind, need to seek forward
                info!(
                    "Behind by {:.2}s (threshold: {:.2}s) - seeking forward",
                    diff.abs(),
                    SEEK_THRESHOLD_REWIND
                );
                actions.push(SyncAction::Seek(adjusted_global_position));
                self.slowdown_active = false;
            } else if diff > SEEK_THRESHOLD_FASTFORWARD {
                // We're ahead, need to seek backward
                info!(
                    "Ahead by {:.2}s (threshold: {:.2}s) - seeking backward",
                    diff, SEEK_THRESHOLD_FASTFORWARD
                );
                actions.push(SyncAction::Seek(adjusted_global_position));
                self.slowdown_active = false;
            } else if !global_paused && diff.abs() > SLOWDOWN_THRESHOLD {
                // Minor desync while playing - apply slowdown
                if !self.slowdown_active {
                    info!(
                        "Minor desync {:.2}s (threshold: {:.2}s) - applying slowdown",
                        diff.abs(),
                        SLOWDOWN_THRESHOLD
                    );
                    actions.push(SyncAction::Slowdown);
                    self.slowdown_active = true;
                }
            } else if self.slowdown_active && diff.abs() < SLOWDOWN_RESET_THRESHOLD {
                // Back in sync - reset speed
                info!(
                    "Back in sync ({:.2}s < {:.2}s) - resetting speed",
                    diff.abs(),
                    SLOWDOWN_RESET_THRESHOLD
                );
                actions.push(SyncAction::ResetSpeed);
                self.slowdown_active = false;
            }
        }

        if actions.is_empty() {
            actions.push(SyncAction::None);
        }

        actions
    }

    /// Reset slowdown state
    pub fn reset_slowdown(&mut self) {
        self.slowdown_active = false;
    }

    /// Check if slowdown is active
    pub fn is_slowdown_active(&self) -> bool {
        self.slowdown_active
    }
}

impl Default for SyncEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_no_action_when_in_sync() {
        let mut engine = SyncEngine::new();
        let actions = engine.calculate_sync_actions(10.0, false, 10.0, false, 0.0);
        assert_eq!(actions, vec![SyncAction::None]);
    }

    #[test]
    fn test_sync_seek_when_behind() {
        let mut engine = SyncEngine::new();
        let actions = engine.calculate_sync_actions(5.0, false, 10.0, false, 0.0);
        assert!(matches!(actions[0], SyncAction::Seek(_)));
    }

    #[test]
    fn test_sync_seek_when_ahead() {
        let mut engine = SyncEngine::new();
        let actions = engine.calculate_sync_actions(20.0, false, 10.0, false, 0.0);
        assert!(matches!(actions[0], SyncAction::Seek(_)));
    }

    #[test]
    fn test_sync_pause_state() {
        let mut engine = SyncEngine::new();
        let actions = engine.calculate_sync_actions(10.0, true, 10.0, false, 0.0);
        assert!(matches!(actions[0], SyncAction::SetPaused(false)));
    }

    #[test]
    fn test_sync_slowdown() {
        let mut engine = SyncEngine::new();
        let actions = engine.calculate_sync_actions(8.0, false, 10.0, false, 0.0);
        assert!(matches!(actions[0], SyncAction::Slowdown));
        assert!(engine.is_slowdown_active());
    }

    #[test]
    fn test_sync_reset_speed() {
        let mut engine = SyncEngine::new();
        // First apply slowdown
        engine.calculate_sync_actions(8.0, false, 10.0, false, 0.0);
        assert!(engine.is_slowdown_active());

        // Then get back in sync
        let actions = engine.calculate_sync_actions(10.0, false, 10.0, false, 0.0);
        assert!(matches!(actions[0], SyncAction::ResetSpeed));
        assert!(!engine.is_slowdown_active());
    }
}
