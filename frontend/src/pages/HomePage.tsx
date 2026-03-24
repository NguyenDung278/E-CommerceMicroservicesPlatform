import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, getErrorMessage } from "../lib/api";
import type { Product } from "../types/api";
import { formatCurrency } from "../utils/format";

const fallbackEditorialImages = {
  hero: "https://lh3.googleusercontent.com/aida-public/AB6AXuCPKv1CtBwPM413euox0uKnxmUXjsuyZFpFIvDMoW9tfefpHVd_8BFtHSEnUjm5XAQu4WMkS8vgS56v7kIQYWar2OBBpzOurqNCin2KoM1hYEZHvbpagIiz8m2nCidCAiRbDaeJLBNHxra37cwt7QEG3UlOcKbs-W6WuTDZj3qjg9hWIs2YR26l-ijHVnj8ck1-5NDhyVXXQECwDKQJs1i-nYT93ubM2EFutXuxPWxUHWH2o2Zhbz_naP2SXRRL50t8HcB8sUf5LXiX",
  studio: "https://lh3.googleusercontent.com/aida-public/AB6AXuA-QCiHmdCOxRlVT1rixfgiaLjtOyUpf_qCwS4N8rEMGTTVyJxqkHxQ1iiUeTIIjM9C_MgASpIzwLXa8wLI7ck0F5p1lc6AA6MfKkb3aN_Nbw5AhWsU9lBPxRcNlN7vOcvcId55iSoZRYNe8TCXUI_PC9zSeiPi6-O2ojrYX1RkopzPM8W9xTFEi3rS1s2qZ8IvVBPlgiJak9SR8Bp7wD71RSztHJCzs3MKTW0TNUGEn5sxJF68kLn8MLi1Kcp6ODrKfOGHNtCZKygx",
  men: "https://lh3.googleusercontent.com/aida-public/AB6AXuCyUfebOMONTnvYr9ZpAON5r2sqH9cixvFEI4IUO1HgtLokw0DocOKis15vSsJ14j6mnx1QrXMXJyDrzK64DrNUI1kc34lTyj4aIPfoodV3MFa0JLPFNdllb_6HgGOigtKyydUohURWyjMOQURKHAk5z02a5vuIH_t821X1vUIusV9VajR3V14-QiTAt7WCragHu_ErX2cBuxj6cZyi0qHNw-tRhFozQO02eRzXwXB3GyXDgg6tVkt9BgTiuPHfPlE9ZdYH2sNodvYW",
  women: "https://lh3.googleusercontent.com/aida-public/AB6AXuBfeL88OBqW4Ue3Wr45J2UYNHHoz1V3GIYVT6BS47pFs4Ts1ZtnuMaaioY1y7Je7oqhcYL8DLZR8KKa3pevzh2EOXaCo_M9xAJhHsGvxIeawRZyLgrBDcTQKiMMTdBJfJv4EDGj_ST1SAVOcoV-DlbA_GhmqAhboruBHvNNSjrLZExknF7AnbpG7f-BfdcG52rKGirTBwXdWoxBIaSFpozclIZ4oni5B5b2Xn7rzo1a13KiUEDsW12kfxNX2AN9xi_LfBWp-G8i2o7n",
  footwear: "https://lh3.googleusercontent.com/aida-public/AB6AXuC35EijN08hEhyXUNWU2WpmdXA-xKjXvVdQOkMB4J5Rt7XVw2ILNt27Jt92PUK2lOZLOyi-wwd64M20h4a_trllHLaecxpEhm3cRJskDeuyLTz248X3saxiF9Xx7qHWTTV-Q_6G58RaZiu-8vk3yYYOiP5aflLpGRjTe6yi6EtaoQKcBvHljgI4ItMv4FXnUPfGAYVnlVFrxYoDYB6LIE9tpXNeScpgugQTJzhp_icbkXy4Ay2kMR5-SI0rGXdV2RyT8p-AYS9ZdH9w",
  accessories: "https://lh3.googleusercontent.com/aida-public/AB6AXuAtpa0mJyKNICckH1wefUZTbwZo2Cg73toQg0p8Gs8HN84jU1dorhR-2jnXY-oDpZbRJQTYU6z2RuFiaqR_vx_BDTT30cUs2PtZGI-fdDfLZlrhkBB-gyED-FFOC2t0Dwpfe2t6mBWGbfA-f4EbYvH1QV61hKuBF7UfI-b_NBaRjm_A3LejyFwwwvM-2t-K-zHQWiYcOHHbplLjNpn3jDEO4siwrnpdkAaVJDh28LrLN0qGfUWRCFcXRzKfNM5VvnVj7r3R8bZe5FpI"
};

const categoryDefinitions = [
  {
    label: "Shop Men",
    navLabel: "Men",
    aliases: ["Shop Men", "Men"],
    imageUrl: fallbackEditorialImages.men,
    cta: "Discover the tailoring"
  },
  {
    label: "Shop Women",
    navLabel: "Women",
    aliases: ["Shop Women", "Women"],
    imageUrl: fallbackEditorialImages.women,
    cta: "View the edit"
  },
  {
    label: "The Footwear Edit",
    navLabel: "Footwear",
    aliases: ["Footwear", "Shoes"],
    imageUrl: fallbackEditorialImages.footwear,
    cta: "Shop shoes"
  },
  {
    label: "Curated Accessories",
    navLabel: "Accessories",
    aliases: ["Accessories"],
    imageUrl: fallbackEditorialImages.accessories,
    cta: "Explore"
  }
];

function matchesCategory(product: Product, aliases: string[]) {
  const productCategory = product.category.trim().toLowerCase();
  return aliases.some((alias) => productCategory === alias.trim().toLowerCase());
}

