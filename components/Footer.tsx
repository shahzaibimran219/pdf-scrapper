export default function Footer() {
  return (
    <footer className="mt-12 border-t border-zinc-200/80 bg-white/70 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© {new Date().getFullYear()} PDF Resume Scrapper</p>
        <nav className="flex items-center gap-4">
          <a className="hover:underline" href="/terms">Terms</a>
          <a className="hover:underline" href="/privacy">Privacy</a>
        </nav>
      </div>
    </footer>
  );
}
