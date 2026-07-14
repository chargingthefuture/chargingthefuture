import PluginRoutePage from '../[pluginSlug]/page';

// Explicit route for /apps/directory.
//
// The Directory shell is rendered by the [pluginSlug] catch-all (see ../[pluginSlug]/page.tsx,
// where `slug === 'directory'`). This `directory/` folder also holds deep-link redirect subpages
// ([handle] and profile/[handle]), so a static `directory` segment sits beside the dynamic
// `[pluginSlug]` sibling. Leaving `/apps/directory` to resolve by Next.js falling through from this
// static segment (which would otherwise have no page of its own) to the dynamic sibling is fragile:
// it depends on a framework route-precedence detail that can change between versions and is easy to
// break by accident. This page removes that reliance — it delegates to the same catch-all handler
// with a fixed slug, so /apps/directory is a real, deterministic route while all access gating
// (unlock, public-visitor, admin) stays defined in exactly one place.
export const dynamic = 'force-dynamic';

export default async function DirectoryRoutePage() {
  return PluginRoutePage({
    params: Promise.resolve({ pluginSlug: 'directory' }),
    searchParams: Promise.resolve({}),
  });
}
