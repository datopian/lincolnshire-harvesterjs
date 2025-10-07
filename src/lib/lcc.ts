import { env } from "../../config";
import CkanRequest from "@portaljs/ckan-api-client-js";
import { CkanGroup, CkanOrganization } from "@/schemas/portaljs-cloud";

const portalConfig = {
  ckanUrl: env.PORTALJS_CLOUD_API_URL,
  ckanApiToken: env.PORTALJS_CLOUD_API_KEY,
};

export async function ensureOrganizationExists(
  org: CkanOrganization
): Promise<void> {
  try {
    console.log(
      `Checking if organization exists: ${JSON.stringify(org, null, 2)}`
    );
    await CkanRequest.get(`organization_show?id=${org.name}`, {
      ckanUrl: portalConfig.ckanUrl,
      apiKey: portalConfig.ckanApiToken,
    });
    console.log(`✓ Organization already exists: ${org.name}`);
  } catch (error) {
    try {
      // The org object should already have groups array if needed
      await CkanRequest.post("organization_create", {
        ckanUrl: portalConfig.ckanUrl,
        apiKey: portalConfig.ckanApiToken,
        json: org,
      });
      console.log(
        `✓ Created organization: ${org.name}${
          org.groups?.length ? ` as child of ${org.groups[0].name}` : ""
        }`
      );
    } catch (createError) {
      console.error(
        `✗ Failed to create organization ${org.name}:`,
        createError
      );
      throw createError;
    }
  }
}

export async function ensureGroupExists(group: CkanGroup): Promise<void> {
  try {
    console.log(`Checking if group exists: ${JSON.stringify(group, null, 2)}`);
    await CkanRequest.get(`group_show?id=${group.name}`, {
      ckanUrl: portalConfig.ckanUrl,
      apiKey: portalConfig.ckanApiToken,
    });
    console.log(`✓ Group already exists: ${group.name}`);
  } catch (error) {
    try {
      await CkanRequest.post("group_create", {
        ckanUrl: portalConfig.ckanUrl,
        apiKey: portalConfig.ckanApiToken,
        json: group,
      });
      console.log(
        `✓ Created group: ${group.name}${
          group.groups?.length ? ` under ${group.groups[0].name}` : ""
        }`
      );
    } catch (createError) {
      console.error(`✗ Failed to create group ${group.name}:`, createError);
      throw createError;
    }
  }
}

export async function ensureMainGroupExists(): Promise<void> {
  await ensureGroupExists({
    name: env.PORTALJS_CLOUD_MAIN_GROUP,
    title: env.PORTALJS_CLOUD_MAIN_GROUP,
    description: "Main parent group for harvested datasets",
    users: [{ name: env.PORTALJS_CLOUD_MAIN_USER, capacity: "admin" }],
  });
}
