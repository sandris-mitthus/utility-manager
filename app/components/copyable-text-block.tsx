"use client";

import { useState } from "react";
import { IconCopy } from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";

type CopyableTextBlockProps = {
  text: string;
  label?: string;
};

export function CopyableTextBlock({
  text,
  label = "Ieteicamais e-pasta teksts",
}: CopyableTextBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-3 py-2">
        <span className="text-xs font-medium text-zinc-600">{label}</span>
        <TooltipIconButton
          tooltip={copied ? "Teksts nokopēts" : "Kopēt tekstu starpliktuvē"}
          icon={<IconCopy />}
          variant="secondary"
          onClick={handleCopy}
        />
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap px-3 py-3 font-mono text-xs leading-relaxed text-zinc-800">
        {text}
      </pre>
    </div>
  );
}
