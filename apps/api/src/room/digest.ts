import { hashCredentialSecret } from "../credentials/verify.ts";
import { canonicalJson } from "./codes.ts";

export async function payloadDigest(value: unknown): Promise<string> {
  return hashCredentialSecret(canonicalJson(value));
}
