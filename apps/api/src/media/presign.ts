import { AwsClient } from "aws4fetch";
import { isLocalApp, mediaConfigMessage, mediaUrlMs } from "../room/limits.ts";

export type BucketEnv = {
  APP_ENV: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  MEDIA_BUCKET_NAME: string;
};

export async function uploadTarget(input: {
  env: BucketEnv;
  requestUrl: string;
  gameId: string;
  uploadId: string;
  tempKey: string;
  contentType: string;
}): Promise<{ ok: true; uploadUrl: string } | { ok: false; message: string }> {
  const account = accountId(input.env.R2_ACCOUNT_ID);
  const accessKey = filled(input.env.R2_ACCESS_KEY_ID);
  const secret = filled(input.env.R2_SECRET_ACCESS_KEY);
  const bucket = filled(input.env.MEDIA_BUCKET_NAME);
  if (account && accessKey && secret && bucket) {
    const client = new AwsClient({
      accessKeyId: accessKey,
      secretAccessKey: secret,
      service: "s3",
      region: "auto",
    });
    const url = new URL(
      `https://${account}.r2.cloudflarestorage.com/${bucket}/${input.tempKey}`,
    );
    url.searchParams.set("X-Amz-Expires", String(Math.floor(mediaUrlMs / 1000)));
    const signed = await client.sign(
      new Request(url, {
        method: "PUT",
        headers: { "content-type": input.contentType },
      }),
      { aws: { signQuery: true } },
    );
    return { ok: true, uploadUrl: signed.url };
  }
  if (isLocalApp(input.env.APP_ENV)) {
    const url = new URL(
      `/api/rooms/${input.gameId}/media/temporary/${input.uploadId}`,
      input.requestUrl,
    );
    return { ok: true, uploadUrl: url.toString() };
  }
  return { ok: false, message: mediaConfigMessage };
}

export function realBucketReport(env: {
  APP_ENV?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
}): {
  networkChecked: false;
  mode: "credentials-missing" | "credentials-present";
  missing: string[];
} {
  const names = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const;
  const missing = names.filter((name) =>
    name === "R2_ACCOUNT_ID" ? !accountId(env[name]) : !filled(env[name]),
  );
  return {
    networkChecked: false,
    mode: missing.length === 0 ? "credentials-present" : "credentials-missing",
    missing: [...missing],
  };
}

function filled(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value;
}

/**
 * A Cloudflare account ID is 32 hex characters. Anything else (an API token
 * pasted into the wrong secret, say) would become the upload host name and be
 * handed to every phone, so it counts as unconfigured.
 */
function accountId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && /^[0-9a-f]{32}$/i.test(trimmed) ? trimmed : undefined;
}
