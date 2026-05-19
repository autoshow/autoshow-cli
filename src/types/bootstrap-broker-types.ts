export type BootstrapHandler = {
  ensure: (model?: string) => Promise<void>
}
