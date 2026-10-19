import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLoginPage } from "./admin-login-page";
import { AdminConfirmPage } from "./admin-confirm-page";
import { AdminPage } from "./admin-page";
import { rememberAdminReturn, safeAdminReturnTo } from "./admin-return";

vi.mock("./admin-lobby", () => ({ AdminLobby: () => <p>Room controls</p> }));
vi.mock("./admin-api", () => ({
  fetchAdminSession: vi.fn(),
  requestMagicLink: vi.fn(),
  fetchLocalInbox: vi.fn(),
  confirmMagicLink: vi.fn(),
  signOutAdmin: vi.fn(),
  confirmPath: vi.fn(),
}));
import {
  fetchAdminSession,
  requestMagicLink,
  confirmMagicLink,
  signOutAdmin,
} from "./admin-api";

function mount(path = "/admin/login") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/confirm" element={<AdminConfirmPage />} />
        <Route path="/admin" element={<AdminPage />}>
          <Route index element={<p>Room controls</p>} />
        </Route>
        <Route path="/admin/rooms" element={<p>Rooms destination</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  vi.mocked(fetchAdminSession).mockResolvedValue({ signedIn: false });
});

describe("admin entry", () => {
  it("keeps the email field usable while checking an existing session", () => {
    vi.mocked(fetchAdminSession).mockReturnValue(new Promise(() => {}));
    mount();
    expect(
      (screen.getByLabelText("Administrator email") as HTMLInputElement).disabled,
    ).toBe(false);
    expect(
      (
        screen.getByRole("button", {
          name: "Email me a sign-in link",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
  it("shows an empty form and clears the session-check copy", async () => {
    mount();
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Administrator email") as HTMLInputElement).disabled,
      ).toBe(false),
    );
    expect(
      (screen.getByLabelText("Administrator email") as HTMLInputElement).value,
    ).toBe("");
    await waitFor(() =>
      expect(screen.queryByText("Checking the administrator session.")).toBeNull(),
    );
    expect(screen.queryByText("Development shell")).toBeNull();
  });

  it("returns a valid session to the requested admin destination", async () => {
    vi.mocked(fetchAdminSession).mockResolvedValue({
      signedIn: true,
      email: "admin@example.test",
    });
    mount("/admin/login?returnTo=%2Fadmin%2Frooms");
    expect(await screen.findByText("Rooms destination")).toBeTruthy();
  });

  it("offers retry after a failed check and does not leave the form disabled", async () => {
    vi.mocked(fetchAdminSession).mockResolvedValueOnce({
      error: "Authentication is unavailable.",
    });
    mount();
    expect(await screen.findByText("Authentication is unavailable.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(fetchAdminSession).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Administrator email") as HTMLInputElement).disabled,
      ).toBe(false),
    );
  });

  it("keeps the email after a rejected request and reports acceptance honestly", async () => {
    vi.mocked(requestMagicLink)
      .mockResolvedValueOnce({ error: "Please try again later." })
      .mockResolvedValueOnce({ accepted: true, delivery: "email" });
    mount();
    const input = await screen.findByLabelText("Administrator email");
    await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false));
    fireEvent.change(input, { target: { value: "admin@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    expect(await screen.findByText("Please try again later.")).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("admin@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    expect(
      await screen.findByText(/If this is the administrator address/),
    ).toBeTruthy();
  });

  it("protects admin and redirects to login", async () => {
    mount("/admin");
    expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeTruthy();
    expect(screen.queryByText("Room controls")).toBeNull();
  });

  it("does not claim sign out succeeded when the server rejects it", async () => {
    vi.mocked(fetchAdminSession).mockResolvedValue({
      signedIn: true,
      email: "admin@example.test",
    });
    vi.mocked(signOutAdmin).mockResolvedValue({ error: "Sign out failed. Try again." });
    mount("/admin");
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Sign out failed. Try again.")).toBeTruthy();
    expect(screen.getByText("Room controls")).toBeTruthy();
  });

  it("only consumes an email token after explicit confirmation and offers a fresh link", async () => {
    vi.mocked(confirmMagicLink).mockResolvedValue({
      error: "This sign-in link is invalid or has expired.",
    });
    mount("/admin/confirm?token=test-token");
    expect(confirmMagicLink).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByText("This sign-in link is invalid or has expired."),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Request a new link" }).getAttribute("href"),
    ).toContain("/admin/login");
  });

  it("restores the requested destination when the email opens in another tab", async () => {
    rememberAdminReturn("/admin/rooms");
    vi.mocked(confirmMagicLink).mockResolvedValue({
      signedIn: true,
      email: "admin@example.test",
    });
    mount("/admin/confirm?token=test-token");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Rooms destination")).toBeTruthy();
    expect(localStorage.getItem("26-admin-return")).toBeNull();
  });

  it.each([
    "https://evil.test/admin",
    "//evil.test/admin",
    "/admin/../join",
    "/admin/login",
    "/admin/confirm?token=secret",
    "/administrator",
    "/admin/%2e%2e/join",
    "/admin/rooms?token=secret",
    "/admin\\evil",
    "/admin/content/birthday-draft/question?token=secret",
    "/admin/content/birthday-draft/../settings",
    "/admin/content/birthday-draft/question/extra",
    "/admin/phone-preview/birthday-draft/question?token=secret",
    "/admin/phone-preview/birthday-draft/../settings",
  ])("rejects unsafe return path %s", (path) => {
    expect(safeAdminReturnTo(path)).toBe("/admin");
  });
  it("allows a room deep link", () => {
    expect(safeAdminReturnTo("/admin/rooms/ABCDEFGH/live")).toBe(
      "/admin/rooms/ABCDEFGH/live",
    );
  });
  it("allows a question deep link after signing in", () => {
    const path = "/admin/content/birthday-draft/favourite-pokemon";
    expect(safeAdminReturnTo(path)).toBe(path);
    rememberAdminReturn(path);
    expect(localStorage.getItem("26-admin-return")).toBe(path);
  });
  it("allows a full-screen rehearsal after signing in on another device", () => {
    const path = "/admin/phone-preview/birthday-draft/favourite-pokemon";
    expect(safeAdminReturnTo(path)).toBe(path);
  });
});
