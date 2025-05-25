# FlameDeck Style Guidelines

## Brand Identity

FlameDeck is a modern, AI-powered performance analysis platform. Our visual identity reflects cutting-edge technology, reliability, and professional sophistication while maintaining approachability for engineering teams.

## Core Brand Colors

### Primary Gradient
Our signature brand gradient represents the "flame" in FlameDeck - dynamic, powerful, and energetic.

```css
/* Primary Brand Gradient */
bg-gradient-to-r from-red-500 via-red-400 to-yellow-500

/* Color Values */
--red-500: #ef4444
--red-400: #f87171
--yellow-500: #eab308
--yellow-400: #facc15
```

### Usage Guidelines
- **Headlines & Branding**: Use the gradient for the "FlameDeck" brand name and key call-to-action buttons
- **Accents**: Use gradient for decorative elements like underlines and highlights
- **Backgrounds**: Full gradient backgrounds for login pages and hero sections

### Supporting Colors
```css
/* Neutral Colors - adapt to light/dark mode */
--foreground: /* Dynamic based on theme */
--background: /* Dynamic based on theme */
--muted-foreground: /* Dynamic based on theme */
--border: /* Dynamic based on theme */

/* Semantic Colors */
--blue-500: #3b82f6    /* Database/Storage features */
--green-500: #22c55e   /* AI/Analysis features */
--purple-500: #a855f7  /* Upload/Integration features */
```

## Typography

### Hierarchy
```css
/* Hero Headlines */
.hero-title {
  font-size: clamp(2.5rem, 6vw, 4.5rem); /* 4xl-7xl responsive */
  font-weight: 900; /* font-black */
  line-height: 1.1; /* leading-tight */
  letter-spacing: -0.025em; /* tracking-tight */
}

/* Section Headlines */
.section-title {
  font-size: clamp(2rem, 4vw, 3rem); /* 4xl-5xl responsive */
  font-weight: 700; /* font-bold */
  margin-bottom: 1.5rem;
}

/* Card Titles */
.card-title {
  font-size: 1.125rem; /* text-lg */
  font-weight: 700; /* font-bold */
}

/* Body Text */
.body-text {
  font-size: 1rem; /* text-base */
  line-height: 1.6; /* leading-relaxed */
  font-weight: 300; /* font-light */
}

/* Subtitles */
.subtitle {
  font-size: 1.25rem; /* text-xl */
  font-weight: 300; /* font-light */
  color: var(--muted-foreground);
}
```

### Brand Text Treatment
```css
/* FlameDeck Brand Name */
.brand-gradient {
  background: linear-gradient(to right, #ef4444, #f87171, #eab308);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}
```

## Design Patterns

### Glassmorphism
Our primary design language uses glassmorphism for modern, sophisticated interfaces.

```css
/* Standard Glass Card */
.glass-card {
  background: rgba(255, 255, 255, 0.8); /* bg-card/80 */
  backdrop-filter: blur(12px); /* backdrop-blur-xl */
  border: 1px solid rgba(255, 255, 255, 0.3); /* border-border/30 */
  border-radius: 1rem; /* rounded-2xl */
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); /* shadow-2xl */
}

/* Subtle Glass Elements */
.glass-subtle {
  background: rgba(255, 255, 255, 0.5); /* bg-background/50 */
  backdrop-filter: blur(4px); /* backdrop-blur-sm */
  border: 1px solid rgba(255, 255, 255, 0.2); /* border-border/20 */
}
```

### Spacing System
```css
/* Consistent spacing scale */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-32: 8rem;     /* 128px */
```

### Border Radius
```css
/* Standard radius scale */
--radius-sm: 0.375rem;    /* rounded-md */
--radius-base: 0.5rem;    /* rounded-lg */
--radius-lg: 0.75rem;     /* rounded-xl */
--radius-xl: 1rem;        /* rounded-2xl */
--radius-full: 9999px;    /* rounded-full */
```

## UI Components

### Buttons

