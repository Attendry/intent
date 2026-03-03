"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";

const INTENT_FIELDS = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "title", label: "Job Title" },
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
  { key: "linkedinUrl", label: "LinkedIn URL" },
  { key: "phone", label: "Phone" },
  { key: "mobilePhone", label: "Mobile Phone" },
  { key: "industry", label: "Industry" },
] as const;

type IntentFieldKey = (typeof INTENT_FIELDS)[number]["key"];

const HEADER_MAP: Record<string, IntentFieldKey> = {
  "first name": "firstName",
  first_name: "firstName",
  firstname: "firstName",
  "last name": "lastName",
  last_name: "lastName",
  lastname: "lastName",
  "job title": "title",
  title: "title",
  job_title: "title",
  "company name": "company",
  company: "company",
  company_name: "company",
  email: "email",
  "email address": "email",
  email_address: "email",
  "linkedin url": "linkedinUrl",
  "person linkedin url": "linkedinUrl",
  linkedin_url: "linkedinUrl",
  linkedinurl: "linkedinUrl",
  phone: "phone",
  "direct phone": "phone",
  phone_number: "phone",
  "office phone": "phone",
  mobile: "mobilePhone",
  "mobile phone": "mobilePhone",
  mobile_phone: "mobilePhone",
  mobilephone: "mobilePhone",
  "cell phone": "mobilePhone",
  cell_phone: "mobilePhone",
  cellphone: "mobilePhone",
  "mobile number": "mobilePhone",
  mobile_number: "mobilePhone",
  industry: "industry",
};

type Step = 1 | 2 | 3;

interface EnrichOptions {
  inferPersona: boolean;
  pullLinkedin: boolean;
  scanNews: boolean;
}

