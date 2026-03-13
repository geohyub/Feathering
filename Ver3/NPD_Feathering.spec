# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for NPD Feathering Analysis.
Builds a single .exe file with all dependencies bundled.

Usage:
    pyinstaller NPD_Feathering.spec --noconfirm
    OR
    double-click build_exe.bat
"""

import sys
from pathlib import Path

block_cipher = None
work_dir = Path(SPECPATH)

a = Analysis(
    [str(work_dir / 'GUI.py')],
    pathex=[str(work_dir)],
    binaries=[],
    datas=[],
    hiddenimports=[
        'Parser_2',
        'pandas',
        'numpy',
        'matplotlib',
        'matplotlib.backends.backend_agg',
        'matplotlib.backends.backend_tkagg',
        'tkinter',
        'tkinter.font',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'pytest', 'sphinx', 'IPython', 'jupyter',
        'notebook', 'nbconvert', 'docutils',
        'PIL', 'scipy', 'PyQt5', 'PyQt6',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='NPD_Feathering_Analysis',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,              # No console window — GUI only
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
