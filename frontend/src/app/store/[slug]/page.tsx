import { redirect } from 'next/navigation';

type StoreAliasPageProps = {
  params: { slug: string };
};

export default function StoreAliasPage({ params }: StoreAliasPageProps) {
  redirect(`/stores/${encodeURIComponent(params.slug)}`);
}
