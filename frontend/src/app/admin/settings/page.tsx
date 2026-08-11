'use client';

import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useSettings, useUpdateSetting } from '@/modules/admin';

function displayValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function parseInput(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export default function AdminSettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSetting();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  function startEdit(key: string, value: unknown) {
    setEditingKey(key);
    setEditingValue(displayValue(value));
  }

  async function handleSave(key: string) {
    await updateMutation.mutateAsync({ key, value: parseInput(editingValue) });
    setEditingKey(null);
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-h2 font-serif font-medium text-text-primary">Settings</h1>
        <p className="mt-1 text-small text-text-muted">Platform-wide configuration values</p>
      </div>

      {isLoading && <p className="text-small text-text-muted">Loading&hellip;</p>}
      {!isLoading && settings?.length === 0 && <p className="text-small text-text-muted">No settings configured yet.</p>}

      {settings && settings.length > 0 && (
        <div className="divide-y divide-border rounded-card border border-border bg-bg-surface">
          {settings.map((setting) => {
            const isEditing = editingKey === setting.key;
            return (
              <div key={setting.key} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-small font-semibold text-text-primary">{setting.key}</p>
                  <p className="mt-0.5 text-caption text-text-muted">
                    Updated {new Date(setting.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex-1">
                  {isEditing ? (
                    <Input
                      autoFocus
                      value={editingValue}
                      onChange={(event) => setEditingValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handleSave(setting.key);
                        if (event.key === 'Escape') setEditingKey(null);
                      }}
                    />
                  ) : (
                    <p className="truncate text-body text-text-primary">{displayValue(setting.value)}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isEditing ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="px-2"
                        onClick={() => handleSave(setting.key)}
                        disabled={updateMutation.isPending}
                        aria-label="Save"
                      >
                        <Check size={14} aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="px-2"
                        onClick={() => setEditingKey(null)}
                        aria-label="Cancel"
                      >
                        <X size={14} aria-hidden="true" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      onClick={() => startEdit(setting.key, setting.value)}
                      aria-label="Edit"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
