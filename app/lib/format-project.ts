// Shared label helper: render a project as "顧客名 ・ プロジェクト名", or the
// project name alone when there is no customer. Middle dot separator is U+30FB
// with a space on each side (matches the convention in routes/projects.tsx).

/** Format a project label as `顧客名 ・ プロジェクト名`, or the name alone when no customer. */
export function formatProjectWithCustomer(
  projectName: string,
  customerName?: string | null,
): string {
  return customerName ? `${customerName} ・ ${projectName}` : projectName;
}
