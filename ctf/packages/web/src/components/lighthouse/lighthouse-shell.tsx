import {
  getLighthouseAdminStats,
  getProfile,
  listAnnouncementsForLighthouseUser,
  listBlocks,
  listMatches,
  listMyProperties,
  listProperties,
} from "@/src/lib/lighthouse/repository";
import {
  PluginShell,
  PluginCard,
  PluginStat,
  PluginGrid,
  PluginSection,
  PluginList,
  PluginListItem,
  PluginEmptyState,
  PluginAlert,
  PluginButton,
  PluginInput,
} from "@/src/components/plugin-shell/plugin-shell";

type LighthouseShellProps = {
  userId: string;
  isAdmin: boolean;
  role: string | null;
};

export async function LighthouseShell({
  userId,
  isAdmin,
  role,
}: LighthouseShellProps) {
  const [
    profile,
    properties,
    myProperties,
    matches,
    blocks,
    announcements,
  ] = await Promise.all([
    getProfile(userId),
    listProperties({ page: 1, pageSize: 8 }),
    listMyProperties(userId),
    listMatches(userId),
    listBlocks(userId),
    listAnnouncementsForLighthouseUser({ userId, role, page: 1, pageSize: 8 }),
  ]);

  const adminStats = isAdmin ? await getLighthouseAdminStats() : null;

  return (
    <PluginShell
      title="Lighthouse"
      subtitle="Safe housing connections for survivors. Find secure, vetted accommodations."
      accentColor="teal"
    >
      {/* Stats Overview */}
      <PluginGrid>
        <PluginStat
          label="Available Properties"
          value={properties.total}
          accentColor="teal"
        />
        <PluginStat
          label="My Listings"
          value={myProperties.length}
          accentColor="blue"
        />
        <PluginStat
          label="Active Matches"
          value={matches.length}
          accentColor="green"
        />
        <PluginStat
          label="Blocked Users"
          value={blocks.length}
          accentColor="orange"
        />
      </PluginGrid>

      {/* Two Column Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Profile Section */}
        <PluginCard title="Your Housing Profile">
          {profile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <p>
                <strong>Type:</strong> {profile.profileType}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                {profile.isActive ? (
                  <span style={{ color: "var(--accent-green)" }}>Active</span>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>Inactive</span>
                )}
              </p>
              <p>
                <strong>Has Property:</strong>{" "}
                {profile.hasProperty ? "Yes" : "No"}
              </p>
              <p style={{ color: "var(--text-muted)", marginTop: "8px" }}>
                {profile.bio ?? "No bio set. Add one to help others learn about you."}
              </p>
            </div>
          ) : (
            <PluginEmptyState message="No profile created yet. Create your housing profile to start connecting with safe accommodations." />
          )}
        </PluginCard>

        {/* Announcements */}
        <PluginCard title="Announcements">
          {announcements.items.length > 0 ? (
            <PluginList>
              {announcements.items.map((item) => (
                <PluginListItem
                  key={item.id}
                  title={item.title}
                  subtitle={item.body}
                  accentColor="teal"
                />
              ))}
            </PluginList>
          ) : (
            <PluginEmptyState message="No announcements at this time." />
          )}
        </PluginCard>
      </div>

      {/* Properties and Matches */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <PluginCard title="Browse Properties">
          {properties.items.length > 0 ? (
            <PluginList>
              {properties.items.map((property) => (
                <PluginListItem
                  key={property.id}
                  title={property.title}
                  subtitle={`${property.city ?? "Unknown city"}, ${property.country ?? "Unknown country"}`}
                  accentColor="blue"
                />
              ))}
            </PluginList>
          ) : (
            <PluginEmptyState message="No active properties listed." />
          )}
        </PluginCard>

        <PluginCard title="Your Matches">
          {matches.length > 0 ? (
            <PluginList>
              {matches.map((match) => (
                <PluginListItem
                  key={match.id}
                  title={`Match ${match.id.slice(0, 8)}...`}
                  subtitle={`Status: ${match.status}`}
                  accentColor="green"
                />
              ))}
            </PluginList>
          ) : (
            <PluginEmptyState message="No matches yet. Browse properties to find your next safe space." />
          )}
        </PluginCard>
      </div>

      {/* Service Credits Form */}
      <PluginCard title="Send Service Credits">
        <p style={{ marginBottom: "16px", color: "var(--text-secondary)" }}>
          Support another community member by sending service credits.
        </p>
        <form
          action="/api/lighthouse/service-credits"
          method="POST"
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            const res = await fetch("/api/lighthouse/service-credits", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                toUserId: formData.get("toUserId"),
                amount: Number(formData.get("amount")),
                reason: formData.get("reason"),
              }),
            });
            if (res.ok) {
              alert("Service credits sent!");
              form.reset();
            } else {
              const data = await res.json();
              alert(data.message || "Failed to send service credits.");
            }
          }}
        >
          <PluginInput
            label="Recipient User ID"
            id="toUserId"
            name="toUserId"
            required
            placeholder="Enter recipient ID"
          />
          <PluginInput
            label="Amount"
            id="amount"
            name="amount"
            type="number"
            min={1}
            required
            placeholder="Enter amount"
          />
          <PluginInput
            label="Reason (optional)"
            id="reason"
            name="reason"
            placeholder="Why are you sending credits?"
          />
          <PluginButton type="submit">Send Credits</PluginButton>
        </form>
      </PluginCard>

      {/* Admin Section */}
      {adminStats && (
        <PluginCard title="Admin Dashboard">
          <PluginAlert type="info">
            You have admin access. View detailed statistics below.
          </PluginAlert>
          <PluginGrid>
            <PluginStat
              label="Total Seekers"
              value={adminStats.seekers}
              accentColor="purple"
            />
            <PluginStat
              label="Total Hosts"
              value={adminStats.hosts}
              accentColor="blue"
            />
            <PluginStat
              label="Total Properties"
              value={adminStats.properties}
              accentColor="teal"
            />
            <PluginStat
              label="Active Matches"
              value={adminStats.activeMatches}
              accentColor="green"
            />
          </PluginGrid>
          <div style={{ marginTop: "16px" }}>
            <a
              href="/admin/lighthouse"
              style={{
                color: "var(--brand-primary)",
                textDecoration: "underline",
              }}
            >
              Open Admin Panel
            </a>
          </div>
        </PluginCard>
      )}
    </PluginShell>
  );
}
