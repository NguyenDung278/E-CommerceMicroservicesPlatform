import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { useCart } from "@/features/cart/hooks/use-cart";
import {
  findHomeWorkbookCategoryPage,
  type HomeWorkbookCategoryPage,
} from "@/features/home/home-workbook";
import { useHomeWorkbook } from "@/features/home/use-home-workbook";
import { api, getErrorMessage, isHttpError } from "@/services/api";
import { isStorefrontAutoAddCategory } from "@/constants/storefront-navigation";
import type { Product, StorefrontCategoryPageData } from "@/types/api";

type UseStorefrontCategoryRouteResult = {
  busyProductId: string;
  content: ReturnType<typeof useHomeWorkbook>["content"];
  feedback: string;
  handleAddToCart: (product: Product) => Promise<void>;
  handleBuyNow: (product: Product) => Promise<void>;
  isLoading: boolean;
  products: Product[];
  storefrontPage: StorefrontCategoryPageData | null;
  workbookCategoryPage: HomeWorkbookCategoryPage | null;
};

export function useStorefrontCategoryRoute(identifier: string): UseStorefrontCategoryRouteResult {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const { content, status: workbookStatus } = useHomeWorkbook();
  const [storefrontPage, setStorefrontPage] = useState<StorefrontCategoryPageData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [feedback, setFeedback] = useState("");
  const [busyProductId, setBusyProductId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const workbookCategoryPage = content ? findHomeWorkbookCategoryPage(content, identifier) : null;

  useEffect(() => {
    let active = true;

    async function loadCategoryData() {
      setIsLoading(true);
      setStorefrontPage(null);
      setProducts([]);
      setFeedback("");

      try {
        const storefrontResponse = await api.getStorefrontCategoryPage(identifier);
        if (!active) {
          return;
        }

        setStorefrontPage(storefrontResponse.data);
        setProducts(storefrontResponse.data.featured_products.map((item) => item.product));
        setFeedback("");
      } catch (reason) {
        if (!active) {
          return;
        }

        if (!isHttpError(reason) || reason.status !== 404) {
          if (workbookCategoryPage) {
            setFeedback("");
            return;
          }

          setFeedback(getErrorMessage(reason));
          return;
        }

        if (workbookCategoryPage || workbookStatus === "loading" || workbookStatus === "refreshing") {
          setFeedback("");
          return;
        }

        try {
          const productResponse = await api.listProducts({
            category: identifier,
            limit: 48,
            status: "active",
          });
          if (!active) {
            return;
          }

          setProducts(productResponse.data);
          setFeedback("");
        } catch (fallbackReason) {
          if (active) {
            setFeedback(getErrorMessage(fallbackReason));
          }
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadCategoryData();

    return () => {
      active = false;
    };
  }, [identifier, workbookCategoryPage, workbookStatus]);

  async function handleAddToCart(product: Product) {
    try {
      setBusyProductId(product.id);
      await addItem({
        product_id: product.id,
        quantity: 1,
      });
      setFeedback(`${product.name} đã được thêm vào giỏ hàng.`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusyProductId("");
    }
  }

  async function handleBuyNow(product: Product) {
    const shouldSyncCart =
      isAuthenticated && isStorefrontAutoAddCategory(product.category || identifier);

    try {
      if (shouldSyncCart) {
        setBusyProductId(product.id);
        await addItem({
          product_id: product.id,
          quantity: 1,
        });
      }

      navigate("/checkout", {
        state: {
          directProduct: {
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
          },
        },
      });
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      if (shouldSyncCart) {
        setBusyProductId("");
      }
    }
  }

  return {
    busyProductId,
    content,
    feedback,
    handleAddToCart,
    handleBuyNow,
    isLoading,
    products,
    storefrontPage,
    workbookCategoryPage,
  };
}
