import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { AccountPageLayout } from "@/features/account/components/account-page-layout";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { api, getErrorMessage } from "@/services/api";
import type { ReturnRequest } from "@/types/api";
import { formatCurrency, formatDateTime, formatStatusLabel } from "@/utils/format";
import "@/styles/pages/account/return-detail-page.css";

const maxEvidenceFiles = 6;
const maxEvidenceSizeBytes = 8 * 1024 * 1024;

export function ReturnDetailPage() {
  const { token } = useAuth();
  const { returnId = "" } = useParams();
  const [returnRequest, setReturnRequest] = useState<ReturnRequest | null>(null);
  const [feedback, setFeedback] = useState("");
  const [uploadFeedback, setUploadFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    let active = true;

    if (!token || !returnId) {
      return () => {
        active = false;
      };
    }

    async function loadReturn() {
      try {
        setIsLoading(true);
        const response = await api.getReturnById(token, returnId);
        if (!active) {
          return;
        }

        setReturnRequest(response.data);
        setFeedback("");
      } catch (reason) {
        if (active) {
          setFeedback(getErrorMessage(reason));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadReturn();

    return () => {
      active = false;
    };
  }, [returnId, token]);

  const latestEvent = useMemo(() => {
    if (!returnRequest || returnRequest.events.length === 0) {
      return null;
    }

    return returnRequest.events[returnRequest.events.length - 1];
  }, [returnRequest]);

  const canUploadEvidence =
    returnRequest !== null && !["rejected", "cancelled", "refunded"].includes(returnRequest.status);

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    if (nextFiles.length === 0) {
      setSelectedFiles([]);
      return;
    }
    if (nextFiles.length > maxEvidenceFiles) {
      setUploadFeedback(`Bạn chỉ có thể tải lên tối đa ${maxEvidenceFiles} ảnh trong một lần.`);
      event.target.value = "";
      return;
    }

    const invalidFile = nextFiles.find(
      (file) =>
        !["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type) ||
        file.size > maxEvidenceSizeBytes
    );
    if (invalidFile) {
      setUploadFeedback("Chỉ hỗ trợ JPG, PNG, WEBP và mỗi ảnh phải nhỏ hơn 8MB.");
      event.target.value = "";
      return;
    }

    setSelectedFiles(nextFiles);
    setUploadFeedback("");
  }

  async function handleUploadEvidence() {
    if (!token || !returnRequest) {
      setUploadFeedback("Bạn cần đăng nhập để tải lên bằng chứng trả hàng.");
      return;
    }
    if (selectedFiles.length === 0) {
      setUploadFeedback("Hãy chọn ít nhất một ảnh bằng chứng.");
      return;
    }

    try {
      setIsUploading(true);
      const response = await api.uploadReturnEvidence(token, returnRequest.id, selectedFiles);
      setReturnRequest(response.data);
      setSelectedFiles([]);
      setUploadFeedback(
        `Đã tải lên ${response.data.evidence.length} bằng chứng cho yêu cầu trả hàng.`
      );
    } catch (reason) {
      setUploadFeedback(getErrorMessage(reason));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <AccountPageLayout>
      <div className="return-detail-route">
        <div className="return-detail-shell">
          {feedback ? <div className="feedback feedback-error">{feedback}</div> : null}

          {isLoading && !returnRequest ? (
            <div className="page-state">Đang tải chi tiết yêu cầu trả hàng...</div>
          ) : returnRequest ? (
            <>
              <header className="return-detail-hero">
                <div>
                  <p className="return-detail-kicker">Return case detail</p>
                  <h1>{returnRequest.id}</h1>
                  <p>
                    Theo dõi trạng thái trả hàng, lịch sử xử lý và bổ sung hình ảnh bằng chứng khi
                    đội vận hành cần thêm thông tin.
                  </p>
                </div>

                <div className="return-detail-hero-actions">
                  <span className={getReturnStatusClassName(returnRequest.status)}>
                    {formatStatusLabel(returnRequest.status)}
                  </span>
                  <Link className="ghost-button" to="/returns">
                    Back to returns center
                  </Link>
                </div>
              </header>

              <section className="return-detail-summary-grid">
                <article className="return-detail-summary-card">
                  <span>Linked order</span>
                  <strong>
                    <Link to={`/orders/${returnRequest.order_id}`}>{returnRequest.order_id}</Link>
                  </strong>
                </article>
                <article className="return-detail-summary-card">
                  <span>Created</span>
                  <strong>{formatDateTime(returnRequest.created_at)}</strong>
                </article>
                <article className="return-detail-summary-card">
                  <span>Refund status</span>
                  <strong>{buildReturnRefundSummary(returnRequest)}</strong>
                </article>
                <article className="return-detail-summary-card">
                  <span>Evidence files</span>
                  <strong>{returnRequest.evidence.length}</strong>
                </article>
              </section>

              <section className="return-detail-grid">
                <article className="return-detail-card">
                  <div className="history-line">
                    <strong>Reason & items</strong>
                    <span className="history-subtle">
                      {returnRequest.items.length} return lines
                    </span>
                  </div>

                  <p className="return-detail-copy">{returnRequest.reason}</p>

                  <div className="return-detail-item-list">
                    {returnRequest.items.map((item) => (
                      <div className="history-item-preview" key={item.id}>
                        <strong>{item.product_id}</strong>
                        <span>
                          Order item {item.order_item_id} • Qty {item.quantity}
                        </span>
                        <span>{item.reason || "Không có ghi chú riêng cho dòng này."}</span>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="return-detail-card">
                  <div className="history-line">
                    <strong>Timeline</strong>
                    <span className="history-subtle">
                      {latestEvent
                        ? formatDateTime(latestEvent.created_at)
                        : "Chưa có cập nhật mới"}
                    </span>
                  </div>

                  <div className="return-detail-timeline">
                    {returnRequest.events.map((event) => (
                      <div className="return-detail-timeline-item" key={event.id}>
                        <strong>{formatStatusLabel(event.status)}</strong>
                        <span>{event.message}</span>
                        <span className="history-subtle">
                          {event.actor_role || "system"} • {formatDateTime(event.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              {returnRequest.refund_last_error ? (
                <div className="feedback feedback-warning">
                  <strong>Lần hoàn tiền gần nhất chưa thành công.</strong>
                  <span>{returnRequest.refund_last_error}</span>
                  {returnRequest.refund_next_retry_at ? (
                    <span>
                      Retry tiếp theo vào {formatDateTime(returnRequest.refund_next_retry_at)}.
                    </span>
                  ) : null}
                </div>
              ) : null}

              <section className="return-detail-card">
                <div className="history-line">
                  <strong>Evidence gallery</strong>
                  <span className="history-subtle">
                    JPG, PNG, WEBP • tối đa {maxEvidenceFiles} ảnh / lần
                  </span>
                </div>

                {returnRequest.evidence.length > 0 ? (
                  <div className="return-detail-evidence-grid">
                    {returnRequest.evidence.map((evidence) => (
                      <a
                        className="return-detail-evidence-card"
                        href={evidence.url}
                        key={evidence.id}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <div className="return-detail-evidence-media">
                          <img alt={evidence.file_name} src={evidence.url} />
                        </div>
                        <div className="return-detail-evidence-copy">
                          <strong>{evidence.file_name}</strong>
                          <span>{formatEvidenceSize(evidence.size_bytes)}</span>
                          <span>{formatDateTime(evidence.created_at)}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="history-empty return-detail-empty">
                    Chưa có bằng chứng nào được tải lên cho yêu cầu này.
                  </div>
                )}

                {uploadFeedback ? (
                  <div className="feedback feedback-info">{uploadFeedback}</div>
                ) : null}

                {canUploadEvidence ? (
                  <div className="return-detail-upload">
                    <label className="return-detail-upload-field">
                      <span>Upload proof images</span>
                      <input
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        type="file"
                        onChange={handleFileSelection}
                      />
                    </label>

                    {selectedFiles.length > 0 ? (
                      <div className="return-detail-selected-files">
                        {selectedFiles.map((file) => (
                          <div
                            className="return-detail-selected-file"
                            key={`${file.name}-${file.size}`}
                          >
                            <strong>{file.name}</strong>
                            <span>{formatEvidenceSize(file.size)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="return-detail-upload-actions">
                      <button
                        className="primary-button"
                        disabled={isUploading}
                        type="button"
                        onClick={handleUploadEvidence}
                      >
                        {isUploading ? "Uploading..." : "Upload evidence"}
                      </button>
                      <span className="history-subtle">
                        Bạn có thể bổ sung thêm ảnh cho đến khi yêu cầu bị đóng hoặc hoàn tiền xong.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="history-empty return-detail-empty">
                    Yêu cầu này đã đóng nên không nhận thêm bằng chứng mới.
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </AccountPageLayout>
  );
}

function buildReturnRefundSummary(returnRequest: ReturnRequest) {
  if (typeof returnRequest.refund_amount !== "number") {
    return "Sẽ tính khi xử lý xong";
  }
  if (returnRequest.status === "refunded") {
    return `Đã hoàn ${formatCurrency(returnRequest.refund_amount)}`;
  }
  if (returnRequest.status === "refund_pending") {
    return `Đang chờ hoàn ${formatCurrency(returnRequest.refund_amount)}`;
  }
  return `Ước tính hoàn ${formatCurrency(returnRequest.refund_amount)}`;
}

function formatEvidenceSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (sizeBytes >= 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }
  return `${sizeBytes} B`;
}

function getReturnStatusClassName(status: string) {
  switch (status) {
    case "approved":
    case "received":
    case "refunded":
      return "status-pill status-pill-success";
    case "refund_pending":
      return "status-pill status-pill-warning";
    case "rejected":
    case "cancelled":
      return "status-pill status-pill-danger";
    default:
      return "status-pill status-pill-neutral";
  }
}
