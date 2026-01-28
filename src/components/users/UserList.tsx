import { useState } from "react";
import { FiEdit2, FiUsers } from "react-icons/fi";
import { useSyncplayStore } from "../../store";
import { RoomManagerDialog } from "./RoomManagerDialog";

export function UserList() {
  const users = useSyncplayStore((state) => state.users);
  const connection = useSyncplayStore((state) => state.connection);
  const config = useSyncplayStore((state) => state.config);
  const [showRoomManager, setShowRoomManager] = useState(false);

  const currentRoom =
    users.find((user) => user.username === config?.user.username)?.room ??
    config?.user.default_room ??
    "Room";

  if (!connection.connected) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FiUsers className="app-icon app-text-muted" />
            <span className="text-sm font-semibold">{currentRoom}</span>
          </div>
          <button
            onClick={() => setShowRoomManager(true)}
            className="btn-neutral app-icon-button"
            title="Manage rooms"
            aria-label="Manage rooms"
          >
            <FiEdit2 className="app-icon" />
          </button>
        </div>
        <p className="app-text-muted text-sm">Not connected</p>
        <RoomManagerDialog isOpen={showRoomManager} onClose={() => setShowRoomManager(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FiUsers className="app-icon app-text-muted" />
          <span className="text-sm font-semibold">{currentRoom}</span>
          <span className="text-xs app-text-muted">({users.length})</span>
        </div>
        <button
          onClick={() => setShowRoomManager(true)}
          className="btn-neutral app-icon-button"
          title="Manage rooms"
          aria-label="Manage rooms"
        >
          <FiEdit2 className="app-icon" />
        </button>
      </div>

      {users.length === 0 ? (
        <p className="app-text-muted text-sm">No users in room</p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.username} className="app-panel-muted rounded-md p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{user.username}</span>
                {user.isController && (
                  <span className="text-xs app-tag-accent px-2 py-0.5 rounded">Controller</span>
                )}
              </div>

              {user.file && (
                <div className="text-xs app-text-muted mt-1 truncate">File: {user.file}</div>
              )}

              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    user.isReady ? "app-tag-success" : "app-tag-muted"
                  }`}
                >
                  {user.isReady ? "Ready" : "Not Ready"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <RoomManagerDialog isOpen={showRoomManager} onClose={() => setShowRoomManager(false)} />
    </div>
  );
}
