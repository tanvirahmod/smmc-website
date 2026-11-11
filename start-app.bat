@echo off
REM SMMC College Portal - starts the API + site together (same as: npm run dev:all).
REM This file is launched automatically at Windows login by the
REM "SMMC College Portal" scheduled task. You can also double-click it anytime.
cd /d "%~dp0"
title SMMC College Portal (API + Site)
call npm run dev:all
