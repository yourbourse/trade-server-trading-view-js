// Plain (non-const) enum: const enums cannot be inlined under `isolatedModules`
// (Vite/esbuild transpile each file in isolation), which the build uses.
export enum WebSocketCloseCode {
    Normal = 1000,
    GoingAway = 1001,
    AbnormalClosure = 1006,
    PolicyViolation = 1008,
}
