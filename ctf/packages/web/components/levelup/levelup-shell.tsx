
import { listCohorts, getUserDashboardData } from 'lib/levelup/repository';
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

export async function LevelupShell(props: LevelupShellProps) {
  const { userId, query } = props;

  const [cohorts, dashboardData] = await Promise.all([
    listCohorts({
      track: query.track,
      status: query.status,
      startDate: query.startDate,
    }).catch(() => []),
    getUserDashboardData(userId).catch(() => ({
      wallet: { availableBalance: 0, walletEscrowBalance: 0, levelupEscrowedBalance: 0 },
      activeEnrollments: [],
      recentTransactions: [],
    })),
  ]);

  const activeCohortId = query.cohortId || null;

  return (
    <div style={{ display: 'flex', gap: 32 }}>
      <div style={{ flex: 2 }}>
        <CohortList cohorts={cohorts} activeCohortId={activeCohortId} />
      </div>
      <div style={{ flex: 1 }}>
        <UserDashboard
          wallet={dashboardData.wallet}
          activeEnrollments={dashboardData.activeEnrollments}
          recentTransactions={dashboardData.recentTransactions}
        />
      </div>
    </div>
  );
}
