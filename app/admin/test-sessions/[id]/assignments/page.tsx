import { TestSessionAssignmentManager } from "@/components/test-session-assignment-manager"

export default async function AssignmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TestSessionAssignmentManager sessionId={id} />
}
