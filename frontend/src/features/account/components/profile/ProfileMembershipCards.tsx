import { Link } from "react-router-dom";

import { extractYear } from "../../utils/profileEditor";

type ProfileMembershipCardsProps = {
  addressCount: number;
  createdAt?: string;
  emailVerified: boolean;
  isResendingVerification: boolean;
  orderCount: number;
  onResendVerification: () => void;
};

export function ProfileMembershipCards({
  addressCount,
  createdAt,
  emailVerified,
  isResendingVerification,
  orderCount,
  onResendVerification,
}: ProfileMembershipCardsProps) {
  return (
    <section className="profile-route-cards">
      <article className="profile-route-card">
        <span className="profile-route-card-icon" aria-hidden="true" />
        <div className="profile-route-card-copy">
          <h3>Two-Factor Auth</h3>
          <p>Enhance your account security by adding an extra layer of verification for all logins.</p>
        </div>
        <Link className="profile-route-card-link" to="/security">
          Setup Now <span aria-hidden="true">-</span>
        </Link>
      </article>

      <article className="profile-route-card profile-route-card-accent">
        <span className="profile-route-card-icon profile-route-card-icon-accent" aria-hidden="true" />
        <div className="profile-route-card-copy">
          <h3>ND Membership</h3>
          <p>
            {emailVerified
              ? `Member since ${extractYear(createdAt)}. You have ${orderCount} orders and ${addressCount} saved addresses in your account.`
              : "Verify your email to strengthen account recovery and unlock a more complete membership profile."}
          </p>
        </div>

        {emailVerified ? (
          <Link className="profile-route-card-link" to="/myorders">
            View Rewards <span aria-hidden="true">-</span>
          </Link>
        ) : (
          <button className="profile-route-card-link" type="button" onClick={onResendVerification}>
            {isResendingVerification ? "Sending..." : "Verify Email"} <span aria-hidden="true">-</span>
          </button>
        )}
      </article>
    </section>
  );
}
