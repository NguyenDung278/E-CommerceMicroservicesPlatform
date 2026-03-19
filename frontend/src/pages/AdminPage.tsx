import { useEffect, useState, type FormEvent } from "react";

import { FormField } from "../components/FormField";
import { ProductCard } from "../components/ProductCard";
import { useAuth } from "../hooks/useAuth";
import { api, getErrorMessage } from "../lib/api";
import type { Product } from "../types/api";
import { sanitizeMultiline, sanitizeText, sanitizeUrl, toPositiveFloat } from "../utils/sanitize";
import { validateProduct } from "../utils/validation";

export function AdminPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [feedback, setFeedback] = useState("");
  const [busyProductId, setBusyProductId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingProductId, setEditingProductId] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    stock: "0",
    category: "",
    imageUrl: ""
  });

  useEffect(() => {
    void loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const response = await api.listProducts();
      setProducts(response.data);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setFeedback("Bạn cần JWT admin để tạo sản phẩm.");
      return;
    }

    const payload = {
      name: sanitizeText(form.name),
      description: sanitizeMultiline(form.description),
      price: toPositiveFloat(form.price),
      stock: Number.parseInt(form.stock, 10),
      category: sanitizeText(form.category),
      image_url: sanitizeUrl(form.imageUrl)
    };

    const errors = validateProduct({
      name: payload.name,
      description: payload.description,
      price: form.price,
      stock: form.stock,
      imageUrl: form.imageUrl
    });
    if (errors.length > 0) {
      setFeedback(errors.join(" "));
      return;
    }

    try {
      setIsCreating(true);
      if (editingProductId) {
        const response = await api.updateProduct(token, editingProductId, payload);
        setProducts((current) =>
          current.map((product) => (product.id === editingProductId ? response.data : product))
        );
        setFeedback(`Đã cập nhật sản phẩm ${response.data.name}.`);
      } else {
        const response = await api.createProduct(token, payload);
        setProducts((current) => [response.data, ...current]);
        setFeedback(`Đã tạo sản phẩm ${response.data.name}.`);
      }
      setForm({
        name: "",
        description: "",
        price: "",
        stock: "0",
        category: "",
        imageUrl: ""
      });
      setEditingProductId("");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsCreating(false);
    }
  }

  function handleEdit(product: Product) {
    setEditingProductId(product.id);
    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      stock: String(product.stock),
      category: product.category,
      imageUrl: product.image_url
    });
    setFeedback(`Đang sửa sản phẩm ${product.name}.`);
  }

  async function handleDelete(product: Product) {
    if (!token) {
      setFeedback("Bạn cần JWT admin để xóa sản phẩm.");
      return;
    }

    try {
      setBusyProductId(product.id);
      await api.deleteProduct(token, product.id);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setFeedback(`Đã xóa sản phẩm ${product.name}.`);
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
            <span className="section-kicker">Admin</span>
            <h1>Quản lý catalog</h1>
          </div>
        </div>

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

        <div className="two-column-grid">
          <form className="card" onSubmit={handleCreate}>
            <h2>{editingProductId ? "Chỉnh sửa sản phẩm" : "Tạo sản phẩm mới"}</h2>
            <FormField htmlFor="admin-product-name" label="Tên sản phẩm">
              <input
                id="admin-product-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </FormField>
            <FormField htmlFor="admin-product-description" label="Mô tả">
              <textarea
                id="admin-product-description"
                rows={4}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </FormField>
            <div className="inline-grid">
              <FormField htmlFor="admin-product-price" label="Giá">
                <input
                  id="admin-product-price"
                  min="0"
                  step="0.01"
                  type="number"
                  value={form.price}
                  onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                />
              </FormField>
              <FormField htmlFor="admin-product-stock" label="Tồn kho">
                <input
                  id="admin-product-stock"
                  min="0"
                  step="1"
                  type="number"
                  value={form.stock}
                  onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))}
                />
              </FormField>
            </div>
            <div className="inline-grid">
              <FormField htmlFor="admin-product-category" label="Danh mục">
                <input
                  id="admin-product-category"
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, category: event.target.value }))
                  }
                />
              </FormField>
              <FormField htmlFor="admin-product-image-url" label="Ảnh URL">
                <input
                  id="admin-product-image-url"
                  type="url"
                  value={form.imageUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, imageUrl: event.target.value }))
                  }
                />
              </FormField>
            </div>
            <button className="primary-button" disabled={isCreating} type="submit">
              {isCreating ? "Đang xử lý..." : editingProductId ? "Lưu cập nhật" : "Tạo sản phẩm"}
            </button>
            {editingProductId ? (
              <button
                className="ghost-button admin-cancel-button"
                onClick={() => {
                  setEditingProductId("");
                  setForm({
                    name: "",
                    description: "",
                    price: "",
                    stock: "0",
                    category: "",
                    imageUrl: ""
                  });
                }}
                type="button"
              >
                Hủy sửa
              </button>
            ) : null}
          </form>

          <div className="card">
            <h2>Danh sách sản phẩm</h2>
            <div className="product-grid product-grid-admin">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  adminAction={{
                    label: editingProductId === product.id ? "Đang sửa" : "Sửa sản phẩm",
                    onClick: handleEdit,
                    busy: false
                  }}
                  secondaryAdminAction={{
                    label: "Xóa sản phẩm",
                    onClick: handleDelete,
                    danger: true,
                    busy: busyProductId === product.id
                  }}
                  product={product}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
