# -*- mode: python ; coding: utf-8 -*-
# PyInstaller 打包配置：在仓库根目录执行
#   python -m PyInstaller packaging/PaperLens.spec --distpath . --workpath build --noconfirm
# 生成单文件 PaperLens.exe（内嵌 index.html，零第三方运行时依赖）

a = Analysis(
    ['../app.py'],
    pathex=[],
    binaries=[],
    datas=[('../index.html', '.')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='PaperLens',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
