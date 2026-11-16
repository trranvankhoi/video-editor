declare module '@diffusionstudio/piper-wasm/build/piper_phonemize.js' {
  interface PiperPhonemizeOptions {
    print?: (line: string) => void
    printErr?: (line: string) => void
    locateFile?: (path: string) => string
    noExitRuntime?: boolean
    noInitialRun?: boolean
  }

  interface PiperPhonemizeModule {
    callMain: (args: string[]) => void
  }

  export default function createPiperPhonemize(
    options?: PiperPhonemizeOptions,
  ): Promise<PiperPhonemizeModule>
}
