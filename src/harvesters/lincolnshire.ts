import { env } from "../../config";
import { CkanHarvester } from "./ckan";
import { Harvester } from ".";
import { BaseHarvesterConfig, EntityMetadata } from "./base";
import { CkanPackage } from "@/schemas/ckanPackage";
import { PortalJsCloudDataset } from "@/schemas/portaljs-cloud";
import { uploadFile } from "../lib/resourceuploader";
import axios from "axios";
import path from "path";

@Harvester
class LincolnshireHarvester extends CkanHarvester {
  constructor(args: BaseHarvesterConfig) {
    super(args);
  }

  extractEntityMetadata(pkg: CkanPackage): EntityMetadata {
    const owner_org = env.PORTALJS_CLOUD_MAIN_ORG;
    const main_group = env.PORTALJS_CLOUD_MAIN_GROUP;
    const organizations = [];
    const groups = [];

    if (pkg.organization) {
      organizations.push({
        name: `${owner_org}--${pkg.organization.name}`,
        title: pkg.organization.title || pkg.organization.display_name,
        description: pkg.organization.description,
        groups: [{ name: owner_org }],
        users: [{ name: env.PORTALJS_CLOUD_MAIN_USER, capacity: "admin" }],
      });
    }

    if (pkg.groups && Array.isArray(pkg.groups)) {
      for (const group of pkg.groups) {
        groups.push({
          name: `${main_group}--${group.name}`,
          title: group.title || group.display_name,
          description: group.description,
          groups: [{ name: env.PORTALJS_CLOUD_MAIN_GROUP }],
          users: [{ name: env.PORTALJS_CLOUD_MAIN_USER, capacity: "admin" }],
        });
      }
    }

    return { organizations, groups };
  }

  async isDownloadableContent(url: string): Promise<boolean> {
    const urlObj = new URL(url);
    const pathExt = path.extname(urlObj.pathname).toLowerCase();
    const downloadableExts = [
      ".csv",
      ".xlsx",
      ".xls",
      ".pdf",
      ".zip",
      ".json",
      ".geojson",
      ".xml",
    ];

    if (downloadableExts.includes(pathExt)) {
      return true;
    }

    try {
      const response = await axios.head(url, { timeout: 5000 });
      const contentType = response.headers["content-type"] || "";

      const downloadableTypes = [
        "text/csv",
        "application/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/pdf",
        "application/zip",
        "application/json",
        "application/xml",
      ];

      return downloadableTypes.some((type) => contentType.includes(type));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(`Failed to check content type for ${url}: ${errorMessage}`);
      return false;
    }
  }

  async mapSourceDatasetToTarget(
    pkg: CkanPackage
  ): Promise<PortalJsCloudDataset> {
    const owner_org = env.PORTALJS_CLOUD_MAIN_ORG;
    const main_group = env.PORTALJS_CLOUD_MAIN_GROUP;

    const actualOwnerOrg = pkg.organization
      ? `${owner_org}--${pkg.organization.name}`
      : owner_org;

    const groups =
      pkg.groups?.map((g: any) => ({
        name: `${main_group}--${g.name}`,
      })) || [];

    const processedResources = await Promise.all(
      (pkg.resources || []).map(async (r: any) => {
        if (r.url) {
          const isUpload =
            r.url_type === "upload" ||
            r.url.includes(env.SOURCE_API_URL) ||
            (await this.isDownloadableContent(r.url));
          if (isUpload) {
            try {
              const newUrl = await uploadFile(r.url);
              return {
                name: r.name,
                url: newUrl,
                format: r.format,
                description: r.description,
                harvested_last_modified: r.last_modified,
                position: r.position,
              };
            } catch (err: any) {
              console.error(
                `Failed to upload file for resource ${r.name}: `,
                err.message || err
              );
              throw err;
            }
          }
        }
        return {
          name: r.name,
          url: r.url,
          format: r.format,
          description: r.description,
          harvested_last_modified: r.last_modified,
          position: r.position,
        };
      })
    );

    const dataset: PortalJsCloudDataset = {
      owner_org: actualOwnerOrg,
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
      resources: processedResources,
      groups: groups,
      extras: [],
    };

    const extraFields: Record<string, any> = {
      harvested_pkg_created: pkg?.metadata_created,
      harvested_pkg_modified: pkg?.metadata_modified,
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
