import { CashSummary } from "@/components/cash/cash-summary";
import { ShiftBoard } from "@/components/cash/shift-board";
import { DrawerHealth } from "@/components/cash/drawer-health";
import { MovementFeed } from "@/components/cash/movement-feed";
import { SafeQueue } from "@/components/cash/safe-queue";
import type {
  CashSummaryMetric,
  ShiftSnapshot,
  DrawerStatus,
  CashMovement,
  SafeDropItem
} from "@/components/cash/types";
import { formatCurrency } from "@/components/cash/utils";

const summaryMetrics: CashSummaryMetric[] = [
  {
    label: "Turnos abiertos",
    value: "4 activos",
    accent: "text-emerald-600 dark:text-emerald-300",
    change: { direction: "up", label: "+1 vs. ayer" }
  },
  {
    label: "Efectivo esperado",
    value: formatCurrency(184_350),
    change: { direction: "up", label: "+RD$12,400" }
  },
  {
    label: "Diferencias detectadas",
    value: formatCurrency(-2_150),
    accent: "text-rose-600 dark:text-rose-300",
    change: { direction: "down", label: "-28% variaciones" }
  },
  {
    label: "Bóveda disponible",
    value: formatCurrency(1_245_000),
    accent: "text-sky-600 dark:text-sky-300",
    change: { direction: "flat", label: "Sin cambios" }
  }
];

const shiftSnapshots: ShiftSnapshot[] = [
  {
    id: "shift-1",
    branch: "Santo Domingo Centro",
    register: "Front Counter 01",
    clerk: "María Pérez",
    openedAt: "08:00 a. m.",
    status: "closing",
    expected: 58_200,
    counted: 57_920,
    variance: -280,
    lastMovement: "Drop a bóveda RD$20,000 · 11:45 a. m.",
    nextAction: "Cerrar turno antes de las 12:15 p. m.",
    tasks: [
      { label: "X report impreso", completed: true },
      { label: "Drop sellado y etiquetado", completed: true },
      { label: "Conteo billetes grandes", completed: true },
      { label: "Conteo monedas", completed: false },
      { label: "Firma supervisor", completed: false },
      { label: "Posteo en Supabase", completed: false }
    ]
  },
  {
    id: "shift-2",
    branch: "Santo Domingo Oeste",
    register: "Electrónica",
    clerk: "Luis Herrera",
    openedAt: "09:00 a. m.",
    status: "open",
    expected: 46_850,
    counted: 46_850,
    variance: 0,
    lastMovement: "Paid-in RD$3,000 para reparaciones · 10:58 a. m.",
    tasks: [
      { label: "Conteo parcial 11 a. m.", completed: true },
      { label: "Drop programado 1 p. m.", completed: false },
      { label: "Validar vouchers Azul", completed: true },
      { label: "Registrar paid-out proveedores", completed: false }
    ]
  },
  {
    id: "shift-3",
    branch: "Santiago",
    register: "Joyas",
    clerk: "Ivonne Cabrera",
    openedAt: "09:30 a. m.",
    status: "open",
    expected: 38_400,
    lastMovement: "Venta cash RD$12,500 · 11:32 a. m.",
    tasks: [
      { label: "Conteo parcial 1 p. m.", completed: false },
      { label: "Conciliar pagos Zelle", completed: true },
      { label: "Drop vespertino", completed: false }
    ]
  },
  {
    id: "shift-4",
    branch: "La Romana",
    register: "Cajas mixtas",
    clerk: "Samuel Hernández",
    openedAt: "07:45 a. m.",
    status: "balanced",
    expected: 41_900,
    counted: 42_030,
    variance: 130,
    lastMovement: "Reembolso RD$1,800 · 10:05 a. m.",
    tasks: [
      { label: "X report matutino", completed: true },
      { label: "Drop a bóveda", completed: true },
      { label: "Conteo supervisor", completed: true }
    ]
  }
];

