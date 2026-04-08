import { permanentRedirect } from 'next/navigation';
import { buildCategoryPath } from '@/lib/category';

type LegacyCategoryPageProps = {
  params: { categoryKey: string };
};

export default function LegacyCategoryPage({ params }: LegacyCategoryPageProps) {
  permanentRedirect(buildCategoryPath(params.categoryKey));
}
