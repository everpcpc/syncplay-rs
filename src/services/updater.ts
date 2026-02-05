import { isTauri } from "@tauri-apps/api/core";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateCheckResult =
  | { status: "unsupported" }
  | { status: "up-to-date" }
  | { status: "available"; update: Update }
  | { status: "error"; message: string };

export const formatUpdateError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch (stringifyError) {
    console.warn("Failed to stringify update error", stringifyError);
    return "Unknown update error";
  }
};

export const shouldAutoCheckUpdates = (value: boolean | null | undefined) => value !== false;

export const checkForUpdates = async (): Promise<UpdateCheckResult> => {
  if (!isTauri()) {
    return { status: "unsupported" };
  }
  try {
    const update = await check();
    if (!update) {
      return { status: "up-to-date" };
    }
    return { status: "available", update };
  } catch (error) {
    return { status: "error", message: formatUpdateError(error) };
  }
};

export const downloadAndInstallUpdate = async (
  update: Update,
  onEvent?: (event: DownloadEvent) => void
) => {
  await update.downloadAndInstall(onEvent);
  await relaunch();
};
