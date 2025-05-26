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

## Empty States

Empty states are crucial for user experience, providing guidance and maintaining engagement when content is unavailable. FlameDeck uses consistent patterns for empty states across the application.

### Design Principles

1. **Clear Visual Hierarchy**: Use consistent typography and spacing
2. **Contextual Messaging**: Explain what the empty state means and what users can do
3. **Actionable When Possible**: Provide clear next steps or actions
4. **Brand Consistent**: Use FlameDeck's visual language and color palette
5. **Encouraging Tone**: Maintain a positive, helpful tone

### Visual Pattern

#### Standard Empty State Structure
```css
.empty-state {
  text-align: center;
  padding: 2rem 0; /* py-8 */
}

.empty-state-icon {
  width: 4rem; /* w-16 */
  height: 4rem; /* h-16 */
  margin: 0 auto 1.5rem; /* mx-auto mb-6 */
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(234, 179, 8, 0.2));
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 0.75rem; /* rounded-xl */
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state-title {
  font-size: 1.125rem; /* text-lg */
  font-weight: 700; /* font-bold */
  margin-bottom: 0.5rem; /* mb-2 */
  color: hsl(var(--foreground));
}

.empty-state-description {
  color: hsl(var(--muted-foreground));
  margin-bottom: 1.5rem; /* mb-6 */
  max-width: 28rem; /* max-w-md */
  margin-left: auto;
  margin-right: auto;
}
```

### Empty State Types

#### 1. No Data Empty State
For when a section or list has no content yet.

```jsx
<div className="text-center py-8">
  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-red-500/20 to-yellow-500/20 rounded-xl border border-red-500/40 flex items-center justify-center">
    <FolderIcon className="h-8 w-8 text-muted-foreground" />
  </div>
  <h3 className="text-lg font-bold mb-2">No traces yet</h3>
  <p className="text-muted-foreground mb-6">
    Get started by uploading your first performance trace file.
  </p>
  <Button className="bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white">
    Upload New Trace
  </Button>
</div>
```

#### 2. Search Results Empty State
For when search queries return no results.

```jsx
<div className="text-center py-8">
  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-500/20 to-blue-400/20 rounded-xl border border-blue-500/40 flex items-center justify-center">
    <Search className="h-8 w-8 text-blue-500" />
  </div>
  <h3 className="text-lg font-bold mb-2">No matching traces found</h3>
  <p className="text-muted-foreground mb-6">
    We couldn't find any traces matching "<span className="font-medium text-foreground">{searchQuery}</span>". Try adjusting your search terms.
  </p>
  <Button variant="outline" onClick={handleClearSearch}>
    <X className="mr-2 h-4 w-4" />
    Clear Search
  </Button>
</div>
```

#### 3. Error Empty State
For when there's an error loading content.

```jsx
<div className="text-center py-8">
  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-red-500/20 to-yellow-500/20 rounded-xl border border-red-500/30 flex items-center justify-center">
    <X className="h-8 w-8 text-red-500" />
  </div>
  <h3 className="text-lg font-bold mb-2">Error Loading Contents</h3>
  <p className="text-muted-foreground mb-6">
    {error.message}
  </p>
  <Button onClick={() => window.location.reload()}>
    Try Again
  </Button>
</div>
```

#### 4. Feature/Section Empty State
For specific features or sections that don't have content yet.

```jsx
<div className="text-center py-8">
  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-red-500/20 to-yellow-500/20 rounded-xl border border-red-500/40 flex items-center justify-center">
    <MessageSquare className="h-8 w-8 text-muted-foreground" />
  </div>
  <h3 className="text-lg font-bold mb-2">No comments yet</h3>
  <p className="text-muted-foreground mb-6">
    Be the first to share your insights about this trace.
  </p>
</div>
```

### Content Guidelines

#### Titles
- Keep titles short and descriptive (2-4 words ideal)
- Use present tense ("No traces yet" vs "No traces found")
- Avoid technical jargon
- Be specific to the context

#### Descriptions
- Explain what the empty state means
- Provide context about why it's empty
- Suggest actionable next steps when appropriate
- Keep under 20 words when possible
- Use encouraging, positive language

#### Common Title Patterns
- "No [items] yet" - for first-time empty states
- "No matching [items] found" - for search results
- "This [container] is empty" - for folders/categories
- "Error loading [content]" - for error states

### Icon Selection

#### Icon Categories by Context
```css
/* Data/Content Icons */
.icon-data { /* Folder, FileText, Database */ }

/* Search Icons */
.icon-search { /* Search, Filter */ }

/* Error Icons */
.icon-error { /* X, AlertCircle, AlertTriangle */ }

/* Feature-Specific Icons */
.icon-comments { /* MessageSquare, MessageCircle */ }
.icon-analytics { /* BarChart, TrendingUp */ }
.icon-upload { /* Upload, UploadCloud */ }
```

#### Icon Color Guidelines
- **Data empty states**: `text-muted-foreground` (neutral)
- **Search empty states**: `text-blue-500` (informational)
- **Error states**: `text-red-500` (attention)
- **Feature empty states**: `text-muted-foreground` (neutral)

### Responsive Considerations

