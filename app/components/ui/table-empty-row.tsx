type TableEmptyRowProps = {
  colSpan: number;
  message: string;
};

export function TableEmptyRow({ colSpan, message }: TableEmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-sm text-zinc-500">
        {message}
      </td>
    </tr>
  );
}
