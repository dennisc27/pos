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
  PauseCircle,
  Search,
  ShieldX,
  Shirt,
  Smartphone,
  Watch,
  X
} from "lucide-react";

import { ProductGallery } from "@/components/pos/product-gallery";
import { OrderPanel } from "@/components/pos/order-panel";
import { ReceiptPreview } from "@/components/pos/receipt-preview";
import { formatCurrency } from "@/components/pos/utils";
import type { CartLine, SaleSummary, TenderBreakdown, Product, ProductCategory } from "@/components/pos/types";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

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

  return items.map((item) => {
    const versionId = item.productCodeVersionId ?? item.productCodeId;
    const availableQty = Number(item.availableQty ?? item.qtyOnHand ?? 0);

    return {
      id: String(versionId ?? 0),
      name: item.name ?? item.code ?? "Unnamed product",
      sku: item.sku ?? item.code ?? `SKU-${versionId ?? "0"}`,
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

function buildSummary(items: CartLine[], tenders: TenderBreakdown[]): SaleSummary {
  // Calculate subtotal as base price (price / (1 + tax_rate)) rounded to 2 decimals per line item
  // This ensures price changes are reflected in the totals
  const subtotal = items.reduce((sum, item) => {
    const rate = item.taxRate ?? DEFAULT_TAX_RATE;
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

  const resolveProductVersionId = useCallback((productId: string) => {
    const numeric = Number(productId);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInventory() {
      try {
        setIsLoadingProducts(true);
        setProductError(null);
        const params = new URLSearchParams({
          page: "1",
          pageSize: "60",
          status: "active",
          availability: "in_stock",
        });
        const response = await fetch(`${API_BASE_URL}/api/inventory?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`Failed to load inventory (${response.status})`);
        }

        const payload: {
          items?: InventoryResponseItem[];
          categoryOptions?: Array<{ id: number | null; name: string | null }>;
        } = await response.json();

        if (cancelled) {
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
        if (!cancelled) {
          setProductError("Unable to load inventory from the server.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProducts(false);
        }
      }
    }

    loadInventory();

    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleOpenInventoryModal = useCallback(() => {
    setInventoryModalOpen(true);
    if (fullInventory.length === 0 && !isLoadingFullInventory) {
      void loadFullInventory();
    }
  }, [fullInventory.length, isLoadingFullInventory, loadFullInventory]);

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
    taxRate: DEFAULT_TAX_RATE,
    variant: product.variant,
    status: product.highlight ? "featured" : undefined
  }), []);

  const addProductToCart = useCallback(
    (product: Product) => {
      setCartLines((previous) => {
        const existing = previous.find((line) => line.id === product.id);
        if (existing) {
          return previous.map((line) =>
            line.id === product.id ? { ...line, qty: line.qty + 1 } : line
          );
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

  const saleSummary = useMemo(() => buildSummary(cartLines, tenderBreakdown), [cartLines, tenderBreakdown]);

  const handleToggleProduct = useCallback(
    (product: Product) => {
      setCartLines((previous) => {
        const existing = previous.find((line) => line.id === product.id);
        if (existing) {
          return previous.filter((line) => line.id !== product.id);
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
    setCartLines((previous) =>
      previous.map((line) => (line.id === lineId ? { ...line, qty: Math.max(1, quantity) } : line))
    );
  }, []);

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
    ({ method, amount, reference }: { method: TenderBreakdown["method"]; amount: number; reference?: string }) => {
      setTenderBreakdown((previous) => [
        ...previous,
        {
          id: `tender-${Date.now()}`,
          method,
          label: TENDER_LABELS[method],
          amount,
          reference,
          status: TENDER_DEFAULT_STATUS[method]
        }
      ]);
    },
    []
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
            taxRate: line.taxRate ?? DEFAULT_TAX_RATE,
          })),
          taxRate: DEFAULT_TAX_RATE,
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
          taxRate: DEFAULT_TAX_RATE,
        }),
      });

      if (!invoiceResponse.ok) {
        throw new Error(`Invoice creation failed (${invoiceResponse.status})`);
      }

      const invoice = await invoiceResponse.json();

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

        if ((method === "gift_card" || method === "credit_note")) {
          throw new Error("Finalize flow does not support gift cards or store credit yet");
        }

        setFinalizeMessage(`Recording ${tender.label.toLowerCase()} payment...`);

        const paymentResponse = await fetch(`${API_BASE_URL}/api/payments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invoiceId: invoice.id,
            orderId: order.id,
            method,
            amountCents: Math.round(tender.amount * 100),
            meta: tender.reference ? { reference: tender.reference } : null,
          }),
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
    } catch (error) {
      console.error("Finalize sale failed", error);
      setFinalizeState("error");
      setFinalizeMessage("Unable to finalize sale. Review server logs and try again.");
    }
  }, [
    activeBranch,
    branchError,
    cartLines,
    resolveProductVersionId,
    saleSummary.cashDue,
    selectedCustomerId,
    tenderBreakdown,
  ]);

  const handleCloseSuccessDialog = useCallback(() => {
    setSuccessDialogOpen(false);
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
      closeCustomerDialog();
    },
    [closeCustomerDialog]
  );

  const handleUseWalkInCustomer = useCallback(() => {
    setSelectedCustomerId(null);
    setCustomerName(WALK_IN_CUSTOMER);
    setCustomerDescriptor(WALK_IN_DESCRIPTOR);
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
            <ProductGallery
              categories={categories}
              products={filteredProducts}
              activeCategoryId={activeCategoryId}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              onCategorySelect={setActiveCategoryId}
              selectedProductIds={selectedProductIds}
              onToggleProduct={handleToggleProduct}
              onOpenInventory={handleOpenInventoryModal}
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
              onAddTender={handleAddTender}
              onAdjustTender={handleAdjustTender}
              onRemoveTender={handleRemoveTender}
              onChangeCustomer={handleChangeCustomer}
              onAddCustomer={handleAddCustomer}
              tenderOptions={tenderOptions}
              defaultTenderAmount={saleSummary.cashDue}
              cashTenderAmount={saleSummary.cashDue}
              onOpenPaymentDialog={handleOpenPaymentDialog}
            />
            <button
              type="button"
              onClick={handleOpenPaymentDialog}
              disabled={cartLines.length === 0 || branchLoading || !activeBranch}
              className="flex w-full items-center justify-center gap-2 rounded-3xl border border-sky-500/70 bg-sky-500/15 px-5 py-3 text-sm font-semibold text-sky-700 transition hover:border-sky-500 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-70 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100 dark:hover:border-sky-400/80 dark:hover:text-white"
            >
              <CreditCard className="h-4 w-4" />
              Collect payment
            </button>
          </div>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/90">
        <div className="flex justify-center">
          <div className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <button className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:text-white">
              <PauseCircle className="h-4 w-4" />
              Hold
            </button>
            <button className="flex items-center justify-center gap-2 rounded-xl border border-rose-400/60 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600 transition hover:border-rose-500/70 hover:text-rose-500 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:border-rose-400/70 dark:hover:text-rose-200">
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
          </div>
        </div>
      </div>
      {isCustomerDialogOpen ? (
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
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {customerDialogMode === "change" ? "Change customer" : "Add customer"}
                </h2>
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
                    const activityDate = customer.lastActivityAt
                      ? new Date(customer.lastActivityAt)
                      : null;
                    const activityLabel =
                      activityDate && !Number.isNaN(activityDate.valueOf())
                        ? `Last activity ${activityDate.toLocaleDateString()}`
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
                  {customerDialogMode === "change" ? "Update" : "Add customer"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
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
    </>
  );
}
