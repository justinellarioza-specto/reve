import { notFound } from "next/navigation";
import { regenerateQuestionsAction } from "@/app/actions";
import { Back } from "@/components/Back";
import { QuestionRunner, type ClientQuestion } from "@/components/QuestionRunner";
import { userId } from "@/lib/auth";
import { getTopic, type Question } from "@/lib/repo";
import { ensureQuestions } from "@/lib/services";
import { shuffle } from "@/lib/text";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quick Check" };

export default async function CheckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await userId();
  const topic = await getTopic(uid, id);
  if (!topic) notFound();
  let questions: Question[] = [];
  let error = "";
  try {
    questions = await ensureQuestions(uid, id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Couldn't write the Quick Check.";
  }
  // Answers stay on the server; the client only gets what it needs to ask.
  const items: ClientQuestion[] = shuffle(questions).slice(0, 8).map((q) => ({
    id: q.id, type: q.type, prompt: q.prompt, options: q.options, hint: q.hint, topic_id: id, topic_title: topic.title, color: topic.subject_color,
  }));

  return (
    <div className="pt-4 space-y-2">
      <div className="flex items-center justify-between">
        <Back href={`/topics/${id}`}>{topic.title}</Back>
        {questions.length > 0 && (
          <form action={regenerateQuestionsAction.bind(null, id)}>
            <button className="btn-ghost btn-sm">New questions</button>
          </form>
        )}
      </div>
      {error && <p role="alert" className="text-bad py-4">{error}</p>}
      {error ? null : questions.length < 3 ? (
        <p className="py-8 text-ink-2">There isn&apos;t enough material in this topic to write a Quick Check. Add more notes for it, or merge it with a neighbouring topic in the outline.</p>
      ) : (
        <QuestionRunner items={items} mode="check" title="Quick Check" doneHref={`/topics/${id}`} doneLabel="Back to topic" />
      )}
    </div>
  );
}
