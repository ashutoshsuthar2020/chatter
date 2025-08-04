import React from "react";

const Input = ({
    label = '',
    name = '',
    type = 'text',
    className = '',
    inputClassName = '',
    isRequired = true,
    placeholder = '',
    value = '',
    onChange = () => { },
    onKeyPress = () => { },
    disabled = false,
}) => {
    return (
        <div className={`w-full ${className}`}>
            {label && (
                <label htmlFor={name} className="block text-sm font-medium text-neutral-700 mb-2">
                    {label}
                </label>
            )}
            <input
                type={type}
                id={name}
                className={`w-full px-4 py-3 bg-white border border-neutral-200 text-neutral-900 text-sm rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 placeholder-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-50 ${inputClassName}`}
                placeholder={placeholder}
                required={isRequired}
                value={value}
                onChange={onChange}
                onKeyPress={onKeyPress}
                disabled={disabled}
            />
        </div>
    )
}
export default Input