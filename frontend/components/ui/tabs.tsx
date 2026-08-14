'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

// ─── Context ──────────────────────────────────────────────────────────────────

interface TabsContextValue {
  activeTab: string
  setActiveTab: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue>({
  activeTab: '',
  setActiveTab: () => {},
})

// ─── Root ─────────────────────────────────────────────────────────────────────

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

function Tabs({
  defaultValue = '',
  value: controlledValue,
  onValueChange,
  children,
  className,
  ...props
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)

  const isControlled = controlledValue !== undefined
  const activeTab = isControlled ? controlledValue : internalValue

  const setActiveTab = React.useCallback(
    (val: string) => {
      if (!isControlled) setInternalValue(val)
      onValueChange?.(val)
    },
    [isControlled, onValueChange]
  )

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('w-full', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

// ─── List ─────────────────────────────────────────────────────────────────────

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn('flex border-b border-border-warm gap-0', className)}
      {...props}
    />
  )
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

function TabsTrigger({ value, className, children, ...props }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = React.useContext(TabsContext)
  const isActive = activeTab === value

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      onClick={() => setActiveTab(value)}
      className={cn(
        'px-4 py-2.5 text-[14px] font-[600] font-public-sans',
        'border-b-2 transition-colors',
        '-mb-px', // overlap the list border
        isActive
          ? 'border-accent text-primary'
          : 'border-transparent text-muted-text hover:text-primary',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ─── Content ──────────────────────────────────────────────────────────────────

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const { activeTab } = React.useContext(TabsContext)

  if (activeTab !== value) return null

  return (
    <div
      role="tabpanel"
      className={cn('pt-4', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
