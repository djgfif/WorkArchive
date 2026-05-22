import { WorkPoster } from '../../features/works';

interface ArtworkPosterProps {
  className?: string;
  thumbnailUrl?: string;
  title: string;
  typeLabel?: string;
  variant?: 'card' | 'detail' | 'form' | 'grid' | 'hero' | 'row';
}

export function ArtworkPoster(props: ArtworkPosterProps) {
  return <WorkPoster {...props} />;
}
