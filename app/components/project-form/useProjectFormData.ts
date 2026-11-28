import { useApiQuery } from "~/hooks/useApiQuery";
import type {
  KippoProjectOrganizationCategory,
  OrganizationMember,
} from "~/lib/api/generated/models";
import { organizationsMembersRetrieve } from "~/lib/api/generated/organizations/organizations";
import { projectCategoriesList } from "~/lib/api/generated/project-categories/project-categories";
import { readList } from "~/lib/api/read-list";

const NO_MEMBERS: OrganizationMember[] = [];
const NO_CATEGORIES: KippoProjectOrganizationCategory[] = [];

/** Org members for the 担当PM picker (kippo#40 / T19). */
export function useOrgMembers(open: boolean, organizationId: string) {
  const query = useApiQuery(
    async () => {
      const response = await organizationsMembersRetrieve(organizationId);
      return response.status === 200 ? (response.data.members ?? []) : [];
    },
    [open, organizationId],
    { enabled: open && !!organizationId, keepPreviousData: true },
  );
  return query.data ?? NO_MEMBERS;
}

/** The organization's own selectable categories (kippo#49 copy-on-create). The list endpoint
 * returns the org's copies (org-scoped, active-only) and no longer surfaces the global template to
 * members, and the project serializer now resolves the key against the org's set — so every returned
 * category is writable and none must be filtered out. */
export function useProjectCategories(open: boolean, organizationId: string) {
  const query = useApiQuery(
    async () =>
      readList<KippoProjectOrganizationCategory>(
        (await projectCategoriesList({ organization: organizationId })).data,
      ),
    [open, organizationId],
    { enabled: open && !!organizationId, keepPreviousData: true },
  );
  return query.data ?? NO_CATEGORIES;
}

/** Members + writable categories for a project create form scoped to one organization. */
export function useProjectFormData(open: boolean, organizationId: string) {
  const members = useOrgMembers(open, organizationId);
  const categories = useProjectCategories(open, organizationId);
  return { members, categories };
}
