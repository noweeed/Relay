import { useEffect, useRef, useState } from "react";
import { apiErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";

type GoogleAccounts = {
  id: {
    initialize: (options: {
      client_id: string;
      callback: (value: { credential: string }) => void;
    }) => void;
    renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
  };
};

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

/** Renders Google's official Identity Services button and exchanges its ID token with Relay. */
export function GoogleSignInButton({ onSuccess }: { onSuccess: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { authenticateWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const clientId = import.meta.env["VITE_GOOGLE_CLIENT_ID"] as string | undefined;

  useEffect(() => {
    if (!clientId || !containerRef.current) return;
    const configuredClientId = clientId;

    /** Initializes the provider only after its browser script is ready. */
    function renderGoogleButton() {
      if (!window.google || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: configuredClientId,
        callback: ({ credential }) => {
          void authenticateWithGoogle(credential)
            .then(onSuccess)
            .catch((requestError) => setError(apiErrorMessage(requestError)));
        },
      });
      containerRef.current.replaceChildren();
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: containerRef.current.clientWidth,
        text: "continue_with",
      });
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-relay-google]");
    if (existing) {
      if (window.google) renderGoogleButton();
      else existing.addEventListener("load", renderGoogleButton, { once: true });
      return () => existing.removeEventListener("load", renderGoogleButton);
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset["relayGoogle"] = "true";
    script.addEventListener("load", renderGoogleButton, { once: true });
    document.head.appendChild(script);
    return () => script.removeEventListener("load", renderGoogleButton);
  }, [authenticateWithGoogle, clientId, onSuccess]);

  if (!clientId) return null;
  return (
    <div className="space-y-2">
      <div ref={containerRef} className="min-h-10 w-full" />
      {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
    </div>
  );
}