```css
/* Mobile adjustments */
@media (max-width: 640px) {
  .empty-state {
    padding: 1.5rem 1rem; /* py-6 px-4 */
  }
  
  .empty-state-icon {
    width: 3rem; /* w-12 */
    height: 3rem; /* h-12 */
    margin-bottom: 1rem; /* mb-4 */
  }
  
  .empty-state-description {
    font-size: 0.875rem; /* text-sm */
  }
}
```

### Integration with Cards

Empty states should be placed within the same card containers as content for visual consistency:

```jsx
<Card className="bg-card/90 backdrop-blur-sm border border-border">
  <CardContent className="pt-12 pb-12">
    {/* Empty state content */}
  </CardContent>
</Card>
```

### Accessibility

- Ensure empty states are announced by screen readers
- Provide adequate color contrast for all text and icons
- Make action buttons keyboard accessible
- Use semantic HTML structure

```jsx
<div role="status" aria-live="polite" className="text-center py-8">
  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-red-500/20 to-yellow-500/20 rounded-xl border border-red-500/40 flex items-center justify-center">
    <MessageSquare className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
  </div>
  <h3 className="text-lg font-bold mb-2">No comments yet</h3>
  <p className="text-muted-foreground mb-6">
    Be the first to share your insights about this trace.
  </p>
</div>
```

### Animation Guidelines

Empty states should appear with subtle animations when content changes:

```css
.empty-state {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

## Responsiveness Guidelines

Ensuring FlameDeck is accessible and user-friendly across a wide range of devices is paramount. Our responsive design strategy focuses on a mobile-first approach, progressively enhancing the layout and features for larger screens.

### Core Principles

1.  **Mobile-First**: Design and develop for the smallest screens first, then scale up. This ensures a solid foundation for core content and functionality.
2.  **Fluid Layouts**: Utilize flexible grids, percentages, and relative units (like `rem` and `em`) to allow content to adapt gracefully to different viewport sizes.
3.  **Progressive Enhancement**: Start with a baseline experience that works for all users and then add enhancements (more complex layouts, richer interactions) for users with more capable browsers or larger screens.
4.  **Content Prioritization**: On smaller screens, prioritize essential content and functionality. Less critical elements can be hidden or moved to secondary navigation.

### Breakpoints

We adhere to Tailwind CSS's default breakpoints, which provide a versatile foundation for responsive design:

-   `sm`: `640px`
-   `md`: `768px`
-   `lg`: `1024px`
-   `xl`: `1280px`
-   `2xl`: `1536px`

Use these breakpoints with Tailwind's responsive prefixes (e.g., `md:text-lg`, `lg:flex`) to adapt styling and layout.

### Layout Strategies

-   **Flexbox & Grid**: Leverage CSS Flexbox and Grid for creating adaptable and complex layouts that reflow naturally.
-   **Vertical Stacking**: On smaller screens (typically mobile), stack elements vertically for better readability and usability. As screen size increases, transition to multi-column layouts.
    ```css
    /* Example: Stacking on mobile, horizontal on medium screens */
    .responsive-container {
      display: flex;
      flex-direction: column; /* Stack by default (mobile) */
    }

    @media (min-width: 768px) { /* md breakpoint */
      .responsive-container {
        flex-direction: row; /* Horizontal layout on medium screens and up */
      }
    }
    ```
-   **Conditional Visibility**: Use Tailwind's responsive display utilities (e.g., `hidden md:block`) to show or hide elements based on screen size. This is useful for optimizing navigation or ancillary content.

### Navigation

-   **Mobile Navigation**: Implement collapsible navigation patterns (e.g., hamburger menus, off-canvas sidebars) for mobile devices to save screen real estate.
-   **Accessibility**: Ensure mobile navigation is easily discoverable, accessible via keyboard, and provides clear feedback.
-   **Primary Actions**: Keep primary calls-to-action visible and easily accessible, even on the smallest screens.

### Typography

-   **Responsive Font Sizes**: Use Tailwind's responsive font size utilities (e.g., `text-base md:text-lg`) or CSS `clamp()` for fluid typography that scales with the viewport.
    ```css
    .responsive-title {
      font-size: clamp(1.5rem, 5vw, 3rem); /* Example fluid font size */
    }
    ```
-   **Line Height & Spacing**: Adjust line height, margins, and padding on smaller screens to improve readability and avoid cramped text.

### Touch Targets

-   **Minimum Size**: Ensure all interactive elements (buttons, links, form controls) have a minimum touch target size of 44x44 CSS pixels to prevent accidental taps.
-   **Spacing**: Provide adequate spacing between touch targets to avoid mis-clicks.

### Images & Media

-   **Responsive Images**: Images should scale fluidly within their containers. Use `max-w-full` and `h-auto` by default.
    ```html
    <img src="path/to/image.jpg" alt="Descriptive alt text" class="max-w-full h-auto rounded-lg">
    ```
-   **Art Direction**: For critical imagery, consider using the `<picture>` element or responsive image attributes (`srcset`, `sizes`) to serve different image versions optimized for various screen sizes and resolutions. This can improve performance and visual presentation.
-   **Video & Embeds**: Ensure embedded media (videos, maps) are responsive and do not break the layout on smaller screens.

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