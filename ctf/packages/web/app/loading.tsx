import { AppLoading } from '@/components/shared/app-loading';

// App-wide loading screen shown while any route segment streams. Delegates to the single shared
// AppLoading component so every surface's loading state is identical and correctly centered — it
// fills the viewport with min-height: 100dvh (the old CSS-module copy used height: 100vh, which
// collapsed in the streaming/flex context on mobile and pinned the text to the top). delayMs={0}
// keeps the route fallback's prior behavior of appearing immediately.
export default function Loading() {
  return <AppLoading delayMs={0} />;
}
