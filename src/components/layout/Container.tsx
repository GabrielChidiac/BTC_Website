export function Container({
  children,
  className = "",
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className={`mx-auto ${wide ? "max-w-5xl" : "max-w-3xl"} px-4 sm:px-6 ${className}`}>
      {children}
    </div>
  );
}
