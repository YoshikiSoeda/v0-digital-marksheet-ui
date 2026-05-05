import { QuestionEdit } from "@/components/question-edit"

export default async function QuestionEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <QuestionEdit testId={id} />
}
