import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useOrderPayments } from "../hooks/useOrderPayments";
import { useSavedAddresses } from "../hooks/useSavedAddresses";
import { getErrorMessage } from "../lib/api";
import { AccountPageFrame } from "../ui/account/AccountPageFrame";
import { formatShortDate, formatShortOrderId } from "../ui/account/accountConfig";
import { formatCurrency, formatStatusLabel } from "../utils/format";
import { sanitizeText } from "../utils/sanitize";
import { getUserDisplayName, isDevelopmentAccount } from "../utils/devAccounts";
import { validateProfile } from "../utils/validation";
import "./ProfilePage.css";

type ProfileFormState = {
  firstName: string;
  lastName: string;
};

const emptyForm: ProfileFormState = {
  firstName: "",
  lastName: ""
};

export function ProfilePage() {
  const { token, user, updateProfile, resendVerificationEmail } = useAuth();
  const { orders, isLoading } = useOrderPayments(token);
  const { addresses } = useSavedAddresses(token);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(emptyForm);
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    setProfileForm({
      firstName: user?.first_name || "",
      lastName: user?.last_name || ""
    });
  }, [user]);

  const displayName = getUserDisplayName(user);
  const initials = buildInitials(displayName);
  const recentOrders = useMemo(() => orders.slice(0, 3), [orders]);
  const defaultAddress = useMemo(() => addresses.find((item) => item.is_default) ?? addresses[0] ?? null, [addresses]);
  const memberSince = useMemo(() => buildMemberSinceLabel(user?.created_at), [user?.created_at]);
  const locationLabel = defaultAddress
    ? [defaultAddress.city, defaultAddress.district].filter(Boolean).join(", ")
    : "No saved address yet";
  const showDevBadge = isDevelopmentAccount(user);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      first_name: sanitizeText(profileForm.firstName),
      last_name: sanitizeText(profileForm.lastName)
    };
    const errors = validateProfile({
      firstName: payload.first_name,
      lastName: payload.last_name
    });
    if (errors.length > 0) {
      setFeedback(errors.join(" "));
      return;
    }

    try {
      setIsSaving(true);
      await updateProfile(payload);
      setFeedback("Your profile settings were updated successfully.");
      setIsEditingProfile(false);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResendVerification() {
    try {
      setIsResendingVerification(true);
      await resendVerificationEmail();
      setFeedback("A new verification email has been sent to your inbox.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsResendingVerification(false);
    }
  }

  return (
    <AccountPageFrame>
      <div className="profile-route">
        {feedback ? (
          <div className="profile-route-feedback">
            <span className="profile-route-feedback-icon" aria-hidden="true" />
            <span>{feedback}</span>
          </div>
        ) : null}

        <section className="profile-route-section profile-route-profile-shell">
          <div className="profile-route-hero">
            <div className="profile-route-avatar-column">
              <div className="profile-route-avatar-shell">
                <div className="profile-route-avatar">
                  <span>{initials}</span>
                </div>
                <button
                  className="profile-route-avatar-action"
                  type="button"
                  onClick={() => setIsEditingProfile((current) => !current)}
                >
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
                  <p>{user?.email || "Not available"}</p>
                </div>

                <div className="profile-route-field">
                  <label>Phone Number</label>
                  <p>{user?.phone || "Not set yet"}</p>
                </div>

                <div className="profile-route-field">
                  <label>Location</label>
                  <p>{locationLabel}</p>
                </div>
              </div>
            </div>
          </div>

          {isEditingProfile ? (
            <form className="profile-route-form" onSubmit={handleSubmit}>
              <div className="profile-route-form-head">
                <div>
                  <h2>Edit Profile</h2>
                  <p>Update the personal information shown in your account summary.</p>
                </div>

                <button className="ghost-button" type="button" onClick={() => setIsEditingProfile(false)}>
                  Close
                </button>
              </div>

              <div className="profile-route-form-grid">
                <label className="profile-route-form-field">
                  <span>First Name</span>
                  <input
                    value={profileForm.firstName}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        firstName: event.target.value
                      }))
                    }
                  />
                </label>

                <label className="profile-route-form-field">
                  <span>Last Name</span>
                  <input
                    value={profileForm.lastName}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        lastName: event.target.value
                      }))
                    }
                  />
                </label>
              </div>

              <div className="profile-route-form-actions">
                <button className="primary-button" disabled={isSaving} type="submit">
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          ) : null}
        </section>

        <section className="profile-route-section profile-route-section-compact">
          <div className="profile-route-subhead">
            <h2>Recent Orders</h2>
            <Link className="profile-route-text-link" to="/myorders">
              View all history <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="profile-route-orders-panel">
            {isLoading ? (
              <div className="page-state">Đang tải lịch sử giao dịch...</div>
            ) : recentOrders.length === 0 ? (
              <div className="empty-card history-empty profile-route-empty-state">
                <h3>You have not placed an order yet</h3>
                <p>Your most recent orders will appear here once checkout is complete.</p>
              </div>
            ) : (
              <table className="profile-route-orders-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link className="profile-route-order-link" to={`/orders/${order.id}`}>
                          {formatShortOrderId(order.id)}
                        </Link>
                      </td>
                      <td>{formatShortDate(order.created_at)}</td>
                      <td>{formatCurrency(order.total_price)}</td>
                      <td>
                        <span className={getOrderStatusClassName(order.status)}>{formatStatusLabel(order.status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="profile-route-cards">
          <article className="profile-route-card">
            <span className="profile-route-card-icon" aria-hidden="true" />
            <div className="profile-route-card-copy">
              <h3>Two-Factor Auth</h3>
              <p>Enhance your account security by adding an extra layer of verification for all logins.</p>
            </div>
            <Link className="profile-route-card-link" to="/security">
              Setup Now <span aria-hidden="true">—</span>
            </Link>
          </article>

          <article className="profile-route-card profile-route-card-accent">
            <span className="profile-route-card-icon profile-route-card-icon-accent" aria-hidden="true" />
            <div className="profile-route-card-copy">
              <h3>ND Membership</h3>
              <p>
                {user?.email_verified
                  ? `Member since ${extractYear(user?.created_at)}. You have ${orders.length} orders and ${addresses.length} saved addresses in your account.`
                  : "Verify your email to strengthen account recovery and unlock a more complete membership profile."}
              </p>
            </div>

            {user?.email_verified ? (
              <Link className="profile-route-card-link" to="/myorders">
                View Rewards <span aria-hidden="true">—</span>
              </Link>
            ) : (
              <button className="profile-route-card-link" type="button" onClick={() => void handleResendVerification()}>
                {isResendingVerification ? "Sending..." : "Verify Email"} <span aria-hidden="true">—</span>
              </button>
            )}
          </article>
        </section>
      </div>
    </AccountPageFrame>
  );
}

function buildInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "ND";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function buildMemberSinceLabel(value?: string) {
  const year = extractYear(value);

  return `Member since ${year}`;
}

function extractYear(value?: string) {
  const parsed = value ? new Date(value) : null;

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return "this year";
  }

  return String(parsed.getFullYear());
}

function getOrderStatusClassName(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("deliver") || normalized.includes("paid") || normalized.includes("success")) {
    return "profile-route-status profile-route-status-success";
  }
  if (normalized.includes("process") || normalized.includes("pending")) {
    return "profile-route-status profile-route-status-processing";
  }

  return "profile-route-status";
}
