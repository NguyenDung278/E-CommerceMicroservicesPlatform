import { FileImage, RotateCcw, Upload } from "lucide-react";
import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useState } from "react";
import { createReturnRequest, uploadReturnEvidence } from "../../services/order-service";
import { useAuth } from "../../state/auth-context";
import type { ReturnEligibilitySnapshot, ReturnRequest } from "../../types/api";
import { formatDate } from "../../utils/format";
import { isPositiveStatus, statusLabel } from "../../utils/status";

type ReturnLineDraft = {
  selected: boolean;
  quantity: number;
  reason: string;
};

function initialReturnDraft(snapshot: ReturnEligibilitySnapshot | null) {
  return Object.fromEntries(
    (snapshot?.items ?? []).map((item) => [
      item.order_item_id,
      {
        selected: false,
        quantity: Math.min(1, Math.max(0, item.remaining_quantity)),
        reason: "",
      },
    ]),
  ) as Record<string, ReturnLineDraft>;
}

/**
 * Form tạo yêu cầu trả hàng theo return-eligibility snapshot + lịch sử
 * return của đơn kèm upload bằng chứng. Eligibility/returns do page sở hữu
 * (nạp chung một lượt với order); section chỉ giữ state form.
 */
export function ReturnsSection({
  orderId,
  eligibility,
  returns,
  setReturns,
  onRefresh,
  onError,
}: {
  orderId: string;
  eligibility: ReturnEligibilitySnapshot | null;
  returns: ReturnRequest[];
  setReturns: Dispatch<SetStateAction<ReturnRequest[]>>;
  onRefresh: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const { token } = useAuth();
  const [returnDrafts, setReturnDrafts] = useState<Record<string, ReturnLineDraft>>({});
  const [returnReason, setReturnReason] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<Record<string, File | null>>({});
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [uploadingReturnId, setUploadingReturnId] = useState<string | null>(null);

  const eligibleReturnItems = useMemo(
    () => (eligibility?.items ?? []).filter((item) => item.eligible && item.remaining_quantity > 0),
    [eligibility],
  );
  const selectedReturnCount = Object.values(returnDrafts).filter((item) => item.selected).length;

  useEffect(() => {
    setReturnDrafts(initialReturnDraft(eligibility));
  }, [eligibility]);

  function updateReturnDraft(orderItemId: string, patch: Partial<ReturnLineDraft>) {
    setReturnDrafts((current) => ({
      ...current,
      [orderItemId]: {
        ...(current[orderItemId] ?? { selected: false, quantity: 1, reason: "" }),
        ...patch,
      },
    }));
  }

  async function submitReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const selectedItems = eligibleReturnItems
      .map((item) => ({ item, draft: returnDrafts[item.order_item_id] }))
      .filter(({ draft }) => draft?.selected)
      .map(({ item, draft }) => ({
        order_item_id: item.order_item_id,
        quantity: Math.min(Math.max(1, draft.quantity), item.remaining_quantity),
        reason: draft.reason.trim() || undefined,
      }));

    if (returnReason.trim().length < 5) {
      onError("Lý do trả hàng cần ít nhất 5 ký tự");
      return;
    }
    if (selectedItems.length === 0) {
      onError("Chọn ít nhất một sản phẩm đã giao");
      return;
    }

    try {
      setSubmittingReturn(true);
      onError(null);
      await createReturnRequest(token, orderId, {
        reason: returnReason.trim(),
        items: selectedItems,
      });
      setReturnReason("");
      await onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tạo được yêu cầu trả hàng");
    } finally {
      setSubmittingReturn(false);
    }
  }

  async function submitEvidence(returnId: string) {
    const file = evidenceFiles[returnId];
    if (!token || !file) {
      return;
    }

    try {
      setUploadingReturnId(returnId);
      onError(null);
      const updatedReturn = await uploadReturnEvidence(token, returnId, file);
      setReturns((current) => current.map((item) => (item.id === returnId ? updatedReturn : item)));
      setEvidenceFiles((current) => ({ ...current, [returnId]: null }));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tải được bằng chứng");
    } finally {
      setUploadingReturnId(null);
    }
  }

  return (
    <section className="surface-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Returns</span>
          <h2>Trả hàng/hoàn tiền</h2>
          <p>
            {eligibility?.eligible
              ? `Còn hạn trả hàng đến ${
                  eligibility.return_window_expires_at
                    ? formatDate(eligibility.return_window_expires_at)
                    : "theo chính sách"
                }`
              : (eligibility?.reason ?? "Đơn hàng chưa đủ điều kiện trả hàng")}
          </p>
        </div>
        <RotateCcw size={24} />
      </div>

      {eligibleReturnItems.length > 0 ? (
        <form className="return-form" onSubmit={submitReturn}>
          <label>
            Lý do chung
            <textarea
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
              placeholder="Nhập lý do trả hàng"
              rows={3}
            />
          </label>
          <div className="return-item-list">
            {eligibility?.items.map((item) => {
              const draft = returnDrafts[item.order_item_id] ?? {
                selected: false,
                quantity: 1,
                reason: "",
              };
              return (
                <article key={item.order_item_id} className="return-item-card">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={draft.selected}
                      disabled={!item.eligible || item.remaining_quantity <= 0}
                      onChange={(event) =>
                        updateReturnDraft(item.order_item_id, {
                          selected: event.target.checked,
                        })
                      }
                    />
                    <span>{item.product_name}</span>
                  </label>
                  <p>
                    Còn có thể trả: {item.remaining_quantity}/{item.ordered_quantity}
                    {item.reason ? ` - ${item.reason}` : ""}
                  </p>
                  <div className="return-item-card__controls">
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, item.remaining_quantity)}
                      value={draft.quantity}
                      disabled={!draft.selected}
                      onChange={(event) =>
                        updateReturnDraft(item.order_item_id, {
                          quantity: Number(event.target.value),
                        })
                      }
                    />
                    <input
                      value={draft.reason}
                      disabled={!draft.selected}
                      placeholder="Lý do riêng cho sản phẩm"
                      onChange={(event) =>
                        updateReturnDraft(item.order_item_id, {
                          reason: event.target.value,
                        })
                      }
                    />
                  </div>
                </article>
              );
            })}
          </div>
          <button
            className="button button--primary"
            type="submit"
            disabled={submittingReturn || selectedReturnCount === 0}
          >
            {submittingReturn ? "Đang gửi yêu cầu" : "Gửi yêu cầu trả hàng"}
          </button>
        </form>
      ) : (
        <p className="muted-text">Không có sản phẩm nào đủ điều kiện trả hàng lúc này.</p>
      )}

      {returns.length > 0 ? (
        <div className="return-history">
          {returns.map((returnRequest) => (
            <article key={returnRequest.id} className="return-history-card">
              <div className="return-history-card__heading">
                <div>
                  <strong>{returnRequest.id}</strong>
                  <p>{returnRequest.reason}</p>
                </div>
                <span
                  className={`status-pill${
                    isPositiveStatus(returnRequest.status) ? " is-good" : ""
                  }`}
                >
                  {statusLabel(returnRequest.status)}
                </span>
              </div>
              {returnRequest.evidence && returnRequest.evidence.length > 0 ? (
                <div className="evidence-list">
                  {returnRequest.evidence.map((evidence) => (
                    <a key={evidence.id} href={evidence.url} target="_blank" rel="noreferrer">
                      <FileImage size={15} />
                      {evidence.file_name}
                    </a>
                  ))}
                </div>
              ) : null}
              <div className="evidence-upload">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setEvidenceFiles((current) => ({
                      ...current,
                      [returnRequest.id]: event.target.files?.[0] ?? null,
                    }))
                  }
                />
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={
                    !evidenceFiles[returnRequest.id] || uploadingReturnId === returnRequest.id
                  }
                  onClick={() => void submitEvidence(returnRequest.id)}
                >
                  <Upload size={16} />
                  {uploadingReturnId === returnRequest.id ? "Đang tải" : "Tải bằng chứng"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
