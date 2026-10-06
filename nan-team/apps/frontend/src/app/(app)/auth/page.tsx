export const dynamic = 'force-dynamic';
import { Register } from '@gitroom/frontend/components/auth/register';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
export const metadata: Metadata = {
  title: 'NaN - Đăng nhập',
  description: '',
};
export default async function Auth(params: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = (await params?.searchParams) || {};
  // OAuth provider callbacks (?provider=...&code=...) still need the register flow.
  if (searchParams.provider) {
    return <Register />;
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((v) => query.append(key, v));
    } else if (value !== undefined) {
      query.append(key, value);
    }
  }
  const qs = query.toString();
  redirect(`/auth/login${qs ? `?${qs}` : ''}`);
}
