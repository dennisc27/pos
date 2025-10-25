import type { RoleDefinition } from "./types";

export function RoleMatrix({ roles }: { roles: RoleDefinition[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/60 shadow-sm dark:border-slate-800/60">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-900/60">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Rol
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Alcance
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Permisos clave
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Miembros
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white/80 text-sm dark:divide-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
          {roles.map((role) => (
            <tr key={role.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">{role.name}</span>
                  {role.critical ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
                      crítico
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{role.scope}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {role.permissions.map((permission) => (
                    <span
                      key={permission}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{role.members}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
