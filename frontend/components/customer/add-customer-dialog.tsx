"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, X } from "lucide-react";
import { useActiveBranch } from "@/components/providers/active-branch-provider";
import { extractIdCardData } from "@/lib/ocr-id-extractor";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type CustomerFormData = {
  firstName: string;
  lastName: string;
  cedulaNo: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
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
    dateOfBirth: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExtractingFromCedula, setIsExtractingFromCedula] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [showCedulaImages, setShowCedulaImages] = useState(false);
  const cedulaExtractionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasExtractedFromCedulaRef = useRef<string>(""); // Track which cedula we've already extracted
  
  // Refs for form fields
  const cedulaNoRef = useRef<HTMLInputElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const dateOfBirthRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);

  const handleClose = () => {
    setFormData({
      firstName: "",
      lastName: "",
      cedulaNo: "",
      email: "",
      phone: "",
      address: "",
      dateOfBirth: "",
    });
    setError(null);
    setOcrError(null);
    setShowCedulaImages(false);
    hasExtractedFromCedulaRef.current = ""; // Reset extraction tracking
    onClose();
  };

  // Format phone number to ###-###-####
  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Limit to 10 digits
    const limited = digits.slice(0, 10);
    
    // Format as ###-###-####
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 6) {
      return `${limited.slice(0, 3)}-${limited.slice(3)}`;
    } else {
      return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`;
    }
  };

  // Validate and format email
  const formatEmail = (value: string): string => {
    // Allow typing, but ensure @ is present for valid emails
    return value;
  };

  // Validate date components
  const validateDateComponents = (day: string, month: string, year: string): { isValid: boolean; error?: string } => {
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    const currentYear = new Date().getFullYear();

    // Validate month (1-12)
    if (month && (monthNum < 1 || monthNum > 12)) {
      return { isValid: false, error: 'Mes debe estar entre 01 y 12' };
    }

    // Validate year (reasonable range: 1900 to current year + 1)
    if (year && year.length === 4 && (yearNum < 1900 || yearNum > currentYear + 1)) {
      return { isValid: false, error: `Año debe estar entre 1900 y ${currentYear + 1}` };
    }

    // Validate day based on month
    if (day && month && year && year.length === 4) {
      const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
      if (dayNum < 1 || dayNum > daysInMonth) {
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return { isValid: false, error: `${monthNames[monthNum - 1]} solo tiene ${daysInMonth} días` };
      }
    }

    return { isValid: true };
  };

  // Convert YYYY-MM-DD to DD/MM/YYYY for display
  const formatDateForInput = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    // If already in DD/MM/YYYY format, return as is
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      return dateStr;
    }
    // If in YYYY-MM-DD format, convert to DD/MM/YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  // Convert DD/MM/YYYY to YYYY-MM-DD for API
  const formatDateForAPI = (dateStr: string | null | undefined): string | null => {
    if (!dateStr || !dateStr.trim()) return null;
    const trimmed = dateStr.trim();
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    // If in DD/MM/YYYY format, convert to YYYY-MM-DD
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split('/');
      // Validate before converting
      const validation = validateDateComponents(day, month, year);
      if (!validation.isValid) {
        return null; // Invalid date, don't convert
      }
      return `${year}-${month}-${day}`;
    }
    return null;
  };

  const extractFromCedulaImage = useCallback(async (cedulaNo: string) => {
    if (isExtractingFromCedula) return;
    
    // Clean cedula number for comparison
    const cedulaClean = cedulaNo.replace(/-/g, '').trim();
    
    // Don't extract if we've already extracted for this cedula
    if (hasExtractedFromCedulaRef.current === cedulaClean) {
      return;
    }
    
    setIsExtractingFromCedula(true);
    setOcrError(null);

    try {
      const cedulaEncoded = encodeURIComponent(cedulaClean);
      
      // Fetch the front ID image
      const frontImageUrl = `${API_BASE_URL}/api/customers/${cedulaEncoded}/id-image/front`;
      const frontResponse = await fetch(frontImageUrl);
      
      let extractedData: Partial<import('@/lib/ocr-id-extractor').ExtractedIdData> = {};
      
      if (frontResponse.ok) {
        // Convert response to blob, then to File
        const frontBlob = await frontResponse.blob();
        const frontFile = new File([frontBlob], `cedula_${cedulaClean}_front.jpg`, { type: frontBlob.type });
        
        // Extract data from front side
        const frontData = await extractIdCardData(frontFile, false);
        extractedData = { ...extractedData, ...frontData };
      }
      
      // Fetch the back ID image for address extraction
      const backImageUrl = `${API_BASE_URL}/api/customers/${cedulaEncoded}/id-image/back`;
      const backResponse = await fetch(backImageUrl);
      
      if (backResponse.ok) {
        // Convert response to blob, then to File
        const backBlob = await backResponse.blob();
        const backFile = new File([backBlob], `cedula_${cedulaClean}_back.jpg`, { type: backBlob.type });
        
      // Extract address from back side
      const backData = await extractIdCardData(backFile, true);
      extractedData = { ...extractedData, ...backData };
      }
      
      // Check if there's an error in the extracted data
      if (extractedData.error) {
        setOcrError(extractedData.error);
      } else {
        setOcrError(null);
      }
      
      // Mark this cedula as extracted
      hasExtractedFromCedulaRef.current = cedulaClean;
      
      // Auto-fill form with extracted data (only if fields are empty)
      // Convert dateOfBirth from YYYY-MM-DD to DD/MM/YYYY for display
      const dateOfBirthDisplay = extractedData.dateOfBirth 
        ? formatDateForInput(extractedData.dateOfBirth) 
        : '';
      
      const newFirstName = extractedData.firstName || '';
      const newLastName = extractedData.lastName || '';
      const newDateOfBirth = dateOfBirthDisplay;
      const newAddress = extractedData.address || '';
      
      setFormData((prev) => ({
        ...prev,
        firstName: prev.firstName || newFirstName,
        lastName: prev.lastName || newLastName,
        dateOfBirth: prev.dateOfBirth || newDateOfBirth,
        address: prev.address || newAddress,
      }));
      
      // Focus the next field (firstName) after extraction completes
      setTimeout(() => {
        if (newFirstName && firstNameRef.current) {
          firstNameRef.current.focus();
        } else if (firstNameRef.current) {
          firstNameRef.current.focus();
        }
      }, 100);
    } catch (err) {
      // Silently fail - don't show error if image doesn't exist
      console.log('Could not extract from ID image:', err);
    } finally {
      setIsExtractingFromCedula(false);
    }
  }, [formatDateForInput]);


  // Get all focusable elements in order
  const getFocusableElements = useCallback((): HTMLElement[] => {
    const elements: HTMLElement[] = [];
    
    if (cedulaNoRef.current) elements.push(cedulaNoRef.current);
    if (firstNameRef.current) elements.push(firstNameRef.current);
    if (lastNameRef.current) elements.push(lastNameRef.current);
    if (phoneRef.current) elements.push(phoneRef.current);
    if (emailRef.current) elements.push(emailRef.current);
    if (dateOfBirthRef.current) elements.push(dateOfBirthRef.current);
    if (addressRef.current) elements.push(addressRef.current);
    
    return elements.filter(el => {
      const input = el as HTMLInputElement | HTMLTextAreaElement;
      return (input.disabled !== true) && el.offsetParent !== null;
    });
  }, []);

  // Handle Enter key - move to next field
  const handleEnterKey = useCallback((event: React.KeyboardEvent<HTMLElement>, currentElement: HTMLElement) => {
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

    // For buttons, let default behavior
    if (currentElement.tagName === 'BUTTON') {
      return;
    }

    // If Enter is pressed on cedula field, show images and extract OCR
    if (currentElement === cedulaNoRef.current) {
      const cedulaNo = formData.cedulaNo.trim();
      const cedulaClean = cedulaNo.replace(/-/g, '');
      const hasFirstName = formData.firstName.trim().length > 0;
      const hasLastName = formData.lastName.trim().length > 0;
      
      // Show images if cedula has 8+ digits
      if (cedulaClean.length >= 8) {
        setShowCedulaImages(true);
        
        // Extract OCR if:
        // 1. Cedula has at least 8 digits
        // 2. firstName/lastName are empty
        // 3. Not currently extracting
        // 4. We haven't already extracted for this cedula
        if (!hasFirstName && 
            !hasLastName && 
            !isExtractingFromCedula &&
            hasExtractedFromCedulaRef.current !== cedulaClean) {
          // Extract immediately on Enter
          void extractFromCedulaImage(cedulaNo);
        }
      }
    }

    event.preventDefault();
    const focusable = getFocusableElements();
    const currentIndex = focusable.indexOf(currentElement);
    if (currentIndex < focusable.length - 1) {
      focusable[currentIndex + 1]?.focus();
    }
  }, [getFocusableElements, formData.cedulaNo, formData.firstName, formData.lastName, isExtractingFromCedula, extractFromCedulaImage]);

  // Handle Arrow key navigation
  const handleArrowKey = useCallback((event: React.KeyboardEvent<HTMLElement>, currentElement: HTMLElement) => {
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

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (currentIndex < focusable.length - 1) {
        focusable[currentIndex + 1]?.focus();
      } else {
        focusable[0]?.focus(); // Wrap to first
      }
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      if (currentIndex > 0) {
        focusable[currentIndex - 1]?.focus();
      } else {
        focusable[focusable.length - 1]?.focus(); // Wrap to last
      }
    }
  }, [getFocusableElements]);

  // Combined keyboard handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    const currentElement = event.currentTarget as HTMLElement;
    
    if (event.key === 'Enter') {
      handleEnterKey(event, currentElement);
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      handleArrowKey(event, currentElement);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
    }
  }, [handleEnterKey, handleArrowKey]);

  // Handle ESC key on dialog container
  useEffect(() => {
    if (!isOpen) return;
    
    const handleDialogKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        handleClose();
      }
    };
    
    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
    };
  }, [isOpen, isLoading, handleClose]);

  // Focus cedula field when dialog opens
  useEffect(() => {
    if (isOpen && cedulaNoRef.current) {
      // Small delay to ensure dialog is fully rendered
      setTimeout(() => {
        cedulaNoRef.current?.focus();
        cedulaNoRef.current?.select();
      }, 100);
    }
  }, [isOpen]);

  // Handler to select all text when field is focused
  const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    event.target.select();
  }, []);

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

    // Validate email format
    if (formData.email.trim() && !formData.email.includes('@')) {
      const errorMsg = "El correo electrónico debe contener @";
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    // Validate date of birth
    if (formData.dateOfBirth.trim()) {
      const dateValidation = formatDateForAPI(formData.dateOfBirth);
      if (!dateValidation) {
        const errorMsg = "La fecha de nacimiento no es válida. Verifica el día, mes y año.";
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }
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
          dateOfBirth: formatDateForAPI(formData.dateOfBirth),
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
        dateOfBirth: "",
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
        className={`w-full ${showCedulaImages && formData.cedulaNo.trim().length >= 8 ? 'max-w-5xl' : 'max-w-2xl'} space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Agregar cliente</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Complete los datos del nuevo cliente. Los campos marcados con * son obligatorios.
            </p>
            {showCedulaImages && formData.cedulaNo.trim().length >= 8 && (
              <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                Por favor revisar que la información extraída esté correcta
              </p>
            )}
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

        <div className={`grid gap-6 ${showCedulaImages && formData.cedulaNo.trim().length >= 8 ? 'sm:grid-cols-[1fr_300px]' : 'sm:grid-cols-1'}`}>
          {/* Form Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              Cédula No.
              <div className="relative">
                <input
                  ref={cedulaNoRef}
                  value={formData.cedulaNo}
                  onChange={(event) =>
                    setFormData({ ...formData, cedulaNo: event.target.value })
                  }
                  onFocus={handleFocus}
                  onKeyDown={handleKeyDown}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Cédula No."
                  maxLength={20}
                />
                {isExtractingFromCedula && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                  </div>
                )}
              </div>
              {isExtractingFromCedula && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Extrayendo información de la imagen...
                </p>
              )}
            </label>
          </div>
          <div className="sm:col-span-1">
            <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              Nombre *
              <input
                ref={firstNameRef}
                value={formData.firstName}
                onChange={(event) =>
                  setFormData({ ...formData, firstName: event.target.value })
                }
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
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
                ref={lastNameRef}
                value={formData.lastName}
                onChange={(event) =>
                  setFormData({ ...formData, lastName: event.target.value })
                }
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Apellido"
                maxLength={80}
              />
            </label>
          </div>
          <div className="sm:col-span-1">
            <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              Teléfono
              <input
                ref={phoneRef}
                type="tel"
                value={formData.phone}
                onChange={(event) => {
                  const formatted = formatPhoneNumber(event.target.value);
                  setFormData({ ...formData, phone: formatted });
                }}
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="###-###-####"
                maxLength={12}
              />
            </label>
          </div>
          <div className="sm:col-span-1">
            <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              Correo electrónico
              <input
                ref={emailRef}
                type="email"
                value={formData.email}
                onChange={(event) => {
                  let value = event.target.value;
                  // Ensure @ is present if user is typing a domain
                  // Allow typing freely but validate on blur/submit
                  setFormData({ ...formData, email: value });
                }}
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="correo@ejemplo.com"
                maxLength={190}
              />
            </label>
          </div>
          <div className="sm:col-span-1">
            <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              Fecha de nacimiento
              <input
                ref={dateOfBirthRef}
                type="text"
                value={formData.dateOfBirth}
                onChange={(event) => {
                  let value = event.target.value;
                  // Remove any non-digit characters except slashes
                  value = value.replace(/[^\d/]/g, '');
                  
                  // Auto-format as user types: DD/MM/YYYY
                  if (value.length > 2 && value[2] !== '/') {
                    value = value.slice(0, 2) + '/' + value.slice(2);
                  }
                  if (value.length > 5 && value[5] !== '/') {
                    value = value.slice(0, 5) + '/' + value.slice(5);
                  }
                  
                  // Limit to DD/MM/YYYY format (10 characters)
                  if (value.length <= 10) {
                    // Validate date components as user types
                    const parts = value.split('/');
                    if (parts.length === 3) {
                      const [day, month, year] = parts;
                      const validation = validateDateComponents(day, month, year);
                      if (!validation.isValid && value.length === 10) {
                        // Only show error when date is complete
                        setError(validation.error || 'Fecha inválida');
                      } else {
                        setError(null);
                      }
                    }
                    setFormData({ ...formData, dateOfBirth: value });
                  }
                }}
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="DD/MM/YYYY"
                maxLength={10}
              />
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              Dirección
              <textarea
                ref={addressRef}
                value={formData.address}
                onChange={(event) =>
                  setFormData({ ...formData, address: event.target.value })
                }
                onFocus={handleFocus}
                onKeyDown={(e) => {
                  // For textarea, use Ctrl+Enter to move to next field
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleEnterKey(e, e.currentTarget);
                  } else {
                    handleKeyDown(e);
                  }
                }}
                rows={3}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Dirección"
              />
            </label>
          </div>
          </div>
          
          {/* Right side - ID Images */}
          {showCedulaImages && formData.cedulaNo.trim().length >= 8 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 px-1">
                Imágenes de Cédula
              </h3>
              <div className="space-y-2">
                {/* Front ID Image */}
                <div className="rounded border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 px-2 py-1 bg-slate-50 dark:bg-slate-800/50">
                    Frente
                  </p>
                  {(() => {
                    const cedulaClean = formData.cedulaNo.replace(/-/g, '').trim();
                    const cedulaNoEncoded = encodeURIComponent(cedulaClean);
                    return (
                      <img
                        src={`${API_BASE_URL}/api/customers/${cedulaNoEncoded}/id-image/front`}
                        alt="Cédula - Frente"
                        className="w-full"
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
                <div className="rounded border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 px-2 py-1 bg-slate-50 dark:bg-slate-800/50">
                    Reverso
                  </p>
                  {(() => {
                    const cedulaClean = formData.cedulaNo.replace(/-/g, '').trim();
                    const cedulaNoEncoded = encodeURIComponent(cedulaClean);
                    return (
                      <img
                        src={`${API_BASE_URL}/api/customers/${cedulaNoEncoded}/id-image/back`}
                        alt="Cédula - Reverso"
                        className="w-full"
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
          ) : null}
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

