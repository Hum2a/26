import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
}
async function create(page: Page) {
  await page.getByRole("button", { name: "Create a lobby", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ready for the room." }),
  ).toBeVisible();
  const url = new URL(page.url()).pathname;
  const joinCode = (await page.locator(".admin-room-code").innerText()).trim();
  return { url, joinCode };
}

test("recovers a real room after refresh, lost tab storage and a new tab", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await signIn(page);
  const room = await create(page);
  await expect(page.getByRole("link", { name: "Guest join link ↗" })).toHaveAttribute(
    "href",
    `/j/${room.joinCode}`,
  );
  await page.getByRole("button", { name: "Show guest QR code" }).click();
  await expect(
    page.getByRole("dialog", { name: "Guest join link" }).getByRole("textbox"),
  ).toHaveValue(new RegExp(`/j/${room.joinCode}$`));
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(page.locator(".admin-room-code")).toHaveText(room.joinCode);
  const tab = await context.newPage();
  await tab.goto("/admin");
  await tab.getByRole("link", { name: "Return to room" }).click();
  await expect(tab).toHaveURL(new RegExp(`${room.url}$`));
  await expect(tab.locator(".admin-room-code")).toHaveText(room.joinCode);
  await tab.getByRole("link", { name: "Live controls", exact: true }).click();
  await expect(tab.getByText("Connected to the room.")).toBeVisible();
  await tab.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(tab.locator(".admin-room-code")).toHaveText(room.joinCode);
});

test("explicit switching stops stale controls and expired cookies can be renewed", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await signIn(page);
  const first = await create(page);
  await page.getByRole("link", { name: "Live controls", exact: true }).click();
  await expect(page.getByText("Connected to the room.")).toBeVisible();
  const tab = await context.newPage();
  await tab.goto("/admin/rooms");
  const second = await create(tab);
  await expect(
    page.getByRole("button", { name: "Open room in this browser" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Advance", exact: true })).toHaveCount(
    0,
  );
  await tab.goto(first.url);
  await tab.getByRole("button", { name: "Open room in this browser" }).click();
  await expect(tab.locator(".admin-room-code")).toHaveText(first.joinCode);
  await tab.goto(second.url);
  await tab.getByRole("button", { name: "Open room in this browser" }).click();
  await expect(tab.locator(".admin-room-code")).toHaveText(second.joinCode);
  await context.clearCookies({ name: "26_room_control" });
  await tab.reload();
  await tab.getByRole("button", { name: "Open room in this browser" }).click();
  await expect(tab.locator(".admin-room-code")).toHaveText(second.joinCode);
});

test("workspace fits phone and desktop layouts with reduced motion", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signIn(page);
  const room = await create(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, name] of [
      ["/admin/rooms", "rooms"],
      [room.url, "overview"],
    ]) {
      await page.goto(path!);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (name === "overview") {
        await expect(page.locator(".admin-room-code")).toHaveText(room.joinCode);
        await expect(
          page.getByText("Connected. Room details update live."),
        ).toBeVisible();
      } else await expect(page.getByText("Finding your rooms…")).toHaveCount(0);
      await expect(page.locator(".admin-content > div")).toHaveCSS("opacity", "1");
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1,
        ),
      ).toBe(true);
      if (width === 390 || width === 1920)
        await page.screenshot({
          path: `.codex/previews/admin-redesign/${name}-${width}.png`,
          fullPage: true,
        });
    }
  }
});
