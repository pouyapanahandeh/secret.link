import { ProfileEditForm } from "../../components/ProfileEditForm";
import { ProfileView } from "../../components/ProfileView";
import { getApiBase } from "../../lib/api.client";
import type { DashboardProfileTabProps } from "./types";

export function DashboardProfileTab({
  user,
  editingProfile,
  bio,
  socials,
  avatarUrl,
  profileSaving,
  profileSaved,
  passkey,
  onBioChange,
  onSocialsChange,
  onAvatarUrlChange,
  onSave,
  onCancelEdit,
  onShare,
  onStats,
  onEdit,
}: DashboardProfileTabProps) {
  return (
    <section>
      {editingProfile ? (
        <ProfileEditForm
          bio={bio}
          socials={socials}
          avatarUrl={avatarUrl}
          handle={user.handle}
          onBioChange={onBioChange}
          onSocialsChange={onSocialsChange}
          onAvatarUrlChange={onAvatarUrlChange}
          onSave={onSave}
          onCancel={onCancelEdit}
          saving={profileSaving}
        />
      ) : (
        <ProfileView
          profile={{
            id: user.id,
            handle: user.handle,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            socials: user.socials,
            isPro: user.isPro,
            followersCount: user.followersCount,
            followingCount: user.followingCount,
          }}
          handle={user.handle}
          mode="owner"
          apiBase={getApiBase()}
          followersCount={user.followersCount ?? 0}
          followingCount={user.followingCount ?? 0}
          onShare={onShare}
          onStats={onStats}
          onEdit={onEdit}
        />
      )}

      <p className="text-xs text-text-muted mt-4">
        {user.email ?? "No email set"}
        {passkey.hasPasskey ? " · Passkey active" : ""}
        {profileSaved ? " · Saved ✓" : ""}
      </p>

      {!passkey.hasPasskey && (
        <button
          onClick={passkey.onAddPasskey}
          disabled={passkey.status === "loading"}
          className="w-full mt-4 text-sm bg-surface-raised border border-border text-text px-4 py-3 rounded-xl hover:border-accent/50 transition-colors disabled:opacity-50"
        >
          {passkey.status === "loading" ? "Setting up..." : "Add passkey"}
        </button>
      )}
      {passkey.error && <p className="text-red-400 text-xs mt-2">{passkey.error}</p>}
    </section>
  );
}
