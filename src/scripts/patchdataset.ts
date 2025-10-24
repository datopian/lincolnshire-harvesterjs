import { env } from "../../config";
import CkanRequest from "@portaljs/ckan-api-client-js";
import { getDatasetByName } from "../lib/portaljs-cloud";
import type { PortalJsCloudDataset } from "../schemas/portaljs-cloud";

type SourcePkg = { name: string; url?: string };

async function fetchSourcePackages(): Promise<SourcePkg[]> {
  const rows = 100;
  let start = 0;
  const out: SourcePkg[] = [];

  // paginate source CKAN packages
  while (true) {
    const { result } = (await CkanRequest.get(
      `package_search?rows=${rows}&start=${start}`,
      {
        ckanUrl: env.SOURCE_API_URL,
        apiKey: env.SOURCE_API_KEY,
      }
    )) as any;

    const items = result?.results || [];
    if (!items.length) break;

    out.push(...items.map((r: any) => ({ name: r.name, url: r.url })));
    start += items.length;
    if (start >= (result?.count || 0)) break;
  }
  return out;
}

async function main() {
  const DRY_RUN = String(env.DRY_RUN).toLowerCase() === "true";
  const OWNER_ORG = env.PORTALJS_CLOUD_MAIN_ORG;

  console.log("Fetching source packages…");
  const pkgs = await fetchSourcePackages();

  let updated = 0;
  let skipped = 0;
  let i = 0;
  for (const pkg of pkgs) {
    const datasetName = `${OWNER_ORG}--${pkg.name}`;
    const dest = (await getDatasetByName(datasetName)) as
      | (PortalJsCloudDataset & { id?: string })
      | null;

    if (!pkg.url || !pkg.url.trim()) {
      skipped++;
      console.log(`- ${datasetName}: empty source url, skip`);
      continue;
    }

    if (!dest) {
      skipped++;
      console.log(`- ${datasetName}: not found on destination, skip`);
      continue;
    }

    const payload = {
      id: dest.id || datasetName,
      source: pkg.url ? [pkg.url] : [],
    };

    if (DRY_RUN) {
      console.log(`[dry run] package_patch -> ${datasetName}`, payload);
      updated++;
      continue;
    }
    console.log(`[dry run] package_patch -> ${datasetName}`, payload);
    await CkanRequest.post("package_patch", {
      ckanUrl: env.PORTALJS_CLOUD_API_URL,
      apiKey: env.PORTALJS_CLOUD_API_KEY,
      json: payload,
    });

    updated++;
    console.log(
      `✓ Patched ${datasetName} -> source=${JSON.stringify(payload.source)}`
    );
  }

  console.log(`Done. Updated=${updated}, Skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
