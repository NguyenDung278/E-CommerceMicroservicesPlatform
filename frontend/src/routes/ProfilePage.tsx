import { Link } from "react-router-dom";

import { AccountPageLayout } from "../features/account/components/AccountPageLayout";
import { ProfileEditorForm } from "../features/account/components/profile/ProfileEditorForm";
import { ProfileHeroPanel } from "../features/account/components/profile/ProfileHeroPanel";
import { ProfileMembershipCards } from "../features/account/components/profile/ProfileMembershipCards";
import { ProfileRecentOrdersPanel } from "../features/account/components/profile/ProfileRecentOrdersPanel";
import { useProfilePageState } from "../features/account/hooks/useProfilePageState";
import "./ProfilePage.css";

export function ProfilePage() {
  const profilePage = useProfilePageState();

  return (
    <AccountPageLayout>
      <div className="profile-route">
        {profilePage.feedback ? (
          <div className="profile-route-feedback">
            <span className="profile-route-feedback-icon" aria-hidden="true" />
            <span>{profilePage.feedback}</span>
          </div>
        ) : null}

        <section className="profile-route-section profile-route-profile-shell">
          <ProfileHeroPanel
            displayName={profilePage.displayName}
            email={profilePage.user?.email || ""}
            initials={profilePage.initials}
            locationLabel={profilePage.locationLabel}
            memberSince={profilePage.memberSince}
            phone={profilePage.user?.phone}
            showDevBadge={profilePage.showDevBadge}
            onToggleEdit={() => profilePage.setIsEditingProfile((current) => !current)}
          />

          {profilePage.isEditingProfile ? (
            <ProfileEditorForm
              canSubmit={profilePage.canSubmit}
              form={profilePage.profileForm}
              formErrors={profilePage.formErrors}
              formatCountdown={profilePage.formatCountdown}
              hasValidPhoneDraft={profilePage.hasValidPhoneDraft}
              isOtpBusy={profilePage.isOtpBusy}
              isSaving={profilePage.isSaving}
              otpExpiresIn={profilePage.otpExpiresIn}
              otpPanelVisible={profilePage.otpPanelVisible}
              otpResendIn={profilePage.otpResendIn}
              phoneChanged={profilePage.phoneChanged}
              phoneIsVerifiedForDraft={profilePage.phoneIsVerifiedForDraft}
              phoneVerification={profilePage.phoneVerification}
              userPhoneVerified={Boolean(profilePage.user?.phone_verified)}
              verificationPendingForDraft={profilePage.verificationPendingForDraft}
              onClose={() => profilePage.setIsEditingProfile(false)}
              onFieldChange={profilePage.handleFieldChange}
              onPhoneChange={profilePage.handlePhoneChange}
              onResendPhoneOtp={() => void profilePage.handleResendPhoneOtp()}
              onSendPhoneOtp={() => void profilePage.handleSendPhoneOtp()}
              onSubmit={profilePage.handleSubmit}
              onVerifyPhoneOtp={() => void profilePage.handleVerifyPhoneOtp()}
            />
          ) : null}
        </section>

        <section className="profile-route-section profile-route-section-compact">
          <div className="profile-route-subhead">
            <h2>Recent Orders</h2>
            <Link className="profile-route-text-link" to="/myorders">
              View all history <span aria-hidden="true">→</span>
            </Link>
          </div>

          <ProfileRecentOrdersPanel isLoading={profilePage.isOrdersLoading} orders={profilePage.recentOrders} />
        </section>

        <ProfileMembershipCards
          addressCount={profilePage.addresses.length}
          createdAt={profilePage.user?.created_at}
          emailVerified={Boolean(profilePage.user?.email_verified)}
          isResendingVerification={profilePage.isResendingVerification}
          orderCount={profilePage.orders.length}
          onResendVerification={() => void profilePage.handleResendVerification()}
        />
      </div>
    </AccountPageLayout>
  );
}
