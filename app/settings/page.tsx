import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsOverview } from "@/components/settings/settings-overview";
import { RoleMatrix } from "@/components/settings/role-matrix";
import { ShiftPolicies } from "@/components/settings/shift-policies";
import { IntegrationGrid } from "@/components/settings/integration-grid";
import { NotificationPreferences } from "@/components/settings/notification-preferences";
import { AuditSnapshotList } from "@/components/settings/audit-snapshot";
import type {
  AuditSnapshot,
  IntegrationConfig,
  NotificationPreference,
  RoleDefinition,
  SettingsTab,
  ShiftPolicy
} from "@/components/settings/types";

const tabs: SettingsTab[] = [
  {
    id: "general",
    name: "General",
    description: "Logo, horario y denominaciones por sucursal.",
    status: "ok",
    owner: "Administración"
  },
  {
    id: "users",
    name: "Usuarios & Roles",
    description: "Gestión de accesos, permisos y MFA.",
    status: "review",
    owner: "Seguridad"
  },
  {
    id: "pos",
    name: "POS & Turnos",
    description: "Políticas de apertura, floats, tolerancias.",
    status: "ok",
    owner: "Operaciones"
  },
  {
    id: "inventory",
    name: "Inventario",
    description: "WAC/FIFO, alertas de bajo stock, proveedores.",
    status: "ok",
    owner: "Inventarios"
  },
  {
    id: "repairs",
    name: "Repairs & Fab",
    description: "Etapas, SLA y tableros Kanban por taller.",
    status: "setup",
    owner: "Taller"
  },
  {
    id: "vendors",
    name: "Vendors",
    description: "Integraciones de suplidores y precios.",
    status: "setup",
    owner: "Compras"
  },
  {
    id: "accounting",
    name: "Contabilidad",
    description: "Mapeo de cuentas y exportación DGII.",
    status: "review",
    owner: "Finanzas"
  },
  {
    id: "notifications",
    name: "Notificaciones",
    description: "Plantillas, canales y horarios silenciosos.",
    status: "ok",
    owner: "Marketing"
  },
  {
    id: "integrations",
    name: "Integraciones",
    description: "Supabase, PSPs, contabilidad, mensajería.",
    status: "review",
    owner: "IT"
  },
  {
    id: "system",
    name: "Sistema",
    description: "Backups, retención, auditoría.",
    status: "ok",
    owner: "IT"
  },
  {
    id: "personal",
    name: "Personal",
    description: "Preferencias individuales y dispositivos.",
    status: "ok",
    owner: "Usuario"
  }
];

const roles: RoleDefinition[] = [
  {
    id: "role-1",
    name: "Administrador",
    scope: "Acceso total · todas sucursales",
    permissions: ["Usuarios", "Integraciones", "Reportes"],
    members: 4,
    critical: true
  },
  {
    id: "role-2",
    name: "Gerente de tienda",
    scope: "Ventas, préstamos, inventario sucursal",
    permissions: ["Apertura/cierre", "Descuentos", "Aprobación préstamos"],
    members: 12
  },
  {
    id: "role-3",
    name: "Cajero",
    scope: "POS, cobros y layaway",
    permissions: ["Cobros", "Notas cliente", "Enviar recordatorios"],
    members: 28
  },
  {
    id: "role-4",
    name: "Analista cumplimiento",
    scope: "OFAC, reportes policiales, IRS 8300",
    permissions: ["Ver transacciones", "Marcar alertas", "Exportar informes"],
    members: 3
  }
];

const policies: ShiftPolicy[] = [
  {
    id: "policy-1",
    name: "Fondo inicial",
    description: "RD$7,500 por caja · doble conteo con supervisor antes de abrir.",
    requirement: "Obligatorio",
    lastUpdated: "12 jun 2024"
  },
  {
    id: "policy-2",
    name: "Tolerancia de descuadre",
    description: "Alertar > RD$250 · bloquea cierre hasta registrar nota.",
    requirement: "Supervisión",
    lastUpdated: "08 jun 2024"
  },
  {
    id: "policy-3",
    name: "Drops a bóveda",
    description: "Cada RD$25,000 en caja debe bajar a bóveda con escolta.",
    requirement: "Doble firma",
    lastUpdated: "05 jun 2024"
  }
];

