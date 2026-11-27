import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleHelp, Loader2, RotateCcw, Trophy } from "lucide-react";

type Question = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};
type Quiz = { title: string; questions: Question[] };

export function QuizBuilder({ onClose, initialTopic = "", autoStart = false }: { onClose: () => void; initialTopic?: string; autoStart?: boolean }) {
  const [topic, setTopic] = useState(initialTopic);
  const autoStarted = useRef(false);
  const [count, setCount] = useState("5");
  const [difficulty, setDifficulty] = useState("Mixed");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateQuiz(topicToUse = topic) {
    if (!topicToUse.trim() || loading) return;
    setLoading(true);
    setError("");
    setQuiz(null);
    setAnswers({});
    setSubmitted(false);
    try {
      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topicToUse.trim(), count: Number(count), difficulty }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.error || "Quiz generation failed.");
      setQuiz(data.quiz);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the quiz. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function createQuiz(event: React.FormEvent) {
    event.preventDefault();
    await generateQuiz();
  }

  useEffect(() => {
    if (!initialTopic.trim() || !autoStart || autoStarted.current) return;
    autoStarted.current = true;
    setTopic(initialTopic);
    void generateQuiz(initialTopic);
  }, [initialTopic, autoStart]);

  function resetQuiz() {
    setQuiz(null);
    setAnswers({});
    setSubmitted(false);
  }

  const score = quiz ? quiz.questions.reduce((total, question, index) => total + (answers[index] === question.answerIndex ? 1 : 0), 0) : 0;
  const allAnswered = !!quiz && quiz.questions.every((_, index) => answers[index] !== undefined);

  return (
    <section className="w-full max-w-2xl flex-1 py-6">
      <button type="button" onClick={onClose} className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to chat
      </button>
      {!quiz ? (
        <form onSubmit={createQuiz} className="rounded-3xl border border-border bg-card/80 p-5 shadow-xl sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><CircleHelp className="h-6 w-6" /></div>
            <div><h2 className="text-xl font-semibold">Create a quiz</h2><p className="text-sm text-muted-foreground">Practice actively and check your understanding.</p></div>
          </div>
          <label className="mb-2 block text-sm font-medium" htmlFor="quiz-topic">What should the quiz cover?</label>
          <input id="quiz-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Laws of Motion, Chemical Bonding..." className="mb-5 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" required />
          <div className="mb-5 grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">Questions
              <select value={count} onChange={(e) => setCount(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm">
                <option value="5">5 questions</option><option value="10">10 questions</option><option value="15">15 questions</option>
              </select>
            </label>
            <label className="text-sm font-medium">Difficulty
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm">
                <option>Mixed</option><option>Easy</option><option>Medium</option><option>Hard</option>
              </select>
            </label>
          </div>
          {error && <p role="alert" className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <button disabled={loading || !topic.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating your quiz...</> : "Generate quiz"}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/80 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wider text-primary">Shiva AI quiz</p><h2 className="mt-1 text-xl font-semibold">{quiz.title}</h2></div><span className="rounded-full bg-secondary px-3 py-1 text-xs">{quiz.questions.length} questions</span></div>
            {submitted && <div className="mt-4 flex items-center gap-3 rounded-xl bg-primary/10 p-4"><Trophy className="h-7 w-7 text-primary" /><div><p className="font-semibold">You scored {score} / {quiz.questions.length}</p><p className="text-sm text-muted-foreground">{Math.round((score / quiz.questions.length) * 100)}% correct</p></div></div>}
          </div>
          {quiz.questions.map((question, index) => (
            <article key={index} className="rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
              <p className="mb-4 text-sm font-semibold leading-relaxed">{index + 1}. {question.question}</p>
              <div className="space-y-2">
                {question.options.map((option, optionIndex) => {
                  const selected = answers[index] === optionIndex;
                  const correct = question.answerIndex === optionIndex;
                  const style = submitted && correct ? "border-emerald-500 bg-emerald-500/10" : submitted && selected ? "border-destructive bg-destructive/10" : selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50";
                  return <button key={optionIndex} type="button" disabled={submitted} onClick={() => setAnswers((current) => ({ ...current, [index]: optionIndex }))} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${style}`}>
                    {submitted && correct ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{String.fromCharCode(65 + optionIndex)}</span>}
                    <span>{option}</span>
                  </button>;
                })}
              </div>
              {submitted && <p className="mt-3 rounded-xl bg-secondary/70 p-3 text-sm leading-relaxed"><strong>Explanation:</strong> {question.explanation}</p>}
            </article>
          ))}
          {!submitted ? <button type="button" disabled={!allAnswered} onClick={() => setSubmitted(true)} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">Submit answers ({Object.keys(answers).length}/{quiz.questions.length})</button> : <button type="button" onClick={resetQuiz} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-secondary"><RotateCcw className="h-4 w-4" /> Create another quiz</button>}
        </div>
      )}
    </section>
  );
}
