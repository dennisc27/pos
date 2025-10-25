import Link from "next/link";

const POS_ROUTES = [
  {
    href: "/pos/sale",
    title: "New Sale",
    description:
      "Scan items, build the cart, collect tenders, and print receipts with drawer control."
  },
  {
    href: "/pos/refund",
    title: "Refunds",
    description:
      "Locate invoices, validate policy rules, and restock approved items with credit issuance."
  },
  {
    href: "/pos/buy",
    title: "Buy from Customer",
    description:
      "Intake pre-owned goods, capture photos, and post the payout to the active shift."
  },
  {
    href: "/pos/gift-card",
    title: "Gift Card",
    description:
      "Issue, reload, and redeem store gift cards while maintaining running balances."
  }
];

export default function POSLandingPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Point of Sale
        </p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          Front counter workflows
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Access the core POS flows for sales, returns, customer buy backs, and gift cards.
          Each module enforces the policy and ledger rules outlined in the operations playbook.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {POS_ROUTES.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <h2 className="text-lg font-semibold text-slate-900 transition group-hover:text-sky-600 dark:text-slate-50">
              {route.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {route.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
