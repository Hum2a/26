# Media

Photos and short voice clips use one upload record. The phone receives a short-lived PUT URL for a server-generated temporary key under `tmp/`. Finalisation reads that object with an ETag precondition, checks the bytes, and writes a new key under `accepted/`. The guest never receives a write URL for the accepted key. Repeating finalisation returns the accepted record. Replacing the temporary object afterwards does not change it.

R2 and SQLite are not one transaction. A crash after the accepted object is written is recovered from the upload row: the same final key is committed, or deleted if the question closed. Abandoned `tmp/` objects are deleted by the lifecycle file `apps/api/r2-lifecycle.json` one day after upload. Staging and production buckets already have that rule. Re-apply with `npx wrangler r2 bucket lifecycle set <bucket> --file apps/api/r2-lifecycle.json -y` if the file changes.

## Documentation used

- Presigned PUT URLs stay valid until `X-Amz-Expires`. They are not single-use. [Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- A browser PUT still needs a bucket CORS policy. `apps/api/r2-cors.json` allows `http://localhost:5173`, `http://localhost:4173`, `https://26-staging.humza.website`, and `https://26.humza.website`, methods `PUT`, `GET`, and `HEAD`, header `Content-Type`, and exposes `ETag`. [CORS](https://developers.cloudflare.com/r2/buckets/cors/)
- Conditional reads use `onlyIf.etagMatches`. A failed precondition returns no body. Accepted writes use `If-None-Match: *`. [Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- Lifecycle expiry is by prefix and age, in days. [Object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- Deployed photo processing uses the Images binding: `info`, then `transform({ width: 1280, fit: "scale-down" })`, then `output({ format: "image/jpeg", quality: 80 })`. `output()` returns a result whose `response()` is synchronous. Input formats are JPEG, PNG, GIF, WebP, and HEIC. [Images binding](https://developers.cloudflare.com/images/optimization/binding/) and [limits](https://developers.cloudflare.com/images/get-started/limits/). The current binding transform and output types do not accept `metadata: "none"`. That option remains on the URL transform API. [Features](https://developers.cloudflare.com/images/optimization/features/)
- The Media Transformations binding does not simulate locally and expects a video input. It is not used to measure a voice note. [Media binding](https://developers.cloudflare.com/stream/transform-videos/bindings/)

## Local and deployed

Local development has no R2 S3 credentials, so the phone PUTs to this Worker and the Worker writes the local `MEDIA_BUCKET`. That route answers 404 when `APP_ENV` is not `local`. Staging and production sign a presigned URL only when `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `MEDIA_BUCKET_NAME` are set. `MEDIA_BUCKET_NAME` must match the bucket binding.

Local photo checks decode and re-encode JPEG with `jpeg-js`. HEIC is rejected with a message to choose a JPEG, PNG, or a new photo. Staging and production do not use that decoder. Each of those Wrangler environments declares:

```jsonc
"images": { "binding": "IMAGES" }
```

The binding is not attached to a Cloudflare account in this repository, and photo processing through Images has not been verified against a deployed bucket. The local Worker config does not declare `IMAGES`, so local tests keep the JPEG decoder. Voice clips are PCM WAV. Duration comes from the `data` chunk and the `fmt` byte rate, then the file is rewritten without extra chunks. A client-supplied duration is not accepted. The maximum is 3 seconds and 400,000 bytes. The accepted image cap is 1,048,576 bytes. A temporary photo may be up to 8,388,608 bytes before that check.

Accepted responses use `Cache-Control: private, no-store`. Hide removes the item from later stage and gallery reads. A copy already downloaded is not recalled.

Each player can open 8 media records that are not rejected, cancelled, or expired. The room cap is 80. The upload link lasts 5 minutes. A finalisation lease lasts 30 seconds.
