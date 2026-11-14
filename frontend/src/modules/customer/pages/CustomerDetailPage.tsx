import { useParams, useNavigate } from 'react-router-dom';
import { CustomerDetailModal } from '../components/CustomerDetailModal';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/customer');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      {id && (
        <CustomerDetailModal
          customerId={id}
          isOpen={true}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
