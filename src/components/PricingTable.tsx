
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

const PricingTable = () => {
  const tiers = [
    {
      name: "Free",
      price: "0",
      features: [
        "100MB Storage",
        "Unlimited traces",
        "Basic visualization",
        "Community support",
      ],
    },
    {
      name: "Personal",
      price: "10",
      features: [
        "500MB Storage",
        "Unlimited traces",
        "Advanced visualization",
        "Priority support",
        "Custom metadata fields",
      ],
    },
  ];

  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
      {tiers.map((tier) => (
        <Card key={tier.name} className="relative">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{tier.name}</CardTitle>
            <div className="mt-2">
              <span className="text-4xl font-bold">${tier.price}</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Link to="/login">
                <Button className="w-full">Get Started</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PricingTable;
