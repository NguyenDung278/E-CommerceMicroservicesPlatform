import { Link } from "react-router-dom";

import { AccountPageLayout } from "@/features/account/components/account-page-layout";
import { ProfileEditorForm } from "@/features/account/components/profile/profile-editor-form";
import { ProfileHeroPanel } from "@/features/account/components/profile/profile-hero-panel";
import { ProfileMembershipCards } from "@/features/account/components/profile/profile-membership-cards";
import { ProfileRecentOrdersPanel } from "@/features/account/components/profile/profile-recent-orders-panel";
import { useProfilePageState } from "@/features/account/hooks/use-profile-page-state";
import "@/styles/pages/account/profile-page.css";

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
            avatarUrl={profilePage.user?.avatar_url}
            displayName={profilePage.displayName}
            email={profilePage.user?.email || ""}
            emailVerified={Boolean(profilePage.user?.email_verified)}
            initials={profilePage.initials}
            locationLabel={profilePage.locationLabel}
            memberSince={profilePage.memberSince}
            phone={profilePage.user?.phone}
            phoneVerified={Boolean(profilePage.user?.phone_verified)}
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

          <ProfileRecentOrdersPanel
            isLoading={profilePage.isOrdersLoading}
            orders={profilePage.recentOrders}
          />
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
