"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateConsultation,
  type CreateConsultationRequest,
} from "@/lib/api/consultations";

interface NewConsultationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_FORM = {
  patientName: "",
  patientAge: "",
  patientPronouns: "",
  patientMrn: "",
  patientChiefComplaint: "",
};

/**
 * Modal that collects optional patient meta before starting a consultation.
 *
 * All fields are optional — the doctor can hit "Start" with everything
 * blank and fill in details later. Submitting fires `POST /consultations`
 * and routes to the new live workspace.
 */
export function NewConsultationDialog({
  open,
  onOpenChange,
}: NewConsultationDialogProps) {
  const router = useRouter();
  const createMut = useCreateConsultation();
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [error, setError] = React.useState<string | null>(null);

  // Reset the form whenever the dialog re-opens — a fresh consultation
  // shouldn't inherit anything the user typed and abandoned last time.
  React.useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = buildPayload(form);
    if (payload === null) {
      setError("Age must be a number between 0 and 130.");
      return;
    }

    try {
      const created = await createMut.mutateAsync(payload);
      onOpenChange(false);
      router.push(`/consultations/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create consultation.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New consultation</DialogTitle>
          <DialogDescription>
            Add patient details now or skip and start recording — you can
            fill these in later from the review page.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <Field
            label="Patient name"
            htmlFor="patient-name"
            hint="What this consultation is filed under."
          >
            <Input
              id="patient-name"
              placeholder="e.g. Eleanor Whitford"
              value={form.patientName}
              onChange={(e) =>
                setForm((f) => ({ ...f, patientName: e.target.value }))
              }
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Age" htmlFor="patient-age">
              <Input
                id="patient-age"
                type="number"
                inputMode="numeric"
                min={0}
                max={130}
                placeholder="—"
                value={form.patientAge}
                onChange={(e) =>
                  setForm((f) => ({ ...f, patientAge: e.target.value }))
                }
              />
            </Field>
            <Field label="Pronouns" htmlFor="patient-pronouns">
              <Input
                id="patient-pronouns"
                placeholder="she/her"
                value={form.patientPronouns}
                onChange={(e) =>
                  setForm((f) => ({ ...f, patientPronouns: e.target.value }))
                }
              />
            </Field>
          </div>

          <Field label="MRN" htmlFor="patient-mrn" hint="Medical record number, if you use one.">
            <Input
              id="patient-mrn"
              placeholder="e.g. MRN-001234"
              value={form.patientMrn}
              onChange={(e) =>
                setForm((f) => ({ ...f, patientMrn: e.target.value }))
              }
            />
          </Field>

          <Field
            label="Chief complaint"
            htmlFor="patient-chief-complaint"
            hint="One line — the reason for visit. The AI refines this as you talk."
          >
            <Textarea
              id="patient-chief-complaint"
              rows={2}
              placeholder="e.g. Recurring chest tightness, worse on exertion."
              value={form.patientChiefComplaint}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  patientChiefComplaint: e.target.value,
                }))
              }
            />
          </Field>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={createMut.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="gap-1.5"
              disabled={createMut.isPending}
            >
              {createMut.isPending ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <PlusIcon className="h-4 w-4" />
              )}
              Start consultation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? (
        <span className="text-[11px] text-muted-foreground/80">{hint}</span>
      ) : null}
    </div>
  );
}

function buildPayload(
  form: typeof EMPTY_FORM,
): CreateConsultationRequest | null {
  const payload: CreateConsultationRequest = {};

  const name = form.patientName.trim();
  if (name) payload.patientName = name;

  const pronouns = form.patientPronouns.trim();
  if (pronouns) payload.patientPronouns = pronouns;

  const mrn = form.patientMrn.trim();
  if (mrn) payload.patientMrn = mrn;

  const chief = form.patientChiefComplaint.trim();
  if (chief) payload.patientChiefComplaint = chief;

  const ageRaw = form.patientAge.trim();
  if (ageRaw) {
    const age = Number(ageRaw);
    if (!Number.isFinite(age) || age < 0 || age > 130) return null;
    payload.patientAge = Math.floor(age);
  }

  return payload;
}
