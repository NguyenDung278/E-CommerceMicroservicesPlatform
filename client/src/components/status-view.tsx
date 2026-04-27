import type { ReactNode } from "react";

export function LoadingView({ label = "Đang tải dữ liệu" }: { label?: string }) {
  return (
    <div className="status-view">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}

export function EmptyView({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="status-view status-view--empty">
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function ErrorView({ message }: { message: string }) {
  return (
    <div className="status-view status-view--error">
      <h2>Không thể tải dữ liệu</h2>
      <p>{message}</p>
    </div>
  );
}
