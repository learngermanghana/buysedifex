import { redirect } from 'next/navigation';

type LegacyCategoryPageProps = {
  params: { categoryKey: string };
};

export default function LegacyCategoryPage({ params }: LegacyCategoryPageProps) {
  redirect(`/category/${encodeURIComponent(params.categoryKey)}`);
}
