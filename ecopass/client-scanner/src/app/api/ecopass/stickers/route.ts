import { NextResponse } from 'next/server';
import {
  getOrderStickers,
  addOrderSticker,
  getPartnerStores,
  verifyOrderSticker,
  burnOrderSticker,
  deleteOrderSticker,
  resetOrderSticker,
} from '@/lib/database';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('storeId') || undefined;
  const stickers = getOrderStickers(storeId);
  const partners = getPartnerStores();

  return NextResponse.json({
    success: true,
    partners,
    total: stickers.length,
    activeCount: stickers.filter(s => s.status === 'active').length,
    usedCount: stickers.filter(s => s.status === 'used').length,
    data: stickers,
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.action === 'verify') {
      const result = verifyOrderSticker(body.barcode);
      return NextResponse.json(result, {
        status: result.valid ? 200 : 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (body.action === 'burn') {
      const result = burnOrderSticker(body.barcode, body.choice);
      return NextResponse.json(result, {
        status: result.success ? 200 : 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (body.action === 'delete') {
      const target = body.barcode || body.id || body.code;
      const result = deleteOrderSticker(target);
      return NextResponse.json(result, {
        status: result.success ? 200 : 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (body.action === 'reset') {
      const target = body.barcode || body.id || body.code;
      const result = resetOrderSticker(target);
      return NextResponse.json(result, {
        status: result.success ? 200 : 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (body.barcode && body.drinkName && body.storeName) {
      const newSticker = addOrderSticker({
        barcode: body.barcode,
        code: body.code || `#HL-${body.barcode.slice(-4)}`,
        storeId: body.storeId || 'highlands',
        storeName: body.storeName,
        drinkName: body.drinkName,
        price: Number(body.price) || 45000,
        posTerminal: body.posTerminal || 'POS 1',
        status: 'active',
      });
      return NextResponse.json({ success: true, data: newSticker }, {
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    return NextResponse.json({ success: false, message: 'Dữ liệu không hợp lệ!' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const barcode = searchParams.get('barcode') || searchParams.get('id');
    if (!barcode) {
      return NextResponse.json({ success: false, message: 'Thiếu mã tem!' }, { status: 400 });
    }
    const result = deleteOrderSticker(barcode);
    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
