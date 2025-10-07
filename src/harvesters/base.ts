import { withRetry } from "../lib/utils";
import {
  CkanGroup,
  CkanOrganization,
  PortalJsCloudDataset,
} from "@/schemas/portaljs-cloud";
import Bottleneck from "bottleneck";
import { getDatasetList, upsertDataset } from "../lib/portaljs-cloud";
import {
  ensureMainGroupExists,
  ensureOrganizationExists,
  ensureGroupExists,
} from "../lib/lcc";
import { env } from "../../config";

export type BaseHarvesterConfig = {
  source: {
    url: string;
    apiKey: string;
    rps: number;
    concurrency: number;
  };
  dryRun?: boolean;
};

export interface EntityMetadata {
  organizations: Array<{
    name: string;
    title?: string;
    description?: string;
    groups?: Array<{ name: string }>;
  }>;
  groups: Array<{
    name: string;
    title?: string;
    description?: string;
    groups?: Array<{ name: string }>;
  }>;
}

export abstract class BaseHarvester<
  SourceDatasetT extends { [k: string]: any } = any
> {
  protected config: BaseHarvesterConfig;
  private createdOrganizations = new Set<string>();
  private createdGroups = new Set<string>();

  constructor(config: BaseHarvesterConfig) {
    this.config = config;
  }

  abstract getSourceDatasets(): Promise<SourceDatasetT[]>;
  abstract mapSourceDatasetToTarget(
    dataset: SourceDatasetT
  ): PortalJsCloudDataset;

  // Optional method that can be overridden by subclasses
  extractEntityMetadata?(dataset: SourceDatasetT): EntityMetadata;

  async getTargetPreexistingDatasets(): Promise<string[]> {
    return await getDatasetList();
  }

  async upsertIntoTarget({ dataset }: { dataset: PortalJsCloudDataset }) {
    return await upsertDataset({
      dataset,
      dryRun: this.config.dryRun,
    });
  }

  protected async ensureOrganizationExists(
    org: CkanOrganization
  ): Promise<void> {
    if (this.config.dryRun) {
      console.log(
        `[dry run]: would ensure organization exists: ${JSON.stringify(
          org,
          null,
          2
        )}`
      );
      return;
    }

    if (this.createdOrganizations.has(org.name)) {
      return;
    }

    await withRetry(
      () => ensureOrganizationExists(org),
      `ensure organization ${org.name}`
    );
    this.createdOrganizations.add(org.name);
  }

  protected async ensureGroupExists(group: CkanGroup): Promise<void> {
    if (this.config.dryRun) {
      console.log(
        `[dry run]: would ensure group exists: ${JSON.stringify(
          group,
          null,
          2
        )}`
      );
      return;
    }

    if (this.createdGroups.has(group.name)) {
      return;
    }

    await withRetry(
      () => ensureGroupExists(group),
      `ensure group ${group.name}`
    );
    this.createdGroups.add(group.name);
  }

  async run() {
    const startTime = Date.now();

    // Ensure main group exists before harvesting
    if (!this.config.dryRun) {
      console.log("Ensuring main group exists...");
      await withRetry(
        () => ensureMainGroupExists(),
        `ensure main group ${env.PORTALJS_CLOUD_MAIN_GROUP}`
      );
    }

    const jobs: Promise<void>[] = [];
    const limiter = new Bottleneck({
      minTime: Math.ceil(1000 / Math.max(1, this.config.source.rps)),
      maxConcurrent: Math.max(1, this.config.source.concurrency),
    });
    let total = 0;
    let upserts = 0;
    let failures = 0;

    const sourceDatasets = await this.getSourceDatasets();
    for (const sourcePkg of sourceDatasets) {
      total++;

      const job = async () => {
        try {
          if (this.extractEntityMetadata) {
            const { organizations, groups } =
              this.extractEntityMetadata(sourcePkg);

            for (const org of organizations) {
              await this.ensureOrganizationExists(org);
            }

            for (const group of groups) {
              await this.ensureGroupExists(group);
            }
          }

          // Map and upsert dataset
          const targetPackage = this.mapSourceDatasetToTarget(sourcePkg);
          await withRetry(
            () =>
              this.upsertIntoTarget({
                dataset: targetPackage,
              }),
            `upsert ${targetPackage.name}`
          );
          upserts++;
        } catch (err: any) {
          failures++;
          console.error(`✖ Failed ${sourcePkg}:`, err?.message || err);
        }
      };
      jobs.push(limiter.schedule(job));
    }
    await Promise.all(jobs);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `\n✅ Done. total=${total}, upserts=${upserts}, failures=${failures} (${duration}s)`
    );
  }
}
