import { useSyncplayStore } from "../../store";

export function PlayerStatus() {
  const connection = useSyncplayStore((state) => state.connection);

  if (!connection.connected) {
    return (
      <div className="flex items-center gap-4 text-sm app-text-muted">
        <span>Not connected</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      {/* Server info */}
      {connection.server && (
        <div className="flex items-center gap-2 ml-auto">
          <span className="app-text-muted">Server:</span>
          <span className="app-text-accent">{connection.server}</span>
        </div>
      )}
    </div>
  );
}
