import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";

// Entirely invented preview identities, codes and tokens. No email is sent.
const fixtures = [
  {
    id: "sign-in",
    subject: "Sign in to 26",
    text: "Your sign-in code: 123456\n\nEnter this code on the admin sign-in page, or open your secure link below.\n\nConfirm sign-in for 26: https://26.example/admin/confirm?token=preview-only\n\nOpening this page does not sign you in. Use the confirm button.\n\nYour code and link expire after five minutes. Use the latest email.\n\nIf you did not request this, you can ignore this email.",
  },
  {
    id: "verification",
    subject: "Confirm your email for the party results",
    text: "Confirm this address to receive your own result from the party.\n\nThis link lasts 1 hour and only confirms this address.\n\nhttps://26.example/r/preview?verify=preview-only\n\nIf you did not ask for this, you can ignore the message.",
  },
  {
    id: "results",
    subject: "Your party result",
    text: "Amina, you finished in position 2 with 640 points.\n\nTrolls given: 3. Trolls received: 4.\n\nYour personal link lasts 30 days. It opens your result only.\n\nhttps://26.example/r/preview?recap=preview-only",
  },
];

const root = ".codex/previews/emails";
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { renderPartyEmail } = await server.ssrLoadModule(
    "/packages/emails/src/index.tsx",
  );
  await mkdir(root, { recursive: true });
  for (const fixture of fixtures)
    await writeFile(
      `${root}/${fixture.id}.html`,
      await renderPartyEmail(fixture),
      "utf8",
    );
  console.log(
    `Rendered ${fixtures.length} stand-in email previews in ${root}. No email sent.`,
  );
} finally {
  await server.close();
}
