import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const report: Record<string, unknown> = {
    ok: false,
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL ?? null,
    timestamp: new Date().toISOString(),
  };

  try {
    const url = process.env.DATABASE_URL ?? "";
    if (url.startsWith("file:")) {
      const filePath = url.replace(/^file:/, "");
      const absolute = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath.replace(/^\.\//, ""));
      report.dbFile = absolute;
      report.dbExists = fs.existsSync(absolute);
      report.dbSize = report.dbExists ? fs.statSync(absolute).size : 0;
    }

    await prisma.$queryRaw`SELECT 1`;
    const [environments, products, whatsapp] = await Promise.all([
      prisma.environment.count(),
      prisma.product.count({ where: { status: "ACTIVE" } }),
      prisma.whatsAppSetting.count(),
    ]);

    report.ok = true;
    report.environments = environments;
    report.products = products;
    report.whatsappSettings = whatsapp;
    return NextResponse.json(report);
  } catch (error) {
    report.ok = false;
    report.error = error instanceof Error ? error.message : String(error);
    return NextResponse.json(report, { status: 500 });
  }
}
