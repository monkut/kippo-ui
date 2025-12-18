import { useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";

export type MultiSelectOption = {
  id: number;
  displayId: string;
  title: string;
};

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  id?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "選択...",
  disabled = false,
  label,
  id,
}: MultiSelectProps) {
  const [query, setQuery] = useState("");

  const selectedOptions = options.filter((opt) => value.includes(opt.id));

  const filteredOptions =
    query === ""
      ? options
      : options.filter(
          (opt) =>
            opt.title.toLowerCase().includes(query.toLowerCase()) ||
            opt.displayId.toLowerCase().includes(query.toLowerCase()),
        );

  const handleSelect = (selected: MultiSelectOption[]) => {
    onChange(selected.map((s) => s.id));
    setQuery(""); // Reset search query after selection
  };

  const handleClose = () => {
    setQuery(""); // Reset search query when dropdown closes
  };

  const handleRemove = (idToRemove: number) => {
    onChange(value.filter((id) => id !== idToRemove));
  };

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <Combobox
        value={selectedOptions}
        onChange={handleSelect}
        onClose={handleClose}
        multiple
        disabled={disabled}
        immediate
      >
        <div className="relative">
          <div className="border border-gray-300 rounded-md bg-white min-h-[38px] focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
            {selectedOptions.length > 0 && (
              <div className="flex flex-wrap gap-1 p-1.5 pb-0">
                {selectedOptions.map((option) => (
                  <span
                    key={option.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-mono rounded"
                  >
                    {option.displayId}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemove(option.id);
                      }}
                      className="text-gray-500 hover:text-gray-700 focus:outline-none"
                      disabled={disabled}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-3.5 h-3.5"
                      >
                        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative flex items-center p-1.5">
              <ComboboxInput
                id={id}
                className="w-full border-none p-0 text-sm text-gray-900 placeholder-gray-400 focus:ring-0 focus:outline-none bg-transparent pr-8"
                placeholder={selectedOptions.length === 0 ? placeholder : "検索..."}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                displayValue={() => ""}
              />
              <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 text-gray-400"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.53 3.47a.75.75 0 0 0-1.06 0L6.22 6.72a.75.75 0 0 0 1.06 1.06L10 5.06l2.72 2.72a.75.75 0 1 0 1.06-1.06l-3.25-3.25Zm-4.31 9.81 3.25 3.25a.75.75 0 0 0 1.06 0l3.25-3.25a.75.75 0 1 0-1.06-1.06L10 14.94l-2.72-2.72a.75.75 0 0 0-1.06 1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </ComboboxButton>
            </div>
          </div>
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
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-gray-100 group-data-[focus]:bg-indigo-500 px-1.5 py-0.5 rounded">
                          {option.displayId}
                        </span>
                        <span className={selected ? "font-semibold" : ""}>{option.title}</span>
                      </div>
                      {selected && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 group-data-[focus]:text-white">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-5 h-5"
                          >
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
    </div>
  );
}
