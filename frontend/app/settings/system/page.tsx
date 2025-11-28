"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  Bell,
  BellRing,
  Bot,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Globe,
  Hash,
  Loader2,
  Mail,
  Palette,
  Percent,
  Plus,
  Printer,
  RefreshCcw,
  Save,
  Scale,
  ServerCog,
  Settings2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Store,
  Trash2,
  Users2,
  Wallet,
  X,
  Folder,
  FolderOpen,
  ShoppingCart,
} from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type StatusMessage = { tone: "success" | "error" | "info"; message: string } | null;

type InterestModel = {
  id: number;
  name: string;
  description: string | null;
  rateType: "flat" | "simple" | "compound";
  periodDays: number;
  interestRateBps: number;
  graceDays: number;
  minPrincipalCents: number | null;
  maxPrincipalCents: number | null;
  lateFeeBps: number;
  defaultTermCount: number;
  categoryIds?: number[];
};

type Category = {
  id: number;
  name: string;
  parentId: number | null;
  caracter: string | null;
};

function InterestModelsSection({ graceDays, onGraceDaysChange }: { graceDays: number; onGraceDaysChange: (days: number) => void }) {
  const [models, setModels] = useState<InterestModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<InterestModel | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    rateType: "simple" as "flat" | "simple" | "compound",
    periodDays: "30",
    interestRateBps: "",
    minPrincipalCents: "",
    maxPrincipalCents: "",
    lateFeeBps: "0",
    defaultTermCount: "1",
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const loadModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/interest-models`);
      if (!response.ok) {
        throw new Error(`Failed to load models: ${response.status}`);
      }
      const data = await response.json();
      setModels(data.interestModels ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load interest models");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories ?? []);
      }
    } catch (err) {
      // Silently fail - categories are optional
      console.error("Failed to load categories:", err);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const getCategoryPath = (category: Category, visited = new Set<number>()): string => {
    if (visited.has(category.id)) {
      return category.name; // Prevent infinite recursion
    }
    visited.add(category.id);
    
    const parent = categories.find((c) => c.id === category.parentId);
    if (parent) {
      return `${getCategoryPath(parent, visited)} > ${category.name}`;
    }
    return category.name;
  };

  const openCreateDialog = () => {
    setEditingModel(null);
    setSelectedCategoryIds([]);
    setFormData({
      name: "",
      description: "",
      rateType: "simple",
      periodDays: "30",
      interestRateBps: "",
      minPrincipalCents: "",
      maxPrincipalCents: "",
      lateFeeBps: "0",
      defaultTermCount: "1",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (model: InterestModel) => {
    setEditingModel(model);
    setSelectedCategoryIds(model.categoryIds ?? []);
    setFormData({
      name: model.name,
      description: model.description ?? "",
      rateType: model.rateType,
      periodDays: String(model.periodDays),
      interestRateBps: String(model.interestRateBps / 100), // Convert from basis points to percentage
      minPrincipalCents: model.minPrincipalCents ? String(model.minPrincipalCents / 100) : "",
      maxPrincipalCents: model.maxPrincipalCents ? String(model.maxPrincipalCents / 100) : "",
      lateFeeBps: String(model.lateFeeBps / 100), // Convert from basis points to percentage
      defaultTermCount: String(model.defaultTermCount),
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingModel(null);
    setSelectedCategoryIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        rateType: formData.rateType,
        periodDays: Number(formData.periodDays),
        interestRateBps: Math.round(Number(formData.interestRateBps) * 100), // Convert percentage to basis points
        graceDays: graceDays, // Use global grace days setting
        minPrincipalCents: formData.minPrincipalCents ? Math.round(Number(formData.minPrincipalCents) * 100) : 0,
        maxPrincipalCents: formData.maxPrincipalCents ? Math.round(Number(formData.maxPrincipalCents) * 100) : null,
        lateFeeBps: Math.round(Number(formData.lateFeeBps) * 100), // Convert percentage to basis points
        defaultTermCount: Number(formData.defaultTermCount),
        categoryIds: selectedCategoryIds,
      };

      const url = editingModel
        ? `${API_BASE_URL}/api/interest-models/${editingModel.id}`
        : `${API_BASE_URL}/api/interest-models`;
      const method = editingModel ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to ${editingModel ? "update" : "create"} model`);
      }

      await loadModels();
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${editingModel ? "update" : "create"} model`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/interest-models/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete model");
      }

      await loadModels();
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete model");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Modelos de Interés</h3>
          <p className="text-xs text-muted-foreground">Gestiona los modelos de interés para préstamos</p>
        </div>
        <button
          type="button"
          onClick={openCreateDialog}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> Nuevo modelo
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="grace-days">
          Días de gracia
        </label>
        <input
          id="grace-days"
          type="number"
          value={graceDays}
          onChange={(event) => onGraceDaysChange(Number(event.target.value) || 0)}
          min={0}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="text-xs text-muted-foreground">Días de gracia aplicados a todos los modelos de interés</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : models.length === 0 ? (
        <div className="rounded-md border border-border bg-muted/50 px-4 py-8 text-center text-xs text-muted-foreground">
          No hay modelos de interés. Crea uno nuevo para comenzar.
        </div>
      ) : (
        <div className="space-y-2">
          {models.map((model) => (
            <div
              key={model.id}
              className="flex items-start justify-between rounded-md border border-border bg-background p-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{model.name}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {model.rateType}
                  </span>
                </div>
                {model.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{model.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>Tasa: {(model.interestRateBps / 100).toFixed(2)}%</span>
                  <span>Periodo: {model.periodDays} días</span>
                  <span>Cuotas: {model.defaultTermCount}</span>
                  {model.minPrincipalCents && (
                    <span>Mín: RD${(model.minPrincipalCents / 100).toLocaleString()}</span>
                  )}
                  {model.maxPrincipalCents && (
                    <span>Máx: RD${(model.maxPrincipalCents / 100).toLocaleString()}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditDialog(model)}
                  className="rounded-md border border-border px-2 py-1 text-xs transition hover:bg-muted"
                >
                  Editar
                </button>
                {deleteConfirm === model.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDelete(model.id)}
                      disabled={submitting}
                      className="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(null)}
                      className="rounded-md border border-border px-2 py-1 text-xs transition hover:bg-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(model.id)}
                    className="rounded-md border border-destructive/50 px-2 py-1 text-xs text-destructive transition hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-background p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingModel ? "Editar Modelo de Interés" : "Nuevo Modelo de Interés"}
              </h3>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-md p-1 transition hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Ej. Interés Mensual"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Descripción opcional del modelo"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tipo de Tasa *</label>
                  <select
                    value={formData.rateType}
                    onChange={(e) =>
                      setFormData({ ...formData, rateType: e.target.value as "flat" | "simple" | "compound" })
                    }
                    required
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="flat">Flat</option>
                    <option value="simple">Simple</option>
                    <option value="compound">Compound</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Días del Periodo *</label>
                  <input
                    type="number"
                    value={formData.periodDays}
                    onChange={(e) => setFormData({ ...formData, periodDays: e.target.value })}
                    required
                    min={1}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tasa de Interés (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.interestRateBps}
                    onChange={(e) => setFormData({ ...formData, interestRateBps: e.target.value })}
                    required
                    min={0}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Ej. 5.00"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Cuotas por Defecto *</label>
                  <input
                    type="number"
                    value={formData.defaultTermCount}
                    onChange={(e) => setFormData({ ...formData, defaultTermCount: e.target.value })}
                    required
                    min={1}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Ej. 3"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Monto Mínimo (RD$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.minPrincipalCents}
                    onChange={(e) => setFormData({ ...formData, minPrincipalCents: e.target.value })}
                    min={0}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Monto Máximo (RD$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.maxPrincipalCents}
                    onChange={(e) => setFormData({ ...formData, maxPrincipalCents: e.target.value })}
                    min={0}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Sin límite"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Tasa de Cargo por Mora (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.lateFeeBps}
                  onChange={(e) => setFormData({ ...formData, lateFeeBps: e.target.value })}
                  min={0}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Categorías Aplicables</label>
                <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-background p-2">
                  {categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No hay categorías disponibles</p>
                  ) : (
                    <div className="space-y-1">
                      {categories.map((category) => (
                        <label
                          key={category.id}
                          className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategoryIds.includes(category.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategoryIds([...selectedCategoryIds, category.id]);
                              } else {
                                setSelectedCategoryIds(selectedCategoryIds.filter((id) => id !== category.id));
                              }
                            }}
                            className="h-4 w-4 rounded border-border"
                          />
                          <span className="flex-1">
                            {getCategoryPath(category)}
                            {category.caracter && (
                              <span className="ml-2 text-xs text-muted-foreground">({category.caracter})</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Selecciona las categorías a las que se aplicará este modelo de interés. Si no se selecciona ninguna, se aplicará a todas las categorías.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-md border border-border px-4 py-2 text-sm transition hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : editingModel ? (
                    "Actualizar"
                  ) : (
                    "Crear"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    parentId: "",
    caracter: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/categories`);
      if (!response.ok) {
        throw new Error(`Failed to load categories: ${response.status}`);
      }
      const data = await response.json();
      setCategories(data.categories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const getFirstUnusedCharacter = useCallback((name: string, excludeCategoryId?: number): string | null => {
    if (!name || name.trim().length === 0) return null;
    
    const usedCharacters = new Set(
      categories
        .filter((c) => c.caracter && (!excludeCategoryId || c.id !== excludeCategoryId))
        .map((c) => c.caracter?.toUpperCase())
        .filter((c): c is string => c !== null)
    );

    const nameUpper = name.toUpperCase().trim();
    for (let i = 0; i < nameUpper.length; i++) {
      const char = nameUpper[i];
      if (char && /[A-Z0-9]/.test(char) && !usedCharacters.has(char)) {
        return char;
      }
    }
    return null;
  }, [categories]);

  const openCreateDialog = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      parentId: "",
      caracter: "",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      parentId: category.parentId ? String(category.parentId) : "",
      caracter: category.caracter || "",
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
  };

  // Auto-fill caracter when name changes (only if caracter is empty)
  useEffect(() => {
    if (isDialogOpen && formData.name && !formData.caracter) {
      const suggestedChar = getFirstUnusedCharacter(formData.name, editingCategory?.id);
      if (suggestedChar) {
        setFormData((prev) => ({ ...prev, caracter: suggestedChar }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.name, isDialogOpen, editingCategory?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: formData.name.trim(),
        parentId: formData.parentId ? Number(formData.parentId) : null,
        caracter: formData.caracter.trim() || null,
      };

      const url = editingCategory
        ? `${API_BASE_URL}/api/categories/${editingCategory.id}`
        : `${API_BASE_URL}/api/categories`;
      const method = editingCategory ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to ${editingCategory ? "update" : "create"} category`);
      }

      await loadCategories();
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${editingCategory ? "update" : "create"} category`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete category");
      }

      await loadCategories();
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category");
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryPath = (category: Category, visited = new Set<number>()): string => {
    if (visited.has(category.id)) {
      return category.name; // Prevent infinite recursion
    }
    visited.add(category.id);
    
    const parent = categories.find((c) => c.id === category.parentId);
    if (parent) {
      return `${getCategoryPath(parent, visited)} > ${category.name}`;
    }
    return category.name;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Categorías de Productos</h3>
          <p className="text-xs text-muted-foreground">Gestiona las categorías para organizar productos</p>
        </div>
        <button
          type="button"
          onClick={openCreateDialog}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> Nueva categoría
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-md border border-border bg-muted/50 px-4 py-8 text-center text-xs text-muted-foreground">
          No hay categorías. Crea una nueva para comenzar.
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex items-start justify-between rounded-md border border-border bg-background p-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{category.name}</p>
                  {category.parentId && (
                    <span className="text-xs text-muted-foreground">
                      ({getCategoryPath(category)})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditDialog(category)}
                  className="rounded-md border border-border px-2 py-1 text-xs transition hover:bg-muted"
                >
                  Editar
                </button>
                {deleteConfirm === category.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDelete(category.id)}
                      disabled={submitting}
                      className="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(null)}
                      className="rounded-md border border-border px-2 py-1 text-xs transition hover:bg-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(category.id)}
                    className="rounded-md border border-destructive/50 px-2 py-1 text-xs text-destructive transition hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
              </h3>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-md p-1 transition hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  maxLength={120}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Ej. Electrónica"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Carácter</label>
                <input
                  value={formData.caracter}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().slice(0, 1);
                    setFormData({ ...formData, caracter: value });
                  }}
                  maxLength={1}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="E"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Se auto-completa con el primer carácter disponible del nombre. Debe ser único.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Categoría Padre</label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Ninguna (categoría raíz)</option>
                  {categories
                    .filter((c) => !editingCategory || c.id !== editingCategory.id)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {getCategoryPath(category)}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Opcional: selecciona una categoría padre para crear una subcategoría
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-md border border-border px-4 py-2 text-sm transition hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : editingCategory ? (
                    "Actualizar"
                  ) : (
                    "Crear"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

type BranchOption = {
  id: number;
  name: string;
  code: string | null;
};

type MaskedSettingEntry<T> = {
  key: string;
  value: T | null;
  masked: boolean;
};

type SettingsResponse<T> = {
  scope: "global" | "branch" | "user";
  branchId: number | null;
  userId: number | null;
  entries: MaskedSettingEntry<T>[];
  fallback?: MaskedSettingEntry<T>[] | null;
};

type TenderConfig = {
  code: string;
  label: string;
  enabled: boolean;
};

type DrawerConfig = {
  maxOverShortCents: number;
  requirePin: boolean;
  allowBlindOpen: boolean;
  autoOpenOn: string[];
  manualOpenPin: string;
};

type ReceiptConfig = {
  header: string;
  footer: string;
  showLogo: boolean;
  showTaxBreakdown: boolean;
  autoPrint: boolean;
  includeRefundDetails: boolean;
  includePaidOuts: boolean;
};

type SystemSettings = {
  pawnEnabled: boolean;
  businessDate: string;
};

type CompanyProfile = {
  name: string;
  iconUrl: string;
  address: string;
  rnc: string;
};

type LocalizationSettings = {
  currencySymbol: "RD$" | "$";
};

type PreferenceSettings = {
  language: string;
  decimalFormat: "1,234.56" | "1.234,56";
  showShortcuts: boolean;
};

type AppearanceSettings = {
  theme: "light" | "dark";
  dashboardLayout: "command" | "summary";
};

type HardwareSettings = {
  printerForAll: string;
  printerTypeForAll: "ECP/P2" | "80mm";
  printerForSales: string;
  printerTypeForSales: "ECP/P2" | "80mm";
  printerForRefunds: string;
  printerTypeForRefunds: "ECP/P2" | "80mm";
  printerForBuys: string;
  printerTypeForBuys: "ECP/P2" | "80mm";
  printerForPawns: string;
  printerTypeForPawns: "ECP/P2" | "80mm";
  printerForLayaways: string;
  printerTypeForLayaways: "ECP/P2" | "80mm";
  printerForPurchases: string;
  printerTypeForPurchases: "ECP/P2" | "80mm";
  printerForRepairs: string;
  printerTypeForRepairs: "ECP/P2" | "80mm";
  printerForGiftCards: string;
  printerTypeForGiftCards: "ECP/P2" | "80mm";
  drawerModel: string;
  prePrintedPawnPaper: boolean;
};

type OperatingHours = {
  monday: { open: string; close: string; closed: boolean };
  tuesday: { open: string; close: string; closed: boolean };
  wednesday: { open: string; close: string; closed: boolean };
  thursday: { open: string; close: string; closed: boolean };
  friday: { open: string; close: string; closed: boolean };
  saturday: { open: string; close: string; closed: boolean };
  sunday: { open: string; close: string; closed: boolean };
};

type TaxSettings = {
  taxIncluded: boolean;
  taxRate: number;
};

type RoleScopes = {
  pos: boolean;
  cash: boolean;
  inventory: boolean;
  repairs: boolean;
  reportsAdmin: boolean;
  reportsNormal: boolean;
  accounting: boolean;
  settings: boolean;
};

type RoleSettings = {
  roles: { id: string; label: string; enabled: boolean }[];
  limits: { refunds: number; paidOuts: number };
  scopes: RoleScopes;
};

type ShiftSettings = {
  overShortTolerance: number;
  autoLockMinutes: number;
};

type PosAlerts = {
  suggestDrops: boolean;
  refundPercent: number;
  maxPaidOut: number;
  closureRecipientsEmail: string;
  closureRecipientsWhatsApp: string;
  expenseCategory: string;
  incomeCategory: string;
};

type InventorySettings = {
  lowStockThreshold: number;
  autoGenerateSkus: boolean;
  quarantineEnabled: boolean;
};

type PawnSettings = {
  interestModelCode: string;
  graceDays?: number; // Optional for backward compatibility, managed in Interest Models section
  alertRule: string;
  mobileApiKey?: string;
};

type NotificationSettings = {
  eventChannels: string[];
  whatsappAgentEnabled: boolean;
  messagingIntegrations: string;
  aiAutomationNotes: string;
  agentManualNotes: string;
};

type MaintenanceSettings = {
  backupFrequency: string;
  logRetentionDays: number;
  backupIdentificador: string;
  backupFolderPath: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  awsBucket: string;
  autoCloudSync: boolean;
};

type ComplianceSettings = {
  cameraViewEnabled: boolean;
  transactionStamping: boolean;
  blockId: boolean;
  idImagesPath: string;
};

type EcommerceSettings = {
  inventorySyncMinutes: number;
  orderSyncMinutes: number;
};

type ProviderForm = {
  values: Record<string, string>;
  masked: boolean;
};

type ProviderKey = "sms" | "whatsapp" | "email";

const providerKeys: Record<ProviderKey, string> = {
  sms: "notifications.sms",
  whatsapp: "notifications.whatsapp",
  email: "notifications.email",
};

type ScopeParams =
  | { scope: "global"; branchId: null; userId: null }
  | { scope: "branch"; branchId: number | null; userId: null }
  | { scope: "user"; branchId: number | null; userId: number | null };

const defaultTenders: TenderConfig[] = [
  { code: "CASH", label: "Efectivo", enabled: true },
  { code: "CARD", label: "Tarjeta", enabled: true },
];

const defaultDrawer: DrawerConfig = {
  maxOverShortCents: 500,
  requirePin: true,
  allowBlindOpen: false,
  autoOpenOn: ["sale"],
  manualOpenPin: "",
};

const defaultReceipt: ReceiptConfig = {
  header: "Pawn Command",
  footer: "¡Gracias por su visita!",
  showLogo: true,
  showTaxBreakdown: true,
  autoPrint: true,
  includeRefundDetails: true,
  includePaidOuts: false,
};

const defaultSystemSettings: SystemSettings = {
  pawnEnabled: true,
  businessDate: new Date().toISOString().slice(0, 10),
};

const defaultCompanyProfile: CompanyProfile = {
  name: "Pawn Command",
  iconUrl: "",
  address: "Av. Principal #123, Santo Domingo",
  rnc: "",
};

const defaultLocalization: LocalizationSettings = {
  currencySymbol: "RD$",
};

const defaultPreferences: PreferenceSettings = {
  language: "es",
  decimalFormat: "1,234.56",
  showShortcuts: true,
};

const defaultAppearance: AppearanceSettings = {
  theme: "light",
  dashboardLayout: "command",
};

const defaultHardware: HardwareSettings = {
  printerForAll: "",
  printerTypeForAll: "80mm",
  printerForSales: "",
  printerTypeForSales: "80mm",
  printerForRefunds: "",
  printerTypeForRefunds: "80mm",
  printerForBuys: "",
  printerTypeForBuys: "80mm",
  printerForPawns: "",
  printerTypeForPawns: "80mm",
  printerForLayaways: "",
  printerTypeForLayaways: "80mm",
  printerForPurchases: "",
  printerTypeForPurchases: "80mm",
  printerForRepairs: "",
  printerTypeForRepairs: "80mm",
  printerForGiftCards: "",
  printerTypeForGiftCards: "80mm",
  drawerModel: "APG",
  prePrintedPawnPaper: false,
};

const defaultOperatingHours: OperatingHours = {
  monday: { open: "08:00", close: "19:00", closed: false },
  tuesday: { open: "08:00", close: "19:00", closed: false },
  wednesday: { open: "08:00", close: "19:00", closed: false },
  thursday: { open: "08:00", close: "19:00", closed: false },
  friday: { open: "08:00", close: "19:00", closed: false },
  saturday: { open: "08:00", close: "19:00", closed: false },
  sunday: { open: "09:00", close: "13:00", closed: false },
};

const defaultTaxSettings: TaxSettings = {
  taxIncluded: true,
  taxRate: 18,
};

const defaultRoleSettings: RoleSettings = {
  roles: [
    { id: "user", label: "Usuario", enabled: true },
    { id: "cashier", label: "Cajero", enabled: true },
    { id: "manager", label: "Gerente", enabled: true },
  ],
  limits: { refunds: 5000, paidOuts: 3000 },
  scopes: {
    pos: true,
    cash: true,
    inventory: true,
    repairs: true,
    reportsAdmin: false,
    reportsNormal: true,
    accounting: false,
    settings: false,
  },
};

const defaultShiftSettings: ShiftSettings = {
  overShortTolerance: 50,
  autoLockMinutes: 5,
};

const defaultPosAlerts: PosAlerts = {
  suggestDrops: true,
  refundPercent: 20,
  maxPaidOut: 5000,
  closureRecipientsEmail: "gerente@tienda.com",
  closureRecipientsWhatsApp: "",
  expenseCategory: "Gastos operativos",
  incomeCategory: "Ingresos diversos",
};

const defaultInventorySettings: InventorySettings = {
  lowStockThreshold: 5,
  autoGenerateSkus: true,
  quarantineEnabled: true,
};

const defaultPawnSettings: PawnSettings = {
  interestModelCode: "STD",
  alertRule: "Artículos sobre RD$50k requieren alerta",
  mobileApiKey: "",
};

const defaultNotificationSettings: NotificationSettings = {
  eventChannels: ["renewal_reminder", "layaway_due"],
  whatsappAgentEnabled: true,
  messagingIntegrations: "Twilio",
  aiAutomationNotes: "Resúmenes automáticos de tickets",
  agentManualNotes: "Responder manualmente consultas de clientes desde WhatsApp Business.",
};

const defaultMaintenanceSettings: MaintenanceSettings = {
  backupFrequency: "diario",
  logRetentionDays: 30,
  backupIdentificador: "backup",
  backupFolderPath: "./backups",
  awsAccessKeyId: "",
  awsSecretAccessKey: "",
  awsRegion: "us-east-1",
  awsBucket: "",
  autoCloudSync: false,
};

const defaultComplianceSettings: ComplianceSettings = {
  cameraViewEnabled: true,
  transactionStamping: true,
  blockId: false,
  idImagesPath: "",
};

const defaultEcommerceSettings: EcommerceSettings = {
  inventorySyncMinutes: 15,
  orderSyncMinutes: 5,
};

const prefixValues = ["POS-", "INV-", "PAWN-", "LAY-", "CRM-"];

const notificationEventOptions = [
  { value: "new_ticket", label: "Nuevo ticket" },
  { value: "renewal_reminder", label: "Recordatorio de renovación" },
  { value: "payment_receipt", label: "Recibo de pago" },
  { value: "instapawn_token", label: "Token InstaPawn" },
  { value: "layaway_due", label: "Vencimiento de apartado" },
];

const drawerAutoOpenOptions = [
  { value: "sale", label: "Venta en efectivo" },
  { value: "refund", label: "Reembolso" },
  { value: "paid_out", label: "Pago de gasto" },
];

const scopeLabels: Record<keyof RoleScopes, string> = {
  pos: "POS",
  cash: "Caja / Movimientos",
  inventory: "Inventario",
  repairs: "Reparaciones",
  reportsAdmin: "Reportes (admin)",
  reportsNormal: "Reportes (normal)",
  accounting: "Contabilidad",
  settings: "Configuración",
};

const NAV_SECTIONS = [
  {
    heading: "Ajustes",
    items: [
      {
        id: "system-settings",
        label: "System Settings",
        description: "Activa módulos clave y define la fecha operativa del negocio.",
        icon: Settings2,
      },
      {
        id: "company-settings",
        label: "Company Settings",
        description: "Identidad corporativa, icono y dirección para recibos y notificaciones.",
        icon: Building2,
      },
      {
        id: "localization",
        label: "Localization",
        description: "Selecciona el símbolo de moneda y formato regional.",
        icon: Globe,
      },
      {
        id: "prefixes",
        label: "Prefixes",
        description: "Prefijos aplicados a códigos de documentos y entidades.",
        icon: Hash,
      },
      {
        id: "preferences",
        label: "Preference",
        description: "Preferencias generales de uso y atajos de teclado.",
        icon: SlidersHorizontal,
      },
      {
        id: "appearance",
        label: "Appearance",
        description: "Tema visual, distribución del dashboard y layout de teclado.",
        icon: Palette,
      },
      {
        id: "hardware",
        label: "Printer / Drawer",
        description: "Configura dispositivos predeterminados de impresión y gaveta.",
        icon: Printer,
      },
      {
        id: "operating-hours",
        label: "Operating Hours",
        description: "Horarios de atención para sucursal y soporte.",
        icon: Clock,
      },
      {
        id: "tax-rates",
        label: "Tax Rates",
        description: "Controla si los precios incluyen ITBIS y su porcentaje base.",
        icon: Percent,
      },
      {
        id: "users-roles",
        label: "Users & Roles",
        description: "Define habilitación de roles, alcances y límites monetarios.",
        icon: Users2,
      },
      {
        id: "shift-settings",
        label: "Shift",
        description: "Tolerancia de sobrante/faltante y bloqueo automático de caja.",
        icon: ShieldCheck,
      },
    ],
  },
  {
    heading: "POS",
    items: [
      {
        id: "pos-payment-methods",
        label: "Payment Methods",
        description: "Administra los medios de pago disponibles en la venta.",
        icon: CreditCard,
      },
      {
        id: "pos-receipt",
        label: "Receipt Printing",
        description: "Contenido del recibo, auto impresión y desglose de impuestos.",
        icon: Printer,
      },
      {
        id: "pos-drawer",
        label: "Drawer Behaviour",
        description: "Condiciones para abrir la gaveta y el PIN manual.",
        icon: Shield,
      },
      {
        id: "pos-alerts",
        label: "Alerts",
        description: "Sugerencias de drops y límites de reembolsos y pagos.",
        icon: BellRing,
      },
      {
        id: "pos-closure",
        label: "Shift Closure Recipients",
        description: "Destinatarios para resumen de cierre por WhatsApp o correo.",
        icon: Mail,
      },
      {
        id: "pos-ledger",
        label: "Expense & Income Categories",
        description: "Categorías contables usadas al generar movimientos automáticos.",
        icon: Wallet,
      },
      {
        id: "pos-ecommerce",
        label: "E-Commerce",
        description: "Configura intervalos de sincronización de inventario y órdenes.",
        icon: ShoppingCart,
      },
    ],
  },
  {
    heading: "Inventory",
    items: [
      {
        id: "inventory",
        label: "Inventory",
        description: "Umbrales de inventario, SKU automáticos y cuarentena.",
        icon: Store,
      },
      {
        id: "inventory-categories",
        label: "Categories",
        description: "Administra las categorías de productos.",
        icon: Folder,
      },
    ],
  },
  {
    heading: "Pawn",
    items: [
      {
        id: "pawn-interest",
        label: "Interest Models",
        description: "Modelo de interés aplicado por código de prenda.",
        icon: Scale,
      },
      {
        id: "pawn-alerts",
        label: "Alerts",
        description: "Reglas de alerta por descripción, tipo o monto.",
        icon: AlertCircle,
      },
    ],
  },
  {
    heading: "Notifications",
    items: [
      {
        id: "notifications-events",
        label: "Client Events",
        description: "Eventos que disparan envíos por correo o WhatsApp.",
        icon: Bell,
      },
      {
        id: "notifications-agent",
        label: "WhatsApp Agent",
        description: "Control del bot y autorización de respuestas manuales.",
        icon: Bot,
      },
      {
        id: "notifications-integrations",
        label: "Messaging Integrations",
        description: "Credenciales de proveedores y automatizaciones con IA.",
        icon: Sparkles,
      },
    ],
  },
  {
    heading: "Maintenance",
    items: [
      {
        id: "maintenance-backup",
        label: "Backup / Restore",
        description: "Frecuencia de respaldos y políticas de restauración.",
        icon: ServerCog,
      },
      {
        id: "maintenance-logs",
        label: "Log Viewer",
        description: "Retención y acceso a los registros del sistema.",
        icon: FileText,
      },
    ],
  },
  {
    heading: "Compliance",
    items: [
      {
        id: "compliance-camera",
        label: "Camera & Stamping",
        description: "Monitoreo de cámaras y sellado de transacciones.",
        icon: Camera,
      },
      {
        id: "compliance-block-id",
        label: "Block ID",
        description: "Control de bloqueos para clientes con identificación restringida.",
        icon: Shield,
      },
      {
        id: "compliance-id-images-path",
        label: "ID Images Path",
        description: "Configurar ruta de carpeta para imágenes de cédula.",
        icon: FileText,
      },
    ],
  },
];

const providerFieldLabels: Record<ProviderKey, Record<string, string>> = {
  sms: { apiKey: "API key", apiSecret: "API secret" },
  whatsapp: { accountSid: "Account SID", authToken: "Auth token" },
  email: { smtpHost: "SMTP host", smtpUser: "SMTP user", smtpPassword: "SMTP password" },
};

export default function SettingsSystemPage() {
  const { theme: currentTheme, setTheme: setCurrentTheme } = useTheme();
  const [activeScope, setActiveScope] = useState<"global" | "branch" | "user">("global");
  const [branchId, setBranchId] = useState("1");
  const [userId, setUserId] = useState("1");
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [branchOptionsLoading, setBranchOptionsLoading] = useState(false);
  const [branchOptionsError, setBranchOptionsError] = useState<string | null>(null);
  const [primaryBranchId, setPrimaryBranchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [tenders, setTenders] = useState<TenderConfig[]>(defaultTenders);
  const [drawerConfig, setDrawerConfig] = useState<DrawerConfig>(defaultDrawer);
  const [receiptConfig, setReceiptConfig] = useState<ReceiptConfig>(defaultReceipt);
  const [providers, setProviders] = useState<Record<ProviderKey, ProviderForm>>({
    sms: { values: { apiKey: "", apiSecret: "" }, masked: false },
    whatsapp: { values: { accountSid: "", authToken: "" }, masked: false },
    email: { values: { smtpHost: "", smtpUser: "", smtpPassword: "" }, masked: false },
  });

  const [systemSettings, setSystemSettings] = useState<SystemSettings>(defaultSystemSettings);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(defaultCompanyProfile);
  const [localization, setLocalization] = useState<LocalizationSettings>(defaultLocalization);
  const [preferences, setPreferences] = useState<PreferenceSettings>(defaultPreferences);
  const [appearance, setAppearance] = useState<AppearanceSettings>(defaultAppearance);
  const [hardwareSettings, setHardwareSettings] = useState<HardwareSettings>(defaultHardware);
  const [operatingHours, setOperatingHours] = useState<OperatingHours>(defaultOperatingHours);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(defaultTaxSettings);
  const [roleSettings, setRoleSettings] = useState<RoleSettings>(defaultRoleSettings);
  const [shiftSettings, setShiftSettings] = useState<ShiftSettings>(defaultShiftSettings);
  const [posAlerts, setPosAlerts] = useState<PosAlerts>(defaultPosAlerts);
  const [inventorySettings, setInventorySettings] = useState<InventorySettings>(defaultInventorySettings);
  const [pawnSettings, setPawnSettings] = useState<PawnSettings>(defaultPawnSettings);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    defaultNotificationSettings
  );
  const [maintenanceSettings, setMaintenanceSettings] = useState<MaintenanceSettings>(
    defaultMaintenanceSettings
  );
  const [complianceSettings, setComplianceSettings] = useState<ComplianceSettings>(
    defaultComplianceSettings
  );
  const [ecommerceSettings, setEcommerceSettings] = useState<EcommerceSettings>(
    defaultEcommerceSettings
  );
  const [activeNav, setActiveNav] = useState<string>(NAV_SECTIONS[0].items[0].id);
  const allNavItems = useMemo(() => NAV_SECTIONS.flatMap((section) => section.items), []);
  const activeNavItem = useMemo(
    () => allNavItems.find((item) => item.id === activeNav),
    [allNavItems, activeNav]
  );
  const ActiveNavIcon = activeNavItem?.icon;

  const scopeParams = useMemo<ScopeParams>(() => {
    const parsedBranchId = Number.parseInt(branchId, 10);
    const normalizedBranchId = Number.isFinite(parsedBranchId) && parsedBranchId > 0 ? parsedBranchId : null;
    const parsedUserId = Number.parseInt(userId, 10);
    const normalizedUserId = Number.isFinite(parsedUserId) && parsedUserId > 0 ? parsedUserId : null;

    if (activeScope === "global") {
      return { scope: "global", branchId: null, userId: null };
    }

    if (activeScope === "branch") {
      return { scope: "branch", branchId: normalizedBranchId, userId: null };
    }

    return { scope: "user", branchId: normalizedBranchId, userId: normalizedUserId };
  }, [activeScope, branchId, userId]);

  const scopeValidationError = useMemo(() => {
    if (scopeParams.scope === "branch" || scopeParams.scope === "user") {
      if (scopeParams.branchId == null) {
        return "Debes ingresar una sucursal válida";
      }
    }

    if (scopeParams.scope === "user" && scopeParams.userId == null) {
      return "Debes ingresar un usuario válido";
    }

    return null;
  }, [scopeParams]);

  useEffect(() => {
    let cancelled = false;
    setBranchOptionsLoading(true);
    setBranchOptionsError(null);

    fetch(`${API_BASE_URL}/api/branches`)
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { branches?: BranchOption[]; error?: string };
        if (!response.ok) {
          throw new Error(data?.error ?? "No se pudieron cargar las sucursales");
        }

        const options = (data.branches ?? []).map((branch) => ({
          id: Number(branch.id),
          name: branch.name,
          code: branch.code ?? null,
        }));

        if (!cancelled) {
          setBranchOptions(options);
          if (options.length > 0) {
            setPrimaryBranchId((current) => (current ? current : String(options[0].id)));
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBranchOptionsError(error instanceof Error ? error.message : "No se pudieron cargar las sucursales");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBranchOptionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      if (scopeValidationError) {
        throw new Error(scopeValidationError);
      }

      const params = new URLSearchParams();
      params.set("scope", scopeParams.scope);
      if (scopeParams.branchId != null) {
        params.set("branchId", String(scopeParams.branchId));
      }
      if (scopeParams.userId != null) {
        params.set("userId", String(scopeParams.userId));
      }

      const response = await fetch(`${API_BASE_URL}/api/settings?${params.toString()}`);
      const data = (await response.json()) as SettingsResponse<unknown>;
      if (!response.ok) {
        throw new Error((data as { error?: string })?.error ?? "No se pudieron obtener las configuraciones");
      }

      const entries = data.entries ?? [];
      applyEntries(entries);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al cargar configuración";
      setStatus({ tone: "error", message });

      if (message !== scopeValidationError) {
        setTenders(defaultTenders);
        setDrawerConfig(defaultDrawer);
        setReceiptConfig(defaultReceipt);
        setProviders({
          sms: { values: { apiKey: "", apiSecret: "" }, masked: false },
          whatsapp: { values: { accountSid: "", authToken: "" }, masked: false },
          email: { values: { smtpHost: "", smtpUser: "", smtpPassword: "" }, masked: false },
        });
        setSystemSettings(defaultSystemSettings);
        setCompanyProfile(defaultCompanyProfile);
        setLocalization(defaultLocalization);
        setPreferences(defaultPreferences);
        setAppearance(defaultAppearance);
        setHardwareSettings(defaultHardware);
        setOperatingHours(defaultOperatingHours);
        setTaxSettings(defaultTaxSettings);
        setRoleSettings(defaultRoleSettings);
        setShiftSettings(defaultShiftSettings);
        setPosAlerts(defaultPosAlerts);
        setInventorySettings(defaultInventorySettings);
        setPawnSettings(defaultPawnSettings);
        setNotificationSettings(defaultNotificationSettings);
        setMaintenanceSettings(defaultMaintenanceSettings);
        setComplianceSettings(defaultComplianceSettings);
        setEcommerceSettings(defaultEcommerceSettings);
      }
    } finally {
      setLoading(false);
    }
  }, [scopeParams, scopeValidationError]);

  useEffect(() => {
    fetchSettings().catch(() => undefined);
  }, [fetchSettings]);

  const applyEntries = (entries: MaskedSettingEntry<unknown>[]) => {
    entries.forEach((entry) => {
      if (entry.key === "system.activeBranchId") {
        if (entry.value != null) {
          const numeric = Number(entry.value);
          setPrimaryBranchId(Number.isFinite(numeric) && numeric > 0 ? String(Math.trunc(numeric)) : "");
        } else {
          setPrimaryBranchId("");
        }
      } else if (entry.key === "system.settings" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<SystemSettings>;
        setSystemSettings({
          pawnEnabled: Boolean(raw.pawnEnabled ?? defaultSystemSettings.pawnEnabled),
          businessDate:
            typeof raw.businessDate === "string"
              ? raw.businessDate
              : defaultSystemSettings.businessDate,
        });
      } else if (entry.key === "company.profile" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<CompanyProfile>;
        setCompanyProfile({
          name: typeof raw.name === "string" ? raw.name : defaultCompanyProfile.name,
          iconUrl: typeof raw.iconUrl === "string" ? raw.iconUrl : defaultCompanyProfile.iconUrl,
          address: typeof raw.address === "string" ? raw.address : defaultCompanyProfile.address,
          rnc: typeof raw.rnc === "string" ? raw.rnc : defaultCompanyProfile.rnc,
        });
      } else if (entry.key === "localization.settings" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<LocalizationSettings>;
        setLocalization({
          currencySymbol:
            raw.currencySymbol === "RD$" || raw.currencySymbol === "$"
              ? raw.currencySymbol
              : defaultLocalization.currencySymbol,
        });
      } else if (entry.key === "user.preferences" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<PreferenceSettings>;
        setPreferences({
          language: typeof raw.language === "string" ? raw.language : defaultPreferences.language,
          decimalFormat:
            raw.decimalFormat === "1.234,56" ? "1.234,56" : "1,234.56",
          showShortcuts: Boolean(raw.showShortcuts ?? defaultPreferences.showShortcuts),
        });
      } else if (entry.key === "appearance.settings" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<AppearanceSettings>;
        const theme = raw.theme === "dark" ? "dark" : "light";
        setAppearance({
          theme,
          dashboardLayout: raw.dashboardLayout === "summary" ? "summary" : "command",
        });
        // Sync with theme provider
        setCurrentTheme(theme);
      } else if (entry.key === "hardware.settings" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<HardwareSettings & { defaultPrinter?: string }>;
        // Handle backward compatibility: if defaultPrinter exists, migrate to printerForAll
        const printerForAll = raw.printerForAll ?? (raw.defaultPrinter || defaultHardware.printerForAll);
        setHardwareSettings({
          printerForAll: typeof printerForAll === "string" ? printerForAll : defaultHardware.printerForAll,
          printerTypeForAll: raw.printerTypeForAll === "ECP/P2" || raw.printerTypeForAll === "80mm" ? raw.printerTypeForAll : defaultHardware.printerTypeForAll,
          printerForSales: typeof raw.printerForSales === "string" ? raw.printerForSales : defaultHardware.printerForSales,
          printerTypeForSales: raw.printerTypeForSales === "ECP/P2" || raw.printerTypeForSales === "80mm" ? raw.printerTypeForSales : defaultHardware.printerTypeForSales,
          printerForRefunds: typeof raw.printerForRefunds === "string" ? raw.printerForRefunds : defaultHardware.printerForRefunds,
          printerTypeForRefunds: raw.printerTypeForRefunds === "ECP/P2" || raw.printerTypeForRefunds === "80mm" ? raw.printerTypeForRefunds : defaultHardware.printerTypeForRefunds,
          printerForBuys: typeof raw.printerForBuys === "string" ? raw.printerForBuys : defaultHardware.printerForBuys,
          printerTypeForBuys: raw.printerTypeForBuys === "ECP/P2" || raw.printerTypeForBuys === "80mm" ? raw.printerTypeForBuys : defaultHardware.printerTypeForBuys,
          printerForPawns: typeof raw.printerForPawns === "string" ? raw.printerForPawns : defaultHardware.printerForPawns,
          printerTypeForPawns: raw.printerTypeForPawns === "ECP/P2" || raw.printerTypeForPawns === "80mm" ? raw.printerTypeForPawns : defaultHardware.printerTypeForPawns,
          printerForLayaways: typeof raw.printerForLayaways === "string" ? raw.printerForLayaways : defaultHardware.printerForLayaways,
          printerTypeForLayaways: raw.printerTypeForLayaways === "ECP/P2" || raw.printerTypeForLayaways === "80mm" ? raw.printerTypeForLayaways : defaultHardware.printerTypeForLayaways,
          printerForPurchases: typeof raw.printerForPurchases === "string" ? raw.printerForPurchases : defaultHardware.printerForPurchases,
          printerTypeForPurchases: raw.printerTypeForPurchases === "ECP/P2" || raw.printerTypeForPurchases === "80mm" ? raw.printerTypeForPurchases : defaultHardware.printerTypeForPurchases,
          printerForRepairs: typeof raw.printerForRepairs === "string" ? raw.printerForRepairs : defaultHardware.printerForRepairs,
          printerTypeForRepairs: raw.printerTypeForRepairs === "ECP/P2" || raw.printerTypeForRepairs === "80mm" ? raw.printerTypeForRepairs : defaultHardware.printerTypeForRepairs,
          printerForGiftCards: typeof raw.printerForGiftCards === "string" ? raw.printerForGiftCards : defaultHardware.printerForGiftCards,
          printerTypeForGiftCards: raw.printerTypeForGiftCards === "ECP/P2" || raw.printerTypeForGiftCards === "80mm" ? raw.printerTypeForGiftCards : defaultHardware.printerTypeForGiftCards,
          drawerModel: typeof raw.drawerModel === "string" ? raw.drawerModel : defaultHardware.drawerModel,
          prePrintedPawnPaper: Boolean(raw.prePrintedPawnPaper ?? defaultHardware.prePrintedPawnPaper),
        });
      } else if (entry.key === "operating.hours" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<OperatingHours & { weekday?: string; weekend?: string }>;
        
        // Backward compatibility: migrate old weekday/weekend format
        const migrateDay = (oldValue: string | undefined, defaultDay: OperatingHours["monday"]) => {
          if (oldValue && typeof oldValue === "string") {
            const match = oldValue.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
            if (match) {
              return { open: match[1], close: match[2], closed: false };
            }
          }
          return defaultDay;
        };
        
        setOperatingHours({
          monday: raw.monday && typeof raw.monday === "object" && "open" in raw.monday
            ? {
                open: typeof raw.monday.open === "string" ? raw.monday.open : defaultOperatingHours.monday.open,
                close: typeof raw.monday.close === "string" ? raw.monday.close : defaultOperatingHours.monday.close,
                closed: Boolean(raw.monday.closed ?? defaultOperatingHours.monday.closed),
              }
            : migrateDay(raw.weekday, defaultOperatingHours.monday),
          tuesday: raw.tuesday && typeof raw.tuesday === "object" && "open" in raw.tuesday
            ? {
                open: typeof raw.tuesday.open === "string" ? raw.tuesday.open : defaultOperatingHours.tuesday.open,
                close: typeof raw.tuesday.close === "string" ? raw.tuesday.close : defaultOperatingHours.tuesday.close,
                closed: Boolean(raw.tuesday.closed ?? defaultOperatingHours.tuesday.closed),
              }
            : migrateDay(raw.weekday, defaultOperatingHours.tuesday),
          wednesday: raw.wednesday && typeof raw.wednesday === "object" && "open" in raw.wednesday
            ? {
                open: typeof raw.wednesday.open === "string" ? raw.wednesday.open : defaultOperatingHours.wednesday.open,
                close: typeof raw.wednesday.close === "string" ? raw.wednesday.close : defaultOperatingHours.wednesday.close,
                closed: Boolean(raw.wednesday.closed ?? defaultOperatingHours.wednesday.closed),
              }
            : migrateDay(raw.weekday, defaultOperatingHours.wednesday),
          thursday: raw.thursday && typeof raw.thursday === "object" && "open" in raw.thursday
            ? {
                open: typeof raw.thursday.open === "string" ? raw.thursday.open : defaultOperatingHours.thursday.open,
                close: typeof raw.thursday.close === "string" ? raw.thursday.close : defaultOperatingHours.thursday.close,
                closed: Boolean(raw.thursday.closed ?? defaultOperatingHours.thursday.closed),
              }
            : migrateDay(raw.weekday, defaultOperatingHours.thursday),
          friday: raw.friday && typeof raw.friday === "object" && "open" in raw.friday
            ? {
                open: typeof raw.friday.open === "string" ? raw.friday.open : defaultOperatingHours.friday.open,
                close: typeof raw.friday.close === "string" ? raw.friday.close : defaultOperatingHours.friday.close,
                closed: Boolean(raw.friday.closed ?? defaultOperatingHours.friday.closed),
              }
            : migrateDay(raw.weekday, defaultOperatingHours.friday),
          saturday: raw.saturday && typeof raw.saturday === "object" && "open" in raw.saturday
            ? {
                open: typeof raw.saturday.open === "string" ? raw.saturday.open : defaultOperatingHours.saturday.open,
                close: typeof raw.saturday.close === "string" ? raw.saturday.close : defaultOperatingHours.saturday.close,
                closed: Boolean(raw.saturday.closed ?? defaultOperatingHours.saturday.closed),
              }
            : migrateDay(raw.weekend, defaultOperatingHours.saturday),
          sunday: raw.sunday && typeof raw.sunday === "object" && "open" in raw.sunday
            ? {
                open: typeof raw.sunday.open === "string" ? raw.sunday.open : defaultOperatingHours.sunday.open,
                close: typeof raw.sunday.close === "string" ? raw.sunday.close : defaultOperatingHours.sunday.close,
                closed: Boolean(raw.sunday.closed ?? defaultOperatingHours.sunday.closed),
              }
            : migrateDay(raw.weekend, defaultOperatingHours.sunday),
        });
      } else if (entry.key === "tax.config" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<TaxSettings>;
        setTaxSettings({
          taxIncluded: Boolean(raw.taxIncluded ?? defaultTaxSettings.taxIncluded),
          taxRate: Number(raw.taxRate ?? defaultTaxSettings.taxRate),
        });
      } else if (entry.key === "users.roles" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<RoleSettings>;
        setRoleSettings({
          roles: Array.isArray(raw.roles)
            ? raw.roles.map((role) => ({
                id: typeof (role as { id?: string }).id === "string" ? (role as { id: string }).id : "role",
                label:
                  typeof (role as { label?: string }).label === "string"
                    ? (role as { label: string }).label
                    : "Role",
                enabled: Boolean((role as { enabled?: boolean }).enabled),
              }))
            : defaultRoleSettings.roles,
          limits: {
            refunds: Number(raw?.limits?.refunds ?? defaultRoleSettings.limits.refunds),
            paidOuts: Number(raw?.limits?.paidOuts ?? defaultRoleSettings.limits.paidOuts),
          },
          scopes: {
            pos: Boolean(raw?.scopes?.pos ?? defaultRoleSettings.scopes.pos),
            cash: Boolean(raw?.scopes?.cash ?? defaultRoleSettings.scopes.cash),
            inventory: Boolean(raw?.scopes?.inventory ?? defaultRoleSettings.scopes.inventory),
            repairs: Boolean(raw?.scopes?.repairs ?? defaultRoleSettings.scopes.repairs),
            reportsAdmin: Boolean(raw?.scopes?.reportsAdmin ?? defaultRoleSettings.scopes.reportsAdmin),
            reportsNormal: Boolean(raw?.scopes?.reportsNormal ?? defaultRoleSettings.scopes.reportsNormal),
            accounting: Boolean(raw?.scopes?.accounting ?? defaultRoleSettings.scopes.accounting),
            settings: Boolean(raw?.scopes?.settings ?? defaultRoleSettings.scopes.settings),
          },
        });
      } else if (entry.key === "shift.policy" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<ShiftSettings>;
        setShiftSettings({
          overShortTolerance: Number(raw.overShortTolerance ?? defaultShiftSettings.overShortTolerance),
          autoLockMinutes: Number(raw.autoLockMinutes ?? defaultShiftSettings.autoLockMinutes),
        });
      } else if (entry.key === "pos.alerts" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<PosAlerts & { closureRecipients?: string }>;
        // Handle backward compatibility: if old closureRecipients exists, migrate to email
        const migratedEmail = raw.closureRecipientsEmail ?? 
          ((raw.closureRecipients && raw.closureRecipients.includes("@") ? raw.closureRecipients : "") ||
          defaultPosAlerts.closureRecipientsEmail);
        const migratedWhatsApp = raw.closureRecipientsWhatsApp ?? 
          ((raw.closureRecipients && !raw.closureRecipients.includes("@") ? raw.closureRecipients : "") ||
          defaultPosAlerts.closureRecipientsWhatsApp);
        
        setPosAlerts({
          suggestDrops: Boolean(raw.suggestDrops ?? defaultPosAlerts.suggestDrops),
          refundPercent: Number(raw.refundPercent ?? defaultPosAlerts.refundPercent),
          maxPaidOut: Number(raw.maxPaidOut ?? defaultPosAlerts.maxPaidOut),
          closureRecipientsEmail:
            typeof migratedEmail === "string" ? migratedEmail : defaultPosAlerts.closureRecipientsEmail,
          closureRecipientsWhatsApp:
            typeof migratedWhatsApp === "string" ? migratedWhatsApp : defaultPosAlerts.closureRecipientsWhatsApp,
          expenseCategory:
            typeof raw.expenseCategory === "string"
              ? raw.expenseCategory
              : defaultPosAlerts.expenseCategory,
          incomeCategory:
            typeof raw.incomeCategory === "string"
              ? raw.incomeCategory
              : defaultPosAlerts.incomeCategory,
        });
      } else if (entry.key === "inventory.settings" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<InventorySettings>;
        setInventorySettings({
          lowStockThreshold: Number(raw.lowStockThreshold ?? defaultInventorySettings.lowStockThreshold),
          autoGenerateSkus: Boolean(raw.autoGenerateSkus ?? defaultInventorySettings.autoGenerateSkus),
          quarantineEnabled: Boolean(raw.quarantineEnabled ?? defaultInventorySettings.quarantineEnabled),
        });
      } else if (entry.key === "pawn.settings" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<PawnSettings & { graceDays?: number }>;
        setPawnSettings({
          interestModelCode:
            typeof raw.interestModelCode === "string"
              ? raw.interestModelCode
              : defaultPawnSettings.interestModelCode,
          graceDays: raw.graceDays !== undefined ? Number(raw.graceDays) : 5, // Default to 5 if not set
          alertRule:
            typeof raw.alertRule === "string" ? raw.alertRule : defaultPawnSettings.alertRule,
          mobileApiKey:
            typeof raw.mobileApiKey === "string" ? raw.mobileApiKey : defaultPawnSettings.mobileApiKey ?? "",
        });
      } else if (entry.key === "notifications.settings" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<NotificationSettings>;
        setNotificationSettings({
          eventChannels: Array.isArray(raw.eventChannels)
            ? raw.eventChannels.filter((value): value is string => typeof value === "string")
            : defaultNotificationSettings.eventChannels,
          whatsappAgentEnabled: Boolean(
            raw.whatsappAgentEnabled ?? defaultNotificationSettings.whatsappAgentEnabled
          ),
          messagingIntegrations:
            typeof raw.messagingIntegrations === "string"
              ? raw.messagingIntegrations
              : defaultNotificationSettings.messagingIntegrations,
          aiAutomationNotes:
            typeof raw.aiAutomationNotes === "string"
              ? raw.aiAutomationNotes
              : defaultNotificationSettings.aiAutomationNotes,
          agentManualNotes:
            typeof raw.agentManualNotes === "string"
              ? raw.agentManualNotes
              : defaultNotificationSettings.agentManualNotes,
        });
      } else if (entry.key === "maintenance.settings" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<MaintenanceSettings>;
        setMaintenanceSettings({
          backupFrequency:
            typeof raw.backupFrequency === "string"
              ? raw.backupFrequency
              : defaultMaintenanceSettings.backupFrequency,
          logRetentionDays: Number(raw.logRetentionDays ?? defaultMaintenanceSettings.logRetentionDays),
          backupIdentificador: typeof raw.backupIdentificador === "string" ? raw.backupIdentificador : defaultMaintenanceSettings.backupIdentificador,
          backupFolderPath: typeof raw.backupFolderPath === "string" ? raw.backupFolderPath : defaultMaintenanceSettings.backupFolderPath,
          awsAccessKeyId: typeof raw.awsAccessKeyId === "string" ? raw.awsAccessKeyId : defaultMaintenanceSettings.awsAccessKeyId,
          awsSecretAccessKey: typeof raw.awsSecretAccessKey === "string" ? raw.awsSecretAccessKey : defaultMaintenanceSettings.awsSecretAccessKey,
          awsRegion: typeof raw.awsRegion === "string" ? raw.awsRegion : defaultMaintenanceSettings.awsRegion,
          awsBucket: typeof raw.awsBucket === "string" ? raw.awsBucket : defaultMaintenanceSettings.awsBucket,
          autoCloudSync: Boolean(raw.autoCloudSync ?? defaultMaintenanceSettings.autoCloudSync),
        });
      } else if (entry.key === "compliance.settings" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<ComplianceSettings>;
        setComplianceSettings({
          cameraViewEnabled: Boolean(raw.cameraViewEnabled ?? defaultComplianceSettings.cameraViewEnabled),
          transactionStamping: Boolean(
            raw.transactionStamping ?? defaultComplianceSettings.transactionStamping
          ),
          blockId: Boolean(raw.blockId ?? defaultComplianceSettings.blockId),
          idImagesPath: String(raw.idImagesPath ?? defaultComplianceSettings.idImagesPath),
        });
      } else if (entry.key === "ecommerce.settings" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<EcommerceSettings>;
        setEcommerceSettings({
          inventorySyncMinutes: Number(raw.inventorySyncMinutes ?? defaultEcommerceSettings.inventorySyncMinutes),
          orderSyncMinutes: Number(raw.orderSyncMinutes ?? defaultEcommerceSettings.orderSyncMinutes),
        });
      } else if (entry.key === "pos.tenders" && Array.isArray(entry.value)) {
        setTenders(
          entry.value.map((raw) => ({
            code: typeof raw.code === "string" ? raw.code : "",
            label: typeof raw.label === "string" ? raw.label : "",
            enabled: Boolean((raw as { enabled?: boolean }).enabled),
          }))
        );
      } else if (entry.key === "pos.drawer" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<DrawerConfig>;
        setDrawerConfig({
          maxOverShortCents: Number(raw.maxOverShortCents ?? defaultDrawer.maxOverShortCents),
          requirePin: Boolean(raw.requirePin ?? defaultDrawer.requirePin),
          allowBlindOpen: Boolean(raw.allowBlindOpen ?? defaultDrawer.allowBlindOpen),
          autoOpenOn: Array.isArray(raw.autoOpenOn)
            ? raw.autoOpenOn.filter((value): value is string => typeof value === "string")
            : defaultDrawer.autoOpenOn,
          manualOpenPin:
            typeof raw.manualOpenPin === "string"
              ? raw.manualOpenPin
              : defaultDrawer.manualOpenPin,
        });
      } else if (entry.key === "pos.receipt" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<ReceiptConfig>;
        setReceiptConfig({
          header: typeof raw.header === "string" ? raw.header : defaultReceipt.header,
          footer: typeof raw.footer === "string" ? raw.footer : defaultReceipt.footer,
          showLogo: Boolean(raw.showLogo ?? defaultReceipt.showLogo),
          showTaxBreakdown: Boolean(raw.showTaxBreakdown ?? defaultReceipt.showTaxBreakdown),
          autoPrint: Boolean(raw.autoPrint ?? defaultReceipt.autoPrint),
          includeRefundDetails: Boolean(raw.includeRefundDetails ?? defaultReceipt.includeRefundDetails),
          includePaidOuts: Boolean(raw.includePaidOuts ?? defaultReceipt.includePaidOuts),
        });
      } else {
        const providerEntry = (Object.entries(providerKeys) as [ProviderKey, string][])
          .find(([, key]) => key === entry.key);
        if (providerEntry) {
          const [provider] = providerEntry;
          if (entry.masked) {
            setProviders((state) => ({
              ...state,
              [provider]: {
                values: Object.fromEntries(Object.keys(providerFieldLabels[provider]).map((field) => [field, ""])) as Record<string, string>,
                masked: true,
              },
            }));
          } else if (entry.value && typeof entry.value === "object") {
            const raw = entry.value as Record<string, unknown>;
            setProviders((state) => ({
              ...state,
              [provider]: {
                values: Object.fromEntries(
                  Object.keys(providerFieldLabels[provider]).map((field) => [field, typeof raw[field] === "string" ? (raw[field] as string) : ""])
                ) as Record<string, string>,
                masked: false,
              },
            }));
          }
        }
      }
    });
  };

  const updateTender = (index: number, partial: Partial<TenderConfig>) => {
    setTenders((current) =>
      current.map((tender, idx) => (idx === index ? { ...tender, ...partial } : tender))
    );
  };

  const addTender = () => {
    setTenders((current) => [...current, { code: "", label: "", enabled: true }]);
  };

  const removeTender = (index: number) => {
    setTenders((current) => current.filter((_, idx) => idx !== index));
  };

  const toggleDrawerAutoOpen = (mode: string) => {
    setDrawerConfig((state) => {
      const exists = state.autoOpenOn.includes(mode);
      return {
        ...state,
        autoOpenOn: exists
          ? state.autoOpenOn.filter((value) => value !== mode)
          : [...state.autoOpenOn, mode],
      };
    });
  };

  const updateProviderField = (provider: ProviderKey, field: string, value: string) => {
    setProviders((state) => ({
      ...state,
      [provider]: {
        values: { ...state[provider].values, [field]: value },
        masked: false,
      },
    }));
  };

  const toggleEventChannel = (channel: string) => {
    setNotificationSettings((state) => {
      const exists = state.eventChannels.includes(channel);
      return {
        ...state,
        eventChannels: exists
          ? state.eventChannels.filter((value) => value !== channel)
          : [...state.eventChannels, channel],
      };
    });
  };

  const toggleRoleScope = (scope: keyof RoleScopes) => {
    setRoleSettings((state) => ({
      ...state,
      scopes: { ...state.scopes, [scope]: !state.scopes[scope] },
    }));
  };

  const toggleRoleEnabled = (roleId: string) => {
    setRoleSettings((state) => ({
      ...state,
      roles: state.roles.map((role) =>
        role.id === roleId ? { ...role, enabled: !role.enabled } : role
      ),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const parsedPrimary = Number(primaryBranchId);
      if (!Number.isInteger(parsedPrimary) || parsedPrimary <= 0) {
        throw new Error("Selecciona una sucursal principal válida");
      }

      const entries: Array<{ key: string; value: unknown }> = [
        { key: "system.activeBranchId", value: parsedPrimary },
        { key: "system.settings", value: systemSettings },
        { key: "company.profile", value: companyProfile },
        { key: "localization.settings", value: localization },
        { key: "user.preferences", value: preferences },
        { key: "appearance.settings", value: appearance },
        { key: "hardware.settings", value: hardwareSettings },
        { key: "operating.hours", value: operatingHours },
        { key: "tax.config", value: taxSettings },
        { key: "users.roles", value: roleSettings },
        { key: "shift.policy", value: shiftSettings },
        { key: "pos.tenders", value: tenders },
        { key: "pos.drawer", value: drawerConfig },
        { key: "pos.receipt", value: receiptConfig },
        { key: "pos.alerts", value: posAlerts },
        { key: "inventory.settings", value: inventorySettings },
        { key: "pawn.settings", value: { ...pawnSettings, graceDays: pawnSettings.graceDays ?? 5 } },
        { key: "notifications.settings", value: notificationSettings },
        { key: "maintenance.settings", value: maintenanceSettings },
        { key: "compliance.settings", value: complianceSettings },
        { key: "ecommerce.settings", value: ecommerceSettings },
      ];

      (Object.keys(providerKeys) as ProviderKey[]).forEach((provider) => {
        const form = providers[provider];
        const hasContent = Object.values(form.values).some((value) => value.trim() !== "");
        if (hasContent) {
          entries.push({ key: providerKeys[provider], value: form.values });
        }
      });

      if (scopeValidationError) {
        throw new Error(scopeValidationError);
      }

      const payload: Record<string, unknown> = {
        scope: scopeParams.scope,
        entries,
      };
      if (scopeParams.branchId != null) {
        payload.branchId = scopeParams.branchId;
      }
      if (scopeParams.userId != null) {
        payload.userId = scopeParams.userId;
      }

      const response = await fetch(`${API_BASE_URL}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudo guardar la configuración");
      }

      setStatus({ tone: "success", message: "Configuración guardada correctamente" });
      applyEntries(data.entries ?? []);
      
      // Restart backup scheduler if maintenance settings were saved
      if (entries.some((e) => e.key === "maintenance.settings")) {
        try {
          await fetch(`${API_BASE_URL}/api/backup/restart-scheduler`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          // Ignore scheduler restart errors - settings are still saved
          console.error("Failed to restart backup scheduler:", error);
        }
      }
      
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("active-branch:updated"));
      }
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrinter = async (printerName: string, printerType: "ECP/P2" | "80mm") => {
    if (!printerName.trim()) {
      setStatus({ tone: "error", message: "Ingresa un nombre de impresora para probar" });
      return;
    }

    try {
      // For now, we'll just show a success message
      // In the future, this could call an API endpoint to actually test the printer
      setStatus({
        tone: "success",
        message: `Comando de prueba enviado a ${printerName} (${printerType})`,
      });
      
      // TODO: Implement actual printer test API call
      // await fetch(`${API_BASE_URL}/api/printers/test`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ printer: printerName, type: printerType }),
      // });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Error al probar la impresora",
      });
    }
  };

  const handleProviderTest = async (provider: ProviderKey) => {
    const form = providers[provider];
    const requiredFields = Object.keys(providerFieldLabels[provider]);
    const missing = requiredFields.filter((field) => !form.values[field]?.trim());

    if (scopeValidationError) {
      setStatus({ tone: "error", message: scopeValidationError });
      return;
    }

    if (!form.masked && missing.length > 0) {
      setStatus({ tone: "error", message: "Faltan campos requeridos para la prueba" });
      return;
    }

    setStatus(null);

    setSaving(true);
    try {
      const body: Record<string, unknown> = { provider };

      body.scope = scopeParams.scope;

      if (scopeParams.branchId != null) {
        body.branchId = scopeParams.branchId;
      }

      if (scopeParams.userId != null) {
        body.userId = scopeParams.userId;
      }

      if (form.masked && missing.length > 0) {
        body.useStored = true;
      } else {
        body.credentials = form.values;
      }

      const response = await fetch(`${API_BASE_URL}/api/settings/providers/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Prueba fallida");
      }
      setStatus({
        tone: "success",
        message:
          data?.mode === "stored"
            ? `Proveedor ${provider} validado con las credenciales guardadas`
            : `Proveedor ${provider} validado correctamente`,
      });
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error al probar proveedor" });
    } finally {
      setSaving(false);
    }
  };

  const renderActiveContent = () => {
    switch (activeNav) {
      case "system-settings":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="primary-branch">
                Sucursal principal
              </label>
              {branchOptionsLoading ? (
                <span className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando sucursales…
                </span>
              ) : branchOptionsError ? (
                <span className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {branchOptionsError}
                </span>
              ) : (
                <select
                  id="primary-branch"
                  value={primaryBranchId}
                  onChange={(event) => setPrimaryBranchId(event.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {branchOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-muted-foreground">
                Esta sucursal se aplicará en el POS, préstamos, layaway y operaciones que requieren una ubicación fija.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Módulo de empeños</p>
                <p className="text-xs text-muted-foreground">
                  Controla si el flujo de empeños está disponible en el POS y reportes.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={systemSettings.pawnEnabled}
                  onChange={(event) =>
                    setSystemSettings((state) => ({ ...state, pawnEnabled: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border border-border"
                />
                Activo
              </label>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="business-date">
                Fecha operativa
              </label>
              <input
                type="date"
                id="business-date"
                value={systemSettings.businessDate}
                onChange={(event) =>
                  setSystemSettings((state) => ({ ...state, businessDate: event.target.value }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        );
      case "company-settings":
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="company-name">
                Nombre comercial
              </label>
              <input
                id="company-name"
                value={companyProfile.name}
                onChange={(event) =>
                  setCompanyProfile((state) => ({ ...state, name: event.target.value }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Mi Casa de Empeño"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="company-icon">
                URL del icono
              </label>
              <input
                id="company-icon"
                value={companyProfile.iconUrl}
                onChange={(event) =>
                  setCompanyProfile((state) => ({ ...state, iconUrl: event.target.value }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="https://cdn.example.com/icon.png"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="company-rnc">
                RNC
              </label>
              <input
                id="company-rnc"
                value={companyProfile.rnc}
                onChange={(event) =>
                  setCompanyProfile((state) => ({ ...state, rnc: event.target.value }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="123-45678-9"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="company-address">
                Dirección fiscal
              </label>
              <textarea
                id="company-address"
                value={companyProfile.address}
                onChange={(event) =>
                  setCompanyProfile((state) => ({ ...state, address: event.target.value }))
                }
                className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Calle, número, ciudad"
              />
            </div>
          </div>
        );
      case "localization":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecciona el símbolo de moneda que se mostrará en precios, recibos y reportes.
            </p>
            <div className="flex flex-wrap gap-4">
              {(["RD$", "$"] as const).map((symbol) => (
                <label key={symbol} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="currency-symbol"
                    value={symbol}
                    checked={localization.currencySymbol === symbol}
                    onChange={(event) =>
                      setLocalization({ currencySymbol: event.target.value as LocalizationSettings["currencySymbol"] })
                    }
                    className="h-4 w-4 border border-border"
                  />
                  {symbol}
                </label>
              ))}
            </div>
          </div>
        );
      case "prefixes":
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Prefijos aplicados automáticamente a códigos de órdenes, inventario y clientes.
            </p>
            <div className="flex flex-wrap gap-2">
              {prefixValues.map((prefix) => (
                <span
                  key={prefix}
                  className="rounded-md border border-border bg-muted/60 px-3 py-1 text-sm text-foreground"
                >
                  {prefix}
                </span>
              ))}
            </div>
          </div>
        );
      case "preferences":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="pref-language">
                  Idioma de recibos
                </label>
                <select
                  id="pref-language"
                  value={preferences.language}
                  onChange={(event) =>
                    setPreferences((state) => ({ ...state, language: event.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="es">Español</option>
                  <option value="en">Inglés</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="pref-decimal">
                  Formato decimal
                </label>
                <select
                  id="pref-decimal"
                  value={preferences.decimalFormat}
                  onChange={(event) =>
                    setPreferences((state) => ({
                      ...state,
                      decimalFormat: event.target.value as PreferenceSettings["decimalFormat"],
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="1,234.56">1,234.56</option>
                  <option value="1.234,56">1.234,56</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={preferences.showShortcuts}
                onChange={(event) =>
                  setPreferences((state) => ({ ...state, showShortcuts: event.target.checked }))
                }
                className="h-4 w-4 rounded border border-border"
              />
              Mostrar tips y atajos en los flujos críticos
            </label>
          </div>
        );
      case "appearance":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tema
              </span>
              <div className="flex gap-3">
                {(["light", "dark"] as const).map((theme) => (
                  <label key={theme} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="appearance-theme"
                      value={theme}
                      checked={appearance.theme === theme}
                      onChange={(event) => {
                        const newTheme = event.target.value as AppearanceSettings["theme"];
                        setAppearance((state) => ({ ...state, theme: newTheme }));
                        // Sync with theme provider to update TopBar immediately
                        setCurrentTheme(newTheme);
                      }}
                      className="h-4 w-4 border border-border"
                    />
                    {theme === "light" ? "Claro" : "Oscuro"}
                  </label>
                ))}
              </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="dashboard-layout">
                  Layout del dashboard
                </label>
                <select
                  id="dashboard-layout"
                  value={appearance.dashboardLayout}
                  onChange={(event) =>
                    setAppearance((state) => ({
                      ...state,
                      dashboardLayout: event.target.value as AppearanceSettings["dashboardLayout"],
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="command">Command center</option>
                  <option value="summary">Resumen compacto</option>
                </select>
            </div>
          </div>
        );
      case "hardware":
        return (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="printer-for-all">
                Impresora para todo
              </label>
              <div className="flex gap-2">
                <input
                  id="printer-for-all"
                  value={hardwareSettings.printerForAll}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value) {
                      // If "all" is filled, fill all other fields
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: value,
                        printerForSales: value,
                        printerForRefunds: value,
                        printerForBuys: value,
                        printerForPawns: value,
                        printerForLayaways: value,
                        printerForPurchases: value,
                        printerForRepairs: value,
                        printerForGiftCards: value,
                      }));
                    } else {
                      setHardwareSettings((state) => ({ ...state, printerForAll: value }));
                    }
                  }}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="POS-58"
                />
                <select
                  value={hardwareSettings.printerTypeForAll}
                  onChange={(event) => {
                    const value = event.target.value as "ECP/P2" | "80mm";
                    setHardwareSettings((state) => ({
                      ...state,
                      printerTypeForAll: value,
                      printerTypeForSales: value,
                      printerTypeForRefunds: value,
                      printerTypeForBuys: value,
                      printerTypeForPawns: value,
                      printerTypeForLayaways: value,
                      printerTypeForPurchases: value,
                      printerTypeForRepairs: value,
                      printerTypeForGiftCards: value,
                    }));
                  }}
                  className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="ECP/P2">ECP/P2</option>
                  <option value="80mm">80mm</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleTestPrinter(hardwareSettings.printerForAll, hardwareSettings.printerTypeForAll)}
                  disabled={!hardwareSettings.printerForAll.trim()}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  title="Probar impresora"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Probar
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Si se completa, se aplicará a todas las transacciones. Si cambias una impresora individual, este campo se limpiará.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="printer-sales">
                  Impresora para ventas
                </label>
                <div className="flex gap-2">
                  <input
                    id="printer-sales"
                    value={hardwareSettings.printerForSales}
                    onChange={(event) => {
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: "", // Clear "all" when individual field changes
                        printerForSales: event.target.value,
                      }));
                    }}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="POS-58"
                  />
                  <select
                    value={hardwareSettings.printerTypeForSales}
                    onChange={(event) => {
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: "",
                        printerTypeForSales: event.target.value as "ECP/P2" | "80mm",
                      }));
                    }}
                    className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="ECP/P2">ECP/P2</option>
                    <option value="80mm">80mm</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleTestPrinter(hardwareSettings.printerForSales, hardwareSettings.printerTypeForSales)}
                    disabled={!hardwareSettings.printerForSales.trim()}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    title="Probar impresora"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Probar
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="printer-refunds">
                  Impresora para reembolsos
                </label>
                <div className="flex gap-2">
                  <input
                    id="printer-refunds"
                    value={hardwareSettings.printerForRefunds}
                    onChange={(event) => {
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: "",
                        printerForRefunds: event.target.value,
                      }));
                    }}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="POS-58"
                  />
                  <select
                    value={hardwareSettings.printerTypeForRefunds}
                    onChange={(event) => {
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: "",
                        printerTypeForRefunds: event.target.value as "ECP/P2" | "80mm",
                      }));
                    }}
                    className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="ECP/P2">ECP/P2</option>
                    <option value="80mm">80mm</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleTestPrinter(hardwareSettings.printerForRefunds, hardwareSettings.printerTypeForRefunds)}
                    disabled={!hardwareSettings.printerForRefunds.trim()}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    title="Probar impresora"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Probar
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="printer-buys">
                  Impresora para compras
                </label>
                <div className="flex gap-2">
                  <input
                    id="printer-buys"
                    value={hardwareSettings.printerForBuys}
                    onChange={(event) => {
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: "",
                        printerForBuys: event.target.value,
                      }));
                    }}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="POS-58"
                  />
                  <select
                    value={hardwareSettings.printerTypeForBuys}
                    onChange={(event) => {
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: "",
                        printerTypeForBuys: event.target.value as "ECP/P2" | "80mm",
                      }));
                    }}
                    className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="ECP/P2">ECP/P2</option>
                    <option value="80mm">80mm</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleTestPrinter(hardwareSettings.printerForBuys, hardwareSettings.printerTypeForBuys)}
                    disabled={!hardwareSettings.printerForBuys.trim()}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    title="Probar impresora"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Probar
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="printer-pawns">
                  Impresora para empeños
                </label>
                <div className="flex gap-2">
                  <input
                    id="printer-pawns"
                    value={hardwareSettings.printerForPawns}
                    onChange={(event) => {
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: "",
                        printerForPawns: event.target.value,
                      }));
                    }}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="POS-58"
                  />
                  <select
                    value={hardwareSettings.printerTypeForPawns}
                    onChange={(event) => {
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: "",
                        printerTypeForPawns: event.target.value as "ECP/P2" | "80mm",
                      }));
                    }}
                    className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="ECP/P2">ECP/P2</option>
                    <option value="80mm">80mm</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleTestPrinter(hardwareSettings.printerForPawns, hardwareSettings.printerTypeForPawns)}
                    disabled={!hardwareSettings.printerForPawns.trim()}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    title="Probar impresora"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Probar
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="printer-layaways">
                  Impresora para apartados
                </label>
                <div className="flex gap-2">
                  <input
                    id="printer-layaways"
                    value={hardwareSettings.printerForLayaways}
                    onChange={(event) => {
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: "",
                        printerForLayaways: event.target.value,
                      }));
                    }}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="POS-58"
                  />
                  <select
                    value={hardwareSettings.printerTypeForLayaways}
                    onChange={(event) => {
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: "",
                        printerTypeForLayaways: event.target.value as "ECP/P2" | "80mm",
                      }));
                    }}
                    className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="ECP/P2">ECP/P2</option>
                    <option value="80mm">80mm</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleTestPrinter(hardwareSettings.printerForLayaways, hardwareSettings.printerTypeForLayaways)}
                    disabled={!hardwareSettings.printerForLayaways.trim()}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    title="Probar impresora"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Probar
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="printer-purchases">
                  Impresora para recepciones
                </label>
                <div className="flex gap-2">
                  <input
                    id="printer-purchases"
                    value={hardwareSettings.printerForPurchases}
                    onChange={(event) => {
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: "",
                        printerForPurchases: event.target.value,
                      }));
                    }}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="POS-58"
                  />
                  <select
                    value={hardwareSettings.printerTypeForPurchases}
                    onChange={(event) => {
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: "",
                        printerTypeForPurchases: event.target.value as "ECP/P2" | "80mm",
                      }));
                    }}
                    className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="ECP/P2">ECP/P2</option>
                    <option value="80mm">80mm</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleTestPrinter(hardwareSettings.printerForPurchases, hardwareSettings.printerTypeForPurchases)}
                    disabled={!hardwareSettings.printerForPurchases.trim()}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    title="Probar impresora"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Probar
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="printer-repairs">
                  Impresora para reparaciones
                </label>
                <div className="flex gap-2">
                  <input
                    id="printer-repairs"
                    value={hardwareSettings.printerForRepairs}
                    onChange={(event) => {
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: "",
                        printerForRepairs: event.target.value,
                      }));
                    }}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="POS-58"
                  />
                  <select
                    value={hardwareSettings.printerTypeForRepairs}
                    onChange={(event) => {
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: "",
                        printerTypeForRepairs: event.target.value as "ECP/P2" | "80mm",
                      }));
                    }}
                    className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="ECP/P2">ECP/P2</option>
                    <option value="80mm">80mm</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleTestPrinter(hardwareSettings.printerForRepairs, hardwareSettings.printerTypeForRepairs)}
                    disabled={!hardwareSettings.printerForRepairs.trim()}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    title="Probar impresora"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Probar
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="printer-gift-cards">
                  Impresora para tarjetas de regalo
                </label>
                <div className="flex gap-2">
                  <input
                    id="printer-gift-cards"
                    value={hardwareSettings.printerForGiftCards}
                    onChange={(event) => {
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: "",
                        printerForGiftCards: event.target.value,
                      }));
                    }}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="POS-58"
                  />
                  <select
                    value={hardwareSettings.printerTypeForGiftCards}
                    onChange={(event) => {
                      setHardwareSettings((state) => ({
                        ...state,
                        printerForAll: "",
                        printerTypeForGiftCards: event.target.value as "ECP/P2" | "80mm",
                      }));
                    }}
                    className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="ECP/P2">ECP/P2</option>
                    <option value="80mm">80mm</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleTestPrinter(hardwareSettings.printerForGiftCards, hardwareSettings.printerTypeForGiftCards)}
                    disabled={!hardwareSettings.printerForGiftCards.trim()}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    title="Probar impresora"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Probar
                  </button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="drawer-model">
                  Modelo de gaveta
                </label>
                <input
                  id="drawer-model"
                  value={hardwareSettings.drawerModel}
                  onChange={(event) =>
                    setHardwareSettings((state) => ({ ...state, drawerModel: event.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="APG Serie 4000"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={hardwareSettings.prePrintedPawnPaper}
                onChange={(event) =>
                  setHardwareSettings((state) => ({ ...state, prePrintedPawnPaper: event.target.checked }))
                }
                className="h-4 w-4 rounded border border-border"
              />
              Papel de empeño pre-impreso
            </label>
          </div>
        );
      case "operating-hours":
        const days = [
          { key: "monday", label: "Lunes" },
          { key: "tuesday", label: "Martes" },
          { key: "wednesday", label: "Miércoles" },
          { key: "thursday", label: "Jueves" },
          { key: "friday", label: "Viernes" },
          { key: "saturday", label: "Sábado" },
          { key: "sunday", label: "Domingo" },
        ] as const;

        return (
          <div className="space-y-4">
            {days.map((day) => {
              const dayData = operatingHours[day.key];
              return (
                <div key={day.key} className="flex items-center gap-4 rounded-md border border-border bg-muted/40 p-4">
                  <div className="flex items-center gap-2 min-w-[100px]">
                    <input
                      type="checkbox"
                      checked={!dayData.closed}
                      onChange={(event) =>
                        setOperatingHours((state) => ({
                          ...state,
                          [day.key]: {
                            ...state[day.key],
                            closed: !event.target.checked,
                          },
                        }))
                      }
                      className="h-4 w-4 rounded border border-border"
                    />
                    <label className="text-sm font-medium text-foreground min-w-[80px]">
                      {day.label}
                    </label>
                  </div>
                  {!dayData.closed ? (
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground" htmlFor={`${day.key}-open`}>
                          Apertura
                        </label>
                        <input
                          id={`${day.key}-open`}
                          type="time"
                          value={dayData.open}
                          onChange={(event) =>
                            setOperatingHours((state) => ({
                              ...state,
                              [day.key]: {
                                ...state[day.key],
                                open: event.target.value,
                              },
                            }))
                          }
                          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <span className="text-muted-foreground">-</span>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground" htmlFor={`${day.key}-close`}>
                          Cierre
                        </label>
                        <input
                          id={`${day.key}-close`}
                          type="time"
                          value={dayData.close}
                          onChange={(event) =>
                            setOperatingHours((state) => ({
                              ...state,
                              [day.key]: {
                                ...state[day.key],
                                close: event.target.value,
                              },
                            }))
                          }
                          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Cerrado</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      case "tax-rates":
        return (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={taxSettings.taxIncluded}
                onChange={(event) =>
                  setTaxSettings((state) => ({ ...state, taxIncluded: event.target.checked }))
                }
                className="h-4 w-4 rounded border border-border"
              />
              Los precios incluyen ITBIS
            </label>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="tax-rate">
                Porcentaje ITBIS
              </label>
              <input
                id="tax-rate"
                type="number"
                min={0}
                value={taxSettings.taxRate}
                onChange={(event) =>
                  setTaxSettings((state) => ({ ...state, taxRate: Number(event.target.value) || 0 }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        );
      case "users-roles":
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Roles habilitados</h3>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {roleSettings.roles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={role.enabled}
                      onChange={() => toggleRoleEnabled(role.id)}
                      className="h-4 w-4 rounded border border-border"
                    />
                    {role.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Alcances</h3>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {(Object.keys(roleSettings.scopes) as (keyof RoleScopes)[]).map((scope) => (
                  <label key={scope} className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={roleSettings.scopes[scope]}
                      onChange={() => toggleRoleScope(scope)}
                      className="h-4 w-4 rounded border border-border"
                    />
                    {scopeLabels[scope]}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="limit-refund">
                  Límite de reembolso (RD$)
                </label>
                <input
                  id="limit-refund"
                  type="number"
                  value={roleSettings.limits.refunds}
                  onChange={(event) =>
                    setRoleSettings((state) => ({
                      ...state,
                      limits: { ...state.limits, refunds: Number(event.target.value) || 0 },
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="limit-paidout">
                  Límite de pagos (RD$)
                </label>
                <input
                  id="limit-paidout"
                  type="number"
                  value={roleSettings.limits.paidOuts}
                  onChange={(event) =>
                    setRoleSettings((state) => ({
                      ...state,
                      limits: { ...state.limits, paidOuts: Number(event.target.value) || 0 },
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
        );
      case "shift-settings":
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="shift-tolerance">
                Tolerancia sobre/short (RD$)
              </label>
              <input
                id="shift-tolerance"
                type="number"
                value={shiftSettings.overShortTolerance}
                onChange={(event) =>
                  setShiftSettings((state) => ({
                    ...state,
                    overShortTolerance: Number(event.target.value) || 0,
                  }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="shift-lock">
                Bloquear acceso a caja tras (minutos)
              </label>
              <input
                id="shift-lock"
                type="number"
                value={shiftSettings.autoLockMinutes}
                onChange={(event) =>
                  setShiftSettings((state) => ({
                    ...state,
                    autoLockMinutes: Number(event.target.value) || 0,
                  }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        );
      case "pos-payment-methods":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Define los medios de pago visibles y su estado de habilitación en POS.
            </p>
            <div className="space-y-2">
              {tenders.map((tender, index) => (
                <div
                  key={`${tender.code}-${index}`}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm"
                >
                  <input
                    className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Código"
                    value={tender.code}
                    onChange={(event) => updateTender(index, { code: event.target.value })}
                  />
                  <input
                    className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Etiqueta"
                    value={tender.label}
                    onChange={(event) => updateTender(index, { label: event.target.value })}
                  />
                  <label className="flex items-center gap-1 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={tender.enabled}
                      onChange={(event) => updateTender(index, { enabled: event.target.checked })}
                      className="h-4 w-4 rounded border border-border bg-background"
                    />
                    Habilitado
                  </label>
                  <button
                    type="button"
                    className="text-xs text-rose-400 hover:text-rose-300"
                    onClick={() => removeTender(index)}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground transition hover:bg-muted"
              onClick={addTender}
            >
              Añadir tender
            </button>
          </div>
        );
      case "pos-receipt":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="receipt-header">
                  Encabezado del recibo
                </label>
                <textarea
                  id="receipt-header"
                  className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={receiptConfig.header}
                  onChange={(event) => setReceiptConfig((state) => ({ ...state, header: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="receipt-footer">
                  Pie de recibo
                </label>
                <textarea
                  id="receipt-footer"
                  className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={receiptConfig.footer}
                  onChange={(event) => setReceiptConfig((state) => ({ ...state, footer: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={receiptConfig.showLogo}
                  onChange={(event) =>
                    setReceiptConfig((state) => ({ ...state, showLogo: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border border-border"
                />
                Mostrar logo en el encabezado
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={receiptConfig.showTaxBreakdown}
                  onChange={(event) =>
                    setReceiptConfig((state) => ({ ...state, showTaxBreakdown: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border border-border"
                />
                Incluir desglose de ITBIS
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={receiptConfig.autoPrint}
                  onChange={(event) =>
                    setReceiptConfig((state) => ({ ...state, autoPrint: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border border-border"
                />
                Imprimir automáticamente al finalizar
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={receiptConfig.includeRefundDetails}
                  onChange={(event) =>
                    setReceiptConfig((state) => ({ ...state, includeRefundDetails: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border border-border"
                />
                Mostrar detalle de reembolsos
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={receiptConfig.includePaidOuts}
                  onChange={(event) =>
                    setReceiptConfig((state) => ({ ...state, includePaidOuts: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border border-border"
                />
                Incluir pagos de gastos/egresos
              </label>
            </div>
          </div>
        );
      case "pos-drawer":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="drawer-threshold">
                  Variación máxima (centavos)
                </label>
                <input
                  id="drawer-threshold"
                  value={drawerConfig.maxOverShortCents}
                  onChange={(event) =>
                    setDrawerConfig((state) => ({
                      ...state,
                      maxOverShortCents: Number(event.target.value.replace(/[^0-9]/g, "")) || 0,
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="drawer-pin">
                  PIN de apertura manual
                </label>
                <input
                  id="drawer-pin"
                  value={drawerConfig.manualOpenPin}
                  onChange={(event) =>
                    setDrawerConfig((state) => ({ ...state, manualOpenPin: event.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={drawerConfig.requirePin}
                  onChange={(event) =>
                    setDrawerConfig((state) => ({ ...state, requirePin: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border border-border"
                />
                Requiere PIN en apertura manual
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={drawerConfig.allowBlindOpen}
                  onChange={(event) =>
                    setDrawerConfig((state) => ({ ...state, allowBlindOpen: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border border-border"
                />
                Permitir apertura sin venta
              </label>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Abrir automáticamente en
              </p>
              <div className="flex flex-wrap gap-3">
                {drawerAutoOpenOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={drawerConfig.autoOpenOn.includes(option.value)}
                      onChange={() => toggleDrawerAutoOpen(option.value)}
                      className="h-4 w-4 rounded border border-border"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        );
      case "pos-alerts":
        return (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={posAlerts.suggestDrops}
                onChange={(event) =>
                  setPosAlerts((state) => ({ ...state, suggestDrops: event.target.checked }))
                }
                className="h-4 w-4 rounded border border-border"
              />
              Sugerir drops cuando el efectivo supera el umbral
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="refund-percent">
                  Límite de reembolso (% de la venta)
                </label>
                <input
                  id="refund-percent"
                  type="number"
                  value={posAlerts.refundPercent}
                  onChange={(event) =>
                    setPosAlerts((state) => ({ ...state, refundPercent: Number(event.target.value) || 0 }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="max-paid-out">
                  Máximo pago de gasto (RD$)
                </label>
                <input
                  id="max-paid-out"
                  type="number"
                  value={posAlerts.maxPaidOut}
                  onChange={(event) =>
                    setPosAlerts((state) => ({ ...state, maxPaidOut: Number(event.target.value) || 0 }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
        );
      case "pos-closure":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Define a quién se envía el resumen de cierre por correo electrónico y WhatsApp.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="closure-email">
                Correo electrónico
              </label>
              <input
                id="closure-email"
                type="text"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={posAlerts.closureRecipientsEmail}
              onChange={(event) =>
                  setPosAlerts((state) => ({ ...state, closureRecipientsEmail: event.target.value }))
              }
              placeholder="gerente@tienda.com, supervisor@tienda.com"
            />
              <p className="text-xs text-muted-foreground">
                Separa múltiples correos con comas
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="closure-whatsapp">
                WhatsApp
              </label>
              <input
                id="closure-whatsapp"
                type="text"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={posAlerts.closureRecipientsWhatsApp}
                onChange={(event) =>
                  setPosAlerts((state) => ({ ...state, closureRecipientsWhatsApp: event.target.value }))
                }
                placeholder="+18091234567, +18097654321"
              />
              <p className="text-xs text-muted-foreground">
                Separa múltiples números con comas (formato: +18091234567)
              </p>
            </div>
          </div>
        );
      case "pos-ledger":
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="expense-category">
                Categoría de gasto por defecto
              </label>
              <input
                id="expense-category"
                value={posAlerts.expenseCategory}
                onChange={(event) =>
                  setPosAlerts((state) => ({ ...state, expenseCategory: event.target.value }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="income-category">
                Categoría de ingreso por defecto
              </label>
              <input
                id="income-category"
                value={posAlerts.incomeCategory}
                onChange={(event) =>
                  setPosAlerts((state) => ({ ...state, incomeCategory: event.target.value }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        );
      case "pos-ecommerce":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configura los intervalos de sincronización automática con canales de e-commerce (eBay, Shopify, etc.).
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="inventory-sync-minutes">
                  Sincronización de inventario (minutos)
                </label>
                <input
                  id="inventory-sync-minutes"
                  type="number"
                  min="1"
                  max="1440"
                  value={ecommerceSettings.inventorySyncMinutes}
                  onChange={(event) =>
                    setEcommerceSettings((state) => ({
                      ...state,
                      inventorySyncMinutes: Math.max(1, Math.min(1440, Number(event.target.value) || 15)),
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-muted-foreground">
                  Frecuencia con la que se sincroniza el inventario con los marketplaces (1-1440 minutos)
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="order-sync-minutes">
                  Sincronización de órdenes (minutos)
                </label>
                <input
                  id="order-sync-minutes"
                  type="number"
                  min="1"
                  max="1440"
                  value={ecommerceSettings.orderSyncMinutes}
                  onChange={(event) =>
                    setEcommerceSettings((state) => ({
                      ...state,
                      orderSyncMinutes: Math.max(1, Math.min(1440, Number(event.target.value) || 5)),
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-muted-foreground">
                  Frecuencia con la que se importan nuevas órdenes desde los marketplaces (1-1440 minutos)
                </p>
              </div>
            </div>
          </div>
        );
      case "inventory":
        return (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="low-stock">
                Umbral de alerta de inventario bajo
              </label>
              <input
                id="low-stock"
                type="number"
                value={inventorySettings.lowStockThreshold}
                onChange={(event) =>
                  setInventorySettings((state) => ({
                    ...state,
                    lowStockThreshold: Number(event.target.value) || 0,
                  }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={inventorySettings.autoGenerateSkus}
                  onChange={(event) =>
                    setInventorySettings((state) => ({
                      ...state,
                      autoGenerateSkus: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border border-border"
                />
                Generar SKU automáticos al recibir mercancía
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={inventorySettings.quarantineEnabled}
                  onChange={(event) =>
                    setInventorySettings((state) => ({
                      ...state,
                      quarantineEnabled: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border border-border"
                />
                Habilitar cuarentena automática para ítems observados
              </label>
            </div>
          </div>
        );
      case "inventory-categories":
        return <CategoriesSection />;
      case "pawn-interest":
        return <InterestModelsSection graceDays={pawnSettings.graceDays ?? 5} onGraceDaysChange={(days) => setPawnSettings((state) => ({ ...state, graceDays: days }))} />;
      case "pawn-alerts":
        return (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="pawn-alert">
                Regla de alerta
              </label>
              <textarea
                id="pawn-alert"
                value={pawnSettings.alertRule}
                onChange={(event) =>
                  setPawnSettings((state) => ({ ...state, alertRule: event.target.value }))
                }
                className="min-h-[100px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Ej. Artículos > RD$50k requieren aprobación"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="mobile-api-key">
                MOBILE API
              </label>
              <input
                id="mobile-api-key"
                type="text"
                value={pawnSettings.mobileApiKey ?? ""}
                onChange={(event) =>
                  setPawnSettings((state) => ({ ...state, mobileApiKey: event.target.value }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="TCB-X3M-00N-FPV-GNJ-8F5-OAK-MS8"
              />
              <p className="text-xs text-muted-foreground">
                API key para SickW (verificación de IMEI de celulares)
              </p>
            </div>
          </div>
        );
      case "notifications-events":
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecciona los eventos que enviarán notificaciones automáticas a los clientes.
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {notificationEventOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={notificationSettings.eventChannels.includes(option.value)}
                    onChange={() => toggleEventChannel(option.value)}
                    className="h-4 w-4 rounded border border-border"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        );
      case "notifications-agent":
        return (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={notificationSettings.whatsappAgentEnabled}
                onChange={(event) =>
                  setNotificationSettings((state) => ({
                    ...state,
                    whatsappAgentEnabled: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border border-border"
              />
              Habilitar bot de WhatsApp para respuestas automáticas
            </label>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="agent-notes">
                Notas para el agente manual
              </label>
              <textarea
                id="agent-notes"
                value={notificationSettings.agentManualNotes}
                onChange={(event) =>
                  setNotificationSettings((state) => ({
                    ...state,
                    agentManualNotes: event.target.value,
                  }))
                }
                className="min-h-[100px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Instrucciones para respuestas manuales desde WhatsApp Business"
              />
            </div>
          </div>
        );
      case "notifications-integrations":
        return (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              {(Object.keys(providerKeys) as ProviderKey[]).map((provider) => {
                const fields = providerFieldLabels[provider];
                const form = providers[provider];
                return (
                  <div key={provider} className="space-y-3 rounded-md border border-border bg-background p-3 text-sm shadow-sm">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold uppercase">{provider}</span>
                      {form.masked && <span className="text-muted-foreground">Valor oculto</span>}
                    </div>
                    {Object.entries(fields).map(([field, label]) => (
                      <div key={field} className="space-y-1">
                        <label className="text-[11px] text-muted-foreground" htmlFor={`${provider}-${field}`}>
                          {label}
                        </label>
                        <input
                          id={`${provider}-${field}`}
                          className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={form.values[field] ?? ""}
                          onChange={(event) => updateProviderField(provider, field, event.target.value)}
                          type={field.toLowerCase().includes("password") || field.toLowerCase().includes("secret") ? "password" : "text"}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-foreground transition hover:bg-muted"
                      onClick={() => handleProviderTest(provider)}
                    >
                      Probar proveedor
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="messaging-integrations">
                  Integraciones activas
                </label>
                <input
                  id="messaging-integrations"
                  value={notificationSettings.messagingIntegrations}
                  onChange={(event) =>
                    setNotificationSettings((state) => ({
                      ...state,
                      messagingIntegrations: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Twilio, SendGrid"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="automation-notes">
                  Notas de automatización / IA
                </label>
                <textarea
                  id="automation-notes"
                  value={notificationSettings.aiAutomationNotes}
                  onChange={(event) =>
                    setNotificationSettings((state) => ({
                      ...state,
                      aiAutomationNotes: event.target.value,
                    }))
                  }
                  className="min-h-[100px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Resumen de tickets, respuestas sugeridas, etc."
                />
              </div>
            </div>
          </div>
        );
      case "maintenance-backup":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="backup-frequency">
                  Frecuencia de respaldo
                </label>
                <select
                  id="backup-frequency"
                  value={maintenanceSettings.backupFrequency}
                  onChange={(event) =>
                    setMaintenanceSettings((state) => ({
                      ...state,
                      backupFrequency: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="tres veces al dia">Tres veces al día</option>
                  <option value="dos veces al dia">Dos veces al día</option>
                  <option value="diario">Diario</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensual">Mensual</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="backup-identificador">
                  Identificador
                </label>
                <input
                  id="backup-identificador"
                  type="text"
                  value={maintenanceSettings.backupIdentificador}
                  onChange={(event) =>
                    setMaintenanceSettings((state) => ({
                      ...state,
                      backupIdentificador: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="backup"
                />
                <p className="text-xs text-muted-foreground">
                  Se usará para nombrar los archivos: identificador_YYYY-MM-DD_HH-MM-SS.sql
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="backup-folder-path">
                Ruta de carpeta para respaldos
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Folder className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    id="backup-folder-path"
                    type="text"
                    value={maintenanceSettings.backupFolderPath}
                    onChange={(event) =>
                      setMaintenanceSettings((state) => ({
                        ...state,
                        backupFolderPath: event.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-border bg-background pl-10 pr-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="./backups"
                  />
                </div>
                <div className="relative">
                  <select
                    value=""
                    onChange={(event) => {
                      const selectedValue = event.target.value;
                      if (selectedValue) {
                        setMaintenanceSettings((prevState) => {
                          const newState = {
                            ...prevState,
                            backupFolderPath: selectedValue,
                          };
                          return newState;
                        });
                        // Reset select to show placeholder
                        requestAnimationFrame(() => {
                          (event.target as HTMLSelectElement).value = "";
                        });
                      }
                    }}
                    className="flex items-center gap-2 rounded-md border border-border bg-background pl-4 pr-8 py-2 text-sm font-medium transition hover:bg-muted appearance-none cursor-pointer focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    title="Seleccionar carpeta común"
                  >
                    <option value="" disabled>
                      Seleccionar...
                    </option>
                    <option value="./backups">./backups</option>
                    <option value="./data/backups">./data/backups</option>
                    <option value="/var/backups">/var/backups</option>
                    <option value="C:\\backups">C:\backups</option>
                    <option value="D:\\backups">D:\backups</option>
                  </select>
                  <FolderOpen className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Ruta en el servidor donde se guardarán los archivos de respaldo
              </p>
            </div>
            <div className="space-y-4 rounded-md border border-border bg-muted/40 p-4">
              <h3 className="text-sm font-medium">Configuración AWS S3</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="aws-access-key">
                    AWS Access Key ID
                  </label>
                  <input
                    id="aws-access-key"
                    type="text"
                    value={maintenanceSettings.awsAccessKeyId}
                    onChange={(event) =>
                      setMaintenanceSettings((state) => ({
                        ...state,
                        awsAccessKeyId: event.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="aws-secret-key">
                    AWS Secret Access Key
                  </label>
                  <input
                    id="aws-secret-key"
                    type="password"
                    value={maintenanceSettings.awsSecretAccessKey}
                    onChange={(event) =>
                      setMaintenanceSettings((state) => ({
                        ...state,
                        awsSecretAccessKey: event.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="aws-region">
                    AWS Region
                  </label>
                  <input
                    id="aws-region"
                    type="text"
                    value={maintenanceSettings.awsRegion}
                    onChange={(event) =>
                      setMaintenanceSettings((state) => ({
                        ...state,
                        awsRegion: event.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="us-east-1"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="aws-bucket">
                    AWS S3 Bucket
                  </label>
                  <input
                    id="aws-bucket"
                    type="text"
                    value={maintenanceSettings.awsBucket}
                    onChange={(event) =>
                      setMaintenanceSettings((state) => ({
                        ...state,
                        awsBucket: event.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="my-backup-bucket"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={maintenanceSettings.autoCloudSync}
                  onChange={(event) =>
                    setMaintenanceSettings((state) => ({ ...state, autoCloudSync: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border border-border"
                />
                Sincronizar automáticamente con AWS S3 después de crear respaldo
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    setStatus({ tone: "info", message: "Creando respaldo..." });
                    const response = await fetch(`${API_BASE_URL}/api/backup/create`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                    });
                    if (!response.ok) {
                      const error = await response.json().catch(() => ({ error: "Error desconocido" }));
                      throw new Error(error.error || "Error al crear respaldo");
                    }
                    const data = await response.json();
                    setStatus({
                      tone: "success",
                      message: `Respaldo creado exitosamente: ${data.filename}`,
                    });
                  } catch (error) {
                    setStatus({
                      tone: "error",
                      message: error instanceof Error ? error.message : "Error al crear respaldo",
                    });
                  }
                }}
                className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted"
              >
                <Save className="h-4 w-4" />
                Crear respaldo ahora
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Define cómo se almacenan los respaldos y quién recibe confirmaciones.
            </p>
          </div>
        );
      case "maintenance-logs":
        return (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="log-retention">
              Días de retención de logs
            </label>
            <input
              id="log-retention"
              type="number"
              value={maintenanceSettings.logRetentionDays}
              onChange={(event) =>
                setMaintenanceSettings((state) => ({
                  ...state,
                  logRetentionDays: Number(event.target.value) || 0,
                }))
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        );
      case "compliance-camera":
        return (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={complianceSettings.cameraViewEnabled}
                onChange={(event) =>
                  setComplianceSettings((state) => ({
                    ...state,
                    cameraViewEnabled: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border border-border"
              />
              Mostrar vista de cámaras en pantallas sensibles
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={complianceSettings.transactionStamping}
                onChange={(event) =>
                  setComplianceSettings((state) => ({
                    ...state,
                    transactionStamping: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border border-border"
              />
              Sellar transacciones con hora y operador
            </label>
          </div>
        );
      case "compliance-block-id":
        return (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={complianceSettings.blockId}
              onChange={(event) =>
                setComplianceSettings((state) => ({
                  ...state,
                  blockId: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border border-border"
            />
            Bloquear clientes con identificación marcada como restringida
          </label>
        );
      case "compliance-id-images-path":
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Ruta de carpeta de imágenes de cédula
            </label>
            <input
              type="text"
              value={complianceSettings.idImagesPath}
              onChange={(event) =>
                setComplianceSettings((state) => ({
                  ...state,
                  idImagesPath: event.target.value,
                }))
              }
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ruta donde se almacenan las imágenes de cédula. El formato de nombre debe ser: {"{cedula_no_sin_guiones}_0001.jpeg"} (frente) y {"{cedula_no_sin_guiones}_0002.jpeg"} (reverso).
            </p>
          </div>
        );
      default:
        return (
          <p className="text-sm text-muted-foreground">Selecciona una sección de la lista izquierda.</p>
        );
    }
  };

  const renderScopeControls = () => {
    if (activeScope === "global") {
      return null;
    }

    return (
      <div className="flex w-full flex-col gap-2 text-sm text-foreground md:w-auto">
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Branch ID</span>
            <input
              className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value.replace(/[^0-9]/g, ""))}
            />
          </label>
          {activeScope === "user" && (
            <label className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">User ID</span>
              <input
                className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={userId}
                onChange={(event) => setUserId(event.target.value.replace(/[^0-9]/g, ""))}
              />
            </label>
          )}
        </div>
        {scopeValidationError && (
          <p className="text-xs text-destructive">{scopeValidationError}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary">
          <Settings2 className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Configuración</span>
        </div>
        <h1 className="text-3xl font-semibold text-foreground">Parámetros del sistema</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Ajusta la configuración POS y las credenciales de notificaciones por alcance (global, sucursal, usuario).
        </p>
      </header>

      {status && (
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
            status.tone === "success"
              ? "border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-rose-500/40 bg-rose-50 text-rose-700 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200"
          }`}
        >
          {status.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertCircle className="mt-0.5 h-4 w-4" />}
          <span>{status.message}</span>
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[260px,1fr]">
        <aside className="space-y-6 overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-sm lg:max-h-[calc(100vh-12rem)]">
          {NAV_SECTIONS.map((section) => (
            <div key={section.heading} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.heading}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveNav(item.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-transparent text-foreground hover:border-border hover:bg-muted/60"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          className={`h-4 w-4 ${
                            isActive ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        <div className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="space-y-4 border-b border-border pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-2">
                {(
                  [
                    { id: "global", label: "Global" },
                    { id: "branch", label: "Sucursal" },
                    { id: "user", label: "Usuario" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveScope(tab.id)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      activeScope === tab.id
                        ? "bg-primary text-primary-foreground shadow"
                        : "border border-border bg-muted text-foreground hover:bg-muted/80"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex w-full flex-col gap-3 text-sm md:flex-row md:items-center md:justify-end">
                {renderScopeControls()}
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => fetchSettings()}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                  Recargar
                </button>
              </div>
            </div>

            {activeNavItem && (
              <div className="flex items-start gap-3">
                {ActiveNavIcon && <ActiveNavIcon className="mt-0.5 h-5 w-5 text-primary" />}
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{activeNavItem.label}</h2>
                  <p className="text-sm text-muted-foreground">{activeNavItem.description}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">{renderActiveContent()}</div>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => fetchSettings()}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Deshacer cambios
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar configuración
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
