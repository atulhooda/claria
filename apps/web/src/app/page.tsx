import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import {
  ArrowRightIcon,
  ClipboardListIcon,
  FileTextIcon,
  LockIcon,
  MicIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WavesIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brand } from "@/components/layout/brand";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { ProductPreview } from "@/components/marketing/product-preview";
import { Reveal } from "@/components/marketing/reveal";
import { site } from "@/config/site";

const trustedClinics = [
  "Northbridge Family Health",
  "Cedar Point Clinic",
  "Riverside Internal Med",
  "Mountainview Primary Care",
  "Oakhill Pediatrics",
];

const pillars = [
  {
    icon: MicIcon,
    title: "Record once",
    body: "Capture the consultation in the browser — no apps, no plugins, no extra hardware.",
  },
  {
    icon: FileTextIcon,
    title: "Notes drafted for you",
    body: "SOAP notes, summaries, and structured data generated in seconds with medical-grade accuracy.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Built for clinicians",
    body: "Designed around clinical workflows, with privacy and HIPAA-grade controls as defaults.",
  },
];

const steps = [
  {
    n: "01",
    icon: MicIcon,
    title: "Start the consult",
    body: "Hit record in the browser. Claria captures patient consent and the conversation.",
  },
  {
    n: "02",
    icon: WavesIcon,
    title: "Listen and transcribe",
    body: "A medical-tuned speech model transcribes in real time, attributing each speaker.",
  },
  {
    n: "03",
    icon: SparklesIcon,
    title: "Draft the clinical note",
    body: "An AI clinician drafts SOAP, summary, and structured outputs you can review and sign.",
  },
];

