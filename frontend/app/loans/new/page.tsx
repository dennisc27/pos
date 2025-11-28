"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Loader2,
  PackagePlus,
  Plus,
  Search,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { AddCustomerDialog } from "@/components/customer/add-customer-dialog";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

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

type LoanScheduleRow = {
  dueOn: string;
  interestCents: number;
  feeCents: number;
};

type CollateralItem = {
  qty: string;
  description: string;
  kilate: string;
  weight: string;
  estimatedValue: string;
  photoPath: string;
};


type ApiError = Error & { status?: number };

type CustomerSummary = {
  id: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  cedulaNo: string | null;
  branchId: number | null;
};


const pesoFormatter = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
});

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    const error = new Error(data?.error ?? "Request failed") as ApiError;
    error.status = response.status;
    throw error;
  }

  return data;
}

async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    const error = new Error(data?.error ?? "Request failed") as ApiError;
    error.status = response.status;
    throw error;
  }

  return data;
}

const parseCurrencyToCents = (raw: string) => {
  const normalized = raw.replace(/\s+/g, "").replace(/,/g, "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
};

const todayIso = () => new Date().toISOString().slice(0, 10);

function addDays(base: string, days: number) {
  const dt = new Date(base);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function generateSchedule(
  principalCents: number,
  model: InterestModel,
  termCount: number,
  startDate: string
): LoanScheduleRow[] {
  if (!Number.isFinite(principalCents) || principalCents <= 0 || termCount <= 0) {
    return [];
  }

  const schedule: LoanScheduleRow[] = [];
  const rate = model.interestRateBps / 10000;

  for (let index = 1; index <= termCount; index += 1) {
    const dueOn = addDays(startDate, model.periodDays * index);
    const interestCents = Math.round(principalCents * rate);
    schedule.push({ dueOn, interestCents, feeCents: 0 });
  }

  return schedule;
}

export default function LoansNewPage() {
  const searchParams = useSearchParams();
  const renewLoanId = searchParams.get("renewLoanId");
  
  const [interestModels, setInterestModels] = useState<InterestModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const { branch: activeBranch, loading: branchLoading, error: branchError } = useActiveBranch();
  const [branchId, setBranchId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);
  const [isEditCustomerDialogOpen, setIsEditCustomerDialogOpen] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<{
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null>(null);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);
  const [customerDetailError, setCustomerDetailError] = useState<string | null>(null);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerSummary[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null);
  const [isCustomerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [highlightedCustomerIndex, setHighlightedCustomerIndex] = useState<number>(-1);
  const customerSearchInputRef = useRef<HTMLInputElement>(null);
  const customerSearchDialogInputRef = useRef<HTMLInputElement>(null);
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  
  // Refs for keyboard navigation
  const collateralInputRefs = useRef<Array<Array<HTMLInputElement | null>>>([]);
  const principalAmountRef = useRef<HTMLInputElement>(null);
  const categoryCharacterRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);


  const [collateralItems, setCollateralItems] = useState<CollateralItem[]>([
    { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
    { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
    { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
    { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
  ]);

  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [categories, setCategories] = useState<Array<{ id: number; name: string; caracter: string | null; parentId: number | null }>>([]);
  const [selectedCategoryCharacter, setSelectedCategoryCharacter] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryCharacterValid, setCategoryCharacterValid] = useState<boolean | null>(null);
  
  // Check if categoria is "P" (prendas) to enable/disable kilate and peso
  const isPrendasCategory = selectedCategoryCharacter.toUpperCase() === "P" && categoryCharacterValid === true;
  
  // IMEI lookup state
  const [mobileApiKey, setMobileApiKey] = useState<string>("");
  const [imeiLookupResult, setImeiLookupResult] = useState<{
    imei: string;
    manufacturer: string;
    modelName: string;
    modelNumber: string;
    blacklistStatus: string;
    // iPhone-specific fields
    modelDescription?: string;
    imei2?: string;
    meid?: string;
    serialNumber?: string;
    estimatedPurchaseDate?: string;
    warrantyStatus?: string;
    iCloudLock?: string;
    demoUnit?: string;
    loanerDevice?: string;
    replacedDevice?: string;
    replacementDevice?: string;
    refurbishedDevice?: string;
    purchaseCountry?: string;
    simLockStatus?: string;
  } | null>(null);
  const [imeiLookupLoading, setImeiLookupLoading] = useState(false);
  const [imeiLookupError, setImeiLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (activeBranch && activeBranch.id) {
      const numericId = Number(activeBranch.id);
      if (Number.isInteger(numericId) && numericId > 0) {
        setBranchId(String(numericId));
      } else {
        setBranchId("");
        setTicketError("La sucursal activa no tiene un ID válido.");
      }
    } else {
      setBranchId("");
    }
  }, [activeBranch]);

  useEffect(() => {
    setSelectedCustomer(null);
    setCustomerQuery("");
    setCustomerResults([]);
    setCustomerSearchOpen(false);
    setCustomerSearchError(null);
    setCustomerSearchLoading(false);
    setTicketError(null); // Clear ticket error when branch changes
  }, [branchId]);

  useEffect(() => {
    const loadCategories = async () => {
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
    };
    loadCategories();
  }, []);

  // Load mobile API key from settings
  useEffect(() => {
    const loadMobileApiKey = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/settings?scope=global&keys=pawn.settings`);
        if (response.ok) {
          const data = await response.json();
          const pawnEntry = data.entries?.find((entry: { key: string }) => entry.key === "pawn.settings");
          if (pawnEntry?.value?.mobileApiKey) {
            setMobileApiKey(pawnEntry.value.mobileApiKey);
          }
        }
      } catch (err) {
        console.error("Failed to load mobile API key:", err);
      }
    };
    loadMobileApiKey();
  }, []);

  // Load loan data for renewal
  useEffect(() => {
    if (!renewLoanId) return;

    const loadLoanForRenewal = async () => {
      try {
        const loanId = Number(renewLoanId);
        if (!Number.isInteger(loanId) || loanId <= 0) {
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/loans/${loanId}`);
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const loan = data.loan;
        const collateral = data.collateral || [];

        // Set customer
        if (loan.customer) {
          const customerName = [loan.customer.firstName, loan.customer.lastName].filter(Boolean).join(" ") || "Cliente sin nombre";
          setSelectedCustomer({
            id: loan.customer.id,
            fullName: customerName,
            phone: loan.customer.phone || null,
            email: loan.customer.email || null,
            cedulaNo: loan.customer.cedulaNo || null,
            branchId: null,
          });
        }

        // Set principal amount
        if (loan.principalCents) {
          setPrincipalAmount(String(loan.principalCents / 100));
        }

        // Set collateral items
        if (collateral.length > 0) {
          const items: CollateralItem[] = collateral.map((item: { description: string; estimatedValueCents: number | null }) => ({
            qty: "",
            description: item.description || "",
            kilate: "",
            weight: "",
            estimatedValue: item.estimatedValueCents ? String(item.estimatedValueCents / 100) : "",
            photoPath: "",
          }));
          // Pad to 4 items
          while (items.length < 4) {
            items.push({ qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" });
          }
          setCollateralItems(items.slice(0, 4));
        }

        // Set interest model if available
        if (loan.interestModelId) {
          setSelectedModelId(String(loan.interestModelId));
        }
      } catch (err) {
        console.error("Failed to load loan for renewal:", err);
      }
    };

    void loadLoanForRenewal();
  }, [renewLoanId]);

  const [manualSchedule, setManualSchedule] = useState<LoanScheduleRow[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<null | {
    loanId: number;
    ticketNumber: string;
    printableUrl?: string;
  }>(null);

  const fallbackTicketNumber = useCallback(
    () => `PAWN-${Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0")}`,
    []
  );

  const loadTicketNumber = useCallback(async () => {
    setTicketLoading(true);
    setTicketError(null);

    try {
      const numericBranch = Number(branchId);
      if (!Number.isInteger(numericBranch) || numericBranch <= 0) {
        // Invalid branch ID, use fallback
        setTicketNumber(fallbackTicketNumber());
        setTicketLoading(false);
        return;
      }

      const params = new URLSearchParams();
      params.set("branchId", String(numericBranch));

      const data = await getJson<{ ticketNumber: string }>(
        `/api/loans/next-ticket?${params.toString()}`
      );

      const generated = data.ticketNumber?.trim();
      setTicketNumber(generated && generated.length > 0 ? generated : fallbackTicketNumber());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo generar el ticket automáticamente.";
      setTicketError(message);
      setTicketNumber((previous) => previous || fallbackTicketNumber());
    } finally {
      setTicketLoading(false);
    }
  }, [branchId, fallbackTicketNumber]);

  useEffect(() => {
    const numericBranch = Number(branchId);
    if (!branchId || !Number.isInteger(numericBranch) || numericBranch <= 0) {
      setTicketNumber((previous) => previous || fallbackTicketNumber());
      setTicketError(null);
      return;
    }

    void loadTicketNumber();
  }, [branchId, fallbackTicketNumber, loadTicketNumber]);

  const closeCustomerSearchDialog = useCallback(() => {
    setCustomerSearchOpen(false);
    setCustomerSearchLoading(false);
    setCustomerSearchError(null);
    setHighlightedCustomerIndex(-1);
  }, []);

  useEffect(() => {
    let isMounted = true;
    setLoadingModels(true);
    setModelsError(null);

    getJson<{ interestModels: InterestModel[] }>("/api/interest-models")
      .then((payload) => {
        if (!isMounted) return;
        setInterestModels(payload.interestModels ?? []);
      })
      .catch((error: ApiError) => {
        if (!isMounted) return;
        setModelsError(error.message ?? "No se pudieron cargar los modelos de interés");
      })
      .finally(() => {
        if (isMounted) {
          setLoadingModels(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Normalize query by removing dashes, spaces, and parentheses for cedula/phone matching
  const normalizeQuery = useCallback((query: string): string => {
    return query.replace(/[-\s()]/g, "");
  }, []);

  // Check if query matches cedula or phone (normalized)
  const matchesCedulaOrPhone = useCallback((query: string, cedulaNo: string | null, phone: string | null): boolean => {
    const normalizedQuery = normalizeQuery(query);
    if (!normalizedQuery || normalizedQuery.length < 2) return false;
    
    const normalizedCedula = cedulaNo ? normalizeQuery(cedulaNo) : "";
    const normalizedPhone = phone ? normalizeQuery(phone) : "";
    
    // Check if normalized query is contained in normalized cedula or phone
    return Boolean(
      (normalizedCedula && normalizedCedula.includes(normalizedQuery)) ||
      (normalizedPhone && normalizedPhone.includes(normalizedQuery))
    );
  }, [normalizeQuery]);

  useEffect(() => {
    if (!isCustomerSearchOpen) {
      return;
    }

    const query = customerQuery.trim();

    if (query.length < 2) {
      setCustomerResults([]);
      setCustomerSearchError(null);
      setCustomerSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    setCustomerSearchLoading(true);
    setCustomerSearchError(null);

    const timer = window.setTimeout(async () => {
      try {
        // Make two API calls: one with original query (for phone matching), one with normalized (for broader matching)
        const normalizedQuery = normalizeQuery(query);
        const [response1, response2] = await Promise.all([
          fetch(`${API_BASE_URL}/api/customers?${new URLSearchParams({ q: query, limit: "50" }).toString()}`, {
          signal: controller.signal,
          }),
          normalizedQuery !== query
            ? fetch(`${API_BASE_URL}/api/customers?${new URLSearchParams({ q: normalizedQuery, limit: "50" }).toString()}`, {
                signal: controller.signal,
              })
            : Promise.resolve(null),
        ]);

        if (!response1.ok) {
          throw new Error(`Search failed with status ${response1.status}`);
        }

        const payload1: {
          customers?: Array<{
            id: number;
            firstName: string | null;
            lastName: string | null;
            email: string | null;
            phone: string | null;
            cedulaNo: string | null;
          }>;
        } = await response1.json();

        let payload2: typeof payload1 = { customers: [] };
        if (response2) {
          try {
            if (response2.ok) {
              payload2 = await response2.json();
            }
          } catch {
            // Ignore second request errors
          }
        }

        if (controller.signal.aborted) {
          return;
        }

        // Combine and deduplicate customers by ID
        const allCustomersMap = new Map<number, {
          id: number;
          firstName: string | null;
          lastName: string | null;
          email: string | null;
          phone: string | null;
          cedulaNo: string | null;
        }>();

        [...(payload1.customers ?? []), ...(payload2?.customers ?? [])].forEach((customer) => {
          allCustomersMap.set(customer.id, customer);
        });

        // Filter to only show customers matching cedula or phone
        const allCustomers = Array.from(allCustomersMap.values()).map((customer) => {
          const first = customer.firstName?.trim() ?? "";
          const last = customer.lastName?.trim() ?? "";
          const fullName = `${first} ${last}`.trim() || `Cliente #${customer.id}`;

          return {
            id: Number(customer.id),
            fullName,
            phone: customer.phone ?? null,
            email: customer.email ?? null,
            cedulaNo: customer.cedulaNo ?? null,
            branchId: null,
          } as CustomerSummary;
        });

        // Filter to only show customers where query matches cedula or phone
        const filteredCustomers = allCustomers.filter((customer) =>
          matchesCedulaOrPhone(query, customer.cedulaNo, customer.phone)
        );

        setCustomerResults(filteredCustomers);
        setHighlightedCustomerIndex(-1); // Reset highlight when results change
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Customer search failed", error);
        if (error instanceof Error) {
          setCustomerSearchError(error.message);
        } else {
          setCustomerSearchError("No se pudieron cargar los clientes");
        }
      } finally {
        if (!controller.signal.aborted) {
          setCustomerSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isCustomerSearchOpen, customerQuery, normalizeQuery, matchesCedulaOrPhone]);

  // Auto-focus search input when page loads
  useEffect(() => {
    if (customerSearchInputRef.current && !branchLoading) {
      // Small delay to ensure page is fully rendered
      const timer = setTimeout(() => {
        customerSearchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [branchLoading]);

  // Select all text in dialog input when dialog opens and there's more than 2 characters
  useEffect(() => {
    if (isCustomerSearchOpen && customerSearchDialogInputRef.current && customerQuery.trim().length > 2) {
      // Small delay to ensure input is focused
      const timer = setTimeout(() => {
        customerSearchDialogInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
    // Only run when dialog opens, not on query changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomerSearchOpen]);

  // Initialize collateral input refs array
  useEffect(() => {
    if (!Array.isArray(collateralInputRefs.current)) {
      collateralInputRefs.current = [];
    }
    collateralInputRefs.current = collateralItems.map(() => [null, null, null, null, null, null]);
  }, [collateralItems.length]);


  // Get all focusable elements in order
  const getFocusableElements = useCallback((): HTMLElement[] => {
    const form = document.querySelector('form');
    if (!form) return [];

    const focusableSelectors = [
      'input:not([disabled]):not([readonly]):not([type="hidden"]):not([type="file"])',
      'textarea:not([disabled]):not([readonly])',
      'button:not([disabled])',
      'select:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ];

    const elements: HTMLElement[] = [];
    focusableSelectors.forEach((selector) => {
      const found = Array.from(form.querySelectorAll<HTMLElement>(selector));
      elements.push(...found);
    });

    // Filter out hidden elements and sort by DOM order
    return elements.filter((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, []);

  // Find the right interest model based on category and amount
  const findMatchingInterestModel = useCallback((principalCents: number, categoryId: number | null): InterestModel | null => {
    if (!categoryId || interestModels.length === 0) {
      // If no category, use models with no categories assigned
      const modelsWithoutCategories = interestModels.filter((model) => !model.categoryIds || model.categoryIds.length === 0);
      for (const model of modelsWithoutCategories) {
        const withinMin = !model.minPrincipalCents || principalCents >= model.minPrincipalCents;
        const withinMax = !model.maxPrincipalCents || principalCents <= model.maxPrincipalCents;
        if (withinMin && withinMax) {
          return model;
        }
      }
      return null;
    }

    // Get category and its parent
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return null;

    const categoryIdsToCheck = [categoryId];
    if (category.parentId) {
      categoryIdsToCheck.push(category.parentId);
    }

    // First, try to find models with this category (or parent)
    const modelsWithCategory = interestModels.filter((model) => {
      if (!model.categoryIds || model.categoryIds.length === 0) return false;
      return model.categoryIds.some((modelCategoryId) => categoryIdsToCheck.includes(modelCategoryId));
    });

    // Check min/max for category-specific models
    for (const model of modelsWithCategory) {
      const withinMin = !model.minPrincipalCents || principalCents >= model.minPrincipalCents;
      const withinMax = !model.maxPrincipalCents || principalCents <= model.maxPrincipalCents;
      if (withinMin && withinMax) {
        return model;
      }
    }

    // If no category-specific model matches, fall back to models with no categories
    const modelsWithoutCategories = interestModels.filter((model) => !model.categoryIds || model.categoryIds.length === 0);
    for (const model of modelsWithoutCategories) {
      const withinMin = !model.minPrincipalCents || principalCents >= model.minPrincipalCents;
      const withinMax = !model.maxPrincipalCents || principalCents <= model.maxPrincipalCents;
      if (withinMin && withinMax) {
        return model;
      }
    }

    return null;
  }, [interestModels, categories]);

  // Helper function to strip HTML tags from text
  const stripHtmlTags = (text: string): string => {
    return text
      .replace(/<font[^>]*>/gi, "")
      .replace(/<\/font>/gi, "")
      .replace(/<span[^>]*>/gi, "")
      .replace(/<\/span>/gi, "")
      .replace(/<[^>]+>/g, "")
      .trim();
  };

  // IMEI lookup function
  const lookupImei = useCallback(async (imei: string) => {
    if (!imei.trim()) {
      return;
    }

    setImeiLookupLoading(true);
    setImeiLookupError(null);
    setImeiLookupResult(null);

    try {
      // First, get basic IMEI info (service 54)
      const response = await fetch(
        `${API_BASE_URL}/api/imei-lookup?imei=${encodeURIComponent(imei.trim())}&service=54`
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to lookup IMEI");
      }

      const data = await response.json();
      
      if (data.status === "success" && data.result) {
        // Parse the result string - handle both newline and <br> separators
        let resultText = data.result;
        // Replace <br> tags with newlines for consistent parsing
        resultText = resultText.replace(/<br\s*\/?>/gi, "\n");
        const resultLines = resultText.split("\n").filter((line: string) => line.trim());
        
        const parsed: {
          imei: string;
          manufacturer: string;
          modelName: string;
          modelNumber: string;
          blacklistStatus: string;
          modelDescription?: string;
          imei2?: string;
          meid?: string;
          serialNumber?: string;
          estimatedPurchaseDate?: string;
          warrantyStatus?: string;
          iCloudLock?: string;
          demoUnit?: string;
          loanerDevice?: string;
          replacedDevice?: string;
          replacementDevice?: string;
          refurbishedDevice?: string;
          purchaseCountry?: string;
          simLockStatus?: string;
        } = {
          imei: data.imei || imei,
          manufacturer: "",
          modelName: "",
          modelNumber: "",
          blacklistStatus: "",
        };

        resultLines.forEach((line: string) => {
          const trimmedLine = line.trim();
          
          if (trimmedLine.startsWith("IMEI:")) {
            const imeiValue = trimmedLine.split("IMEI:")[1]?.trim();
            if (imeiValue) {
              parsed.imei = stripHtmlTags(imeiValue);
            }
          } else if (trimmedLine.startsWith("Manufacturer:")) {
            parsed.manufacturer = stripHtmlTags(trimmedLine.split("Manufacturer:")[1]?.trim() || "");
          } else if (trimmedLine.startsWith("Marketing Name:")) {
            parsed.modelName = stripHtmlTags(trimmedLine.split("Marketing Name:")[1]?.trim() || "");
          } else if (trimmedLine.startsWith("Model Name:")) {
            // Use Model Name if Marketing Name wasn't found
            if (!parsed.modelName) {
              parsed.modelName = stripHtmlTags(trimmedLine.split("Model Name:")[1]?.trim() || "");
            }
          } else if (trimmedLine.startsWith("Model:")) {
            parsed.modelNumber = stripHtmlTags(trimmedLine.split("Model:")[1]?.trim() || "");
          } else if (trimmedLine.startsWith("Operating System:")) {
            // Operating system info - we can store this if needed later
          } else if (trimmedLine.startsWith("Blacklist Status:")) {
            parsed.blacklistStatus = stripHtmlTags(trimmedLine.split("Blacklist Status:")[1]?.trim() || "");
          }
        });

        // If modelNumber contains model name info (e.g., "IPHONE 4 (A1332)"), extract it
        if (parsed.modelNumber && !parsed.modelName) {
          // Try to extract model name from model number if it contains parentheses
          const match = parsed.modelNumber.match(/^(.+?)\s*\(/);
          if (match) {
            parsed.modelName = match[1].trim();
          } else {
            // If no parentheses, use the whole model number as model name
            parsed.modelName = parsed.modelNumber;
          }
        }
        
        // Fallback: if manufacturer field contains multiple lines with <br>, try to parse it
        if (!parsed.modelName || !parsed.modelNumber || !parsed.blacklistStatus) {
          // Check if manufacturer contains additional info (sometimes API returns everything in one field)
          const manufacturerText = parsed.manufacturer;
          if (manufacturerText && (manufacturerText.includes('<br>') || manufacturerText.includes('\n'))) {
            const manufacturerLines = manufacturerText.replace(/<br\s*\/?>/gi, "\n").split("\n");
            manufacturerLines.forEach((line: string) => {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith("Marketing Name:") && !parsed.modelName) {
                parsed.modelName = trimmedLine.split("Marketing Name:")[1]?.trim() || "";
              } else if (trimmedLine.startsWith("Model:") && !parsed.modelNumber) {
                parsed.modelNumber = trimmedLine.split("Model:")[1]?.trim() || "";
              } else if (trimmedLine.startsWith("Blacklist Status:") && !parsed.blacklistStatus) {
                parsed.blacklistStatus = trimmedLine.split("Blacklist Status:")[1]?.trim() || "";
              }
            });
            // Clean up manufacturer to just the name
            const firstLine = manufacturerLines[0]?.trim();
            if (firstLine && !firstLine.includes(":")) {
              parsed.manufacturer = firstLine;
            }
          }
        }

        // Check if it's an iPhone - if so, get additional details (service 30)
        const isIPhone = parsed.modelName?.toLowerCase().includes("iphone") || 
                        parsed.modelNumber?.toLowerCase().includes("iphone") ||
                        parsed.manufacturer?.toLowerCase().includes("apple");
        
        if (isIPhone) {
          try {
            const iphoneResponse = await fetch(
              `${API_BASE_URL}/api/imei-lookup?imei=${encodeURIComponent(imei.trim())}&service=30`
            );
            
            if (iphoneResponse.ok) {
              const iphoneData = await iphoneResponse.json();
              
              if (iphoneData.status === "success" && iphoneData.result) {
                // Parse iPhone-specific data
                let iphoneResultText = iphoneData.result;
                iphoneResultText = iphoneResultText.replace(/<br\s*\/?>/gi, "\n");
                const iphoneLines = iphoneResultText.split("\n").filter((line: string) => line.trim());
                
                iphoneLines.forEach((line: string) => {
                  const trimmedLine = line.trim();
                  
                  if (trimmedLine.startsWith("Model Description:")) {
                    parsed.modelDescription = stripHtmlTags(trimmedLine.split("Model Description:")[1]?.trim() || "");
                  } else if (trimmedLine.startsWith("IMEI2:")) {
                    parsed.imei2 = stripHtmlTags(trimmedLine.split("IMEI2:")[1]?.trim() || "");
                  } else if (trimmedLine.startsWith("MEID:")) {
                    parsed.meid = stripHtmlTags(trimmedLine.split("MEID:")[1]?.trim() || "");
                  } else if (trimmedLine.startsWith("Serial Number:")) {
                    parsed.serialNumber = stripHtmlTags(trimmedLine.split("Serial Number:")[1]?.trim() || "");
                  } else if (trimmedLine.startsWith("Estimated Purchase Date:")) {
                    parsed.estimatedPurchaseDate = stripHtmlTags(trimmedLine.split("Estimated Purchase Date:")[1]?.trim() || "");
                  } else if (trimmedLine.startsWith("Warranty Status:")) {
                    parsed.warrantyStatus = stripHtmlTags(trimmedLine.split("Warranty Status:")[1]?.trim() || "");
                  } else if (trimmedLine.startsWith("iCloud Lock:")) {
                    parsed.iCloudLock = stripHtmlTags(trimmedLine.split("iCloud Lock:")[1]?.trim() || "");
                  } else if (trimmedLine.startsWith("Demo Unit:")) {
                    parsed.demoUnit = stripHtmlTags(trimmedLine.split("Demo Unit:")[1]?.trim() || "");
                  } else if (trimmedLine.startsWith("Loaner Device:")) {
                    parsed.loanerDevice = stripHtmlTags(trimmedLine.split("Loaner Device:")[1]?.trim() || "");
                  } else if (trimmedLine.startsWith("Replaced Device:")) {
                    parsed.replacedDevice = stripHtmlTags(trimmedLine.split("Replaced Device:")[1]?.trim() || "");
                  } else if (trimmedLine.startsWith("Replacement Device:")) {
                    parsed.replacementDevice = stripHtmlTags(trimmedLine.split("Replacement Device:")[1]?.trim() || "");
                  } else if (trimmedLine.startsWith("Refurbished Device:")) {
                    parsed.refurbishedDevice = stripHtmlTags(trimmedLine.split("Refurbished Device:")[1]?.trim() || "");
                  } else if (trimmedLine.startsWith("Purchase Country:")) {
                    parsed.purchaseCountry = stripHtmlTags(trimmedLine.split("Purchase Country:")[1]?.trim() || "");
                  } else if (trimmedLine.startsWith("Sim-Lock Status:") || trimmedLine.startsWith("Sim Lock Status:") || trimmedLine.startsWith("SimLock Status:")) {
                    const statusValue = trimmedLine.split(/Sim-Lock Status:|Sim Lock Status:|SimLock Status:/)[1]?.trim() || "";
                    parsed.simLockStatus = stripHtmlTags(statusValue);
                  } else if (trimmedLine.startsWith("Locked Carrier:")) {
                    // "Locked Carrier" is another way to express Sim-Lock Status
                    const statusValue = trimmedLine.split("Locked Carrier:")[1]?.trim() || "";
                    parsed.simLockStatus = stripHtmlTags(statusValue);
                  } else if (trimmedLine.toLowerCase().includes("sim") && trimmedLine.toLowerCase().includes("lock") && trimmedLine.includes(":")) {
                    // Fallback: catch any variation of sim lock status
                    const parts = trimmedLine.split(":");
                    if (parts.length > 1) {
                      parsed.simLockStatus = stripHtmlTags(parts.slice(1).join(":").trim());
                    }
                  } else if (trimmedLine.toLowerCase().includes("locked carrier") && trimmedLine.includes(":")) {
                    // Fallback: catch "locked carrier" variations
                    const parts = trimmedLine.split(":");
                    if (parts.length > 1) {
                      parsed.simLockStatus = stripHtmlTags(parts.slice(1).join(":").trim());
                    }
                  }
                });
              }
            }
          } catch (iphoneError) {
            // If iPhone lookup fails, still show basic info
            console.error("iPhone-specific lookup error:", iphoneError);
          }
        }
        
        setImeiLookupResult(parsed);
      } else {
        throw new Error(data.error || "IMEI lookup failed");
      }
    } catch (error) {
      console.error("IMEI lookup error:", error);
      setImeiLookupError(error instanceof Error ? error.message : "No se pudo verificar el IMEI");
    } finally {
      setImeiLookupLoading(false);
    }
  }, [mobileApiKey]);

  // Handle Enter key to move to next field
  const handleEnterKey = useCallback((event: KeyboardEvent<HTMLElement>, currentElement: HTMLElement) => {
    // Special handling for principal amount field - auto-select interest model and focus submit button
    if (currentElement === principalAmountRef.current) {
      if (selectedCategoryId) {
        const principalCents = parseCurrencyToCents(principalAmount);
        if (principalCents !== null && principalCents > 0) {
          const matchingModel = findMatchingInterestModel(principalCents, selectedCategoryId);
          if (matchingModel) {
            setSelectedModelId(String(matchingModel.id));
          }
        }
      }
      
      // Focus the submit button with animation if principal amount has a value
      event.preventDefault();
      setTimeout(() => {
        if (submitButtonRef.current && !submitting) {
          const principalCents = parseCurrencyToCents(principalAmount);
          // Focus button if principal amount is filled
          if (principalCents !== null && principalCents > 0) {
            submitButtonRef.current.focus();
            // Add a temporary pulse animation
            submitButtonRef.current.classList.add('animate-pulse');
            setTimeout(() => {
              submitButtonRef.current?.classList.remove('animate-pulse');
            }, 2000);
          }
        }
      }, 0);
      return;
    }

    // Don't prevent default for textareas (allow new lines)
    if (currentElement.tagName === 'TEXTAREA') {
      // Use Ctrl+Enter or Cmd+Enter to move to next field
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const focusable = getFocusableElements();
        const currentIndex = focusable.indexOf(currentElement);
        if (currentIndex < focusable.length - 1) {
          focusable[currentIndex + 1]?.focus();
        }
      }
      return;
    }

    // For buttons, let default behavior (submit if type="submit")
    if (currentElement.tagName === 'BUTTON') {
      return;
    }

    // Special handling for description fields - skip valor estimado and go to next row's qty or foto
    let descriptionRowIndex = -1;
    for (let i = 0; i < collateralInputRefs.current.length; i++) {
      if (collateralInputRefs.current[i]?.[1] === currentElement) {
        descriptionRowIndex = i;
        break;
      }
    }
    
    if (descriptionRowIndex >= 0) {
      const descriptionValue = collateralItems[descriptionRowIndex]?.description || "";
      
      // Check if this is the IMEI field (third line, categoria C, starts with "IMEI: ")
      const isImeiField = 
        selectedCategoryCharacter.toUpperCase() === "C" &&
        descriptionRowIndex === 2 &&
        descriptionValue.trim().startsWith("IMEI:");
      
      if (isImeiField && mobileApiKey) {
        // Extract IMEI from description (after "IMEI: ")
        const imei = descriptionValue.replace(/^IMEI:\s*/i, "").trim();
        if (imei) {
          event.preventDefault();
          void lookupImei(imei);
          // Still move to next field
          const nextRowIndex = descriptionRowIndex + 1;
          if (nextRowIndex < collateralItems.length) {
            const nextQtyField = collateralInputRefs.current[nextRowIndex]?.[0];
            if (nextQtyField) {
              nextQtyField.focus();
              return;
            }
          }
        }
      }
      
      event.preventDefault();
      // Skip valor estimado and go to next row's qty, or foto if it's the last row
      const nextRowIndex = descriptionRowIndex + 1;
      if (nextRowIndex < collateralItems.length) {
        // Go to next row's qty field
        const nextQtyField = collateralInputRefs.current[nextRowIndex]?.[0];
        if (nextQtyField) {
          nextQtyField.focus();
          return;
        }
      } else {
        // Last row - go to foto field or next section
        const focusable = getFocusableElements();
        const currentIndex = focusable.indexOf(currentElement);
        // Skip valor estimado (index [4] for this row) and find next focusable
        const valorEstimadoField = collateralInputRefs.current[descriptionRowIndex]?.[4];
        let nextIndex = currentIndex + 1;
        while (nextIndex < focusable.length) {
          const nextElement = focusable[nextIndex];
          // Skip if it's the valor estimado field for this row
          if (nextElement !== valorEstimadoField && nextElement && !(nextElement as HTMLInputElement).disabled) {
            nextElement.focus();
            return;
          }
          nextIndex++;
        }
      }
    }

    event.preventDefault();
    const focusable = getFocusableElements();
    const currentIndex = focusable.indexOf(currentElement);
    
    // Skip disabled fields
    let nextIndex = currentIndex + 1;
    while (nextIndex < focusable.length) {
      const nextElement = focusable[nextIndex];
      if (nextElement && !(nextElement as HTMLInputElement).disabled) {
        nextElement.focus();
        return;
      }
      nextIndex++;
    }
  }, [getFocusableElements, principalAmount, selectedCategoryId, findMatchingInterestModel, submitting, branchId, selectedCustomer, ticketNumber, collateralItems, interestModels, selectedModelId, manualSchedule.length, selectedCategoryCharacter, mobileApiKey, lookupImei]);

  // Handle Arrow key navigation
  const handleArrowKey = useCallback((event: KeyboardEvent<HTMLElement>, currentElement: HTMLElement) => {
    // For input elements, only navigate if Ctrl/Cmd is pressed or input is empty
    if (currentElement.tagName === 'INPUT' && !event.ctrlKey && !event.metaKey) {
      const input = currentElement as HTMLInputElement;
      const value = input.value;
      const selectionStart = input.selectionStart ?? 0;
      const selectionEnd = input.selectionEnd ?? 0;
      const isTextSelected = selectionStart !== selectionEnd;
      
      // Allow normal arrow key behavior for cursor movement unless:
      // 1. Input is empty
      // 2. At start and pressing Left/Up
      // 3. At end and pressing Right/Down
      // 4. Text is selected (allow navigation)
      if (value.length > 0 && !isTextSelected) {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          if (selectionStart > 0) return; // Allow normal cursor movement
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          if (selectionStart < value.length) return; // Allow normal cursor movement
        }
      }
    }

    const focusable = getFocusableElements();
    const currentIndex = focusable.indexOf(currentElement);
    
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        // For collateral grid, try to move down within same column
        if (currentElement.closest('.sm\\:grid-cols-12')) {
          const currentRow = currentElement.closest('.sm\\:grid-cols-12');
          const allRows = Array.from(document.querySelectorAll('.sm\\:grid-cols-12'));
          const currentRowIndex = allRows.indexOf(currentRow as Element);
          if (currentRowIndex < allRows.length - 1) {
            const nextRow = allRows[currentRowIndex + 1];
            const currentInputIndex = Array.from(currentRow?.querySelectorAll('input:not([disabled]):not([readonly])') || []).indexOf(currentElement as HTMLInputElement);
            const nextRowInputs = Array.from(nextRow.querySelectorAll('input:not([disabled]):not([readonly])'));
            if (nextRowInputs[currentInputIndex]) {
              (nextRowInputs[currentInputIndex] as HTMLElement).focus();
              return;
            }
          }
        }
        // Fallback to next element
        nextIndex = currentIndex + 1;
        break;
      case 'ArrowUp':
        event.preventDefault();
        // For collateral grid, try to move up within same column
        if (currentElement.closest('.sm\\:grid-cols-12')) {
          const currentRow = currentElement.closest('.sm\\:grid-cols-12');
          const allRows = Array.from(document.querySelectorAll('.sm\\:grid-cols-12'));
          const currentRowIndex = allRows.indexOf(currentRow as Element);
          if (currentRowIndex > 0) {
            const prevRow = allRows[currentRowIndex - 1];
            const currentInputIndex = Array.from(currentRow?.querySelectorAll('input:not([disabled]):not([readonly])') || []).indexOf(currentElement as HTMLInputElement);
            const prevRowInputs = Array.from(prevRow.querySelectorAll('input:not([disabled]):not([readonly])'));
            if (prevRowInputs[currentInputIndex]) {
              (prevRowInputs[currentInputIndex] as HTMLElement).focus();
              return;
            }
          }
        }
        // Fallback to previous element
        nextIndex = currentIndex - 1;
        break;
      case 'ArrowRight':
        event.preventDefault();
        // Move to next field in same row (for grid layouts)
        if (currentElement.closest('.sm\\:grid-cols-12, .sm\\:grid-cols-2, .sm\\:grid-cols-3')) {
          const row = currentElement.closest('.sm\\:grid-cols-12, .sm\\:grid-cols-2, .sm\\:grid-cols-3');
          const rowInputs = Array.from(row?.querySelectorAll('input:not([disabled]):not([readonly]), button:not([disabled])') || []) as HTMLElement[];
          const currentInRow = rowInputs.indexOf(currentElement);
          if (currentInRow < rowInputs.length - 1) {
            rowInputs[currentInRow + 1]?.focus();
            return;
          }
        }
        nextIndex = currentIndex + 1;
        break;
      case 'ArrowLeft':
        event.preventDefault();
        // Move to previous field in same row
        if (currentElement.closest('.sm\\:grid-cols-12, .sm\\:grid-cols-2, .sm\\:grid-cols-3')) {
          const row = currentElement.closest('.sm\\:grid-cols-12, .sm\\:grid-cols-2, .sm\\:grid-cols-3');
          const rowInputs = Array.from(row?.querySelectorAll('input:not([disabled]):not([readonly]), button:not([disabled])') || []) as HTMLElement[];
          const currentInRow = rowInputs.indexOf(currentElement);
          if (currentInRow > 0) {
            rowInputs[currentInRow - 1]?.focus();
            return;
          }
        }
        nextIndex = currentIndex - 1;
        break;
      default:
        return;
    }

    if (nextIndex >= 0 && nextIndex < focusable.length) {
      focusable[nextIndex]?.focus();
    }
  }, [getFocusableElements]);

  // Combined keyboard handler
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    const currentElement = event.currentTarget;
    
    if (event.key === 'Enter') {
      handleEnterKey(event, currentElement);
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      handleArrowKey(event, currentElement);
    }
  }, [handleEnterKey, handleArrowKey]);

  // Handle ESC key for dialog
  const handleDialogKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      const input = event.currentTarget;
      if (input.value.trim() === '') {
        event.preventDefault();
        closeCustomerSearchDialog();
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (customerResults.length > 0) {
        setHighlightedCustomerIndex((prev) => {
          const next = prev < customerResults.length - 1 ? prev + 1 : prev;
          // Scroll into view
          setTimeout(() => {
            const element = document.querySelector(`[data-customer-index="${next}"]`) as HTMLElement;
            element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 0);
          return next;
        });
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (customerResults.length > 0) {
        setHighlightedCustomerIndex((prev) => {
          const next = prev > 0 ? prev - 1 : -1;
          if (next >= 0) {
            // Scroll into view
            setTimeout(() => {
              const element = document.querySelector(`[data-customer-index="${next}"]`) as HTMLElement;
              element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }, 0);
          }
          return next;
        });
      }
    } else if (event.key === 'Enter' && highlightedCustomerIndex >= 0 && highlightedCustomerIndex < customerResults.length) {
      event.preventDefault();
      const customer = customerResults[highlightedCustomerIndex];
      if (customer) {
        setSelectedCustomer(customer);
        setCustomerQuery(customer.cedulaNo ?? "");
        setCustomerResults([]);
        closeCustomerSearchDialog();
        
        // Focus categoria field after customer selection
        setTimeout(() => {
          if (categoryCharacterRef.current) {
            categoryCharacterRef.current.focus();
          }
        }, 100);
      }
    } else {
      // Use regular keyboard navigation for other keys
      handleKeyDown(event);
    }
  }, [closeCustomerSearchDialog, handleKeyDown, customerResults, highlightedCustomerIndex]);

  useEffect(() => {
    const model = interestModels.find((item) => item.id === Number(selectedModelId));
    const principalCents = parseCurrencyToCents(principalAmount);

    if (!model || principalCents === null || principalCents <= 0) {
      setManualSchedule([]);
      return;
    }

    // Use defaultTermCount from the model instead of user input
    const termCount = model.defaultTermCount || 1;
    setManualSchedule(generateSchedule(principalCents, model, termCount, todayIso()));
  }, [interestModels, selectedModelId, principalAmount]);

  const currentModel = useMemo(
    () => interestModels.find((item) => item.id === Number(selectedModelId)) ?? null,
    [interestModels, selectedModelId]
  );

  const canSubmit = useMemo(() => {
    const branchNumeric = Number(branchId);
    const principalCents = parseCurrencyToCents(principalAmount);
    
    return (
      Number.isInteger(branchNumeric) &&
      branchNumeric > 0 &&
      selectedCustomer != null &&
      ticketNumber.trim().length > 0 &&
      collateralItems.some((item) => item.description.trim().length > 0) &&
      currentModel != null &&
      principalCents != null &&
      principalCents > 0 &&
      manualSchedule.length > 0
    );
  }, [branchId, selectedCustomer, ticketNumber, collateralItems, currentModel, principalAmount, manualSchedule.length]);


  const handleSelectCustomer = (customer: CustomerSummary) => {
    setSelectedCustomer(customer);
    setCustomerQuery(customer.cedulaNo ?? "");
    setCustomerResults([]);
    closeCustomerSearchDialog();
    
    // Focus categoria field after customer selection
    setTimeout(() => {
      if (categoryCharacterRef.current) {
        categoryCharacterRef.current.focus();
      }
    }, 100);
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setCustomerQuery("");
    setCustomerResults([]);
  };

  const loadCustomerDetail = async (customerId: number) => {
    setCustomerDetailLoading(true);
    setCustomerDetailError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}`);
      if (!response.ok) {
        throw new Error(`Failed to load customer (${response.status})`);
      }
      const payload = await response.json();
      setCustomerDetail({
        firstName: payload.customer.firstName || "",
        lastName: payload.customer.lastName || "",
        email: payload.customer.email || null,
        phone: payload.customer.phone || null,
        address: payload.customer.address || null,
      });
      setIsEditCustomerDialogOpen(true);
    } catch (error) {
      setCustomerDetailError(error instanceof Error ? error.message : "Unable to load customer");
    } finally {
      setCustomerDetailLoading(false);
    }
  };

  const handleEditCustomer = () => {
    if (selectedCustomer) {
      void loadCustomerDetail(selectedCustomer.id);
    }
  };

  const handleSaveCustomer = async () => {
    if (!selectedCustomer || !customerDetail) return;

    setCustomerSaving(true);
    setCustomerDetailError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/${selectedCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: customerDetail.firstName.trim(),
          lastName: customerDetail.lastName.trim(),
          email: customerDetail.email?.trim() || null,
          phone: customerDetail.phone?.trim() || null,
          address: customerDetail.address?.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update customer");
      }

      const payload = await response.json();
      // Update selected customer with new data
      setSelectedCustomer({
        id: selectedCustomer.id,
        fullName: `${payload.customer.firstName} ${payload.customer.lastName}`.trim(),
        phone: payload.customer.phone,
        email: payload.customer.email,
        cedulaNo: payload.customer.cedulaNo ?? selectedCustomer.cedulaNo ?? null,
        branchId: selectedCustomer.branchId,
      });
      setIsEditCustomerDialogOpen(false);
    } catch (error) {
      setCustomerDetailError(error instanceof Error ? error.message : "Unable to update customer");
    } finally {
      setCustomerSaving(false);
    }
  };

  const updateCollateralItem = (index: number, patch: Partial<CollateralItem>) => {
    setCollateralItems((previous) => previous.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const addCollateralRow = () => {
    setCollateralItems((previous) => {
      if (previous.length >= 4) return previous;
      return [...previous, { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" }];
    });
  };

  const removeCollateralRow = (index: number) => {
    setCollateralItems((previous) => {
      const filtered = previous.filter((_, idx) => idx !== index);
      // If we have less than 4 items after removal, add an empty one at the end
      if (filtered.length < 4) {
        return [...filtered, { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" }];
      }
      return filtered;
    });
  };

  const handleScheduleChange = (index: number, patch: Partial<LoanScheduleRow>) => {
    setManualSchedule((previous) =>
      previous.map((row, idx) => (idx === index ? { ...row, ...patch } : row))
    );
  };

  const submitLoan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const model = currentModel;
    const principalCents = parseCurrencyToCents(principalAmount);

    if (!model || !principalCents || principalCents <= 0 || manualSchedule.length === 0) {
      setSubmissionError("Completa los términos del préstamo antes de enviar.");
      return;
    }

    if (!selectedCustomer) {
      setSubmissionError("Selecciona un cliente antes de enviar.");
      return;
    }

    setSubmitting(true);
    setSubmissionError(null);

    try {
      const numericBranchId = Number(branchId);
      const numericCustomerId = selectedCustomer?.id ? Number(selectedCustomer.id) : null;
      const numericInterestModelId = model.id ? Number(model.id) : null;

      if (!Number.isInteger(numericBranchId) || numericBranchId <= 0) {
        setSubmissionError("La sucursal no es válida. Debe ser un número entero positivo.");
        setSubmitting(false);
        return;
      }

      if (!numericCustomerId || !Number.isInteger(numericCustomerId) || numericCustomerId <= 0) {
        setSubmissionError("El cliente seleccionado no es válido. Debe ser un número entero positivo.");
        setSubmitting(false);
        return;
      }

      if (!numericInterestModelId || !Number.isInteger(numericInterestModelId) || numericInterestModelId <= 0) {
        setSubmissionError("El modelo de interés seleccionado no es válido. Debe ser un número entero positivo.");
        setSubmitting(false);
        return;
      }

      if (!principalCents || !Number.isFinite(principalCents) || principalCents <= 0) {
        setSubmissionError("El monto del préstamo debe ser mayor a cero.");
        setSubmitting(false);
        return;
      }

      // Get active shift for the branch to associate loan payout
      let activeShiftId: number | null = null;
      if (activeBranch) {
        try {
          const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
          const shiftResponse = await fetch(`${API_BASE_URL}/api/shifts/active?branchId=${activeBranch.id}`);
          if (shiftResponse.ok) {
            const shiftData = await shiftResponse.json();
            activeShiftId = shiftData.shift?.id ?? null;
          }
        } catch {
          // If shift lookup fails, continue without shiftId
        }
      }

      const payloadData: {
        branchId: number;
        customerId: number;
        ticketNumber: string;
        interestModelId: number;
        principalCents: number;
        schedule: Array<{ dueOn: string; interestCents: number; feeCents: number }>;
        collateral: Array<{
          description: string;
          estimatedValueCents: number;
          photoPath: string | null;
        }>;
        idImagePaths: never[];
        shiftId?: number;
      } = {
        branchId: numericBranchId,
        customerId: numericCustomerId,
        ticketNumber: ticketNumber.trim(),
        interestModelId: numericInterestModelId,
        principalCents: Math.round(principalCents),
        schedule: manualSchedule.map((row) => ({
          dueOn: row.dueOn,
          interestCents: row.interestCents,
          feeCents: row.feeCents,
        })),
        collateral: collateralItems
          .filter((item) => item.description.trim().length > 0)
          .map((item) => ({
            description: item.description.trim(),
            estimatedValueCents: parseCurrencyToCents(item.estimatedValue) ?? 0,
            photoPath: item.photoPath.trim() || null,
          })),
        idImagePaths: [],
      };

      // Add shiftId if available
      if (activeShiftId !== null) {
        payloadData.shiftId = activeShiftId;
      }

      const payload = await postJson<{
        loan: { id: number; ticketNumber: string };
      }>("/api/loans", payloadData);

      setSubmittedTicket({ loanId: payload.loan.id, ticketNumber: payload.loan.ticketNumber });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el préstamo";
      setSubmissionError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-slate-500">Préstamos</span>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Nuevo préstamo / empeño</h1>
      </header>

      <form className="space-y-4" onSubmit={submitLoan}>
        {/* Customer Section */}
        <section className="rounded-xl border border-slate-200 bg-white/80 pt-4 px-4 pb-1 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
          <div className="mb-2 flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
            <User className="h-4 w-4 text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Datos del cliente</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 items-start">
            {/* Left side - Customer search and ticket */}
            <div className="space-y-3">
              <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Buscar cliente</label>
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <input
                    ref={customerSearchInputRef}
                  value={customerQuery}
                  onChange={(event) => {
                    const newValue = event.target.value;
                    setCustomerQuery(newValue);
                      if (selectedCustomer && newValue.trim() !== (selectedCustomer.cedulaNo ?? "")) {
                      setSelectedCustomer(null);
                    }
                    // Auto-open dialog when user types 2+ characters
                    if (newValue.trim().length >= 2 && !isCustomerSearchOpen) {
                      setCustomerSearchOpen(true);
                      setCustomerSearchError(null);
                    }
                  }}
                  onFocus={() => {
                    // Open dialog when field is focused and has content
                    if (customerQuery.trim().length >= 2 && !isCustomerSearchOpen) {
                      setCustomerSearchOpen(true);
                      setCustomerSearchError(null);
                    }
                  }}
                    onKeyDown={handleKeyDown}
                  type="search"
                    placeholder="Cédula o teléfono (ej: 222-2222222-2 o 22222222222)"
                  className="w-full flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomerSearchOpen(true);
                    setCustomerSearchError(null);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-500/20"
                >
                  <Search className="h-4 w-4" /> Buscar
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddCustomerDialogOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  <Plus className="h-4 w-4" />
                  Agregar
                </button>
              </div>

              {selectedCustomer ? (
                  <div className="flex flex-col gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{selectedCustomer.fullName}</p>
                      <p className="text-xs opacity-80">
                        {selectedCustomer.phone ?? selectedCustomer.email ?? "Sin datos de contacto"}
                      </p>
                    </div>
                      <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleEditCustomer}
                        disabled={customerDetailLoading}
                        className="text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-200 disabled:opacity-50"
                      >
                        {customerDetailLoading ? "Cargando..." : "Editar"}
                      </button>
                      <button
                        type="button"
                        onClick={clearSelectedCustomer}
                        className="text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-200"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

              <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Ticket</label>
              <input
                value={ticketNumber}
                readOnly
                type="text"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm shadow-sm cursor-not-allowed dark:border-slate-600 dark:bg-slate-800/60"
                placeholder="Ej. PAWN-000001"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  {ticketLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" /> Generando ticket según sucursal...
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="h-3.5 w-3.5 text-indigo-500" /> Ticket sugerido automáticamente para la sucursal activa.
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {ticketError ? (
                    <button
                      type="button"
                      onClick={() => void loadTicketNumber()}
                      className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-700 transition hover:border-amber-400 hover:text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200"
                    >
                      Reintentar
                    </button>
                  ) : null}
                </div>
              </div>
              {ticketError ? (
                <p className="text-xs text-rose-600 dark:text-rose-300">{ticketError}</p>
              ) : null}
              </div>
            </div>

            {/* Right side - ID Images */}
            {selectedCustomer?.cedulaNo ? (
              <div className="space-y-1 self-start">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Imágenes de Cédula
                </h3>
                <div className="w-fit" style={{ transform: 'scale(0.8)', transformOrigin: 'top left', marginBottom: 'calc(-20% - 4px)' }}>
                  <div className="grid grid-cols-1 gap-1">
                    {/* Front ID Image */}
                    <div className="inline-block rounded border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-0.5 px-1">
                        Frente
                      </p>
                      {(() => {
                        const cedulaNoEncoded = encodeURIComponent(selectedCustomer.cedulaNo ?? "");
                        return (
                          <img
                            src={`${API_BASE_URL}/api/customers/${cedulaNoEncoded}/id-image/front`}
                            alt="Cédula - Frente"
                            className="block w-full h-auto rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                              const parent = (e.target as HTMLImageElement).parentElement;
                              if (parent && !parent.querySelector(".error-message")) {
                                const errorDiv = document.createElement("div");
                                errorDiv.className = "error-message text-xs text-slate-400 text-center py-4";
                                errorDiv.textContent = "Imagen no encontrada";
                                parent.appendChild(errorDiv);
                              }
                            }}
                          />
                        );
                      })()}
                    </div>
                    {/* Back ID Image */}
                    <div className="inline-block rounded border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-0.5 px-1">
                        Reverso
                      </p>
                      {(() => {
                        const cedulaNoEncoded = encodeURIComponent(selectedCustomer.cedulaNo ?? "");
                        return (
                          <img
                            src={`${API_BASE_URL}/api/customers/${cedulaNoEncoded}/id-image/back`}
                            alt="Cédula - Reverso"
                            className="block w-full h-auto rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                              const parent = (e.target as HTMLImageElement).parentElement;
                              if (parent && !parent.querySelector(".error-message")) {
                                const errorDiv = document.createElement("div");
                                errorDiv.className = "error-message text-xs text-slate-400 text-center py-4";
                                errorDiv.textContent = "Imagen no encontrada";
                                parent.appendChild(errorDiv);
                              }
                            }}
                          />
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="text-sm text-slate-400 dark:text-slate-500">Selecciona un cliente para ver las imágenes de cédula</p>
              </div>
            )}
          </div>
        </section>

        {/* Collateral Section */}
        <section className="rounded-xl border border-slate-200 bg-white/80 pt-4 px-4 pb-0 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
          <div className="mb-2 flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
            <PackagePlus className="h-4 w-4 text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Colateral</h2>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Registra cada artículo entregado como garantía. Puedes adjuntar fotos del artículo.
            </p>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Categoría</label>
              <input
                ref={categoryCharacterRef}
                type="text"
                maxLength={1}
                value={selectedCategoryCharacter}
                onChange={(event) => {
                  const char = event.target.value.toUpperCase().slice(0, 1);
                  const previousChar = selectedCategoryCharacter.toUpperCase();
                  const wasPrendas = previousChar === "P" && categoryCharacterValid === true;
                  
                  setSelectedCategoryCharacter(char);
                  if (char) {
                    const category = categories.find((c) => c.caracter?.toUpperCase() === char);
                    if (category) {
                      setSelectedCategoryId(category.id);
                      setCategoryCharacterValid(true);
                      
                      // Auto-fill collateral items when category "C" is selected
                      if (char === "C") {
                        setCollateralItems([
                          { qty: "1", description: "CELULAR", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
                          { qty: "", description: "SIN CARGADOR, SIN SIM, S/MRIA", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
                          { qty: "", description: "IMEI: ", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
                          { qty: "", description: "CLAVE: ", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
                        ]);
                      } else if (wasPrendas && char !== "P") {
                        // Clear kilate and peso when switching away from "P"
                        setCollateralItems((prev) =>
                          prev.map((item) => ({ ...item, kilate: "", weight: "" }))
                        );
                      }
                      
                      // Focus qty1 (first collateral item's qty field) after categoria
                      setTimeout(() => {
                        const qty1Field = collateralInputRefs.current[0]?.[0];
                        if (qty1Field) {
                          qty1Field.focus();
                        }
                      }, 0);
                    } else {
                      setSelectedCategoryId(null);
                      setCategoryCharacterValid(false);
                      // Clear kilate and peso if we were on "P" and now invalid
                      if (wasPrendas) {
                        setCollateralItems((prev) =>
                          prev.map((item) => ({ ...item, kilate: "", weight: "" }))
                        );
                      }
                      // Select all text if invalid
                      setTimeout(() => {
                        if (categoryCharacterRef.current) {
                          categoryCharacterRef.current.select();
                        }
                      }, 0);
                    }
                  } else {
                    setSelectedCategoryId(null);
                    setCategoryCharacterValid(null);
                    // Clear kilate and peso when categoria is cleared if it was "P"
                    if (wasPrendas) {
                      setCollateralItems((prev) =>
                        prev.map((item) => ({ ...item, kilate: "", weight: "" }))
                      );
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (categoryCharacterValid && selectedCategoryId) {
                      // Focus qty1 (first collateral item's qty field) after categoria
                      const qty1Field = collateralInputRefs.current[0]?.[0];
                      if (qty1Field) {
                        qty1Field.focus();
                      }
                    }
                  } else {
                    handleKeyDown(e);
                  }
                }}
                className={`w-12 rounded-lg border px-2 py-2 text-center text-sm font-semibold uppercase focus:outline-none focus:ring-2 ${
                  categoryCharacterValid === true
                    ? "border-green-500 bg-green-50 focus:border-green-500 focus:ring-green-200 dark:bg-green-900/20 dark:border-green-600"
                    : categoryCharacterValid === false
                    ? "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-200 dark:bg-red-900/20 dark:border-red-600"
                    : "border-slate-300 bg-white focus:border-indigo-500 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                }`}
                placeholder="E"
              />
              {selectedCategoryId && categoryCharacterValid && (
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  {categories.find((c) => c.id === selectedCategoryId)?.name}
                </span>
              )}
              {categoryCharacterValid === false && selectedCategoryCharacter && (
                <span className="text-sm text-red-600 dark:text-red-400">
                  Carácter no válido
                </span>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
              {/* Header Row */}
              <div className="grid gap-2 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 sm:grid-cols-12 border-b border-slate-200 dark:border-slate-700">
                <div className="sm:col-span-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">QTY</p>
                </div>
                <div className="sm:col-span-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">DESCRIPCIÓN</p>
                </div>
                <div className="sm:col-span-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">KILATE</p>
                </div>
                <div className="sm:col-span-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">PESO</p>
                </div>
                <div className="sm:col-span-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">VALOR ESTIMADO</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">FOTO</p>
                </div>
                <div className="sm:col-span-1">
                  {/* Empty header for Quitar button */}
                </div>
              </div>
              
              {/* Data Rows */}
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {collateralItems.map((item, index) => (
                <div
                  key={index}
                    className="grid gap-2 px-3 py-2 sm:grid-cols-12 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                >
                  <div className="sm:col-span-1">
                    <input
                        ref={(el) => {
                          if (!collateralInputRefs.current[index]) {
                            collateralInputRefs.current[index] = [];
                          }
                          collateralInputRefs.current[index][0] = el;
                        }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      value={item.qty}
                      onChange={(event) => {
                        const value = event.target.value.replace(/\D/g, "").slice(0, 3);
                        updateCollateralItem(index, { qty: value });
                      }}
                        onKeyDown={handleKeyDown}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-center focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                      placeholder="1"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                        ref={(el) => {
                          if (!collateralInputRefs.current[index]) {
                            collateralInputRefs.current[index] = [];
                          }
                          collateralInputRefs.current[index][1] = el;
                        }}
                      value={item.description}
                      maxLength={30}
                      onChange={(event) => updateCollateralItem(index, { description: event.target.value })}
                        onKeyDown={handleKeyDown}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                        placeholder="Ej. Cadena cubana"
                    />
                      <p className="mt-0.5 text-xs text-slate-400">{item.description.length}/30</p>
                  </div>
                  <div className="sm:col-span-1">
                    <input
                        ref={(el) => {
                          if (!collateralInputRefs.current[index]) {
                            collateralInputRefs.current[index] = [];
                          }
                          collateralInputRefs.current[index][2] = el;
                        }}
                      value={item.kilate}
                      onChange={(event) => updateCollateralItem(index, { kilate: event.target.value })}
                        onKeyDown={handleKeyDown}
                        disabled={!isPrendasCategory}
                        className={`w-full rounded-lg border px-2 py-1.5 text-sm text-center focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
                          isPrendasCategory
                            ? "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                            : "border-slate-200 bg-slate-50 cursor-not-allowed dark:border-slate-700 dark:bg-slate-800/50"
                        }`}
                      placeholder="14k"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <input
                        ref={(el) => {
                          if (!collateralInputRefs.current[index]) {
                            collateralInputRefs.current[index] = [];
                          }
                          collateralInputRefs.current[index][3] = el;
                        }}
                      value={item.weight}
                      onChange={(event) => updateCollateralItem(index, { weight: event.target.value })}
                        onKeyDown={handleKeyDown}
                        disabled={!isPrendasCategory}
                        className={`w-full rounded-lg border px-2 py-1.5 text-sm text-center focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
                          isPrendasCategory
                            ? "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                            : "border-slate-200 bg-slate-50 cursor-not-allowed dark:border-slate-700 dark:bg-slate-800/50"
                        }`}
                      placeholder="g"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                        ref={(el) => {
                          if (!collateralInputRefs.current[index]) {
                            collateralInputRefs.current[index] = [];
                          }
                          collateralInputRefs.current[index][4] = el;
                        }}
                      value={item.estimatedValue}
                      onChange={(event) => updateCollateralItem(index, { estimatedValue: event.target.value })}
                        onKeyDown={handleKeyDown}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                      placeholder="RD$"
                    />
                  </div>
                  <div className="sm:col-span-2">
                      <label className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white p-1.5 text-sm transition hover:bg-slate-50 focus-within:border-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800">
                      <Camera className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            updateCollateralItem(index, { photoPath: file.name });
                          }
                        }}
                      />
                    </label>
                    {item.photoPath && (
                        <p className="mt-0.5 truncate text-xs text-slate-500">{item.photoPath}</p>
                    )}
                  </div>
                    <div className="sm:col-span-1 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => removeCollateralRow(index)}
                        className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-100"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
        </section>

        {/* IMEI Lookup Results Section */}
        {(imeiLookupResult || imeiLookupLoading || imeiLookupError) && (
          <section className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
            <div className="mb-2 flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Información del IMEI</h2>
            </div>
            {imeiLookupLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-slate-600 dark:text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                Verificando IMEI...
              </div>
            ) : imeiLookupError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                {imeiLookupError}
              </div>
            ) : imeiLookupResult ? (
              <div className="space-y-3 text-sm">
                {/* Basic IMEI Info */}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">IMEI</p>
                    <p className="text-slate-900 dark:text-slate-100">{imeiLookupResult.imei}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Estado de Blacklist</p>
                    <p className={`font-semibold ${
                      imeiLookupResult.blacklistStatus.toUpperCase() === "CLEAN" 
                        ? "text-green-600 dark:text-green-400" 
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {imeiLookupResult.blacklistStatus}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Fabricante</p>
                    <p className="text-slate-900 dark:text-slate-100">{imeiLookupResult.manufacturer || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Nombre del Modelo</p>
                    <p className="text-slate-900 dark:text-slate-100">{imeiLookupResult.modelName || "N/A"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Número de Modelo</p>
                  <p className="text-slate-900 dark:text-slate-100">{imeiLookupResult.modelNumber || "N/A"}</p>
                </div>
                
                {/* iPhone-specific information */}
                {(imeiLookupResult.modelDescription || imeiLookupResult.iCloudLock || imeiLookupResult.simLockStatus) && (
                  <>
                    <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Información Detallada del iPhone</p>
                    </div>
                    {imeiLookupResult.modelDescription && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Descripción del Modelo</p>
                        <p className="text-slate-900 dark:text-slate-100">{imeiLookupResult.modelDescription}</p>
                      </div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">iCloud Lock</p>
                        <p className={`font-semibold ${
                          imeiLookupResult.iCloudLock?.toUpperCase() === "OFF" 
                            ? "text-green-600 dark:text-green-400" 
                            : imeiLookupResult.iCloudLock
                            ? "text-red-600 dark:text-red-400"
                            : "text-slate-500 dark:text-slate-400"
                        }`}>
                          {imeiLookupResult.iCloudLock || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Estado de Sim-Lock</p>
                        <p className={`font-semibold ${
                          imeiLookupResult.simLockStatus?.toUpperCase() === "UNLOCKED" 
                            ? "text-green-600 dark:text-green-400" 
                            : imeiLookupResult.simLockStatus && imeiLookupResult.simLockStatus.toUpperCase() !== "LOCKED"
                            ? "text-amber-600 dark:text-amber-400"
                            : imeiLookupResult.simLockStatus
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-slate-500 dark:text-slate-400"
                        }`}>
                          {imeiLookupResult.simLockStatus || "N/A"}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </section>
        )}

        {/* Terms Section */}
        <section className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
          <div className="mb-2 flex items-center gap-2 border-b border-slate-200 pb-1.5 dark:border-slate-700">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Términos</h2>
          </div>
          <div className="space-y-2.5">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Monto prestado</label>
                <input
                  ref={principalAmountRef}
                  value={principalAmount}
                  onChange={(event) => setPrincipalAmount(event.target.value)}
                  onKeyDown={handleKeyDown}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                  placeholder="RD$"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Fecha inicial</label>
                <input
                  value={todayIso()}
                  type="date"
                  disabled
                  readOnly
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-sm cursor-not-allowed dark:border-slate-600 dark:bg-slate-800/60"
                />
              </div>
            </div>

            {loadingModels ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" /> Cargando modelos...
              </div>
            ) : modelsError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                {modelsError}
              </div>
            ) : (
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                {interestModels.map((model) => (
                  <label
                    key={model.id}
                    className={classNames(
                      "flex cursor-pointer flex-col gap-1 rounded-lg border p-2.5 shadow-sm transition",
                      Number(selectedModelId) === model.id
                        ? "border-indigo-500 ring-1 ring-indigo-200"
                        : "border-slate-200 hover:border-indigo-400"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{model.name}</p>
                        <p className="text-xs text-slate-500 truncate">{model.description ?? "Sin descripción"}</p>
                      </div>
                      <input
                        type="radio"
                        name="interestModel"
                        value={model.id}
                        checked={Number(selectedModelId) === model.id}
                        onChange={(event) => setSelectedModelId(event.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-3.5 w-3.5 ml-2 flex-shrink-0"
                      />
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                      <p className="truncate">Tasa: {(model.interestRateBps / 100).toFixed(2)}% · {model.periodDays}d</p>
                      {(model.minPrincipalCents || model.maxPrincipalCents) && (
                        <p className="truncate">
                          {model.minPrincipalCents && `Mín: ${pesoFormatter.format(model.minPrincipalCents / 100)}`}
                          {model.minPrincipalCents && model.maxPrincipalCents && " · "}
                          {model.maxPrincipalCents && `Máx: ${pesoFormatter.format(model.maxPrincipalCents / 100)}`}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsScheduleDialogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-500/20"
            >
              <FileText className="h-3.5 w-3.5" />
              Ver términos
            </button>
          </div>
        </section>

        {/* Success Message */}
        {submittedTicket && (
          <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-8 shadow-lg dark:border-emerald-500/40 dark:bg-emerald-500/10">
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="mr-2 inline h-4 w-4" /> Préstamo registrado exitosamente. Ticket #{submittedTicket.ticketNumber}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Resumen del préstamo</h2>
                <dl className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between">
                    <dt>Ticket</dt>
                    <dd>{ticketNumber}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Sucursal</dt>
                    <dd>{branchId}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Cliente</dt>
                    <dd>
                      {selectedCustomer
                        ? `${selectedCustomer.fullName} (#${selectedCustomer.id})`
                        : "N/A"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Monto prestado</dt>
                    <dd>{pesoFormatter.format((parseCurrencyToCents(principalAmount) ?? 0) / 100)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Modelo</dt>
                    <dd>{currentModel?.name ?? "N/A"}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Colateral</h2>
                <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {collateralItems
                    .filter((item) => item.description.trim().length > 0)
                    .map((item, index) => (
                      <li key={index} className="flex justify-between">
                        <span>{item.description}</span>
                        <span>{item.estimatedValue || "-"}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h3 className="font-semibold text-slate-700 dark:text-slate-200">Calendario</h3>
              <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {manualSchedule.map((row, index) => (
                  <li key={index} className="flex justify-between">
                    <span>Cuota #{index + 1}</span>
                    <span>
                      {row.dueOn} · Interés {pesoFormatter.format(row.interestCents / 100)} · Cargo {pesoFormatter.format(
                        row.feeCents / 100
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {submissionError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
                {submissionError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <FileText className="h-4 w-4" /> Imprimir ticket
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerQuery("");
                  setTicketNumber("");
                  setTicketError(null);
                  setTicketLoading(false);
                  void loadTicketNumber();
                  setCustomerResults([]);
                  setCustomerSearchError(null);
                  setCollateralItems([
                    { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
                    { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
                    { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
                    { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
                  ]);
                  setSelectedModelId("");
                  setPrincipalAmount("");
                  setManualSchedule([]);
                  setSubmittedTicket(null);
                }}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-600"
              >
                Nuevo préstamo
              </button>
            </div>
          </section>
        )}

        {/* Submit Section */}
        {!submittedTicket && (
          <section className="rounded-xl border border-slate-200 bg-white/80 p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
            <div className="space-y-6">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <p>
                  Revisa toda la información antes de emitir el ticket. Se registrarán los artículos, interés y ID de cedula en la base de datos. Sé tan descriptivo como sea posible de los artículos incluyendo rayaduras, golpes, peladura, y serial.
                </p>
              </div>

              {submissionError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
                  {submissionError}
                </div>
              )}

              <button
                ref={submitButtonRef}
                type="submit"
                disabled={submitting || !canSubmit}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow transition-all duration-200 hover:bg-indigo-700 hover:scale-105 focus:ring-4 focus:ring-indigo-300 focus:ring-offset-2 focus:outline-none focus:scale-105 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Emitir ticket
              </button>
            </div>
          </section>
        )}
      </form>
      </div>
      {isCustomerSearchOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={closeCustomerSearchDialog}
        >
          <div
            className="w-full max-w-3xl space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Buscar cliente</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Busca clientes por cédula o teléfono para vincularlos al nuevo préstamo.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCustomerSearchDialog}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Cerrar búsqueda de clientes"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              Cédula o teléfono
              <input
                ref={customerSearchDialogInputRef}
                value={customerQuery}
                onChange={(event) => {
                  const newValue = event.target.value;
                  setCustomerQuery(newValue);
                  setHighlightedCustomerIndex(-1); // Reset highlight when query changes
                  if (selectedCustomer && newValue.trim() !== (selectedCustomer.cedulaNo ?? "")) {
                    setSelectedCustomer(null);
                  }
                }}
                onKeyDown={handleDialogKeyDown}
                autoFocus
                type="search"
                placeholder="Ej: 222-2222222-2 o 22222222222"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>

            {customerSearchError ? (
              <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                {customerSearchError}
              </div>
            ) : null}

            <div className="max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-inner dark:border-slate-800 dark:bg-slate-950/40">
              {customerSearchLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Buscando clientes...
                </div>
              ) : customerResults.length === 0 && !customerSearchError ? (
                <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  No se encontraron coincidencias para la búsqueda actual.
                </div>
              ) : customerResults.length > 0 ? (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {customerResults.map((customer, index) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        data-customer-index={index}
                        onClick={() => handleSelectCustomer(customer)}
                        onMouseEnter={() => setHighlightedCustomerIndex(index)}
                        className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition ${
                          highlightedCustomerIndex === index
                            ? 'bg-indigo-100 dark:bg-indigo-900/30'
                            : 'hover:bg-indigo-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{customer.fullName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {customer.phone ?? customer.email ?? "Sin contacto"}
                          </p>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">ID #{customer.id}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Add Customer Dialog */}
      <AddCustomerDialog
        isOpen={isAddCustomerDialogOpen}
        onClose={() => setIsAddCustomerDialogOpen(false)}
        onSuccess={(customer) => {
          const fullName = `${customer.firstName} ${customer.lastName}`.trim();
          const customerSummary: CustomerSummary = {
            id: customer.id,
            fullName,
            email: customer.email,
            phone: customer.phone,
            cedulaNo: customer.cedulaNo,
            branchId: null,
          };
          setSelectedCustomer(customerSummary);
          setCustomerQuery(fullName);
          setCustomerResults([]);
          setIsAddCustomerDialogOpen(false);
          
          // Focus categoria field after adding customer
          setTimeout(() => {
            if (categoryCharacterRef.current) {
              categoryCharacterRef.current.focus();
            }
          }, 100);
        }}
        onError={(error) => setCustomerSearchError(error)}
      />

      {/* Edit Customer Dialog */}
      {isEditCustomerDialogOpen && customerDetail ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={() => setIsEditCustomerDialogOpen(false)}
        >
          <div
            className="w-full max-w-2xl space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Editar cliente</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Modifica los datos del cliente según sea necesario.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditCustomerDialogOpen(false)}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Cerrar edición de cliente"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {customerDetailError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                {customerDetailError}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Nombre
                  <input
                    value={customerDetail.firstName}
                    onChange={(event) =>
                      setCustomerDetail({ ...customerDetail, firstName: event.target.value })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Nombre"
                  />
                </label>
              </div>
              <div className="sm:col-span-1">
                <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Apellido
                  <input
                    value={customerDetail.lastName}
                    onChange={(event) =>
                      setCustomerDetail({ ...customerDetail, lastName: event.target.value })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Apellido"
                  />
                </label>
              </div>
              <div className="sm:col-span-1">
                <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Teléfono
                  <input
                    type="tel"
                    value={customerDetail.phone || ""}
                    onChange={(event) =>
                      setCustomerDetail({ ...customerDetail, phone: event.target.value || null })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Teléfono"
                  />
                </label>
              </div>
              <div className="sm:col-span-1">
                <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Correo electrónico
                  <input
                    type="email"
                    value={customerDetail.email || ""}
                    onChange={(event) =>
                      setCustomerDetail({ ...customerDetail, email: event.target.value || null })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Correo electrónico"
                  />
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Dirección
                  <textarea
                    value={customerDetail.address || ""}
                    onChange={(event) =>
                      setCustomerDetail({ ...customerDetail, address: event.target.value || null })
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
                onClick={() => setIsEditCustomerDialogOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveCustomer()}
                disabled={customerSaving || !customerDetail.firstName.trim() || !customerDetail.lastName.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {customerSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
                  </>
                ) : (
                  "Guardar"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Schedule Terms Dialog */}
      {isScheduleDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={() => setIsScheduleDialogOpen(false)}
        >
          <div
            className="w-full max-w-4xl space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Términos del préstamo</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Calendario de pagos y términos del préstamo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleDialogOpen(false)}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Cerrar diálogo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] table-fixed border-collapse overflow-hidden rounded-lg border border-slate-200 text-sm shadow-sm dark:border-slate-700">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Vence</th>
                    <th className="px-4 py-2 text-left">Interés</th>
                    <th className="px-4 py-2 text-left">Cargo</th>
                  </tr>
                </thead>
                <tbody>
                  {manualSchedule.map((row, index) => (
                    <tr key={index} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{index + 1}</td>
                      <td className="px-4 py-2">
                        <input
                          value={row.dueOn}
                          onChange={(event) => handleScheduleChange(index, { dueOn: event.target.value })}
                          type="date"
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={(row.interestCents / 100).toFixed(2)}
                          onChange={(event) =>
                            handleScheduleChange(index, {
                              interestCents: Math.max(0, Math.round(Number(event.target.value) * 100 || 0)),
                            })
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={(row.feeCents / 100).toFixed(2)}
                          onChange={(event) =>
                            handleScheduleChange(index, {
                              feeCents: Math.max(0, Math.round(Number(event.target.value) * 100 || 0)),
                            })
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                        />
                      </td>
                    </tr>
                  ))}
                  {manualSchedule.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-xs text-slate-500" colSpan={4}>
                        Selecciona un modelo y completa el monto para ver el calendario sugerido.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

