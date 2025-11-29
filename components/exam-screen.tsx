"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Clock, CheckCircle } from "lucide-react"

const generateMockQuestions = () => {
  return Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    question: `問題${i + 1}: これは${i + 1}番目の試験問題です。正しい選択肢を選んでください。`,
    options: ["0", "1", "2", "3"],
  }))
}

export function ExamScreen() {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [timeRemaining, setTimeRemaining] = useState(90 * 60) // 90 minutes in seconds
  const questions = generateMockQuestions()

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleAnswerChange = (questionIndex: number, value: string) => {
    setAnswers({ ...answers, [questionIndex]: value })
    sessionStorage.setItem("examAnswers", JSON.stringify({ ...answers, [questionIndex]: value }))
  }

  const handleSubmit = () => {
    const score = calculateScore()
    sessionStorage.setItem("examScore", score.toString())
    router.push("/student/results")
  }

  const calculateScore = () => {
    let correctCount = 0
    Object.keys(answers).forEach((key) => {
      // Mock scoring - in real app, compare with correct answers
      if (answers[Number(key)] === "1") correctCount++ // Assuming "1" is correct for demo
    })
    return correctCount
  }

  const answeredCount = Object.keys(answers).length
  const progressPercentage = (answeredCount / questions.length) * 100

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <Card className="sticky top-0 z-10 shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm text-muted-foreground">残り時間</div>
                  <div className="text-xl font-bold text-primary">{formatTime(timeRemaining)}</div>
                </div>
              </div>

              <div className="flex-1 max-w-md space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">回答進捗</span>
                  <span className="font-semibold">
                    {answeredCount} / {questions.length}
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              <Button onClick={handleSubmit} size="lg" className="md:min-w-[160px]">
                回答を提出する
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-1">
          {questions.map((question, index) => (
            <Card key={question.id} className="scroll-mt-20" id={`question-${index}`}>
              <CardContent className="p-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-tight">{question.question}</p>
                  </div>

                  <RadioGroup
                    value={answers[index] || ""}
                    onValueChange={(value) => handleAnswerChange(index, value)}
                    className="flex gap-1 shrink-0"
                  >
                    {question.options.map((option) => (
                      <div
                        key={option}
                        className="flex items-center space-x-1 px-1.5 py-0.5 rounded-md border-2 hover:bg-accent/50 transition-colors cursor-pointer"
                      >
                        <RadioGroupItem value={option} id={`q${index}-option-${option}`} className="w-4 h-4" />
                        <Label htmlFor={`q${index}-option-${option}`} className="cursor-pointer font-medium text-xs">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>

                  {answers[index] && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="sticky bottom-4">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                回答済み: <span className="font-semibold text-foreground">{answeredCount}</span> / {questions.length}
              </div>
              <Button onClick={handleSubmit} size="lg" className="w-full sm:w-auto sm:min-w-[200px]">
                回答を提出する
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
