import { Link } from "react-router-dom";

import { extractYear } from "../../utils/profile-editor";

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
          <h3>Security Center</h3>
          <p>
            Review password hygiene, recovery readiness, and verification status from a single
            control panel.
          </p>
        </div>
        <Link className="profile-route-card-link" to="/security">
          Open Security <span aria-hidden="true">{"->"}</span>
        </Link>
      </article>

      <article className="profile-route-card profile-route-card-accent">
        <span
          className="profile-route-card-icon profile-route-card-icon-accent"
          aria-hidden="true"
        />
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
            View Order History <span aria-hidden="true">{"->"}</span>
          </Link>
        ) : (
          <button className="profile-route-card-link" type="button" onClick={onResendVerification}>
            {isResendingVerification ? "Sending..." : "Verify Email"}{" "}
            <span aria-hidden="true">{"->"}</span>
          </button>
        )}
      </article>
    </section>
  );
}
