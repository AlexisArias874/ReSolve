import type { Metadata } from "next";
import ManualsHub from "@/components/manuals/manuals-hub";

export const metadata: Metadata = {
  title: "Manuales · ReSolve",
  description:
    "Manual técnico, administrativo y de usuario, con consulta web y descarga en PDF.",
};

export default function ManualesPage() {
  return <ManualsHub />;
}
