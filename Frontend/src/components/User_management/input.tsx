import type React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>{
  icon?:React.ReactNode;
  error?: string | boolean;
  isLoading?: boolean;
}

const Input:React.FC<InputProps> = ({
  className="",
  icon,
  type = 'text',
  name = '',
  placeholder = '',
  value,
  onChange,
  onBlur,
  error = false,
  isLoading = false,
}) => {
  const inputBaseClass = 'text-bgsecondary w-full border rounded-md p-2 border-bgprimary ';
  let classNames;

  if (type == 'submit'){
    classNames = `primary-button ${error ? 'pointer-events-none' : ''}`; 
  } else {
    classNames = `input-field ${error ? 'ring-1 ring-red border-red' : ''}`;
  }

  return (
    <div className={`relative w-full ${className}`}>
      {icon && (
        <span className="absolute -translate-y-1/2 text-bgsecondary/50 left-3 top-1/2">
          {icon}
        </span>
      )}

      <input
        type={type}
        name={name}
        placeholder={placeholder}
        value={isLoading ? '' : value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={!!(error || isLoading) && type=="submit"}
        className={`${inputBaseClass} ${classNames} ${
          icon ? 'pl-10' : ''
        }`}
      />
      { isLoading && type == 'submit' && (<span className="absolute inset-0 flex items-center justify-center w-full h-full" >
    <span className="w-5 h-5 border-2 border-bgsecondary border-t-transparent rounded-full animate-spin"></span>
  </span> )}
    </div>
  )
}

export default Input