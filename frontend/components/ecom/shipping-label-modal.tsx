/**
 * Shipping Label Modal Component
 * UI for generating and managing shipping labels
 */

import { useState } from "react";
import { Loader2, Download, Printer, Package, Truck } from "lucide-react";

interface ShippingLabelModalProps {
  orderId: number;
  orderExternalId: string;
  customerName: string;
  shippingAddress: {
    name?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  } | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  onClose: () => void;
  onGenerate?: (carrier: string, service: string) => Promise<{ labelUrl?: string; trackingNumber?: string }>;
  onPrint?: (labelUrl: string) => void;
  className?: string;
}

const carriers = [
  { value: "fedex", label: "FedEx" },
  { value: "ups", label: "UPS" },
  { value: "usps", label: "USPS" },
  { value: "dhl", label: "DHL" },
  { value: "other", label: "Other" },
];

const services: Record<string, { value: string; label: string }[]> = {
  fedex: [
    { value: "ground", label: "Ground" },
    { value: "express", label: "Express" },
    { value: "overnight", label: "Overnight" },
  ],
  ups: [
    { value: "ground", label: "Ground" },
    { value: "2nd_day", label: "2nd Day Air" },
    { value: "next_day", label: "Next Day Air" },
  ],
  usps: [
    { value: "priority", label: "Priority Mail" },
    { value: "first_class", label: "First Class" },
    { value: "parcel", label: "Parcel Select" },
  ],
  dhl: [
    { value: "express", label: "Express" },
    { value: "economy", label: "Economy" },
  ],
  other: [
    { value: "standard", label: "Standard" },
  ],
};

export function ShippingLabelModal({
  orderId,
  orderExternalId,
  customerName,
  shippingAddress,
  trackingNumber,
  carrier,
  onClose,
  onGenerate,
  onPrint,
  className = "",
}: ShippingLabelModalProps) {
  const [selectedCarrier, setSelectedCarrier] = useState(carrier || "fedex");
  const [selectedService, setSelectedService] = useState("ground");
  const [isGenerating, setIsGenerating] = useState(false);
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const [generatedTracking, setGeneratedTracking] = useState<string | null>(trackingNumber || null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!onGenerate) {
      setError("Label generation not available");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await onGenerate(selectedCarrier, selectedService);
      if (result.labelUrl) {
        setLabelUrl(result.labelUrl);
      }
      if (result.trackingNumber) {
        setGeneratedTracking(result.trackingNumber);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate label");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    if (labelUrl && onPrint) {
      onPrint(labelUrl);
    } else if (labelUrl) {
      // Fallback: open in new window for printing
      const printWindow = window.open(labelUrl, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  };

  const handleDownload = () => {
    if (labelUrl) {
      const link = document.createElement("a");
      link.href = labelUrl;
      link.download = `shipping-label-${orderExternalId}.pdf`;
      link.click();
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 ${className}`}>
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Shipping Label</h2>
            <p className="text-xs text-muted-foreground">Order: {orderExternalId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Shipping Address Preview */}
          {shippingAddress && (
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Package className="h-4 w-4" /> Shipping Address
              </h3>
              <div className="text-sm text-muted-foreground">
                <div className="font-medium text-foreground">{shippingAddress.name || customerName}</div>
                {shippingAddress.address1 && <div>{shippingAddress.address1}</div>}
                {shippingAddress.address2 && <div>{shippingAddress.address2}</div>}
                <div>
                  {shippingAddress.city}
                  {shippingAddress.state && `, ${shippingAddress.state}`}
                  {shippingAddress.zip && ` ${shippingAddress.zip}`}
                </div>
                {shippingAddress.country && <div>{shippingAddress.country}</div>}
              </div>
            </div>
          )}

          {/* Carrier and Service Selection */}
          {!labelUrl && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Carrier *</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={selectedCarrier}
                  onChange={(e) => {
                    setSelectedCarrier(e.target.value);
                    // Reset service to first available
                    const availableServices = services[e.target.value] || services.other;
                    setSelectedService(availableServices[0]?.value || "standard");
                  }}
                >
                  {carriers.map((carrier) => (
                    <option key={carrier.value} value={carrier.value}>
                      {carrier.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Service *</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                >
                  {(services[selectedCarrier] || services.other).map((service) => (
                    <option key={service.value} value={service.value}>
                      {service.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Generated Label Preview */}
          {labelUrl && (
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Truck className="h-4 w-4" /> Label Generated
              </h3>
              {generatedTracking && (
                <div className="mb-3 text-sm">
                  <span className="text-muted-foreground">Tracking Number:</span>{" "}
                  <span className="font-medium text-foreground">{generatedTracking}</span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Printer className="h-4 w-4" /> Print
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Download className="h-4 w-4" /> Download
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              {labelUrl ? "Close" : "Cancel"}
            </button>
            {!labelUrl && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Truck className="h-4 w-4" /> Generate Label
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

