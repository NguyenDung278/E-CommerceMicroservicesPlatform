"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpDown,
  Heart,
  PackagePlus,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState, useTransition } from "react";

import { primaryNav, products } from "@/data/storefront";
import { buttonStyles } from "@/lib/button-styles";
import type {
  Availability,
  CatalogPreviewState,
  CatalogSortMode,
  Department,
  Product,
} from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  ProductCard,
  ProductCardSkeleton,
  SectionHeading,
} from "@/components/storefront-ui";
import { useStorefront } from "@/store/storefront-provider";

type DepartmentFilter = Department | "all";
type AvailabilityFilter = Availability | "all";

const sizeOptions = Array.from(
  new Set(products.flatMap((product) => product.sizes.map((size) => size.label))),
).sort();

const colorOptions = Array.from(
  new Set(
    products.flatMap((product) =>
      product.colors.map((color) => JSON.stringify(color)),
    ),
  ),
).map((color) => JSON.parse(color) as Product["colors"][number]);

const maxProductPrice = Math.max(...products.map((product) => product.price));

export function CatalogPage({
  initialDepartment = "all",
}: {
  initialDepartment?: DepartmentFilter;
}) {
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentFilter>(
    initialDepartment,
  );
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSize, setSelectedSize] = useState("all");
  const [selectedColor, setSelectedColor] = useState("all");
  const [selectedAvailability, setSelectedAvailability] =
    useState<AvailabilityFilter>("all");
  const [maxPrice, setMaxPrice] = useState(maxProductPrice);
  const [discountOnly, setDiscountOnly] = useState(false);
  const [sortMode, setSortMode] = useState<CatalogSortMode>("featured");
  const [previewState, setPreviewState] =
    useState<CatalogPreviewState>("live");
  const [searchValue, setSearchValue] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [isPending, startTransition] = useTransition();

  const liveRegionTimer = useRef<number | null>(null);
  const deferredSearch = useDeferredValue(searchValue);

  const {
    addToCart,
    toggleWishlist,
    wishlist,
    cartCount,
  } = useStorefront();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  function announce(message: string) {
    setAnnouncement(message);
    if (liveRegionTimer.current) {
      window.clearTimeout(liveRegionTimer.current);
    }
    liveRegionTimer.current = window.setTimeout(() => setAnnouncement(""), 2200);
  }

  useEffect(() => {
    return () => {
      if (liveRegionTimer.current) {
        window.clearTimeout(liveRegionTimer.current);
      }
    };
  }, []);

  const categoryOptions = Array.from(
    new Set(
      products
        .filter(
          (product) =>
            selectedDepartment === "all" || product.department === selectedDepartment,
        )
        .map((product) => product.category),
    ),
  ).sort();

  const activeCategory =
    selectedCategory !== "all" && categoryOptions.includes(selectedCategory)
      ? selectedCategory
      : "all";

  const normalizedSearch = deferredSearch.trim().toLowerCase();

  const filteredProducts = products.filter((product) => {
    const searchableContent = [
      product.name,
      product.subtitle,
      product.category,
      product.collection,
      product.brand,
      ...product.tags,
      ...product.materials,
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = !normalizedSearch || searchableContent.includes(normalizedSearch);
    const matchesDepartment =
      selectedDepartment === "all" || product.department === selectedDepartment;
    const matchesCategory =
      activeCategory === "all" || product.category === activeCategory;
    const matchesSize =
      selectedSize === "all" ||
      product.sizes.some((size) => size.label === selectedSize && size.inStock);
    const matchesColor =
      selectedColor === "all" ||
      product.colors.some((color) => color.name === selectedColor);
    const matchesAvailability =
      selectedAvailability === "all" ||
      product.availability === selectedAvailability;
    const matchesPrice = product.price <= maxPrice;
    const matchesDiscount = !discountOnly || Boolean(product.compareAtPrice);

    return (
      matchesSearch &&
      matchesDepartment &&
      matchesCategory &&
      matchesSize &&
      matchesColor &&
      matchesAvailability &&
      matchesPrice &&
      matchesDiscount
    );
  });

  const sortedProducts = [...filteredProducts].sort((left, right) => {
    switch (sortMode) {
      case "newest":
        return Number(right.newArrival) - Number(left.newArrival) || left.sortOrder - right.sortOrder;
      case "price-asc":
        return left.price - right.price;
      case "price-desc":
        return right.price - left.price;
      case "rating":
        return right.rating - left.rating;
      default:
        return left.sortOrder - right.sortOrder;
    }
  });

  const activeProduct = activeProductId
    ? products.find((product) => product.id === activeProductId) ?? null
    : null;

  function resetFilters() {
    setSelectedDepartment("all");
    setSelectedCategory("all");
    setSelectedSize("all");
    setSelectedColor("all");
    setSelectedAvailability("all");
    setMaxPrice(maxProductPrice);
    setDiscountOnly(false);
    setSearchValue("");
    setSortMode("featured");
    setPreviewState("live");
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveProductId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveProductId(null);
    const productId = String(event.active.id);
    const overId = String(event.over?.id ?? "");

    if (overId === "drop-cart") {
      addToCart({ productId });
      announce("Product dropped into bag");
    }

    if (overId === "drop-wishlist") {
      toggleWishlist(productId);
      announce(
        wishlist.includes(productId)
          ? "Product removed from saved items"
          : "Product saved to wishlist",
      );
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="shell section-spacing">
        <SectionHeading
          eyebrow="The curated archive"
          title="A tactile product grid with fast search, richer state handling and direct drag-and-drop actions."
          description="The design stays rooted in the Stitch reference: cream surfaces, serif product names and airy spacing. The UX layer is upgraded with debounced search, stronger filter behavior, clearer empty/error states and a floating stash dock."
        />

        <div className="mt-10 flex flex-col gap-4 rounded-[1.8rem] bg-surface-container-low p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div className="flex flex-1 items-center gap-3 rounded-full bg-background px-4 py-3">
            <Search className="h-4 w-4 text-outline" />
            <input
              value={searchValue}
              onChange={(event) =>
                startTransition(() => setSearchValue(event.target.value))
              }
              placeholder="Search pieces, materials, collections or mood..."
              aria-label="Search products"
              className="w-full bg-transparent text-sm text-on-surface placeholder:text-outline focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={cn(
                buttonStyles({ variant: "secondary", size: "sm" }),
                "lg:hidden",
              )}
              onClick={() => setIsFilterOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </button>

            <div className="flex items-center gap-2 rounded-full bg-background px-3 py-2">
              <ArrowUpDown className="h-4 w-4 text-outline" />
              <select
                value={sortMode}
                onChange={(event) =>
                  setSortMode(event.target.value as CatalogSortMode)
                }
                aria-label="Sort products"
                className="bg-transparent text-sm text-primary focus:outline-none"
              >
                <option value="featured">Featured</option>
                <option value="newest">Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Best Rated</option>
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-background px-3 py-2">
              <Sparkles className="h-4 w-4 text-outline" />
              <select
                value={previewState}
                onChange={(event) =>
                  setPreviewState(event.target.value as CatalogPreviewState)
                }
                aria-label="Preview catalog state"
                className="bg-transparent text-sm text-primary focus:outline-none"
              >
                <option value="live">Live data</option>
                <option value="loading">Skeleton preview</option>
                <option value="error">Error preview</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <CatalogFiltersPanel
              selectedDepartment={selectedDepartment}
              onDepartmentChange={setSelectedDepartment}
              selectedCategory={activeCategory}
              onCategoryChange={setSelectedCategory}
              selectedSize={selectedSize}
              onSizeChange={setSelectedSize}
              selectedColor={selectedColor}
              onColorChange={setSelectedColor}
              selectedAvailability={selectedAvailability}
              onAvailabilityChange={setSelectedAvailability}
              maxPrice={maxPrice}
              onMaxPriceChange={setMaxPrice}
              discountOnly={discountOnly}
              onDiscountOnlyChange={setDiscountOnly}
              onReset={resetFilters}
              categoryOptions={categoryOptions}
            />
          </aside>

          <section>
            <div className="mb-6 flex flex-col gap-4 rounded-[1.6rem] border border-outline-variant/35 bg-white/45 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm italic text-on-surface-variant">
                  Showing {sortedProducts.length} of {products.length} objects
                </p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-outline">
                  {selectedDepartment === "all"
                    ? "All departments"
                    : primaryNav.find((item) => item.department === selectedDepartment)?.label}
                  {isPending ? " · refreshing…" : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedDepartment !== "all" ? (
                  <Badge className="bg-primary px-3 py-1 text-on-primary">
                    {selectedDepartment}
                  </Badge>
                ) : null}
                {discountOnly ? <Badge>Discounted only</Badge> : null}
                {selectedAvailability !== "all" ? (
                  <Badge className="bg-surface-container-high text-primary">
                    {selectedAvailability}
                  </Badge>
                ) : null}
              </div>
            </div>

            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              collisionDetection={(args) => {
                const pointerMatches = pointerWithin(args);
                return pointerMatches.length ? pointerMatches : closestCenter(args);
              }}
            >
              {previewState === "error" ? (
                <ErrorState
                  title="The catalog preview is unavailable"
                  description="This is the demo error state wired into the UI so you can test failure handling without breaking the overall page shell."
                  onRetry={() => setPreviewState("live")}
                />
              ) : previewState === "loading" || isPending ? (
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <ProductCardSkeleton key={`skeleton-${index + 1}`} />
                  ))}
                </div>
              ) : sortedProducts.length ? (
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {sortedProducts.map((product) => (
                    <DraggableCatalogCard
                      key={product.id}
                      product={product}
                      wishlisted={wishlist.includes(product.id)}
                      onAddToCart={(selectedProduct) => {
                        addToCart({ productId: selectedProduct.id });
                        announce("Product added to bag");
                      }}
                      onToggleWishlist={(productId) => {
                        toggleWishlist(productId);
                        announce(
                          wishlist.includes(productId)
                            ? "Removed from wishlist"
                            : "Saved for later",
                        );
                      }}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No pieces matched that combination"
                  description="The empty state is fully wired. Try widening the price range, clearing a size filter, or searching for a broader material like wool, leather or ceramic."
                  action={
                    <Button onClick={resetFilters}>
                      Reset filters
                      <X className="h-4 w-4" />
                    </Button>
                  }
                />
              )}

              <FloatingDropDock cartCount={cartCount} wishlistCount={wishlist.length} />

              <DragOverlay>
                {activeProduct ? (
                  <div className="w-[280px] rotate-[-2deg] rounded-[1.75rem] bg-background/90 shadow-editorial backdrop-blur-xl">
                    <ProductCard product={activeProduct} className="pointer-events-none" />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </section>
        </div>

        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </main>

      <AnimatePresence>
        {isFilterOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-primary/20 backdrop-blur-sm lg:hidden"
          >
            <motion.div
              initial={{ y: 48 }}
              animate={{ y: 0 }}
              exit={{ y: 48 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-x-0 bottom-0 max-h-[88svh] overflow-y-auto rounded-t-[2rem] bg-background p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="eyebrow">Filters</p>
                  <h3 className="mt-2 font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                    Refine the archive
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Close filters"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low text-primary"
                  onClick={() => setIsFilterOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <CatalogFiltersPanel
                selectedDepartment={selectedDepartment}
                onDepartmentChange={setSelectedDepartment}
                selectedCategory={activeCategory}
                onCategoryChange={setSelectedCategory}
                selectedSize={selectedSize}
                onSizeChange={setSelectedSize}
                selectedColor={selectedColor}
                onColorChange={setSelectedColor}
                selectedAvailability={selectedAvailability}
                onAvailabilityChange={setSelectedAvailability}
                maxPrice={maxPrice}
                onMaxPriceChange={setMaxPrice}
                discountOnly={discountOnly}
                onDiscountOnlyChange={setDiscountOnly}
                onReset={() => {
                  resetFilters();
                  setIsFilterOpen(false);
                }}
                categoryOptions={categoryOptions}
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <SiteFooter />
    </>
  );
}

function DraggableCatalogCard({
  product,
  wishlisted,
  onAddToCart,
  onToggleWishlist,
}: {
  product: Product;
  wishlisted: boolean;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (productId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: product.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className="touch-none"
    >
      <ProductCard
        product={product}
        wishlisted={wishlisted}
        onAddToCart={onAddToCart}
        onToggleWishlist={onToggleWishlist}
        dragHandle={{
          ...listeners,
          ...attributes,
        }}
        isDragging={isDragging}
      />
    </div>
  );
}

function FloatingDropDock({
  cartCount,
  wishlistCount,
}: {
  cartCount: number;
  wishlistCount: number;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex gap-3 sm:inset-x-auto sm:right-6 sm:w-auto">
      <DropZone
        id="drop-wishlist"
        label="Wishlist"
        helper="Drop to save"
        count={wishlistCount}
        icon={<Heart className="h-4 w-4" />}
      />
      <DropZone
        id="drop-cart"
        label="Bag"
        helper="Drop to add"
        count={cartCount}
        icon={<PackagePlus className="h-4 w-4" />}
      />
    </div>
  );
}

function DropZone({
  id,
  label,
  helper,
  count,
  icon,
}: {
  id: string;
  label: string;
  helper: string;
  count: number;
  icon: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "pointer-events-auto flex min-w-[150px] flex-1 items-center gap-3 rounded-[1.35rem] border border-outline-variant/50 bg-background/92 px-4 py-3 shadow-editorial backdrop-blur-xl transition sm:flex-initial",
        isOver && "border-primary/40 bg-primary text-on-primary",
      )}
    >
      <div
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low text-primary",
          isOver && "bg-white/14 text-on-primary",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-[-0.01em]">{label}</p>
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.2em] text-outline",
            isOver && "text-on-primary/70",
          )}
        >
          {helper}
        </p>
      </div>
      <span
        className={cn(
          "ml-auto inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-[10px] font-bold text-on-primary",
          isOver && "bg-white text-primary",
        )}
      >
        {count}
      </span>
    </div>
  );
}

function CatalogFiltersPanel({
  selectedDepartment,
  onDepartmentChange,
  selectedCategory,
  onCategoryChange,
  selectedSize,
  onSizeChange,
  selectedColor,
  onColorChange,
  selectedAvailability,
  onAvailabilityChange,
  maxPrice,
  onMaxPriceChange,
  discountOnly,
  onDiscountOnlyChange,
  onReset,
  categoryOptions,
}: {
  selectedDepartment: DepartmentFilter;
  onDepartmentChange: (value: DepartmentFilter) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  selectedSize: string;
  onSizeChange: (value: string) => void;
  selectedColor: string;
  onColorChange: (value: string) => void;
  selectedAvailability: AvailabilityFilter;
  onAvailabilityChange: (value: AvailabilityFilter) => void;
  maxPrice: number;
  onMaxPriceChange: (value: number) => void;
  discountOnly: boolean;
  onDiscountOnlyChange: (value: boolean) => void;
  onReset: () => void;
  categoryOptions: string[];
}) {
  return (
    <div className="rounded-[1.75rem] bg-surface-container-low p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Refine</p>
          <h3 className="mt-2 font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
            Filter the mood
          </h3>
        </div>
        <button
          type="button"
          className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary"
          onClick={onReset}
        >
          Reset
        </button>
      </div>

      <div className="mt-8 space-y-8">
        <FilterBlock label="Departments">
          <div className="flex flex-wrap gap-2">
            {(["all", ...primaryNav.map((item) => item.department!)] as const).map((department) => (
              <button
                key={department}
                type="button"
                className={cn(
                  "rounded-full px-3 py-2 text-sm transition",
                  selectedDepartment === department
                    ? "bg-primary text-on-primary"
                    : "bg-background text-primary hover:bg-surface-container-high",
                )}
                onClick={() => onDepartmentChange(department)}
              >
                {department === "all" ? "All" : department}
              </button>
            ))}
          </div>
        </FilterBlock>

        <FilterBlock label="Category">
          <div className="flex flex-wrap gap-2">
            {["all", ...categoryOptions].map((category) => (
              <button
                key={category}
                type="button"
                className={cn(
                  "rounded-full px-3 py-2 text-sm transition",
                  selectedCategory === category
                    ? "bg-primary text-on-primary"
                    : "bg-background text-primary hover:bg-surface-container-high",
                )}
                onClick={() => onCategoryChange(category)}
              >
                {category === "all" ? "All categories" : category}
              </button>
            ))}
          </div>
        </FilterBlock>

        <FilterBlock label="Size">
          <div className="grid grid-cols-4 gap-2">
            <FilterSquare
              label="All"
              active={selectedSize === "all"}
              onClick={() => onSizeChange("all")}
            />
            {sizeOptions.map((size) => (
              <FilterSquare
                key={size}
                label={size}
                active={selectedSize === size}
                onClick={() => onSizeChange(size)}
              />
            ))}
          </div>
        </FilterBlock>

        <FilterBlock label="Color">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={cn(
                "rounded-full border px-3 py-2 text-sm transition",
                selectedColor === "all"
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant bg-background text-primary hover:border-primary/40",
              )}
              onClick={() => onColorChange("all")}
            >
              All
            </button>
            {colorOptions.map((color) => (
              <button
                key={color.name}
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
                  selectedColor === color.name
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline-variant bg-background text-primary hover:border-primary/40",
                )}
                onClick={() => onColorChange(color.name)}
              >
                <span
                  className="h-4 w-4 rounded-full border border-white/30"
                  style={{ backgroundColor: color.swatch }}
                />
                {color.name}
              </button>
            ))}
          </div>
        </FilterBlock>

        <FilterBlock label="Availability">
          <div className="space-y-2">
            {[
              { value: "all", label: "All stock states" },
              { value: "in-stock", label: "In stock" },
              { value: "low-stock", label: "Low stock" },
              { value: "pre-order", label: "Pre-order" },
              { value: "sold-out", label: "Sold out" },
            ].map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 rounded-2xl bg-background px-4 py-3"
              >
                <input
                  checked={selectedAvailability === option.value}
                  type="radio"
                  name="availability"
                  className="accent-primary"
                  onChange={() => onAvailabilityChange(option.value as AvailabilityFilter)}
                />
                <span className="text-sm text-primary">{option.label}</span>
              </label>
            ))}
          </div>
        </FilterBlock>

        <FilterBlock label="Price ceiling">
          <input
            type="range"
            min={150}
            max={maxProductPrice}
            step={10}
            value={maxPrice}
            className="w-full accent-primary"
            onChange={(event) => onMaxPriceChange(Number(event.target.value))}
          />
          <div className="mt-3 flex items-center justify-between text-sm text-on-surface-variant">
            <span>$150</span>
            <span>{formatCurrency(maxPrice)}</span>
          </div>
        </FilterBlock>

        <label className="flex items-center gap-3 rounded-[1.35rem] bg-background px-4 py-4 text-sm text-primary">
          <input
            checked={discountOnly}
            type="checkbox"
            className="accent-primary"
            onChange={(event) => onDiscountOnlyChange(event.target.checked)}
          />
          Only show discounted items
        </label>
      </div>
    </div>
  );
}

function FilterBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.26em] text-outline">
        {label}
      </p>
      {children}
    </section>
  );
}

function FilterSquare({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-2xl border px-3 py-3 text-sm transition",
        active
          ? "border-primary bg-primary text-on-primary"
          : "border-outline-variant bg-background text-primary hover:border-primary/40",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
