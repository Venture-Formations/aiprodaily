@echo off
REM Dependency check hook - reminds Claude to consult DEPENDENCY_MAP.md
REM when the user's prompt involves modifying lib files or database changes.

setlocal enabledelayedexpansion

REM Read stdin (the hook input JSON) into a temp file
set "TMPFILE=%TEMP%\dep-check-%RANDOM%.json"
more > "%TMPFILE%"

REM Check if the prompt mentions modification-related keywords
findstr /i /c:"modify" /c:"change" /c:"refactor" /c:"update" /c:"fix" /c:"add" /c:"remove" /c:"delete" /c:"rename" /c:"move" /c:"migrate" /c:"src/lib" /c:"database" /c:"table" /c:"schema" /c:"migration" "%TMPFILE%" > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo.
    echo --- DEPENDENCY AWARENESS ---
    echo Before modifying code, check docs/architecture/DEPENDENCY_MAP.md
    echo for downstream impact. Run /impact-check {file} for quick analysis.
    echo ---
)

del "%TMPFILE%" 2>nul
exit /b 0
