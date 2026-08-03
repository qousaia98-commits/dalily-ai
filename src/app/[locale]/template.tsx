/**
 * Remounts on navigation so CSS page-enter can re-fire.
 * Prefer CSS template remount over experimental View Transitions
 * (Next experimental.viewTransition is not production-stable yet;
 * Firefox support for VT is incomplete — see summary).
 */
export default function LocaleTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="animate-page-enter">{children}</div>;
}
