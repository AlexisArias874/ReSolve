import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ManualPage from "@/components/manuals/manual-page";
import { getManual, MANUAL_IDS } from "@/lib/manuals";

interface ManualPageProps {
  params: Promise<{ manual: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return MANUAL_IDS.map((manual) => ({ manual }));
}

export async function generateMetadata({ params }: ManualPageProps): Promise<Metadata> {
  const { manual: manualId } = await params;
  const manual = getManual(manualId);

  if (!manual) return { title: "Manual no encontrado · ReSolve" };

  return {
    title: `${manual.title} · ReSolve`,
    description: manual.description,
  };
}

export default async function ManualByIdPage({ params }: ManualPageProps) {
  const { manual: manualId } = await params;
  const manual = getManual(manualId);

  if (!manual) notFound();

  return <ManualPage manual={manual} />;
}
