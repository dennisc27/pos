"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Search } from "lucide-react";

import { formatCurrencyFromCents } from "@/lib/utils";

type SearchResult = {
  id: string;
  type: "Sale" | "Refund" | "Layaway" | "Pawn" | "Buy" | "Purchase";
  customer: string;
  totalCents: number;
  date: string;
  status: string;
  href: string;
};

const mockResults: SearchResult[] = [
  { id: "S-1045", type: "Sale", customer: "María Sánchez", totalCents: 189900, date: "2024-06-12", status: "Pagado", href: "/pos/new" },
  { id: "R-778", type: "Refund", customer: "Carlos Mendez", totalCents: 45900, date: "2024-06-10", status: "Completado", href: "/pos/refund" },
  { id: "L-2201", type: "Layaway", customer: "Ana Gómez", totalCents: 99900, date: "2024-06-08", status: "Activo", href: "/layaway/2201" },
  { id: "PWN-332", type: "Pawn", customer: "José Perez", totalCents: 150000, date: "2024-06-06", status: "Vigente", href: "/loans/332" },
  { id: "BUY-118", type: "Buy", customer: "Lucía Rivera", totalCents: 72000, date: "2024-06-05", status: "Recibido", href: "/pos/buy" },
  { id: "PO-872", type: "Purchase", customer: "Electro Supplier", totalCents: 265000, date: "2024-06-04", status: "Recepción", href: "/purchases/new" },
  { id: "PWN-329", type: "Pawn", customer: "Carlos Mendez", totalCents: 88000, date: "2024-06-03", status: "Forfeited", href: "/loans/329" },
  { id: "S-1039", type: "Sale", customer: "Julio Marte", totalCents: 134500, date: "2024-06-01", status: "Pagado", href: "/pos/new" }
];

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return dateFormatter.format(parsed);
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const filteredResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return [] as SearchResult[];
    }

    return mockResults.filter((result) => {
      return [
        result.id.toLowerCase(),
        result.type.toLowerCase(),
        result.customer.toLowerCase(),
        result.status.toLowerCase()
      ].some((field) => field.includes(needle));
    });
  }, [query]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = query.trim();
    if (!normalized) {
      return;
    }
    router.push(`/search?q=${encodeURIComponent(normalized)}`);
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 text-slate-900 dark:text-slate-100 sm:px-6">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Búsqueda global</p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Resultados</h1>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <Search className="h-4 w-4" />
          <input
            className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder="Ventas, reembolsos, layaways, pawns, compras"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Buscar
        </button>
      </form>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-200">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-200">Referencia</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-200">Cliente</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-200">Total</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-200">Fecha</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-200">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredResults.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-300" colSpan={6}>
                    No hay coincidencias con "{query}". Prueba con otro término.
                  </td>
                </tr>
              ) : (
                filteredResults.map((result) => (
                  <tr key={`${result.type}-${result.id}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-100">{result.type}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{result.id}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{result.customer}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">{formatCurrencyFromCents(result.totalCents)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{formatDate(result.date)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700 dark:text-slate-200">
                      <div className="flex items-center justify-end gap-2">
                        <span>{result.status}</span>
                        <Link
                          href={result.href}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Abrir
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
