import { useEffect, useState } from "react";
import type {
  KippoProjectOrganizationCategory,
  OrganizationMember,
} from "~/lib/api/generated/models";
import { organizationsMembersRetrieve } from "~/lib/api/generated/organizations/organizations";
import { projectCategoriesList } from "~/lib/api/generated/project-categories/project-categories";
import { readList } from "~/lib/api/read-list";

/** Org members for the 担当PM picker (kippo#40 / T19). */
export function useOrgMembers(open: boolean, organizationId: string) {
  const [members, setMembers] = useState<OrganizationMember[]>([]);

  useEffect(() => {
    if (!open || !organizationId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await organizationsMembersRetrieve(organizationId);
        if (!cancelled) setMembers(response.status === 200 ? (response.data.members ?? []) : []);
      } catch {
        if (!cancelled) setMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organizationId]);

  return members;
}

/** The organization's own selectable categories (kippo#49 copy-on-create). The list endpoint
 * returns the org's copies (org-scoped, active-only) and no longer surfaces the global template to
 * members, and the project serializer now resolves the key against the org's set — so every returned
 * category is writable and none must be filtered out. */
export function useProjectCategories(open: boolean, organizationId: string) {
  const [categories, setCategories] = useState<KippoProjectOrganizationCategory[]>([]);

  useEffect(() => {
    if (!open || !organizationId) {
      setCategories([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await projectCategoriesList({ organization: organizationId });
        if (!cancelled) setCategories(readList<KippoProjectOrganizationCategory>(response.data));
      } catch {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organizationId]);

  return categories;
}

/** Members + writable categories for a project create form scoped to one organization. */
export function useProjectFormData(open: boolean, organizationId: string) {
  const members = useOrgMembers(open, organizationId);
  const categories = useProjectCategories(open, organizationId);
  return { members, categories };
}
