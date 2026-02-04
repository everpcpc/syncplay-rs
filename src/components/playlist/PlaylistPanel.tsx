import { useSyncplayStore } from "../../store";
import {
  LuChevronLeft,
  LuChevronRight,
  LuFolder,
  LuListMusic,
  LuPlay,
  LuPlus,
  LuRefreshCw,
  LuRepeat,
  LuRepeat1,
  LuShield,
  LuTrash2,
  LuUsers,
} from "react-icons/lu";
import { useNotificationStore } from "../../store/notifications";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { SyncplayConfig } from "../../types/config";
import { useEffect, useState, type DragEvent } from "react";
import { MediaDirectoriesDialog } from "./MediaDirectoriesDialog";
import { TrustedDomainsDialog } from "./TrustedDomainsDialog";

interface PlaylistItemStatus {
  filename: string;
  path: string | null;
  available: boolean;
}

export function PlaylistPanel() {
  const playlist = useSyncplayStore((state) => state.playlist);
  const connection = useSyncplayStore((state) => state.connection);
  const player = useSyncplayStore((state) => state.player);
  const config = useSyncplayStore((state) => state.config);
  const setConfig = useSyncplayStore((state) => state.setConfig);
  const mediaIndexVersion = useSyncplayStore((state) => state.mediaIndexVersion);
  const mediaIndexRefreshing = useSyncplayStore((state) => state.mediaIndexRefreshing);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const [showMediaDirectories, setShowMediaDirectories] = useState(false);
  const [showTrustedDomains, setShowTrustedDomains] = useState(false);
  const [availability, setAvailability] = useState<PlaylistItemStatus[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (playlist.items.length === 0) {
      setAvailability([]);
      return () => {
        cancelled = true;
      };
    }
    const checkAvailability = async () => {
      try {
        const result = await invoke<PlaylistItemStatus[]>("check_playlist_items", {
          items: playlist.items,
        });
        if (!cancelled) {
          setAvailability(result);
        }
      } catch (error) {
        if (!cancelled) {
          setAvailability(
            playlist.items.map((item) => ({
              filename: item,
              path: null,
              available: false,
            }))
          );
        }
      }
    };
    void checkAvailability();
    return () => {
      cancelled = true;
    };
  }, [playlist.items, config?.player.media_directories, mediaIndexVersion]);

  const normalizePath = (path: string) =>
    path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatSpeed = (speed: number | null) => {
    if (speed === null || speed === 1.0) return "";
    return `${speed.toFixed(2)}x`;
  };

  const formatLastScan = (timestamp: number) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "Never";
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  const updateUserSetting = async <K extends keyof SyncplayConfig["user"]>(
    key: K,
    value: SyncplayConfig["user"][K]
  ) => {
    try {
      const baseConfig = config ?? (await invoke<SyncplayConfig>("get_config"));
      const nextConfig: SyncplayConfig = {
        ...baseConfig,
        user: {
          ...baseConfig.user,
          [key]: value,
        },
      };
      await invoke("update_config", { config: nextConfig });
      setConfig(nextConfig);
    } catch (error) {
      addNotification({
        type: "error",
        message: "Failed to update playlist settings",
      });
    }
  };

  const handleAddFile = async () => {
    if (!connection.connected) return;

    let config: SyncplayConfig | null = null;
    try {
      config = await invoke<SyncplayConfig>("get_config");
    } catch (error) {
      addNotification({
        type: "error",
        message: "Failed to load config for file picker",
      });
      return;
    }

    const mediaDirectories = config.player.media_directories.filter((dir) => dir.trim() !== "");
    if (mediaDirectories.length === 0) {
      addNotification({
        type: "warning",
        message: "Set media directories in Settings before adding files",
      });
      return;
    }

    let selected: string | string[] | null = null;
    try {
      selected = await open({
        multiple: false,
        directory: false,
        defaultPath: mediaDirectories[0],
      });
    } catch (error) {
      addNotification({
        type: "error",
        message: "Failed to open file picker",
      });
      return;
    }

    if (!selected || Array.isArray(selected)) {
      return;
    }

    const normalizedFile = normalizePath(selected);
    const normalizedDirs = mediaDirectories.map(normalizePath);
    const isInDirectory = normalizedDirs.some((dir) => normalizedFile.startsWith(`${dir}/`));
    if (!isInDirectory) {
      addNotification({
        type: "error",
        message: "Selected file is outside the media directories",
      });
      return;
    }

    const filename = selected.split(/[/\\\\]/).pop() || selected;
    try {
      await invoke("update_playlist", {
        action: "add",
        filename,
      });
    } catch (error) {
      addNotification({
        type: "error",
        message: "Failed to add file to playlist",
      });
    }
  };

  const handleDropFiles = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!connection.connected) return;

    const files = Array.from(event.dataTransfer.files);
    const paths = files
      .map((file) => (file as { path?: string }).path)
      .filter((path): path is string => Boolean(path));
    if (paths.length === 0) return;

    let baseConfig: SyncplayConfig | null = config;
    if (!baseConfig) {
      try {
        baseConfig = await invoke<SyncplayConfig>("get_config");
      } catch (error) {
        addNotification({
          type: "error",
          message: "Failed to load config for dropped files",
        });
        return;
      }
    }

    const mediaDirectories = baseConfig.player.media_directories.filter((dir) => dir.trim() !== "");
    const normalizedDirs = mediaDirectories.map(normalizePath);
    const rejected: string[] = [];

    for (const path of paths) {
      const normalizedFile = normalizePath(path);
      const isInDirectory =
        normalizedDirs.length > 0 &&
        normalizedDirs.some((dir) => normalizedFile.startsWith(`${dir}/`));
      const filename = isInDirectory ? path.split(/[/\\\\]/).pop() || path : path;
      try {
        await invoke("update_playlist", {
          action: "add",
          filename,
        });
      } catch (error) {
        rejected.push(path);
      }
    }

    if (rejected.length > 0) {
      addNotification({
        type: "warning",
        message: `Skipped ${rejected.length} file(s) that could not be added`,
      });
    }
  };

  const handleScanMediaDirectory = async () => {
    if (mediaIndexRefreshing) return;
    try {
      await invoke("refresh_media_index");
    } catch (error) {
      addNotification({
        type: "error",
        message: "Failed to scan media directory",
      });
    }
  };

  const scanLabel = mediaIndexRefreshing ? "Scanning media directory" : "Scan media directory";
  const scanTooltip = `${scanLabel} (Last scan: ${formatLastScan(mediaIndexVersion)})`;

  const handleRemoveItem = async (index: number) => {
    try {
      await invoke("update_playlist", {
        action: "remove",
        filename: index.toString(),
      });
    } catch (error) {
      console.error("Failed to remove item:", error);
    }
  };

  const handlePlayItem = async (index: number) => {
    if (!connection.connected) return;
    try {
      await invoke("update_playlist", {
        action: "select",
        filename: index.toString(),
      });
    } catch (error) {
      console.error("Failed to select playlist item:", error);
    }
  };

  const handleNext = async () => {
    try {
      await invoke("update_playlist", {
        action: "next",
        filename: null,
      });
    } catch (error) {
      console.error("Failed to go to next:", error);
    }
  };

  const handlePrevious = async () => {
    try {
      await invoke("update_playlist", {
        action: "previous",
        filename: null,
      });
    } catch (error) {
      console.error("Failed to go to previous:", error);
    }
  };

  const handleClear = async () => {
    try {
      await invoke("update_playlist", {
        action: "clear",
        filename: null,
      });
    } catch (error) {
      console.error("Failed to clear playlist:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b app-divider app-surface rounded-t-2xl">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <LuListMusic className="app-icon app-text-muted" />
            <div className="flex items-center gap-2 flex-1">
              <button
                onClick={handleAddFile}
                disabled={!connection.connected}
                className="btn-primary app-icon-button disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Add"
              >
                <LuPlus className="app-icon" />
              </button>
              <button
                onClick={handleClear}
                disabled={!connection.connected || playlist.items.length === 0}
                className="btn-danger app-icon-button disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Clear"
              >
                <LuTrash2 className="app-icon" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTrustedDomains(true)}
                className="btn-neutral app-icon-button"
                aria-label="Trusted domains"
              >
                <LuShield className="app-icon" />
              </button>
              <button
                onClick={handleScanMediaDirectory}
                disabled={mediaIndexRefreshing}
                className="btn-neutral app-icon-button disabled:opacity-60 disabled:cursor-not-allowed app-tooltip-right"
                aria-label={scanTooltip}
              >
                <LuRefreshCw className="app-icon" />
              </button>
              <button
                onClick={() => setShowMediaDirectories(true)}
                className="btn-neutral app-icon-button app-tooltip-right"
                aria-label="Media directories"
              >
                <LuFolder className="app-icon" />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-md app-panel-muted app-tooltip"
              aria-label={player.paused ? "Paused" : "Playing"}
            >
              {player.paused ? <span className="app-text-warning">⏸</span> : <span>▶</span>}
            </div>
            {player.position !== null && player.duration !== null && (
              <span className="font-mono text-xs">
                {formatTime(player.position)}/{formatTime(player.duration)}
              </span>
            )}
            <span className="font-medium truncate max-w-xs">
              {player.filename || "No file loaded"}
            </span>
            {formatSpeed(player.speed) && (
              <span className="app-text-warning">{formatSpeed(player.speed)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Playlist items */}
      <div
        className="flex-1 overflow-auto p-4"
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          void handleDropFiles(event);
        }}
      >
        {playlist.items.length === 0 ? (
          <p className="app-text-muted text-sm">No items in playlist</p>
        ) : (
          <div className="space-y-2">
            {playlist.items.map((item, index) =>
              (() => {
                const itemStatus = availability[index];
                const available = itemStatus?.available ?? true;
                const resolvedPath = itemStatus?.path ?? null;
                return (
                  <div
                    key={index}
                    onDoubleClick={() => {
                      if (available) {
                        void handlePlayItem(index);
                      }
                    }}
                    className={`group p-2 rounded-md text-sm ${
                      index === playlist.currentIndex ? "app-item-active" : "app-panel-muted"
                    }`}
                  >
                    <div
                      className="relative flex items-center gap-2 app-tooltip"
                      aria-label={resolvedPath ?? "Unresolved path"}
                    >
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          void handlePlayItem(index);
                        }}
                        disabled={!connection.connected || !available}
                        aria-label="Play"
                        className="btn-neutral app-icon-button playlist-overlay-button app-text-muted hover:app-text-accent invisible group-hover:visible hover:visible focus-visible:visible pointer-events-none group-hover:pointer-events-auto disabled:opacity-40 app-tooltip-side-right !absolute left-0 top-1/2 z-10"
                      >
                        <LuPlay className="app-icon" />
                      </button>
                      <span className={`truncate flex-1 ${available ? "" : "app-text-muted"}`}>
                        {item}
                      </span>
                      {!available && (
                        <span className="text-[10px] px-2 py-1 rounded-full app-chip-muted app-text-danger">
                          Unavailable
                        </span>
                      )}
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleRemoveItem(index);
                        }}
                        disabled={!connection.connected}
                        aria-label="Remove"
                        className="btn-neutral app-icon-button playlist-overlay-button app-text-danger hover:opacity-80 disabled:opacity-60 invisible group-hover:visible hover:visible focus-visible:visible pointer-events-none group-hover:pointer-events-auto app-tooltip-side-left !absolute right-0 top-1/2 z-10"
                      >
                        <LuTrash2 className="app-icon" />
                      </button>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}
      </div>

      {/* Navigation controls */}
      <div className="p-4 border-t app-divider app-surface rounded-b-2xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={handlePrevious}
              disabled={
                !connection.connected ||
                playlist.items.length === 0 ||
                playlist.currentIndex === null ||
                playlist.currentIndex === 0
              }
              className="btn-neutral app-icon-button disabled:cursor-not-allowed"
              aria-label="Previous"
            >
              <LuChevronLeft className="app-icon" />
            </button>
            <button
              onClick={handleNext}
              disabled={
                !connection.connected ||
                playlist.items.length === 0 ||
                playlist.currentIndex === null ||
                playlist.currentIndex >= playlist.items.length - 1
              }
              className="btn-neutral app-icon-button disabled:cursor-not-allowed"
              aria-label="Next"
            >
              <LuChevronRight className="app-icon" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                updateUserSetting("shared_playlist_enabled", !config?.user.shared_playlist_enabled)
              }
              className={`btn-neutral app-icon-button ${
                config?.user.shared_playlist_enabled ? "app-tag-accent" : ""
              }`}
              aria-label={
                config?.user.shared_playlist_enabled
                  ? "Shared playlists on"
                  : "Shared playlists off"
              }
            >
              <LuUsers className="app-icon" />
            </button>
            <button
              onClick={() =>
                updateUserSetting("loop_at_end_of_playlist", !config?.user.loop_at_end_of_playlist)
              }
              className={`btn-neutral app-icon-button ${
                config?.user.loop_at_end_of_playlist ? "app-tag-accent" : ""
              }`}
              aria-label={
                config?.user.loop_at_end_of_playlist ? "Loop playlist on" : "Loop playlist off"
              }
            >
              <LuRepeat className="app-icon" />
            </button>
            <button
              onClick={() =>
                updateUserSetting("loop_single_files", !config?.user.loop_single_files)
              }
              className={`btn-neutral app-icon-button ${
                config?.user.loop_single_files ? "app-tag-accent" : ""
              } app-tooltip-right`}
              aria-label={config?.user.loop_single_files ? "Loop file on" : "Loop file off"}
            >
              <LuRepeat1 className="app-icon" />
            </button>
          </div>
        </div>
      </div>

      <MediaDirectoriesDialog
        isOpen={showMediaDirectories}
        onClose={() => setShowMediaDirectories(false)}
      />
      <TrustedDomainsDialog
        isOpen={showTrustedDomains}
        onClose={() => setShowTrustedDomains(false)}
      />
    </div>
  );
}
