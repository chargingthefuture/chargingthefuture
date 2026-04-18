# Mobile Package

## Purpose
Expo + React Native Android client for the CTF platform, using a cloud-first workflow.

## Architecture Overview
- Built with Expo and React Native
- Follows patterns in `EXPO_GUIDE.md`
- Uses `@ctf/shared` for business logic and API calls

## Development Setup
- Start the mobile app:  
  ```sh
  pnpm dev:mobile
  ```
  (Run from the repo root)

## Build Workflow
- Preview and release builds are managed via GitHub Actions.

## Dependencies
- Workspace: `@ctf/shared`

## Related Documentation
- [EXPO_CLOUD_WORKFLOW.md](../../docs/mobile/EXPO_CLOUD_WORKFLOW.md)
- [TOMORROW_EXPO_ENV_SETUP_RUNBOOK.md](../../docs/mobile/TOMORROW_EXPO_ENV_SETUP_RUNBOOK.md)
