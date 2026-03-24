import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <span className={styles.eyebrow}>ND Shop Client</span>
        <div className={styles.hero}>
          <div className={styles.intro}>
            <h1>Next.js client baseline is ready for the MCP-driven UI build.</h1>
            <p>
              This standalone app will host the new storefront and internal
              workflows while keeping the legacy <code>frontend/</code> app
              untouched during migration.
            </p>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelSection}>
              <span className={styles.panelLabel}>Status</span>
              <strong>Initialized</strong>
              <p>App Router, TypeScript, ESLint, and src-based structure are in place.</p>
            </div>
            <div className={styles.panelSection}>
              <span className={styles.panelLabel}>Next step</span>
              <strong>Map Stitch / MCP design</strong>
              <p>
                We can now port your prepared design into reusable Next.js
                components and route groups.
              </p>
            </div>
          </div>
        </div>
        <div className={styles.ctas}>
          <a
            className={styles.primary}
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Next.js Docs
          </a>
          <a className={styles.secondary} href="/api/health">
            Planned Health Route
          </a>
        </div>
      </main>
    </div>
  );
}
