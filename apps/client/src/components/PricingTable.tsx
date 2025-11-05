import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export const subscriptionTiers = [
  {
    id: '44b49ed5-76a3-4f2c-b2c6-5c101e57b9e8',
    name: 'Free',
    price: '0',
    features: [
      '3 AI chat conversations per month',
      '30-day trace retention',
      '10 uploads per month',
      'Basic collaboration and sharing features',
    ],
  },
  {
    id: 'b963b9ea-a9e7-4452-976b-24bd435bf25b',
    name: 'Pro',
    price: '15',
    features: [
      '1,000 total traces',
      'Unlimited trace retention',
      '30 AI chat conversations per month',
      'Higher message limits for chat conversations',
      'More features coming soon...',
    ],
  },
];

const PricingTable = () => {
  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
      {subscriptionTiers.map((tier) => (
        <Card
          key={tier.name}
          className={cn(
            'relative flex flex-col hover:shadow-lg transition-shadow',
            tier.name === 'Pro' && 'border-2 border-primary'
          )}
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-2xl font-bold">{tier.name}</CardTitle>
              {tier.name === 'Pro' && (
                <Badge variant="secondary">Coming Soon</Badge>
              )}
            </div>
            <div className="mt-2">
              <span className="text-4xl font-bold">${tier.price}</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <ul className="space-y-3 flex-1">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {tier.name === 'Pro' ? (
                <div className="flex flex-col gap-2">
                  <Button className="w-full" variant="outline" disabled>
                    Coming Soon
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Pro tier will be available soon
                  </p>
                </div>
              ) : (
                <Link to="/login" className={cn('block w-full')}>
                  <Button className="w-full" variant="outline">
                    Get Started
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PricingTable;