export default function ImportPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, IntentFieldKey | "">>(
    {}
  );
  const [enrichOptions, setEnrichOptions] = useState<EnrichOptions>({
    inferPersona: true,
    pullLinkedin: false,
    scanNews: false,
  });
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const hdrs = result.meta.fields || [];
        setHeaders(hdrs);
        setRows(result.data);

        const autoMap: Record<string, IntentFieldKey | ""> = {};
        for (const h of hdrs) {
          const normalized = h.toLowerCase().trim();
          autoMap[h] = HEADER_MAP[normalized] || "";
        }
        setMapping(autoMap);
        setStep(2);
      },
      error: () => {
        toast("Failed to parse CSV file", "error");
      },
    });
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".csv")) {
      processFile(file);
    } else {
      toast("Please drop a .csv file", "error");
    }
  };

  const getMappedRows = () => {
    const reverseMap: Partial<Record<IntentFieldKey, string>> = {};
    for (const [csvCol, intentField] of Object.entries(mapping)) {
      if (intentField) reverseMap[intentField] = csvCol;
    }

    return rows.map((row) => {
      const mapped: Partial<Record<IntentFieldKey, string>> = {};
      for (const field of INTENT_FIELDS) {
        const csvCol = reverseMap[field.key];
        if (csvCol && row[csvCol]) {
          mapped[field.key] = row[csvCol].trim();
        }
      }
      return mapped;
    });
  };

  const getDuplicateCount = () => {
    const mapped = getMappedRows();
    const emails = mapped
      .map((r) => r.email)
      .filter((e): e is string => !!e);
    return emails.length - new Set(emails).size;
  };

  const canProceedStep2 = () => {
    const values = Object.values(mapping);
    return values.includes("firstName") && values.includes("lastName");
  };

  const handleImport = async () => {
    const mapped = getMappedRows();
    const valid = mapped.filter((r) => r.firstName && r.lastName);
    if (valid.length === 0) {
      toast("No valid rows to import", "error");
      return;
    }

    setImporting(true);
    setImportProgress(0);

    const importedIds: string[] = [];
    const seenEmails = new Set<string>();
    let skipped = 0;

    for (let i = 0; i < valid.length; i++) {
      const row = valid[i];
      if (row.email && seenEmails.has(row.email.toLowerCase())) {
        skipped++;
        setImportProgress(Math.round(((i + 1) / valid.length) * 100));
        continue;
      }
      if (row.email) seenEmails.add(row.email.toLowerCase());

      try {
        const res = await fetch("/api/prospects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row),
        });
        if (res.status === 409) {
          skipped++;
        } else if (res.ok) {
          const created = await res.json();
          importedIds.push(created.id);
        }
      } catch {
        // Skip failed rows silently
      }
      setImportProgress(Math.round(((i + 1) / valid.length) * 100));
    }

    const anyEnrichSelected =
      enrichOptions.inferPersona || enrichOptions.pullLinkedin || enrichOptions.scanNews;

    const importMsg = `Imported ${importedIds.length} prospect${importedIds.length !== 1 ? "s" : ""}${skipped > 0 ? ` (${skipped} skipped)` : ""}`;

    // Link prospects to companies + trigger auto-enrichment for new companies
    if (importedIds.length > 0) {
      fetch("/api/companies?migrate=true", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
        .then((r) => r.json())
        .then((data) => {
          if (data.newCompanyIds?.length > 0) {
            toast(`${data.newCompanyIds.length} new compan${data.newCompanyIds.length === 1 ? "y" : "ies"} created. Enriching in background…`, "info");
            for (const cid of data.newCompanyIds) {
              fetch(`/api/companies/${cid}/documents/find`, { method: "POST" }).catch(() => {});
            }
          }
        })
        .catch(() => {});
    }

    if (importedIds.length > 0 && anyEnrichSelected) {
      toast(`${importMsg}. Enrichment running in background…`, "info");
      setImporting(false);
      router.push("/prospects");

      fetch("/api/intelligence/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectIds: importedIds,
          options: enrichOptions,
        }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            toast(
              data.error || "Enrichment failed",
              "error"
            );
          } else {
            const ok = data.succeeded?.length || 0;
            const fail = data.failed?.length || 0;
            if (fail > 0) {
              toast(`Enrichment: ${ok} succeeded, ${fail} failed`, "error");
            } else if (ok > 0) {
              toast(`Enrichment complete — ${ok} prospect${ok !== 1 ? "s" : ""} enriched`, "success");
            }
          }
        })
        .catch(() => {
          toast("Enrichment failed — check your Gemini API key in Settings", "error");
        });
    } else {
      toast(importMsg, "success");
      setImporting(false);
      router.push("/prospects");
    }
  };

  const previewRows = getMappedRows().slice(0, 5);

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push("/prospects")}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Prospects
        </button>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Import Prospects</h1>
        <p className="mt-1 text-sm text-muted-foreground">Upload a CSV file to bulk-import prospects.</p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-center gap-3">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold transition-all duration-300",
                step === s
                  ? "gradient-primary text-white shadow-soft"
                  : step > s
                    ? "gradient-success text-white shadow-soft"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {step > s ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 3 && (
              <div
                className={cn(
                  "h-px w-16 transition-colors duration-300",
                  step > s ? "bg-emerald-400" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-24 transition-all duration-300",
            dragOver
              ? "border-primary bg-primary/5 shadow-elevated"
              : "border-border/80 hover:border-muted-foreground/50 hover:bg-muted/20"
          )}
        >
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="mb-1.5 text-sm font-semibold text-foreground">
            Drop your CSV file here
          </p>
          <p className="mb-5 text-xs text-muted-foreground">
            Supports ZoomInfo, Apollo, LinkedIn exports, and custom CSVs
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Browse files
          </Button>
        </div>
      )}

      {/* Step 2: Map columns */}
      {step === 2 && (
        <div>
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Map Columns
                </h2>
                <p className="text-sm text-muted-foreground">
                  {fileName} — {rows.length} rows detected
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep(1);
                  setFileName(null);
                  setHeaders([]);
                  setRows([]);
                  setMapping({});
                }}
                className="gap-1 text-xs"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {headers.map((header) => (
              <div
                key={header}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3.5 shadow-soft"
              >
                <span className="w-48 shrink-0 truncate text-sm font-semibold text-foreground">
                  {header}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Select
                  value={mapping[header] || ""}
                  onChange={(e) =>
                    setMapping((m) => ({
                      ...m,
                      [header]: e.target.value as IntentFieldKey | "",
                    }))
                  }
                  className="h-9 text-sm"
                >
                  <option value="">— Skip this column —</option>
                  {INTENT_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                      {"required" in f && f.required ? " *" : ""}
                    </option>
                  ))}
                </Select>
                {mapping[header] && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full gradient-success">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {!canProceedStep2() && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              First Name and Last Name are required mappings.
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!canProceedStep2()}
              className="gap-1.5"
            >
              Preview
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Import */}
      {step === 3 && (
        <div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            Preview & Import
          </h2>
          <p className="mb-5 text-sm text-muted-foreground">
            {rows.length} rows total · {getDuplicateCount()} potential
            duplicates (by email)
          </p>

          {/* Preview table */}
          <div className="mb-6 overflow-x-auto rounded-xl border border-border/60 shadow-soft">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  {INTENT_FIELDS.filter((f) =>
                    Object.values(mapping).includes(f.key)
                  ).map((f) => (
                    <th
                      key={f.key}
                      className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/40 last:border-0"
                  >
                    {INTENT_FIELDS.filter((f) =>
                      Object.values(mapping).includes(f.key)
                    ).map((f) => (
                      <td
                        key={f.key}
                        className="whitespace-nowrap px-4 py-2.5 text-foreground"
                      >
                        {row[f.key] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Enrichment options */}
          <div className="mb-6 rounded-xl border border-border/60 bg-card p-5 shadow-soft">
            <p className="mb-3 text-sm font-semibold text-foreground">
              Auto-enrichment after import
            </p>
            <div className="space-y-2.5">
              <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={enrichOptions.inferPersona}
                  onChange={(e) =>
                    setEnrichOptions((o) => ({
                      ...o,
                      inferPersona: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Infer persona via AI
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={enrichOptions.pullLinkedin}
                  onChange={(e) =>
                    setEnrichOptions((o) => ({
                      ...o,
                      pullLinkedin: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Pull LinkedIn data
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={enrichOptions.scanNews}
                  onChange={(e) =>
                    setEnrichOptions((o) => ({
                      ...o,
                      scanNews: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Scan for recent news
              </label>
            </div>
          </div>

          {/* Progress bar */}
          {importing && (
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Importing...</span>
                <span>{importProgress}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full gradient-primary transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              disabled={importing}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing}
              className="gap-2"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Import {rows.length} prospect{rows.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
