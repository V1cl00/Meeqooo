import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/organizer/create")({
  component: () => <Navigate to="/create" search={{ community: "" }} />,
});
