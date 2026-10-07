"use client";

import type { ComponentProps } from "react";

export default function StartDateInput(props: Omit<ComponentProps<"input">, "type" | "onClick">) {
  return <input {...props} type="datetime-local" onClick={event => {
    const input = event.currentTarget;
    if (input.disabled || input.readOnly || typeof input.showPicker !== "function") return;
    try { input.showPicker(); } catch {
      // Keep native text editing available when the browser blocks the picker.
    }
  }} />;
}
