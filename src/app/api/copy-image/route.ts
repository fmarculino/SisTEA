import { copyFileSync } from 'fs';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    copyFileSync('C:\\Users\\Cliente\\.gemini\\antigravity\\brain\\0b8e83d1-69ed-43a5-96af-f87f7e527ef5\\media__1777513393123.png', 'public\\logo-sus.png');
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
