import type { ProjectParticipant } from "~/lib/api/generated/models";

/** The project's participants (kiconiaworks/kippo#75) with their default percentage / role —
 * the values 参加者を追加 used for the remaining months. Month-independent. */
export function ParticipantsList({ participants }: { participants: ProjectParticipant[] }) {
  return (
    <section className="bg-white shadow rounded-lg p-6 overflow-x-auto">
      <h2 className="text-lg font-medium text-gray-900 mb-4">参加者 ({participants.length}名)</h2>
      {participants.length === 0 ? (
        <p className="text-sm text-gray-500">参加者はまだいません。</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="py-2 pr-4">ユーザー</th>
              <th className="py-2 px-3 text-right min-w-[6rem]">既定の割当</th>
              <th className="py-2 px-3">ロール</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-4 text-gray-900 font-medium whitespace-nowrap">
                  {p.user_display_name || p.user_username}
                </td>
                <td className="py-2 px-3 text-right text-gray-700">{p.percentage}%</td>
                <td className="py-2 px-3 text-gray-700">{p.role || "(指定なし)"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
