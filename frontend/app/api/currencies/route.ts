import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://api.frankfurter.app/currencies', {
      next: { revalidate: 86400 }, // cache 24h at the edge
    })
    if (!res.ok) return NextResponse.json({}, { status: res.status })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({}, { status: 502 })
  }
}
