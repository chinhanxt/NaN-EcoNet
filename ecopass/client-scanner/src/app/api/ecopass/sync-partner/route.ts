import { NextResponse } from 'next/server';
import { syncFromPartnerPortal } from '@/lib/database';

export async function POST(req: Request) {
  try {
    let storeUrl = 'http://localhost:3013/api/stickers';
    try {
      const body = await req.json();
      if (body.storeUrl || body.portalUrl) {
        storeUrl = body.storeUrl || body.portalUrl;
      }
    } catch {
      // Empty body is okay, use default
    }

    const result = await syncFromPartnerPortal(storeUrl);
    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
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
