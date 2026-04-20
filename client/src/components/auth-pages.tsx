"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

import {
  formatSecondsLabel,
  isValidVietnamesePhone,
  normalizePhoneDigits,
} from "@/components/account-pages/shared";
import { StorefrontImage } from "@/components/storefront-image";
import { InlineAlert, LoadingScreen, TextInput } from "@/components/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { authApi } from "@/lib/api/auth";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import { cn } from "@/lib/utils";
import type { EmailVerificationChallenge, PhoneVerificationChallenge, UserProfile } from "@/types/api";
import { readPendingOAuthRemember } from "@/utils/auth/oauth";

const authVisualImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAIsJktK36_aSW-UtyTylS7bIE2ag2K5vHEo9K5uBJWk3gz1aqmIxIwRCxvh34us8lJuqd38F1f1_5iV2bpMRvwvXSNMyiGATkYaLm7STijMcVISPQZHNt3D9CUfgonupg0m_MzMTO82sKbZCm2USnw5_ovQbp048QV1L1PX6UNbLo7BDur9ErKWBC0Nc9InTq493B4TV-aPEbU9sF6eHP6asBT15g5iFITrMLOqbdVJChAOCrr0gO-Exp_xb2duyf7o_lsTe6P7ed5";

type FeedbackState = {
  tone: "info" | "error" | "success";
  message: string;
};

function maskEmail(value: string) {
  const trimmedValue = value.trim();
  const [localPart, domain] = trimmedValue.split("@");

  if (!localPart || !domain) {
    return trimmedValue;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] ?? "*"}***@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

function isLikelyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatDisplayName(firstName?: string, lastName?: string) {
  return [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ") || "Khách hàng mới";
}

function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <main className="grid min-h-screen lg:grid-cols-[1.2fr_minmax(0,1fr)]">
        <section className="relative hidden overflow-hidden bg-primary-container lg:block">
          <StorefrontImage
            alt="Nền forest cho trang xác thực"
            src={authVisualImage}
            fill
            priority
            sizes="60vw"
            className="object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/86 via-primary/50 to-primary/28" />
          <div className="relative flex h-full flex-col justify-between p-12 text-surface lg:p-20">
            <Link href="/" className="font-serif text-4xl font-semibold tracking-[-0.04em]">
              Commerce Platform
            </Link>
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#efd7ce]">{eyebrow}</p>
              <h1 className="mt-6 font-serif text-6xl font-semibold leading-[0.92] tracking-[-0.05em] xl:text-7xl">
                {title}
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-8 text-surface/78">{description}</p>
            </div>
            <div className="ml-auto hidden w-full max-w-[320px] rounded-[1.1rem] border border-white/10 bg-white/8 p-6 backdrop-blur-md xl:block">
              <span className="block text-[11px] uppercase tracking-[0.26em] text-surface/55">Phiên truy cập</span>
              <span className="mt-3 block font-serif text-2xl font-semibold tracking-[-0.03em]">Live backend session</span>
              <p className="mt-4 text-sm leading-7 text-surface/72">
                Refresh token, bootstrap profile và redirect sau đăng nhập đang đi theo contract auth thật của hệ thống.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-14">
          <div className="w-full max-w-xl rounded-[1.5rem] bg-surface p-6 shadow-editorial md:p-8">
            <Link href="/" className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary lg:hidden">
              Commerce Platform
            </Link>
            {children}
            {footer ? <div className="mt-8">{footer}</div> : null}
          </div>
        </section>
      </main>
    </div>
  );
}

