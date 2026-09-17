import { NextResponse } from 'next/server';
import { getStoreQrs, addStoreQr, verifyBinQr } from '@/lib/database';

export async function GET() {
  const qrs = getStoreQrs();
  return NextResponse.json({ success: true, data: qrs }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.action === 'verify') {
      const result = verifyBinQr(body.qrCode);
      return NextResponse.json(result, {
        status: result.valid ? 200 : 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (body.qrCode && body.storeName && body.location) {
      const newQr = addStoreQr({
        qrCode: body.qrCode,
        storeId: body.storeId || 'custom',
        storeName: body.storeName,
        location: body.location,
        status: body.status || 'active',
      });
      return NextResponse.json({ success: true, data: newQr }, {
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    return NextResponse.json({ success: false, message: 'Dữ liệu không hợp lệ!' }, { status: 400 });
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
