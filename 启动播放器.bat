@echo off
title 音乐视频播放器
color 0A

echo ========================================
echo    音乐视频播放器 - 启动中...
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] 正在启动开发服务器...
start "音乐视频播放器" cmd /k "pnpm dev"

echo [2/2] 正在打开浏览器...
timeout /t 5 /nobreak >nul
start http://localhost:5000

echo.
echo ========================================
echo    启动完成！
echo    请在浏览器中查看效果
echo    按任意键关闭此窗口...
echo ========================================
pause >nul
