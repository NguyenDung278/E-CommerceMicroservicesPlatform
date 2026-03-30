type ProfileHeroPanelProps = {
  displayName: string;
  email: string;
  initials: string;
  locationLabel: string;
  memberSince: string;
  phone?: string;
  showDevBadge: boolean;
  onToggleEdit: () => void;
};

export function ProfileHeroPanel({
  displayName,
  email,
  initials,
  locationLabel,
  memberSince,
  phone,
  showDevBadge,
  onToggleEdit,
}: ProfileHeroPanelProps) {
  return (
    <div className="profile-route-hero">
      <div className="profile-route-avatar-column">
        <div className="profile-route-avatar-shell">
          <div className="profile-route-avatar">
            <span>{initials}</span>
          </div>
          <button className="profile-route-avatar-action" type="button" onClick={onToggleEdit}>
            <span className="profile-route-avatar-pencil" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="profile-route-hero-copy">
        <div className="profile-route-identity-row">
          <div className="profile-route-identity">
            <h1>{displayName}</h1>
            <p className="profile-route-membership">
              <span className="profile-route-membership-icon" aria-hidden="true" />
              <span>{memberSince}</span>
            </p>
          </div>

          {showDevBadge ? <span className="profile-route-dev-badge">Dev Only: Profile_v2</span> : null}
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
