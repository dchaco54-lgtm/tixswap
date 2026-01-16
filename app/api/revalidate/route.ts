import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const path = searchParams.get('path');

    // Validar secret para seguridad
    const expectedSecret = process.env.REVALIDATE_SECRET || 'dev-secret';
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }

    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    // Revalidar la ruta específica
    revalidatePath(path);
    
    console.log(`[Revalidate] Successfully revalidated: ${path}`);

    return NextResponse.json({ 
      revalidated: true, 
      path,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Revalidate] Error:', error);
    return NextResponse.json({ 
      error: 'Error revalidating', 
      details: error?.message 
    }, { status: 500 });
  }
}

// También permitir GET para testing
export async function GET(request: NextRequest) {
  return POST(request);
}
