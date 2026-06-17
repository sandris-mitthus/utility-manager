"use client";

import { useState, type ReactNode } from "react";
import { CopyableTextBlock } from "@/app/components/copyable-text-block";
import { IconChevronDown } from "@/app/components/ui/icons";

export type FaqItem = {
  id: string;
  question: string;
  answer: ReactNode;
  copyTemplate?: string;
  copyLabel?: string;
};

type FaqAccordionProps = {
  items: FaqItem[];
  title?: string;
  subtitle?: string;
};

export function FaqAccordion({
  items,
  title = "Biežāk uzdotie jautājumi",
  subtitle,
}: FaqAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <section>
      <div>
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {items.map((item) => {
          const isOpen = openId === item.id;
          const panelId = `faq-panel-${item.id}`;
          const buttonId = `faq-button-${item.id}`;

          return (
            <div
              key={item.id}
              className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm"
            >
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenId(isOpen ? null : item.id)}
                className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3.5 text-left text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
              >
                <span className="min-w-0 flex-1">{item.question}</span>
                <IconChevronDown
                  className={`size-4 shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen ? (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-relaxed text-zinc-600"
                >
                  <p>{item.answer}</p>
                  {item.copyTemplate ? (
                    <CopyableTextBlock text={item.copyTemplate} label={item.copyLabel} />
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
