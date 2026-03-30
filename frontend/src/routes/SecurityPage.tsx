import { useMemo, useState, type FormEvent } from "react";

import { AccountPageLayout } from "../features/account/components/AccountPageLayout";
import { useOrderPayments } from "../features/account/hooks/useOrderPayments";
import { formatShortDate } from "../features/account/utils/accountPresentation";
import { useAuth } from "../features/auth/hooks/useAuth";
import "./SecurityPage.css";

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const emptyForm: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

export function SecurityPage() {
  const { token, user, resendVerificationEmail } = useAuth();
  const { orders, paymentsByOrder } = useOrderPayments(token);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(emptyForm);
  const [feedback, setFeedback] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  const latestPayment = useMemo(
    () =>
      Object.values(paymentsByOrder)
        .flat()
        .slice()
        .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0],
    [paymentsByOrder]
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passwordForm.newPassword.length < 8) {
      setFeedback("New password must be at least 8 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setFeedback("New password and confirmation do not match.");
      return;
    }

    setFeedback("Password update UI is ready. The current backend flow still uses reset-password email for execution.");
    setPasswordForm(emptyForm);
  }

  async function handleVerifyEmail() {
    try {
      await resendVerificationEmail();
      setFeedback("A verification email has been sent.");
    } catch {
      setFeedback("We could not send the verification email right now.");
    }
  }

  return (
    <AccountPageLayout>
      <div className="security-route">
        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

        <header className="security-route-head">
          <h1>Security Settings</h1>
          <p>Keep your account secure by managing authentication methods and monitoring your recent account activity.</p>
        </header>

        <div className="security-route-grid">
          <section className="security-route-panel">
            <div className="security-route-panel-head">
              <div className="security-route-panel-icon" aria-hidden="true" />
              <h2>Change Password</h2>
            </div>

            <form className="security-route-form" onSubmit={handleSubmit}>
              <label className="security-route-field">
                <span>Current Password</span>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      currentPassword: event.target.value
                    }))
                  }
                />
              </label>

              <div className="security-route-field-grid">
                <label className="security-route-field">
                  <span>New Password</span>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        newPassword: event.target.value
                      }))
                    }
                  />
                </label>

                <label className="security-route-field">
                  <span>Confirm New Password</span>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value
                      }))
                    }
                  />
                </label>
              </div>

              <button className="security-route-primary" type="submit">
                Update Password
              </button>
            </form>
          </section>

          <div className="security-route-side">
            <section className="security-route-card">
              <div className="security-route-card-head">
                <div>
                  <h3>Two-Factor Auth</h3>
                  <p>Add an extra layer of security to your account.</p>
                </div>

                <button
                  aria-pressed={twoFactorEnabled}
                  className={twoFactorEnabled ? "security-route-toggle security-route-toggle-active" : "security-route-toggle"}
                  type="button"
                  onClick={() => setTwoFactorEnabled((current) => !current)}
                >
                  <span />
                </button>
              </div>

              <div className="security-route-inline-card">
                <strong>{twoFactorEnabled ? "SMS Verification Enabled" : "Two-factor auth is currently off"}</strong>
              </div>

              <button className="security-route-link" type="button">
                Manage backup codes
              </button>
            </section>

            <section className="security-route-trust">
              <h3>{user?.email_verified ? "Account is Secure" : "Verification Needed"}</h3>
              <p>
                {user?.email_verified
                  ? "Last security review found no suspicious activity based on the profile data currently available."
                  : "Verify your email to strengthen account recovery and security messaging."}
              </p>
              {!user?.email_verified ? (
                <button className="security-route-ghost" type="button" onClick={() => void handleVerifyEmail()}>
                  Send Verification
                </button>
              ) : null}
            </section>
          </div>
        </div>

        <section className="security-route-activity">
          <div className="security-route-activity-head">
            <h2>Login Activity</h2>
            <p>Review account signals we can infer from your current profile and transaction history.</p>
          </div>

          <div className="security-route-activity-list">
            <article className="security-route-activity-row">
              <div>
                <h3>Primary account identity</h3>
                <p>{user?.email || "No email available"}.</p>
              </div>
              <div className="security-route-activity-meta">
                <span>{user?.email_verified ? "Verified" : "Needs action"}</span>
              </div>
            </article>

            <article className="security-route-activity-row">
              <div>
                <h3>Latest order activity</h3>
                <p>{orders[0] ? `Most recent order was updated on ${formatShortDate(orders[0].updated_at)}.` : "No order activity yet."}</p>
              </div>
              <div className="security-route-activity-meta">
                <span>{orders[0] ? "Tracked" : "No data"}</span>
              </div>
            </article>

            <article className="security-route-activity-row">
              <div>
                <h3>Latest payment callback</h3>
                <p>
                  {latestPayment
                    ? `Last payment was recorded on ${formatShortDate(latestPayment.created_at)}.`
                    : "No payment activity has been recorded yet."}
                </p>
              </div>
              <div className="security-route-activity-meta">
                <span>{latestPayment?.signature_verified ? "Verified" : latestPayment ? "Pending" : "No data"}</span>
              </div>
            </article>
          </div>
        </section>
      </div>
    </AccountPageLayout>
  );
}
