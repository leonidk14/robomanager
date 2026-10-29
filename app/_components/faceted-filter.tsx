"use client";

import { CirclePlus, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export interface FacetOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

/** Multi-select filter in a popover (the shadcn data-table "faceted filter" pattern). */
export function FacetedFilter<T extends string>({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: FacetOption<T>[];
  selected: T[];
  onChange: (selected: T[]) => void;
}) {
  const toggle = (value: T) => {
    const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    // Keep the options' order so the URL stays stable however the values were picked.
    onChange(options.map((option) => option.value).filter((item) => next.includes(item)));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <CirclePlus data-icon="inline-start" />
          {title}
          {selected.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              {selected.length > 2 ? (
                <Badge variant="secondary">{selected.length} selected</Badge>
              ) : (
                options
                  .filter((option) => selected.includes(option.value))
                  .map((option) => (
                    <Badge key={option.value} variant="secondary">
                      {option.label}
                    </Badge>
                  ))
              )}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  data-checked={selected.includes(option.value)}
                  onSelect={() => toggle(option.value)}
                >
                  <option.icon className="text-muted-foreground" />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {selected.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => onChange([])} className="justify-center">
                    Clear
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
