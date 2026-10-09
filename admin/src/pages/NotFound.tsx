import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-canvas">
      <div className="w-full max-w-md text-center">
        <p className="text-6xl font-extrabold text-accent mb-2">404</p>
        <h1 className="text-xl font-extrabold text-ink dark:text-white mb-2">
          Page not found
        </h1>
        <p className="text-sm text-muted mb-6">
          The page you're looking for doesn't exist or was moved.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-bold text-white bg-accent hover:opacity-90 transition-opacity"
        >
          <Compass size={16} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
