import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle } from 'lucide-react';
import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

function PaymentCancelPageImpl() {
  return (
    <Card className="w-full max-w-md text-center shadow-lg mx-auto my-auto">
      <CardHeader>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
          <XCircle className="h-6 w-6 text-red-600" />
        </div>
        <CardTitle className="text-2xl font-bold">Payment Canceled</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Your payment process was canceled. You can return to the pricing page if you'd like to try
          again.
        </p>
        <Button asChild className="w-full">
          <Link to="/pricing">Back to Pricing</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

const WrappedPaymentCancelPage = memo(() => {
  return (
    <AuthGuard>
      <Layout>
        <PaymentCancelPageImpl />
      </Layout>
    </AuthGuard>
  );
});

export { WrappedPaymentCancelPage as PaymentCancelPage };
