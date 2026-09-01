import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_qrqaqctokrdtqyyeihww",
  runtime: "node-24",
  logLevel: "log",
  maxDuration: 900, // 15 min max for orchestrator pipeline
  dirs: ["./src/trigger"],
  build: {
    external: ["yahoo-finance2"],
  },
});
