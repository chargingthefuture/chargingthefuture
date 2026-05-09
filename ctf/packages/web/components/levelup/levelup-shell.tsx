
import { CohortList } from './CohortList';
import { UserDashboard } from './UserDashboard';

type LevelupShellProps = {
  userId: string;
  isAdmin: boolean;
  query: {
    track?: string;
    status?: string;
    startDate?: string;
    cohortId?: string;
  };
};


// This is a simplified shell. In production, fetch real data and pass to components.
export async function LevelupShell(props: LevelupShellProps) {
  // Mock data for typecheck and demo
  const cohorts = [
    {
      id: '1',
      title: 'Web Development Fundamentals',
      track: 'Tech',
      status: 'open',
      startDate: '2026-04-10',
      seatsAvailable: 4,
      requiredCredits: 40,
    },
  ];
  const activeCohortId = props.query.cohortId || null;
  const wallet = {
    availableBalance: 148,
    walletEscrowBalance: 16,
    levelupEscrowedBalance: 16,
  };
  const activeEnrollments = [
    { id: '1', title: 'Web Development Fundamentals', track: 'Tech', status: 'active', progress: 40 },
  ];
  const recentTransactions = [
    { id: 't1', type: 'Credit', amount: 40, referenceType: 'Enrollment', createdAtIso: new Date().toISOString() },
  ];

  return (
    <div style={{ display: 'flex', gap: 32 }}>
      <div style={{ flex: 2 }}>
        <CohortList cohorts={cohorts} activeCohortId={activeCohortId} />
      </div>
      <div style={{ flex: 1 }}>
        <UserDashboard wallet={wallet} activeEnrollments={activeEnrollments} recentTransactions={recentTransactions} />
      </div>
    </div>
  );
}
