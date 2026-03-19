import type { ReactNode } from "react";

type FormFieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  action?: ReactNode;
  children: ReactNode;
};

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  action,
  children
}: FormFieldProps) {
  return (
    <label className="field" htmlFor={htmlFor}>
      <span className="field-head">
        <span className="field-label">
          {label}
          {required ? <span className="field-required"> *</span> : null}
        </span>
        {action ? <span className="field-action">{action}</span> : null}
      </span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}
