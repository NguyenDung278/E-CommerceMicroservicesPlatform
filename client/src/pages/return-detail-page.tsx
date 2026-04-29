import { ChangeEvent, useEffect, useState } from "react";
import { ArrowLeft, FileImage, PackageCheck, RotateCcw, Upload } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { EmptyView, ErrorView, LoadingView } from "../components/status-view";
import { getReturn, uploadReturnEvidence } from "../services/order-service";
import { useAuth } from "../state/auth-context";
import type { ReturnRequest } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    requested: "Đã gửi yêu cầu",
    approved: "Đã duyệt",
    rejected: "Từ chối",
    received: "Đã nhận hàng trả",
    refund_pending: "Đang hoàn tiền",
    refunded: "Đã hoàn tiền",
    cancelled: "Đã hủy",
  };

  return labels[value] ?? value;
}

function isPositiveStatus(value: string) {
  return ["approved", "received", "refund_pending", "refunded"].includes(value);
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "";
  }
  if (size < 1024 * 1024) {
    return `${Math.ceil(size / 1024)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReturnDetailPage() {
  const { returnId } = useParams();
  const { token } = useAuth();
  const [returnRequest, setReturnRequest] = useState<ReturnRequest | null>(null);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadReturn() {
      if (!token || !returnId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await getReturn(token, returnId);
        if (active) {
          setReturnRequest(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Không tải được yêu cầu trả hàng");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadReturn();

    return () => {
      active = false;
    };
  }, [returnId, token]);

  function handleEvidenceChange(event: ChangeEvent<HTMLInputElement>) {
    setEvidenceFile(event.target.files?.[0] ?? null);
  }

  async function submitEvidence() {
    if (!token || !returnRequest || !evidenceFile) {
      return;
    }

    try {
      setUploading(true);
      setActionError(null);
      setActionStatus(null);
      const updated = await uploadReturnEvidence(token, returnRequest.id, evidenceFile);
      setReturnRequest(updated);
      setEvidenceFile(null);
      setActionStatus("Đã tải bằng chứng trả hàng.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không tải được bằng chứng");
    } finally {
      setUploading(false);
    }
  }

  if (!token) {
    return (
      <EmptyView title="Cần đăng nhập">
        <Link to="/account">Đăng nhập để xem chi tiết trả hàng</Link>
      </EmptyView>
    );
  }

  if (loading) {
    return <LoadingView label="Đang tải chi tiết trả hàng" />;
  }

  if (error || !returnRequest) {
    return <ErrorView message={error ?? "Không tìm thấy yêu cầu trả hàng"} />;
  }

  return (
    <div className="page-stack">
      <Link to="/account/returns" className="text-link">
        <ArrowLeft size={16} />
        Quay lại danh sách trả hàng
      </Link>

      <section className="order-detail-hero">
        <div>
          <span className="eyebrow">Return detail</span>
          <h1>{returnRequest.id}</h1>
          <p>Tạo lúc {formatDate(returnRequest.created_at)}</p>
        </div>
        <div className="order-detail-hero__actions">
          <span
            className={`status-pill${isPositiveStatus(returnRequest.status) ? " is-good" : ""}`}
          >
            {statusLabel(returnRequest.status)}
          </span>
          <Link className="button button--secondary" to={`/account/orders/${returnRequest.order_id}`}>
            <PackageCheck size={17} />
            Xem đơn hàng
          </Link>
        </div>
      </section>

      {actionError ? <p className="inline-error">{actionError}</p> : null}
      {actionStatus ? <p className="inline-success">{actionStatus}</p> : null}

      <section className="order-detail-layout">
        <div className="order-detail-main">
          <section className="surface-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Summary</span>
                <h2>Lý do và sản phẩm</h2>
              </div>
              <RotateCcw size={24} />
            </div>
            <p className="muted-text">{returnRequest.reason}</p>
            <div className="return-item-list">
              {returnRequest.items.map((item) => (
                <article key={item.id} className="return-item-card">
                  <div className="return-history-card__heading">
                    <div>
                      <Link to={`/products/${item.product_id}`}>{item.product_id}</Link>
                      <p>Order item: {item.order_item_id}</p>
                    </div>
                    <strong>Số lượng: {item.quantity}</strong>
                  </div>
                  {item.reason ? <p>{item.reason}</p> : null}
                </article>
              ))}
            </div>
          </section>

          <section className="surface-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Evidence</span>
                <h2>Bằng chứng trả hàng</h2>
              </div>
              <FileImage size={24} />
            </div>
            {returnRequest.evidence && returnRequest.evidence.length > 0 ? (
              <div className="evidence-list evidence-list--stacked">
                {returnRequest.evidence.map((evidence) => (
                  <a key={evidence.id} href={evidence.url} target="_blank" rel="noreferrer">
                    <FileImage size={15} />
                    {evidence.file_name}
                    {evidence.size_bytes ? ` (${formatFileSize(evidence.size_bytes)})` : ""}
                  </a>
                ))}
              </div>
            ) : (
              <p className="muted-text">Chưa có file bằng chứng.</p>
            )}
            <div className="evidence-upload">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleEvidenceChange}
              />
              <button
                className="button button--secondary"
                type="button"
                disabled={!evidenceFile || uploading}
                onClick={() => void submitEvidence()}
              >
                <Upload size={16} />
                {uploading ? "Đang tải" : "Tải lên"}
              </button>
            </div>
          </section>
        </div>

        <aside className="order-detail-side">
          <section className="surface-section order-side-section">
            <h2>Hoàn tiền</h2>
            <div className="tracking-card">
              <div>
                <span>Số tiền</span>
                <strong>
                  {typeof returnRequest.refund_amount === "number"
                    ? formatCurrency(returnRequest.refund_amount)
                    : "Chưa xác định"}
                </strong>
              </div>
              <div>
                <span>Yêu cầu hoàn tiền</span>
                <strong>
                  {returnRequest.refund_requested_at
                    ? formatDate(returnRequest.refund_requested_at)
                    : "Chưa bắt đầu"}
                </strong>
              </div>
              <div>
                <span>Hoàn tất</span>
                <strong>
                  {returnRequest.refund_completed_at
                    ? formatDate(returnRequest.refund_completed_at)
                    : "Chưa hoàn tất"}
                </strong>
              </div>
              {returnRequest.refund_last_error ? (
                <div>
                  <span>Lỗi gần nhất</span>
                  <strong>{returnRequest.refund_last_error}</strong>
                </div>
              ) : null}
            </div>
          </section>

          <section className="surface-section order-side-section">
            <h2>Dòng thời gian</h2>
            {returnRequest.events && returnRequest.events.length > 0 ? (
              <div className="timeline-list">
                {returnRequest.events.map((event) => (
                  <article key={event.id} className="timeline-item">
                    <span />
                    <div>
                      <strong>{statusLabel(event.status)}</strong>
                      <p>{event.message}</p>
                      <small>{formatDate(event.created_at)}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted-text">Chưa có sự kiện.</p>
            )}
          </section>
        </aside>
      </section>
    </div>
  );
}
