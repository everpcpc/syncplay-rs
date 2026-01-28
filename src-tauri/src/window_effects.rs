use tauri::{AppHandle, Manager, Runtime};

pub fn update_window_effects<R: Runtime>(app: &AppHandle<R>, reduce_transparency: bool) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    #[cfg(target_os = "macos")]
    {
        use window_vibrancy::{apply_vibrancy, clear_vibrancy, NSVisualEffectMaterial};
        let window = window.clone();
        let reduce = reduce_transparency;
        let _ = app.run_on_main_thread(move || {
            if reduce {
                let _ = clear_vibrancy(&window);
            } else {
                let _ =
                    apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(16.0));
            }
        });
    }

    #[cfg(target_os = "windows")]
    {
        use window_vibrancy::{apply_blur, clear_blur};
        if reduce_transparency {
            let _ = clear_blur(&window);
        } else {
            let _ = apply_blur(&window, Some((18, 18, 18, 125)));
        }
    }
}
