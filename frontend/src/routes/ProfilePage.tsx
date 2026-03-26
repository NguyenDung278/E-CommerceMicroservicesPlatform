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
import { getUserDisplayName } from "../utils/devAccounts";
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

        <section className="profile-route-section">
          <div className="profile-route-head">
            <div>
              <h1>Personal Information</h1>
              <p>Manage your profile details and preferences.</p>
            </div>

            <button
              className="primary-button profile-route-edit-trigger"
              type="button"
              onClick={() => setIsEditingProfile((current) => !current)}
            >
              {isEditingProfile ? "Close Editor" : "Edit Profile"}
            </button>
          </div>

          <div className="profile-route-hero">
            <div className="profile-route-avatar-column">
              <div className="profile-route-avatar-shell">
                <div className="profile-route-avatar">{initials}</div>
                <button className="profile-route-avatar-action" type="button">
                  <span className="profile-route-avatar-camera" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="profile-route-fields">
              <div className="profile-route-field">
                <label>Full Name</label>
                <p>{displayName}</p>
              </div>
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
                <p>
                  {defaultAddress
                    ? [defaultAddress.city, defaultAddress.district].filter(Boolean).join(", ")
                    : "No saved address yet"}
                </p>
              </div>
            </div>
          </div>

          {isEditingProfile ? (
            <form className="profile-route-form" onSubmit={handleSubmit}>
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

              <div className="profile-route-form-actions">
                <button className="primary-button" disabled={isSaving} type="submit">
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
                <button className="ghost-button" type="button" onClick={() => setIsEditingProfile(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </section>

        <section className="profile-route-section profile-route-section-compact">
          <div className="profile-route-subhead">
            <h2>Recent Orders</h2>
            <Link className="profile-route-text-link" to="/profile/orders">
              View All Orders
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
                    <th aria-label="actions" />
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{formatShortOrderId(order.id)}</td>
                      <td>{formatShortDate(order.created_at)}</td>
                      <td>{formatCurrency(order.total_price)}</td>
                      <td>
                        <span className={getOrderStatusClassName(order.status)}>{formatStatusLabel(order.status)}</span>
                      </td>
                      <td>
                        <Link className="profile-route-arrow-link" to={`/orders/${order.id}`}>
                          <span aria-hidden="true">›</span>
                        </Link>
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
            <h3>Two-Factor Auth</h3>
            <p>Protect your account with an extra layer of security. We recommend using an authenticator app.</p>
            <Link className="profile-route-card-link" to="/profile/security">
              Enable Security
            </Link>
          </article>

          <article className="profile-route-card profile-route-card-accent">
            <span className="profile-route-card-icon profile-route-card-icon-accent" aria-hidden="true" />
            <h3>Email Verification</h3>
            <p>
              {user?.email_verified
                ? "Your account email is verified and ready for recovery, receipts and order alerts."
                : "Verify your email to strengthen account recovery and receive important order notifications."}
            </p>
            <button className="profile-route-card-link" type="button" onClick={() => void handleResendVerification()}>
              {isResendingVerification ? "Sending..." : user?.email_verified ? "Verification Complete" : "Send Verification"}
            </button>
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
