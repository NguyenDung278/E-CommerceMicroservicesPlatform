import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ShopAccessoriesPage } from "../features/shop-accessories/ShopAccessoriesPage";
import { ShopFootwearPage } from "../features/shop-footwear/ShopFootwearPage";
import { ShopMenPage } from "../features/shop-men/ShopMenPage";
import { ShopWomenPage } from "../features/shop-women/ShopWomenPage";
import { ProductCard } from "../ui/product/ProductCard";
import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { Product } from "../types/api";
import "./CategoryPage.css";

export function CategoryPage() {
  const { categoryName = "" } = useParams();
  const category = decodeURIComponent(categoryName);

  if (category === "Shop Men") {
    return <ShopMenPage />;
  }

  if (category === "Shop Women") {
    return <ShopWomenPage />;
  }

  if (category === "Footwear") {
    return <ShopFootwearPage />;
  }

  if (category === "Accessories") {
    return <ShopAccessoriesPage />;
  }

  return <DefaultCategoryPage category={category} />;
}

function DefaultCategoryPage({ category }: { category: string }) {
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [feedback, setFeedback] = useState("");
  const [busyProductId, setBusyProductId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    void api
      .listProducts({ category, limit: 48, status: "active" })
      .then((response) => {
        if (active) {
          setProducts(response.data);
          setFeedback("");
        }
      })
      .catch((reason) => {
        if (active) {
          setFeedback(getErrorMessage(reason));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [category]);

  async function handleAddToCart(product: Product) {
    try {
      setBusyProductId(product.id);
      await addItem({
        product_id: product.id,
        quantity: 1
      });
      setFeedback(`${product.name} đã được thêm vào giỏ hàng.`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusyProductId("");
    }
  }


  return (
    <div className="page-stack category-page">

      <section className="content-section category-results-section">
        <div className="section-heading category-results-head">
          <div>
            <span className="section-kicker">Category Listing</span>
            <h2>Sản phẩm trong danh mục {category}</h2>
          </div>
          <span className="category-results-caption">
            {products.length > 0 ? `${products.length} sản phẩm active` : "Chưa có dữ liệu hiển thị"}
          </span>
        </div>

        {feedback ? (
          <div className={products.length > 0 ? "feedback feedback-info" : "feedback feedback-error"}>{feedback}</div>
        ) : null}

        {isLoading ? (
          <div className="page-state">Đang tải danh mục...</div>
        ) : products.length > 0 ? (
          <div className="product-grid category-product-grid">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                busy={busyProductId === product.id}
                onAddToCart={handleAddToCart}
                onBuyNow={(selected) =>
                  navigate("/checkout", {
                    state: {
                      directProduct: {
                        id: selected.id,
                        name: selected.name,
                        price: selected.price,
                        quantity: 1
                      }
                    }
                  })
                }
                product={product}
              />
            ))}
          </div>
        ) : feedback ? null : (
          <div className="empty-card category-empty-state">
            <span className="section-kicker">Empty Category</span>
            <strong>Danh mục này chưa có sản phẩm active.</strong>
            <span>Bạn có thể quay lại catalog để xem các mặt hàng khác đang hiển thị.</span>
            <Link className="text-link" to="/products">
              Quay lại catalog
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
