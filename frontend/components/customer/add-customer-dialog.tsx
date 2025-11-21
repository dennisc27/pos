"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type CustomerFormData = {
  firstName: string;
  lastName: string;
  cedulaNo: string;
  email: string;
  phone: string;
  address: string;
};

type CreatedCustomer = {
  id: number;
  firstName: string;
  lastName: string;
  cedulaNo: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type AddCustomerDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: CreatedCustomer) => void;
  onError?: (error: string) => void;
};

export function AddCustomerDialog({ isOpen, onClose, onSuccess, onError }: AddCustomerDialogProps) {
  const { branch: activeBranch } = useActiveBranch();
  const [formData, setFormData] = useState<CustomerFormData>({
    firstName: "",
    lastName: "",
    cedulaNo: "",
    email: "",
    phone: "",
    address: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setFormData({
      firstName: "",
      lastName: "",
      cedulaNo: "",
      email: "",
      phone: "",
      address: "",
    });
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!activeBranch?.id) {
      const errorMsg = "Debe seleccionar una sucursal activa antes de crear un cliente.";
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      const errorMsg = "El nombre y apellido son requeridos.";
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: activeBranch.id,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          cedulaNo: formData.cedulaNo.trim() || null,
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create customer");
      }

      const payload = (await response.json()) as { customer: CreatedCustomer };
      const createdCustomer = payload.customer;

      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        cedulaNo: "",
        email: "",
        phone: "",
        address: "",
      });

      onSuccess(createdCustomer);
      handleClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unable to create customer";
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-2xl space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Agregar cliente</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Complete los datos del nuevo cliente. Los campos marcados con * son obligatorios.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
            aria-label="Cerrar diálogo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        {!activeBranch ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            Debe seleccionar una sucursal activa antes de crear un cliente.
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              Nombre *
              <input
                value={formData.firstName}
                onChange={(event) =>
                  setFormData({ ...formData, firstName: event.target.value })
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Nombre"
                maxLength={80}
              />
            </label>
          </div>
          <div className="sm:col-span-1">
            <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              Apellido *
              <input
                value={formData.lastName}
                onChange={(event) =>
                  setFormData({ ...formData, lastName: event.target.value })
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Apellido"
                maxLength={80}
              />
            </label>
          </div>
          <div className="sm:col-span-1">
            <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              Cédula No.
              <input
                value={formData.cedulaNo}
                onChange={(event) =>
                  setFormData({ ...formData, cedulaNo: event.target.value })
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Cédula No."
                maxLength={20}
              />
            </label>
          </div>
          <div className="sm:col-span-1">
            <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              Teléfono
              <input
                type="tel"
                value={formData.phone}
                onChange={(event) =>
                  setFormData({ ...formData, phone: event.target.value })
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Teléfono"
                maxLength={40}
              />
            </label>
          </div>
          <div className="sm:col-span-1">
            <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              Correo electrónico
              <input
                type="email"
                value={formData.email}
                onChange={(event) =>
                  setFormData({ ...formData, email: event.target.value })
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Correo electrónico"
                maxLength={190}
              />
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              Dirección
              <textarea
                value={formData.address}
                onChange={(event) =>
                  setFormData({ ...formData, address: event.target.value })
                }
                rows={3}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Dirección"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              isLoading ||
              !activeBranch ||
              !formData.firstName.trim() ||
              !formData.lastName.trim()
            }
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creando...
              </>
            ) : (
              "Crear cliente"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

