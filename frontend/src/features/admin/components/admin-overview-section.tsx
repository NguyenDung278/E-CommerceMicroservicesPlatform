import type { AdminOverviewCard } from "./admin-console-types";

type AdminOverviewSectionProps = {
  capabilities: string[];
  isDevelopmentOperator: boolean;
  isSyncingWorkbook: boolean;
  overviewCards: AdminOverviewCard[];
  onRefreshDashboardData: () => void;
  onStartNewProductEntry: () => void;
  onSyncCollections: () => void;
};

export function AdminOverviewSection({
  capabilities,
  isDevelopmentOperator,
  isSyncingWorkbook,
  overviewCards,
  onRefreshDashboardData,
  onStartNewProductEntry,
  onSyncCollections,
}: AdminOverviewSectionProps) {
  return (
    <>
      {isDevelopmentOperator ? (
        <div className="admin-console-alert-strip" role="note">
          <span className="admin-console-alert-icon" aria-hidden="true">
            !
          </span>
          <span>Preview workspace active</span>
        </div>
      ) : null}

      <section className="admin-console-hero" id="admin-overview">
        <div className="admin-console-hero-copy">
          <span className="section-kicker">ND Admin</span>
          <h1>Backoffice điều hành sản phẩm, thanh toán và tăng trưởng.</h1>
          <p className="admin-console-hero-subtitle">
            Một màn hình để thêm sản phẩm mới, theo dõi đơn đã thanh toán thành công, kiểm tra
            refund queue, đo doanh thu, và xem analytics hành vi tìm kiếm.
          </p>
          <div className="admin-console-capability-list">
            {capabilities.map((item) => (
              <span className="admin-console-capability-pill" key={item}>
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="admin-console-hero-actions">
          <button className="ghost-button" type="button" onClick={onRefreshDashboardData}>
            Làm mới dữ liệu
          </button>
          <button
            className="ghost-button"
            disabled={isSyncingWorkbook}
            type="button"
            onClick={onSyncCollections}
          >
            {isSyncingWorkbook ? "Đang đồng bộ collection..." : "Đồng bộ collection"}
          </button>
          <button className="primary-button" type="button" onClick={onStartNewProductEntry}>
            + Thêm sản phẩm
          </button>
        </div>
      </section>

      <div className="admin-console-stats">
        {overviewCards.map((card) => (
          <article className="admin-console-stat-card" key={card.label}>
            <span className="admin-console-stat-label">{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.caption}</p>
          </article>
        ))}
      </div>
    </>
  );
}
