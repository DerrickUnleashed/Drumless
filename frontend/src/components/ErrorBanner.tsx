export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (message === null) {
    return null;
  }

  return (
    <div className="error-banner" role="alert">
      <p>{message}</p>
      <button className="button subtle" type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
