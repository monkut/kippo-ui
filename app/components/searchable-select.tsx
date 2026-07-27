import { useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";

export type SearchableSelectOption = {
  id: string;
  label: string;
};

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

/** Single-select combobox: type to filter options, matches the multi-select styling. */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "-- 選択してください --",
  disabled = false,
  id,
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");

  const selectedOption = options.find((opt) => opt.id === value) ?? null;

  const filteredOptions =
    query === ""
      ? options
      : options.filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <Combobox
      value={selectedOption}
      onChange={(opt: SearchableSelectOption | null) => onChange(opt?.id ?? "")}
      onClose={() => setQuery("")}
      disabled={disabled}
      immediate
    >
      <div className="relative">
        <ComboboxInput
          id={id}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 pr-9 bg-white"
          placeholder={placeholder}
          displayValue={(opt: SearchableSelectOption | null) => opt?.label ?? ""}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5 text-gray-400"
          >
            <title>開く</title>
            <path
              fillRule="evenodd"
              d="M10.53 3.47a.75.75 0 0 0-1.06 0L6.22 6.72a.75.75 0 0 0 1.06 1.06L10 5.06l2.72 2.72a.75.75 0 1 0 1.06-1.06l-3.25-3.25Zm-4.31 9.81 3.25 3.25a.75.75 0 0 0 1.06 0l3.25-3.25a.75.75 0 1 0-1.06-1.06L10 14.94l-2.72-2.72a.75.75 0 0 0-1.06 1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </ComboboxButton>
        <ComboboxOptions
          anchor="bottom start"
          className="z-10 mt-1 max-h-60 w-[var(--input-width)] overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none [--anchor-gap:4px]"
        >
          {filteredOptions.length === 0 ? (
            <div className="px-4 py-2 text-gray-500">該当なし</div>
          ) : (
            filteredOptions.map((option) => (
              <ComboboxOption
                key={option.id}
                value={option}
                className="group relative cursor-pointer select-none py-2 pl-3 pr-9 text-gray-900 data-[focus]:bg-indigo-600 data-[focus]:text-white"
              >
                {({ selected }) => (
                  <>
                    <span className={selected ? "font-semibold" : ""}>{option.label}</span>
                    {selected && (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 group-data-[focus]:text-white">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-5 h-5"
                        >
                          <title>選択中</title>
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    )}
                  </>
                )}
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
