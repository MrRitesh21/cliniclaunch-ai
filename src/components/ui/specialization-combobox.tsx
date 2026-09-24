import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SPECIALIZATIONS } from "@/lib/specializations";

export function SpecializationCombobox({
  value,
  onChange,
  placeholder = "Select or type a specialization",
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-h-[320px]" align="start">
        <Command>
          <CommandInput placeholder="Search specialization…" />
          <CommandList>
            <CommandEmpty>
              <div className="p-2 space-y-2">
                <p className="text-xs text-muted-foreground">No preset match. Add a custom one:</p>
                <div className="flex gap-1.5">
                  <Input
                    autoFocus
                    placeholder="e.g. Sleep Dentistry"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && custom.trim()) {
                        onChange(custom.trim());
                        setCustom("");
                        setOpen(false);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => {
                      if (custom.trim()) {
                        onChange(custom.trim());
                        setCustom("");
                        setOpen(false);
                      }
                    }}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {SPECIALIZATIONS.map((s) => (
                <CommandItem
                  key={s}
                  value={s}
                  onSelect={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 size-4", value === s ? "opacity-100" : "opacity-0")} />
                  {s}
                </CommandItem>
              ))}
              {value && !SPECIALIZATIONS.includes(value) && (
                <CommandItem value={value} onSelect={() => setOpen(false)}>
                  <Check className="mr-2 size-4 opacity-100" />
                  <span className="italic">{value} (custom)</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
