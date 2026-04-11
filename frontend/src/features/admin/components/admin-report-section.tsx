import { formatCurrency } from "@/utils/format";
import type { AdminOrderReport } from "@/types/api";

type AdminReportSectionProps = {
  isLoadingReport: boolean;
  report: AdminOrderReport | null;
  reportDays: number;
  reportWindowOptions: readonly number[];
  onSelectWindow: (days: number) => void;
};

export function AdminReportSection({
  isLoadingReport,
  report,
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
        </div>
      ) : null}
    </section>
  );
}
