// Room command handlers

use crate::app_state::AppState;
use crate::config::save_config;
use crate::network::messages::{ProtocolMessage, ReadyState, RoomInfo, SetMessage};
use std::sync::Arc;
use tauri::{AppHandle, Runtime, State};

#[tauri::command]
pub async fn change_room<R: Runtime>(
    room: String,
    app: AppHandle<R>,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    tracing::info!("Changing to room: {}", room);

    // Check if connected
    if !state.is_connected() {
        return Err("Not connected to server".to_string());
    }

    // Update client state
    state.client_state.set_room(room.clone());

    let message = ProtocolMessage::Set {
        Set: SetMessage {
            room: Some(RoomInfo {
                name: room.clone(),
                password: None,
            }),
            file: None,
            user: None,
            ready: None,
            playlist_index: None,
            playlist_change: None,
            features: None,
        },
    };
    send_to_server(&state, message)?;

    let config = state.config.lock().clone();
    if config.user.autosave_joins_to_list {
        let mut updated = config.clone();
        if !updated.user.room_list.contains(&room) {
            updated.user.room_list.push(room.clone());
        }
        updated.user.default_room = room.clone();
        if let Err(e) = save_config(&app, &updated) {
            tracing::warn!("Failed to save config after room change: {}", e);
        }
        *state.config.lock() = updated.clone();
        state.emit_event("config-updated", updated);
    }

    Ok(())
}

#[tauri::command]
pub async fn set_ready(is_ready: bool, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    tracing::info!("Setting ready state to: {}", is_ready);

    // Check if connected
    if !state.is_connected() {
        return Err("Not connected to server".to_string());
    }

    // Update client state
    state.client_state.set_ready(is_ready);

    let username = state.client_state.get_username();
    let message = ProtocolMessage::Set {
        Set: SetMessage {
            room: None,
            file: None,
            user: None,
            ready: Some(ReadyState {
                username: Some(username),
                is_ready: Some(is_ready),
                manually_initiated: Some(true),
                set_by: None,
            }),
            playlist_index: None,
            playlist_change: None,
            features: None,
        },
    };
    send_to_server(&state, message)?;

    Ok(())
}

fn send_to_server(
    state: &State<'_, Arc<AppState>>,
    message: ProtocolMessage,
) -> Result<(), String> {
    let connection = state.connection.lock().clone();
    let Some(connection) = connection else {
        return Err("Not connected to server".to_string());
    };
    connection
        .send(message)
        .map_err(|e| format!("Failed to send message: {}", e))
}