#### Primary CTA Button
```css
.btn-primary {
  background: linear-gradient(to right, #ef4444, #eab308);
  color: white;
  padding: 0.75rem 2rem; /* py-3 px-8 */
  border-radius: 0.5rem; /* rounded-lg */
  font-weight: 500; /* font-medium */
  font-size: 1.125rem; /* text-lg */
  box-shadow: 0 25px 50px -12px rgba(239, 68, 68, 0.25);
  transition: all 0.3s ease;
}

.btn-primary:hover {
  background: linear-gradient(to right, #dc2626, #d97706);
  transform: scale(1.05);
  box-shadow: 0 25px 50px -12px rgba(239, 68, 68, 0.4);
}
```

#### Secondary Button
```css
.btn-secondary {
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(4px);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: var(--foreground);
  padding: 0.75rem 2rem;
  border-radius: 0.5rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.8);
  transform: scale(1.05);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
}
```

### Cards

#### Feature Card
```css
.feature-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.4));
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 1rem;
  padding: 2rem; /* p-8 */
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  transition: all 0.5s ease;
}

.feature-card:hover {
  transform: scale(1.05);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border-color: rgba(239, 68, 68, 0.3);
}
```

#### Login Card
```css
.login-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 1rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  max-width: 28rem; /* max-w-md */
  margin: 0 auto;
}
```

### Icons

#### Icon Containers
```css
.icon-container {
  padding: 0.75rem; /* p-3 */
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(234, 179, 8, 0.1));
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 0.75rem; /* rounded-xl */
  transition: all 0.3s ease;
}

.icon-container:hover {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(234, 179, 8, 0.2));
}
```

## Backgrounds

### Hero Background
```css
.hero-background {
  position: fixed;
  inset: 0;
  z-index: -10;
  overflow: hidden;
}

.hero-background::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, 
    rgba(239, 68, 68, 0.05), 
    transparent, 
    rgba(234, 179, 8, 0.05)
  );
}

/* Floating orbs */
.floating-orb-1 {
  position: absolute;
  top: 25%;
  right: -16rem;
  width: 24rem;
  height: 24rem;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(234, 179, 8, 0.2));
  border-radius: 50%;
  filter: blur(48px);
}

.floating-orb-2 {
  position: absolute;
  bottom: 25%;
  left: -16rem;
  width: 24rem;
  height: 24rem;
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(239, 68, 68, 0.2));
  border-radius: 50%;
  filter: blur(48px);
}
```

### Full Gradient Background (Login)
```css
.gradient-background {
  background: linear-gradient(135deg, #ef4444, #f87171, #eab308);
}

.gradient-background-overlay {
  background: linear-gradient(315deg, 
    rgba(234, 179, 8, 0.3), 
    transparent, 
    rgba(239, 68, 68, 0.3)
  );
}
```

## Animations & Transitions

### Standard Transitions
```css
/* Smooth transitions for interactive elements */
.transition-standard {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Slower transitions for layout changes */
.transition-layout {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Hover Effects
```css
/* Subtle scale on hover */
.hover-scale {
  transition: transform 0.3s ease;
}

.hover-scale:hover {
  transform: scale(1.05);
}

/* Gentle scale for buttons */
.hover-scale-sm {
  transition: transform 0.3s ease;
}

.hover-scale-sm:hover {
  transform: scale(1.01);
}
```

## Accessibility

### Color Contrast
- All text maintains WCAG AA compliance (4.5:1 contrast ratio minimum)
- Interactive elements maintain 3:1 contrast ratio minimum
- Focus states use high-contrast outlines

### Interactive States
```css
.focusable:focus {
  outline: 2px solid #ef4444;
  outline-offset: 2px;
}

.interactive:hover {
  cursor: pointer;
}

.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
```

## Layout Guidelines

### Container Sizes
```css
/* Max widths for different content types */
.container-sm { max-width: 640px; }   /* Text content */
.container-md { max-width: 768px; }   /* Forms, cards */
.container-lg { max-width: 1024px; }  /* Feature sections */
.container-xl { max-width: 1280px; }  /* Full layouts */
.container-2xl { max-width: 1536px; } /* Hero sections */
```

### Grid Systems
```css
/* Feature grids */
.grid-features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

