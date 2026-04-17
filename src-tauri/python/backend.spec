# -*- mode: python ; coding: utf-8 -*-
"""Feathering backend sidecar — PyInstaller onefile spec.

Build: pyinstaller backend.spec --clean

Produces `dist/feathering-backend.exe` (Windows) — a standalone binary
that embeds Python 3 + numpy + pandas + matplotlib + Parser_2. The
Tauri shell (src-tauri/src/lib.rs) spawns this exe as a sidecar and
reads its NDJSON stdout.

Bundling the backend this way removes the "installer runs but
nothing happens because the user has no Python" failure mode.

Copyright (c) 2025-2026 Geoview Co., Ltd.
"""

from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules

SPEC_DIR = Path(SPECPATH).resolve()  # type: ignore[name-defined]
block_cipher = None

hiddenimports = [
    "numpy",
    "pandas",
    "matplotlib",
    "matplotlib.backends.backend_agg",
    "matplotlib.figure",
    "Parser_2",
]
hiddenimports += collect_submodules("matplotlib.backends")

a = Analysis(
    [str(SPEC_DIR / "backend.py")],
    pathex=[str(SPEC_DIR)],
    binaries=[],
    datas=[
        (str(SPEC_DIR / "Parser_2.py"), "."),
    ],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter", "customtkinter",
        "PyQt5", "PyQt6", "PySide2", "PySide6",
        "IPython", "jupyter", "notebook", "sphinx",
        "pytest", "setuptools", "pip", "wheel",
        "scipy", "torch", "tensorflow", "sklearn",
        "cv2", "h5py", "pyarrow",
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="feathering-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    runtime_tmpdir=None,
    console=True,       # sidecar reads stdout; console=True is correct
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
