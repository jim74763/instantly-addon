// default open-next.config.ts file created by @opennextjs/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

const cloudflareConfig = defineCloudflareConfig({
	incrementalCache: staticAssetsIncrementalCache,
});

cloudflareConfig.buildCommand = "pnpm build:next";

export default cloudflareConfig;
