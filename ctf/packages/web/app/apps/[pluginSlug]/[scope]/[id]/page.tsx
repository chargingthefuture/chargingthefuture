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
 */
export default async function LegacyProfileRedirectPage({ params }: LegacyProfileRedirectProps) {
  const { pluginSlug, scope, id } = await params;

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

    if (!result.rows || result.rows.length === 0) {
      // No mapping found - the legacy entity may have been deleted or not migrated yet
      // For Directory, the legacy URL pattern is /apps/directory/public/{id}
      // but new pattern is just /apps/directory - so redirect to shell
      if (pluginSlug === 'directory') {
        redirect(`/apps/${pluginSlug}`);
      }
      // For other plugins, redirect to the plugin shell; user can navigate from there
      redirect(`/apps/${pluginSlug}`);
    }

    const { current_entity_id: newId } = result.rows[0];

    // Construct the new URL based on plugin-specific routing patterns
    const newUrl = `${pluginSlug === 'directory' ? `/apps/${pluginSlug}/${newId}` : `/apps/${pluginSlug}/${scope}/${newId}`}`;

    redirect(newUrl);
  } catch (error) {
    // If database query fails, redirect to plugin shell as fallback
    console.error('Legacy profile redirect lookup failed:', error);
    redirect(`/apps/${pluginSlug}`);
  }
}
