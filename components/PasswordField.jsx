"use client";

import { useState } from "react";

export default function PasswordField({
  value,
  onChange,
  onBlur,
  placeholder,
  required,
  disabled,
  inputClassName,
  autoComplete,
  name,
  id,
  ariaInvalid,
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={ariaInvalid}
        className={`${inputClassName || ""} pr-12`.trim()}
      />

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShow((prev) => !prev)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={show}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
      >
        {show ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M3 3l18 18" />
            <path d="M10.58 10.58a2 2 0 102.83 2.83" />
            <path d="M16.68 16.67A9.86 9.86 0 0112 18C7 18 2.73 14.89 1 12c.79-1.32 1.99-2.81 3.58-4.03" />
            <path d="M9.88 5.08A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 6-.51.86-1.2 1.79-2.06 2.67" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
