"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

import {
  formatSecondsLabel,
  isValidVietnamesePhone,
  normalizePhoneDigits,
} from "@/components/account-shared/account-helpers";
import { StorefrontImage } from "@/components/storefront-shared/storefront-image";
import {
  InlineAlert,
  LoadingScreen,
  TextInput,
} from "@/components/storefront-shared/storefront-ui";
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

function isActiveAuthLane(pathname: string, href: string) {
  if (href === "/forgot-password") {
    return pathname === "/forgot-password" || pathname === "/reset-password";
  }

  return pathname === href;
}

type AuthShellTheme = {
  panelPill: string;
  storyKicker: string;
  storyTitle: string;
  storyCopy: string;
  stats: Array<{ label: string; value: string }>;
  highlights: Array<{ title: string; copy: string }>;
  noteLabel: string;
  noteValue: string;
  noteCopy: string;
};

function resolveAuthShellTheme(eyebrow: string, title: string, description: string): AuthShellTheme {
  const normalizedEyebrow = eyebrow.trim().toLowerCase();

  if (normalizedEyebrow.includes("đăng nhập")) {
    return {
      panelPill: "Phiên quay lại",
      storyKicker: "Lối vào tài khoản",
      storyTitle: "Quay lại giỏ hàng, đơn hàng và danh sách đã lưu.",
      storyCopy:
        "Đăng nhập để quay lại giỏ hàng, danh sách yêu thích và lịch sử mua sắm của bạn.",
      stats: [
        { label: "Đầu vào", value: "Email / Số điện thoại" },
        { label: "Google", value: "Sẵn sàng" },
        { label: "Phiên", value: "Giữ redirect" },
      ],
      highlights: [
        {
          title: "Đăng nhập gọn và yên ổn",
          copy: "Vào lại tài khoản nhanh để tiếp tục mua sắm đúng nơi bạn đang dở dang.",
        },
        {
          title: "Ghi nhớ phiên hợp lệ",
          copy: "Nếu bạn chọn ghi nhớ, lần quay lại sau sẽ thuận tiện hơn nhiều.",
        },
      ],
      noteLabel: "Nhịp truy cập",
      noteValue: "Đăng nhập, quay lại mua sắm",
      noteCopy: "Giữ trải nghiệm gọn gàng để bạn tập trung vào sản phẩm và đơn hàng của mình.",
    };
  }

  if (normalizedEyebrow.includes("đăng ký")) {
    return {
      panelPill: "Mở tài khoản",
      storyKicker: "Onboarding ngắn gọn",
      storyTitle: "Tạo tài khoản mới để mua sắm thuận tiện hơn.",
      storyCopy:
        "Đăng ký bằng email hoặc số điện thoại để lưu địa chỉ, danh sách yêu thích và lịch sử đơn hàng của bạn.",
      stats: [
        { label: "OTP email", value: "Có hỗ trợ" },
        { label: "OTP Telegram", value: "Có hỗ trợ" },
        { label: "Google", value: "Lối vào phụ" },
      ],
      highlights: [
        {
          title: "Một ô định danh",
          copy: "Bạn có thể bắt đầu bằng email hoặc số điện thoại trong cùng một biểu mẫu gọn gàng.",
        },
        {
          title: "Xác minh trước",
          copy: "Xác minh nhanh để tài khoản sẵn sàng cho những lần mua sắm tiếp theo.",
        },
      ],
      noteLabel: "Mô hình xác minh",
      noteValue: "Email hoặc Telegram OTP",
      noteCopy: "Mục tiêu là giúp bạn tạo tài khoản nhanh mà vẫn yên tâm khi quay lại mua sắm.",
    };
  }

  if (normalizedEyebrow.includes("oauth")) {
    return {
      panelPill: "Đồng bộ OAuth",
      storyKicker: "Trao đổi phiên",
      storyTitle: "Đồng bộ phiên storefront của bạn.",
      storyCopy: description,
      stats: [
        { label: "Ticket", value: "Ngắn hạn" },
        { label: "Hồ sơ", value: "Khởi tạo" },
        { label: "Redirect", value: "Tiếp tục route" },
      ],
      highlights: [
        {
          title: "Bàn giao từ nhà cung cấp",
          copy: "Đăng nhập Google đang được hoàn tất để bạn quay lại mua sắm ngay sau đó.",
        },
        {
          title: "Tiếp tục an toàn",
          copy: "Nếu cần thêm bước xác minh, bạn vẫn sẽ được đưa về đúng nơi mình đang dở dang.",
        },
      ],
      noteLabel: "Tiến trình",
      noteValue: "Đang đồng bộ phiên Google",
      noteCopy: "Đừng đóng trang này trong lúc hệ thống đang hoàn tất đăng nhập cho bạn.",
    };
  }

  if (normalizedEyebrow.includes("xác minh")) {
    return {
      panelPill: "Lớp xác minh",
      storyKicker: "Bảo toàn tài khoản",
      storyTitle: "Hoàn tất bước tin cậy cuối cùng.",
      storyCopy: description,
      stats: [
        { label: "Email", value: "Chờ xác minh" },
        { label: "Phục hồi", value: "Mạnh hơn" },
        { label: "Thông báo", value: "Sẵn sàng" },
      ],
      highlights: [
        {
          title: "Xác nhận quyền sở hữu",
          copy: "Xác minh email giúp tài khoản mạnh hơn ở các luồng khôi phục và thông báo sau này.",
        },
        {
          title: "Xác minh rõ ràng",
          copy: "Mã xác minh sẽ giúp bạn bảo vệ tài khoản tốt hơn cho những lần đăng nhập sau.",
        },
      ],
      noteLabel: "Điểm kiểm tra",
      noteValue: "Xác minh danh tính",
      noteCopy: "Hoàn tất bước này để tài khoản sẵn sàng cho mua sắm, theo dõi đơn và thông báo.",
    };
  }

  return {
    panelPill: normalizedEyebrow.includes("quên") || normalizedEyebrow.includes("đặt lại")
      ? "Khôi phục"
      : eyebrow,
    storyKicker: "Khôi phục tài khoản",
    storyTitle: title,
    storyCopy: description,
    stats: [
      { label: "Kênh", value: "Qua email" },
      { label: "Token", value: "Có kiểm tra" },
      { label: "Truy cập", value: "Khôi phục" },
    ],
    highlights: [
      {
        title: "Khôi phục ít ma sát",
        copy: "Các bước khôi phục được giữ ngắn gọn để bạn sớm quay lại tài khoản của mình.",
      },
      {
        title: "Backend là nguồn quyết định",
        copy: "Mật khẩu mới sẽ có hiệu lực ngay sau khi bạn hoàn tất xác nhận.",
      },
    ],
    noteLabel: "Lối vào khôi phục",
    noteValue: "Quyền truy cập mật khẩu",
    noteCopy: "Dùng màn này để quay lại tài khoản an toàn rồi tiếp tục mua sắm bình thường.",
  };
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
  const pathname = usePathname();
  const theme = resolveAuthShellTheme(eyebrow, title, description);
  const laneLinks = [
    { href: "/login", label: "Đăng nhập" },
    { href: "/register", label: "Đăng ký" },
    { href: "/forgot-password", label: "Khôi phục" },
  ];

  return (
    <div className="auth-shell min-h-screen bg-background px-4 py-4 lg:px-5 lg:py-5">
      <main className="auth-shell-grid grid min-h-[calc(100vh-2rem)] gap-5 lg:grid-cols-[minmax(0,1.06fr)_minmax(420px,0.94fr)]">
        <section className="auth-story-card relative hidden overflow-hidden rounded-[2rem] bg-primary-container lg:block">
          <StorefrontImage
            alt="Nền forest cho trang xác thực"
            src={authVisualImage}
            fill
            priority
            sizes="60vw"
            className="object-cover opacity-45"
          />
          <div className="auth-story-overlay absolute inset-0 bg-gradient-to-b from-primary/38 via-primary/72 to-[#09160f]/94" />
          <div className="auth-story-content relative grid h-full gap-8 p-10 text-surface xl:p-14">
            <div className="flex items-start justify-between gap-4">
              <Link href="/" className="auth-brand-mark font-serif text-4xl font-semibold tracking-[-0.04em]">
                ND Shop
              </Link>
              <span className="auth-panel-pill rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-surface/80">
                {theme.panelPill}
              </span>
            </div>

            <div className="grid gap-8 self-end">
              <div className="auth-story-head max-w-2xl">
                <p className="auth-story-kicker inline-flex rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#efd7ce]">
                  {theme.storyKicker}
                </p>
                <h1 className="mt-6 font-serif text-6xl font-semibold leading-[0.92] tracking-[-0.06em] xl:text-7xl">
                  {theme.storyTitle}
                </h1>
                <p className="auth-story-copy mt-6 max-w-xl text-lg leading-8 text-surface/76">
                  {theme.storyCopy}
                </p>
              </div>

              <div className="auth-story-grid grid gap-3 md:grid-cols-3">
                {theme.stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="auth-story-stat rounded-[1.4rem] border border-white/10 bg-white/8 px-5 py-5 backdrop-blur-md"
                  >
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-surface/58">
                      {stat.label}
                    </span>
                    <strong className="mt-4 block font-serif text-[1.75rem] font-semibold tracking-[-0.04em] text-surface">
                      {stat.value}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="auth-highlight-list grid gap-3 xl:max-w-[38rem]">
                {theme.highlights.map((highlight) => (
                  <div
                    key={highlight.title}
                    className="auth-highlight-item grid grid-cols-[auto_1fr] gap-4 rounded-[1.5rem] border border-white/10 bg-white/8 px-5 py-5 backdrop-blur-md"
                  >
                    <span className="auth-highlight-mark mt-1 h-3 w-3 rounded-full bg-[#ffbf6b] shadow-[0_0_0_7px_rgba(255,191,107,0.14)]" />
                    <div>
                      <strong className="block text-base font-semibold text-surface">
                        {highlight.title}
                      </strong>
                      <p className="mt-2 text-sm leading-7 text-surface/72">{highlight.copy}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="auth-story-note ml-auto grid max-w-[340px] gap-2 rounded-[1.5rem] border border-white/10 bg-white/10 px-5 py-5 backdrop-blur-md">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-surface/58">
                  {theme.noteLabel}
                </span>
                <strong className="font-serif text-2xl font-semibold tracking-[-0.04em] text-surface">
                  {theme.noteValue}
                </strong>
                <p className="text-sm leading-7 text-surface/72">{theme.noteCopy}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="auth-form-surface flex items-center justify-center px-2 py-6 sm:px-6 lg:px-12">
          <div className="auth-form-inner w-full max-w-xl rounded-[2rem] border border-outline-variant/20 bg-white/88 p-6 shadow-editorial backdrop-blur-md md:p-8">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary lg:hidden">
                ND Shop
              </Link>
              <span className="auth-panel-pill rounded-full bg-surface-container-high px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                {theme.panelPill}
              </span>
            </div>
            <div className="auth-form-header mt-6 space-y-3">
              <p className="eyebrow">{eyebrow}</p>
              <p className="text-sm leading-7 text-on-surface-variant">
                {description}
              </p>
              <nav className="auth-lane-nav" aria-label="Lối vào tài khoản">
                {laneLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "auth-lane-link",
                      isActiveAuthLane(pathname, link.href) && "auth-lane-link-active",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
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
        <p className="auth-switch-copy text-sm text-on-surface-variant">
          Chưa có tài khoản?{" "}
          <Link href={`/register?redirect=${encodeURIComponent(redirectTo)}`} className="auth-text-link font-medium text-primary">
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

        <form className="auth-form-stack space-y-5" onSubmit={handleSubmit}>
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
            <label className="auth-shell-check flex items-center gap-3 text-on-surface-variant">
              <input checked={remember} type="checkbox" onChange={(event) => setRemember(event.target.checked)} />
              Ghi nhớ tôi
            </label>
            <Link href="/forgot-password" className="auth-text-link font-medium text-primary">
              Quên mật khẩu?
            </Link>
          </div>

          <button type="submit" className={cn(buttonStyles({ size: "lg" }), "auth-submit-full w-full")} disabled={busy}>
            {busy ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <div className="space-y-3">
          <p className="auth-switch-copy text-center text-sm text-on-surface-variant">Hoặc tiếp tục với</p>
          <button type="button" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")} onClick={() => beginOAuthLogin("google", redirectTo, remember)}>
            Google
          </button>
          <div className="auth-help-card rounded-[1.25rem] border border-outline-variant/35 bg-surface-container-low p-5 text-sm leading-7 text-on-surface-variant">
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
      description="Chỉ với vài bước ngắn, bạn đã có thể tạo tài khoản để lưu địa chỉ, món yêu thích và theo dõi đơn hàng dễ hơn."
      footer={
        <p className="auth-switch-copy text-sm text-on-surface-variant">
          Đã có tài khoản?{" "}
          <Link href={`/login?redirect=${encodeURIComponent(redirectTo)}`} className="auth-text-link font-medium text-primary">
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
            <form className="auth-form-stack space-y-5" onSubmit={handleSubmit}>
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
                Bạn có thể cập nhật lại họ tên và thông tin cá nhân sau khi hoàn tất đăng ký trong phần tài khoản.
              </p>

              <button type="submit" className={cn(buttonStyles({ size: "lg" }), "auth-submit-full w-full")} disabled={busy || phoneBusy}>
                {busy || phoneBusy ? "Đang xử lý..." : isPhoneIdentifier ? "Gửi Telegram OTP" : "Tạo tài khoản"}
              </button>
            </form>

            {isPhoneIdentifier ? (
              <div className="auth-help-card rounded-[1.25rem] border border-outline-variant/35 bg-surface-container-low p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Telegram OTP
                </p>
                <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                  Sau khi xác minh thành công, bạn sẽ được đưa thẳng vào tài khoản để tiếp tục mua sắm.
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

            <div className="auth-help-card rounded-[1.25rem] border border-outline-variant/35 bg-surface-container-low p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                Google và số điện thoại
              </p>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                Tiếp tục với Google để tạo tài khoản nhanh hơn và quay lại mua sắm ngay khi đăng nhập xong.
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

            <div className="auth-help-card rounded-[1.25rem] border border-outline-variant/35 bg-surface-container-low p-5">
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
    <AuthShell eyebrow="Quên mật khẩu" title="Khôi phục quyền truy cập tài khoản." description="Nhập email để nhận hướng dẫn đặt lại mật khẩu và quay lại tài khoản của bạn.">
      <div className="mt-6 space-y-6">
        {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}
        <form className="auth-form-stack space-y-5" onSubmit={handleSubmit}>
          <TextInput autoComplete="email" placeholder="Email tài khoản" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <button type="submit" className={cn(buttonStyles({ size: "lg" }), "auth-submit-full w-full")} disabled={busy}>
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
    <AuthShell eyebrow="Đặt lại mật khẩu" title="Tạo mật khẩu mới cho tài khoản." description="Đặt lại mật khẩu mới để tiếp tục mua sắm và theo dõi đơn hàng như bình thường.">
      <div className="mt-6 space-y-6">
        {feedback ? <InlineAlert tone="error">{feedback}</InlineAlert> : null}
        <form className="auth-form-stack space-y-5" onSubmit={handleSubmit}>
          <TextInput autoComplete="new-password" placeholder="Mật khẩu mới" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <TextInput autoComplete="new-password" placeholder="Xác nhận mật khẩu mới" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          <button type="submit" className={cn(buttonStyles({ size: "lg" }), "auth-submit-full w-full")} disabled={busy}>
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
        message: "Không nhận được dữ liệu đăng nhập từ Google. Hãy thử lại.",
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
    <AuthShell eyebrow="Xử lý OAuth" title="Đang đồng bộ phiên đăng nhập." description="Hệ thống đang hoàn tất đăng nhập Google và chuẩn bị đưa bạn quay lại nơi đang mua sắm.">
      <div className="mt-6 space-y-6">
        <InlineAlert tone={feedback.tone}>{feedback.message}</InlineAlert>

        {oauthUser ? (
          <div className="auth-help-card rounded-[1.25rem] border border-outline-variant/35 bg-surface-container-low p-5">
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
              Nếu email Google đã gắn với tài khoản hiện có, hệ thống sẽ tự nhận diện và cập nhật để bạn không phải tạo lại từ đầu. Bạn cũng có thể bổ sung số điện thoại sau trong hồ sơ.
            </p>
          </div>
        ) : null}

        {oauthUser && !oauthUser.email_verified ? (
          <div className="auth-help-card rounded-[1.25rem] border border-outline-variant/35 bg-surface-container-low p-5">
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
