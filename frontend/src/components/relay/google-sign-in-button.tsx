import { useEffect, useState } from "react";
import { apiErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";

type GoogleAccounts = {
  id: {
    initialize: (options: {
      client_id: string;
      callback: (value: { credential: string }) => void;
    }) => void;
    prompt: () => void;
  };
};

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

/** Opens Google Identity Services from a Relay-styled button and exchanges its ID token. */
export function GoogleSignInButton({ onSuccess }: { onSuccess: () => void }) {
  const { authenticateWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const clientId = import.meta.env["VITE_GOOGLE_CLIENT_ID"] as string | undefined;

  useEffect(() => {
    if (!clientId) return;
    const configuredClientId = clientId;

    /** Initializes the provider only after its browser script is ready. */
    function initializeGoogle() {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: configuredClientId,
        callback: ({ credential }) => {
          void authenticateWithGoogle(credential)
            .then(onSuccess)
            .catch((requestError) => setError(apiErrorMessage(requestError)));
        },
      });
      setReady(true);
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-relay-google]");
    if (existing) {
      if (window.google) initializeGoogle();
      else existing.addEventListener("load", initializeGoogle, { once: true });
      return () => existing.removeEventListener("load", initializeGoogle);
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset["relayGoogle"] = "true";
    script.addEventListener("load", initializeGoogle, { once: true });
    document.head.appendChild(script);
    return () => script.removeEventListener("load", initializeGoogle);
  }, [authenticateWithGoogle, clientId, onSuccess]);

  if (!clientId) return null;
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={!ready}
        onClick={() => {
          setError(null);
          window.google?.accounts.id.prompt();
        }}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-border bg-transparent text-sm font-semibold text-foreground transition-colors hover:bg-accent/35 focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
      >
        <GoogleMark />
        Continue with Google
      </button>
      {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="size-[18px] shrink-0" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.259h2.909c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.468-.806 5.956-2.18l-2.909-2.259c-.806.54-1.836.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.963 10.706A5.42 5.42 0 0 1 3.681 9c0-.592.102-1.168.282-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.463.892 11.425 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}
