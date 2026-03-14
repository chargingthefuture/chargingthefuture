import {
  getOwnProfile,
  listAdminProfiles,
  listDirectoryAnnouncements,
  listDirectoryForMember,
} from "@/src/lib/directory/repository";
import type {
  DirectoryAnnouncement,
  DirectoryProfile,
} from "@/src/lib/directory/types";
import {
  PluginShell,
  PluginCard,
  PluginStat,
  PluginGrid,
  PluginList,
  PluginListItem,
  PluginEmptyState,
  PluginAlert,
} from "@/src/components/plugin-shell/plugin-shell";

type DirectoryShellProps = {
  userId: string;
  isAdmin: boolean;
};

type MemberListPayload = {
  items: DirectoryProfile[];
  pagination: { page: number; pageSize: number; total: number };
};

export async function DirectoryShell({ userId, isAdmin }: DirectoryShellProps) {
  const ownProfile = await getOwnProfile(userId);

  const listPayload = ownProfile
    ? await listDirectoryForMember(userId, { page: 1, pageSize: 20 }, {})
    : { items: [], pagination: { page: 1, pageSize: 20, total: 0 } };

  const announcements = await listDirectoryAnnouncements(true);
  const adminProfiles = isAdmin
    ? await listAdminProfiles({ page: 1, pageSize: 20 }, true)
    : null;
  const adminAnnouncements = isAdmin
    ? await listDirectoryAnnouncements(false)
    : null;

  return (
    <PluginShell
      title="Directory"
      subtitle="Connect with verified community members, mentors, and support providers."
      accentColor="orange"
    >
      {/* Your Profile */}
      <PluginCard title="Your Profile">
        {ownProfile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--accent-orange-soft)",
                  border: "2px solid var(--accent-orange)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "var(--accent-orange)",
                }}
              >
                {ownProfile.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{ margin: 0, color: "var(--text-primary)" }}>
                  {ownProfile.displayName}
                </h3>
                <p style={{ margin: "4px 0 0", color: "var(--text-muted)" }}>
                  {ownProfile.isPublic ? "Public Profile" : "Workspace Only"}
                </p>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
                marginTop: "8px",
              }}
            >
              <div
                style={{
                  padding: "12px",
                  background: "var(--background-elevated)",
                  borderRadius: "var(--radius-md)",
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Sector
                </p>
                <p style={{ margin: "4px 0 0", fontWeight: "500" }}>
                  {ownProfile.sectorName ?? "Not set"}
                </p>
              </div>
              <div
                style={{
                  padding: "12px",
                  background: "var(--background-elevated)",
                  borderRadius: "var(--radius-md)",
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Job Title
                </p>
                <p style={{ margin: "4px 0 0", fontWeight: "500" }}>
                  {ownProfile.jobTitleName ?? "Not set"}
                </p>
              </div>
              <div
                style={{
                  padding: "12px",
                  background: "var(--background-elevated)",
                  borderRadius: "var(--radius-md)",
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Skills
                </p>
                <p style={{ margin: "4px 0 0", fontWeight: "500" }}>
                  {ownProfile.skills.length} listed
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <PluginAlert type="warning">
              Create your directory profile to unlock member browsing and connect with
              the community.
            </PluginAlert>
          </div>
        )}
      </PluginCard>

      {/* Stats */}
      <PluginGrid>
        <PluginStat
          label="Total Members"
          value={listPayload.pagination.total}
          accentColor="orange"
        />
        <PluginStat
          label="Showing"
          value={listPayload.items.length}
          accentColor="blue"
        />
        <PluginStat
          label="Announcements"
          value={announcements.length}
          accentColor="green"
        />
      </PluginGrid>

      {/* Member Directory */}
      <PluginCard title="Member Directory">
        <p style={{ marginBottom: "16px", color: "var(--text-muted)" }}>
          Showing {listPayload.items.length} of {listPayload.pagination.total}{" "}
          community members.
        </p>
        {listPayload.items.length > 0 ? (
          <PluginList>
            {listPayload.items.map((profile) => (
              <PluginListItem
                key={profile.id}
                title={profile.displayName}
                subtitle={profile.headline ?? "Community member"}
                accentColor="orange"
              />
            ))}
          </PluginList>
        ) : (
          <PluginEmptyState message="No visible directory profiles yet. Create your profile to start connecting." />
        )}
      </PluginCard>

      {/* Announcements */}
      <PluginCard title="Community Announcements">
        {announcements.length > 0 ? (
          <PluginList>
            {announcements.map((announcement) => (
              <PluginListItem
                key={announcement.id}
                title={announcement.title}
                subtitle={announcement.body}
                accentColor="green"
              />
            ))}
          </PluginList>
        ) : (
          <PluginEmptyState message="No active announcements." />
        )}
      </PluginCard>

      {/* Admin Section */}
      {isAdmin && adminProfiles && adminAnnouncements && (
        <PluginCard title="Admin Controls">
          <PluginAlert type="info">
            Admin access enabled. Manage profiles and announcements below.
          </PluginAlert>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginTop: "16px",
            }}
          >
            <div
              style={{
                padding: "16px",
                background: "var(--background-elevated)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <h4 style={{ margin: "0 0 8px", color: "var(--text-primary)" }}>
                Profiles
              </h4>
              <p style={{ margin: "0 0 8px", color: "var(--text-muted)" }}>
                Total: {adminProfiles.pagination.total}
              </p>
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                First page: {adminProfiles.items.length} records
              </p>
            </div>
            <div
              style={{
                padding: "16px",
                background: "var(--background-elevated)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <h4 style={{ margin: "0 0 8px", color: "var(--text-primary)" }}>
                Announcements
              </h4>
              <p style={{ margin: "0 0 8px", color: "var(--text-muted)" }}>
                Total: {adminAnnouncements.length}
              </p>
              <a
                href="/admin/directory"
                style={{
                  color: "var(--brand-primary)",
                  fontSize: "0.8125rem",
                }}
              >
                Manage in Admin Panel
              </a>
            </div>
          </div>
        </PluginCard>
      )}
    </PluginShell>
  );
}
