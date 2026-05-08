import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';

export const dynamic = 'force-dynamic';
import { getPublishedWeeklyTopic } from 'lib/peer-programming/repository';

export default async function PeerProgrammingAdminPage() {
  const decision = await evaluatePluginAccess({ requireApprovedUserOrAdmin: true, requireUsername: false });
  if (!decision.allowed || !decision.isAdmin) {
    redirect('/apps/peer-programming');
  }

  const topic = await getPublishedWeeklyTopic();

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Peer Programming Admin</h1>
      <div className="rounded-lg border bg-card p-5 space-y-3 mb-6">
        <h2 className="text-lg font-medium">Current Week Topic</h2>
        {topic ? (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Title</dt>
            <dd className="font-medium">{topic.title}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">{topic.status}</dd>
            <dt className="text-muted-foreground">Week start</dt>
            <dd className="font-medium">{topic.weekStartDate}</dd>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No topic published for the current week.</p>
        )}
      </div>
      <div className="rounded-lg border bg-card p-5 space-y-2">
        <h2 className="text-lg font-medium">Admin APIs</h2>
        <ul className="text-sm text-muted-foreground space-y-1 font-mono">
          <li>GET /api/peer-programming/admin/topics</li>
          <li>PUT /api/peer-programming/admin/topics</li>
          <li>POST /api/peer-programming/admin/assignments/run</li>
        </ul>
      </div>
    </div>
  );
}