const signals = [
  {
    icon: ShieldCheckIcon,
    label: "HIPAA-aligned by default",
    body: "Audio is encrypted in transit and at rest; transcripts are scoped per practice.",
  },
  {
    icon: LockIcon,
    label: "No model training on PHI",
    body: "Your patient data is never used to train foundation models. Ever.",
  },
  {
    icon: ClipboardListIcon,
    label: "Audit-ready logs",
    body: "Every edit, every export, every access — recorded and queryable.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Subtle grain across the page so beige doesn't read flat. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-noise opacity-40"
      />

      <MarketingNav />

      <main className="relative z-10 flex-1">
        {/* ───────── HERO ───────── */}
        <section className="relative isolate overflow-hidden px-6 pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <Reveal>
              <Badge variant="outline" className="mb-7 px-3 py-1 text-xs">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 animate-pulse-soft rounded-full bg-primary" />
                  <span className="relative rounded-full bg-primary" />
                </span>
                Private beta for medical practices
              </Badge>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="text-balance text-4xl font-semibold tracking-[-0.022em] text-foreground md:text-display-md lg:text-display-lg">
                {site.tagline}
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mt-6 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg">
                {site.name} records the consultation, transcribes it with
                medical-grade accuracy, and drafts the clinical note while you
                focus on the patient.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
                <SignedOut>
                  <Link href="/sign-up">
                    <Button size="lg" className="gap-2">
                      Start free
                      <ArrowRightIcon className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="#product">
                    <Button size="lg" variant="outline">
                      See it in action
                    </Button>
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link href="/dashboard">
                    <Button size="lg" className="gap-2">
                      Go to dashboard
                      <ArrowRightIcon className="h-4 w-4" />
                    </Button>
                  </Link>
                </SignedIn>
              </div>
            </Reveal>

            <Reveal delay={320} className="mt-6">
              <p className="text-xs text-muted-foreground">
                Free during private beta. No credit card required.
              </p>
            </Reveal>
          </div>

          {/* Floating product preview */}
          <Reveal
            delay={380}
            distance={28}
            className="mx-auto mt-16 w-full max-w-6xl px-2 md:mt-20 md:px-6"
            id="product"
          >
            <ProductPreview />
          </Reveal>
        </section>

        {/* ───────── TRUST STRIP ───────── */}
        <section className="border-y border-border/60 bg-surface-1/60 py-10">
          <div className="mx-auto max-w-6xl px-6 md:px-10">
            <Reveal>
              <p className="text-center text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Trusted by clinicians at
              </p>
              <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm font-medium text-foreground/55">
                {trustedClinics.map((name) => (
                  <li
                    key={name}
                    className="whitespace-nowrap tracking-tight transition-colors hover:text-foreground/80"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* ───────── PILLARS ───────── */}
        <section className="px-6 py-24 md:py-32">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <Badge variant="default" className="mb-4">
                Why Claria
              </Badge>
              <h2 className="text-3xl font-semibold tracking-[-0.02em] text-foreground md:text-4xl">
                Notes that draft themselves, while you stay with the patient.
              </h2>
              <p className="mt-4 text-muted-foreground md:text-lg">
                One quiet, focused tool — built around how doctors actually
                work.
              </p>
            </Reveal>

            <ul className="mt-14 grid gap-4 md:grid-cols-3">
              {pillars.map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} delay={i * 90}>
                  <li className="group h-full rounded-xl border border-border bg-surface-1 p-7 transition-colors hover:border-border-strong">
                    <span className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-inset ring-primary/10">
                      <Icon className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* ───────── HOW IT WORKS ───────── */}
        <section id="how" className="border-t border-border/60 px-6 py-24 md:py-32">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <Badge variant="default" className="mb-4">
                How it works
              </Badge>
              <h2 className="text-3xl font-semibold tracking-[-0.02em] text-foreground md:text-4xl">
                From spoken consult to signed note in three steps.
              </h2>
            </Reveal>

            <ol className="mt-16 grid gap-x-10 gap-y-12 md:grid-cols-3">
              {steps.map(({ n, icon: Icon, title, body }, i) => (
                <Reveal key={n} delay={i * 100}>
                  <li className="relative">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="font-mono text-xs font-medium text-muted-foreground">
                        {n}
                      </span>
                      <span className="h-px flex-1 bg-border" />
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-surface-2 text-foreground/70">
                        <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </span>
                    </div>
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ───────── SECURITY ───────── */}
        <section id="security" className="border-t border-border/60 bg-surface-1/50 px-6 py-24 md:py-32">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-12 md:grid-cols-[1.1fr_1.4fr] md:gap-16">
              <Reveal>
                <Badge variant="default" className="mb-4">
                  Security
                </Badge>
                <h2 className="text-3xl font-semibold tracking-[-0.02em] text-foreground md:text-4xl">
                  Built so you never have to defend the tool you use.
                </h2>
                <p className="mt-4 max-w-md text-muted-foreground md:text-lg">
                  Privacy, encryption, and auditability are foundations — not
                  enterprise add-ons.
                </p>
              </Reveal>

              <Reveal delay={120}>
                <ul className="flex flex-col divide-y divide-border">
                  {signals.map(({ icon: Icon, label, body }) => (
                    <li key={label} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-foreground/70">
                        <Icon className="h-4 w-4" strokeWidth={2.2} />
                      </span>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-sm font-semibold text-foreground">
                          {label}
                        </span>
                        <span className="text-sm leading-relaxed text-muted-foreground">
                          {body}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ───────── FINAL CTA ───────── */}
        <section className="px-6 py-24 md:py-32">
          <Reveal className="mx-auto max-w-3xl">
            <div className="relative overflow-hidden rounded-2xl border border-border-strong bg-surface-1 p-10 text-center shadow-elevated md:p-14">
              <h2 className="mx-auto max-w-xl text-balance text-3xl font-semibold tracking-[-0.02em] text-foreground md:text-4xl">
                Give your evenings back.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-muted-foreground md:text-lg">
                Spend the time you save on notes with your patients, your
                family, or yourself.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
                <SignedOut>
                  <Link href="/sign-up">
                    <Button size="lg" className="gap-2">
                      Start free
                      <ArrowRightIcon className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="mailto:hello@claria.app">
                    <Button size="lg" variant="ghost">
                      Talk to us
                    </Button>
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link href="/dashboard">
                    <Button size="lg" className="gap-2">
                      Go to dashboard
                      <ArrowRightIcon className="h-4 w-4" />
                    </Button>
                  </Link>
                </SignedIn>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ───────── FOOTER ───────── */}
      <footer className="relative z-10 border-t border-border bg-surface-1/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 md:flex-row md:items-start md:justify-between md:px-10">
          <div className="flex flex-col gap-3">
            <Brand />
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              {site.description}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3 md:gap-x-16">
            <div className="flex flex-col gap-1.5">
              <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                Product
              </span>
              <a href="#product" className="text-muted-foreground hover:text-foreground">
                Overview
              </a>
              <a href="#how" className="text-muted-foreground hover:text-foreground">
                How it works
              </a>
              <a href="#security" className="text-muted-foreground hover:text-foreground">
                Security
              </a>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                Company
              </span>
              <a href="mailto:hello@claria.app" className="text-muted-foreground hover:text-foreground">
                Contact
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground">
                Careers
              </a>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                Legal
              </span>
              <a href="#" className="text-muted-foreground hover:text-foreground">
                Privacy
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground">
                Terms
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 text-xs text-muted-foreground md:px-10">
            <span>
              © {new Date().getFullYear()} {site.name}
            </span>
            <span>Built for clinicians.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
