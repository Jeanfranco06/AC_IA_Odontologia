import { useParams } from 'react-router-dom';
import { LeadDetailView } from '../components/LeadDetailView';

export default function LeadNegotiationPage() {
  const { id } = useParams<{ id: string }>();
  return <LeadDetailView leadId={id || ''} />;
}
