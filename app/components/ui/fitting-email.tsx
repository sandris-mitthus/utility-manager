"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { fitEmailToWidth } from "@/app/lib/fit-email";

type FittingEmailProps = {
  email: string;
  className?: string;
};

function measureWithFont(font: string) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return (text: string) => text.length * 8;
  }

  context.font = font;
  return (text: string) => context.measureText(text).width;
}

export function FittingEmail({ email, className }: FittingEmailProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [fitted, setFitted] = useState(email);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const fit = () => {
      const style = getComputedStyle(element);
      const font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const available = element.clientWidth;
      setFitted(fitEmailToWidth(email, available, measureWithFont(font)));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [email]);

  return (
    <p ref={ref} className={`w-full whitespace-nowrap ${className ?? ""}`} title={email}>
      {fitted}
    </p>
  );
}
