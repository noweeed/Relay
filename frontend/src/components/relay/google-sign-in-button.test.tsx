import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelayApiError } from "@/lib/api-client";
import { GoogleSignInButton } from "./google-sign-in-button";

const authenticateWithGoogle = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ authenticateWithGoogle }),
}));

describe("GoogleSignInButton", () => {
  const initialize = vi.fn();
  const prompt = vi.fn();

  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "relay-test.apps.googleusercontent.com");
    const script = document.createElement("script");
    script.dataset["relayGoogle"] = "true";
    document.head.appendChild(script);
    window.google = { accounts: { id: { initialize, prompt } } };
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    document.querySelectorAll("script[data-relay-google]").forEach((script) => script.remove());
    delete window.google;
  });

  it("exchanges the Google credential and reports success", async () => {
    authenticateWithGoogle.mockResolvedValueOnce(undefined);
    const onSuccess = vi.fn();
    render(<GoogleSignInButton onSuccess={onSuccess} />);

    await waitFor(() => expect(initialize).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(prompt).toHaveBeenCalledOnce();
    const callback = initialize.mock.calls[0]?.[0].callback as (value: {
      credential: string;
    }) => void;
    callback({ credential: "google-id-token" });

    await waitFor(() => expect(authenticateWithGoogle).toHaveBeenCalledWith("google-id-token"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it("shows the safe API error when the exchange fails", async () => {
    authenticateWithGoogle.mockRejectedValueOnce(
      new RelayApiError(401, "UNAUTHORIZED", "Google could not verify this account."),
    );
    render(<GoogleSignInButton onSuccess={vi.fn()} />);

    await waitFor(() => expect(initialize).toHaveBeenCalledOnce());
    const callback = initialize.mock.calls[0]?.[0].callback as (value: {
      credential: string;
    }) => void;
    callback({ credential: "bad-google-id-token" });

    expect(await screen.findByText("Google could not verify this account.")).toBeTruthy();
  });
});
