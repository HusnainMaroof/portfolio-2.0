@echo off
rem orch: the agents\ entry point for cmd and PowerShell. Node 23.6+ runs the TypeScript directly.
node "%~dp0engine\src\cli.ts" %*
