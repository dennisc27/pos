"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  AppWindow,
  Camera,
  CreditCard,
  Headphones,
  Laptop,
  Landmark,
  Search,
  ShieldX,
  Shirt,
  Smartphone,
  Watch,
  X,
  Loader2,
  AlertCircle,
  Package
} from "lucide-react";

import { ProductGallery } from "@/components/pos/product-gallery";
import { OrderPanel } from "@/components/pos/order-panel";
import { ReceiptPreview } from "@/components/pos/receipt-preview";
import { formatCurrency } from "@/components/pos/utils";
import type { CartLine, SaleSummary, TenderBreakdown, Product, ProductCategory } from "@/components/pos/types";
import { useActiveBranch } from "@/components/providers/active-branch-provider";
import { formatDateForDisplay } from "@/lib/utils";
import { AddCustomerDialog } from "@/components/customer/add-customer-dialog";

const TENDER_METHODS = ["cash", "card", "transfer", "store_credit", "gift"] as const;
type TenderMethod = (typeof TENDER_METHODS)[number];
type NonCashTenderMethod = Exclude<TenderMethod, "cash">;

const TENDER_LABELS: Record<TenderMethod, string> = {
  cash: "Cash drawer",
  card: "Card (Azul)",
  transfer: "Bank transfer",
  store_credit: "Store credit",
  gift: "Gift card"
};

const TENDER_DEFAULT_STATUS: Record<TenderMethod, TenderBreakdown["status"]> = {
  cash: "captured",
  card: "pending",
  transfer: "pending",
  store_credit: "captured",
  gift: "pending"
};

const DEFAULT_TAX_RATE = 0.18;
const WALK_IN_CUSTOMER = "Walk-in customer";
const WALK_IN_DESCRIPTOR = "Default walk-in profile";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type TaxSettings = {
  taxIncluded: boolean;
  taxRate: number;
};
const PAYMENT_METHOD_MAP: Record<TenderBreakdown["method"], "cash" | "card" | "transfer" | "gift_card" | "credit_note"> = {
  cash: "cash",
  card: "card",
  transfer: "transfer",
  store_credit: "credit_note",
  gift: "gift_card",
};

const CATEGORY_ICON_SEQUENCE = [
  Smartphone,
  Watch,
  Headphones,
  Laptop,
  Camera,
  Shirt,
  Landmark,
  CreditCard
];

const DEFAULT_CATEGORY: ProductCategory = { id: "all", label: "All products", icon: AppWindow };

const initialCartLines: CartLine[] = [];

const initialTenderBreakdown: TenderBreakdown[] = [];

type InventoryResponseItem = {
  productCodeId: number;
  productCodeVersionId: number;
  code: string | null;
  name: string | null;
  sku: string | null;
  description: string | null;
  categoryId: number | null;
  priceCents: number | null;
  availableQty: number | null;
  qtyOnHand: number | null;
};

function mapInventoryItems(items: InventoryResponseItem[] | undefined): Product[] {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  return items
    .filter((item) => {
      // Only include items that have a valid productCodeVersionId
      // productCodeId is not sufficient - we need the version ID
      return item.productCodeVersionId != null && item.productCodeVersionId > 0;
    })
    .map((item) => {
      const versionId = item.productCodeVersionId!; // We've filtered out nulls above
      const availableQty = Number(item.availableQty ?? item.qtyOnHand ?? 0);

      return {
        id: String(versionId),
        name: item.name ?? item.code ?? "Unnamed product",
        sku: item.sku ?? item.code ?? `SKU-${versionId}`,
        categoryId: item.categoryId != null ? String(item.categoryId) : "uncategorized",
        price: Math.max(0, Number(item.priceCents ?? 0)) / 100,
        stock: availableQty,
        highlight: availableQty <= 1 ? "Low stock" : undefined,
        previewLabel: (item.code ?? item.name ?? "").slice(0, 2).toUpperCase(),
        variant: item.description ?? undefined,
      } satisfies Product;
    });
}

type CustomerSearchResult = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  lastActivityAt: string | null;
};

function buildSummary(items: CartLine[], tenders: TenderBreakdown[], taxRate: number = DEFAULT_TAX_RATE): SaleSummary {
  // Calculate subtotal as base price (price / (1 + tax_rate)) rounded to 2 decimals per line item
  // This ensures price changes are reflected in the totals
  const subtotal = items.reduce((sum, item) => {
    const rate = item.taxRate ?? taxRate;
    const unitPrice = Math.max(item.price, 0);
    // Calculate base price per unit: price / (1 + tax_rate)
    const unitBase = unitPrice / (1 + rate);
    // Round to 2 decimals, then multiply by quantity and add to sum
    const lineBase = Math.round(unitBase * 100) / 100 * item.qty;
    return sum + lineBase;
  }, 0);
  
  // Round total subtotal to 2 decimals
  const roundedSubtotal = Math.round(subtotal * 100) / 100;
  
  // Calculate discounts: difference between list price and actual selling price
  const discounts = items.reduce((sum, item) => {
    const listUnit = item.listPrice ?? item.price;
    const unitDiscount = Math.max(0, listUnit - item.price);
    return sum + unitDiscount * item.qty;
  }, 0);
  
  // Calculate total price (includes tax)
  const totalPrice = items.reduce((sum, item) => sum + Math.max(item.price, 0) * item.qty, 0);
  
  // ITBIS = total price - subtotal
  const tax = Math.round((totalPrice - roundedSubtotal) * 100) / 100;
  
  // Total = total price (prices already include tax)
  const total = totalPrice;
  const nonCashTendered = tenders.reduce((sum, tender) => sum + tender.amount, 0);
  const cappedNonCash = Math.min(nonCashTendered, total);
  const cashDue = Math.max(total - cappedNonCash, 0);

  return {
    subtotal: roundedSubtotal,
    discounts,
    tax,
    total,
    balanceDue: cashDue,
    cashDue,
    nonCashTendered: cappedNonCash
  };
}

