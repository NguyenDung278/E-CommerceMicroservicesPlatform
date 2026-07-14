import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CreditCard, ExternalLink, XCircle } from "lucide-react";
import { EmptyView, ErrorView, LoadingView } from "../components/status-view";
import { getPayment, getPaymentByOrder, listPaymentsByOrder } from "../services/payment-service";
import { useAuth } from "../state/auth-context";
import type { Payment } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";
import { statusLabel as sharedStatusLabel } from "../utils/status";

// Ngữ cảnh payment: "pending" nghĩa là chờ thanh toán, không phải chờ xử lý.
function statusLabel(value: string) {
  return value === "pending" ? "Chờ thanh toán" : sharedStatusLabel(value);
}

function statusIcon(status: string) {
  if (status === "completed" || status === "refunded") {
    return <CheckCircle2 size={28} />;
  }
  if (status === "failed") {
    return <XCircle size={28} />;
  }
  return <CreditCard size={28} />;
}

export function PaymentStatusPage() {
  const { id, orderId } = useParams();
  const { token } = useAuth();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [history, setHistory] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPayment() {
      if (!token || (!id && !orderId)) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        if (id) {
          const paymentData = await getPayment(token, id);
          const historyData = await listPaymentsByOrder(token, paymentData.order_id).catch(
            () => [],
          );
          if (active) {
            setPayment(paymentData);
            setHistory(historyData);
          }
          return;
        }

        if (orderId) {
          const [paymentData, historyData] = await Promise.all([
            getPaymentByOrder(token, orderId),
            listPaymentsByOrder(token, orderId).catch(() => []),
          ]);
          if (active) {
            setPayment(paymentData);
            setHistory(historyData);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Không tải được trạng thái thanh toán");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPayment();

    return () => {
      active = false;
    };
  }, [id, orderId, token]);

  if (!token) {
    return (
      <EmptyView title="Cần đăng nhập">
        <Link to="/account">Đăng nhập để xem thanh toán</Link>
      </EmptyView>
    );
  }

  if (loading) {
    return <LoadingView label="Đang tải trạng thái thanh toán" />;
  }

  if (error || !payment) {
    return <ErrorView message={error ?? "Không tìm thấy thanh toán"} />;
  }

  return (
    <div className="page-stack">
      <Link to={`/account/orders/${payment.order_id}`} className="text-link">
        <ArrowLeft size={16} />
        Quay lại đơn hàng
      </Link>

      <section className={`payment-status-hero payment-status-hero--${payment.status}`}>
        <div className="payment-status-hero__icon">{statusIcon(payment.status)}</div>
        <div>
          <span className="eyebrow">Payment status</span>
          <h1>{statusLabel(payment.status)}</h1>
          <p>{payment.id}</p>
        </div>
        {payment.checkout_url ? (
          <a className="button button--primary" href={payment.checkout_url}>
            <ExternalLink size={17} />
            Mở cổng thanh toán
          </a>
        ) : null}
      </section>

      <section className="payment-status-layout">
        <div className="surface-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Details</span>
              <h2>Thông tin thanh toán</h2>
            </div>
            <span className={`status-pill${payment.status === "completed" ? " is-good" : ""}`}>
              {statusLabel(payment.status)}
            </span>
          </div>
          <div className="payment-detail-grid">
            <div>
              <span>Số tiền</span>
              <strong>{formatCurrency(payment.amount)}</strong>
            </div>
            <div>
              <span>Tổng đơn</span>
              <strong>{formatCurrency(payment.order_total)}</strong>
            </div>
            <div>
              <span>Đã ghi nhận</span>
              <strong>{formatCurrency(payment.net_paid_amount ?? payment.amount)}</strong>
            </div>
            <div>
              <span>Còn lại</span>
              <strong>{formatCurrency(payment.outstanding_amount ?? 0)}</strong>
            </div>
            <div>
              <span>Phương thức</span>
              <strong>{payment.payment_method}</strong>
            </div>
            <div>
              <span>Gateway</span>
              <strong>{payment.gateway_provider}</strong>
            </div>
            {payment.gateway_transaction_id ? (
              <div>
                <span>Mã giao dịch</span>
                <strong>{payment.gateway_transaction_id}</strong>
              </div>
            ) : null}
            {payment.failure_reason ? (
              <div>
                <span>Lý do lỗi</span>
                <strong>{payment.failure_reason}</strong>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="surface-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">History</span>
              <h2>Theo đơn hàng</h2>
            </div>
          </div>
          {history.length === 0 ? (
            <p className="muted-text">Chưa có lịch sử thanh toán khác.</p>
          ) : (
            <div className="payment-history-list">
              {history.map((item) => (
                <Link key={item.id} to={`/payments/${item.id}`} className="payment-history-card">
                  <div>
                    <strong>{item.transaction_type}</strong>
                    <p>{formatDate(item.created_at)}</p>
                  </div>
                  <span className={`status-pill${item.status === "completed" ? " is-good" : ""}`}>
                    {statusLabel(item.status)}
                  </span>
                  <strong>{formatCurrency(item.amount)}</strong>
                </Link>
              ))}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
