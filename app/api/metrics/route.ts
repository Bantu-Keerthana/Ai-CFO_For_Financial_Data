import { NextResponse } from "next/server";
import { getFinanceData } from "@/lib/finance";

export async function GET() {
  const data = getFinanceData();
  return NextResponse.json(data);
}