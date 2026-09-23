import { emailVerifyTtlMs, recapLinkTtlMs } from "@26/shared";

export function verificationMessage(input: {
  origin: string;
  gameId: string;
  token: string;
}): { subject: string; text: string } {
  const link = new URL(`/r/${input.gameId}`, input.origin);
  link.searchParams.set("verify", input.token);
  const hours = Math.round(emailVerifyTtlMs / 3_600_000);
  return {
    subject: "Confirm your email for the party results",
    text: [
      "Confirm this address to receive your own result from the party.",
      `This link lasts ${hours} hour and only confirms this address.`,
      link.toString(),
      "If you did not ask for this, you can ignore the message.",
    ].join("\n\n"),
  };
}

export function resultsMessage(input: {
  origin: string;
  gameId: string;
  token: string;
  nickname: string;
  position: number;
  points: number;
  given: number;
  received: number;
}): { subject: string; text: string } {
  const link = new URL(`/r/${input.gameId}`, input.origin);
  link.searchParams.set("recap", input.token);
  const days = Math.round(recapLinkTtlMs / 86_400_000);
  return {
    subject: "Your party result",
    text: [
      `${input.nickname}, you finished in position ${input.position} with ${input.points} points.`,
      `Trolls given: ${input.given}. Trolls received: ${input.received}.`,
      `Your personal link lasts ${days} days. It opens your result only.`,
      link.toString(),
    ].join("\n\n"),
  };
}
