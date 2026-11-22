import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { getShivaProviders } from "@/lib/ai-providers.server";

type QuizQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

type QuizPayload = { title?: string; questions?: unknown[] };

/**
 * Repair common JSON mistakes made by language models without changing
 * valid content inside strings (notably LaTeX backslashes).
 */
function repairModelJson(input: string): string {
  let output = "";
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (inString) {
      if (escaped) {
        // JSON only permits a small set of escapes. Preserve LaTeX such as
        // \\frac and \\theta by escaping the backslash itself.
        if (!['"', "\\\\", "/", "b", "f", "n", "r", "t", "u"].includes(char)) {
          output += "\\\\";
        }
        output += char;
        escaped = false;
        continue;
      }
      if (char === "\\\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
        output += char;
        // Recover a common model error: adjacent string values in an array
        // without the comma separator.
        let lookahead = i + 1;
        while (/\\s/.test(input[lookahead] || "")) lookahead += 1;
        if (stack[stack.length - 1] === "[" && input[lookahead] === '"') {
          output += ",";
        }
        continue;
      }
      if (char === "\n" || char === "\r") {
        output += char === "\n" ? "\\\\n" : "\\\\r";
        continue;
      }
      output += char;
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
    } else if (char === "{" || char === "[") {
      stack.push(char);
      output += char;
    } else if (char === "}" || char === "]") {
      stack.pop();
      output += char;
    } else {
      output += char;
    }
  }

  // A dangling escape at the end of a string is represented literally.
  if (escaped) output += "\\\\";
  return output.replace(/,\\s*([}\\]])/g, "$1");
}

function extractJson(raw: string): string {
  const unfenced = raw
    .replace(/^\\s*```(?:json)?\\s*/i, "")
    .replace(/\\s*```\\s*$/i, "")
    .trim();

  const start = unfenced.indexOf("{");
  if (start < 0) throw new Error("The AI response did not contain a JSON quiz.");

  // Find the matching outer brace while respecting quoted strings.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < unfenced.length; i += 1) {
    const char = unfenced[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return unfenced.slice(start, i + 1);
    }
  }
  throw new Error("The AI returned incomplete JSON for the quiz.");
}

function parseQuiz(raw: string, count: number) {
  const json = extractJson(raw);
  let parsed: QuizPayload;
  try {
    parsed = JSON.parse(json) as QuizPayload;
  } catch {
    try {
      parsed = JSON.parse(repairModelJson(json)) as QuizPayload;
    } catch {
      throw new Error("The AI returned malformed quiz data. The response was safely retried with the next provider.");
    }
  }

  if (!Array.isArray(parsed.questions) || parsed.questions.length !== count) {
    throw new Error("The generated quiz did not contain the requested number of questions.");
  }

  const questions: QuizQuestion[] = parsed.questions.map((value, index) => {
    if (!value || typeof value !== "object") {
      throw new Error(`Question ${index + 1} was incomplete. Please generate the quiz again.`);
    }
    const q = value as Record<string, unknown>;
    const options = Array.isArray(q.options)
      ? q.options.map((option) => String(option))
      : [];
    const answerIndex = typeof q.answerIndex === "number"
      ? q.answerIndex
      : Number(q.answerIndex);

    if (
      typeof q.question !== "string" ||
      options.length !== 4 ||
      !options.every((option) => option.trim().length > 0) ||
      !Number.isInteger(answerIndex) ||
      answerIndex < 0 ||
      answerIndex > 3 ||
      typeof q.explanation !== "string"
    ) {
      throw new Error(`Question ${index + 1} was incomplete. Please generate the quiz again.`);
    }

    return {
      question: q.question.trim(),
      options,
      answerIndex,
      explanation: q.explanation.trim(),
    };
  });

  return {
    title: typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim().slice(0, 100)
      : "Practice Quiz",
    questions,
  };
}

export const Route = createFileRoute("/api/quiz")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as {
            topic?: string;
            count?: number;
            difficulty?: string;
          };
          const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 240) : "";
          const count = [5, 10, 15].includes(Number(body.count)) ? Number(body.count) : 5;
          const difficulty = ["Easy", "Medium", "Hard", "Mixed"].includes(String(body.difficulty))
            ? String(body.difficulty)
            : "Mixed";

          if (!topic) {
            return Response.json({ error: "A quiz topic is required." }, { status: 400 });
          }

          const providers = getShivaProviders();
          if (!providers.length) {
            return Response.json({ error: "No AI provider is configured." }, { status: 503 });
          }

          const failures: string[] = [];
          for (const provider of providers) {
            try {
              const result = await generateText({
                model: provider.model,
                maxRetries: 0,
                system: [
                  "You are Shiva AI's educational quiz author.",
                  "Return exactly one valid JSON object and absolutely no markdown or text outside it.",
                  "Use this schema: {",
                  '  "title": "short title",',
                  '  "questions": [{',
                  '    "question": "question text",',
                  '    "options": ["option A", "option B", "option C", "option D"],',
                  '    "answerIndex": 0,',
                  '    "explanation": "brief explanation"',
                  "  }]",
                  "}",
                  "Use exactly four plain-text options and a zero-based integer answerIndex.",
                  "For mathematical expressions, use Unicode/plain text notation instead of LaTeX backslashes.",
                  "Do not put unescaped quotation marks inside string values. Escape JSON special characters correctly.",
                ].join("\\n"),
                prompt: `Create exactly ${count} multiple-choice questions about: ${topic}. Difficulty: ${difficulty}. Use clear student-friendly wording, four plausible options, exactly one correct answer, and a concise teaching explanation. Return valid JSON only.`,
              });

              const quiz = parseQuiz(result.text, count);
              console.info(`Shiva AI quiz generated by ${provider.name}`);
              return Response.json({ quiz, provider: provider.name });
            } catch (error) {
              const detail = error instanceof Error ? error.message : "Unknown provider error";
              console.error(`Shiva AI quiz ${provider.name} failed:`, detail);
              failures.push(`${provider.name}: ${detail.slice(0, 180)}`);
            }
          }

          return Response.json({
            error: "All configured AI providers failed to create the quiz.",
            detail: failures.join(" | ").slice(0, 800),
          }, { status: 502 });
        } catch (error) {
          console.error("Shiva AI /api/quiz error:", error);
          return Response.json({
            error: "Quiz generation failed.",
            detail: error instanceof Error ? error.message.slice(0, 400) : "Unknown error",
          }, { status: 500 });
        }
      },
    },
  },
});