/* Language icons grid */
.grid-languages {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}
```

## Dark Mode Considerations

### Color Adaptations
```css
/* Colors that adapt automatically */
.adaptive-bg { background: hsl(var(--background)); }
.adaptive-text { color: hsl(var(--foreground)); }
.adaptive-muted { color: hsl(var(--muted-foreground)); }
.adaptive-border { border-color: hsl(var(--border)); }

/* Specific dark mode overrides */
@media (prefers-color-scheme: dark) {
  .glass-card {
    background: rgba(0, 0, 0, 0.8);
    border-color: rgba(255, 255, 255, 0.1);
  }
  
  .hero-background::before {
    background: linear-gradient(135deg, 
      rgba(127, 29, 29, 0.2), 
      transparent, 
      rgba(120, 113, 108, 0.2)
    );
  }
}
```

## Application vs Marketing Design

FlameDeck uses different design approaches for marketing pages versus logged-in application interfaces.

### Marketing Pages (Landing, Login)
Marketing pages use bold, attention-grabbing visuals with stronger shadows and dramatic effects:

```css
/* Marketing card shadows */
.marketing-card {
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); /* shadow-2xl */
  transition: all 0.5s ease;
}

.marketing-card:hover {
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
  transform: scale(1.05);
}

/* Marketing button shadows */
.marketing-btn {
  box-shadow: 0 25px 50px -12px rgba(239, 68, 68, 0.25);
}

.marketing-btn:hover {
  box-shadow: 0 25px 50px -12px rgba(239, 68, 68, 0.4);
}
```

### Application Pages (Logged-in Interface)
Application pages prioritize usability and focus with subtle, refined shadows that don't distract from content:

```css
/* Application card shadows - subtle and refined */
.app-card {
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); /* shadow-sm */
  transition: all 0.3s ease;
}

.app-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); /* shadow-md */
}

/* Application button shadows - minimal and functional */
.app-btn {
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); /* shadow-sm */
}

.app-btn:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); /* shadow-md */
}

/* Application glassmorphic elements */
.app-glass {
  background: rgba(255, 255, 255, 0.8); /* bg-background/80 */
  backdrop-filter: blur(4px); /* backdrop-blur-sm */
  border: 1px solid rgba(255, 255, 255, 0.3); /* border-border/30 */
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); /* shadow-sm */
}
```

### Shadow Guidelines by Context

#### Marketing/Landing Context
- **Primary elements**: `shadow-2xl` to `shadow-2xl` with increased opacity on hover
- **Feature cards**: `shadow-xl` with dramatic `scale(1.05)` transforms
- **Call-to-action buttons**: Strong gradient shadows matching brand colors

#### Application Context  
- **Data cards**: `shadow-sm` to `shadow-md` on hover
- **Action buttons**: `shadow-sm` with subtle `shadow-md` on hover
- **Navigation elements**: Minimal shadows, focus on backdrop blur effects
- **Content areas**: Subtle borders and background opacity over heavy shadows

This approach ensures marketing pages grab attention while application interfaces maintain focus on functionality and content.

## Implementation Notes

### CSS Variables
Define these custom properties in your root CSS:
```css
:root {
  --brand-red: #ef4444;
  --brand-yellow: #eab308;
  --brand-gradient: linear-gradient(to right, var(--brand-red), var(--brand-yellow));
  --glass-bg: rgba(255, 255, 255, 0.8);
  --glass-border: rgba(255, 255, 255, 0.3);
}
```

### Tailwind Configuration
Extend your Tailwind config with custom values:
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        'brand-red': '#ef4444',
        'brand-yellow': '#eab308',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(to right, #ef4444, #eab308)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    }
  }
}
```

## Brand Voice & Messaging

### Key Messages
- **Performance Debugging Made Simple** - Our core value proposition
- **AI-Powered Insights** - Emphasizing our technological advantage
- **For Engineering Teams** - Clear target audience

### Tone
- Professional yet approachable
- Confident and reliable
- Innovative and modern
- Technically credible

---

*This style guide should be referenced for all FlameDeck UI development to ensure consistency across the platform.* 