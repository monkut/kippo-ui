import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("login", "routes/login.tsx"),
  route("projects", "routes/projects.tsx"),
  route("projects/:id", "routes/projects.$id.tsx"),
  route("projects/:id/summary", "routes/projects.$id.summary.tsx"),
  route("projects/:id/requirements/:reqId", "routes/projects.$id.requirements.$reqId.tsx"),
  route("project-status", "routes/project-status.tsx"),
  route("weekly-effort", "routes/weekly-effort.tsx"),
] satisfies RouteConfig;
