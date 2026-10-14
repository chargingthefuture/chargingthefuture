import { redirect } from 'next/navigation';
import { queryDb } from 'lib/db/postgres';

type LegacyProfileRedirectProps = {
  params: Promise<{
    pluginSlug: string;
    scope: string;
    id: string;
  }>;
};

type RedirectRow = {
  current_entity_id: string;
};

/**
 * Catch-all route handler for legacy plugin profile URLs.
 *
 * Maps old URLs from the legacy /platform to new ctf rewrite URLs:
 * - /apps/directory/public/{legacyId} → /apps/directory/{newId}
 * - /apps/lighthouse/property/{legacyId} → /apps/lighthouse/property/{newId}
 * - /apps/socket-relay/public/{legacyId} → /apps/socket-relay/public/{newId}
 *
 * Uses legacy_profile_redirects table to resolve ID mappings during migration.
 *
 * `redirect()` works by throwing, so every call to it sits outside the
 * try/catch below. Inside the try, the catch would swallow the redirect and
 * send every mapped link to the plugin shell instead.
 */
export default async function LegacyProfileRedirectPage({ params }: LegacyProfileRedirectProps) {
  const { pluginSlug, scope, id } = await params;

  let newId: string | null = null;
  try {
    // Query the legacy redirect mapping table
    const result = await queryDb<RedirectRow>(
      `
      SELECT current_entity_id
      FROM legacy_profile_redirects
      WHERE plugin_slug = $1
        AND scope = $2
        AND legacy_entity_id = $3::uuid
      LIMIT 1
      `,
      [pluginSlug, scope, id]
    );
    newId = result.rows?.[0]?.current_entity_id ?? null;
  } catch (error) {
    // The lookup failed (including an id that is not a uuid): fall back to the plugin shell below.
    console.error(
      `Legacy profile redirect lookup failed for plugin "${pluginSlug}", scope "${scope}"; sending the visitor to the plugin shell:`,
      error
    );
  }

  if (!newId) {
    // No mapping found (the legacy entity may have been deleted or not migrated yet)
    // or the lookup failed: send the visitor to the plugin shell to navigate from there.
    redirect(`/apps/${pluginSlug}`);
  }

  // Construct the new URL based on plugin-specific routing patterns
  redirect(pluginSlug === 'directory' ? `/apps/${pluginSlug}/${newId}` : `/apps/${pluginSlug}/${scope}/${newId}`);
}
