import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { PosCard } from "./pos-card";
import { formatCurrency } from "./utils";
import type { Product, ProductCategory } from "./types";

export function ProductGallery({
  categories,
  products,
  activeCategoryId
}: {
  categories: ProductCategory[];
  products: Product[];
  activeCategoryId: string;
}) {
  return (
    <PosCard
      title="Browse inventory"
      subtitle="Filter by category, search the catalog, and add items to the ticket"
      className="h-full"
      action={<button className="text-xs text-sky-300 hover:text-sky-200">See all inventory</button>}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              className="flex-1 bg-transparent placeholder:text-slate-500 focus:outline-none"
              placeholder="Search SKU, item, or description"
            />
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((category) => {
              const Icon = category.icon;
              const isActive = category.id === activeCategoryId;
              return (
                <button
                  key={category.id}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition",
                    isActive
                      ? "border-sky-500/60 bg-sky-500/10 text-sky-200 shadow"
                      : "border-slate-800/70 bg-slate-900/70 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">{category.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
          {products.map((product) => (
            <article
              key={product.id}
              className="flex h-full flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 text-sm text-slate-200 transition hover:border-slate-700"
            >
              <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-slate-800/70 bg-slate-900/60 text-xs uppercase tracking-wide text-slate-500">
                {product.previewLabel ?? product.name.slice(0, 2)}
              </div>
              <div className="flex flex-1 flex-col gap-3">
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{product.name}</p>
                      {product.variant ? <p className="text-xs text-slate-400">{product.variant}</p> : null}
                    </div>
                    <span className="text-sm font-semibold text-sky-300">{formatCurrency(product.price)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
                    <span>{product.sku}</span>
                    <span className="text-emerald-300">{product.stock} in stock</span>
                  </div>
                  {product.highlight ? (
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
                      {product.highlight}
                    </span>
                  ) : null}
                </div>
                <button className="mt-auto flex items-center justify-center rounded-lg border border-slate-800/80 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-sky-500/60 hover:text-sky-200">
                  Add to cart
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </PosCard>
  );
}
