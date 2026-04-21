"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import { AccountShell } from "@/components/account-shell";
import { EmptyState, InlineAlert, LoadingScreen, StatusPill, SurfaceCard } from "@/components/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { orderApi } from "@/lib/api";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import type { ReturnRequest } from "@/types/api";
import { formatCurrency, formatDateTime, formatStatusLabel } from "@/utils/format";

const maxEvidenceFiles = 6;
const maxEvidenceSizeBytes = 8 * 1024 * 1024;

type ReturnDetailPageViewProps = {
  returnId: string;
};

export function ReturnDetailPageView({ returnId }: ReturnDetailPageViewProps) {
  const { token } = useAuth();
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
        const response = await orderApi.getReturnById(token, returnId);
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
        file.size > maxEvidenceSizeBytes,
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
      const response = await orderApi.uploadReturnEvidence(token, returnRequest.id, selectedFiles);
      setReturnRequest(response.data);
      setSelectedFiles([]);
      setUploadFeedback(`Đã tải lên ${response.data.evidence.length} bằng chứng.`);
    } catch (reason) {
      setUploadFeedback(getErrorMessage(reason));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <AccountShell
      title="Return detail"
      description="Theo dõi trạng thái xử lý, timeline, refund state và bổ sung bằng chứng khi đội vận hành cần thêm thông tin."
    >
      {feedback ? <InlineAlert tone="error">{feedback}</InlineAlert> : null}

      {isLoading && !returnRequest ? (
        <LoadingScreen label="Đang tải chi tiết yêu cầu trả hàng..." />
      ) : !returnRequest ? (
        <EmptyState
          title="Không tìm thấy return request"
          description="Return ID có thể không tồn tại hoặc bạn không có quyền truy cập."
        />
      ) : (
        <div className="space-y-6">
          <SurfaceCard className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Return case detail</p>
                <h2 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.04em] text-primary">
                  {returnRequest.id}
                </h2>
                <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                  Linked order{" "}
                  <Link href={`/orders/${returnRequest.order_id}`} className="underline">
                    {returnRequest.order_id}
                  </Link>
                </p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <StatusPill status={returnRequest.status} />
                <Link href="/returns" className={buttonStyles({ variant: "tertiary", size: "sm" })}>
                  Back to returns center
                </Link>
              </div>
            </div>
          </SurfaceCard>

          <div className="grid gap-6 md:grid-cols-4">
            <MetaBlock label="Created" value={formatDateTime(returnRequest.created_at)} />
            <MetaBlock label="Refund" value={buildReturnRefundSummary(returnRequest)} />
            <MetaBlock label="Evidence files" value={String(returnRequest.evidence.length)} />
            <MetaBlock
              label="Latest event"
              value={latestEvent ? formatStatusLabel(latestEvent.status) : "Requested"}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <SurfaceCard className="p-6">
              <p className="font-semibold text-primary">Reason & items</p>
              <p className="mt-4 text-sm leading-7 text-on-surface-variant">
                {returnRequest.reason}
              </p>
              <div className="mt-4 space-y-3">
                {returnRequest.items.map((item) => (
                  <div key={item.id} className="rounded-[1rem] bg-surface p-4">
                    <p className="font-medium text-primary">{item.product_id}</p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Order item {item.order_item_id} · Qty {item.quantity}
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {item.reason || "Không có ghi chú riêng cho dòng này."}
                    </p>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-6">
              <p className="font-semibold text-primary">Timeline</p>
              <div className="mt-4 space-y-3">
                {returnRequest.events.map((event) => (
                  <div key={event.id} className="rounded-[1rem] bg-surface p-4">
                    <p className="font-medium text-primary">{formatStatusLabel(event.status)}</p>
                    <p className="mt-1 text-sm text-on-surface-variant">{event.message}</p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {event.actor_role || "system"} · {formatDateTime(event.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>

          {returnRequest.refund_last_error ? (
            <InlineAlert tone="info">
              Lần hoàn tiền gần nhất chưa thành công. {returnRequest.refund_last_error}
            </InlineAlert>
          ) : null}

          <SurfaceCard className="p-6">
            <p className="font-semibold text-primary">Evidence gallery</p>

            {returnRequest.evidence.length > 0 ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {returnRequest.evidence.map((evidence) => (
                  <a
                    key={evidence.id}
                    href={evidence.url}
                    rel="noreferrer"
                    target="_blank"
                    className="overflow-hidden rounded-[1.25rem] bg-surface transition hover:bg-surface-container-high"
                  >
                    <div className="relative h-48 w-full">
                      <Image
                        alt={evidence.file_name}
                        src={evidence.url}
                        fill
                        sizes="(min-width: 1280px) 20rem, (min-width: 768px) 50vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <p className="font-medium text-primary">{evidence.file_name}</p>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        {formatEvidenceSize(evidence.size_bytes)}
                      </p>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        {formatDateTime(evidence.created_at)}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[1.25rem] bg-surface p-4 text-sm text-on-surface-variant">
                Chưa có bằng chứng nào được tải lên cho yêu cầu này.
              </div>
            )}

            {uploadFeedback ? <div className="mt-6"><InlineAlert tone="info">{uploadFeedback}</InlineAlert></div> : null}

            {canUploadEvidence ? (
              <div className="mt-6 space-y-4">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                    Upload proof images
                  </span>
                  <input
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    type="file"
                    onChange={handleFileSelection}
                    className="block w-full rounded-[1rem] border border-outline-variant/30 bg-background px-4 py-3 text-sm text-primary"
                  />
                </label>

                {selectedFiles.length > 0 ? (
                  <div className="space-y-2">
                    {selectedFiles.map((file) => (
                      <div key={`${file.name}-${file.size}`} className="rounded-[1rem] bg-surface p-3">
                        <p className="font-medium text-primary">{file.name}</p>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          {formatEvidenceSize(file.size)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <button
                  type="button"
                  className={buttonStyles()}
                  disabled={isUploading}
                  onClick={() => void handleUploadEvidence()}
                >
                  {isUploading ? "Uploading..." : "Upload evidence"}
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-[1.25rem] bg-surface p-4 text-sm text-on-surface-variant">
                Yêu cầu này đã đóng nên không nhận thêm bằng chứng mới.
              </div>
            )}
          </SurfaceCard>
        </div>
      )}
    </AccountShell>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <SurfaceCard className="p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
        {label}
      </p>
      <p className="mt-3 text-sm font-medium text-primary">{value}</p>
    </SurfaceCard>
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
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
