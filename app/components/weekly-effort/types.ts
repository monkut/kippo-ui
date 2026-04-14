export type FormEntry = {
  id: number;
  projectId: string;
  projectName: string;
  hours: number;
  filterType: "project" | "anon-project";
};
