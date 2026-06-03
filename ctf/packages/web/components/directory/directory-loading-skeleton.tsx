// The Directory loading state is the single app-wide loading screen. The old
// content skeleton was removed — see components/shared/app-loading.tsx.
import { AppLoading } from "@/components/shared/app-loading";

export function DirectoryLoadingSkeleton() {
  return <AppLoading />;
}
