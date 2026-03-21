import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ProductCard } from "../components/ProductCard";
import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { Product } from "../types/api";

export function CategoryPage() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { categoryName = "" } = useParams();
  const category = decodeURIComponent(categoryName);

  const [products, setProducts] = useState<Product[]>([]);
  const [feedback, setFeedback] = useState("");
  const [busyProductId, setBusyProductId] = useState("");

  useEffect(() => {
    let active = true;

    void api
      .listProducts({ category, limit: 48, status: "active" })
      .then((response) => {
        if (active) {
          setProducts(response.data);
        }
      })
      .catch((reason) => {
        if (active) {
          setFeedback(getErrorMessage(reason));
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
    <div className="page-stack">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Danh mục</span>
            <h1>{category}</h1>
          </div>
        </div>

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

        <div className="product-grid">
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
      </section>
    </div>
  );
}
