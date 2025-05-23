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
      '30-day trace retention',
      '10 uploads per month',
      '25 messages per chat session',
      '5 chat sessions (lifetime)',
    ],
  },
  {
    id: 'b963b9ea-a9e7-4452-976b-24bd435bf25b',
    name: 'Pro',
    price: '15',
    features: [
      'Unlimited trace retention',
      '1,000 total traces',
      'Advanced collaboration features',
      '50 messages per chat session',
      '25 chat sessions per month',
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
          {tier.name === 'Pro' && <Badge className="absolute top-4 right-4">Coming Soon</Badge>}
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{tier.name}</CardTitle>
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
              <Link
                to="/login"
                className={cn(
                  'block w-full',
                  tier.name === 'Pro' && 'pointer-events-none opacity-50'
                )}
                aria-disabled={tier.name === 'Pro'}
                tabIndex={tier.name === 'Pro' ? -1 : undefined}
              >
                <Button
                  className="w-full"
                  variant={tier.name === 'Pro' ? 'gradient' : 'outline'}
                  disabled={tier.name === 'Pro'}
                >
                  Get Started
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PricingTable;
