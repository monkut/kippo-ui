import { useEffect, useState } from "react";
import type {
  KippoProjectOrganizationCategory,
  OrganizationMember,
} from "~/lib/api/generated/models";
import { organizationsMembersRetrieve } from "~/lib/api/generated/organizations/organizations";
import { projectCategoriesList } from "~/lib/api/generated/project-categories/project-categories";

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

/** Writable categories for the org via kippo#341. Only globals are writable (the project serializer's
 * category queryset is organization__isnull); org-specific keys would 400 on save, so exclude them. */
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
        if (!cancelled)
          setCategories((response.data?.results ?? []).filter((c) => c.organization == null));
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
