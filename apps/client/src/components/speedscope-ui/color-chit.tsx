interface ColorChitProps {
  color: string;
}

export function ColorChit(props: ColorChitProps) {
  const sizeClass = 'w-3 h-3';
  return (
    <span
      className={`relative -top-px inline-block align-middle mr-2 border border-secondary ${sizeClass}`}
      style={{ backgroundColor: props.color }}
    />
  );
}
