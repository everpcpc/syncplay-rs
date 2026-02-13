import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

function detectPlatform(): "windows" | "macos" | "linux" {
  const ua = (navigator as any).userAgentData;
  if (ua?.platform) {
    const p = ua.platform.toLowerCase();
    if (p.includes("win")) return "windows";
    if (p.includes("mac")) return "macos";
    return "linux";
  }
  const np = navigator.platform.toLowerCase();
  if (np.startsWith("win")) return "windows";
  if (np.startsWith("mac")) return "macos";
  return "linux";
}

document.documentElement.dataset.platform = detectPlatform();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
