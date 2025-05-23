import { memo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

function PaymentSuccessPageImpl() {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');

    // TODO: In a more advanced setup, you might want to:
    // 1. Verify the session_id with your backend to confirm status
    //    (though webhooks are the primary source of truth for subscription activation).
    // 2. Poll for a short period or use a real-time update (e.g., from Supabase Realtime
    //    if your webhook updates a flag) to confirm the subscription is active in your DB
    //    before redirecting to the dashboard or enabling features.

    return (
        <Card className="w-full max-w-md text-center shadow-lg mx-auto my-auto">
            <CardHeader>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-2xl font-bold">Payment Successful!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                    Thank you for your payment. Your subscription is now being processed.
                    You will be notified once it's active.
                </p>
                {sessionId && (
                    <p className="text-xs text-muted-foreground">
                        Session ID: {sessionId}
                    </p>
                )}
                <Button asChild className="w-full">
                    <Link to="/traces">Go to My Traces</Link>
                </Button>
            </CardContent>
        </Card>
    );
}

const WrappedPaymentSuccessPage = memo(() => {
    return (
        <AuthGuard>
            <Layout>
                <PaymentSuccessPageImpl />
            </Layout>
        </AuthGuard>
    );
});

export { WrappedPaymentSuccessPage as PaymentSuccessPage }; 