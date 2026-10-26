import { createSubjectAction } from "@/app/actions";
import { Back } from "@/components/Back";
import { SubjectForm } from "@/components/SubjectForm";

export const metadata = { title: "New subject" };

export default function NewSubject() {
  return (
    <div className="pt-4 space-y-6">
      <Back href="/">Today</Back>
      <h1 className="text-2xl font-semibold tracking-tight">New subject</h1>
      <SubjectForm action={createSubjectAction} submitLabel="Create and add material" />
    </div>
  );
}
