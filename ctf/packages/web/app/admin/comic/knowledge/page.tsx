import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { ComicKnowledgeAdmin } from '../../../../components/comic/comic-knowledge-admin';

export const dynamic = 'force-dynamic';

// Curation of the assistant's grounding library (comic_knowledge_entries): list what the assistant
// can quote and switch entries off/on for retrieval. Admin-gated server-side; before this page the
// active flag was reachable only with direct DB tooling.
export default async function ComicKnowledgeAdminPage() {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    redirect('/');
  }

  return <ComicKnowledgeAdmin />;
}
