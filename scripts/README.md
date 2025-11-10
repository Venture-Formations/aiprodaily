# Scripts Directory

## Structure
- `maintenance/` – one-off diagnostics, schema checks, and safety scripts that query Supabase or tidy project state
- `tests/` – manual verification and load-test scripts, including `.sh` smoke checks and browser harnesses
- `tools/` – utility helpers for operational tasks (encoding credentials, etc.)

## Usage
- Run Node scripts with `node scripts/<subdir>/<script>.js`
- Execute shell utilities with `bash scripts/tests/<script>.sh`
- Manual HTML harnesses live under `scripts/tests/` for quick browser-based checks

