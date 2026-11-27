/** Centered 読み込み中 placeholder shown while a page (or its data) loads. */
export function PageLoading() {
  return (
    <div className="flex justify-center items-center h-64">
      <div className="text-gray-500">読み込み中...</div>
    </div>
  );
}

/** Red banner for a page-level error message. */
export function PageError({ message }: { message: string }) {
  return (
    <div className="rounded-md bg-red-50 p-4">
      <div className="text-sm text-red-800">{message}</div>
    </div>
  );
}
