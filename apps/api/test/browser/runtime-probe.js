// Explicit local transport fixture, not a game implementation or capacity test.
export class ProbeRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.inputs = 0;
    this.ticks = 0;
    this.attachments = ["attachments", "combined"].includes(env.PROBE_PROTOCOL);
    this.autoResponse = ["auto-response", "auto-response-sync", "combined"].includes(
      env.PROBE_PROTOCOL,
    );
    this.attachmentReads = 0;
    this.attachmentWrites = 0;
    if (env.PROBE_PROTOCOL === "auto-response-sync")
      ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    else if (this.autoResponse || env.PROBE_PROTOCOL === "barrier")
      ctx.blockConcurrencyWhile(async () => {
        if (this.autoResponse)
          ctx.setWebSocketAutoResponse(
            new WebSocketRequestResponsePair("ping", "pong"),
          );
      });
    this.sqlMode = env.PROBE_SQL === "1";
    if (this.sqlMode)
      ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS probe_frame (id INTEGER PRIMARY KEY, body TEXT NOT NULL)",
      );
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    // Match real room routes: consume the body before acknowledging a POST.
    if (request.method === "POST") await request.arrayBuffer();
    if (path === "/start") {
      await this.ctx.storage.put("running", true);
      await this.ctx.storage.setAlarm(Date.now() + 200);
      return Response.json({ started: true });
    }
    if (path === "/stop") {
      await this.ctx.storage.put("running", false);
      await this.ctx.storage.deleteAlarm();
      return Response.json({
        stopped: true,
        inputs: this.inputs,
        ticks: this.ticks,
        attachmentReads: this.attachmentReads,
        attachmentWrites: this.attachmentWrites,
        ...(this.sqlMode
          ? {
              sqlRows: this.ctx.storage.sql
                .exec("SELECT COUNT(*) AS n FROM probe_frame")
                .one().n,
            }
          : {}),
      });
    }
    if (request.headers.get("upgrade") !== "websocket")
      return new Response("Not found", { status: 404 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], ["guest"]);
    if (this.attachments) {
      pair[1].serializeAttachment({
        role: "guest",
        principalId: crypto.randomUUID(),
        deliverySeq: 0,
        patches: true,
      });
      this.attachmentWrites++;
    }
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  webSocketMessage(socket, message) {
    if (this.attachments) {
      if (!socket.deserializeAttachment()?.principalId)
        throw new Error("Missing probe attachment");
      this.attachmentReads++;
    }
    if (typeof message === "string" && message.length <= 1024) this.inputs++;
  }
  async alarm() {
    if (!(await this.ctx.storage.get("running"))) return;
    const frame = JSON.stringify({
      tick: ++this.ticks,
      inputs: this.inputs,
      padding: ".".repeat(1024),
    });
    if (this.sqlMode)
      this.ctx.storage.transactionSync(() => {
        for (let id = 0; id < 50; id++)
          this.ctx.storage.sql.exec(
            "INSERT INTO probe_frame VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body",
            id,
            frame,
          );
      });
    for (const socket of this.ctx.getWebSockets()) {
      if (this.attachments) {
        const attachment = socket.deserializeAttachment();
        this.attachmentReads++;
        socket.serializeAttachment({
          ...attachment,
          deliverySeq: attachment.deliverySeq + 1,
        });
        this.attachmentWrites++;
      }
      socket.send(frame);
    }
    await this.ctx.storage.setAlarm(Date.now() + 200);
  }
  webSocketClose(socket, code) {
    socket.close(code === 1006 ? 1000 : code);
  }
}
export default {
  fetch(request, env) {
    if (env.APP_ENV !== "local" || env.PROBE_LOCAL_ONLY !== "1")
      return new Response("Local transport fixture only", { status: 503 });
    if (new URL(request.url).pathname === "/health") return Response.json({ ok: true });
    return env.ROOM.getByName("transport-probe").fetch(request);
  },
};
