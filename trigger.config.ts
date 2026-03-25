import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "btc-today",
  runtime: "node",
  logLevel: "log",
  maxDuration: 300, // 5 min per task
  dirs: ["./src/trigger"],
});
