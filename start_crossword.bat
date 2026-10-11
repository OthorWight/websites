@echo off
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel%==0 (
  py crossword_generator.py
  goto :eof
)
where python >nul 2>&1
if %errorlevel%==0 (
  python crossword_generator.py
  goto :eof
)
echo Python was not found.
echo Install Python 3, then run this file again.
pause
