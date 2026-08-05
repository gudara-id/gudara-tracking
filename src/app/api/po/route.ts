import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generatePoIdentifiers, isPOStatus } from "@/lib/validators";
import { decimalToNumber } from "@/lib/utils";


export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pos = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { nama_lengkap: true } },
      articles: { orderBy: { id: "asc" } },
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });
  return NextResponse.json(pos.map(serializePo));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { nama_po, nama_artikel, harga_satuan, target_qty, articles = [], label, due_date, description } = body;

  if (!nama_po || !nama_artikel || harga_satuan === undefined || harga_satuan === null) {
    return NextResponse.json({ error: "Nama PO, artikel, dan harga satuan wajib diisi" }, { status: 400 });
  }

  const hargaNum = Number(harga_satuan);
  const targetNum = target_qty ? Number(target_qty) : null;
  if (!Number.isFinite(hargaNum) || hargaNum <= 0) {
    return NextResponse.json({ error: "Harga satuan harus lebih dari 0" }, { status: 400 });
  }
  if (targetNum !== null && (!Number.isInteger(targetNum) || targetNum <= 0)) {
    return NextResponse.json({ error: "Target QTY harus berupa angka bulat lebih dari 0" }, { status: 400 });
  }

  const count = await prisma.purchaseOrder.count();
  const { nomor_po, barcode_po } = generatePoIdentifiers(count + 1);

  const articleRows = Array.isArray(articles) && articles.length
    ? articles
    : [{ nama_artikel, harga_satuan: hargaNum, qty: targetNum }];

  const po = await prisma.purchaseOrder.create({
    data: {
      nomor_po,
      barcode_po,
      nama_po,
      nama_artikel,
      harga_satuan: hargaNum,
      target_qty: targetNum,
      status: "PRINT PO TINGKING",
      label: label || null,
      due_date: due_date ? new Date(due_date) : null,
      description: description || null,
      created_by: session.userId,
      articles: {
        create: articleRows.map((item: { artikel_id?: number; nama_artikel: string; harga_satuan: number; qty?: number | null }) => ({
          artikel_id: item.artikel_id || null,
          nama_artikel: item.nama_artikel,
          harga_satuan: Number(item.harga_satuan),
          qty: item.qty ? Number(item.qty) : null,
        })),
      },
    },
    include: {
      creator: { select: { nama_lengkap: true } },
      articles: { orderBy: { id: "asc" } },
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });

  return NextResponse.json(serializePo(po), { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, status, label, due_date, description, attachment } = body;
  if (!id) {
    return NextResponse.json({ error: "ID PO wajib diisi" }, { status: 400 });
  }
  if (status && !isPOStatus(status)) {
    return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
  }

  const po = await prisma.purchaseOrder.update({
    where: { id: Number(id) },
    data: {
      ...(status ? { status } : {}),
      ...(label !== undefined ? { label: label || null } : {}),
      ...(due_date !== undefined ? { due_date: due_date ? new Date(due_date) : null } : {}),
      ...(description !== undefined ? { description: description || null } : {}),
      ...(attachment?.file_name && attachment?.file_url
        ? {
            attachments: {
              create: {
                file_name: attachment.file_name,
                file_url: attachment.file_url,
                is_cover: !!attachment.is_cover,
              },
            },
          }
        : {}),
    },
    include: {
      creator: { select: { nama_lengkap: true } },
      articles: { orderBy: { id: "asc" } },
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });

  return NextResponse.json(serializePo(po));
}

function serializePo(po: any) {
  return {
    ...po,
    harga_satuan: decimalToNumber(po.harga_satuan),
    articles: po.articles?.map((article: any) => ({
      ...article,
      harga_satuan: decimalToNumber(article.harga_satuan),
    })) ?? [],
  };
}