export function LoginPageView() {
  return (
    <Suspense fallback={<LoadingScreen label="Đang chuẩn bị đăng nhập..." />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/profile";
  const { isAuthenticated, login, beginOAuthLogin, error, clearError } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, redirectTo, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    setFeedback("");

    if (!identifier.trim() || !password.trim()) {
      setFeedback("Vui lòng nhập tài khoản và mật khẩu.");
      return;
    }

    try {
      setBusy(true);
      const normalizedIdentifier = identifier.trim();
      await login(
        {
          identifier: normalizedIdentifier,
          email: normalizedIdentifier.includes("@") ? normalizedIdentifier : undefined,
          password: password.trim(),
        },
        remember,
      );
      router.replace(redirectTo);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  if (isAuthenticated) {
    return <LoadingScreen label="Đang chuyển hướng..." />;
  }

  return (
    <AuthShell
      eyebrow="Đăng nhập"
      title="Truy cập tài khoản mua sắm của bạn."
      description="Bạn có thể đăng nhập bằng email hoặc số điện thoại đã xác minh, tiếp tục với Google, rồi hoàn tất các bước bảo mật tiếp theo ngay trong luồng hiện tại."
      footer={
        <p className="text-sm text-on-surface-variant">
          Chưa có tài khoản?{" "}
          <Link href={`/register?redirect=${encodeURIComponent(redirectTo)}`} className="font-medium text-primary">
            Đăng ký
          </Link>
        </p>
      }
    >
      <div className="mt-6 space-y-6">
        <div>
          <p className="eyebrow">Đăng nhập</p>
          <h2 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.04em] text-primary">
            Chào mừng quay lại
          </h2>
        </div>

        {feedback || error ? <InlineAlert tone="error">{feedback || error}</InlineAlert> : null}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant" htmlFor="login-identifier">
              Email hoặc số điện thoại
            </label>
            <TextInput id="login-identifier" autoComplete="username" placeholder="name@example.com" value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant" htmlFor="login-password">
              Mật khẩu
            </label>
            <TextInput id="login-password" autoComplete="current-password" placeholder="••••••••" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>

          <div className="flex items-center justify-between gap-4 text-sm">
            <label className="flex items-center gap-3 text-on-surface-variant">
              <input checked={remember} type="checkbox" onChange={(event) => setRemember(event.target.checked)} />
              Ghi nhớ tôi
            </label>
            <Link href="/forgot-password" className="font-medium text-primary">
              Quên mật khẩu?
            </Link>
          </div>

          <button type="submit" className={cn(buttonStyles({ size: "lg" }), "w-full")} disabled={busy}>
            {busy ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <div className="space-y-3">
          <p className="text-center text-sm text-on-surface-variant">Hoặc tiếp tục với</p>
          <button type="button" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")} onClick={() => beginOAuthLogin("google", redirectTo, remember)}>
            Google
          </button>
          <div className="rounded-[1.25rem] border border-outline-variant/35 bg-surface-container-low p-5 text-sm leading-7 text-on-surface-variant">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Các lựa chọn xác thực
            </p>
            <p className="mt-3">
              Google sẽ tự đồng bộ email và họ tên từ profile OAuth. Nếu bạn muốn đăng nhập bằng số điện thoại,
              chỉ cần dùng chính ô đăng nhập phía trên sau khi số đó đã được xác minh bằng OTP Telegram.
            </p>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}

export function RegisterPageView() {
  return (
    <Suspense fallback={<LoadingScreen label="Đang chuẩn bị đăng ký..." />}>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/profile";
  const {
    isAuthenticated,
    beginOAuthLogin,
    sendEmailSignupOtp,
    verifyEmailSignupOtp,
    resendEmailSignupOtp,
    sendPhoneSignupOtp,
    verifyPhoneSignupOtp,
    resendPhoneSignupOtp,
  } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [stage, setStage] = useState<"form" | "pending_verification">("form");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [phoneFeedback, setPhoneFeedback] = useState<FeedbackState | null>(null);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [emailVerification, setEmailVerification] = useState<EmailVerificationChallenge | null>(null);
  const [emailOtpExpiresIn, setEmailOtpExpiresIn] = useState(0);
  const [emailOtpResendIn, setEmailOtpResendIn] = useState(0);
  const [otpCode, setOtpCode] = useState("");
  const [phoneVerification, setPhoneVerification] = useState<PhoneVerificationChallenge | null>(null);
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [otpResendIn, setOtpResendIn] = useState(0);

  function applyEmailVerificationStatus(status: EmailVerificationChallenge | null, fallbackEmail = "") {
    setEmailVerification(status);
    setEmailOtpExpiresIn(status?.expires_in_seconds ?? 0);
    setEmailOtpResendIn(status?.resend_in_seconds ?? 0);

    const nextEmail = status?.email || fallbackEmail;
    if (nextEmail) {
      setRegisteredEmail(nextEmail);
    }
  }

  function applyPhoneVerificationStatus(status: PhoneVerificationChallenge | null) {
    setPhoneVerification(status);
    setOtpExpiresIn(status?.expires_in_seconds ?? 0);
    setOtpResendIn(status?.resend_in_seconds ?? 0);
  }

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, redirectTo, router]);

  useEffect(() => {
    if (!emailVerification?.verification_id) {
      return;
    }

    const timer = window.setInterval(() => {
      setEmailOtpExpiresIn((current) => (current > 0 ? current - 1 : 0));
      setEmailOtpResendIn((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [emailVerification?.verification_id]);

  useEffect(() => {
    if (!phoneVerification?.verification_id) {
      return;
    }

    const timer = window.setInterval(() => {
      setOtpExpiresIn((current) => (current > 0 ? current - 1 : 0));
      setOtpResendIn((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [phoneVerification?.verification_id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setPhoneFeedback(null);

    const normalizedIdentifier = identifier.trim();

    if (!normalizedIdentifier || !password.trim()) {
      setFeedback({
        tone: "error",
        message: "Vui lòng nhập ô định danh, mật khẩu và xác nhận mật khẩu để bắt đầu đăng ký.",
      });
      return;
    }

    if (password.length < 8) {
      setFeedback({
        tone: "error",
        message: "Mật khẩu cần tối thiểu 8 ký tự.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setFeedback({
        tone: "error",
        message: "Mật khẩu xác nhận chưa khớp.",
      });
      return;
    }

    if (!isLikelyEmail(normalizedIdentifier)) {
      const normalizedPhoneInput = normalizePhoneDigits(normalizedIdentifier);

      if (!isValidVietnamesePhone(normalizedPhoneInput)) {
        setFeedback({
          tone: "error",
          message: "Ô đầu tiên chỉ nhận email hợp lệ hoặc số điện thoại Việt Nam.",
        });
        return;
      }

      try {
        setIdentifier(normalizedPhoneInput);
        setPhoneBusy(true);
        const challenge = await sendPhoneSignupOtp(
          normalizedPhoneInput,
          password.trim(),
          confirmPassword.trim(),
        );
        applyPhoneVerificationStatus(challenge);
        setOtpCode("");
        setPhoneFeedback({
          tone: "info",
          message: `OTP Telegram đã được gửi tới ${challenge.phone_masked}. Hãy nhập 6 chữ số để hoàn tất đăng ký bằng số điện thoại.`,
        });
      } catch (reason) {
        setPhoneFeedback({
          tone: "error",
          message: getErrorMessage(reason),
        });
      } finally {
        setPhoneBusy(false);
      }

      return;
    }

    const normalizedEmail = normalizedIdentifier.toLowerCase();

    try {
      setBusy(true);
      const challenge = await sendEmailSignupOtp(
        normalizedEmail,
        password.trim(),
        confirmPassword.trim(),
      );

      setStage("pending_verification");
      setRegisteredEmail(normalizedEmail);
      applyEmailVerificationStatus(challenge, normalizedEmail);
      setFeedback({
        tone: "info",
        message: `Mã OTP đăng ký đã được gửi tới ${challenge.email_masked}. Tài khoản chỉ được tạo sau khi bạn xác minh OTP thành công.`,
      });
      setPassword("");
      setConfirmPassword("");
      setEmailOtpCode("");
    } catch (reason) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyEmailOtp() {
    const verificationID = emailVerification?.verification_id;
    setFeedback(null);

    if (!verificationID) {
      setFeedback({
        tone: "error",
        message: "Hiện chưa có phiên OTP email nào. Hãy yêu cầu gửi mã mới.",
      });
      return;
    }

    if (emailOtpCode.trim().length !== 6) {
      setFeedback({
        tone: "error",
        message: "Mã OTP email cần đúng 6 chữ số.",
      });
      return;
    }

    try {
      setEmailBusy(true);
      const challenge = emailVerification;
      await verifyEmailSignupOtp(verificationID, emailOtpCode.trim(), false);
      applyEmailVerificationStatus(challenge, registeredEmail);
      setEmailOtpCode("");
      setFeedback({
        tone: "success",
        message: `Email ${maskEmail(registeredEmail)} đã được xác minh thành công. Hệ thống đang đăng nhập cho bạn.`,
      });
    } catch (reason) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleResendVerification() {
    if (!emailVerification?.verification_id) {
      setFeedback({
        tone: "error",
        message: "Phiên OTP email hiện không còn hiệu lực. Hãy quay lại form và gửi lại yêu cầu đăng ký.",
      });
      return;
    }

    try {
      setEmailBusy(true);
      const challenge = await resendEmailSignupOtp(emailVerification.verification_id);
      applyEmailVerificationStatus(challenge, registeredEmail || identifier.trim().toLowerCase());
      setEmailOtpCode("");
      setFeedback({
        tone: "info",
        message: challenge
          ? `Một mã OTP mới đã được gửi tới ${challenge.email_masked}.`
          : `Một email xác minh mới đã được gửi tới ${maskEmail(registeredEmail || identifier.trim().toLowerCase())}.`,
      });
    } catch (reason) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleSendPhoneOtp() {
    const normalizedPhone = normalizePhoneDigits(identifier);
    setPhoneFeedback(null);

    if (!password.trim() || password.length < 8) {
      setPhoneFeedback({
        tone: "error",
        message: "Mật khẩu cần tối thiểu 8 ký tự trước khi gửi Telegram OTP.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setPhoneFeedback({
        tone: "error",
        message: "Mật khẩu xác nhận chưa khớp.",
      });
      return;
    }

    if (!isValidVietnamesePhone(normalizedPhone)) {
      setPhoneFeedback({
        tone: "error",
        message: "Số điện thoại phải đúng 10 chữ số và bắt đầu bằng số 0.",
      });
      return;
    }

    try {
      setPhoneBusy(true);
      const challenge = await sendPhoneSignupOtp(normalizedPhone, password.trim(), confirmPassword.trim());
      applyPhoneVerificationStatus(challenge);
      setOtpCode("");
      setPhoneFeedback({
        tone: "info",
        message: `OTP Telegram đã được gửi tới ${challenge.phone_masked}. Hãy nhập 6 chữ số để hoàn tất đăng ký bằng số điện thoại.`,
      });
    } catch (reason) {
      setPhoneFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setPhoneBusy(false);
    }
  }

  async function handleVerifyPhoneOtp() {
    const verificationID = phoneVerification?.verification_id;
    const normalizedPhone = normalizePhoneDigits(identifier);
    setPhoneFeedback(null);

    if (!verificationID) {
      setPhoneFeedback({
        tone: "error",
        message: "Bạn cần gửi OTP trước khi xác minh số điện thoại.",
      });
      return;
    }

    if (otpCode.trim().length !== 6) {
      setPhoneFeedback({
        tone: "error",
        message: "OTP cần đúng 6 chữ số.",
      });
      return;
    }

    try {
      setPhoneBusy(true);
      await verifyPhoneSignupOtp(verificationID, otpCode.trim(), false);

      setOtpCode("");
      setPhoneFeedback({
        tone: "success",
        message: `Số điện thoại ${normalizedPhone} đã được xác minh và tài khoản đang được đăng nhập cho bạn.`,
      });
    } catch (reason) {
      setPhoneFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setPhoneBusy(false);
    }
  }

  async function handleResendPhoneOtp() {
    const verificationID = phoneVerification?.verification_id;
    setPhoneFeedback(null);

    if (!verificationID) {
      setPhoneFeedback({
        tone: "error",
        message: "Hiện chưa có phiên OTP nào để gửi lại.",
      });
      return;
    }

    try {
      setPhoneBusy(true);
      const challenge = await resendPhoneSignupOtp(verificationID);
      applyPhoneVerificationStatus(challenge);
      setPhoneFeedback({
        tone: "info",
        message: `Một mã OTP mới đã được gửi tới ${challenge.phone_masked}.`,
      });
    } catch (reason) {
      setPhoneFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setPhoneBusy(false);
    }
  }

  if (isAuthenticated) {
    return <LoadingScreen label="Đang chuyển hướng..." />;
  }

  const normalizedPhoneIdentifier = normalizePhoneDigits(identifier);
  const isPhoneIdentifier =
    identifier.trim() !== "" &&
    !isLikelyEmail(identifier.trim()) &&
    isValidVietnamesePhone(normalizedPhoneIdentifier);

  return (
    <AuthShell
      eyebrow="Đăng ký"
      title="Tạo tài khoản nhanh với OTP email hoặc Telegram."
      description="Form đăng ký giữ đúng 3 ô nhập liệu. Nếu bạn nhập email, backend sẽ gửi OTP email để hoàn tất xác minh. Nếu bạn nhập số điện thoại, backend sẽ gửi Telegram OTP và chỉ tạo tài khoản sau khi mã hợp lệ."
      footer={
        <p className="text-sm text-on-surface-variant">
          Đã có tài khoản?{" "}
          <Link href={`/login?redirect=${encodeURIComponent(redirectTo)}`} className="font-medium text-primary">
            Đăng nhập
          </Link>
        </p>
      }
    >
      <div className="mt-6 space-y-6">
        <div>
          <p className="eyebrow">{stage === "form" ? "Tạo tài khoản" : "Xác minh tài khoản"}</p>
          <h2 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.04em] text-primary">
            {stage === "form" ? "Chỉ còn đúng 3 trường để bắt đầu" : "Nhập OTP email để hoàn tất đăng ký"}
          </h2>
        </div>

        {feedback ? <InlineAlert tone={feedback.tone}>{feedback.message}</InlineAlert> : null}

        {stage === "form" ? (
          <>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant" htmlFor="register-identifier">
                  Email hoặc số điện thoại
                </label>
                <TextInput
                  id="register-identifier"
                  autoComplete="username"
                  placeholder="name@example.com hoặc 09xxxxxxxx"
                  value={identifier}
                  onChange={(event) => {
                    setIdentifier(event.target.value);
                    setFeedback(null);
                    setPhoneFeedback(null);
                    setPhoneVerification(null);
                    setOtpCode("");
                  }}
                />
                <p className="text-xs leading-6 text-on-surface-variant">
                  Hệ thống sẽ tự nhận diện email hoặc số điện thoại. Email dùng OTP email, còn số điện thoại dùng Telegram OTP ngay trong form này.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant" htmlFor="register-password">
                  Mật khẩu
                </label>
                <TextInput id="register-password" autoComplete="new-password" placeholder="Tối thiểu 8 ký tự" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant" htmlFor="register-confirm-password">
                  Xác nhận mật khẩu
                </label>
                <TextInput id="register-confirm-password" autoComplete="new-password" placeholder="Nhập lại mật khẩu" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </div>

              <p className="rounded-[1.1rem] bg-surface-container-low px-4 py-4 text-sm leading-7 text-on-surface-variant">
                Nếu bạn đăng ký bằng email hoặc số điện thoại, backend sẽ tự tạo một họ tên ngẫu nhiên và bạn có thể chỉnh lại sau trong hồ sơ. Nếu bạn tiếp tục với Google, backend sẽ tự đồng bộ email và họ tên từ Google profile.
              </p>

              <button type="submit" className={cn(buttonStyles({ size: "lg" }), "w-full")} disabled={busy || phoneBusy}>
                {busy || phoneBusy ? "Đang xử lý..." : isPhoneIdentifier ? "Gửi Telegram OTP" : "Tạo tài khoản"}
              </button>
            </form>

            {isPhoneIdentifier ? (
              <div className="rounded-[1.25rem] border border-outline-variant/35 bg-surface-container-low p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Telegram OTP
                </p>
                <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                  Sau khi Telegram OTP hợp lệ, backend sẽ tạo tài khoản phone-only và đăng nhập cho bạn ngay.
                </p>

                {phoneFeedback ? <div className="mt-4"><InlineAlert tone={phoneFeedback.tone}>{phoneFeedback.message}</InlineAlert></div> : null}

                {phoneVerification ? (
                  <div className="mt-4 rounded-[1rem] bg-surface px-4 py-4 text-sm leading-7 text-on-surface-variant">
                    <p>
                      OTP đang chờ xác minh cho <span className="font-semibold text-primary">{phoneVerification.phone_masked}</span>.
                    </p>
                    <p className="mt-2">
                      Hết hạn sau <span className="font-semibold text-primary">{formatSecondsLabel(otpExpiresIn)}</span>, gửi lại sau{" "}
                      <span className="font-semibold text-primary">{formatSecondsLabel(otpResendIn)}</span>, còn{" "}
                      <span className="font-semibold text-primary">{phoneVerification.remaining_attempts}</span> lượt nhập.
                    </p>
                  </div>
                ) : null}

                <div className="mt-5 space-y-4">
                  <TextInput autoComplete="one-time-code" placeholder="OTP 6 chữ số" value={otpCode} onChange={(event) => {
                    setOtpCode(event.target.value);
                    setPhoneFeedback(null);
                  }} />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button type="button" className={cn(buttonStyles({ size: "lg" }), "w-full")} disabled={phoneBusy || otpCode.trim().length !== 6} onClick={() => void handleVerifyPhoneOtp()}>
                      {phoneBusy ? "Đang xác minh..." : "Xác minh Telegram OTP"}
                    </button>
                    <button type="button" className={cn(buttonStyles({ variant: "ghost", size: "lg" }), "w-full")} disabled={phoneBusy} onClick={() => void handleSendPhoneOtp()}>
                      {phoneBusy ? "Đang gửi..." : "Gửi OTP"}
                    </button>
                    {phoneVerification ? (
                      <button type="button" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")} disabled={phoneBusy || otpResendIn > 0} onClick={() => void handleResendPhoneOtp()}>
                        {otpResendIn > 0 ? `Gửi lại sau ${otpResendIn}s` : "Gửi lại OTP"}
                      </button>
                    ) : null}
                  </div>
                </div>

                <p className="mt-4 text-xs leading-6 text-on-surface-variant">
                  Nếu đây là lần đầu dùng bot Telegram, hãy mở bot và gửi <span className="font-semibold text-primary">/start</span> trước khi yêu cầu OTP.
                </p>
              </div>
            ) : null}

            <div className="rounded-[1.25rem] border border-outline-variant/35 bg-surface-container-low p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                Google và số điện thoại
              </p>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                Nếu tiếp tục với Google, hệ thống sẽ tự lấy tên và email từ Google profile để tạo hoặc cập nhật tài khoản. Nếu email local chưa xác minh, trang callback sẽ gửi OTP email để bạn hoàn tất ngay trong cùng flow.
              </p>
              <button type="button" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "mt-5 w-full")} onClick={() => beginOAuthLogin("google", redirectTo, false)}>
                Tiếp tục với Google
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.25rem] bg-surface-container-low p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Email xác minh
                </p>
                <p className="mt-3 font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                  {maskEmail(registeredEmail || identifier)}
                </p>
                <p className="mt-4 text-sm leading-7 text-on-surface-variant">
                  Kiểm tra email và nhập OTP gồm 6 chữ số để kích hoạt tài khoản ngay trong màn hình này.
                </p>
              </div>

              <div className="rounded-[1.25rem] bg-surface-container-low p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Tùy chọn đăng nhập
                </p>
                <p className="mt-3 font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                  Google hoặc số điện thoại
                </p>
                <p className="mt-4 text-sm leading-7 text-on-surface-variant">
                  Sau khi số điện thoại được xác minh bằng OTP Telegram, bạn có thể dùng chính số đó ở form đăng nhập bên cạnh Google.
                </p>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-outline-variant/35 bg-surface-container-low p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                OTP email
              </p>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                Mã OTP đã được gửi tới địa chỉ email đăng ký. Hãy nhập đúng 6 chữ số để hoàn tất bước xác minh.
              </p>

              {emailVerification ? (
                <div className="mt-4 rounded-[1rem] bg-surface px-4 py-4 text-sm leading-7 text-on-surface-variant">
                  <p>
                    Email đang chờ xác minh: <span className="font-semibold text-primary">{emailVerification.email_masked}</span>.
                  </p>
                  <p className="mt-2">
                    Hết hạn sau <span className="font-semibold text-primary">{formatSecondsLabel(emailOtpExpiresIn)}</span>, gửi lại sau{" "}
                    <span className="font-semibold text-primary">{formatSecondsLabel(emailOtpResendIn)}</span>, còn{" "}
                    <span className="font-semibold text-primary">{emailVerification.remaining_attempts}</span> lượt nhập.
                  </p>
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                <TextInput
                  autoComplete="one-time-code"
                  placeholder="OTP email 6 chữ số"
                  value={emailOtpCode}
                  onChange={(event) => {
                    setEmailOtpCode(event.target.value);
                    setFeedback(null);
                  }}
                />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    className={cn(buttonStyles({ size: "lg" }), "w-full")}
                    disabled={emailBusy || emailOtpCode.trim().length !== 6}
                    onClick={() => void handleVerifyEmailOtp()}
                  >
                    {emailBusy ? "Đang xác minh..." : "Xác minh OTP email"}
                  </button>
                  <button
                    type="button"
                    className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")}
                    disabled={emailBusy || emailOtpResendIn > 0}
                    onClick={() => void handleResendVerification()}
                  >
                    {emailOtpResendIn > 0 ? `Gửi lại sau ${emailOtpResendIn}s` : "Gửi lại OTP email"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")} onClick={() => {
                setStage("form");
                setFeedback(null);
                setEmailVerification(null);
                setEmailOtpCode("");
              }}>
                Quay lại chỉnh email
              </button>
            </div>
          </>
        )}
      </div>
    </AuthShell>
  );
}

export function ForgotPasswordPageView() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");

    if (!email.trim()) {
      setFeedback("Vui lòng nhập email.");
      return;
    }

    try {
      setBusy(true);
      await authApi.forgotPassword({ email: email.trim() });
      setFeedback("Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="Quên mật khẩu" title="Khôi phục quyền truy cập tài khoản." description="Luồng này dùng đúng endpoint forgot-password của user-service và vẫn giữ thông điệp an toàn ngay cả khi email delivery tạm thời lỗi.">
      <div className="mt-6 space-y-6">
        {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}
        <form className="space-y-5" onSubmit={handleSubmit}>
          <TextInput autoComplete="email" placeholder="Email tài khoản" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <button type="submit" className={cn(buttonStyles({ size: "lg" }), "w-full")} disabled={busy}>
            {busy ? "Đang gửi..." : "Gửi email khôi phục"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}

export function ResetPasswordPageView() {
  return (
    <Suspense fallback={<LoadingScreen label="Đang chuẩn bị đặt lại mật khẩu..." />}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");

    if (!token) {
      setFeedback("Thiếu token đặt lại mật khẩu.");
      return;
    }

    if (password.length < 8) {
      setFeedback("Mật khẩu mới cần tối thiểu 8 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setFeedback("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    try {
      setBusy(true);
      await authApi.resetPassword({ token, new_password: password.trim() });
      router.replace("/login");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="Đặt lại mật khẩu" title="Tạo mật khẩu mới cho tài khoản." description="Token đặt lại được kiểm tra trực tiếp bởi user-service trước khi cấp lại quyền truy cập.">
      <div className="mt-6 space-y-6">
        {feedback ? <InlineAlert tone="error">{feedback}</InlineAlert> : null}
        <form className="space-y-5" onSubmit={handleSubmit}>
          <TextInput autoComplete="new-password" placeholder="Mật khẩu mới" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <TextInput autoComplete="new-password" placeholder="Xác nhận mật khẩu mới" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          <button type="submit" className={cn(buttonStyles({ size: "lg" }), "w-full")} disabled={busy}>
            {busy ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}

export function VerifyEmailPageView() {
  return (
    <Suspense fallback={<LoadingScreen label="Đang tải trạng thái xác minh email..." />}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}

function VerifyEmailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [busy, setBusy] = useState(() => Boolean(token));
  const [feedback, setFeedback] = useState(() =>
    token ? "Đang xác minh email..." : "Không tìm thấy token xác minh email.",
  );
  const [feedbackTone, setFeedbackTone] = useState<"info" | "error" | "success">(() =>
    token ? "info" : "error",
  );

  useEffect(() => {
    let active = true;

    if (!token) {
      return () => {
        active = false;
      };
    }

    void authApi
      .verifyEmail({ token })
      .then(() => {
        if (active) {
          setFeedback("Email đã được xác minh thành công. Bạn có thể tiếp tục đăng nhập.");
          setFeedbackTone("success");
        }
      })
      .catch((reason) => {
        if (active) {
          setFeedback(getErrorMessage(reason));
          setFeedbackTone("error");
        }
      })
      .finally(() => {
        if (active) {
          setBusy(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <AuthShell eyebrow="Xác minh email" title="Hoàn tất xác minh địa chỉ email." description="Khi xác minh thành công, tài khoản sẽ có trạng thái an toàn hơn cho recovery và notification.">
      <div className="mt-6 space-y-6">
        {feedback ? <InlineAlert tone={busy ? "info" : feedbackTone}>{feedback}</InlineAlert> : null}
        <button type="button" className={cn(buttonStyles({ size: "lg" }), "w-full")} onClick={() => router.replace("/login")}>
          Về trang đăng nhập
        </button>
      </div>
    </AuthShell>
  );
}

export function AuthCallbackPageView() {
  return (
    <Suspense fallback={<LoadingScreen label="Đang xử lý đăng nhập OAuth..." />}>
      <AuthCallbackPageContent />
    </Suspense>
  );
}

function AuthCallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    exchangeOAuthTicket,
    getEmailVerificationStatus,
    sendEmailVerificationOtp,
    verifyEmailOtp,
    resendEmailVerificationOtp,
    refreshProfile,
    token,
    user,
  } = useAuth();
  const ticket = searchParams.get("ticket") ?? "";
  const redirectTo = searchParams.get("redirect_to") || searchParams.get("redirect") || "/profile";
  const errorCode = searchParams.get("code") || searchParams.get("error");
  const errorMessage = searchParams.get("message");
  const [feedback, setFeedback] = useState<FeedbackState>(() => {
    if (errorCode) {
      return {
        tone: "error",
        message: errorMessage || "Đăng nhập Google chưa hoàn tất.",
      };
    }

    if (!ticket) {
      return {
        tone: "error",
        message: "Không nhận được OAuth ticket từ backend.",
      };
    }

    return {
      tone: "info",
      message: "Đang hoàn tất đăng nhập Google...",
    };
  });
  const [oauthUser, setOAuthUser] = useState<UserProfile | null>(null);
  const [emailVerification, setEmailVerification] = useState<EmailVerificationChallenge | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [otpResendIn, setOtpResendIn] = useState(0);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [autoOtpAttempted, setAutoOtpAttempted] = useState(false);

  function applyEmailVerificationStatus(status: EmailVerificationChallenge | null) {
    setEmailVerification(status);
    setOtpExpiresIn(status?.expires_in_seconds ?? 0);
    setOtpResendIn(status?.resend_in_seconds ?? 0);
  }

  useEffect(() => {
    let active = true;

    if (errorCode) {
      return () => {
        active = false;
      };
    }

    if (!ticket) {
      return () => {
        active = false;
      };
    }

    void exchangeOAuthTicket(ticket, readPendingOAuthRemember())
      .then((profile) => {
        if (active) {
          setOAuthUser(profile);
          setFeedback({
            tone: profile.email_verified ? "success" : "info",
            message: profile.email_verified
              ? `Đã đồng bộ Google profile cho ${formatDisplayName(profile.first_name, profile.last_name)}. Bạn đang được chuyển hướng...`
              : `Đã đồng bộ Google profile cho ${formatDisplayName(profile.first_name, profile.last_name)}. Hệ thống đang chuẩn bị gửi OTP email để hoàn tất bảo mật tài khoản.`,
          });
        }
      })
      .catch((reason) => {
        if (active) {
          setFeedback({
            tone: "error",
            message: getErrorMessage(reason),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [errorCode, errorMessage, exchangeOAuthTicket, ticket]);

  useEffect(() => {
    if (!oauthUser || oauthUser.email_verified || autoOtpAttempted || !token || user?.id !== oauthUser.id) {
      return;
    }

    let active = true;
    setAutoOtpAttempted(true);
    setVerificationBusy(true);

    void (async () => {
      const status = (await getEmailVerificationStatus()) ?? (await sendEmailVerificationOtp());
      return status;
    })()
      .then((status) => {
        if (active) {
          applyEmailVerificationStatus(status);
          setFeedback({
            tone: "info",
            message: status
              ? `Google profile đã được đồng bộ cho ${formatDisplayName(oauthUser.first_name, oauthUser.last_name)}. Mã OTP đã được gửi tới ${status.email_masked}.`
              : `Google profile đã được đồng bộ cho ${formatDisplayName(oauthUser.first_name, oauthUser.last_name)}. Bạn có thể yêu cầu gửi OTP email ngay bên dưới.`,
          });
        }
      })
      .catch((reason) => {
        if (active) {
          setFeedback({
            tone: "error",
            message: getErrorMessage(reason),
          });
        }
      })
      .finally(() => {
        if (active) {
          setVerificationBusy(false);
        }
      });

    return () => {
      active = false;
    };
  }, [autoOtpAttempted, getEmailVerificationStatus, oauthUser, sendEmailVerificationOtp, token, user?.id]);

  useEffect(() => {
    if (!emailVerification?.verification_id) {
      return;
    }

    const timer = window.setInterval(() => {
      setOtpExpiresIn((current) => (current > 0 ? current - 1 : 0));
      setOtpResendIn((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [emailVerification?.verification_id]);

  useEffect(() => {
    if (!oauthUser?.email_verified) {
      return;
    }

    const timeout = window.setTimeout(() => {
      router.replace(redirectTo);
    }, 1200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [oauthUser?.email_verified, redirectTo, router]);

  async function handleVerifyGoogleEmailOtp() {
    const verificationID = emailVerification?.verification_id;

    if (!verificationID) {
      setFeedback({
        tone: "error",
        message: "Hiện chưa có OTP email nào cho phiên Google này. Hãy yêu cầu gửi mã mới.",
      });
      return;
    }

    if (otpCode.trim().length !== 6) {
      setFeedback({
        tone: "error",
        message: "OTP email cần đúng 6 chữ số.",
      });
      return;
    }

    try {
      setVerificationBusy(true);
      const challenge = await verifyEmailOtp(verificationID, otpCode.trim());
      applyEmailVerificationStatus(challenge);
      const refreshedProfile = await refreshProfile();
      setOAuthUser(refreshedProfile);
      setOtpCode("");
      setFeedback({
        tone: "success",
        message: `Email ${maskEmail(refreshedProfile.email)} đã được xác minh. Bạn đang được chuyển hướng...`,
      });
    } catch (reason) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setVerificationBusy(false);
    }
  }

  async function handleResendGoogleVerification() {
    if (!oauthUser) {
      return;
    }

    try {
      setVerificationBusy(true);
      const challenge = emailVerification?.verification_id
        ? await resendEmailVerificationOtp(emailVerification.verification_id)
        : await sendEmailVerificationOtp();
      applyEmailVerificationStatus(challenge);
      setOtpCode("");
      setFeedback({
        tone: "info",
        message: challenge
          ? `OTP email đã được gửi lại tới ${challenge.email_masked}.`
          : `Email xác minh đã được gửi lại tới ${maskEmail(oauthUser.email)}.`,
      });
    } catch (reason) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setVerificationBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="Xử lý OAuth" title="Đang đồng bộ phiên đăng nhập." description="Frontend đang đổi short-lived OAuth ticket sang token pair chuẩn, lấy thông tin tài khoản đã được backend đồng bộ từ Google, rồi tiếp tục theo route ban đầu.">
      <div className="mt-6 space-y-6">
        <InlineAlert tone={feedback.tone}>{feedback.message}</InlineAlert>

        {oauthUser ? (
          <div className="rounded-[1.25rem] border border-outline-variant/35 bg-surface-container-low p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Hồ sơ Google đã đồng bộ
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1rem] bg-surface px-4 py-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
                  Họ tên
                </span>
                <p className="mt-2 font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                  {formatDisplayName(oauthUser.first_name, oauthUser.last_name)}
                </p>
              </div>
              <div className="rounded-[1rem] bg-surface px-4 py-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
                  Email
                </span>
                <p className="mt-2 font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                  {oauthUser.email}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-on-surface-variant">
              Nếu email Google trùng với tài khoản hiện có, backend sẽ link và cập nhật profile thay vì tạo trùng tài khoản mới. Bạn cũng có thể bổ sung số điện thoại trong hồ sơ để bật đăng nhập bằng số và OTP Telegram.
            </p>
          </div>
        ) : null}

        {oauthUser && !oauthUser.email_verified ? (
          <div className="rounded-[1.25rem] border border-outline-variant/35 bg-surface-container-low p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Hoàn tất xác minh email
            </p>
            <p className="mt-3 text-sm leading-7 text-on-surface-variant">
              Google đã cung cấp email và họ tên cho phiên đăng nhập này. Nếu tài khoản local của bạn vẫn chưa ở trạng thái verified, hãy nhập OTP email để hoàn tất ngay trong cùng callback.
            </p>

            {emailVerification ? (
              <div className="mt-4 rounded-[1rem] bg-surface px-4 py-4 text-sm leading-7 text-on-surface-variant">
                <p>
                  OTP đang chờ xác minh cho <span className="font-semibold text-primary">{emailVerification.email_masked}</span>.
                </p>
                <p className="mt-2">
                  Hết hạn sau <span className="font-semibold text-primary">{formatSecondsLabel(otpExpiresIn)}</span>, gửi lại sau{" "}
                  <span className="font-semibold text-primary">{formatSecondsLabel(otpResendIn)}</span>, còn{" "}
                  <span className="font-semibold text-primary">{emailVerification.remaining_attempts}</span> lượt nhập.
                </p>
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              <TextInput
                autoComplete="one-time-code"
                placeholder="OTP email 6 chữ số"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  className={cn(buttonStyles({ size: "lg" }), "w-full")}
                  disabled={verificationBusy || otpCode.trim().length !== 6}
                  onClick={() => void handleVerifyGoogleEmailOtp()}
                >
                  {verificationBusy ? "Đang xác minh..." : "Xác minh OTP email"}
                </button>
                <button
                  type="button"
                  className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")}
                  disabled={verificationBusy || otpResendIn > 0}
                  onClick={() => void handleResendGoogleVerification()}
                >
                  {otpResendIn > 0 ? `Gửi lại sau ${otpResendIn}s` : "Gửi lại OTP email"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {errorCode || !ticket ? (
          <Link href="/login" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")}>
            Quay lại đăng nhập
          </Link>
        ) : oauthUser?.email_verified ? (
          <button type="button" className={cn(buttonStyles({ size: "lg" }), "w-full")} onClick={() => router.replace(redirectTo)}>
            Tiếp tục ngay
          </button>
        ) : null}
      </div>
    </AuthShell>
  );
}
