import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { useDocumentTitle } from './useDocumentTitle';

export function PageLoader() {
  return (
    <div className="min-h-screen bg-[#0B1713] flex items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-[#9CAEA2] text-xs">
        <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
        <span>Loading ATmosIQ…</span>
      </div>
    </div>
  );
}

function Shell({ code, title, message }: { code: string; title: string; message: string }) {
  return (
    <div className="min-h-screen bg-[#0B1713] text-[#F2F5F2] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-[#101F18] border border-emerald-950 p-8 rounded-xl shadow-xl">
        <div className="font-mono text-emerald-400 text-sm tracking-widest">{code}</div>
        <h1 className="text-2xl font-bold mt-2">{title}</h1>
        <p className="text-sm text-[#9CAEA2] mt-2 leading-relaxed">{message}</p>
        <Link
          to="/"
          className="inline-block mt-6 px-4 py-2 bg-[#174C34] hover:bg-[#2E8B57] border border-[#2E8B57] rounded-lg text-xs font-semibold transition-colors"
        >
          Return to ATmosIQ
        </Link>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return <Shell code="404" title="Signal lost" message="This page does not exist or has moved." />;
}

export function RouteErrorPage() {
  const error = useRouteError();
  useDocumentTitle('Something went wrong');
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <Shell code="404" title="Signal lost" message="This page does not exist or has moved." />;
  }
  return <Shell code="ERROR" title="Something went wrong" message="An unexpected error occurred. Please try again." />;
}
