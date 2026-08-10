// The date the platform launched, as one platform-owned constant.
//
// 2026-06-12 is the soft launch (owner decision, 2026-08-06). The Render production deploy came
// slightly earlier (2026-05-25, PRs #98–#117), but the announced launch is the date members count
// from. Nothing on the platform has real history before this date, so any surface that shows a
// running total or a run of time periods starts here rather than inventing empty pre-launch
// windows.
//
// This file is platform-owned, not plugin-owned: it lives outside every plugin directory so that
// GDP, Weekly Performance, and anything added later all read the same value. If the owner fixes a
// different launch date, change it here only.
export const PLATFORM_LAUNCH_DATE_ISO = "2026-06-12";
