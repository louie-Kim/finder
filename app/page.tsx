import FindReplaceEditor from "./components/FindReplaceEditor";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0c10] text-white">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-40 top-10 h-72 w-72 rounded-full bg-[#2333ff] blur-[140px]" />
          <div className="absolute right-0 top-52 h-80 w-80 rounded-full bg-[#0f9d58] blur-[160px]" />
          <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-[#f59e0b] blur-[160px]" />
        </div>

        <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-16">
          <header className="flex flex-col gap-4">
            <p className="text-sm uppercase tracking-[0.4em] text-white/50">
              Finder · CodeMirror
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-white">
              VS Code 스타일 찾기/바꾸기 UI
            </h1>
            <p className="max-w-2xl text-base text-white/60">
              Ctrl + F로 찾기, Ctrl + H로 바꾸기 패널을 열 수 있습니다. 버튼을
              사용해 다음/이전 이동, 바꾸기, 전체 바꾸기를 실행하세요.
            </p>
          </header>

          <FindReplaceEditor />
        </main>
      </div>
    </div>
  );
}
