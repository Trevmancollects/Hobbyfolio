import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let res = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cs) {
          cs.forEach(({name,value}) => request.cookies.set(name,value))
          res = NextResponse.next({ request })
          cs.forEach(({name,value,options}) => res.cookies.set(name,value,options))
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user && request.nextUrl.pathname.startsWith('/dashboard'))
    return NextResponse.redirect(new URL('/auth/login', request.url))
  if (user && request.nextUrl.pathname.startsWith('/auth'))
    return NextResponse.redirect(new URL('/dashboard', request.url))
  return res
}
