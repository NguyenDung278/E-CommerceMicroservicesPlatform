type ProfileHeroPanelProps = {
  avatarUrl?: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  initials: string;
  locationLabel: string;
  memberSince: string;
  phone?: string;
  phoneVerified: boolean;
  onToggleEdit: () => void;
};

export function ProfileHeroPanel({
  avatarUrl,
  displayName,
  email,
  emailVerified,
  initials,
  locationLabel,
  memberSince,
  phone,
  phoneVerified,
  onToggleEdit,
}: ProfileHeroPanelProps) {
  return (
    <div className="profile-route-hero">
      <div className="profile-route-avatar-column">
        <div className="profile-route-avatar-shell">
          <div className="profile-route-avatar">
            {avatarUrl ? (
              <img
                alt={`${displayName} avatar`}
                className="profile-route-avatar-image"
                src={avatarUrl}
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <button
            aria-label="Edit profile"
            className="profile-route-avatar-action"
            type="button"
            onClick={onToggleEdit}
          >
            <span className="profile-route-avatar-pencil" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="profile-route-hero-copy">
        <div className="profile-route-identity-row">
          <div className="profile-route-identity">
            <h1>{displayName}</h1>
            <div className="profile-route-identity-meta">
              <p className="profile-route-membership">
                <span className="profile-route-membership-icon" aria-hidden="true" />
                <span>{memberSince}</span>
              </p>
              <div className="profile-route-meta-row">
                <span
                  className={
                    emailVerified
                      ? "profile-route-meta-chip profile-route-meta-chip-success"
                      : "profile-route-meta-chip"
                  }
                >
                  {emailVerified ? "Email verified" : "Verify email"}
                </span>
                <span
                  className={
                    phoneVerified
                      ? "profile-route-meta-chip profile-route-meta-chip-success"
                      : "profile-route-meta-chip"
                  }
                >
                  {phoneVerified ? "Phone verified" : "Phone pending"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-route-divider" />

        <div className="profile-route-fields">
          <div className="profile-route-field">
            <label>Email Address</label>
            <p>{email || "Not available"}</p>
          </div>

          <div className="profile-route-field">
            <label>Phone Number</label>
            <p>{phone || "Not set yet"}</p>
          </div>

          <div className="profile-route-field">
            <label>Location</label>
            <p>{locationLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
