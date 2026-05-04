import { Topbar } from "@/components/layout/Topbar";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return <Topbar title={title} />;
}
