import { useEffect, useRef, useState } from "react";
import { UserList } from "../users/UserList";
import { ChatPanel } from "../chat/ChatPanel";
import { PlayerStatus } from "../player/PlayerStatus";
import {
  LuColumns2,
  LuLink2,
  LuListMinus,
  LuListMusic,
  LuMoon,
  LuRows2,
  LuSettings,
  LuSun,
} from "react-icons/lu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useWindowDrag } from "../../hooks/useWindowDrag";
import { PlaylistPanel } from "../playlist/PlaylistPanel";
import { ConnectionDialog } from "../connection/ConnectionDialog";
import { SettingsDialog } from "../settings/SettingsDialog";
import { NotificationContainer } from "../notifications/NotificationContainer";
import { useSyncplayStore } from "../../store";
import { useNotificationStore } from "../../store/notifications";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  applyTheme,
  applyTransparency,
  normalizeTheme,
  ThemePreference,
} from "../../services/theme";
import { SyncplayConfig } from "../../types/config";

export function MainLayout() {
  const appWindow = isTauri() ? getCurrentWindow() : null;
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(true);
  const [sideLayout, setSideLayout] = useState<"columns" | "rows">("rows");
  const [theme, setTheme] = useState<ThemePreference>("dark");
  const connection = useSyncplayStore((state) => state.connection);
  const config = useSyncplayStore((state) => state.config);
  const setConfig = useSyncplayStore((state) => state.setConfig);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const initializedRef = useRef(false);
  const showPlaylistRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initFromConfig = async () => {
      try {
        const config = await invoke<SyncplayConfig>("get_config");
        setConfig(config);
        setShowPlaylist(config.user.show_playlist);
        const normalizedTheme = normalizeTheme(config.user.theme);
        setTheme(normalizedTheme);
        applyTheme(normalizedTheme);
        applyTransparency(config.user.reduce_transparency);

        if (config.user.force_gui_prompt) {
          setShowConnectionDialog(true);
        } else if (
          config.user.auto_connect &&
          !connection.connected &&
          config.user.username.trim()
        ) {
          try {
            await invoke("connect_to_server", {
              host: config.server.host,
              port: config.server.port,
              username: config.user.username,
              room: config.user.default_room,
              password: config.server.password || null,
            });
          } catch (error) {
            addNotification({
              type: "error",
              message: "Auto-connect failed",
            });
          }
        }
      } catch (error) {
        addNotification({
          type: "warning",
          message: "Failed to load config for auto-connect",
        });
      }
    };

    initFromConfig();
  }, [connection.connected, addNotification, setConfig]);

  useEffect(() => {
    if (!config) return;
    if (showPlaylistRef.current !== config.user.show_playlist) {
      showPlaylistRef.current = config.user.show_playlist;
      setShowPlaylist(config.user.show_playlist);
    }
    if (config.user.side_panel_layout) {
      setSideLayout(config.user.side_panel_layout);
    }
    const normalizedTheme = normalizeTheme(config.user.theme);
    setTheme(normalizedTheme);
    applyTheme(normalizedTheme);
    applyTransparency(config.user.reduce_transparency);
  }, [config]);

  const handleToggleTheme = async () => {
    const previousTheme = theme;
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);

    try {
      const config = await invoke<SyncplayConfig>("get_config");
      await invoke("update_config", {
        config: {
          ...config,
          user: { ...config.user, theme: nextTheme },
        },
      });
    } catch (error) {
      setTheme(previousTheme);
      applyTheme(previousTheme);
      addNotification({
        type: "error",
        message: "Failed to save theme",
      });
    }
  };

  const handleTogglePlaylist = () => {
    setShowPlaylist((prev) => {
      const next = !prev;
      void (async () => {
        try {
          const config = await invoke<SyncplayConfig>("get_config");
          await invoke("update_config", {
            config: {
              ...config,
              user: { ...config.user, show_playlist: next },
            },
          });
        } catch (error) {
          setShowPlaylist(prev);
          addNotification({
            type: "error",
            message: "Failed to save playlist visibility",
          });
        }
      })();
      return next;
    });
  };

  const handleHeaderMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-tauri-drag-region="false"]')) return;
    if (!appWindow) return;
    void appWindow.startDragging();
  };
  useWindowDrag("titlebar");
  useWindowDrag("toolbar-drag");

  return (
    <div className="app-shell">
      <NotificationContainer />
      <div className="drag-strip" id="titlebar" data-tauri-drag-region />

      <div className="app-layout">
        <section className="app-main-column">
          <main className="app-main-panel">
            <ChatPanel />
          </main>
        </section>

        <section className="app-side-column">
          <header
            className="app-header"
            id="toolbar-drag"
            data-tauri-drag-region
            onMouseDown={handleHeaderMouseDown}
          >
            <div className="app-header-row">
              <PlayerStatus />
              <div className="app-header-actions w-full" data-tauri-drag-region="false">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTogglePlaylist}
                    className="btn-neutral app-icon-button"
                    data-tauri-drag-region="false"
                    title={showPlaylist ? "Hide playlist" : "Show playlist"}
                    aria-label={showPlaylist ? "Hide playlist" : "Show playlist"}
                  >
                    {showPlaylist ? (
                      <LuListMusic className="app-icon" />
                    ) : (
                      <LuListMinus className="app-icon" />
                    )}
                  </button>
                  <button
                    onClick={() =>
                      setSideLayout((prev) => {
                        const next = prev === "columns" ? "rows" : "columns";
                        void (async () => {
                          try {
                            const config = await invoke<SyncplayConfig>("get_config");
                            await invoke("update_config", {
                              config: {
                                ...config,
                                user: { ...config.user, side_panel_layout: next },
                              },
                            });
                          } catch (error) {
                            setSideLayout(prev);
                            addNotification({
                              type: "error",
                              message: "Failed to save layout",
                            });
                          }
                        })();
                        return next;
                      })
                    }
                    className="btn-neutral app-icon-button"
                    data-tauri-drag-region="false"
                    title={sideLayout === "columns" ? "Stack panels" : "Split panels"}
                    aria-label={sideLayout === "columns" ? "Stack panels" : "Split panels"}
                  >
                    {sideLayout === "rows" ? (
                      <LuRows2 className="app-icon" />
                    ) : (
                      <LuColumns2 className="app-icon" />
                    )}
                  </button>
                  <button
                    onClick={handleToggleTheme}
                    className="btn-neutral app-icon-button"
                    data-tauri-drag-region="false"
                    title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
                    aria-label={
                      theme === "light" ? "Switch to dark theme" : "Switch to light theme"
                    }
                  >
                    {theme === "light" ? (
                      <LuSun className="app-icon" />
                    ) : (
                      <LuMoon className="app-icon" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => setShowConnectionDialog(true)}
                    className="btn-primary app-icon-button"
                    data-tauri-drag-region="false"
                    title="Connect"
                    aria-label="Connect"
                  >
                    <LuLink2 className="app-icon" />
                  </button>
                  <button
                    onClick={() => setShowSettingsDialog(true)}
                    className="btn-neutral app-icon-button"
                    data-tauri-drag-region="false"
                    title="Settings"
                    aria-label="Settings"
                  >
                    <LuSettings className="app-icon" />
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div
            className="app-side-panels"
            style={{
              gridTemplateColumns:
                sideLayout === "columns"
                  ? showPlaylist
                    ? "minmax(0, 1fr) minmax(0, 1fr)"
                    : "minmax(0, 1fr)"
                  : "minmax(0, 1fr)",
              gridTemplateRows:
                sideLayout === "rows"
                  ? showPlaylist
                    ? "minmax(0, 1fr) minmax(0, 1fr)"
                    : "minmax(0, 1fr)"
                  : "minmax(0, 1fr)",
            }}
          >
            <aside className="app-side-panel app-sidebar p-5 overflow-auto">
              <UserList />
            </aside>

            {showPlaylist && (
              <aside className="app-side-panel app-sidebar-right overflow-hidden">
                <PlaylistPanel />
              </aside>
            )}
          </div>
        </section>
      </div>

      {/* Connection dialog */}
      <ConnectionDialog
        isOpen={showConnectionDialog}
        onClose={() => setShowConnectionDialog(false)}
      />

      {/* Settings dialog */}
      <SettingsDialog isOpen={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} />
    </div>
  );
}
