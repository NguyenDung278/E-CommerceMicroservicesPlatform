import { useEffect, useState } from "react";

type ServiceStatus = {
  name: string;
  url: string;
  status: "loading" | "healthy" | "unreachable";
};

const gatewayBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost";

const servicesSeed: ServiceStatus[] = [
  { name: "Nginx", url: "http://localhost/health", status: "loading" },
  { name: "API Gateway", url: "http://localhost:8080/health", status: "loading" },
  { name: "User Service", url: "http://localhost:8081/health", status: "loading" },
  { name: "Product Service", url: "http://localhost:8082/health", status: "loading" },
  { name: "Cart Service", url: "http://localhost:8083/health", status: "loading" },
  { name: "Order Service", url: "http://localhost:8084/health", status: "loading" },
  { name: "Payment Service", url: "http://localhost:8085/health", status: "loading" },
  { name: "Notification Service", url: "http://localhost:8086/health", status: "loading" }
];

const productCards = [
  { title: "MacBook Pro", price: "$2,499", badge: "Hot sale" },
  { title: "Sony Headphones", price: "$349", badge: "Audio" },
  { title: "Mechanical Keyboard", price: "$189", badge: "Desk setup" }
];

const timeline = [
  "Khách truy cập catalog qua API Gateway",
  "Giỏ hàng lưu trên Redis để phản hồi nhanh",
  "Order Service xác thực sản phẩm qua gRPC",
  "Payment Service xử lý thanh toán và phát event",
  "Notification Service nhận event từ RabbitMQ"
];

export default function App() {
  const [services, setServices] = useState<ServiceStatus[]>(servicesSeed);

  useEffect(() => {
    let active = true;

    async function checkServices() {
      const next = await Promise.all(
        servicesSeed.map(async (service) => {
          try {
            const response = await fetch(service.url, { method: "GET" });
            return {
              ...service,
              status: (response.ok ? "healthy" : "unreachable") as ServiceStatus["status"]
            } satisfies ServiceStatus;
          } catch {
            return {
              ...service,
              status: "unreachable" as ServiceStatus["status"]
            } satisfies ServiceStatus;
          }
        })
      );

      if (active) {
        setServices(next);
      }
    }

    void checkServices();
    const timer = window.setInterval(() => void checkServices(), 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="page-shell">
      <div className="aurora aurora-left" />
      <div className="aurora aurora-right" />

      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Best-choice frontend demo</p>
          <h1>Giao diện minh hoạ cho hệ thống e-commerce microservices</h1>
          <p className="hero-text">
            Frontend này không cố giả làm một shop hoàn chỉnh. Nó được dựng để bạn nhìn thấy rõ
            mối quan hệ giữa trải nghiệm người dùng, API Gateway, các service nghiệp vụ, và lớp
            observability phía sau.
          </p>
          <div className="hero-actions">
            <a className="primary-btn" href={`${gatewayBase}/api/v1/products`} target="_blank" rel="noreferrer">
              Mở API sản phẩm
            </a>
            <a className="secondary-btn" href="http://localhost:3000" target="_blank" rel="noreferrer">
              Mở Grafana
            </a>
          </div>
        </div>

        <div className="hero-card">
          <div className="mini-label">Kiến trúc runtime</div>
          <div className="mini-flow">
            <span>Frontend</span>
            <span>Nginx</span>
            <span>Gateway</span>
            <span>Services</span>
          </div>
          <div className="mini-caption">
            HTTP bên ngoài, gRPC nội bộ, RabbitMQ cho event-driven flow, Prometheus/Grafana cho
            monitoring.
          </div>
        </div>
      </header>

      <main className="content-grid">
        <section className="panel panel-wide">
          <div className="section-head">
            <h2>Trải nghiệm mua hàng</h2>
            <span>Flow chính của ứng dụng</span>
          </div>

          <div className="catalog-grid">
            {productCards.map((product) => (
              <article className="product-card" key={product.title}>
                <div className="product-badge">{product.badge}</div>
                <h3>{product.title}</h3>
                <p className="product-copy">
                  Dữ liệu này tượng trưng cho catalog lấy từ `product-service` qua gateway.
                </p>
                <div className="product-footer">
                  <strong>{product.price}</strong>
                  <button type="button">Thêm vào giỏ</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <h2>Service health</h2>
            <span>Tự check định kỳ mỗi 15 giây</span>
          </div>

          <div className="status-list">
            {services.map((service) => (
              <div className="status-row" key={service.name}>
                <div>
                  <strong>{service.name}</strong>
                  <p>{service.url}</p>
                </div>
                <span className={`status-pill status-${service.status}`}>{service.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <h2>User journey</h2>
            <span>Backend flow dưới góc nhìn sản phẩm</span>
          </div>

          <ol className="timeline">
            {timeline.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="panel">
          <div className="section-head">
            <h2>Observability stack</h2>
            <span>Những gì bạn nên mở song song</span>
          </div>

          <div className="obs-grid">
            <a href="http://localhost:9090" target="_blank" rel="noreferrer">
              <strong>Prometheus</strong>
              <p>Xem metrics và alert rules</p>
            </a>
            <a href="http://localhost:3000" target="_blank" rel="noreferrer">
              <strong>Grafana</strong>
              <p>Xem dashboard tổng quan hệ thống</p>
            </a>
            <a href="http://localhost:16686" target="_blank" rel="noreferrer">
              <strong>Jaeger</strong>
              <p>Trace luồng request liên service</p>
            </a>
            <a href="http://localhost:15672" target="_blank" rel="noreferrer">
              <strong>RabbitMQ</strong>
              <p>Theo dõi event queue và bindings</p>
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
