"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

import { InlineAlert, LoadingScreen, TextInput } from "@/components/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { authApi } from "@/lib/api/auth";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import { cn } from "@/lib/utils";
import { readPendingOAuthRemember } from "@/utils/auth/oauth";

function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return {
      firstName: parts[0] ?? "",
      lastName: "",
    };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1] ?? "",
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
  return (
    <div className="min-h-screen bg-background">
      <main className="grid min-h-screen lg:grid-cols-[0.96fr_minmax(0,1fr)]">
        <section className="relative hidden overflow-hidden bg-primary-container lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,129,102,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.14),transparent_28%)]" />
          <div className="relative flex h-full flex-col justify-between p-12 text-surface">
            <Link href="/" className="font-serif text-3xl font-semibold tracking-[-0.03em]">
              Commerce Platform
            </Link>
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#efd7ce]">{eyebrow}</p>
              <h1 className="mt-6 font-serif text-6xl font-semibold leading-[0.95] tracking-[-0.05em]">
                {title}
              </h1>
              <p className="mt-6 text-lg leading-8 text-surface/78">{description}</p>
            </div>
            <div className="grid max-w-xl grid-cols-2 gap-4">
              <div className="rounded-[1.5rem] bg-white/10 p-5 backdrop-blur-lg">
                <p className="text-3xl font-semibold">Auth</p>
                <p className="mt-2 text-sm text-surface/78">Đăng nhập, đăng ký, xác minh email và phục hồi mật khẩu.</p>
              </div>
              <div className="rounded-[1.5rem] bg-white/10 p-5 backdrop-blur-lg">
                <p className="text-3xl font-semibold">JWT</p>
                <p className="mt-2 text-sm text-surface/78">Phiên làm việc và refresh token bám đúng contract hiện tại.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-xl rounded-[2rem] bg-surface-container-low p-6 shadow-editorial md:p-8">
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
      description="Phiên đăng nhập này dùng đúng contract auth hiện có trong repo, bao gồm refresh token, bootstrap profile và OAuth Google."
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
  const { isAuthenticated, register, beginOAuthLogin } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, redirectTo, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setFeedback("Vui lòng điền đầy đủ họ tên, email và mật khẩu.");
      return;
    }

    if (password.length < 8) {
      setFeedback("Mật khẩu cần tối thiểu 8 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setFeedback("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    if (!agree) {
      setFeedback("Bạn cần đồng ý điều khoản để tạo tài khoản.");
      return;
    }

    const name = splitFullName(fullName);

    try {
      setBusy(true);
      await register(
        {
          email: email.trim(),
          phone: phone.trim(),
          password: password.trim(),
          first_name: name.firstName || fullName.trim(),
          last_name: name.lastName,
        },
        false,
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
      eyebrow="Đăng ký"
      title="Tạo tài khoản để đặt hàng và theo dõi lịch sử mua sắm."
      description="Sau khi đăng ký thành công, tài khoản sẽ nhận token pair chuẩn của hệ thống và có thể sử dụng toàn bộ luồng checkout, orders, payments, profile."
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
          <p className="eyebrow">Tạo tài khoản</p>
          <h2 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.04em] text-primary">
            Tạo tài khoản mới
          </h2>
        </div>

        {feedback ? <InlineAlert tone="error">{feedback}</InlineAlert> : null}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <TextInput autoComplete="name" placeholder="Họ và tên" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          <TextInput autoComplete="email" placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <TextInput autoComplete="tel" placeholder="Số điện thoại" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <TextInput autoComplete="new-password" placeholder="Mật khẩu" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <TextInput autoComplete="new-password" placeholder="Xác nhận mật khẩu" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          <label className="flex items-center gap-3 text-sm text-on-surface-variant">
            <input checked={agree} type="checkbox" onChange={(event) => setAgree(event.target.checked)} />
            Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật.
          </label>
          <button type="submit" className={cn(buttonStyles({ size: "lg" }), "w-full")} disabled={busy}>
            {busy ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
          </button>
        </form>

        <button type="button" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")} onClick={() => beginOAuthLogin("google", redirectTo, false)}>
          Tiếp tục với Google
        </button>
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
        }
      })
      .catch((reason) => {
        if (active) {
          setFeedback(getErrorMessage(reason));
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
        {feedback ? <InlineAlert tone={busy ? "info" : "success"}>{feedback}</InlineAlert> : null}
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
  const { exchangeOAuthTicket } = useAuth();
  const ticket = searchParams.get("ticket") ?? "";
  const redirectTo = searchParams.get("redirect_to") || searchParams.get("redirect") || "/profile";
  const errorCode = searchParams.get("code") || searchParams.get("error");
  const errorMessage = searchParams.get("message");
  const [feedback, setFeedback] = useState(() => {
    if (errorCode) {
      return errorMessage || "Đăng nhập Google chưa hoàn tất.";
    }

    if (!ticket) {
      return "Không nhận được OAuth ticket từ backend.";
    }

    return "Đang hoàn tất đăng nhập Google...";
  });

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
      .then(() => {
        if (active) {
          router.replace(redirectTo);
        }
      })
      .catch((reason) => {
        if (active) {
          setFeedback(getErrorMessage(reason));
        }
      });

    return () => {
      active = false;
    };
  }, [errorCode, errorMessage, exchangeOAuthTicket, redirectTo, router, ticket]);

  return (
    <AuthShell eyebrow="Xử lý OAuth" title="Đang đồng bộ phiên đăng nhập." description="Frontend đang đổi short-lived OAuth ticket sang token pair chuẩn của hệ thống và bootstrap profile hiện tại.">
      <div className="mt-6 space-y-6">
        <InlineAlert tone={errorCode || !ticket ? "error" : "info"}>{feedback}</InlineAlert>
        {errorCode || !ticket ? (
          <Link href="/login" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")}>
            Quay lại đăng nhập
          </Link>
        ) : null}
      </div>
    </AuthShell>
  );
}
