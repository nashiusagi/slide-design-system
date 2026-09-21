/**
 * カタログが `design/` の契約ディレクトリを読むときの共通部分。
 *
 * レイアウト（`src/docs/layouts.ts`）も部品（`src/docs/components.ts`）も、読み方は同じ——
 * `import.meta.glob` でディレクトリごと読み、パス順に並べ、0件なら落とす。契約の種類ごとに
 * 同じ関数を写すと、#38 以降で種類が増えるたびに写しが増え、並び順やガードの方針を変えたい
 * ときに片方だけ直す事故が起きる。
 *
 * `import.meta.glob` の呼び出し自体はここへ持てない。Vite がビルド時にパスを静的に読む必要が
 * あり、引数で受け取る形にすると解決できないからだ。ここが受け取るのは、その結果である。
 */

/**
 * 読み込んだモジュールを、パス順に並べた契約の配列にする。
 *
 * 0件なら落とす。glob のパスがずれても、ページは「契約が0件」の姿で何事もなく描かれ、件数を
 * 突き合わせるテストも `0 === 0` で通る（DR-0043 決定1 の「読み込んだ CSS が空のときは例外を
 * 投げる」と同じ形の素通り）。空を許さなければ、ずれは実行した瞬間に落ちる。
 *
 * glob の結果を引数で受けるのは、この「0件なら落とす」自体をテストで踏むため。モジュールの
 * 副作用として書くと、空の入力を与える手段が無く、ガードが壊れても気づけない。
 *
 * @param modules `import.meta.glob` の結果
 * @param contractDir 例外メッセージに出す契約ディレクトリ（例: `design/layouts/`）
 * @param loaderPath 例外メッセージに出す、glob を書いているファイル
 */
export function contractsFrom<T>(
  modules: Record<string, T>,
  contractDir: string,
  loaderPath: string,
): T[] {
  const entries = Object.entries(modules)

  if (entries.length === 0) {
    throw new Error(
      `${contractDir} の契約を読み込めなかった（0件）。${loaderPath} の import.meta.glob のパスを確認すること。`,
    )
  }

  return entries.sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath)).map(([, contract]) => contract)
}
