"use client";

import dynamic from "next/dynamic";
import { use } from "react";

import { FullScreenSpinner } from "@/components/ui/spinner";

const Reader = dynamic(() => import("@/components/reader/reader").then((mod) => mod.Reader), {
  ssr: false,
  loading: () => <FullScreenSpinner />,
});

export default function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ listen?: string }>;
}) {
  const { id } = use(params);
  const { listen } = use(searchParams);
  return <Reader bookId={id} startListening={listen === "1"} />;
}
