import type { ReactNode } from "react";

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-taploBorder bg-white p-5 shadow-soft">
      <div className="mb-4">
        <h2 className="font-fraunces text-xl font-normal text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-[#666]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#333]">
      <span>{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-taploBorder bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-[#BBB] focus:border-taploCoral focus:ring-2 focus:ring-taploCoral/20";

export const textAreaClass =
  "min-h-28 w-full rounded-xl border border-taploBorder bg-white px-3 py-2.5 text-sm leading-6 text-ink outline-none transition placeholder:text-[#BBB] focus:border-taploCoral focus:ring-2 focus:ring-taploCoral/20";

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-taploBorder bg-taploWarm/70 p-4 text-sm leading-6 text-[#666]">
      {children}
    </div>
  );
}
