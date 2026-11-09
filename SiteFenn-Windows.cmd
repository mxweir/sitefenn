@echo off
cd /d "%~dp0"
node scripts\launch.mjs %*
set "SITEFENN_EXIT=%ERRORLEVEL%"
pause
exit /b %SITEFENN_EXIT%
