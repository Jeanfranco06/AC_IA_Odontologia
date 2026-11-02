import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/shared/utils';

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, defaultChecked, onCheckedChange, onChange, ...props }, ref) => {
    const isControlled = checked !== undefined;
    const [internalChecked, setInternalChecked] = React.useState<boolean>(
      Boolean(defaultChecked)
    );

    const isChecked = isControlled ? Boolean(checked) : internalChecked;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newChecked = e.target.checked;
      if (!isControlled) {
        setInternalChecked(newChecked);
      }
      onChange?.(e);
      onCheckedChange?.(newChecked);
    };

    return (
      <div className="relative inline-flex items-center justify-center shrink-0">
        <input
          type="checkbox"
          ref={ref}
          checked={isChecked}
          onChange={handleChange}
          className="peer sr-only"
          {...props}
        />
        <div
          onClick={(e) => {
            e.stopPropagation();
            const target = (e.currentTarget.previousSibling as HTMLInputElement);
            if (target) {
              target.click();
            }
          }}
          className={cn(
            'h-5 w-5 shrink-0 rounded-md border-2 transition-all cursor-pointer flex items-center justify-center select-none shadow-2xs',
            'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500 peer-focus-visible:ring-offset-2',
            'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            isChecked
              ? 'bg-teal-600 border-teal-600 dark:bg-teal-500 dark:border-teal-500 text-white'
              : 'border-slate-300 bg-white hover:border-teal-500',
            className
          )}
        >
          {isChecked && (
            <Check 
              className="h-3.5 w-3.5 text-white dark:text-white stroke-[3.5]" 
              stroke="#ffffff"
            />
          )}
        </div>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