function parseAmount(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(/\s+/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (!normalized) {
    return null;
  }

  const value = normalized.includes(",") && !normalized.includes(".")
    ? normalized.replace(",", ".")
    : normalized.replace(/,/g, "");

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export default function PosPage() {
  const { branch: activeBranch, loading: branchLoading, error: branchError } = useActiveBranch();
  const [taxSettings, setTaxSettings] = useState<TaxSettings>({ taxIncluded: true, taxRate: DEFAULT_TAX_RATE });
  const [categories, setCategories] = useState<ProductCategory[]>([DEFAULT_CATEGORY]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(DEFAULT_CATEGORY.id);
  const [searchTerm, setSearchTerm] = useState("");
  const [cartLines, setCartLines] = useState<CartLine[]>(initialCartLines);
  const [tenderBreakdown, setTenderBreakdown] = useState<TenderBreakdown[]>(initialTenderBreakdown);
  const [customerName, setCustomerName] = useState(WALK_IN_CUSTOMER);
  const [customerDialogMode, setCustomerDialogMode] = useState<"change" | "add" | null>(null);
  const [customerInput, setCustomerInput] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerDescriptor, setCustomerDescriptor] = useState(WALK_IN_DESCRIPTOR);
  const [customerSearchResults, setCustomerSearchResults] = useState<CustomerSearchResult[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null);
  const [isPaymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [finalizeState, setFinalizeState] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [finalizeMessage, setFinalizeMessage] = useState<string | null>(null);
  const [isSuccessDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successInvoiceId, setSuccessInvoiceId] = useState<string | null>(null);
  const [isInventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [isLoadingFullInventory, setIsLoadingFullInventory] = useState(false);
  const [fullInventory, setFullInventory] = useState<Product[]>([]);
  const [fullInventoryError, setFullInventoryError] = useState<string | null>(null);
  const [inventoryModalSearch, setInventoryModalSearch] = useState("");
  const [inventoryModalCategory, setInventoryModalCategory] = useState<string>("all");
  const [isCreditNoteDialogOpen, setCreditNoteDialogOpen] = useState(false);
  const [creditNotes, setCreditNotes] = useState<Array<{ id: number; balanceCents: number; reason: string | null; createdAt: string | null }>>([]);
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
  const [isLoadingCreditNotes, setIsLoadingCreditNotes] = useState(false);
  const [creditNoteError, setCreditNoteError] = useState<string | null>(null);
  const [pendingTenderAmount, setPendingTenderAmount] = useState<number>(0);
  const [isLayawayDialogOpen, setIsLayawayDialogOpen] = useState(false);
  const [layawayDueDate, setLayawayDueDate] = useState<string>("");
  const [layawayTermOption, setLayawayTermOption] = useState<"1month" | "3months" | "manual">("1month");
  const [layawayFirstPayment, setLayawayFirstPayment] = useState<string>("");
  const [layawayPaymentMethod, setLayawayPaymentMethod] = useState<"cash" | "card" | "transfer">("cash");
  const [isCreatingLayaway, setIsCreatingLayaway] = useState(false);
  const [layawayError, setLayawayError] = useState<string | null>(null);
  const [isLayawaySuccessDialogOpen, setIsLayawaySuccessDialogOpen] = useState(false);
  const [layawaySuccessMessage, setLayawaySuccessMessage] = useState<string | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);

  // Load tax settings from database
  useEffect(() => {
    const loadTaxSettings = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/settings?scope=global&keys=tax.config`);
        if (response.ok) {
          const data = await response.json();
          const taxEntry = data.entries?.find((entry: { key: string }) => entry.key === "tax.config");
          if (taxEntry?.value) {
            // Tax rate is stored as percentage (e.g., 18 for 18%), convert to decimal (0.18)
            const taxRatePercent = Number(taxEntry.value.taxRate ?? DEFAULT_TAX_RATE * 100);
            setTaxSettings({
              taxIncluded: Boolean(taxEntry.value.taxIncluded ?? true),
              taxRate: taxRatePercent / 100,
            });
          }
        }
      } catch (error) {
        console.error("Failed to load tax settings:", error);
        // Keep default values
      }
    };
    loadTaxSettings();
  }, []);

  const resolveProductVersionId = useCallback((productId: string) => {
    const numeric = Number(productId);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
  }, []);

  const loadInventory = useCallback(
    async (options?: { signal?: AbortSignal }) => {
      if (!activeBranch?.id) {
        return;
      }

      try {
        setIsLoadingProducts(true);
        setProductError(null);
        const params = new URLSearchParams({
          page: "1",
          pageSize: "60",
          status: "active",
          availability: "in_stock",
          branchId: String(activeBranch.id),
        });
        const response = await fetch(`${API_BASE_URL}/api/inventory?${params.toString()}`, {
          signal: options?.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load inventory (${response.status})`);
        }

        const payload: {
          items?: InventoryResponseItem[];
          categoryOptions?: Array<{ id: number | null; name: string | null }>;
        } = await response.json();

        if (options?.signal?.aborted) {
          return;
        }

        const mappedProducts = mapInventoryItems(payload.items);

        setProducts(mappedProducts);

        const backendCategories = payload.categoryOptions ?? [];
        const mappedCategories: ProductCategory[] = [DEFAULT_CATEGORY];

        backendCategories.forEach((category, index) => {
          const id = category.id != null ? String(category.id) : `cat-${index + 1}`;
          if (mappedCategories.some((entry) => entry.id === id)) {
            return;
          }
          const Icon = CATEGORY_ICON_SEQUENCE[index % CATEGORY_ICON_SEQUENCE.length] ?? AppWindow;
          mappedCategories.push({
            id,
            label: category.name ?? `Category ${index + 1}`,
            icon: Icon,
          });
        });

        setCategories(mappedCategories);
      } catch (error) {
        console.error("Failed to load inventory for POS", error);
        if (!options?.signal?.aborted) {
          setProductError("Unable to load inventory from the server.");
        }
      } finally {
        if (!options?.signal?.aborted) {
          setIsLoadingProducts(false);
        }
      }
    },
    [activeBranch?.id]
  );

  useEffect(() => {
    if (!activeBranch?.id) {
      return;
    }

    const controller = new AbortController();
    loadInventory({ signal: controller.signal });

    return () => {
      controller.abort();
    };
  }, [loadInventory, activeBranch?.id]);

  // Clear cart when branch changes to prevent cross-branch issues
  useEffect(() => {
    if (activeBranch?.id && cartLines.length > 0) {
      setCartLines([]);
      setTenderBreakdown([]);
    }
  }, [activeBranch?.id]);

  const loadFullInventory = useCallback(async () => {
    try {
      setIsLoadingFullInventory(true);
      setFullInventoryError(null);

      const params = new URLSearchParams({
        page: "1",
        pageSize: "250",
        status: "active",
        availability: "all",
      });

      const response = await fetch(`${API_BASE_URL}/api/inventory?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to load full inventory (${response.status})`);
      }

      const payload: { items?: InventoryResponseItem[] } = await response.json();
      setFullInventory(mapInventoryItems(payload.items));
    } catch (error) {
      console.error("Failed to load full inventory for POS", error);
      setFullInventoryError("Unable to load full inventory. Try again.");
    } finally {
      setIsLoadingFullInventory(false);
    }
  }, []);

  const handleCloseInventoryModal = useCallback(() => {
    setInventoryModalOpen(false);
    setInventoryModalSearch("");
    setInventoryModalCategory("all");
  }, []);

  useEffect(() => {
    if (!isInventoryModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCloseInventoryModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCloseInventoryModal, isInventoryModalOpen]);

  const createLineFromProduct = useCallback((product: Product): CartLine => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    qty: 1,
    price: product.price,
    listPrice: product.price,
    taxRate: taxSettings.taxRate,
    variant: product.variant,
    status: product.highlight ? "featured" : undefined
  }), [taxSettings.taxRate]);

  const addProductToCart = useCallback(
    (product: Product) => {
      setStockError(null);
      
      setCartLines((previous) => {
        const existing = previous.find((line) => line.id === product.id);
        
        if (existing) {
          // Calculate available stock: product stock minus current quantity in cart
          const qtyInCart = existing.qty;
          const availableStock = Math.max(0, product.stock - qtyInCart);
          
          if (availableStock <= 0) {
            setStockError(`No stock available for ${product.name}`);
            setTimeout(() => setStockError(null), 3000);
            return previous;
          }
          
          // Increment quantity, but cap at available stock
          const newQty = qtyInCart + 1;
          if (newQty > product.stock) {
            setStockError(`Only ${product.stock} available in stock for ${product.name}`);
            setTimeout(() => setStockError(null), 3000);
            return previous.map((line) =>
              line.id === product.id ? { ...line, qty: product.stock } : line
            );
          }
          
          return previous.map((line) =>
            line.id === product.id ? { ...line, qty: newQty } : line
          );
        }

        // Adding new product to cart
        if (product.stock <= 0) {
          setStockError(`No stock available for ${product.name}`);
          setTimeout(() => setStockError(null), 3000);
          return previous;
        }

        return [createLineFromProduct(product), ...previous];
      });
    },
    [createLineFromProduct]
  );

  const clearCart = useCallback(() => {
    setCartLines([]);
    setTenderBreakdown([]);
    setCustomerName(WALK_IN_CUSTOMER);
    setCustomerDescriptor(WALK_IN_DESCRIPTOR);
    setSelectedCustomerId(null);
    setFinalizeState("idle");
    setFinalizeMessage(null);
  }, []);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = activeCategoryId === "all" || product.categoryId === activeCategoryId;
      if (!matchesCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = `${product.name} ${product.sku} ${product.variant ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [activeCategoryId, products, searchTerm]);

  const saleSummary = useMemo(() => buildSummary(cartLines, tenderBreakdown, taxSettings.taxRate), [cartLines, tenderBreakdown, taxSettings.taxRate]);

  const handleToggleProduct = useCallback(
    (product: Product) => {
      setStockError(null);
      
      setCartLines((previous) => {
        const existing = previous.find((line) => line.id === product.id);
        if (existing) {
          return previous.filter((line) => line.id !== product.id);
        }

        // Check stock before adding
        if (product.stock <= 0) {
          setStockError(`No stock available for ${product.name}`);
          setTimeout(() => setStockError(null), 3000);
          return previous;
        }

        return [createLineFromProduct(product), ...previous];
      });
    },
    [createLineFromProduct]
  );

  const handleRemoveLine = useCallback((lineId: string) => {
    setCartLines((previous) => previous.filter((line) => line.id !== lineId));
  }, []);

  const handleQuantityChange = useCallback((lineId: string, quantity: number) => {
    setStockError(null);
    
    // Find the product to check available stock
    const product = products.find((p) => p.id === lineId);
    if (!product) {
      // If product not found, allow the change (might be a custom item)
      setCartLines((previous) =>
        previous.map((line) => (line.id === lineId ? { ...line, qty: Math.max(1, quantity) } : line))
      );
      return;
    }

    // Each product appears at most once in the cart, so available stock is simply product.stock
    const availableStock = product.stock;

    // If quantity exceeds available stock, cap it and show error
    if (quantity > availableStock) {
      const maxAllowed = Math.max(1, availableStock);
      setStockError(
        availableStock > 0
          ? `Only ${availableStock} available in stock for ${product.name}`
          : `No stock available for ${product.name}`
      );
      
      // Clear error after 3 seconds
      setTimeout(() => setStockError(null), 3000);
      
      setCartLines((previous) =>
        previous.map((line) => (line.id === lineId ? { ...line, qty: maxAllowed } : line))
      );
      return;
    }

    // Valid quantity, update normally
    setCartLines((previous) =>
      previous.map((line) => (line.id === lineId ? { ...line, qty: Math.max(1, quantity) } : line))
    );
  }, [products]);

  const handlePriceChange = useCallback(
    async (lineId: string, price: number) => {
      if (!Number.isFinite(price) || price <= 0) {
        return;
      }

      const line = cartLines.find((item) => item.id === lineId);
      if (!line) {
        return;
      }

      const referencePrice = line.listPrice ?? line.price;
      const requiresApproval = price < referencePrice * 0.9;

      if (requiresApproval) {
        if (typeof window === "undefined") {
          return;
        }

        const managerPin = window.prompt("Manager PIN required for discounts over 10%", "");
        if (!managerPin) {
          return;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/api/cart/price-override`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              lineItemId: lineId,
              overridePriceCents: Math.round(price * 100),
              reason: `Discount on ${line.name}`,
              managerPin,
            }),
          });

          if (!response.ok) {
            throw new Error(`Approval failed with status ${response.status}`);
          }

          const payload: { approved?: boolean } = await response.json();
          if (!payload.approved) {
            throw new Error("Approval denied");
          }
        } catch (error) {
          console.error("Manager override failed", error);
          window.alert("Manager approval failed. Discount was not applied.");
          return;
        }
      }

      setCartLines((previous) =>
        previous.map((item) => (item.id === lineId ? { ...item, price } : item))
      );
    },
    [cartLines]
  );

  const handleAddTender = useCallback(
    ({ method, amount, reference, creditNoteId }: { method: TenderBreakdown["method"]; amount: number; reference?: string; creditNoteId?: number }) => {
      setTenderBreakdown((previous) => [
        ...previous,
        {
          id: `tender-${Date.now()}`,
          method,
          label: TENDER_LABELS[method],
          amount,
          reference,
          creditNoteId,
          status: TENDER_DEFAULT_STATUS[method]
        }
      ]);
    },
    []
  );

  // Get list of credit note IDs already used in tenders
  const usedCreditNoteIds = useMemo(() => {
    return new Set(
      tenderBreakdown
        .filter((tender) => tender.method === "store_credit" && tender.creditNoteId != null)
        .map((tender) => tender.creditNoteId!)
    );
  }, [tenderBreakdown]);

  const loadCreditNotes = useCallback(async (customerId: number) => {
    setIsLoadingCreditNotes(true);
    setCreditNoteError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}`);
      if (!response.ok) {
        throw new Error(`Failed to load customer (${response.status})`);
      }
      const data = await response.json();
      // Filter out credit notes that are already used and have no balance
      const activeNotes = (data.creditNotes?.notes ?? []).filter(
        (note: { id: number; balanceCents: number }) =>
          note.balanceCents > 0 && !usedCreditNoteIds.has(note.id)
      );
      setCreditNotes(activeNotes);
    } catch (error) {
      console.error("Failed to load credit notes", error);
      setCreditNoteError(error instanceof Error ? error.message : "Unable to load credit notes");
    } finally {
      setIsLoadingCreditNotes(false);
    }
  }, [usedCreditNoteIds]);

  const handleAddTenderWithCreditNoteCheck = useCallback(
    ({ method, amount, reference }: { method: TenderBreakdown["method"]; amount: number; reference?: string }) => {
      if (method === "store_credit") {
        if (!selectedCustomerId) {
          alert("Please select a customer first to use store credit.");
          return;
        }
        setPendingTenderAmount(amount);
        setCreditNoteDialogOpen(true);
        // loadCreditNotes will automatically filter out already-used credit notes
        void loadCreditNotes(selectedCustomerId);
      } else {
        handleAddTender({ method, amount, reference });
      }
    },
    [selectedCustomerId, handleAddTender, loadCreditNotes]
  );

  const handleSelectCreditNote = useCallback(
    (creditNote: { id: number; balanceCents: number }) => {
      const amount = Math.min(creditNote.balanceCents / 100, pendingTenderAmount);
      handleAddTender({
        method: "store_credit",
        amount,
        creditNoteId: creditNote.id,
      });
      setCreditNoteDialogOpen(false);
      setPendingTenderAmount(0);
      setCreditNotes([]);
    },
    [pendingTenderAmount, handleAddTender]
  );

  const handleAdjustTender = useCallback((tenderId: string) => {
    if (typeof window === "undefined") {
      return;
    }

    setTenderBreakdown((previous) => {
      const tender = previous.find((item) => item.id === tenderId);
      if (!tender) {
        return previous;
      }

      const amountInput = window.prompt(
        `Adjust amount for ${tender.label}`,
        tender.amount.toFixed(2)
      );

      if (amountInput === null) {
        return previous;
      }

      const nextAmount = parseAmount(amountInput);
      if (nextAmount === null) {
        return previous;
      }

      let reference = tender.reference;
      if (tender.method === "card" || tender.method === "transfer") {
        const referenceInput = window.prompt(
          "Update authorization/reference (optional)",
          tender.reference ?? ""
        );

        if (referenceInput !== null) {
          const trimmed = referenceInput.trim();
          reference = trimmed ? trimmed : undefined;
        }
      }

      return previous.map((item) =>
        item.id === tenderId
          ? {
              ...item,
              amount: nextAmount,
              reference
            }
          : item
      );
    });
  }, []);

  const handleRemoveTender = useCallback((tenderId: string) => {
    setTenderBreakdown((previous) => previous.filter((item) => item.id !== tenderId));
  }, []);

  useEffect(() => {
    setFinalizeState("idle");
    setFinalizeMessage(null);
  }, [cartLines, tenderBreakdown]);

  const handleOpenPaymentDialog = useCallback(() => {
    setPaymentDialogOpen(true);
  }, []);

  const handleClosePaymentDialog = useCallback(() => {
    setPaymentDialogOpen(false);
  }, []);

  const handleFinalizeSale = useCallback(async () => {
    if (cartLines.length === 0) {
      setFinalizeState("error");
      setFinalizeMessage("Cart is empty. Scan an item to continue.");
      return;
    }

    if (!activeBranch) {
      setFinalizeState("error");
      setFinalizeMessage(
        branchError ?? "Configura una sucursal activa en ajustes para poder registrar ventas."
      );
      return;
    }

    try {
      setFinalizeState("processing");
      setFinalizeMessage("Creating order...");

      const orderResponse = await fetch(`${API_BASE_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branchId: activeBranch.id,
          userId: 7,   // Cajera Principal
          customerId: selectedCustomerId,
          items: cartLines.map((line) => ({
            productCodeVersionId: resolveProductVersionId(line.id),
            qty: line.qty,
            unitPriceCents: Math.round(line.price * 100),
            taxRate: line.taxRate ?? taxSettings.taxRate,
          })),
          taxRate: taxSettings.taxRate,
        }),
      });

      if (!orderResponse.ok) {
        throw new Error(`Order creation failed (${orderResponse.status})`);
      }

      const order = await orderResponse.json();

      setFinalizeMessage("Issuing invoice...");

      const invoiceResponse = await fetch(`${API_BASE_URL}/api/invoices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
          taxRate: taxSettings.taxRate,
        }),
      });

      if (!invoiceResponse.ok) {
        throw new Error(`Invoice creation failed (${invoiceResponse.status})`);
      }

      const invoice = await invoiceResponse.json();

      // Get active shift for the branch to associate payments
      let activeShiftId: number | null = null;
      try {
        const shiftResponse = await fetch(`${API_BASE_URL}/api/shifts/active?branchId=${activeBranch.id}`);
        if (shiftResponse.ok) {
          const shiftData = await shiftResponse.json();
          activeShiftId = shiftData.shift?.id ?? null;
        }
      } catch {
        // If shift lookup fails, continue without shiftId
      }

      const hasCashTender = tenderBreakdown.some((item) => item.method === "cash");
      const tenderLines = hasCashTender || saleSummary.cashDue <= 0
        ? tenderBreakdown
        : [
            ...tenderBreakdown,
            {
              id: "auto-cash",
              method: "cash" as TenderBreakdown["method"],
              label: TENDER_LABELS.cash,
              amount: saleSummary.cashDue,
              status: "captured" as TenderBreakdown["status"],
            },
          ];

      for (const tender of tenderLines) {
        if (tender.amount <= 0) {
          continue;
        }

        const method = PAYMENT_METHOD_MAP[tender.method];

        if (method === "gift_card") {
          throw new Error("Finalize flow does not support gift cards yet");
        }

        setFinalizeMessage(`Recording ${tender.label.toLowerCase()} payment...`);

        // Build payment meta
        let paymentMeta: { reference?: string; creditNoteId?: number } | null = null;
        if (tender.reference) {
          paymentMeta = { reference: tender.reference };
        }
        if (method === "credit_note" && tender.creditNoteId) {
          paymentMeta = paymentMeta || {};
          paymentMeta.creditNoteId = tender.creditNoteId;
        }

        const paymentPayload: {
          invoiceId: number;
          orderId: number;
          method: string;
          amountCents: number;
          shiftId?: number;
          meta?: { reference?: string; creditNoteId?: number } | null;
        } = {
          invoiceId: invoice.id,
          orderId: order.id,
          method,
          amountCents: Math.round(tender.amount * 100),
          meta: paymentMeta,
        };

        // Add shiftId if available
        if (activeShiftId !== null) {
          paymentPayload.shiftId = activeShiftId;
        }

        const paymentResponse = await fetch(`${API_BASE_URL}/api/payments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(paymentPayload),
        });

        if (!paymentResponse.ok) {
          throw new Error(`Payment failed (${paymentResponse.status})`);
        }
      }

      setFinalizeMessage("Queuing receipt and kicking drawer...");

      const printResponse = await fetch(`${API_BASE_URL}/api/receipts/${invoice.id}/print`, {
        method: "POST",
      });

      if (!printResponse.ok) {
        throw new Error(`Receipt print failed (${printResponse.status})`);
      }

      const printPayload = await printResponse.json();

      // Close payment dialog and show success
      setPaymentDialogOpen(false);
      setFinalizeState("success");
      setFinalizeMessage(printPayload.message ?? "Drawer opened and receipt queued.");
      setSuccessInvoiceId(invoice.number ?? null);
      setSuccessDialogOpen(true);

      // Refresh inventory so available quantities reflect the completed sale
      await loadInventory();
      if (isInventoryModalOpen) {
        await loadFullInventory();
      }
    } catch (error) {
      console.error("Finalize sale failed", error);
      setFinalizeState("error");
      setFinalizeMessage("Unable to finalize sale. Review server logs and try again.");
    }
  }, [
    activeBranch,
    branchError,
    cartLines,
    isInventoryModalOpen,
    loadFullInventory,
    loadInventory,
    resolveProductVersionId,
    saleSummary.cashDue,
    selectedCustomerId,
    tenderBreakdown,
  ]);

  const handleCloseSuccessDialog = useCallback(() => {
    setSuccessDialogOpen(false);
    clearCart();
  }, [clearCart]);

  const calculateDueDate = useCallback((months: number): string => {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split("T")[0];
  }, []);

  const handleOpenLayawayDialog = useCallback(() => {
    // Always open the dialog, but set error messages if validation fails
    // This ensures the user gets feedback about what's wrong
    
    // Set default to 1 month
    setLayawayTermOption("1month");
    setLayawayDueDate(calculateDueDate(1));

    // Validate and set error messages
    if (cartLines.length === 0) {
      setLayawayError("Cart is empty. Add items to create a layaway.");
    } else if (!selectedCustomerId) {
      setLayawayError("A customer must be selected to create a layaway.");
    } else if (!activeBranch) {
      setLayawayError(
        branchError ?? "Configura una sucursal activa en ajustes para poder registrar ventas."
      );
    } else {
      setLayawayError(null);
    }

    setIsLayawayDialogOpen(true);
  }, [cartLines.length, selectedCustomerId, activeBranch, branchError, calculateDueDate]);

  const handleCloseLayawayDialog = useCallback(() => {
    setIsLayawayDialogOpen(false);
    setLayawayDueDate("");
    setLayawayTermOption("1month");
    setLayawayFirstPayment("");
    setLayawayPaymentMethod("cash");
    setLayawayError(null);
    setIsCreatingLayaway(false);
  }, []);

  const handleLayawayTermChange = useCallback((option: "1month" | "3months" | "manual") => {
    setLayawayTermOption(option);
    if (option === "1month") {
      setLayawayDueDate(calculateDueDate(1));
    } else if (option === "3months") {
      setLayawayDueDate(calculateDueDate(3));
    } else {
      // For manual, set to 1 month as default but user can change it
      setLayawayDueDate(calculateDueDate(1));
    }
  }, [calculateDueDate]);

  const handleCreateLayaway = useCallback(async () => {
    if (cartLines.length === 0) {
      setLayawayError("Cart is empty. Add items to create a layaway.");
      return;
    }

    if (!selectedCustomerId) {
      setLayawayError("A customer must be selected to create a layaway.");
      return;
    }

    if (!activeBranch) {
      setLayawayError(
        branchError ?? "Configura una sucursal activa en ajustes para poder registrar ventas."
      );
      return;
    }

    if (!layawayDueDate) {
      setLayawayError("Due date is required.");
      return;
    }

    const dueDateValue = new Date(layawayDueDate);
    if (Number.isNaN(dueDateValue.getTime())) {
      setLayawayError("Invalid due date.");
      return;
    }

    // Validate first payment if provided
    let firstPaymentCents: number | null = null;
    if (layawayFirstPayment.trim()) {
      const parsed = parseFloat(layawayFirstPayment.replace(/,/g, ""));
      if (Number.isNaN(parsed) || parsed < 0) {
        setLayawayError("First payment must be a valid positive number.");
        return;
      }
      firstPaymentCents = Math.round(parsed * 100);
      if (firstPaymentCents > Math.round(saleSummary.total * 100)) {
        setLayawayError("First payment cannot exceed the total amount.");
        return;
      }
    }

    try {
      setIsCreatingLayaway(true);
      setLayawayError(null);

      // Create order first
      const orderResponse = await fetch(`${API_BASE_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branchId: activeBranch.id,
          userId: 7, // Cajera Principal
          customerId: selectedCustomerId,
          items: cartLines.map((line) => ({
            productCodeVersionId: resolveProductVersionId(line.id),
            qty: line.qty,
            unitPriceCents: Math.round(line.price * 100),
            taxRate: line.taxRate ?? taxSettings.taxRate,
          })),
          taxRate: taxSettings.taxRate,
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json().catch(() => ({}));
        throw new Error(errorData?.error ?? `Order creation failed (${orderResponse.status})`);
      }

      const order = await orderResponse.json();

      // Create layaway
      const layawayPayload: {
        orderId: number;
        dueDate: string;
        initialPayment?: {
          amountCents: number;
          method: string;
        };
      } = {
        orderId: order.id,
        dueDate: dueDateValue.toISOString(),
      };

      // Add initial payment if provided
      if (firstPaymentCents !== null && firstPaymentCents > 0) {
        layawayPayload.initialPayment = {
          amountCents: firstPaymentCents,
          method: layawayPaymentMethod,
        };
      }

      const layawayResponse = await fetch(`${API_BASE_URL}/api/layaways`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(layawayPayload),
      });

      if (!layawayResponse.ok) {
        const errorData = await layawayResponse.json().catch(() => ({}));
        throw new Error(errorData?.error ?? `Layaway creation failed (${layawayResponse.status})`);
      }

      const layaway = await layawayResponse.json();

      // Close dialog and show success
      setIsLayawayDialogOpen(false);
      setLayawaySuccessMessage(`Layaway #${layaway.layaway?.id ?? order.id} created successfully.`);
      setIsLayawaySuccessDialogOpen(true);

      // Refresh inventory
      await loadInventory();
      if (isInventoryModalOpen) {
        await loadFullInventory();
      }
    } catch (error) {
      console.error("Create layaway failed", error);
      setLayawayError(error instanceof Error ? error.message : "Unable to create layaway. Please try again.");
    } finally {
      setIsCreatingLayaway(false);
    }
  }, [
    cartLines,
    selectedCustomerId,
    activeBranch,
    branchError,
    layawayDueDate,
    layawayFirstPayment,
    layawayPaymentMethod,
    saleSummary,
    resolveProductVersionId,
    loadInventory,
    isInventoryModalOpen,
    loadFullInventory,
  ]);

  const handleCloseLayawaySuccessDialog = useCallback(() => {
    setIsLayawaySuccessDialogOpen(false);
    setLayawaySuccessMessage(null);
    clearCart();
  }, [clearCart]);

  const closeCustomerDialog = useCallback(() => {
    setCustomerDialogMode(null);
    setCustomerInput("");
    setCustomerSearchResults([]);
    setCustomerSearchError(null);
    setIsSearchingCustomers(false);
  }, []);

  useEffect(() => {
    if (!customerDialogMode) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCustomerDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [customerDialogMode, closeCustomerDialog]);

  // ESC key handler for Payment Dialog
  useEffect(() => {
    if (!isPaymentDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && finalizeState !== "processing") {
        event.preventDefault();
        handleClosePaymentDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPaymentDialogOpen, finalizeState, handleClosePaymentDialog]);

  // ESC key handler for Success Dialog
  useEffect(() => {
    if (!isSuccessDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCloseSuccessDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSuccessDialogOpen, handleCloseSuccessDialog]);

  // ESC key handler for Inventory Modal
  useEffect(() => {
    if (!isInventoryModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCloseInventoryModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isInventoryModalOpen, handleCloseInventoryModal]);

  // ESC key handler for Credit Note Dialog
  useEffect(() => {
    if (!isCreditNoteDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCreditNoteDialogOpen(false);
        setPendingTenderAmount(0);
        setCreditNotes([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCreditNoteDialogOpen]);

  // ESC key handler for Void Dialog
  useEffect(() => {
    if (!isVoidDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsVoidDialogOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVoidDialogOpen]);

  // ESC key handler for Layaway Dialog
  useEffect(() => {
    if (!isLayawayDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isCreatingLayaway) {
        event.preventDefault();
        handleCloseLayawayDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLayawayDialogOpen, isCreatingLayaway, handleCloseLayawayDialog]);

  // ESC key handler for Layaway Success Dialog
  useEffect(() => {
    if (!isLayawaySuccessDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCloseLayawaySuccessDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLayawaySuccessDialogOpen, handleCloseLayawaySuccessDialog]);

  useEffect(() => {
    if (!customerDialogMode) {
      return;
    }

    const query = customerInput.trim();

    if (query.length < 2) {
      setCustomerSearchResults([]);
      setCustomerSearchError(null);
      setIsSearchingCustomers(false);
      return;
    }

    const controller = new AbortController();
    setIsSearchingCustomers(true);
    setCustomerSearchError(null);

    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, limit: "10" });
        const response = await fetch(`${API_BASE_URL}/api/customers?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Search failed with status ${response.status}`);
        }

        const payload: {
          customers?: Array<{
            id: number;
            firstName: string | null;
            lastName: string | null;
            email: string | null;
            phone: string | null;
            lastActivityAt?: string | null;
          }>;
        } = await response.json();

        if (controller.signal.aborted) {
          return;
        }

        const results = (payload.customers ?? []).map((customer) => {
          const first = customer.firstName?.trim() ?? "";
          const last = customer.lastName?.trim() ?? "";
          const name = `${first} ${last}`.trim() || "Unnamed customer";

          return {
            id: Number(customer.id),
            name,
            email: customer.email ?? null,
            phone: customer.phone ?? null,
            lastActivityAt: customer.lastActivityAt ?? null,
          } satisfies CustomerSearchResult;
        });

        setCustomerSearchResults(results);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Customer search failed", error);
        setCustomerSearchError("Unable to search customers. Try again.");
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingCustomers(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [customerDialogMode, customerInput]);

  const openCustomerDialog = useCallback(
    (mode: "change" | "add") => {
      setCustomerDialogMode(mode);
      setCustomerInput(mode === "change" ? customerName : "");
      setCustomerSearchResults([]);
      setCustomerSearchError(null);
      setIsSearchingCustomers(false);
    },
    [customerName]
  );

  const handleSubmitCustomer = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = customerInput.trim();
      if (!trimmed) {
        return;
      }

      setCustomerName(trimmed);
      setCustomerDescriptor("Manual entry");
      setSelectedCustomerId(null);
      closeCustomerDialog();
    },
    [closeCustomerDialog, customerInput]
  );

  const handleChangeCustomer = useCallback(() => {
    openCustomerDialog("change");
  }, [openCustomerDialog]);

  const handleAddCustomer = useCallback(() => {
    openCustomerDialog("add");
  }, [openCustomerDialog]);

  const handleSelectCustomer = useCallback(
    (customer: CustomerSearchResult) => {
      const descriptorParts = [customer.email, customer.phone].filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0
      );

      setCustomerName(customer.name);
      setCustomerDescriptor(
        descriptorParts.length > 0 ? descriptorParts.join(" • ") : "CRM customer"
      );
      setSelectedCustomerId(customer.id);
      // Remove all credit note tenders when customer changes
      setTenderBreakdown((previous) => previous.filter((tender) => tender.method !== "store_credit"));
      closeCustomerDialog();
    },
    [closeCustomerDialog]
  );

  const handleUseWalkInCustomer = useCallback(() => {
    setSelectedCustomerId(null);
    setCustomerName(WALK_IN_CUSTOMER);
    setCustomerDescriptor(WALK_IN_DESCRIPTOR);
    // Remove all credit note tenders when switching to walk-in customer
    setTenderBreakdown((previous) => previous.filter((tender) => tender.method !== "store_credit"));
    closeCustomerDialog();
  }, [closeCustomerDialog]);

  const tenderOptions = useMemo(
    () =>
      TENDER_METHODS.filter((method): method is NonCashTenderMethod => method !== "cash").map(
        (method) => ({
          value: method,
          label: TENDER_LABELS[method]
        })
      ),
    []
  );

  const selectedProductIds = useMemo(() => cartLines.map((line) => line.id), [cartLines]);
  const selectedProductSet = useMemo(() => new Set(selectedProductIds), [selectedProductIds]);

  const filteredInventoryModalProducts = useMemo(() => {
    const source = fullInventory.length > 0 ? fullInventory : products;
    const query = inventoryModalSearch.trim().toLowerCase();
    const categoryFilter = inventoryModalCategory;

    return source.filter((product) => {
      const matchesCategory = categoryFilter === "all" || product.categoryId === categoryFilter;
      if (!matchesCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = `${product.name} ${product.sku} ${product.variant ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [fullInventory, inventoryModalCategory, inventoryModalSearch, products]);

  const isCustomerDialogOpen = customerDialogMode !== null;

  return (
    <>
      <div className="flex flex-col gap-6 pb-24">
        {branchLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            Sincronizando configuración de sucursal...
          </div>
        ) : !activeBranch ? (
          <div className="rounded-xl border border-amber-400/60 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200">
            Configura una sucursal predeterminada en Ajustes → Sistema para habilitar la venta.
          </div>
        ) : branchError ? (
          <div className="rounded-xl border border-rose-400/60 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
            {branchError}
          </div>
        ) : null}
        <div className="grid gap-6 xl:grid-cols-[1.75fr_1fr]">
          <div className="space-y-6">
            {productError ? (
              <div className="rounded-xl border border-red-500/40 bg-red-50 px-4 py-2 text-xs text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {productError}
              </div>
            ) : isLoadingProducts ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Loading inventory...</p>
            ) : null}
            {stockError ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-2 text-xs text-amber-600 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                {stockError}
              </div>
            ) : null}
            <ProductGallery
              categories={categories}
              products={filteredProducts}
              activeCategoryId={activeCategoryId}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              onCategorySelect={setActiveCategoryId}
              selectedProductIds={selectedProductIds}
              onToggleProduct={handleToggleProduct}
            />
          </div>
          <div className="space-y-6">
            <OrderPanel
              items={cartLines}
              summary={saleSummary}
              tenders={tenderBreakdown}
              customerName={customerName}
              customerDescriptor={customerDescriptor}
              ticketId="R-20451"
              onRemoveItem={handleRemoveLine}
              onQuantityChange={handleQuantityChange}
              onPriceChange={handlePriceChange}
              onAddTender={handleAddTenderWithCreditNoteCheck}
              onAdjustTender={handleAdjustTender}
              onRemoveTender={handleRemoveTender}
              onChangeCustomer={handleChangeCustomer}
              onAddCustomer={handleAddCustomer}
              tenderOptions={tenderOptions}
              defaultTenderAmount={saleSummary.cashDue}
              cashTenderAmount={saleSummary.cashDue}
              onOpenPaymentDialog={handleOpenPaymentDialog}
            />
          </div>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/90">
        <div className="flex justify-center">
          <div className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <button
              onClick={() => setIsVoidDialogOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-rose-400/60 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600 transition hover:border-rose-500/70 hover:text-rose-500 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:border-rose-400/70 dark:hover:text-rose-200"
            >
              <ShieldX className="h-4 w-4" />
              Void
            </button>
            <button
              onClick={handleOpenPaymentDialog}
              className="flex items-center justify-center gap-2 rounded-xl border border-sky-500/70 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-500 hover:text-sky-600 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100 dark:hover:border-sky-400/80 dark:hover:text-white"
            >
              <CreditCard className="h-4 w-4" />
              Payment
            </button>
            <button className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:text-white">
              <Landmark className="h-4 w-4" />
              Bank transaction
            </button>
            <button
              onClick={handleOpenLayawayDialog}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:text-white"
            >
              <Package className="h-4 w-4" />
              Layaway
            </button>
          </div>
        </div>
      </div>
      {/* Customer Dialog - Change mode (search/select) */}
      {isCustomerDialogOpen && customerDialogMode === "change" ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-slate-950/60 backdrop-blur"
          onClick={closeCustomerDialog}
        >
          <form
            className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSubmitCustomer}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Change customer</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Search or enter the customer that should be linked to this sale.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCustomerDialog}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Close customer dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Customer name
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-800/80 dark:bg-slate-950 dark:text-slate-200"
                placeholder="Search CRM or type a name"
                value={customerInput}
                onChange={(event) => setCustomerInput(event.target.value)}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setCustomerInput("");
                  }
                }}
              />
            </div>
            <div className="space-y-3">
              {customerInput.trim().length < 2 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Type at least 2 characters to search existing customers.
                </p>
              ) : null}
              {customerSearchError ? (
                <div className="rounded-xl border border-rose-400/60 bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                  {customerSearchError}
                </div>
              ) : null}
              {isSearchingCustomers ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Searching customers…</p>
              ) : null}
              {customerSearchResults.length > 0 ? (
                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {customerSearchResults.map((customer) => {
                    const descriptorParts = [customer.email, customer.phone].filter(
                      (value): value is string => typeof value === "string" && value.trim().length > 0
                    );
                    const descriptor = descriptorParts.join(" • ");
                    const activityLabel = customer.lastActivityAt
                      ? `Last activity ${formatDateForDisplay(customer.lastActivityAt)}`
                      : null;
                    const isSelected = selectedCustomerId === customer.id;

                    return (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleSelectCustomer(customer)}
                        className={`flex w-full items-start justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                          isSelected
                            ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200"
                            : "border-slate-200/70 bg-white hover:border-slate-300 hover:text-slate-900 dark:border-slate-800/80 dark:bg-slate-950/60 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900 dark:text-white">{customer.name}</p>
                          {descriptor ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">{descriptor}</p>
                          ) : null}
                          {activityLabel ? (
                            <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                              {activityLabel}
                            </p>
                          ) : null}
                        </div>
                        <span className="text-xs font-semibold text-sky-600 dark:text-sky-300">
                          {isSelected ? "Selected" : "Select"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : customerInput.trim().length >= 2 && !isSearchingCustomers && !customerSearchError ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No customers found. You can add them manually using the form below.
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleUseWalkInCustomer}
                className="text-xs font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Use walk-in customer
              </button>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCustomerDialog}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:text-slate-300 dark:hover:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg border border-sky-500/70 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-500 hover:text-sky-600 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100 dark:hover:border-sky-400/80 dark:hover:text-white"
                >
                  Update
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {/* Add Customer Dialog - Add mode (full form) */}
      <AddCustomerDialog
        isOpen={isCustomerDialogOpen && customerDialogMode === "add"}
        onClose={closeCustomerDialog}
        onSuccess={(customer) => {
          const descriptorParts = [customer.email, customer.phone].filter(
            (value): value is string => typeof value === "string" && value.trim().length > 0
          );
          const fullName = `${customer.firstName} ${customer.lastName}`.trim();
          setCustomerName(fullName);
          setCustomerDescriptor(
            descriptorParts.length > 0 ? descriptorParts.join(" • ") : "CRM customer"
          );
          setSelectedCustomerId(customer.id);
          // Remove all credit note tenders when customer changes
          setTenderBreakdown((previous) => previous.filter((tender) => tender.method !== "store_credit"));
          closeCustomerDialog();
        }}
        onError={(error) => setCustomerSearchError(error)}
      />
      {isInventoryModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={handleCloseInventoryModal}
        >
          <div
            className="w-full max-w-5xl space-y-5 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Inventory catalog</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Browse the full catalog and add items to the ticket.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseInventoryModal}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Close inventory dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus-within:border-sky-400 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-200">
                  <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <input
                    value={inventoryModalSearch}
                    onChange={(event) => setInventoryModalSearch(event.target.value)}
                    className="flex-1 bg-transparent focus:outline-none"
                    placeholder="Search by SKU, name, or description"
                  />
                </label>
                <select
                  value={inventoryModalCategory}
                  onChange={(event) => setInventoryModalCategory(event.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:border-slate-400 focus:border-sky-400 focus:outline-none dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-200"
                >
                  <option value="all">All categories</option>
                  {categories
                    .filter((category) => category.id !== "all")
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => loadFullInventory()}
                  disabled={isLoadingFullInventory}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:border-slate-700"
                >
                  {isLoadingFullInventory ? "Loading..." : "Refresh"}
                </button>
              </div>
              {fullInventoryError ? (
                <div className="rounded-xl border border-red-500/40 bg-red-50 px-4 py-2 text-xs text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  {fullInventoryError}
                </div>
              ) : null}
              <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-inner dark:border-slate-800/70 dark:bg-slate-950/60">
                <div className="max-h-[60vh] overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3 text-left">SKU</th>
                        <th className="px-4 py-3 text-left">Product</th>
                        <th className="px-4 py-3 text-right">Price</th>
                        <th className="px-4 py-3 text-right">Stock</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {isLoadingFullInventory && fullInventory.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                            Loading inventory...
                          </td>
                        </tr>
                      ) : filteredInventoryModalProducts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                            No products match your filters.
                          </td>
                        </tr>
                      ) : (
                        filteredInventoryModalProducts.map((product) => {
                          const isSelected = selectedProductSet.has(product.id);
                          return (
                            <tr
                              key={product.id}
                              className={isSelected ? "bg-sky-50/70 dark:bg-sky-900/30" : undefined}
                            >
                              <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                                {product.sku}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium text-slate-900 dark:text-white">{product.name}</span>
                                  {product.variant ? (
                                    <span className="text-xs text-slate-500 dark:text-slate-400">{product.variant}</span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                                {formatCurrency(product.price)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex flex-col items-end gap-1 text-xs text-slate-500 dark:text-slate-400">
                                  <span className="font-medium text-slate-700 dark:text-slate-200">
                                    {product.stock}
                                  </span>
                                  {product.highlight ? (
                                    <span className="text-emerald-600 dark:text-emerald-300">{product.highlight}</span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleToggleProduct(product)}
                                  className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                                    isSelected
                                      ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-700 hover:border-emerald-500 dark:border-emerald-500/60 dark:bg-emerald-500/20 dark:text-emerald-200"
                                      : "border-sky-500/70 bg-sky-500/15 text-sky-700 hover:border-sky-500 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100"
                                  }`}
                                >
                                  {isSelected ? "Remove" : "Add to cart"}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {isPaymentDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={handleClosePaymentDialog}
        >
          <form
            className="w-full max-w-4xl space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Collect payment</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Review tender breakdown, confirm cash received, and note any change owed to the customer.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClosePaymentDialog}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Close tender modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              <ReceiptPreview
                items={cartLines}
                summary={saleSummary}
                tenders={tenderBreakdown}
                onFinalize={handleFinalizeSale}
                isProcessing={finalizeState === "processing"}
              />
            </div>
            <div className="space-y-3">
              {finalizeState === "error" && finalizeMessage ? (
                <div className="rounded-xl border border-rose-400/60 bg-rose-50 px-4 py-2 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                  {finalizeMessage}
                </div>
              ) : null}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClosePaymentDialog}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:text-slate-300 dark:hover:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinalizeSale}
                  disabled={finalizeState === "processing" || cartLines.length === 0}
                  className="rounded-lg border border-sky-500/70 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-500 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-70 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100 dark:hover:border-sky-400/80 dark:hover:text-white"
                >
                  {finalizeState === "processing" ? "Finalizing..." : "Print & kick drawer"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
      {isSuccessDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={handleCloseSuccessDialog}
        >
          <div
            className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-emerald-600 dark:text-emerald-300">Sale Completed</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {finalizeMessage ?? "Receipt printed and drawer opened."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseSuccessDialog}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Close success dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {successInvoiceId ? (
              <div className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white p-4 text-sm text-slate-700 dark:border-slate-800/80 dark:from-slate-950/70 dark:to-slate-950/60 dark:text-slate-200">
                <div className="flex items-center justify-between">
                  <span>Invoice Number</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{successInvoiceId}</span>
                </div>
              </div>
            ) : null}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseSuccessDialog}
                className="rounded-lg border border-emerald-600/70 bg-emerald-600/15 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-600 hover:text-emerald-600 dark:border-emerald-500/60 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:border-emerald-400/80 dark:hover:text-emerald-100"
              >
                Start New Sale
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isLayawayDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={handleCloseLayawayDialog}
        >
          <form
            className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateLayaway();
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Create Layaway</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Set the due date for this layaway plan.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseLayawayDialog}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Close layaway dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Payment Term <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleLayawayTermChange("1month")}
                    className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
                      layawayTermOption === "1month"
                        ? "border-sky-500 bg-sky-500/15 text-sky-700 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
                    }`}
                  >
                    1 Month
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLayawayTermChange("3months")}
                    className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
                      layawayTermOption === "3months"
                        ? "border-sky-500 bg-sky-500/15 text-sky-700 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
                    }`}
                  >
                    3 Months
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLayawayTermChange("manual")}
                    className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
                      layawayTermOption === "manual"
                        ? "border-sky-500 bg-sky-500/15 text-sky-700 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
                    }`}
                  >
                    Manual
                  </button>
                </div>
                {layawayTermOption === "manual" ? (
                  <div className="mt-3">
                    <label htmlFor="layaway-due-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Due Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="layaway-due-date"
                      type="date"
                      value={layawayDueDate}
                      onChange={(e) => setLayawayDueDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      required
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sky-400"
                    />
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
                    Due date: {formatDateForDisplay(layawayDueDate)}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span>Total Amount</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(saleSummary.total)}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  First Payment (Optional)
                </label>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setLayawayPaymentMethod("cash")}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        layawayPaymentMethod === "cash"
                          ? "border-sky-500 bg-sky-500/15 text-sky-700 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
                      }`}
                    >
                      Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayawayPaymentMethod("card")}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        layawayPaymentMethod === "card"
                          ? "border-sky-500 bg-sky-500/15 text-sky-700 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
                      }`}
                    >
                      Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayawayPaymentMethod("transfer")}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        layawayPaymentMethod === "transfer"
                          ? "border-sky-500 bg-sky-500/15 text-sky-700 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
                      }`}
                    >
                      Transfer
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={layawayFirstPayment}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.,]/g, "");
                      setLayawayFirstPayment(value);
                    }}
                    placeholder="RD$ 0.00"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sky-400"
                  />
                  {layawayFirstPayment && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Remaining balance: {formatCurrency(Math.max(0, saleSummary.total - (parseFloat(layawayFirstPayment.replace(/,/g, "")) || 0)))}
                    </p>
                  )}
                </div>
              </div>
              {layawayError ? (
                <div className="rounded-xl border border-rose-400/60 bg-rose-50 px-4 py-2 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                  {layawayError}
                </div>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseLayawayDialog}
                disabled={isCreatingLayaway}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800/80 dark:text-slate-300 dark:hover:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isCreatingLayaway ||
                  !layawayDueDate ||
                  !!layawayError ||
                  cartLines.length === 0 ||
                  !selectedCustomerId ||
                  !activeBranch
                }
                className="inline-flex items-center gap-2 rounded-lg border border-sky-500/70 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-500 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-70 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100 dark:hover:border-sky-400/80 dark:hover:text-white"
              >
                {isCreatingLayaway ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Layaway"
                )}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {isLayawaySuccessDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={handleCloseLayawaySuccessDialog}
        >
          <div
            className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-emerald-600 dark:text-emerald-300">Layaway Created</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {layawaySuccessMessage ?? "Layaway plan created successfully."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseLayawaySuccessDialog}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Close success dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseLayawaySuccessDialog}
                className="rounded-lg border border-emerald-600/70 bg-emerald-600/15 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-600 hover:text-emerald-600 dark:border-emerald-500/60 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:border-emerald-400/80 dark:hover:text-emerald-100"
              >
                Start New Sale
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isCreditNoteDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={() => {
            setCreditNoteDialogOpen(false);
            setPendingTenderAmount(0);
            setCreditNotes([]);
          }}
        >
          <div
            className="w-full max-w-2xl space-y-5 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Select Store Credit</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Choose a credit note to apply. Amount: {formatCurrency(pendingTenderAmount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreditNoteDialogOpen(false);
                  setPendingTenderAmount(0);
                  setCreditNotes([]);
                }}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Close credit note dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {isLoadingCreditNotes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : creditNoteError ? (
                <div className="rounded-xl border border-rose-400/60 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {creditNoteError}
                  </div>
                </div>
              ) : creditNotes.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
                  {usedCreditNoteIds.size > 0
                    ? "All available credit notes have already been used in this transaction."
                    : "No active credit notes available for this customer."}
                </div>
              ) : (
                creditNotes.map((note) => {
                  const balance = note.balanceCents / 100;
                  const canUseFull = balance >= pendingTenderAmount;
                  const amountToUse = Math.min(balance, pendingTenderAmount);
                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => handleSelectCreditNote(note)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              Credit Note #{note.id}
                            </span>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                              Active
                            </span>
                          </div>
                          {note.reason && (
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note.reason}</p>
                          )}
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            Balance: <span className="font-semibold">{formatCurrency(balance)}</span>
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Will use: <span className="font-medium">{formatCurrency(amountToUse)}</span>
                            {!canUseFull && (
                              <span className="ml-1 text-amber-600 dark:text-amber-400">
                                (partial - {formatCurrency(balance - amountToUse)} remaining)
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="ml-4 text-right">
                          <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(amountToUse)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setCreditNoteDialogOpen(false);
                  setPendingTenderAmount(0);
                  setCreditNotes([]);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:text-slate-300 dark:hover:border-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Void Confirmation Dialog */}
      {isVoidDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-slate-950/60 backdrop-blur"
          onClick={() => setIsVoidDialogOpen(false)}
        >
          <div
            className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Void Sale</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Are you sure you would like to void this sale?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsVoidDialogOpen(false)}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Close void dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsVoidDialogOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:text-slate-300 dark:hover:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearCart();
                  setIsVoidDialogOpen(false);
                }}
                className="rounded-lg border border-rose-400/60 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600 transition hover:border-rose-500/70 hover:text-rose-500 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:border-rose-400/70 dark:hover:text-rose-200"
              >
                Yes, Void Sale
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
