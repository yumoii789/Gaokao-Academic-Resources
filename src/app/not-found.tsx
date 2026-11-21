import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 px-6 text-center text-white">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-amber-400">
        <span className="font-serif text-5xl font-bold">墨</span>
      </div>
      <p className="font-serif text-7xl font-bold tracking-widest text-amber-400">404</p>
      <h1 className="mt-4 text-2xl font-semibold">这个页面迷路了</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-indigo-200">
        你要找的内容不在这里。回到首页，继续真题练习或词汇记忆吧。
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-white px-8 py-3 text-sm font-semibold text-indigo-900 transition hover:bg-amber-300"
      >
        返回首页
      </Link>
    </main>
  );
}