const integrations: IntegrationConfig[] = [
  {
    id: "int-1",
    name: "Supabase",
    provider: "Supabase · Auth + Realtime",
    status: "connected",
    lastSync: "Hace 5 min",
    detail: "Usuarios, sesiones y datos sincronizados."
  },
  {
    id: "int-2",
    name: "CardNet",
    provider: "CardNet · POS",
    status: "warning",
    lastSync: "Hace 38 min",
    detail: "Token expira en 7 días · solicitar renovación."
  },
  {
    id: "int-3",
    name: "WhatsApp Business",
    provider: "Twilio",
    status: "connected",
    lastSync: "Hace 2 min",
    detail: "Webhooks activos, 2 plantillas pendientes de aprobación."
  },
  {
    id: "int-4",
    name: "QuickBooks",
    provider: "QuickBooks Online",
    status: "disconnected",
    lastSync: "Aún no sincroniza",
    detail: "Falta mapear cuentas contables y credenciales."
  }
];

const notifications: NotificationPreference[] = [
  {
    id: "noti-1",
    channel: "Alertas de caja",
    usage: "Descuares, drops y safe",
    enabled: true,
    recipients: ["Gerentes", "Tesorería"]
  },
  {
    id: "noti-2",
    channel: "Compliance",
    usage: "OFAC, reportes policiales",
    enabled: true,
    recipients: ["Cumplimiento", "Director"]
  },
  {
    id: "noti-3",
    channel: "Marketing",
    usage: "Campañas enviadas y errores",
    enabled: false,
    recipients: ["Marketing"]
  }
];

const auditLog: AuditSnapshot[] = [
  {
    id: "audit-1",
    event: "Rol Gerente actualizado",
    actor: "Gabriela R.",
    scope: "Permiso descuentos >15%",
    timestamp: "Hoy · 9:32 a. m.",
    status: "logged"
  },
  {
    id: "audit-2",
    event: "Token CardNet",
    actor: "Sistema",
    scope: "Intento renovación · respuesta 401",
    timestamp: "Hoy · 8:54 a. m.",
    status: "warning"
  },
  {
    id: "audit-3",
    event: "Export DGII",
    actor: "Luis B.",
    scope: "Archivo mensual junio",
    timestamp: "Ayer · 5:45 p. m.",
    status: "logged"
  },
  {
    id: "audit-4",
    event: "Intento acceso restringido",
    actor: "Usuario invitado",
    scope: "Módulo Compliance",
    timestamp: "Ayer · 4:18 p. m.",
    status: "error"
  }
];

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Configuración del sistema</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Centraliza políticas, roles, integraciones y alertas para todas las sucursales del grupo.
        </p>
      </div>

      <SettingsCard
        title="Resumen de áreas"
        subtitle="Estado de cada pestaña de configuración"
        action="Ver checklist"
      >
        <SettingsOverview tabs={tabs} />
      </SettingsCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <SettingsCard
          title="Roles y permisos"
          subtitle="Control de acceso y miembros activos"
          action="Gestionar usuarios"
          className="xl:col-span-2"
        >
          <RoleMatrix roles={roles} />
        </SettingsCard>

        <SettingsCard
          title="Políticas de turnos"
          subtitle="Lineamientos operativos del POS"
          action="Editar políticas"
        >
          <ShiftPolicies policies={policies} />
        </SettingsCard>
      </div>

      <SettingsCard
        title="Integraciones críticas"
        subtitle="Estado de conexiones externas"
        action="Centro de integraciones"
      >
        <IntegrationGrid integrations={integrations} />
      </SettingsCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <SettingsCard
          title="Notificaciones"
          subtitle="Canales y responsables por alerta"
          action="Configurar silencios"
          className="xl:col-span-2"
        >
          <NotificationPreferences preferences={notifications} />
        </SettingsCard>

        <SettingsCard
          title="Auditoría reciente"
          subtitle="Eventos registrados en las últimas 24 h"
          action="Ver bitácora"
        >
          <AuditSnapshotList events={auditLog} />
        </SettingsCard>
      </div>
    </div>
  );
}
