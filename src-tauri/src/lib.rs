use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Emitter, Manager};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

struct BackendState {
    stdin: Option<std::process::ChildStdin>,
}

#[tauri::command]
async fn start_backend(app: AppHandle) -> Result<(), String> {
    // 프로덕션: resource_dir/python/backend.py
    // 개발 모드: src-tauri/python/backend.py
    let backend_script = app
        .path()
        .resource_dir()
        .map(|d| d.join("python").join("backend.py"))
        .and_then(|p| if p.exists() { Ok(p) } else { Err(tauri::Error::AssetNotFound("python/backend.py".into())) })
        .unwrap_or_else(|_| std::path::PathBuf::from("src-tauri/python/backend.py"));

    let mut cmd = Command::new("python");
    cmd.arg(backend_script.to_string_lossy().to_string())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start backend: {}", e))?;

    let stdin = child.stdin.take().ok_or("Failed to get stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to get stderr")?;

    // Store stdin handle for sending commands
    let state = app.state::<Mutex<BackendState>>();
    {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.stdin = Some(stdin);
    }

    // Read stdout in background thread — emit events to frontend
    let app_handle = app.clone();
    thread::spawn(move || {
        use std::io::BufRead;
        let reader = std::io::BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app_handle.emit("backend-message", &line);
            }
        }
    });

    // Read stderr in background thread (for debugging)
    thread::spawn(move || {
        use std::io::BufRead;
        let reader = std::io::BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                eprintln!("[python] {}", line);
            }
        }
    });

    // Wait for process in background
    thread::spawn(move || {
        let _ = child.wait();
    });

    Ok(())
}

#[tauri::command]
async fn send_to_backend(app: AppHandle, message: String) -> Result<(), String> {
    let state = app.state::<Mutex<BackendState>>();
    let mut s = state.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut stdin) = s.stdin {
        writeln!(stdin, "{}", message).map_err(|e| format!("Write error: {}", e))?;
        stdin.flush().map_err(|e| format!("Flush error: {}", e))?;
        Ok(())
    } else {
        Err("Backend not started".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(Mutex::new(BackendState { stdin: None }))
        .invoke_handler(tauri::generate_handler![start_backend, send_to_backend])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
