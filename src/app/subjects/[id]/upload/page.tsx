import { notFound } from "next/navigation";
import { uploadAction } from "@/app/actions";
import { Back } from "@/components/Back";
import { UploadForm } from "@/components/UploadForm";
import { userId } from "@/lib/auth";
import { getSubject } from "@/lib/repo";

export const metadata = { title: "Add material" };

export default async function UploadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subject = await getSubject(await userId(), id);
  if (!subject) notFound();
  return (
    <div className="pt-4 space-y-6">
      <Back href={`/subjects/${id}`}>{subject.name}</Back>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add material</h1>
        <p className="text-ink-2 mt-2 max-w-[52ch]">Reve reads it, splits it into short topics and only ever teaches from what&apos;s in it — citing the slide or page each time.</p>
      </div>
      <UploadForm action={uploadAction.bind(null, id)} />
    </div>
  );
}
