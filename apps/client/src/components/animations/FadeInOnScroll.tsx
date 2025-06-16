import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useEffect } from 'react';
import * as React from 'react';

interface FadeInOnScrollProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

function FadeInOnScroll({ children, delay = 0, duration = 0.5, className }: FadeInOnScrollProps) {
  const controls = useAnimation();
  const [ref, inView] = useInView({
    triggerOnce: true, // Only trigger once
    threshold: 0.1, // Trigger when 10% of the element is in view
  });

  useEffect(() => {
    if (inView) {
      controls.start('visible');
    }
  }, [controls, inView]);

  return (
    <motion.div
      ref={ref}
      animate={controls}
      initial="hidden"
      variants={{
        visible: { opacity: 1, y: 0, transition: { duration, delay } },
        hidden: { opacity: 0, y: 20 }, // Start slightly down
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default FadeInOnScroll;
