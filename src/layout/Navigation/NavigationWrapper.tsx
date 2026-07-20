import { useEffect } from "react";
import Sidebar from "./Sidebar/Sidebar";
import { useLocation } from "react-router-dom";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function NavigationWrapper({ open, onOpenChange }: Props) {
  const location = useLocation();

  useEffect(() => {
    onOpenChange(false);
  }, [location.pathname]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="bg-muted text-foreground w-80 sm:max-w-sm">
        <DrawerTitle className="sr-only">Меню</DrawerTitle>
        <Sidebar />
      </DrawerContent>
    </Drawer>
  );
}
