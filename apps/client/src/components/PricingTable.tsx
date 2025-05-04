import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const PricingTable = () => {
  const tiers = [
    {
      name: "Hobby",
      price: "0",
      features: [
        "30-day trace retention",
        "10 uploads per month",
        "Basic viewing & collaboration",
      ],
    },
    {
      name: "Pro",
      price: "10",
      features: [
        "Unlimited trace retention",
        "1,000 total traces",
        "Share traces so anyone can view",
        "Advanced collaboration features",
        "Priority support",
        "More features coming soon...",
      ],
    },
  ];

  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
      {tiers.map((tier) => (
        <Card
          key={tier.name}
          className={cn(
            "relative flex flex-col hover:shadow-lg transition-shadow",
            tier.name === "Pro" && "border-2 border-primary"
          )}
        >
          {tier.name === "Pro" && (
            <Badge className="absolute top-4 right-4">
              Coming Soon
            </Badge>
          )}
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
                  "block w-full",
                  tier.name === "Pro" && "pointer-events-none opacity-50"
                )}
                aria-disabled={tier.name === "Pro"}
                tabIndex={tier.name === "Pro" ? -1 : undefined}
              >
                <Button
                  className="w-full"
                  variant={tier.name === "Pro" ? "gradient" : "outline"}
                  disabled={tier.name === "Pro"}
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
