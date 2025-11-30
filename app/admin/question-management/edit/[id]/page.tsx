import { QuestionEdit } from "@/components/question-edit"

export default function QuestionEditPage({ params }: { params: { id: string } }) {
  return <QuestionEdit testId={params.id} />
}
