import { memo } from 'react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = memo(function Card({ children, className = '', padding = 'md', hover = false, onClick }: CardProps) {
  return (
    <motion.div
      className={`
        rounded-xl border border-gray-200 bg-white shadow-sm
        dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-slate-950/20
        ${hover ? 'hover:border-gray-300 hover:shadow-md dark:hover:border-slate-600 dark:hover:bg-slate-900 cursor-pointer' : ''}
        ${paddingStyles[padding]}
        ${className}
      `}
      whileHover={hover ? { scale: 1.01 } : undefined}
      transition={{ duration: 0.2 }}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
});

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export const CardHeader = memo(function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`mb-3 border-b border-gray-100 pb-3 dark:border-slate-700 ${className}`}>
      {children}
    </div>
  );
});

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export const CardTitle = memo(function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3 className={`text-lg font-semibold text-gray-900 dark:text-gray-100 ${className}`}>
      {children}
    </h3>
  );
});

interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export const CardDescription = memo(function CardDescription({ children, className = '' }: CardDescriptionProps) {
  return (
    <p className={`mt-1 text-sm text-gray-500 dark:text-gray-400 ${className}`}>
      {children}
    </p>
  );
});

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export const CardContent = memo(function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={className}>{children}</div>;
});

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export const CardFooter = memo(function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`mt-3 border-t border-gray-100 pt-3 dark:border-slate-700 ${className}`}>
      {children}
    </div>
  );
});
