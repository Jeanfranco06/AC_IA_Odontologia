import { useParams } from 'react-router-dom';
import { BuyerDetailView } from '../components/BuyerDetailView';

export default function BuyerDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <BuyerDetailView buyerId={id || ''} />;
}
