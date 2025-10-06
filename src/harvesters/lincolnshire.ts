import { env } from "../../config";
import { CkanHarvester } from "./ckan";
import { Harvester } from ".";
import { BaseHarvesterConfig } from "./base";
import { CkanPackage } from "@/schemas/ckanPackage";
import { PortalJsCloudDataset } from "@/schemas/portaljs-cloud";

@Harvester
class LincolnshireHarvester extends CkanHarvester {
  constructor(args: BaseHarvesterConfig) {
    super(args);
  }

  mapSourceDatasetToTarget(pkg: CkanPackage): PortalJsCloudDataset {
    const owner_org = env.PORTALJS_CLOUD_MAIN_ORG;

    const dataset: PortalJsCloudDataset = {
      owner_org,
      name: `${owner_org}--${pkg.name}`,
      title: pkg.title,
      notes: pkg.notes || "no description",
      language: pkg.language || "EN",
      tags: pkg.tags?.map((t: any) => ({ name: t.display_name || t.name })),
      license_id: pkg.license_id,
      rights:
        "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
      version: pkg.version,
      author: pkg.author,
      author_email: pkg.author_email,
      maintainer: pkg.maintainer,
      maintainer_email: pkg.maintainer_email,
      resources: (pkg.resources || []).map((r: any) => ({
        name: r.name,
        url: r.url,
        format: r.format,
        description: r.description,
        harvested_last_modified: r.last_modified,
        position: r.position,
      })),
      extras: [],
    };

    const extraFields: Record<string, any> = {
      harvested_pkg_created: pkg?.metadata_created,
      harvested_pkg_modified: pkg?.metadata_modified,
      harvested_pkg_groups: pkg?.groups?.map((g: any) => ({
        name: g.name,
        title: g.title || g.display_name,
      })),
      harvested_pkg_org: pkg?.organization
        ? {
            name: pkg.organization.name,
            title: pkg.organization.title || pkg.organization.display_name,
          }
        : undefined,
    };

    // Convert to extras array format
    dataset.extras = Object.entries(extraFields)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => ({
        key,
        value: typeof value === "object" ? JSON.stringify(value) : value,
      }));

    return dataset;
  }
}

export { LincolnshireHarvester };