export function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;

    void api
      .listProducts({ status: "active", limit: 24 })
      .then((response) => {
        if (!active) {
          return;
        }

        setProducts(response.data);
        setFeedback("");
      })
      .catch((reason) => {
        if (active) {
          setFeedback(getErrorMessage(reason));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const heroProduct = products[0] ?? null;
  const heroImage = fallbackEditorialImages.hero;
  const featuredProducts = [
    products.find((product) => product.name === "Forest Wool Overcoat"),
    products.find((product) => product.name === "Alpine Commando Boot") ??
      products.find((product) => product.name === "Explorer Leather Boots"),
    products.find((product) => product.name === "Stone Compass Scarf") ??
      products.find((product) => product.name === "Indigo Utility Belt"),
    products.find((product) => product.name === "Softlight Merino Cardigan") ??
      products.find((product) => product.name === "Warm Cream Knit Dress")
  ].filter(Boolean) as Product[];
  const categoryCards = categoryDefinitions.map((category, index) => {
    const categoryProducts = products.filter((product) => matchesCategory(product, category.aliases));
    const featuredProduct = categoryProducts[0] ?? null;

    return {
      ...category,
      href: `/categories/${encodeURIComponent(category.aliases[0])}`,
      count: categoryProducts.length,
      featuredProduct,
      imageUrl: category.imageUrl,
      subtitle:
        featuredProduct?.name ??
        [
          "Sophisticated tailoring in deep forest tones.",
          "Fluid silhouettes and warm cream layers.",
          "Handcrafted performance for the modern explorer.",
          "Finishing pieces for the atelier wardrobe."
        ][index]
    };
  });
  const metrics = [
    { value: "0.4s", label: "Inventory Latency" },
    { value: "100%", label: "Atelier Sourcing" }
  ];

  return (
    <div className="page-stack home-editorial-page">
      <section className="home-editorial-hero">
        <div className="home-editorial-hero-media">
          <img alt={heroProduct?.name || "Forest editorial backdrop"} src={heroImage} />
        </div>
        <div className="home-editorial-hero-overlay" />

        <div className="home-editorial-hero-inner">
          <div className="home-editorial-hero-copy">
            <span className="home-editorial-section-label">Winter 2024 Collection</span>
            <h1>Forest &amp; Hearth</h1>
            <p>
              A tactile study of survival and comfort. Rooted in deep forest textures and the warmth of a mountain
              refuge.
            </p>

            <div className="hero-actions">
              <Link className="primary-link" to="/products">
                Explore Collection
              </Link>
              <Link className="secondary-link" to="/products">
                View Lookbook
              </Link>
            </div>
          </div>

          <aside className="home-editorial-hero-quote">
            <span>The Technical Edge</span>
            <p>"Microservice-driven inventory ensures real-time availability of limited atelier pieces."</p>
          </aside>
        </div>
      </section>

      <section className="home-editorial-category-section">
        <div className="home-editorial-category-grid">
          {categoryCards.map((item, index) => (
            <Link className={`home-editorial-category-card home-editorial-category-card-${index + 1}`} key={item.label} to={item.href}>
              <img alt={item.label} src={item.imageUrl} />
              <div className="home-editorial-category-scrim" />
              <div className="home-editorial-category-content">
                <h2>{item.label}</h2>
                {index === 2 ? <p>{item.subtitle}</p> : null}
                <span>{item.cta}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-editorial-callout">
        <div className="home-editorial-callout-inner">
          <div className="home-editorial-callout-copy">
            <span className="home-editorial-section-label">ND Atelier</span>
            <h2>
              Digital Precision,
              <br />
              Analogue Soul.
            </h2>
            <p>
              Beyond the silhouette lies a sophisticated technological core. Our inventory architecture keeps each
              piece in the Digital Atelier synced in real time, connecting backend precision with the quieter visual
              rhythm from Stitch.
            </p>

            <div className="home-editorial-callout-metrics">
              {metrics.map((item) => (
                <article className="home-editorial-callout-metric" key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </article>
              ))}
            </div>
          </div>

          <div className="home-editorial-callout-media">
            <img alt="Studio atelier process" src={fallbackEditorialImages.studio} />
          </div>
        </div>
      </section>

      <section className="home-editorial-featured-section">
        <div className="home-editorial-featured-head">
          <div>
            <span className="home-editorial-section-label home-editorial-section-label-accent">New Arrivals</span>
            <h2>Seasonal Essentials</h2>
          </div>
          <div className="home-editorial-arrow-group" aria-hidden="true">
            <span className="home-editorial-arrow-button">‹</span>
            <span className="home-editorial-arrow-button">›</span>
          </div>
        </div>

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

        {featuredProducts.length > 0 ? (
          <div className="home-editorial-product-grid">
            {featuredProducts.map((product) => (
              <article className="home-editorial-product-card" key={product.id}>
                <Link className="home-editorial-product-link" to={`/products/${product.id}`}>
                  <div className="home-editorial-product-media">
                    <img
                      alt={product.name}
                      src={product.image_urls[0] ?? product.image_url ?? fallbackEditorialImages.hero}
                    />
                  </div>
                  <div className="home-editorial-product-copy">
                    <p>{product.category || product.brand || "Archive"}</p>
                    <div className="home-editorial-product-row">
                      <h3>{product.name}</h3>
                      <span>{formatCurrency(product.price)}</span>
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-card">
            <strong>Danh mục đang chờ sản phẩm active.</strong>
            <span>Mình đã giữ sẵn đúng bố cục home-editorial, chỉ cần backend có thêm dữ liệu để lấp đầy product rail.</span>
          </div>
        )}
      </section>
    </div>
  );
}
