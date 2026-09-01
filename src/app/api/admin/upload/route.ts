import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { saveUploadedImage } from "@/lib/upload";

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdminSession();
  if (error) return error;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  try {
    const url = await saveUploadedImage(file);
    return NextResponse.json({ url, uploadedBy: session!.user?.email });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 }
    );
  }
}
