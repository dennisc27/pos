import { notFound } from "next/navigation";

import { ReportPageShell } from "../components/report-shell";
import { REPORT_DETAILS } from "../report-details";
import { REPORT_DEFINITIONS } from "../report-definitions";

export default function ReportDetailPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const detail = REPORT_DETAILS[slug];
  const definition = REPORT_DEFINITIONS.find((item) => item.key === slug);

  if (!detail || !definition) {
    notFound();
  }

  return (
    <ReportPageShell title={definition.title} description={definition.description}>
      <div className="space-y-10">
        <section className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Resumen</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{detail.overview}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {detail.highlights.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        {detail.sections.map((section) => (
          <section
            key={section.title}
            className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
          >
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{section.title}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{section.description}</p>
            {section.bullets?.length ? (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-200">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </ReportPageShell>
  );
}
