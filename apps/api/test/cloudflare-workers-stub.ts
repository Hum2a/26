/** Node stand-in so auth tests can import the Worker without workerd. */
export class DurableObject<Env = unknown> {
  constructor(
    protected ctx: unknown,
    protected env: Env,
  ) {}
}
