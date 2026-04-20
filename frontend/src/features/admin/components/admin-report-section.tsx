import { formatCurrency } from "@/utils/format";
import type { AdminOrderReport, ProductSearchAnalyticsSummary } from "@/types/api";

type AdminReportSectionProps = {
  isLoadingReport: boolean;
  report: AdminOrderReport | null;
  searchAnalytics: ProductSearchAnalyticsSummary | null;
  reportDays: number;
  reportWindowOptions: readonly number[];
  onSelectWindow: (days: number) => void;
};

export function AdminReportSection({
  isLoadingReport,
  report,
  searchAnalytics,
  reportDays,
  reportWindowOptions,
  onSelectWindow,
}: AdminReportSectionProps) {
  return (
    <section className="admin-console-panel admin-console-analytics-panel">
      <div className="section-heading">
        <div>
          <h2>Báo cáo kinh doanh</h2>
          <p className="history-subtle">
            Track revenue, order volume, and standout products across the selected time window.
          </p>
        </div>
        <div className="category-filter-row">
          {reportWindowOptions.map((days) => (
            <button
              className={reportDays === days ? "filter-chip filter-chip-active" : "filter-chip"}
              key={days}
              type="button"
              onClick={() => onSelectWindow(days)}
            >
              {days} ngày
            </button>
          ))}
        </div>
      </div>

      {isLoadingReport ? <div className="page-state">Đang tải báo cáo...</div> : null}

      {report ? (
        <div className="admin-console-split-grid">
          <div className="admin-console-subpanel">
            <h3>Top sản phẩm bán chạy</h3>
            <div className="history-grid">
              {report.top_products.map((item) => (
                <div className="history-item-preview" key={item.product_id}>
                  <strong>{item.name}</strong>
                  <span>Số lượng: {item.quantity}</span>
                  <span>Doanh thu: {formatCurrency(item.revenue)}</span>
                </div>
              ))}
              {report.top_products.length === 0 ? (
                <p className="history-empty">Chưa có dữ liệu top sản phẩm trong giai đoạn này.</p>
              ) : null}
            </div>
          </div>

          <div className="admin-console-subpanel">
            <h3>Phân bổ trạng thái đơn</h3>
            <div className="history-grid">
              {report.status_breakdown.map((item) => (
                <div className="history-item-preview" key={item.status}>
                  <strong>{item.status}</strong>
                  <span>Đơn: {item.orders}</span>
                  <span>Giá trị: {formatCurrency(item.revenue)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-console-subpanel">
            <h3>Top search queries</h3>
            <div className="history-grid">
              {searchAnalytics?.top_queries.map((item) => (
                <div className="history-item-preview" key={`${item.source}-${item.query}`}>
                  <strong>{item.query}</strong>
                  <span>Source: {item.source}</span>
                  <span>Requests: {item.request_count}</span>
                  <span>Avg results: {item.average_result_count.toFixed(1)}</span>
                </div>
              ))}
              {(searchAnalytics?.top_queries.length ?? 0) === 0 ? (
                <p className="history-empty">Chưa có dữ liệu search query đủ lớn trong giai đoạn này.</p>
              ) : null}
            </div>
          </div>

          <div className="admin-console-subpanel">
            <h3>Zero-result queries</h3>
            <div className="history-grid">
              {searchAnalytics?.zero_result_queries.map((item) => (
                <div className="history-item-preview" key={`${item.source}-${item.query}-zero`}>
                  <strong>{item.query}</strong>
                  <span>Source: {item.source}</span>
                  <span>Zero-result hits: {item.zero_result_count}</span>
                  <span>Last seen: {item.last_seen_at || "n/a"}</span>
                </div>
              ))}
              {(searchAnalytics?.zero_result_queries.length ?? 0) === 0 ? (
                <p className="history-empty">Không có truy vấn zero-result nổi bật trong giai đoạn này.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
