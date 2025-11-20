import { useMemo } from "react";
import { Barcode, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { PosCard } from "./pos-card";
import { formatCurrency } from "./utils";
import type { Product, ProductCategory } from "./types";

export function ProductGallery({
  categories,
  products,
  activeCategoryId,
  searchTerm,
  onSearchTermChange,
  onCategorySelect,
  selectedProductIds,
  onToggleProduct
}: {
  categories: ProductCategory[];
  products: Product[];
  activeCategoryId: string;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onCategorySelect: (categoryId: string) => void;
  selectedProductIds: string[];
  onToggleProduct: (product: Product) => void;
}) {
  const selectedSet = useMemo(() => new Set(selectedProductIds), [selectedProductIds]);

  return (
    <PosCard
      title="Browse inventory"
      subtitle="Filter by category, search the catalog, and add items to the ticket"
      className="h-full"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition-colors dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-200">
              <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input
                className="flex-1 bg-transparent text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-500"
                placeholder="Search SKU, item, or description"
                value={searchTerm}
                onChange={(event) => onSearchTermChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onSearchTermChange("");
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200"
              aria-label="Scan barcode"
            >
              <Barcode className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((category) => {
              const Icon = category.icon;
              const isActive = category.id === activeCategoryId;
              return (
                <button
                  key={category.id}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    isActive
                      ? "border-sky-500/70 bg-sky-500/10 text-sky-600 shadow-sm dark:text-sky-200"
                      : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-700 dark:border-slate-800/70 dark:bg-slate-900/70 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200"
                  )}
                  onClick={() => onCategorySelect(category.id)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">{category.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
          {products.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800/60 dark:bg-slate-950/60 dark:text-slate-400">
              <p className="font-medium text-slate-600 dark:text-slate-200">No products found</p>
              <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">
                Try adjusting the category filter or updating your search term to find the right item.
              </p>
            </div>
          ) : null}
          {products.map((product) => {
            const isSelected = selectedSet.has(product.id);
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => onToggleProduct(product)}
                aria-pressed={isSelected}
                className={cn(
                  "group relative flex h-full flex-col gap-3 rounded-2xl border bg-gradient-to-b p-4 text-left text-sm text-slate-700 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:text-slate-200",
                  "from-white to-slate-50 dark:from-slate-950/70 dark:to-slate-950/40",
                  isSelected
                    ? "border-sky-500/80 shadow-lg shadow-sky-500/10"
                    : "border-slate-200/70 hover:border-slate-300 hover:shadow dark:border-slate-800/80 dark:hover:border-slate-700"
                )}
              >
                <span
                  className={cn(
                    "absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full border-2",
                    isSelected
                      ? "border-sky-500 bg-sky-500 text-white shadow"
                      : "border-slate-300 bg-white text-transparent dark:border-slate-700 dark:bg-slate-900"
                  )}
                  aria-hidden="true"
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
                <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xs uppercase tracking-wide text-slate-400 transition-colors group-hover:border-slate-300 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-500 dark:group-hover:border-slate-700">
                  {product.previewLabel ?? product.name.slice(0, 2)}
                </div>
                <div className="flex flex-1 flex-col gap-3">
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{product.name}</p>
                        {product.variant ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">{product.variant}</p>
                        ) : null}
                      </div>
                      <span className="text-sm font-semibold text-sky-600 dark:text-sky-300">
                        {formatCurrency(product.price)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
                      <span>{product.sku}</span>
                      <span className="text-emerald-600 dark:text-emerald-300">{product.stock} in stock</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </PosCard>
  );
}
