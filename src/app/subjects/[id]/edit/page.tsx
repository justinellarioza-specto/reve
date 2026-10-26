import { notFound } from "next/navigation";
import { deleteSubjectAction, updateSubjectAction } from "@/app/actions";
import { Back } from "@/components/Back";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubjectForm } from "@/components/SubjectForm";
import { userId } from "@/lib/auth";
import { getSubject } from "@/lib/repo";

export const metadata = { title: "Edit subject" };

export default async function EditSubject({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subject = await getSubject(await userId(), id);
  if (!subject) notFound();
  return (
    <div className="pt-4 space-y-6">
      <Back href={`/subjects/${id}`}>{subject.name}</Back>
      <h1 className="text-2xl font-semibold tracking-tight">Edit subject</h1>
      <SubjectForm action={updateSubjectAction.bind(null, id)} initial={subject} submitLabel="Save changes" />
      <form action={deleteSubjectAction.bind(null, id)} className="pt-8 rule">
        <p className="text-ink-2 mt-6 mb-3">Deleting removes this subject&apos;s material, topics, questions and progress. This can&apos;t be undone.</p>
        <ConfirmButton className="btn-quiet text-bad" message={`Delete ${subject.name} and all its progress?`}>Delete subject</ConfirmButton>
      </form>
    </div>
  );
}
