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
      })),
      extras: [],
    };

    const extraFields: Record<string, any> = {
      license_title: pkg?.license_title,
      license_url: pkg?.license_url,
      metadata_created: pkg?.metadata_created,
      metadata_modified: pkg?.metadata_modified,
      state: pkg?.state,
      type: pkg?.type,
      private: pkg?.private,
      isopen: pkg?.isopen,
      num_tags: pkg?.num_tags,
      num_resources: pkg?.num_resources,
      creator_user_id: pkg?.creator_user_id,
      revision_id: pkg?.revision_id,
      groups: pkg?.groups,
      organization: pkg?.organization,
      relationships_as_object: pkg?.relationships_as_object,
      relationships_as_subject: pkg?.relationships_as_subject,
    };

    if (pkg.resources?.length) {
      extraFields.resources_extended = pkg.resources.map((r: any) => ({
        name: r.name,
        mimetype: r.mimetype,
        created: r.created,
        last_modified: r.last_modified,
        state: r.state,
        position: r.position,
        size: r.size,
      }));
    }

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
