import type { AdminOverviewCard } from "./admin-console-types";

type AdminOverviewSectionProps = {
  feedback: string;
  isDevelopmentOperator: boolean;
  isSyncingWorkbook: boolean;
  overviewCards: AdminOverviewCard[];
  onRefreshDashboardData: () => void;
  onStartNewProductEntry: () => void;
  onSyncCollections: () => void;
};

export function AdminOverviewSection({
  feedback,
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
          <span className="section-kicker">Control Room</span>
          <h1>Operations Dashboard</h1>
          <p className="admin-console-hero-subtitle">
            Monitor revenue, orders, customers, offers, and product updates from a single working
            surface.
          </p>
        </div>

        <div className="admin-console-hero-actions">
          <button className="ghost-button" type="button" onClick={onRefreshDashboardData}>
            Refresh data
          </button>
          <button
            className="ghost-button"
            disabled={isSyncingWorkbook}
            type="button"
            onClick={onSyncCollections}
          >
            {isSyncingWorkbook ? "Updating collections..." : "Update collection pages"}
          </button>
          <button className="primary-button" type="button" onClick={onStartNewProductEntry}>
            + New product
          </button>
        </div>
      </section>

      {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

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
