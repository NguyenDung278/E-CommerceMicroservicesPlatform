import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyView, ErrorView, LoadingView } from "../components/status-view";
import { listUserReturns } from "../services/order-service";
import { useAuth } from "../state/auth-context";
import type { ApiMeta, ReturnRequest } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";
import { isPositiveStatus, statusLabel } from "../utils/status";

const returnStatusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "requested", label: "Đã gửi yêu cầu" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Từ chối" },
  { value: "received", label: "Đã nhận hàng trả" },
  { value: "refund_pending", label: "Đang hoàn tiền" },
  { value: "refunded", label: "Đã hoàn tiền" },
];

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function ReturnsListPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get("page"));
  const status = searchParams.get("status") ?? "";
  const query = searchParams.get("query") ?? "";
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [queryDraft, setQueryDraft] = useState(query);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => {
    const limit = meta?.limit ?? 10;
    const total = meta?.total ?? returns.length;
    return Math.max(1, Math.ceil(total / limit));
  }, [meta, returns.length]);

  useEffect(() => {
    setQueryDraft(query);
  }, [query]);

  useEffect(() => {
    let active = true;

    async function loadReturns() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await listUserReturns(token, {
          page,
          limit: 10,
          status: status || undefined,
          query: query || undefined,
        });

        if (active) {
          setReturns(response.data);
          setMeta(response.meta ?? null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Không tải được danh sách trả hàng");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadReturns();

    return () => {
      active = false;
    };
  }, [page, query, status, token]);

  function setFilter(key: string, value: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("page");
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilter("query", queryDraft.trim());
  }

  function goToPage(nextPage: number) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextPage <= 1) {
        next.delete("page");
      } else {
        next.set("page", String(nextPage));
      }
      return next;
    });
  }

  if (!token) {
    return (
      <EmptyView title="Cần đăng nhập">
        <Link to="/account">Đăng nhập để xem yêu cầu trả hàng</Link>
      </EmptyView>
    );
  }

  if (loading) {
    return <LoadingView label="Đang tải yêu cầu trả hàng" />;
  }

  if (error) {
    return <ErrorView message={error} />;
  }

  return (
    <div className="page-stack">
      <Link to="/account" className="text-link">
        <ArrowLeft size={16} />
        Quay lại tài khoản
      </Link>

      <section className="order-detail-hero">
        <div>
          <span className="eyebrow">Returns</span>
          <h1>Trả hàng/hoàn tiền</h1>
          <p>Theo dõi toàn bộ yêu cầu trả hàng của tài khoản.</p>
        </div>
        <RotateCcw size={28} />
      </section>

      <section className="surface-section">
        <div className="return-filter-bar">
          <form className="category-landing__search" onSubmit={submitSearch}>
            <Search size={17} />
            <input
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="Tìm theo mã return hoặc đơn hàng"
            />
            <button type="submit">Tìm</button>
          </form>
          <select value={status} onChange={(event) => setFilter("status", event.target.value)}>
            {returnStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {returns.length === 0 ? (
          <EmptyView title="Chưa có yêu cầu trả hàng" />
        ) : (
          <div className="return-history">
            {returns.map((returnRequest) => (
              <article key={returnRequest.id} className="return-history-card return-list-card">
                <div className="return-history-card__heading">
                  <div>
                    <Link to={`/account/returns/${returnRequest.id}`}>
                      <strong>{returnRequest.id}</strong>
                    </Link>
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
                <div className="return-card-meta">
                  <span>Đơn: {returnRequest.order_id}</span>
                  <span>{formatDate(returnRequest.created_at)}</span>
                  <span>{returnRequest.items.length} sản phẩm</span>
                  {typeof returnRequest.refund_amount === "number" ? (
                    <strong>{formatCurrency(returnRequest.refund_amount)}</strong>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="pagination-row pagination-row--catalog">
          <button
            className="button button--secondary"
            type="button"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            Trang trước
          </button>
          <span className="pagination-row__status">
            Trang {page} / {totalPages}
          </span>
          <button
            className="button button--secondary"
            type="button"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Trang sau
          </button>
        </div>
      </section>
    </div>
  );
}