const drawerStatuses: DrawerStatus[] = [
  {
    id: "drawer-1",
    register: "Front Counter 01",
    branch: "Santo Domingo Centro",
    expected: 28_450,
    counted: 28_150,
    variance: -300,
    lastCount: "11:50 a. m.",
    status: "review"
  },
  {
    id: "drawer-2",
    register: "Front Counter 02",
    branch: "Santo Domingo Centro",
    expected: 26_700,
    counted: 26_820,
    variance: 120,
    lastCount: "10:40 a. m.",
    status: "attention"
  },
  {
    id: "drawer-3",
    register: "Electrónica",
    branch: "Santo Domingo Oeste",
    expected: 24_100,
    counted: 24_100,
    variance: 0,
    lastCount: "11:05 a. m.",
    status: "ok"
  },
  {
    id: "drawer-4",
    register: "Joyas",
    branch: "Santiago",
    expected: 22_900,
    counted: 22_700,
    variance: -200,
    lastCount: "10:25 a. m.",
    status: "attention"
  }
];

const movements: CashMovement[] = [
  {
    id: "mov-1",
    time: "11:58",
    branch: "Santo Domingo Centro",
    user: "Supervisor",
    type: "drop",
    description: "Drop RD$20,000 enviado a bóveda con bolsa BD-1423",
    amount: 20_000,
    reference: "DROP-0624-14"
  },
  {
    id: "mov-2",
    time: "11:45",
    branch: "Santo Domingo Oeste",
    user: "Luis Herrera",
    type: "paid_out",
    description: "Paid-out RD$3,200 a proveedor de reparaciones",
    amount: 3_200,
    reference: "PO-8821"
  },
  {
    id: "mov-3",
    time: "11:32",
    branch: "Santiago",
    user: "Ivonne Cabrera",
    type: "sale_cash",
    description: "Venta ticket R-20544 pagada 100% en efectivo",
    amount: 12_500,
    reference: "R-20544"
  },
  {
    id: "mov-4",
    time: "11:10",
    branch: "La Romana",
    user: "Samuel Hernández",
    type: "refund_cash",
    description: "Reembolso parcial RD$1,800 por devolución de bocinas",
    amount: -1_800,
    reference: "RF-4410"
  },
  {
    id: "mov-5",
    time: "10:58",
    branch: "Santo Domingo Oeste",
    user: "Supervisor",
    type: "paid_in",
    description: "Paid-in RD$3,000 para cubrir órdenes de taller",
    amount: 3_000,
    reference: "PI-7730"
  },
  {
    id: "mov-6",
    time: "10:20",
    branch: "Santo Domingo Centro",
    user: "María Pérez",
    type: "adjustment",
    description: "Ajuste manual RD$-450 para cuadrar contado apertura",
    amount: -450,
    reference: "ADJ-204"
  }
];

const safeDrops: SafeDropItem[] = [
  {
    id: "drop-1",
    dropNumber: "1423",
    branch: "Santo Domingo Centro",
    amount: 20_000,
    bagId: "BD-1423",
    status: "sealed",
    scheduledPickup: "Banco Caribe · 1:30 p. m.",
    escort: "Seguritas #12",
    notes: "Agregar formulario DGII"
  },
  {
    id: "drop-2",
    dropNumber: "1424",
    branch: "Santo Domingo Oeste",
    amount: 18_500,
    bagId: "BD-1424",
    status: "queued",
    scheduledPickup: "Banco Caribe · 4:30 p. m.",
    escort: "Seguritas #15"
  },
  {
    id: "drop-3",
    dropNumber: "1418",
    branch: "La Romana",
    amount: 25_700,
    bagId: "BD-1418",
    status: "in_transit",
    scheduledPickup: "Banco Popular · 10:45 a. m.",
    escort: "Mensajería interna",
    notes: "Confirmar recepción en banco"
  },
  {
    id: "drop-4",
    dropNumber: "1415",
    branch: "Santiago",
    amount: 17_900,
    bagId: "BD-1415",
    status: "received",
    scheduledPickup: "Banco Popular · 8:30 a. m.",
    escort: "Mensajería interna",
    notes: "Recibido y conciliado"
  }
];

export default function CashPage() {
  return (
    <div className="space-y-6">
      <CashSummary metrics={summaryMetrics} />
      <div className="grid gap-6 xl:grid-cols-[1.7fr,1fr]">
        <div className="space-y-6">
          <ShiftBoard shifts={shiftSnapshots} />
          <MovementFeed movements={movements} />
        </div>
        <div className="space-y-6">
          <DrawerHealth drawers={drawerStatuses} />
          <SafeQueue drops={safeDrops} />
        </div>
      </div>
    </div>
  );
}
