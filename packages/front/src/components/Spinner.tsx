export function Spinner({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div
        className={`animate-spin rounded-full border-4 border-blue-500 border-t-transparent ${className}`}
      />
    </div>
  );
}
