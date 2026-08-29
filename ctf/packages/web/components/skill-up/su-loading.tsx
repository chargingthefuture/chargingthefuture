// The app has a single loading screen (AppLoading) and no per-plugin loading
// skeletons. This previously rendered a custom skeleton; it now re-exports the
// shared loading screen under the existing name so call sites are unchanged.
export { AppLoading as SkillUpLoading } from "@/components/shared/app-loading";
