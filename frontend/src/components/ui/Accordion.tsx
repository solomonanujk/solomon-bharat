'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccordionContextValue {
  openItems: Set<string>;
  toggle: (value: string) => void;
}

const AccordionContext = React.createContext<AccordionContextValue>({
  openItems: new Set(),
  toggle: () => {},
});

const AccordionItemContext = React.createContext<{ value: string }>({ value: '' });

interface AccordionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
  children: React.ReactNode;
}

function Accordion({ type = 'single', defaultValue, children, className, ...props }: AccordionProps) {
  const [openItems, setOpenItems] = React.useState<Set<string>>(() => {
    if (!defaultValue) return new Set();
    return new Set(Array.isArray(defaultValue) ? defaultValue : [defaultValue]);
  });

  const toggle = React.useCallback(
    (value: string) => {
      setOpenItems((prev) => {
        const next = new Set(prev);
        if (next.has(value)) {
          next.delete(value);
        } else {
          if (type === 'single') next.clear();
          next.add(value);
        }
        return next;
      });
    },
    [type]
  );

  return (
    <AccordionContext.Provider value={{ openItems, toggle }}>
      <div className={cn('flex flex-col', className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function AccordionItem({ value, className, children, ...props }: AccordionItemProps) {
  return (
    <AccordionItemContext.Provider value={{ value }}>
      <div className={cn('border-t border-border', className)} {...props}>
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

function AccordionTrigger({ className, children, ...props }: AccordionTriggerProps) {
  const { openItems, toggle } = React.useContext(AccordionContext);
  const { value } = React.useContext(AccordionItemContext);
  const open = openItems.has(value);

  return (
    <button
      type="button"
      onClick={() => toggle(value)}
      aria-expanded={open}
      className={cn(
        'w-full flex items-center justify-between py-4 text-left',
        'text-sm font-semibold font-sans text-text-primary hover:text-text-muted transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary rounded',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown
        size={16}
        className={cn('text-text-muted transition-transform duration-200 flex-shrink-0', open && 'rotate-180')}
        aria-hidden="true"
      />
    </button>
  );
}

interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {}

function AccordionContent({ className, children, ...props }: AccordionContentProps) {
  const { openItems } = React.useContext(AccordionContext);
  const { value } = React.useContext(AccordionItemContext);
  const open = openItems.has(value);

  return (
    <div className={cn('overflow-hidden transition-all duration-200', open ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0')}>
      <div className={cn('pb-5 text-sm leading-relaxed font-normal font-sans text-text-muted', className)} {...props}>
        {children}
      </div>
    </div>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
