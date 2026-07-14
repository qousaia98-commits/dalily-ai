"use client";

import { useLocale } from "next-intl";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { localizedField } from "@/lib/categories/format";
import type { CategoryGroupWithLeaves } from "@/lib/categories/types";
import type { Locale } from "@/lib/i18n/config";

type CategorySelectProps = {
  groups: CategoryGroupWithLeaves[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
};

export function CategorySelect({
  groups,
  value,
  onValueChange,
  placeholder,
  id,
  disabled,
}: CategorySelectProps) {
  const locale = useLocale() as Locale;

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {groups.map(({ group, leaves }) => (
          <SelectGroup key={group.id}>
            <SelectLabel>{localizedField(group.name, locale)}</SelectLabel>
            {leaves.map((leaf) => (
              <SelectItem key={leaf.id} value={leaf.slug}>
                {localizedField(leaf.name, locale)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
