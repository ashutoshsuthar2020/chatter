import React from "react"

const Button = (
    {
        label = 'Button',
        type = 'button',
        className = '',
        variant = 'primary',
        size = 'md',
        disabled = false,
        onClick = () => { },
    }
) => {
    const baseClasses = "font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-primary-500 hover:bg-primary-600 text-white focus:ring-primary-500 shadow-soft hover:shadow-medium",
        secondary: "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 focus:ring-neutral-500",
        outline: "border-2 border-primary-500 text-primary-600 hover:bg-primary-50 focus:ring-primary-500"
    };

    const sizes = {
        sm: "px-4 py-2 text-sm",
        md: "px-6 py-3 text-sm",
        lg: "px-8 py-4 text-base"
    };

    return (
        <button
            type={type}
            className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled}
            onClick={onClick}
        >
            {label}
        </button>
    )
}

export default Button