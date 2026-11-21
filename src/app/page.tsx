"use client";

import { useRouter } from "next/navigation";
import { HomeScreen } from "@/components/HomeScreen";

export default function Home() {
  const router = useRouter();
  return <HomeScreen onCapture={() => router.push("/capture")} />;
}
