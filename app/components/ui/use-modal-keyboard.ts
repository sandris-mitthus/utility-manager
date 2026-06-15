"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

type UseModalKeyboardOptions = {
  onClose: () => void;
  formRef: RefObject<HTMLFormElement | null>;
  blockKeyboard?: boolean;
  hasUnsavedChanges?: boolean;
};

export function useModalKeyboard({
  onClose,
  formRef,
  blockKeyboard = false,
  hasUnsavedChanges = false,
}: UseModalKeyboardOptions) {
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const confirmClose = useCallback(() => {
    setConfirmCloseOpen(false);
    onClose();
  }, [onClose]);

  const requestBackdropClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setConfirmCloseOpen(true);
      return;
    }

    onClose();
  }, [hasUnsavedChanges, onClose]);

  const dismissConfirmClose = useCallback(() => {
    setConfirmCloseOpen(false);
  }, []);

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (blockKeyboard || confirmCloseOpen) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (hasUnsavedChanges) {
          setConfirmCloseOpen(true);
        } else {
          onClose();
        }
        return;
      }

      if (event.key === "Enter") {
        if (event.defaultPrevented) {
          return;
        }

        const target = event.target as HTMLElement;
        if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") {
          return;
        }

        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [blockKeyboard, confirmCloseOpen, formRef, hasUnsavedChanges, onClose]);

  return {
    confirmCloseOpen,
    requestBackdropClose,
    dismissConfirmClose,
    confirmClose,
  };
}
